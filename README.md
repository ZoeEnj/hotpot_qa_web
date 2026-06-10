# HotpotQA Evidence Workbench

This repository contains the web part of the HotpotQA ArangoDB coursework.

- `backend/`: Flask API on the Huawei Cloud host. It queries ArangoDB and returns JSON.
- `frontend/`: static GitHub Pages frontend. It supports search, multi-hop evidence paths, simple cluster browsing, statistics, and SVG graph visualization.
- `design/`: generated design mockup and implementation screenshots used in the report.

## Backend Quick Start

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

Production:

```bash
gunicorn -w 2 -b 0.0.0.0:5000 app:app
```

## Frontend Quick Start

Edit `frontend/config.js` and set an HTTPS API endpoint:

```js
window.HOTPOT_API_BASE = "https://<your-api-domain>";
```

GitHub Pages is HTTPS. If the backend is only `http://<public-ip>:5000`, browsers will block the request as mixed content. Use Nginx plus a TLS certificate to proxy the Flask service before final deployment.

Publish `frontend/` through GitHub Pages. This repository includes `.github/workflows/pages.yml`, which uploads the `frontend` directory as the Pages artifact.

Expected Pages URL:

```text
https://zoeenj.github.io/hotpot_qa_web/
```
