#!/usr/bin/env python
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Iterable

import pymysql


SYSTEM_DATABASES = {"mysql", "information_schema", "performance_schema", "sys"}
DEFAULT_COMMIT_MESSAGE = "自动导出本地 MySQL 数据库并更新项目"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="批量导出本地 MySQL 数据库到 db_dumps/，并可选执行 Git 提交与推送。"
    )
    parser.add_argument("--host", help="MySQL 主机，优先级高于环境变量和 Django 配置")
    parser.add_argument("--port", type=int, help="MySQL 端口，默认 3306")
    parser.add_argument("--user", help="MySQL 用户名")
    parser.add_argument("--password", help="MySQL 密码")
    parser.add_argument(
        "--dump-dir",
        help="导出目录，默认使用项目根目录下的 db_dumps",
    )
    parser.add_argument(
        "--exclude",
        nargs="*",
        default=[],
        help="额外排除的数据库名列表",
    )
    parser.add_argument(
        "--databases",
        nargs="*",
        help="手动指定要导出的数据库名；未提供时默认导出 Django 项目已配置的 MySQL 数据库",
    )
    parser.add_argument(
        "--all-databases",
        action="store_true",
        help="导出当前 MySQL 实例中的全部非系统库",
    )
    parser.add_argument(
        "--git-commit",
        action="store_true",
        help="导出后自动执行 git add 和 git commit",
    )
    parser.add_argument(
        "--git-push",
        action="store_true",
        help="导出后自动推送当前分支到 origin",
    )
    parser.add_argument(
        "--commit-message",
        default=DEFAULT_COMMIT_MESSAGE,
        help="Git 提交信息",
    )
    parser.add_argument(
        "--branch",
        help="指定推送分支；未提供时自动读取当前分支",
    )
    return parser.parse_args()


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def load_django_mysql_defaults(root: Path) -> dict[str, str]:
    sys.path.insert(0, str(root))
    try:
        from uav_platform.settings import DATABASES  # type: ignore
    except Exception:
        return {}

    default_db = DATABASES.get("default", {})
    if default_db.get("ENGINE") != "django.db.backends.mysql":
        return {}

    return {
        "host": str(default_db.get("HOST") or "127.0.0.1"),
        "port": str(default_db.get("PORT") or "3306"),
        "user": str(default_db.get("USER") or ""),
        "password": str(default_db.get("PASSWORD") or ""),
    }


def load_django_mysql_database_names(root: Path) -> list[str]:
    sys.path.insert(0, str(root))
    try:
        from uav_platform.settings import DATABASES  # type: ignore
    except Exception:
        return []

    database_names: list[str] = []
    for config in DATABASES.values():
        if config.get("ENGINE") != "django.db.backends.mysql":
            continue
        name = str(config.get("NAME") or "").strip()
        if name and name not in SYSTEM_DATABASES and name not in database_names:
            database_names.append(name)
    return database_names


def resolve_mysql_config(args: argparse.Namespace, root: Path) -> dict[str, str]:
    django_defaults = load_django_mysql_defaults(root)
    config = {
        "host": args.host or os.getenv("MYSQL_HOST") or django_defaults.get("host") or "127.0.0.1",
        "port": str(args.port or os.getenv("MYSQL_PORT") or django_defaults.get("port") or "3306"),
        "user": args.user or os.getenv("MYSQL_USER") or django_defaults.get("user") or "root",
        "password": args.password or os.getenv("MYSQL_PASSWORD") or django_defaults.get("password") or "",
    }
    if not config["password"]:
        raise ValueError("未提供 MySQL 密码，请通过 --password 或 MYSQL_PASSWORD 设置。")
    return config


def list_databases(config: dict[str, str], excluded: Iterable[str]) -> list[str]:
    excluded_set = SYSTEM_DATABASES | set(excluded)
    connection = pymysql.connect(
        host=config["host"],
        port=int(config["port"]),
        user=config["user"],
        password=config["password"],
        charset="utf8mb4",
        cursorclass=pymysql.cursors.Cursor,
    )
    try:
        with connection.cursor() as cursor:
            cursor.execute("SHOW DATABASES;")
            databases = [row[0] for row in cursor.fetchall()]
    finally:
        connection.close()
    return [name for name in databases if name not in excluded_set]


def resolve_target_databases(args: argparse.Namespace, root: Path, config: dict[str, str]) -> list[str]:
    if args.databases:
        return [name for name in args.databases if name not in SYSTEM_DATABASES]
    if args.all_databases:
        return list_databases(config, args.exclude)

    configured_databases = load_django_mysql_database_names(root)
    return [name for name in configured_databases if name not in set(args.exclude)]


def find_mysqldump() -> str:
    command = shutil.which("mysqldump")
    if command:
        return command
    raise FileNotFoundError("未找到 mysqldump，请先确认 MySQL 客户端已安装并加入 PATH。")


def export_database(mysqldump_cmd: str, config: dict[str, str], db_name: str, output_file: Path) -> None:
    output_file.parent.mkdir(parents=True, exist_ok=True)
    dump_command = [
        mysqldump_cmd,
        f"--host={config['host']}",
        f"--port={config['port']}",
        f"--user={config['user']}",
        "--single-transaction",
        "--skip-lock-tables",
        "--routines",
        "--events",
        "--triggers",
        "--default-character-set=utf8mb4",
        db_name,
    ]
    dump_env = os.environ.copy()
    dump_env["MYSQL_PWD"] = config["password"]
    with output_file.open("wb") as dump_stream:
        subprocess.run(dump_command, check=True, stdout=dump_stream, env=dump_env)


def run_git_command(root: Path, args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    )


def get_current_branch(root: Path) -> str:
    result = run_git_command(root, ["branch", "--show-current"])
    branch = result.stdout.strip()
    if not branch:
        raise RuntimeError("无法识别当前 Git 分支。")
    return branch


def has_staged_changes(root: Path, target_dir: Path) -> bool:
    result = run_git_command(root, ["status", "--short", "--", str(target_dir)])
    return bool(result.stdout.strip())


def git_add_commit_push(root: Path, dump_dir: Path, commit_message: str, push: bool, branch: str | None) -> None:
    run_git_command(root, ["add", str(dump_dir)])
    if not has_staged_changes(root, dump_dir):
        print("db_dumps/ 没有新增或变更内容，跳过 Git 提交。")
        return

    run_git_command(root, ["commit", "-m", commit_message])
    if push:
        target_branch = branch or get_current_branch(root)
        run_git_command(root, ["push", "origin", target_branch])


def main() -> int:
    args = parse_args()
    root = project_root()
    dump_dir = Path(args.dump_dir) if args.dump_dir else root / "db_dumps"
    config = resolve_mysql_config(args, root)
    databases = resolve_target_databases(args, root, config)
    mysqldump_cmd = find_mysqldump()

    if not databases:
        print("未发现可导出的项目数据库。")
        return 0

    print(f"检测到 {len(databases)} 个待导出的数据库：{', '.join(databases)}")
    for db_name in databases:
        file_path = dump_dir / f"{db_name}.sql"
        print(f"正在导出 {db_name} -> {file_path}")
        export_database(mysqldump_cmd, config, db_name, file_path)

    if args.git_commit or args.git_push:
        git_add_commit_push(
            root=root,
            dump_dir=dump_dir,
            commit_message=args.commit_message,
            push=args.git_push,
            branch=args.branch,
        )

    print("导出完成。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
