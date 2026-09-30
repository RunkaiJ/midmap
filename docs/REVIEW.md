# 代码检查报告

> 本文保留首次扫描时的发现和当时验证结果。后续已实施的修复及尚未处理的部署风险见 [FIXES.md](FIXES.md)，下文行号对应修复前源码。

检查日期：2026-09-30。范围为前后端自有源码、SQL、配置、Git 跟踪状态及本地依赖实现。未连接实际数据库、未修改业务代码、未调用线上 API。P1 为优先修复，P2 为随后修复；已复现和静态判断分别标注。

## 凭据与 Git 管理：优先处理

`backend/.env` 已被 Git 跟踪，且 DATABASE_URL 含密码。只检查了字段名及是否含密码的布尔值，本文不记录连接串。前端环境文件也被跟踪，但 API 地址本身不一定是秘密，应分别判断。

根 .gitignore 已包含 .env 和 node_modules，但不能移除既有跟踪。backend/node_modules 中有 **3,476 个已跟踪文件**。

建议核实凭据是否仍有效并轮换，改为本地配置和无秘密示例；清理已跟踪环境文件及依赖目录，保留 lockfile，必要时协调清理历史。本次未轮换凭据或改写 Git 历史。

## P1-1：Excel 空行导致写错行（已复现）

位置：`frontend/src/pages/FixMids.jsx:297,374,421,436,456,480,519,549`。

sheet_to_json 默认跳过空行，而写回使用数组下标 i+2。构造表头、第 2 行数据、第 3 行空白、第 4 行数据：第二条数据实际在第 4 行，代码会写入第 3 行。MID、House AWB、FDA、HTS 和 Boohoo patch 均有同类问题。

影响：输出错行，原行可能仍保留错误值。建议保存 __rowNum__ 或显式原始行号，所有写回路径统一使用；覆盖连续空行及非 A1 起始工作表。

## P1-2：事务未绑定同一连接（源码确认）

位置：`backend/src/server.js:13`、`db.js`；`routes/mids.js:204,264,299`、`log.js:107`、`resolve.js:152`。

req.app.get("pg") 是 Pool。BEGIN、写入、COMMIT/ROLLBACK 分别通过 pool.query 执行。本地 pg-pool/index.js:411 显示每次 query 都独立获取并释放连接；并发下不保证同一连接，还可能让其他请求使用未结束的事务。

影响：部分成功、回滚失效或请求干扰。建议 pool.connect 获取 client，事务所有查询使用该 client，finally release。需在隔离 PostgreSQL 验证并发和失败回滚；本次未做真实库复现。

## P1-3：初始化 schema 缺少报表字段（静态核对确认）

位置：`backend/src/routes/reports.js:130,235`；`backend/sql/001_init.sql` canonical 建表定义。

JSON 和 Excel 查询读取 address/city/zipcode，但现有两个 SQL 均未创建这些列。按仓库脚本初始化的新库无法执行报表查询。线上是否手工补列未知。

建议补充版本化迁移及空库验证，同时明确地址数据维护入口；当前 Add Mids 也不写这些字段。

## P1-4：映射冲突被忽略，页面却显示已保存（源码确认）

位置：`backend/src/routes/mids.js:81,96,113,130,227`；`frontend/src/pages/AddMids.jsx:277`。

已有 BAD→GOOD_A，再提交 BAD→GOOD_B：日志按 bad_mid/good_mid 可以新增，但 mid_aliases 按 bad_mid 主键冲突后 DO NOTHING，仍指向 GOOD_A。响应 inserted 统计日志行，前端却显示保存的映射数。名称映射同样受影响。

建议明确拒绝冲突还是允许更新，并返回实际新增/更新/重复/冲突数量；日志记录实际变更。验证同批冲突和已有映射冲突。

## P1-5：小写 MID 匹配结果被丢弃（已复现）

位置：`frontend/src/pages/FixMids.jsx:336-370`；`backend/src/routes/resolve.js` 的 up 与结果生成逻辑。

后端返回大写 bad_mid，前端 uniqKey 只 trim。原行 bad1 对应返回 BAD1，Map 查找失败。用源码提取的 key 函数验证结果为 MISS。

建议请求、结果、原行查找共享规范化规则，或返回稳定请求标识；原始值单独用于审计。

## P1-6：应用层无认证或授权（源码确认，部署暴露程度未知）

位置：`backend/src/server.js:10-22` 及写入路由。

全部 API 直接挂载，没有身份与权限中间件；姓名/分站由请求体提供。可访问后端的人能自行填写身份，写映射及导出记录。默认 cors() 也未限制来源。是否有部署网关认证未知，不能据此断言线上公开暴露。

建议核实部署入口，在服务端校验读写权限，审计身份取自认证结果。CORS 不能替代访问控制。

## P2-1：不同客户的日志被误去重（已复现）

位置：`backend/src/routes/log.js:73-99`。

去重早于客户名解析，key 的 `r.importer_id ? null : r.client_name || ""` 无法区分客户。两行其他字段相同、ImporterID 为 I1/I2 时，第二行被丢弃。调用真实 route handler 并注入 DB 替身：客户查询仅收到 I1，响应 inserted=1、skipped=0。

建议先解析客户，按数据库索引一致的字段去重，并确定未知客户是否用 importer_id 区分；明确返回过滤/重复数量。

## P2-2：审计写入失败仍显示成功（源码确认）

位置：`frontend/src/pages/FixMids.jsx:247-257,560,605`。

logChanges 不检查 response.ok，也吞掉网络异常。500、413 或断网后仍下载 ZIP 并显示 Done，用户不知报表缺失记录。该函数被 await 且没有超时，也不是注释所说的完全 non-blocking。

建议分别反馈文件生成和日志保存状态，保存失败时提供重试。

## P2-3：报表导出异常路径泄漏连接（源码确认）

位置：`backend/src/routes/reports.js:307-337`。

仅正常读完游标后 release；cursor.read 报错直接进入 catch，没有 finally 清理。wb.commit 未 await，异步错误无法由当前 catch 捕获；响应开始后的失败也没有终止响应。

建议 finally 清理游标/连接，处理客户端断开，await 提交；注入读取失败并验证池连接归还。

## P2-4：canonical 批量去重不可靠（静态风险）

位置：`backend/src/routes/mids.js:51`。

SELECT DISTINCT x.good_mid, clock_timestamp() 把变化时间纳入去重。多个别名指向同一个尚不存在 MID 时不保证只生成一条 canonical，可能违反唯一约束；并发创建同一 MID 也没有 ON CONFLICT 兜底。

建议先只按 good_mid 去重，再设置时间，并明确冲突处理。需隔离 PostgreSQL 验证，未标为运行时复现。

## 其他问题

- log.js 每行 12 个 SQL 参数、不分批，大量记录存在参数上限风险；BODY_LIMIT 不能替代行数上限。
- 报表 limit/offset 未排除 NaN/小数；日期、mode、行对象等缺少统一验证，错误可能成为 500。
- 三个页面 API 地址规范化不一致；Fix Mids/Reports 缺配置时可能请求带 undefined 的相对路径。
- Fix Mids 表头识别时 trim，但 sheet_to_json 对象仍按原表头建 key，两端空格可能导致字段读取失败。
- healthz 不验证数据库；接口可能直接返回数据库错误文本；缺少统一错误格式和请求追踪。
- 可选 autofill 失败仍返回查询成功；日志重新查询名称相同的行，不保证仅记录本次更新。当前前端未启用。
- 无项目自有测试、后端 lint 或 CI；Excel 规则及数据库演进缺少回归保护。

## 验证范围

已执行：全部 7 个后端 JS 的 node --check，未报告语法错误；SheetJS 空行样本；源码 key 函数小写 MID 样本；真实日志 handler + DB 替身的跨客户样本；schema 字段核对；Git 跟踪和环境元信息核对。

前端检查结果：

| 检查 | 结果 |
| --- | --- |
| npm ci --ignore-scripts --no-audit --no-fund | 沙箱内缓存写入失败，授权重试后成功安装 179 个包；出现非当前平台 esbuild 目录 EBUSY 清理警告，未阻断后续构建 |
| npm run lint | 失败：3 个错误、1 个警告 |
| npm run build | 沙箱内目录读取被阻断，授权重试后通过；54 个模块，主 JS 781.78 kB，gzip 254.06 kB |
| git diff --check | 通过；仅提示 Git 后续可能将 README 的 LF 转为 CRLF |

lint 明细：FixMids.jsx:111 的 htsMap 未使用；125 行 catch 参数未使用、catch 块为空；AddMids.jsx:7 的 eslint-disable 多余。构建提示单个 chunk 超过 500 kB，可通过路由懒加载及按需加载 Excel/ZIP 依赖改善初始加载。本次没有自动修复业务源文件。

未执行：真实 SQL 初始化、并发事务/回滚、真实报表导出、完整业务样本端到端处理、联网依赖漏洞审计。本报告不宣称依赖安全，不列未经验证的 CVE。构建通过仅表明前端能打包，不代表数据库和业务流程正确。

## 修复顺序

1. 核实有效凭据及部署访问控制。
2. 修复 Excel 行号、小写 MID、数据库事务。
3. 补 schema，明确映射冲突策略和实际保存计数。
4. 修复日志去重/失败反馈、导出连接释放、批量边界。
5. 用隔离数据库及小型 Excel 样本建立回归检查，再整理模块和 Git 跟踪项。
