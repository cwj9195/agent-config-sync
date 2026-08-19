# Agent 拓展包

> 这是长期记忆文件，保存基础包之外的稳定偏好、经验沉淀和项目规则索引。基础包路径：`~/.config/shared-agent-config/prompts/agent.md`。

## 目录

| 节  | 主题                          | 触发场景                                  |
| --- | ----------------------------- | ----------------------------------------- |
| §0  | 维护规则与写入准入            | 改拓展包前、判断能否写入                  |
| §1  | 写入模式（确认后/强制/周期）  | 判断是否该沉淀长期记忆                    |
| §2  | 长期偏好补充                  | 称呼缺失、结束报告字段争议                |
| §3  | 记忆体系维护经验              | 基础包体积、一次性偏好污染、索引自包含    |
| §4  | 工作流补充                    | 改 skills/MCP 源、工作树改动              |
| §5  | 项目规则索引                  | 进入 web-base 等已索引项目                |
| §6  | 待确认事项                    | 自动化提炼、多端同步                      |
| §7  | MCP 开发通用经验（7.1–7.4）   | 写 MCP、协议坑、cc-switch 管理、node 路径、连接故障诊断 |
| §8  | session-bridge MCP（8.1–8.7） | 跨工具会话读取、检索历史对话、grep 检索法 |
| §9  | rtk / shell 操作经验          | 写文件、管道污染、定位文件                |
| §10 | 工具链路与平台认知            | 平台工具 vs agent 工具、敏感信息读取      |
| §11 | MasterGo MCP 使用经验         | 分享链接参数选择、空数据排查、链接提取    |
| §12 | YApi MCP 与接口 Mock 经验     | mock 字段级规则、vite.proxy 代理、save_api 回写、路径前缀 |
| §13 | Codex Desktop Responses-Lite 排障 | use_responses_lite 模型兼容错误、models_cache.json 自动重置、cc-switch 中转修复 |

## 0. 维护规则

1. 本文件不重复基础包硬规则，只记录补充信息、经验和项目限定规则索引。
2. 新增或更新条目时，必须包含：内容、来源、适用范围、状态、最后确认时间。
3. 写入准入标准：重复出现 2 次以上、用户明确确认、跨项目稳定适用，满足其一才建议写入。
4. 不写入一次性任务、临时情绪、未验证猜测、当前会话私有上下文。
5. 条目状态统一使用：有效、项目限定、待确认、冲突、过期。
6. 若条目与当前项目 AGENTS 或系统/开发者指令冲突，优先遵守更高优先级指令，并在结束报告中说明。

## 1. 写入模式

| 模式       | 触发方式                                                                                | 写入规则                                                                                 | 状态   | 最后确认时间 |
| ---------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------ | ------------ |
| 确认后写入 | 默认模式；任务收尾只给长期记忆建议。                                                    | 用户说"确认写入长期记忆"后，才修改本文件。                                               | 有效   | 2026-06-12   |
| 强制写入   | 用户说"本次强制写入长期记忆：..."。                                                     | 本轮必须整理并写入对应条目，来源标为"用户强制要求"，并补齐适用范围、状态、最后确认时间。 | 有效   | 2026-06-12   |
| 周期复盘   | 未来可用 `/loop 1w 复盘最近 Codex/ClaudeCode 对话，提炼长期记忆候选并更新拓展包` 触发。 | 默认只生成候选清单；只有启用自动写入模式后才直接改文件。                                 | 待确认 | 2026-06-12   |

## 2. 长期偏好补充

| 内容                                                                                                 | 来源                                               | 适用范围 | 状态 | 最后确认时间 |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------- | ---- | ------------ |
| 用"主人"作为基础包加载偏离的可见信号；如果称呼缺失，应优先检查基础包是否被读取。                     | 用户粘贴的 Istishia 评论；会话确认                 | 全部会话 | 有效 | 2026-06-12   |
| 结束报告除完成内容与验证结果外，应包含风险、Regression Check、Defensive Code、是否建议沉淀长期记忆。 | `~/.config/shared-agent-config/prompts/agent.md`；会话确认 | 全部会话 | 有效 | 2026-06-12   |
| 称呼缺失信号**主要服务用户外部监督**，非 agent 可靠自检器。2026-06-20 实证：连续 5 轮漏叫主人时 agent 未依本条自纠，由用户指出才纠正。根因（悖论）：要求"会漏规则的 agent"自检"漏规则"，自检这步也会漏；注意力被技术任务占满时规则自检随之失效。可靠纠正=用户反馈闭环；harness 级强制 > 规则驱动。 | 本会话实证 | 全部会话 | 有效 | 2026-06-20 |

## 3. 记忆体系维护经验

| 经验                                               | 正确做法                                                             | 来源                                              | 适用范围            | 状态 | 最后确认时间 |
| -------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------- | ------------------- | ---- | ------------ |
| 基础包过大会增加每轮上下文负担。                   | 基础包只保留硬规则；丰富偏好、踩坑经验和项目索引放拓展包，按需读取。 | 用户粘贴的 Istishia 评论；微信文章正文            | 全局 agent 记忆管理 | 有效 | 2026-06-12   |
| 把一次性偏好写进长期规则，会污染后续会话。         | 写入前检查是否满足写入准入标准；不满足时只在当前任务内遵守。         | 微信文章正文；用户粘贴的 Istishia 评论            | 长期记忆维护        | 有效 | 2026-06-12   |
| 只靠新会话临时说明，会导致偏好和踩坑经验反复丢失。 | 将稳定经验沉淀为可读取文件，并从基础包引用。                         | 微信文章正文《一个让Codex变得越来越聪明的小方法》 | 全局 agent 记忆管理 | 有效 | 2026-06-12   |
| 用户说“沉淀”时，必须同时写入 `/Users/amoy/.config/shared-agent-config/prompts/extension-pack.md` 和 MemOS；写入后分别复核两边的核心内容是否一致。 | 双写后人工对照，当前未发现本扩展包与 MemOS 的自动同步机制；不写入密码、令牌、密钥等敏感信息。 | 用户明确要求；2026-08-06 会话确认 | 全部会话 | 有效 | 2026-08-06 |

### 3.1 “沉淀”双写与同步复核

> 来源：用户明确要求；适用范围：所有需要长期沉淀的经验、偏好和项目规则；状态：有效；最后确认时间：2026-08-06。

- 触发“沉淀”时，同时写入本扩展包 `/Users/amoy/.config/shared-agent-config/prompts/extension-pack.md` 和 MemOS。
- 两边记录同一组核心内容，至少包括问题/背景、原因、解决方案、验证结果和后续防护。
- 写入后分别复核本地文件和 MemOS 返回结果，确认没有遗漏或相互矛盾的结论。
- 当前未发现本扩展包与 MemOS 之间的自动同步机制，因此采用双写后人工对照，不能只写一边并声称已同步。
- 不写入密码、令牌、密钥等敏感信息。

## 4. 工作流补充

| 内容                                                                               | 来源                                     | 适用范围             | 状态 | 最后确认时间 |
| ---------------------------------------------------------------------------------- | ---------------------------------------- | -------------------- | ---- | ------------ |
| 修改 skills 或 MCP 配置时，优先修改 shared-agent-config 源信息；下游同步产物不作为主编辑点。 | `~/.config/shared-agent-config/prompts/agent.md` | skills、MCP 配置维护 | 有效 | 2026-07-03   |
| 工作树可能已有用户改动；执行修改前后都要避免回滚无关变更。                         | 系统协作规则；会话确认                   | 所有代码变更         | 有效 | 2026-06-12   |

## 5. 项目规则索引

| 项目/路径                                   | 规则摘要                                                                                                                                                                                                                               | 生效条件                                                                     | 来源                                    | 状态     | 最后确认时间 |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------- | -------- | ------------ |
| `/Users/amoy/Desktop/project/cckg/web-base` | 严格证据模式：仓库事实需要路径和锚点；证据不足时写 Unknown/TODO，不强行下结论。                                                                                                                                                        | 当前 cwd 属于该项目，或当前项目 AGENTS 显式引用该规则。                      | `web-base/AGENTS.md`                    | 项目限定 | 2026-06-12   |
| `/Users/amoy/Desktop/project/cckg/web-base` | UI/交互 bug 收尾必须包含 Regression Check 与 Defensive Code。                                                                                                                                                                          | 当前 cwd 属于该项目，或当前项目 AGENTS 显式引用该规则。                      | `web-base/AGENTS.md`                    | 项目限定 | 2026-06-12   |
| `/Users/amoy/Desktop/project/cckg/web-base` | 新增函数、组件、接口及公共声明时补齐 JSDoc；复杂注释解释设计原因、边界和权衡。                                                                                                                                                         | 当前 cwd 属于该项目，或当前项目 AGENTS 显式引用该规则。                      | `web-base/AGENTS.md`                    | 项目限定 | 2026-06-12   |
| `/Users/amoy/Desktop/project/cckg/web-base` | 不削弱测试资产，不删除关键断言，不扩大 exclusions 绕过问题。                                                                                                                                                                           | 当前 cwd 属于该项目，或当前项目 AGENTS 显式引用该规则。                      | `web-base/AGENTS.md`                    | 项目限定 | 2026-06-12   |
| `/Users/amoy/Desktop/project/cckg/web-base` | PIM M2 `PreselectedImportPreviewFieldsDto` 字段清单以 `apps/pim/docs/260608-第1版/sources/PRD.md:306-364` 的"临时预览表编辑规则"为准；`rowIndex/importStatus` 放外层 `PreselectedImportPreviewDto`，`fields` 从 `sameProductNo` 开始。 | 维护 `apps/pim/docs/PIM商品中心接口契约.md` 或同步 M2 预选品批量导入契约时。 | 用户确认写入长期记忆；本轮 PIM 契约修正 | 项目限定 | 2026-06-13   |
| `/Users/amoy/Desktop/project/cckg/web-base` | **API 类型生成链路（YApi 数据源）**：① `fetch-yapi.cjs` HTTP 拉取 YApi 详情 → ② `source/yapi-goods-274.json` 原始快照 → ③ `tools/yapi-to-openapi.cjs` 转换 OpenAPI 3.0（关键：path 补 `/goods` 前缀、`#/definitions/`→`#/components/schemas/`、无顶层 ref 的 object 自动命名收集）→ ④ `source/openapi-yapi-274.json` → ⑤ `index.cjs`+`run.cjs` 消费生成到 `apps/pim/request/record/`。YApi token：`274:f411...2e`，base URL: `http://192.168.0.112:3000`。`apps/pim` 是 git 子模块。 | 为 PIM 商品模块重新生成 API 类型时。 | 用户确认写入长期记忆；2026-06-30 经 df12aca1 会话发现路径问题 + 本会话发现 typing 为空问题后完整修正 | 项目限定 | 2026-06-30   |
| `/Users/amoy/Desktop/project/cckg/web-base` | **无顶层 ref 的 inline object schema 导致 typing 为空**：YApi 二期接口 (M7-M10) 的 req/res 无顶层 `$$ref`，run.cjs 遇到纯 object 直接返回 `'object'` 类型不收集 DTO。修复：yapi-to-openapi.cjs 对无顶层 ref 的 object 自动生成名称 (PostXxxReq/Res) 并注入 `$$ref` → collectSchemas 正常收集。 | 生成产物中出现 typing.ts 仅 `export {}` 而 index.ts 类型为 `object` 时。 | 本会话实证修复 | 项目限定 | 2026-06-30   |
| `/Users/amoy/Desktop/project/cckg/web-base` | **API 生成路径前缀坑**：页面实际调用的 URL 是 `/goods/goods/xxx`（双 goods），但 YApi path 不带 `/goods`。不加处理 → `base+/goods` 拼出 `/goods/preselected/list`（单 goods）→ 少一层。必须 yapi-to-openapi 里补 `/goods` → OpenAPI path 变 `/goods/xxx` → run.cjs `segments[1]` 取第二段做 apiTag → 拼 base 得 `/goods/goods/xxx`。慎用 regex strip，正确的方向是补前缀。 | 当页面 URL 和生成产物 URL 不一致（如 .split() null 运行时异常）时排查。 | df12aca1 会话实证 + 本会话修复 | 项目限定 | 2026-06-30   |

### 5.1 PIM VXE 组件缺失报错：依赖图未收敛

> 来源：用户确认的问题沉淀；适用范围：`web-base` 中 `vxe-table` / `vxe-pc-ui` 依赖与 VxeUI 注册；状态：项目限定；最后确认时间：2026-08-06。

**问题**：PIM 页面控制台提示缺少 `vxe-pager`、`vxe-button`、`vxe-num-input`、`vxe-radio-group`。早期“恢复高版本”的判断不准确；用户的降级动作是看到报错后的应急处理，不是根因。

**根因**：

- `main.ts` 中的 `VxeUIBase`、`VxeUITable` 注册代码仍然存在，业务注册代码不是问题。
- 只修改 `package.json` 不会自动恢复 `pnpm-lock.yaml` 和实际 `node_modules`。
- 混合依赖树中，`vxe-pc-ui` 与 `vxe-table` 解析到不同版本的 `@vxe-ui/core`，形成两个 VxeUI 单例；组件注册在一个实例上，表格从另一个实例查找，因此运行时认为组件缺失。
- 实际曾出现 `@vxe-ui/core` `4.4.19` 与 `4.4.12` 并存，以及 `vxe-table` 仍链接到 `vxe-pc-ui` `4.16.25`。

**已验证修复**：固定 `vxe-pc-ui@4.14.8`、`vxe-table@4.18.13`、`xe-utils@4.0.7`，收敛为：

`vxe-table@4.18.13 -> vxe-pc-ui@4.14.8 -> @vxe-ui/core@4.4.12 -> xe-utils@4.0.7`

执行 `pnpm install --frozen-lockfile`；实际软链接残留旧版本时，再执行 `pnpm install --force --frozen-lockfile`。验证 `pnpm why @vxe-ui/core` 只有一个版本，两个包的 `VxeUI` 实例一致，并通过 development build。

**预防**：`package.json` 与 `pnpm-lock.yaml` 一起提交；安装和 CI 使用 frozen install；升级 VXE 后检查 `pnpm why @vxe-ui/core`；增加 VxeUI 实例一致性检查；遇到组件缺失先查依赖树、模块解析路径和单例，不在 `table.vue` 中逐个补注册。

## 6. 待确认事项

| 事项                                                                                                  | 当前状态 | 下一步                               |
| ----------------------------------------------------------------------------------------------------- | -------- | ------------------------------------ |
| 是否需要自动化脚本定期从 Codex `sessions/`、`logs_2.sqlite`、`session_index.jsonl` 提炼拓展包候选项。 | 待确认   | 另起设计，不在当前拓展包精简中实现。 |
| 是否需要把拓展包同步到 Claude、Gemini、OpenCode 等其他客户端入口。                                    | 待确认   | 观察 Codex 全局入口效果后再决定。    |

## 7. MCP 开发通用经验

> 来源：2026-06-18 session-bridge MCP 开发过程沉淀。适用范围：所有本地 MCP 开发、cc-switch 维护。状态：有效。最后确认时间：2026-06-18。

### 7.1 MCP server 协议硬规则（踩坑：缺 jsonrpc → parse error 死循环洪水）
- 响应**必须** `{jsonrpc:"2.0", id, result|error}`；缺 `jsonrpc` 字段，client 解析失败 → 互相 parse error → 死循环刷屏（实测 101MB 日志）。
- initialize 的 protocolVersion **协商**：返回 client 发的版本（codex 要 2025-06-18，不能硬编码 2024-11-05）。
- stdio 传输 = line-delimited JSON（newline 分隔），不是 LSP 的 Content-Length。

### 7.2 MCP 配置管理（单一源 = shared-agent-config）

- **唯一事实来源**：`~/.config/shared-agent-config/mcp/mcp-servers.shared.jsonc` + `mcp/secrets.env`。
- **修改流程**：只改 shared 定义文件 → `scripts/sync-mcp.mjs all --write` 同步到 Kilo/Codex/cc-switch.db。
- **cc-switch.db 角色降级**：仅作为 cc-switch 运行时读取的本地缓存，由 sync 脚本保持与 shared 一致。不再作为独立配置源。

### 7.3 node 路径避 GUI PATH 坑
- nvm node(~/.nvm/versions/node/vX/bin/node) 只在交互 shell PATH；GUI app(cc-switch) spawn 子进程的 PATH 可能不含。
- MCP server_config 的 command 优先用 node 全路径（不依赖 PATH）。cc(VSCode 扩展)/codex 实测 PATH 含 node；cc-switch GUI 测试连接可能用 GUI PATH 报超时。

### 7.4 MCP 连接故障诊断 + agent-browser 版本坑（2026-06-23）
> 来源：2026-06-23 排查 agent-browser `-32000 Connection closed`。适用范围：本地 MCP 连接故障、agent-browser 使用。状态：有效。最后确认时间：2026-06-23。
- **`-32000 Connection closed` 本质** = stdio MCP server 在握手前就退出（崩溃/未知命令/缺依赖）。client 收到 EOF 且未完成 initialize → 报此错；`claude mcp list` 对应 `✘ Failed to connect`。
- **诊断手法**：绕过 client 直接探测 server 启动期 stderr——`printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | 命令 参数`；macOS 无 `timeout`，用 `perl -e "alarm 15; exec @ARGV" 命令` 带超时。能立即暴露 `Unknown command`/缺模块/协议错等启动期报错，比 client 的笼统 Connection closed 准。
- **agent-browser 案例**：本地曾装 0.27.0，配置 `args:["mcp"]`，但 0.27.0 **没有 `mcp` 子命令**（包内无任何 MCP/jsonrpc 代码）→ 启动吐 `Unknown command: mcp` 即退出 → Connection closed。`mcp` 子命令是 0.27 之后才加的；`npm i -g agent-browser@latest` 升到 0.29.1 修复（README 第 446/467 行 `agent-browser mcp # Start an MCP stdio server`，标准客户端配置即 `args:["mcp"]`）。升级后 initialize 握手正常，`claude mcp list` 转 ✔ Connected。
- **版本/Node 注意**：0.29.1 `engines` 要求 `node>=24.0.0`，本地 v20.19.0 有 EBADENGINE 警告，但 MCP 握手 + core profile 实测可用；启用 `--tools all` 或高级功能触发 Node24 API 再考虑升 node。
- **会话级陷阱**：MCP 工具在会话启动时注册，运行中 server 挂/恢复不会自动重连。修复 server 后需重启会话（或 `/mcp` 重连）才加载该工具。

## 8. session-bridge MCP 与会话续传

> 来源：2026-06-18 实现全过程 + 2026-06-20 检索经验。适用范围：跨工具会话读取、检索历史对话。状态：有效。最后确认时间：2026-06-20。

### 8.1 概念区分（避免混淆）
- 微信《AI Agent Handoff》的 Handoff = 多 Agent 协作**任务移交**（上下文隔离/分发回收/同框架同协议）。
- 主人需求 = 跨工具**会话续传**（上下文继承/增量/回原会话/跨厂商）——方向相反，不能套同一框架。
- session vs turn：一个对话框多次聊天，session ID 全程不变（=那份 transcript 文件），每 turn 各自内部 id；上下文连续=每轮重喂整份 session；交接=搬整份 session（用 session id 定位）。

### 8.2 现成工具调研结论（都是「导出→开新会话 resume」，做不到回原会话增量补）
cli-continues(1271⭐,Node,MIT) / casr(79,Rust) / ctxmv(32,Swift) / agent-migrator(10,**CC-BY-SA 协议，公司项目慎用**)。故自建 session-bridge（会话内给 ID 读取 + since 增量 + 回原会话）。

### 8.3 codex/claude 会话存储格式（session-bridge 解析依据）
| 工具   | 路径                                                          | 索引                                            | 文件 diff 源                                    | 消息 uuid   | 增量锚点          |
| ------ | ------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------- | ----------- | ----------------- |
| codex  | ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl                  | session_index.jsonl(thread_name/cwd/updated_at) | event_msg.patch_apply_end.unified_diff          | 无稳定 uuid | timestamp         |
| claude | ~/.claude/projects/<编码>/<sessionId>.jsonl(文件名=sessionId) | 无                                              | Edit(old_string/new_string)/Write(content) 重建 | 有 uuid     | uuid 或 timestamp |
- 项目编码：cwd 的 `/` 替换为 `-`。session ID = 文件名 uuid，全程不变。

### 8.4 跨工具 MCP：当前会话 ID 获取（2026-06-18 已修正）
- cc：子进程注入 `CLAUDE_CODE_SESSION_ID`，MCP/bash 都能 `process.env` 读，自动获取。
- codex：spawn 子进程确有 `env_clear()`+白名单（env 拿不到），**但 codex 在每次 `tools/call` 时把 session id 放进 `params._meta["x-codex-turn-metadata"].session_id`**（实证 /tmp/sb.log 握手日志）→ MCP 从 `_meta` 读即可自动获取。早期「codex 注定拿不到、需降级 list 指认」结论已证伪（会话 019ed884 修复验证）。
- 通用做法：`current_session` 探测式，按适配器顺序试每个工具特征（env / _meta key），返回首个命中。

### 8.5 session-bridge MCP 落地（v0.2.0 适配器化重构后，2026-06-18）
- **权威源**：`~/.config/shared-agent-config/mcp/session-bridge/mcp-server.mjs`（~420 行，零依赖 Node ESM）。`~/.codex/handoff/` 是历史遗留死副本，**已删**（db 不引用）。
- 工具：list_sessions / read_session(id, source?, since?, max_chars?) / current_session。read 默认输出上限 60000 字符（超限截断+提示），max_chars 可覆盖。
- 水位：`~/.cache/session-bridge/watermark.json`（XDG 运行时目录，首次自动从旧路径迁移，旧文件保留兜底），**不再写源码目录**。
- 注册：cc-switch.db mcp_servers，id=session-bridge，cc+codex 启用。
- 调试日志：`SB_DEBUG=1` 才写 /tmp/sb.log（默认关，生产干净）。
- 验证(2026-06-18)：current/list/read 全量/增量/截断/自动探测 source 全通；协议层 initialize/tools/list/tools/call 正常。

### 8.6 session-bridge 适配器化 + 扩展新工具方式（2026-06-18）
- 架构：source 解析抽成**适配器注册表** `adapters=[codexAdapter, claudeAdapter]`，每个实现 `{ source, find(id,project?), list(project,limit), parse(file), currentSession(env,meta) }`。主干遍历注册表，不 switch source。
- **加 opencode/pi 等新工具** = 加一个 adapter 对象 + 在 `adapters` push 一行，主干零改动。需先探明该工具：① 会话存储路径+格式（写 parse/find/list）② currentSession 特征（env 变量或 _meta key）。
- 兼容性分层：MCP 协议层任何客户端(opencode/pi)都能调 list/read 读 cc/codex 会话；读其自身会话需对应 adapter（未实现）。
- v0.2.0 修复清单：①watermark 迁移 ~/.cache ②删 .codex/handoff 死副本+源目录死 watermark ③调试日志 SB_DEBUG 门控 ④read 体积上限+截断 ⑤list 流式读取(不全量解析) ⑥错误可见化(lastError+console.error) ⑦适配器化重构。
- 已知：read 大会话时 rtk 包装对大 stdout 处理慢（非 MCP 慢，parse 瞬间完成），直接 MCP 调用不受影响；stdio MCP 改代码需重启/新会话才加载（当前会话挂旧进程）。

### 8.7 按关键词检索历史会话（2026-06-20）
> 来源：2026-06-20 主人要求「搜之前 swagger/openapi 导入 yapi 的对话」。适用范围：跨项目会话检索。状态：有效。最后确认时间：2026-06-20。
- read_session 只能按 ID 读、**不能搜关键词**；list_sessions 的 summary 只取开头一小段，目标话题常不在摘要里。按摘要盲读大会话（如 16M 的 codex 会话）既吃上下文又常落空。
- **正确顺序：grep 本地 jsonl 定位会话文件 → 再 read_session 读上下文**。路径见 8.3（codex `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`；claude `~/.claude/projects/<编码>/<sessionId>.jsonl`，编码=cwd 的 `/`→`-`）。
- 关键词收敛三步：① 英文独特词（`swagger`/`openapi`）找出候选文件集合；②「两词同行」`rtk rg -e "yapi.*(swagger|openapi)" -e "(swagger|openapi).*yapi"` 收敛到真正相关行（单文件大量命中常是工具返回里的 `$ref`/schema 残留，非用户意图）；③ 用户原话在 `event_msg.user_message.message` / `content[].text`，用精确中文短语（`转成openapi`/`上传到yapi`/`导入yapi`）最能锁定请求本身。
- 输出过大时：`grep -v tool-results` / `head -N` / 先 `uniq -c` 看命中会话分布，避免 400KB 污染上下文。
- **教训（本次实证）**：开头按摘要盲读 3 个大会话后才切 grep；以后「在历史会话里找某话题」应 **grep 优先**，read_session 仅用于读已定位会话的上下文。

## 9. rtk / shell 操作经验

> 来源：日常 rtk 使用实证。适用范围：所有需 shell 操作的场景。状态：有效。最后确认时间：2026-06-18。

- `rtk cat > file <<'EOF'`(写文件)、`rtk sqlite3 db <<'SQL'`(执行 SQL)、`rtk node <<'JS'`(跑脚本) 均工作。
- `rtk find | rtk head` 管道输出可能被污染(输出 hex 串)；定位文件用 `rtk find` 单跑或 `rtk ls` 逐步。
- `ls -t` 输出带 size 会污染变量，取文件用 `find`(纯路径)。

## 10. 工具链路与平台认知

> 来源：2026-06-18 cc-switch.log 实证 + "Z.ai Built-in"标记；2026-07-02 图片识别会话实证（analyze_image 为平台内置视觉 tool）；2026-08-07 会话实证（gcmp 视觉工具，用户强制要求写入）。适用范围：全部会话。状态：有效。最后确认时间：2026-08-07。
- **cc 实际链路**：cc → cc-switch 代理(127.0.0.1:15721) → 中转服务(腾讯云 81.70.81.85:23100) → model=glm-5.2。harness 声明 MiniMax-M2，实际路由 glm-5.2（中转前后端模型可能不一致）。
- **工具两层（关键区分）**：
  - agent 工具（cc-switch.db 的 mcp_servers：session-bridge/codegraph/fetch/...）：**本地执行**，cc-switch 可管，日志可见。
  - 平台工具（webReader/web_search_prime，标 `Z.ai Built-in`）：中转平台(Z.ai/智谱)注入，**平台侧执行**，cc-switch 管不到，请求经腾讯云中转。
- **机制**：模型/平台提供工具是普遍能力（类比 OpenAI web_search/code_interpreter、Gemini grounding、智谱 web_search_prime）——模型生成 tool_call → 平台拦截执行 → 结果注入模型上下文，对 agent 半透明。
- **隐私偏好（重要）**：涉及公司敏感信息（代码/会话/密钥）的读取，只用本地 MCP（fetch/session-bridge），避开平台 webReader/web_search_prime（经中转）。
- **图片识别链路（视觉 tool）**：`mcp__4_5v_mcp__analyze_image` 是**模型/平台内置视觉工具**（非用户外挂 MCP）；文本模型遇图片输入 → 发 tool_call → 平台视觉服务读图 → 返回结构化文字 → 模型基于文字输出，**模型自身不解析像素**。
- **视觉能力两形态（关键区分）**：① 原生多模态——模型自带视觉编码器直接吃图（GPT-4V/Claude Vision/GLM-4V）；② tool 桥接——文本模型调视觉 tool（平台内置如 analyze_image / 用户外挂 MCP），靠工具转述文字，主模型无法追问细节需再调一次。
- **选型启示**：cc-switch 切后端时，"能看图"≠模型多模态；要分清原生视觉 vs tool 桥接，后者精度取决于背后视觉服务且多一次 tool 往返。
- **gcmp 插件给 VS Code Copilot 提供视觉工具（调用其他大模型）**：`gcmp_visionTool_analyzeImage`、`gcmp_visionTool_analyzeDataVisualization` 等由 gcmp 扩展（VSCode 扩展 id 前缀 `vicanent.gcmp`）注入 VS Code Copilot；工具链为 Copilot（文本模型）→ 发 tool_call → gcmp 转给其他多模态大模型读图 → 返回结构化文字，主模型不直接解析像素。用户附图会先落到本地缓存（`.../workspaceStorage/.../vicanent.gcmp/vision-cache/*.png`），用视觉工具时把该缓存路径作为 `filePath` 传入即可，不要用 `viewImage`/`read_file` 等文本工具读图。

## 11. MasterGo MCP 使用经验

> 来源：2026-06-21 PIM 第7版需求拆分会话实证（会话 f9693fa1）。适用范围：所有需通过 MasterGo MCP 获取设计数据的场景。状态：有效。最后确认时间：2026-06-21。

### 11.1 分享链接必须用 shortLink（核心教训）

- MasterGo 设计文件通过**分享链接**（URL 含 `shareId=xxx`）访问时，`getDesignSections`/`getDsl`/`getMeta` 等工具用 `fileId`+`layerId` 参数返回空数据。原因是分享链接走分享授权路径，fileId+layerId 走内部认证路径，二者不互通。
- 解决方案：直接传完整 URL 给 `shortLink` 参数，走分享链接验证路径。
- 所有 MasterGo MCP 工具（`getDesignSections`、`getDsl`、`getMeta`、`getDesignSvgs`、`extractSvg`）均支持 `shortLink` 参数。

### 11.2 MasterGo 空数据故障排查顺序

| 步骤 | 操作 | 预期 |
| --- | --- | --- |
| 1 | 检查链接 URL 是否含 `shareId=xxx` | 有则用 `shortLink` 传完整 URL |
| 2 | 确认 `page_id`/`layer_id` 从 PRD 正确提取 | 提取准确 |
| 3 | 尝试 `fileId`+不同 `layerId` 组合 | 可能多页共享同一 fileId |
| 4 | 尝试 `getDsl` fallback | 部分场景有数据 |
| 5 | 尝试 `getMeta` 获取元信息 | 有元信息说明链接可达 |
| 6 | 以上均失败则报告阻塞 | 输出失败原因+修复建议 |

### 11.3 从 PRD 提取 MasterGo 链接的方法

```bash
# 提取所有 MasterGo 链接（含 shareId）
grep -o 'https://mastergo.com/file/[0-9]\+[^" )]*' prd.md | sort -u
```

提取后确认链接含有 `shareId` 参数，直接用完整的链接调 `shortLink`。

### 11.4 getDesignSections 两段式工作流（重要：避免"只有概览"陷阱）

> **实证（PIM 第7版，会话 f9693fa1）**：解决了 `shortLink` 空数据问题后，Agent 仅调用了 `getDesignSections` Mode 1（不传 `sectionIndex`），获取了 sections 的 `id/name/nodeCount/bbox`。随后标记为"已验证(概览)"并交付审查。用户指出后，尝试补调 Mode 2，但只完成了 M2（5 sections）的全量 DSL 抓取，其余 M3(114 sections)、M8(13)、M9(13)、M10(37) 等模块的详细 DSL 全部缺失。根因：Agent 不知道 `getDesignSections` 有两段式调用流程。

`getDesignSections` 是一个**两段式工具**：

| 模式 | 参数 | 返回内容 | 用途 |
|------|------|---------|------|
| Mode 1（概览） | 不传 `sectionIndex` | sections 列表：id/name/type/nodeCount + bbox(x/y/width/height) + rootMetadata + splitContainers | 了解页面有几分层、每个区域的名字和大小 |
| Mode 2（详细） | 传 `sectionIndex=0..N-1` | 每个 section 的完整节点树：children 递归结构、样式 token（font/color/shadow/border）、文本内容、组件引用、交互定义 | 获取实际设计细节用于编码 |

**硬规则：**
1. **Mode 1 只是探路** — 拿到 section 总数和名称后，必须逐个调用 Mode 2
2. **先全部 Mode 1 → 再全部 Mode 2** — 不要混着交错调
3. **落盘时区分文件** — Mode 1 保存为 `sections-{页面}.json`，Mode 2 合并为 `dsl-full-{页面}.json`
4. **大 section 数直接并行调 MCP，不通过 Agent 包装**（详见 §11.5）
5. 完成 Mode 2 后，还要调 `getDesignSvgs` 和 `getDesignTexts` 补全 SVG 图标和长文本内容

### 11.5 确定性 MCP 调用禁止包装成 Agent

**教训（PIM 第7版）**：为了拉 114 个 section DSL，每个 section 启动一个 Agent 调 `getDesignSections`，65 个 Agent 跑 2 小时没跑完。实测直接调 MCP 工具每调用仅 1-2 秒。

**根因**：Agent 有 10-30s LLM 推理开销（理解 prompt→决定工具→格式化参数），而确定性 MCP 调用是纯 HTTP。

**判断标准：**

| ✅ 适合用 Agent | ❌ 不要用 Agent |
|---|---|
| 子任务需要多步推理/搜索/据结果决策 | 子任务 = 固定参数调一个 MCP 工具 |
| 需要理解上下文后写文件/改代码 | 子任务 = 遍历 N 个 sectionIndex 拿 DSL |
| 需要读代码分析影响面 | 子任务 = 批量 GET 请求 |

**正确做法**：直接在对话中写 4-5 个并行 MCP 调用，分批跑完。不启动 Agent。

### 11.6 获取 SVGs 和文本数据是最后一步

完成所有 section 的 Mode 2 DSL 获取后，还需要：
1. 调 `mcp__getDesignSvgs` — 获取 PATH 节点的 SVG HTML 字符串（icons 等）
2. 调 `mcp__getDesignTexts` — 获取大段文本内容（DSL 中 >50 字被截断的文本）

这两个工具不需要 sectionIndex，一次调用返回所有。在生成 HTML 代码时，用 `svgs` 响应里的 key 匹配 DSL 中的 node id。

## 12. YApi MCP 与接口 Mock 经验

> 来源：web-base 二期接口 mock（2026-07-01，用户确认写入）；适用范围：web-base 及同类「YApi 管接口 + vite.proxy 走 mock」项目；状态：有效；最后确认时间：2026-07-01。

### 12.1 mock 必须保留 schema 文档：字段级 mock 规则（核心教训）

YApi 网页响应区那个**可展开的字段表格**（type/属性/描述/required）就是 `res_body` 在 **JSON Schema 模式**（`res_body_is_json_schema=true`）下渲染的。让 mock 数据贴合业务，**必须保留 JSON Schema 模式**，在字段上加 `mock` 属性 —— **切勿切 JSON 模式**（`res_body_is_json_schema=false` 会销毁表格文档，曾被用户否决并撤回）。

**字段级 mock 三要素**（2026-07-01 实测，缺一不可，否则嵌套数据生成不出来）：

1. **字段值用 mock 规则**：字段 schema 加 `mock` 属性 `{"mock":{"mock":"规则"}}`。字面量写死（`"00000"`）或 Mock.js（`@cname`/`@datetime(yyyy-MM-dd HH:mm:ss)`/`@integer(min,max)`/`@pick(['0','1'])` 枚举/`@guid`/`@csentence(5,15)`）。
2. **嵌套 object 字段必须进 `required`**：YApi mock **只生成 required 字段**。嵌套 object（如 `data`）若其自身/子字段不在 required 里 → 该 object 返回 `{}`。要把 `data`、以及 data 内想生成的子字段（current/size/total/records）都写进对应层级的 `required`。这是最易漏的坑（用户提示「是否必须没勾选」即此）。
3. **array 数量用 `minItems/maxItems`，绝不能给 array 加 mock 属性**：给 array 字段加 `mock` 会把整个数组替成字符串（如 `"records":"5-10"`）。用 `"minItems":5,"maxItems":8` 控制 mock 生成条数。

完整示例（分页列表，三要素齐全）：
```jsonc
"data":{"type":"object","required":["current","total","records"],"properties":{
  "current":{"type":"integer","mock":{"mock":"1"}},
  "total":{"type":"integer","mock":{"mock":"50"}},
  "records":{"type":"array","minItems":5,"maxItems":8,"items":{
    "type":"object","required":["billId","applierName"],"properties":{
      "billId":{"type":"string","mock":{"mock":"@guid"}},
      "applierName":{"type":"string","mock":{"mock":"@cname"}}
    }
  }}
}}
```

关键：`code` 必须被 mock 成前端 success 判定值，否则前端全判 fail。web-base `useRequest` 判定 `res.code === '1' || res.code === '00000'`（`src/hooks/request/index.ts:143`），所以 code mock 成**字符串** "00000"（不能数字）。JSON Schema 默认按 type 随机生成（string→乱码英文词、不读 example），不加 mock 规则 → code 也随机 → 前端全 fail。

### 12.2 mock 地址与 method 严格匹配

- 地址 = `http://192.168.0.112:3000/mock/{projectId}` + 完整 path（项目 274 basepath `/goods/goods`，即 `/mock/274/goods/goods/xxx`）。
- **严格按 method 匹配**：POST 接口必须 POST 访问，GET 访问返回 404「不存在的api」。curl 验证带 `-X POST -d '{}'`。
- YApi MCP 的 search 只返回前 20 条，查全量接口 id/catatid 用 `scripts/api-build/source/yapi-goods-274.json`（python 解析 `item.data` 的 `_id/catid/method/path`）。

### 12.3 vite.proxy mock 代理配置坑

- dev 环境请求前缀 `VITE_APP_BASE_API=/dev`，URL = `/dev`+path，proxy `rewrite` 去 base 前缀拼 target。
- mock 代理 `base`（如 `^/dev/goods/goods/seal-goods`）**更具体的必须在前**，否则被 `^/dev/goods` 兜底吞掉（转发 apisix 真实环境而非 mock）。
- **改接口 path 必同步改 proxy base**：曾 sed 把 certificate path 从 `/certificate/` 改 `/goods/goods/certificate/`，旧 proxy `^/dev/certificate` 失配致 mock 落空 → 连锁 bug。

### 12.4 save_api 全量回写防接口定义被清

`yapi_save_api` 是全量更新，**必须带全量原字段**（req_body/req_body_other/catid/title/path/method/req_headers）回写，只改目标字段（如 res_body、加 mock 规则）。流程：先 `yapi_get_api_desc` 取全量 → 改目标 → `save_api` 回写。

### 12.5 接口路径规范（web-base 项目限定）

- goods 域前缀统一 `/goods/goods/`（双 goods，源自 YApi 274 basepath）。
- 请求代码**保留 path 模式**（`useRequest('/goods/goods/xxx')`，可搜索 + 类型安全）；**不用语义 key 模式**（`goods_post_xxx`，不可搜索、无先例，用户否决）。
- 防回归：`scripts/check-api-paths.cjs` + `pnpm check:api`，校验请求 path 在 record 内、拦前缀写错/接口未注册；白名单 `scripts/api-path-allowlist.cjs` 登记未接 record 的接口。
- mock 三方式：A.YApi 代理（record 已录入的接口）；B.前端内存（USE_MOCK+mock/handlers.ts，契约未定时）；C.apisix 真实后端。

### 12.6 YApi MCP 写入成功不等于 Mock 运行成功（2026-07-09）

> 来源：web-base PIM mock 远端代理与 YApi mock 排障。适用范围：web-base 及同类「YApi 管接口 + JSON Schema mock」项目。状态：有效。最后确认时间：2026-07-09。

#### 核心结论

- `yapi_save_api` 写入成功只代表接口定义保存成功，不代表 `/mock/{projectId}/...` 运行时一定能生成 mock 数据。
- MCP 是写入通道，不负责校验 YApi mock 引擎是否兼容该 `res_body`。
- 真正报错发生在访问 YApi mock 地址时，由 YApi 服务端根据 `res_body_is_json_schema=true` 的 `res_body` 生成数据。
- 因此「同样 MCP 写入」但一个接口正常、一个接口异常，根因通常是两份 `JSON Schema + mock.mock` 规则结构不同，而不是 MCP 写入差异。

#### 本次典型报错

问题接口：

- `POST /goods/goods/change-info/apply-bill/page`
- YApi 接口 ID：`32861`
- 原始接口路径：`/change-info/apply-bill/page`

正常对照接口：

- `POST /goods/goods/seal-goods/apply-bill/page`
- YApi 接口 ID：`32896`
- 原始接口路径：`/seal-goods/apply-bill/page`

直接访问 mock 复现：

```bash
rtk curl -s -i -X POST 'http://192.168.0.112:3000/mock/274/goods/goods/change-info/apply-bill/page' \
  -H 'Content-Type: application/json' \
  -d '{"current":1,"size":3}'
```

报错：

```text
Cannot use 'in' operator to search for 'template' in {"type":"object",...}
```

#### 根因

YApi mock 生成器会先解析字段级 `mock.mock` 规则，但在某些 schema 结构下会出现「半 schema、半 mock 值」的中间态：

- `@csentence(3,6)` 被提前替换成中文句子。
- `L@integer(100,999)` 被提前替换成类似 `L772`。
- 外层仍保留 `type/properties/required` 的 schema 结构。
- 生成器随后继续把这个混合对象当模板处理，执行类似 `template in xxx` 的判断，最终触发 `Cannot use 'in' operator...`。

这不是接口服务不可达，也不是前端代理问题，而是 YApi mock 生成器对某些 `JSON Schema + mock.mock` 组合兼容性差。

#### 为什么对照接口正常

`/seal-goods/apply-bill/page` 正常，是因为它的分页响应 schema 更完整、更贴合 YApi mock 生成器预期：

- `data.required` 包含 `current,size,total,records,pages,sortRule`。
- `records.items.required` 包含业务列表字段全集。
- 字段基本都有 `description/example/mock`。
- `records.items` 中存在 `nullable:true`。
- `msg` 使用固定值 `success`。
- 数组长度通过 `minItems/maxItems` 控制，而不是给数组字段写 `mock`。

问题接口原先 schema 过小，只保留少量字段，例如 `billId/applierName/waitApprovers`，并混用了动态 mock 规则，更容易触发 YApi 生成器异常。

#### 修复策略

1. 不要把响应切到普通 JSON 模式。
   - 必须保留 `res_body_is_json_schema=true`。
   - 否则 YApi 页面上的字段表格文档会丢失。
2. 用正常接口的分页 schema 模板修问题接口。
   - 顶层固定为 `code/msg/data/success`。
   - `data.required` 至少包含 `current,size,total,records,pages,sortRule`。
   - `records` 使用 `type: array` + `minItems/maxItems`。
   - `records.items` 使用完整 object schema。
   - `records.items.required` 写入要生成的字段全集。
   - 嵌套数组如 `waitApprovers` 也要写 `minItems/maxItems`，并给 `items.required` 补齐字段。
3. 谨慎使用动态 mock 规则。
   - 稳定字段优先固定值：如 `msg: success`、`approvalStatus: APPLYING`。
   - 可保留已验证稳定的规则：`@guid`、`@cname`、`@datetime(yyyy-MM-dd HH:mm:ss)`、`@integer(min,max)`。
   - 对报错接口，减少复杂组合规则或先用固定值验证。
   - 如果使用 `@pick([...])`、复杂拼接规则、嵌套数组动态规则后报错，优先二分定位具体字段。
4. 验证必须走 mock 地址，不只看 MCP 返回。
   - `yapi_save_api` 返回成功后，必须再 `curl` 对应 `/mock/{projectId}/...`。
   - 响应 `Content-Type: application/json` 且 `code` 为前端成功值才算通过。
   - web-base 前端成功码要求：`code === '1' || code === '00000'`。

#### 排查顺序

1. 用 `yapi_get_api_desc` 读取问题接口和正常对照接口。
2. 对比 `res_body`：`required`、`records.items.required`、嵌套 array 的 `minItems/maxItems`、是否错误给 array 写了 `mock`、`mock.mock` 中的复杂动态表达式。
3. 直接 curl mock 地址复现。
4. 若写入成功但 mock 失败，优先收敛响应 schema，而不是怀疑 MCP 写入通道。
5. 用同类正常接口 schema 做模板，逐步替换问题接口。
6. 每次 `save_api` 后都 curl 验证。

#### 本次修复经验

- `32861 /change-info/apply-bill/page` 修复方式：参考 `32896 /seal-goods/apply-bill/page` 的完整分页 schema。
- 保留 JSON Schema 模式，补齐 `pages/sortRule`，补齐 `records.items.required`。
- 给 `waitApprovers` 补齐数组 schema 与 required。
- 将部分易出问题动态值收敛为固定值，例如 `msg=success`、`approvalStatus=APPLYING`。
- 修复后直接访问 `http://192.168.0.112:3000/mock/274/goods/goods/change-info/apply-bill/page` 已从 `Cannot use 'in' operator...` 恢复为正常 JSON。

## 13. Codex Desktop Responses-Lite 排障经验

> 来源：2026-07-09 Codex Desktop GPT-5.5 报错 "This model is not supported when using X-OpenAI-Internal-Codex-Responses-Lite" 排障全程。适用范围：Codex Desktop macOS/Windows 客户端 + cc-switch 中转环境。状态：有效。最后确认时间：2026-07-09。

### 13.1 现象与根因

- 报错：`This model is not supported when using X-OpenAI-Internal-Codex-Responses-Lite.`
- 根因：Codex Desktop 对 GPT-5.5 错误标记 `use_responses_lite: true`，而 Lite 通道不支持该模型。GPT-5.4 正常（`false`）。
- GitHub issue：openai/codex #30406、#30422、#30461、#30595、#30912、#31022、#31150、#31607、#31705、#31717 等 12+ 个相同问题，集中出现在 2026-06-28 至今。

### 13.2 关键配置文件（macOS 路径）

| 文件 | 路径 | 作用 | 重启后是否重置 |
|------|------|------|--------------|
| `models_cache.json` | `~/.codex/models_cache.json` | Codex 原生模型（GPT-5.x 等）的 capability 元数据，由 Codex 服务端下发 | **是**（每次启动重新生成） |
| `cc-switch-model-catalog.json` | `~/.codex/cc-switch-model-catalog.json` | cc-switch 中转模型的元数据，本地维护 | **否**（本地静态文件） |
| `config.toml` | `~/.codex/config.toml` | 全局 `wire_api` 协议选择（`"responses"` / `"chat"`） | 否 |

### 13.3 修复策略

**中转模型（cc-switch）** — 永久修复：

```bash
sed -i '' 's/"use_responses_lite": true/"use_responses_lite": false/g' ~/.codex/cc-switch-model-catalog.json
```

`cc-switch-model-catalog.json` 是本地静态文件，修改后不会被覆盖。

**原生模型（GPT-5.5）** — 临时修复（每次重启需重做）：

```bash
# 每次 Codex Desktop 重启后需重新执行
node -e "const fs=require('fs');const p=process.env.HOME+'/.codex/models_cache.json';const d=JSON.parse(fs.readFileSync(p,'utf8'));const m=d.models.find(m=>m.slug==='gpt-5.5');if(m){m.use_responses_lite=false;fs.writeFileSync(p,JSON.stringify(d,null,2))}"
```

### 13.4 排查要点

1. **Grep 找所有 `use_responses_lite: true`**：
   ```bash
   grep -rn 'use_responses_lite.*true' ~/.codex/
   ```
   不止 `models_cache.json`，`cc-switch-model-catalog.json` 中也可能有。

2. **`models_cache.json` 会静默重置**：手工修改后重启 Codex Desktop，GPT-5.5 的 `use_responses_lite` 大概率恢复 `true`。这是已知 bug，Codex 官方未修复。不要依赖手工改 `models_cache.json`。

3. **中转模型优先用 cc-switch-model-catalog.json 修复**：该文件不会被覆盖，改一次永久生效。

4. **`config.toml` 的 `wire_api = "responses"` 无需修改**：这是正确的 Responses API 协议（非 Lite），报错是模型级标记问题而非协议层。

5. **macOS vs Windows 路径**：
   - macOS: `~/.codex/models_cache.json`
   - Windows: `C:\Users\<用户名>\.codex\models_cache.json`

### 13.5 验证方式

```bash
# 中转模型
grep -c '"use_responses_lite": true' ~/.codex/cc-switch-model-catalog.json  # 期望 0

# 原生模型（重启后可能非 0，需重新修复）
grep -c '"use_responses_lite": true' ~/.codex/models_cache.json
```
