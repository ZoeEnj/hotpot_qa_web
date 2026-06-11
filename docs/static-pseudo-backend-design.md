# HotpotQA 静态伪后端设计方案

## 背景

华为云主机位于内网环境，真实 ArangoDB 与 Flask API 只能在云主机内部访问。GitHub Pages 是公网 HTTPS 静态站点，访问者浏览器不能直接访问内网 Flask 服务。因此公开网页采用静态 JSON 快照与 pseudoBackend 适配层，模拟 Flask API 的返回契约，保证页面可公开演示。

真实链路仍然保留：

```text
华为云主机 -> Flask backend -> ArangoDB hotpotqa_arango
```

公开演示链路为：

```text
GitHub Pages -> frontend/dataService.js -> frontend/data/*.json
```

## 设计目标

- 公开页面无需公网后端即可完成搜索、多跳路径、聚类、统计和图谱可视化。
- 静态返回结构与 Flask API 保持一致，未来有 HTTPS 后端时可无缝切换。
- 页面明确显示当前模式，避免把静态快照描述成实时数据库。
- 静态数据从 HotpotQA parquet 抽样导出，字段来源真实。
- 保留真实 Flask 后端用于华为云内网验证 ArangoDB 管理和查询。

## 数据源模式

### 静态快照模式

API Base 为空时，前端使用 `pseudoBackend.fetchJson(path, options)`。

静态文件位于：

```text
frontend/data/
  manifest.json
  health.json
  stats.json
  clusters.json
  search-index.json
  paths.json
  cluster-questions.json
```

### 真实后端模式

API Base 填写 HTTPS 后端地址时，前端请求真实 Flask API：

```text
https://<api-domain>/api/health
https://<api-domain>/api/search
https://<api-domain>/api/question/<qid>/path
```

## API 契约

`GET /api/health` 返回数据库/快照状态与集合计数。

`GET /api/search?q=&type=&level=&split=&limit=` 返回问题列表，字段与 Flask 一致：

```json
{
  "key": "fullwiki__validation__5a8b57f25542995d1e6f1371",
  "orig_id": "5a8b57f25542995d1e6f1371",
  "split": "validation",
  "question": "Were Scott Derrickson and Ed Wood of the same nationality?",
  "answer": "yes",
  "type": "comparison",
  "level": "hard",
  "n_context_pages": 10,
  "n_supporting_facts": 2
}
```

`GET /api/question/<qid>/path` 返回当前问题的图节点、边、支持事实、上下文页面和聚类信息。

`GET /api/clusters` 返回聚类列表。若没有真实 KMeans 导出，使用 `type_level_fallback_snapshot`。

`GET /api/cluster/<cluster_key>/questions?limit=` 返回该聚类的代表问题。

`GET /api/stats` 返回按题型、难度的统计。

## 真实性边界

可以表述为：

> GitHub Pages 版本采用静态 JSON 快照和 pseudoBackend 适配层，模拟 Flask API 的返回契约，用于公开展示搜索、证据路径、聚类和统计界面。真实的 ArangoDB 查询、AQL 执行和全量数据访问仍由华为云内网 Flask 后端完成；Pages 版本只覆盖预导出的样例与统计快照。

不能表述为：

- GitHub Pages 直接连接 ArangoDB。
- 浏览器执行 AQL。
- 前端实现完整 ArangoDB。
- 静态演示支持全量实时检索。
