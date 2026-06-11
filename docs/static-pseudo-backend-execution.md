# 静态伪后端执行文档

## 1. 生成静态快照

在本地执行：

```bash
python scripts/export_static_snapshot.py
```

脚本读取：

```text
../hotpot_qa/fullwiki/train-00000-of-00002.parquet
```

如果 parquet 文件放在其他位置，使用 `--input` 显式指定：

```bash
python scripts/export_static_snapshot.py --input /path/to/hotpot_qa/fullwiki/train-00000-of-00002.parquet --sample-size 600
```

输出：

```text
frontend/static-api/
```

## 2. 前端接入

新增：

```text
frontend/pseudoBackend.js
```

修改：

```text
frontend/index.html
frontend/app.js
frontend/config.js
```

接入原则：

- `fetchJson("/api/...")` 是唯一数据入口。
- `state.apiBase` 为空时调用 pseudoBackend。
- `state.apiBase` 非空时请求真实 Flask。

## 3. 静态模式验证

```bash
cd frontend
python -m http.server 8133 --bind 127.0.0.1
```

浏览器打开：

```text
http://127.0.0.1:8133/
```

验证：

- 顶部状态显示静态快照。
- 搜索 `nationality` 有结果。
- 点击问题后显示多跳路径。
- 点击聚类后左侧结果列表更新。
- 统计图正常。

## 4. 真实后端模式验证

在华为云主机运行：

```bash
cd ~/hotpot_qa_web/backend
source hotpot_venv/bin/activate
export ARANGO_HOST="http://127.0.0.1:8529"
export ARANGO_DB="hotpotqa_arango"
export ARANGO_USER="root"
export ARANGO_PASSWORD="<password>"
export CORS_ORIGINS="https://zoeenj.github.io"
gunicorn -w 2 -b 0.0.0.0:5000 app:app
```

本机验证：

```bash
curl http://127.0.0.1:5000/api/health
curl "http://127.0.0.1:5000/api/search?q=nationality"
```

## 5. 代码检查

```bash
node --check frontend/app.js
node --check frontend/pseudoBackend.js
python -m py_compile backend/app.py backend/wsgi.py scripts/export_static_snapshot.py
```
