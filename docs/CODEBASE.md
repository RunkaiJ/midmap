# 代码库大纲与运行说明

检查日期：2026-09-30。本文描述仓库当前实现，不代表线上环境已验证。

最近更新：description 两列清理及高风险修复已实施，详见 [FIXES.md](FIXES.md)。

## 功能大纲

| 页面 | 路径 | 职责 |
| --- | --- | --- |
| Fix Mids | `/fix-mids` | 读取 Excel 第一张表，修正 MID 和其他字段，提交日志，下载 Excel + CSV 的 ZIP |
| Add Mids | `/add-mids` | 粘贴三列映射、MID 别名或名称映射，预览后批量保存 |
| Reports | `/reports` | 按客户、分站、日期和字段筛选日志，分页展示并导出 Excel |

根路径跳转到 `/fix-mids`。文件处理支持 SHEIN、Boohoo Pure、Boohoo Hybrid。

## 目录地图

```text
frontend/
  src/main.jsx                  React 入口、BrowserRouter
  src/App.jsx                   页面路由
  src/components/               导航和状态组件
  src/pages/FixMids.jsx          Excel 解析、修改、ZIP 导出、日志提交
  src/pages/AddMids.jsx          文本解析、预览、映射提交
  src/pages/Reports.jsx          筛选、分页、报表下载
  src/lib/worksheet.js           description 清理、原始行定位、MID key
  test/worksheet.test.js         Excel 回归测试
  src/data/code_corrections.json FDA 产品代码替换表
  src/reports.css               报表样式
  index.html                    HTML 入口、Bootstrap CDN
  vite.config.js                React 插件；没有 API 开发代理
  vercel.json                   SPA 路由回退
backend/
  src/server.js                 Express 入口、中间件、路由注册
  src/db.js                     pg 连接池
  src/transaction.js             独占连接事务
  src/mappings.js                映射写入、冲突拒绝和审计
  test/                         后端回归测试
  src/routes/resolve.js          MID 查询、可选名称补齐
  src/routes/mids.js             全局映射批量写入
  src/routes/log.js              分站元数据、业务日志
  src/routes/reports.js          报表 SQL、游标式 Excel 导出
  src/routes/boohoo.js           Boohoo 修正补丁
  data/boohoo_hts_map.json        HTS 替换表
  sql/001_init.sql               schema、索引和历史业务数据快照
  sql/002_change_log_global.sql  全局日志空值及去重索引调整
  sql/003_manufacturer_address.sql 地址字段迁移
```

前端使用 React 19、Vite 7、React Router 7、SheetJS、JSZip、file-saver；后端使用 Express 5、pg、ExcelJS、pg-cursor。版本系列来自 package.json，实际安装以 lockfile 为准。前端为 ESM，后端为 CommonJS。

## 数据流

```mermaid
flowchart LR
  X[Excel] --> F[Fix Mids 浏览器处理]
  F --> R[resolve API]
  R --> DB[(PostgreSQL)]
  F --> B[Boohoo 补丁 API]
  F --> L[log API]
  L --> DB
  F --> Z[Excel + CSV ZIP]
  A[Add Mids] --> M[mids API]
  M --> DB
  P[Reports] --> Q[reports API]
  Q --> DB
  Q --> E[JSON / Excel]
```

### Fix Mids

1. 浏览器读取第一张工作表，识别 MID、制造商名、运单、日期等列。
2. 对 MID/名称组合去重，请求 resolve。后端优先按错误 MID 别名查找，再按制造商名称精确匹配；MID 转大写，名称只去两端空白。
3. 写回 MID。SHEIN 将 House AWB 统一成用户确认值；Boohoo 仅补空白 House AWB。
4. 清理 DescOfMerchandish 和 Description：删除特殊符号、合并空白、截取前 75 个字符。替换并规范 FDA 产品代码。Boohoo 额外处理邮编和 HTS；Hybrid 还处理航空公司代码、GroupIdentifier、航班号拆分。
5. 提交 MID 修改日志，生成修正工作簿和汇总 CSV，打包 ZIP。

原工作簿在浏览器读取，但 MID/名称会发给后端；Boohoo 模式还发送解析后的整行对象。CSV 仅汇总 MID 修改，不覆盖 House AWB、FDA、HTS 等所有字段。当前前端未启用 resolver 的 `autofill`。

### Add Mids

输入格式为 `bad_mid,manufacturer_name,good_mid`、`bad_mid,good_mid` 或 `manufacturer_name,good_mid`，支持逗号或 TAB。名称解析允许中间出现逗号，但不是完整 CSV 解析器。保存时提交分站和姓名；这些字段目前不是经过认证的身份。后端在同一事务中写 canonical 和映射，验证冲突后记录实际新增映射；冲突返回 409 并回滚整批。

### Reports

基于 change_log，排除 global_alias/global_name，关联分站和当前 canonical/alias。当前别名与历史日志目标不同时会优先使用当前别名，所以不是不可变的历史快照。JSON 包含日期、客户、分站；Excel 列为 MAWB、Wrong MID、Correct MID、Name、Address、City、Zipcode、Notes。

## 数据模型

| 表 | 关键字段与用途 |
| --- | --- |
| `canonical_manufacturers` | id 主键、good_mid 唯一、manufacturer_name、创建时间 |
| `mid_aliases` | bad_mid 主键，外键指向 canonical；每个错误 MID 一个目标 |
| `name_mappings` | manufacturer_name 主键，外键指向 canonical；名称精确匹配 |
| `change_log` | 动作、操作人、分站、运单、客户、日期、修改前后 MID |
| `clients` | importer_id 主键、客户名称 |
| `branches` | 分站名、口岸代码 |

日志动作：auto_alias、auto_name、global_alias、global_name。另有 v_branches 和 v_mid_change_report 视图，主要 API 直接查询基础表。

003 迁移补充 canonical 的 address/city/zipcode；报表也兼容尚未增加这些列的旧库，返回空地址字段。

## API 一览

| 方法 | 路径 | 输入/输出 |
| --- | --- | --- |
| GET | `/healthz` | 返回 ok，仅检查 HTTP 进程 |
| POST | `/api/resolve/mids` | `{items:[{bad_mid,manufacturer_name}],autofill?,actor_branch?,changed_by?}` → `{ok,results}` |
| GET | `/api/log/meta` | `{branches:[{station,port_code,label}]}` |
| POST | `/api/log/changes` | `{branch,person,rows}` → `{ok,inserted,skipped?}` |
| POST | `/api/mids/triplets/bulk` | `{actor_branch,changed_by,rows:[{bad_mid,manufacturer_name,good_mid}]}` |
| POST | `/api/mids/aliases/bulk` | `{actor_branch,changed_by,rows:[{bad_mid,good_mid}]}` |
| POST | `/api/mids/names/bulk` | `{actor_branch,changed_by,rows:[{manufacturer_name,good_mid}]}` |
| GET | `/api/reports/meta` | `{clients,branches}` |
| GET | `/api/reports/table` | 筛选参数 → `{total,limit,offset,rows}` |
| GET | `/api/reports/table.xlsx` | 相同业务筛选，导出全部匹配行，不受分页限制 |
| GET | `/api/boohoo/hts-map` | `{ok,map}` |
| POST | `/api/boohoo/transform` | `{mode,airline3d?,rows}` → `{ok,patches:[{row,col,value}]}`；不写数据库 |

报表参数：branch、client、from、to、mawb、wrong_mid、correct_mid、name、address、city、zipcode；JSON 另支持 limit（默认 100，上限 500）、offset。日期预期为 YYYY-MM-DD。错误响应目前混有 JSON 与文本。

## 本地运行

检查环境为 Node 22.20.0，仓库未固定 Node 版本。SQL 快照由 PostgreSQL 17.6 导出，含 transaction_timeout 设置，建议先在 PostgreSQL 17 隔离库验证；第二个脚本使用 PostgreSQL 15+ 的 NULLS NOT DISTINCT。

001 SQL 含历史业务数据及序列恢复，不是幂等迁移，不应直接导入已有业务库。新库顺序为 001 → 002 → 003；已有库仅执行尚未应用的迁移。脚本尚未在本次检查中连接真实 PostgreSQL 执行。

后端 `.env` 占位示例：

```dotenv
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/midmap
BODY_LIMIT=8mb
```

前端 `.env.local` 示例：

```dotenv
VITE_API_BASE=http://localhost:4000/api
```

API 地址应含 `/api`，避免尾部 `/`。VITE 配置在构建时进入浏览器代码，不应包含秘密。

两个终端分别运行：

```powershell
cd backend
npm ci
npm run dev
```

```powershell
cd frontend
npm ci
npm run dev
```

后端生产命令 `npm start`；前端 `npm run build` 输出 frontend/dist。Vercel 配置仅负责 SPA 路由，不部署后端或代理 API。根目录无统一启动命令。

前后端各运行 `npm test`；前端另有 `npm run lint` 和 `npm run build`，后端可用 node --check 检查语法。已有 Excel 及后端行为回归测试，尚无后端 lint 或 CI 工作流。

## 维护建议

将 Excel 行定位/写回提取为可测模块，统一 API 地址和请求错误处理；后端统一事务、冲突策略和审计写入。规则 JSON 应记录来源、版本和生效日期。本次仅检查规则代码实现，未验证 HTS/FDA 规则本身的业务正确性。
