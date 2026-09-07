---
name: zentao-v1
description: 通过 REST v1 优先、Legacy 兜底的 ZenTao MCP 查询和操作项目、执行、任务、Bug、需求与测试数据；适用于读取 Bug、创建任务、更新任务和解决 Bug 等禅道工作流。
argument-hint: 禅道操作目标，例如：帮我读取 Bug 18508 或在执行 6837 创建日常任务
user-invocable: true
disable-model-invocation: false
---

# ZenTao REST v1 MCP

只使用 `zentao-rest-v1` MCP。它优先调用禅道 REST v1，只有明确的 v1 路由不兼容时才由适配器回退 Legacy；不得切换到 `zentao-aipper` 或其他禅道 MCP。

默认账号为 `caiwenjia`（蔡文嘉）。不得在技能、脚本、日志或回复中保存或输出密码、Token、Cookie、会话密钥或完整认证请求头。

## 工具路由

按当前 MCP 工具清单使用同名工具，不要臆造工具名。核心路由如下：

- 读取：`getBugDetail`、`getTaskDetail`、`getMyBugs`、`getMyTasks`、`getProductBugs`、`getProductStories`、`getStoryDetail`、`getTestCaseDetail`、`getTestTaskDetail`、`getTestTaskResults`。
- 任务写入：`createTask`、`updateTask`、`startTask`、`finishTask`、`closeTask`。
- Bug 写入：`updateBug`、`resolveBug`。
- 测试写入：`createTestCase`、`runTestCase`。
- 兼容和辅助工具：按当前清单调用；未覆盖的 REST v1 能力由适配器按规则回退 Legacy。

## 统一写入协议

所有创建、更新、完成、解决和测试结果写入都遵循：

```text
READ → VALIDATE → PREPARE → CONFIRM → WRITE_ONCE → READ_BACK
```

- `READ`：确认目标 ID、项目、执行、当前状态、负责人和相关字段。
- `VALIDATE`：只使用用户明确提供或实时读取到的数据；缺少必要字段时询问，不猜测。
- `PREPARE`：展示最终字段、影响范围和回退方式。
- `CONFIRM`：未得到明确确认前不得写入。
- `WRITE_ONCE`：确认后只提交一次；超时或结果不明时先回读，禁止盲目重试。
- `READ_BACK`：以详情或结果接口回读为成功依据，不以 HTTP 200 或“成功”文本代替核验。

适配器只在明确的 REST v1 路由不兼容时回退 Legacy。认证失败、参数校验失败或写入结果不明时不得自动换通道重试。

任务从创建到关闭的完整状态流转、时间字段和失败停止条件，必须遵循 [references/task-lifecycle.md](references/task-lifecycle.md)。

## 日常任务默认规则

仅对日常或空白任务生效；需求拆分、Bug 修复和用户明确指定的字段优先级更高：

- 任务名称默认保留一个 `【类型】` 前缀；已有前缀时不重复添加。
- 负责人默认使用当前账号 `caiwenjia`（蔡文嘉）。
- 日期默认使用当天，预计开始和截止日期均为当天。
- 工作时间约定为当天 `08:00–20:30`；创建任务使用日期字段，完成任务时必须提交实际完成日期时间，不能只传日期。
- 描述默认为空；用户提供描述时才提交。
- 编号内容默认合并为一条任务名称，不自动拆成多条任务。

## 创建日常任务

日常或空白任务直接使用 `createTask`，至少需要用户明确提供：

- `executionId`
- `name`
- `type`

可选字段包括负责人账号、预计工时、预计开始、截止日期、优先级、模块、需求、父任务和描述。页面“事务”对应接口值 `affair`；蔡文嘉对应账号 `caiwenjia`。

来源为需求或 Bug 时，先读取来源详情；只有工具实际返回新任务并完成回读，才能宣称创建成功。当前 `createTaskFromStory` 和 `createTaskFromBug` 若只返回手动操作建议，不得冒充自动写入成功。

## 完成和关闭任务

- 用户明确要求“完成并关闭”时，必须按 `createTask（如尚未创建）→ startTask（如为 wait）→ finishTask → closeTask` 顺序执行。
- `wait` 只能先开始；`doing` 才能完成；`done` 才能关闭；每一步都要用 `getTaskDetail` 回读后再进入下一步。
- `finishTask` 必须带回读得到的 `realStarted`，并提交明确晚于它的 `finishedDate`；不能只传日期 `YYYY-MM-DD`。
- 任务完成后必须先回读为 `done`，再单独关闭并回读为 `closed`；失败或响应不明时停止，不盲目重试。

详细流程和 21.7.x 时间校验见 [references/task-lifecycle.md](references/task-lifecycle.md)。

## 任务地址输出

- 任务创建、读取、更新、开始、完成或关闭并成功回读后，必须输出该任务的禅道地址。
- 地址使用已核验的站点地址和任务 ID 生成：`<禅道站点地址>/task-view-<taskId>.html`。
- 只有拿到真实任务 ID 并完成回读后，才能输出地址；写入未核验时不得生成成功链接。

## 更新和解决 Bug

### 更新属性

1. 先用 `getBugDetail` 读取目标 Bug。
2. 只修改用户明确要求的字段；`updateBug` 会补齐 REST v1 PUT 所需的现有字段，避免清空未修改内容。
3. 展示最终更新字段并确认。
4. 只调用一次 `updateBug`，再回读 Bug 详情核对目标字段。

### 解决 Bug

`active` 只代表禅道状态，不等于问题当前仍可复现。只有满足以下任一条件才允许 `resolution=fixed`：

- 本次成功复现、确认根因、完成代码或配置修复，并通过回归验证；
- 已有改动可追溯，解决版本准确，有回归证据，并得到用户明确确认。

未满足门禁时不得调用 `resolveBug`，不得为了关闭 Bug 制造代码改动。解决备注严格使用：

```text
产生原因：<可验证的技术或业务根因>
解决方案：<本次实际执行的修复方案>
改进措施：-
```

解决版本必须是真实值；界面“主干”对应接口值 `trunk`。解决后回读状态、解决方案、解决版本、执行人、日期和最新备注。

详细 Bug 处理规则见 [references/bug-resolution.md](references/bug-resolution.md)。

## 个人任务查询

只有用户查询“我的任务”“我上周做了什么”“我参与过的项目”等个人范围时，才读取 [references/personal-task-scope.md](references/personal-task-scope.md)。

不得把白名单结果表述为全部禅道项目的全局结果；异常、错页、错执行和未覆盖范围必须单独说明。

## Bug 与代码提交

用户明确要求提交代码并关联 Bug 时，读取 [references/git-bug-commit.md](references/git-bug-commit.md)。ZenTao 写回和 Git 提交是两个独立写操作，必须分别确认、只提交一次并分别回读。

## 测试用例

只有用户提供实际测试结果时，才允许执行 `runTestCase`。测试单、用例归属、版本、步骤顺序和每一步实际结果必须先核对。详细规则见 [references/test-case-run.md](references/test-case-run.md)。

## 浏览器边界

默认只使用 MCP 和本地只读处理，不使用浏览器模拟页面。只有 MCP 无法取得必要数据、必须复现页面语义或按 Bug 步骤进行人工核验时，才说明缺口并考虑浏览器。

## 完成前检查

- 未越过个人项目白名单或用户明确授权范围。
- 所有写入都有最终字段确认，并遵守只写一次和写后回读。
- REST v1 与 Legacy 的回退原因清楚，没有把接口异常解释为无数据。
- Bug 修复有真实根因、修复方案、解决版本和回归证据。
- Git 提交只包含本会话实际修改的代码块。
- 没有泄露认证信息，也没有把未核验结果表述为成功。
