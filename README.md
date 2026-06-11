# HotpotQA Evidence Workbench

这是一个基于 HotpotQA、ArangoDB 和 Flask API 的多跳问答证据检索与可视化网页项目。前端页面托管在 GitHub Pages，后端服务部署在华为云主机，用于连接 ArangoDB 并提供数据查询接口。

## 项目结构

- `backend/`：Flask 后端服务，负责连接 ArangoDB 并提供查询接口。
- `frontend/`：GitHub Pages 托管的前端页面，包含搜索、多跳路径展示、聚类浏览、统计分布和 SVG 可视化。
- `.github/workflows/pages.yml`：GitHub Pages 自动部署工作流。

## 启动顺序

完整运行时建议先启动后端，再打开或发布前端页面。后端负责提供 HotpotQA 数据查询能力，前端负责展示检索结果和可视化图谱。

## 后端启动

在华为云主机上进入后端目录：

```bash
cd ~/hotpot_qa_web/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

配置 ArangoDB 连接参数：

```bash
export ARANGO_HOST="http://127.0.0.1:8529"
export ARANGO_DB="hotpotqa_arango"
export ARANGO_USER="web_hotpot"
export ARANGO_PASSWORD="your-readonly-password"
export CORS_ORIGINS="https://zoeenj.github.io"
```

开发方式启动：

```bash
python app.py
```

生产方式启动：

```bash
gunicorn -w 2 -b 0.0.0.0:5000 app:app
```

后端健康检查：

```bash
curl http://127.0.0.1:5000/api/health
```

## 前端本地预览

后端启动后，可以在本地预览前端页面：

```bash
cd hotpot_qa_web/frontend
python3 -m http.server 8133
```

浏览器访问：

```text
http://127.0.0.1:8133/
```

## GitHub Pages 托管

本仓库已经配置 GitHub Actions。推送到 `main` 分支后，工作流会自动将 `frontend/` 目录发布到 GitHub Pages。

访问地址：

```text
https://zoeenj.github.io/hotpot_qa_web/
```

## 注意事项

- 不要将虚拟环境、缓存、日志、压缩包、实验报告或设计稿提交到仓库。
- 前端托管目录为 `frontend/`，GitHub Pages 工作流只上传该目录。
- 后端连接的是 Flask API，不是直接让前端连接 ArangoDB 的 `8529` 端口。
