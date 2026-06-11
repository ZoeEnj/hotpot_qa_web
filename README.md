# HotpotQA

- `backend/`：部署在华为云主机上的 Flask API。它负责查询 ArangoDB 并返回 JSON 数据。
- `frontend/`：托管在 GitHub Pages 上的静态前端。它支持搜索、多跳证据路径、简单聚类浏览、统计信息展示和 SVG 图谱可视化。

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

生产环境运行方式：

```bash
gunicorn -w 2 -b 0.0.0.0:5000 app:app
```

## 前端快速启动

编辑 `frontend/config.js`，并设置 HTTPS API 接口地址：

```js
window.HOTPOT_API_BASE = "https://<your-api-domain>";
```

通过 GitHub Pages 发布 `frontend/` 目录。本仓库包含 `.github/workflows/pages.yml`，该工作流会将 `frontend` 目录作为 Pages 构建产物上传。

访问地址：

```text
https://zoeenj.github.io/hotpot_qa_web/
```
