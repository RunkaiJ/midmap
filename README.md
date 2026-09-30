# MID Map

用于批量修正 Excel 制造商 MID、维护映射关系、查询和导出修改记录的工具。

- [代码库大纲与运行说明](docs/CODEBASE.md)
- [代码检查报告与修复优先级](docs/REVIEW.md)
- [本次规则更新、修复状态及上线事项](docs/FIXES.md)

技术栈：React 19 + Vite 7 / Express 5 / PostgreSQL。前后端分别安装依赖、分别启动。

已加入两列 description 清理规则，并修复 Excel 行号、MID 大小写、事务和映射冲突等问题。数据库凭据轮换及部署访问控制仍需在部署环境落实，详见修复记录。
