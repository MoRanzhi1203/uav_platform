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

## 🚀 部署指南

### 1. 克隆仓库
```bash
git clone git@github.com:MoRanzhi1203/uav_platform.git
cd uav_platform
```

### 2. 环境配置
推荐使用 Conda 运行环境：
```bash
conda create -n uav_platform python=3.10
conda activate uav_platform
pip install -r requirements.txt
```

### 3. 数据库准备
1. 确保已安装 MySQL 8.0+。
2. 创建项目所需的数据库（agri_db, forest_db, terrain_db）。
3. 在 `uav_platform/settings.py` 中配置数据库连接信息。

### 4. 初始化项目
```bash
python manage.py makemigrations
python manage.py migrate
python init_admin.py  # 创建初始管理员账号 (可选)
```

### 5. 运行服务
```bash
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
