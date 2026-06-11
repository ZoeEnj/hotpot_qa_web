# HotpotQA Evidence Workbench

这是 HotpotQA + ArangoDB 多跳证据查询与可视化网页项目。项目支持两种运行方式：

- `frontend/`：托管到 GitHub Pages 的静态前端。默认使用 `frontend/static-api/` 中的静态 JSON 快照和 `pseudoBackend.js`，可直接公开演示搜索、多跳证据路径、聚类浏览、统计分布和 SVG 图可视化。
- `backend/`：部署在华为云主机内网的 Flask API。它连接 ArangoDB，提供真实数据库查询接口。只有后端具备公网 HTTPS 域名并配置 CORS 后，GitHub Pages 前端才需要填写 API Base。

## 在线访问

GitHub Pages 地址：

```text
https://zoeenj.github.io/hotpot_qa_web/
```

页面右上角 `API Base` 留空时，前端会自动使用静态快照模式。若要连接真实后端，填写类似下面的 HTTPS 地址：

```text
https://<your-api-domain>
```

不要填写 ArangoDB 的 `8529` 地址。前端连接的是 Flask API，不是直接连接 ArangoDB。

## 前端本地预览

```bash
cd hotpot_qa_web/frontend
python3 -m http.server 8133
```

然后访问：

```text
http://127.0.0.1:8133/
```

## 后端快速启动

```bash
cd ~/hotpot_qa_web/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export ARANGO_HOST="http://127.0.0.1:8529"
export ARANGO_DB="hotpotqa_arango"
export ARANGO_USER="web_hotpot"
export ARANGO_PASSWORD="your-readonly-password"
export CORS_ORIGINS="https://zoeenj.github.io"

python app.py
```

生产环境可使用：

```bash
gunicorn -w 2 -b 0.0.0.0:5000 app:app
```

如果后端只在华为云主机内网可访问，GitHub Pages 页面应保持 API Base 为空，使用静态快照演示。

## 静态快照更新

静态快照由真实 HotpotQA parquet 数据导出，生成文件位于 `frontend/static-api/`：

```bash
cd hotpot_qa_web
python scripts/export_static_snapshot.py --sample-size 600
```

快照用于公开演示，不替代 ArangoDB 全量查询。实验报告中应说明：真实数据管理和 AQL 查询在华为云主机的 ArangoDB + Flask 后端完成；GitHub Pages 版本使用预导出的样例快照模拟相同 API 返回结构。

## GitHub Pages 部署

仓库包含 `.github/workflows/pages.yml`。推送到 `main` 后，工作流会把 `frontend/` 作为 Pages 产物上传并发布。
