# 静态伪后端约束文档

## 数据约束

- 静态快照必须来自 HotpotQA parquet 或真实 Flask API 导出，不能手写伪造业务字段。
- 静态快照规模控制在 GitHub Pages 可稳定加载范围内。
- `search-index.json` 只保存搜索列表必要字段。
- `paths.json` 保存问题详情图谱，必须保证每条边的 `source` 和 `target` 都存在于 `nodes`。
- `kind` 只能使用 `question`、`answer`、`page`、`sentence`。
- 未知 `qid` 返回空路径结构，而不是抛出未处理异常。

## 前端约束

- UI 层不得散落数据源判断，统一由 `fetchJson()` 路由到真实 API 或 pseudoBackend。
- API Base 为空表示静态快照模式，不是错误。
- API Base 非空时优先请求真实 Flask 后端；请求失败才提示错误，不 silently 假装真实数据成功。
- 页面必须显示当前模式：`静态快照` 或 `后端连接正常`。
- 保存 API Base 时必须清理旧请求，避免旧静态结果覆盖新后端结果。

## 后端约束

- Flask 后端继续保留，作为 ArangoDB 内网验证链路。
- 后端不得读取前端静态 JSON 充当数据库。
- 后端 `/api/*` 返回字段应与 pseudoBackend 保持一致。
- ArangoDB 密码、GitHub token、华为云密码不得提交到仓库。

## 验收约束

- 公开演示验证 GitHub Pages 静态模式。
- 内网验证证明 Flask 实际连接 ArangoDB。
- 报告中必须说明静态快照是公开展示层，不是替代数据库管理。
- 准备证据矩阵：课程要求、实现位置、验证方式。

