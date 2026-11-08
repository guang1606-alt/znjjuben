# 剧本大师（终南集）仓库约定

本仓库是独立 Git 仓库：`/Users/a123/Desktop/养正/zhongnan`。
父目录 `/Users/a123/Desktop/养正` 是另一个产品（养正），**禁止在本仓库任务中写入父仓库任何文件**。

## 每次任务开场自检（一条命令）

```bash
cd /Users/a123/Desktop/养正/zhongnan/zhongnan-backend && npm run doctor
```

`doctor` 只读输出：仓库归属、分支/最近标签、版本四处是否一致、改动分布、守卫族数与文案守卫组数、
钩子是否安装、今日日报是否已记录本版，并给出本轮推荐命令顺序。退出码非 0 表示已跑偏，先修再开发。

底层仍是 `git -C /Users/a123/Desktop/养正/zhongnan rev-parse --show-toplevel`，
输出必须正好是 `/Users/a123/Desktop/养正/zhongnan`。若不是，立即停止并纠正。

## 自动化入口（不要每轮重新摸索命令）

| 目的 | 命令 |
| --- | --- |
| 轮次开工自检 | `npm run doctor` |
| 防跑偏 + 版本四处一致 | `npm run preflight` |
| 提交/推送前自动闸门（一次性安装） | `npm run hooks:install`（装 pre-commit + pre-push） |
| 文案/离线壳/死链/UI 触发面 | `npm run verify:copy` |
| 发布收口（升版顺序 + 日报 + 后续命令） | `npm run release:prep` |
| 全量回归 | `npm test`（先 `npm run build`） |
| 全量 + 深度移动端巡检 | `npm run verify:full` |

## 改动范围

- 只改 `zhongnan-backend/` 下的源码、测试与文档。
- `zhongnan-backend/.trae/`、`zhongnan-backend/docs/daily-review/` 保持本地未跟踪，不入库。
- 不修改父仓库的 frontend / backend，不做「顺手优化」。

## 发布流程（沿用 dogfood 节奏）

1. 先证伪：grep 确认缺口真实存在，列出邻居差集。
2. TDD：先写测试跑到红，再实现到绿。
3. 变异 ≥2 轮：改阈值/删接线，确认测试咬红后还原。
4. 全量回归：`cd zhongnan-backend && npm test`，0 fail 才继续。
5. 升版三件套：`package.json`、`docs/FRONTEND-ADAPTATION.md` 基线+变更行、日报段落；
   先跑 `npm run release:prep` 按它打印的顺序执行，避免漏项。
6. feat / docs 双 commit，打 tag `vX.Y.Z`，推 `gitee master --tags`。
7. 收尾核对：`git status --short` 只应剩本地未跟踪的日报与 `.trae/`。

## 事故参照

2026-11-07 曾在本仓库任务中误改父仓库「养正」；处置与防线见父目录 `AGENTS.md` 与 `scripts/repo-guard.sh`。
