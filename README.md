# HotpotQA ArangoDB Web

This repository contains the web part of the HotpotQA ArangoDB coursework.

- `backend/`: Flask API on the Huawei Cloud host. It queries ArangoDB and returns JSON.
- `frontend/`: static GitHub Pages frontend. It supports search, multi-hop evidence paths, simple cluster browsing, and graph visualization.

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

python app.py
```

Production:

```bash
gunicorn -w 2 -b 0.0.0.0:5000 app:app
```

## Frontend Quick Start

Edit `frontend/config.js` and set:

```js
window.HOTPOT_API_BASE = "http://<your-huawei-cloud-public-ip>:5000";
```

Then publish `frontend/` through GitHub Pages.

Expected Pages URL:

```text
https://zoeenj.github.io/hotpot_qa_web/
```
