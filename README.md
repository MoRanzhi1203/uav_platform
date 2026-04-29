# 重庆山地无人机群林农协同作业与风险管控系统

<div align="center">
  <img src="static/img/logo.png" alt="Logo" width="120">
  <p align="center">
    <strong>基于 Django + GIS 的专业无人机作业管理平台</strong>
  </p>
</div>

---

## 📖 项目简介

本项目专为**重庆山地复杂环境**打造，是一个集无人机作业规划、地块精细化管理、多部门（林业/农业）协同控制于一体的综合管控系统。系统核心地块编辑工作台具备**像素级（10m 精度）**的地理空间数据处理能力，旨在解决传统作业中定位不准、边界模糊、风险难控等核心痛点。

---

## ✨ 核心功能特性

### 🗺️ 专业级地块编辑工作台
- **像素级精度控制**：支持 10m×10m 空间网格的连续画笔绘制，支持自定义笔刷（圆形/方形/NxN）。
- **空间拓扑逻辑校验**：内置地块重叠检测、自动切分不连续区域，确保空间数据拓扑正确。
- **PS 式图层管理**：多图层（业务/网格/边界）独立控制，支持锁定、隐藏及半透明叠加分析。
- **高级布尔运算**：支持本地化的地块合并、差集运算，无需后端往返即可完成复杂边界修正。

### 📑 业务协同与数据中心
- **林农业务智能联动**：针对林业巡检、农业植保提供差异化业务逻辑与属性字段。
- **多源数据融合**：集成重庆行政区划、地形等高线、卫星底图等多维地理信息数据。
- **自动化视口管理**：加载目标地块时自动计算空间包围盒并平移对齐，提升交互效率。

### 🛡️ 风险防控与预警
- **作业边界管控**：通过高精度地理围栏，防止无人机越界飞行。
- **风险等级评定**：支持对不同作业地块设置风险等级（低/中/高），辅助决策。

---

## 🛠️ 技术架构

- **后端核心**：Django 5.2 (Python 3.10+)
- **数据库**：MySQL (多库路由架构)
- **地理信息处理**：Leaflet.js, Turf.js (客户端计算), GDAL/PyShp (服务端处理)
- **前端交互**：Vanilla JS, Bootstrap 5, NiceAdmin UI 框架
- **可视化分析**：ECharts, Chart.js

### 技术实现拆解
- **Web 框架与接口层**：项目基于 Django + Django REST framework，统一承载页面渲染、会话认证与 `/api/*` 业务接口。
- **多业务模块拆分**：按 `system`、`fleet`、`forest`、`agri`、`tasking`、`federation`、`telemetry`、`terrain` 进行应用划分，分别覆盖用户权限、机队、林业、农业、任务、协同、遥测和地形地块管理。
- **多数据库路由**：通过 `uav_platform/db_router.py` 将中央业务库、林业库、农业库、地形库隔离，默认数据库承载系统、机队、任务、协同和遥测模块。
- **GIS 前端计算**：页面中直接引入 Leaflet `1.9.4` 与 Turf.js `6.5.0`，用于包围盒计算、点面判断、布尔运算、重叠检测和面积统计。
- **页面与接口入口**：根路由提供 `/forest/`、`/agri/`、`/terrain/` 等业务页面，并暴露 `/api/system/`、`/api/fleet/`、`/api/forest/`、`/api/agri/`、`/api/tasking/`、`/api/federation/`、`/api/telemetry/`、`/api/terrain/` 等接口。

---

## 🔎 当前开发环境审计（2026-04-28）

### 当前实际运行环境
- **当前激活的 Conda 环境**：`base`
- **Python 解释器**：`E:\anaconda3\python.exe`
- **Python 版本**：`3.12.3`
- **审计结论**：项目文档原先推荐使用独立环境 `uav_platform`，但本次实际检查到的开发终端运行在 `base` 环境。当前环境可以启动项目，但包含大量与本项目无关的通用工具链，长期开发与部署仍建议切换到独立 Conda 环境以避免依赖污染。

### 已核验的项目相关已安装库

| 包名 | 当前安装版本 | `requirements.txt` 约束 | 作用 |
| --- | --- | --- | --- |
| Django | 5.2.13 | `>=5.2,<6.0` | Web 框架核心 |
| djangorestframework | 3.17.1 | `>=3.15,<4.0` | REST API 框架 |
| PyMySQL | 1.1.2 | `>=1.1,<2.0` | MySQL 驱动，兼容 `MySQLdb` 接口 |
| geopandas | 1.1.3 | `>=0.14,<1.0` | 空间数据表处理 |
| pandas | 2.2.2 | `>=2.0,<3.0` | 表格与业务数据处理 |
| shapely | 2.1.2 | `>=2.0,<3.0` | 几何对象与空间运算 |
| Pillow | 10.4.0 | `>=10.0,<11.0` | 图像处理 |
| python-dotenv | 1.2.2 | `>=1.0,<2.0` | 环境变量加载 |
| requests | 2.32.3 | `>=2.31,<3.0` | HTTP 请求 |
| django-cors-headers | 4.9.0 | `>=4.3,<5.0` | 跨域支持 |
| mysqlclient | 2.2.7 | `>=2.2,<3.0` | MySQL C 驱动备选实现 |

### 当前环境中额外存在的常见库
- **开发工具链**：`pytest`、`mypy`、`pylint`、`playwright`
- **数据分析/科学计算**：`numpy`、`scipy`、`matplotlib`、`scikit-learn`
- **地理空间相关**：`pyogrio`、`pyproj`、`Rtree`
- **交互式工具**：`jupyterlab`、`notebook`、`spyder`

> 说明：以上额外库来自当前 `base` 环境，不代表项目运行的最小必需依赖。项目实际应以 `requirements.txt` 中声明的依赖为准。

---

## 📂 核心目录结构说明

```text
uav_platform/
├── terrain/                # [核心] 地形与地块管理模块（编辑器核心逻辑）
├── agri/                   # 农业植保业务逻辑模块
├── forest/                 # 林业巡检业务逻辑模块
├── common/                 # 全局通用工具、拦截器与响应封装
├── config/                 # 静态配置与基础地理元数据
├── data/                   # 原始空间数据源 (GeoJSON/SHP)
├── static/                 # 静态资源中心
│   ├── js/map/             # 核心 GIS 逻辑封装（Leaflet 扩展等）
│   └── pages/              # 页面级交互脚本
├── templates/              # Django HTML 模板中心
└── uav_platform/           # 项目配置中心 (Settings/URLs/Routers)
```

---

## 🚀 部署与操作指南

### 1. 克隆仓库
```bash
git clone git@github.com:MoRanzhi1203/uav_platform.git
cd uav_platform
```

### 2. 创建 Conda 环境
推荐使用 Conda 运行环境：
```bash
conda create -n uav_platform python=3.10
conda activate uav_platform
pip install -r requirements.txt
```

### 3. Trae 环境配置
如果使用 Trae 打开本项目，建议先完成 Python 解释器绑定：

1. 使用 Trae 打开项目根目录 `E:\PythonWeb\uav_platform`。
2. 按 `Ctrl+Shift+P` 打开命令面板。
3. 输入并执行 `Python: Select Interpreter`。
4. 选择 Conda 环境 `uav_platform` 对应的 Python 解释器。
5. 新建终端后执行以下命令，确保终端已进入正确环境：

```bash
conda activate uav_platform
python manage.py check
```

### 4. 数据库准备
1. 确保已安装 MySQL 8.0+，并已将 `mysql`、`mysqldump` 加入系统 `PATH`。
2. 根据 `uav_platform/settings.py` 创建项目所需数据库：
   - `central_db`
   - `forest_db`
   - `agri_db`
   - `terrain_db`
3. 按实际环境修改 `uav_platform/settings.py` 中的数据库连接信息。

### 5. 初始化项目
首次部署可执行：

```bash
conda activate uav_platform
python manage.py makemigrations
python manage.py migrate
python init_admin.py
```

如果只是拉取已有数据库并恢复数据，可跳过 `migrate`，直接参考后文的数据导入步骤。

### 6. 启动 Django 服务
在 Trae 或本地终端中进入项目后，使用以下命令启动开发服务：

```bash
conda activate uav_platform
python manage.py runserver
```

默认访问地址：

- 地形管理首页：`http://127.0.0.1:8000/terrain/`
- 地形编辑器：`http://127.0.0.1:8000/terrain/editor/`

### 7. 数据导入与导出

#### 7.1 导出当前 Django 项目关联的 MySQL 数据库
项目已提供导出脚本 `scripts/export_mysql_dumps.py`。默认只导出 Django 当前配置中关联的 MySQL 数据库，不会导出整台 MySQL 的所有业务库。

基础导出命令：

```bash
conda activate uav_platform
python scripts/export_mysql_dumps.py
```

导出后自动提交并推送：

```bash
conda activate uav_platform
python scripts/export_mysql_dumps.py --git-commit --git-push --branch main
```

说明：

- 导出目录默认为项目根目录下的 `db_dumps/`
- 默认导出 `central_db`、`forest_db`、`agri_db`、`terrain_db`
- 如数据库密码未写在配置中，可通过 `--password` 或环境变量 `MYSQL_PASSWORD` 传入

#### 7.2 从 `db_dumps/` 恢复数据库
如果仓库中已有 SQL 导出文件，可按数据库分别导入。

先确保目标数据库已创建，例如：

```sql
CREATE DATABASE central_db DEFAULT CHARACTER SET utf8mb4;
CREATE DATABASE forest_db DEFAULT CHARACTER SET utf8mb4;
CREATE DATABASE agri_db DEFAULT CHARACTER SET utf8mb4;
CREATE DATABASE terrain_db DEFAULT CHARACTER SET utf8mb4;
```

在 PowerShell 中可使用以下命令恢复：

```powershell
cmd /c "mysql -u root -p123456 central_db < db_dumps\central_db.sql"
cmd /c "mysql -u root -p123456 forest_db < db_dumps\forest_db.sql"
cmd /c "mysql -u root -p123456 agri_db < db_dumps\agri_db.sql"
cmd /c "mysql -u root -p123456 terrain_db < db_dumps\terrain_db.sql"
```

如果你的用户名、密码、主机或端口不同，请按实际环境替换。

#### 7.3 地形业务数据批量导入
系统支持通过接口导入地形区域和地块数据，适合导入 JSON、GeoJSON、CSV。

模板下载接口：

- `GET /terrain/api/areas/import-template/`

批量导入接口：

- `POST /terrain/api/areas/import/`
- 表单字段：`file`
- 支持格式：`.json`、`.geojson`、`.csv`

推荐流程：

1. 先访问模板接口下载示例结构。
2. 按模板组织地形、边界、地块数据。
3. 通过前端页面或接口工具上传文件完成导入。

### 8. 常用启动命令速查
日常开发最常用的是下面两条：

```bash
conda activate uav_platform
python manage.py runserver
```

---

## 📄 开源协议
本项目遵循 [MIT License](LICENSE) 协议。

## 👤 维护者

- 项目维护：墨染止
- 仓库地址：[MoRanzhi1203/uav_platform](https://github.com/MoRanzhi1203/uav_platform)

---
<div align="right">
  <i>本项目由 Trae 智能辅助开发构建。</i>
</div>
# redesigned-guacamole
