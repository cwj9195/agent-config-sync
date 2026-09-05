# 测试用例执行规则

只有用户提供了实际测试结果，才允许提交测试结果；“开始测试”不等于 `pass`。

## 前置核对

- 先读取测试单和用例详情，确认 `caseId` 属于目标测试单。
- 实时读取用例版本、步骤顺序、前置条件和预期结果。
- 结果只允许 `pass`、`fail`、`blocked`、`skipped`。

## 写入和回读

- 使用 `runTestCase` 写入一次。
- 写入后使用 `getTestTaskResults` 核对测试单、用例 ID、结果、执行人和时间。
- 回读不到目标结果时标记为“写入未核验”，不得宣称成功。

## REST v1 降级

仅当 MCP 执行接口明确失败且具备已认证 REST 会话时，才考虑：

```text
POST /api.php/v1/testcases/:caseId?runID=<testTaskId>&version=<caseVersion>
```

请求体必须是 JSON，`steps` 保持原顺序，每一步同时提供 `result` 和 `real`；`skipped` 转为 `n/a`。降级写回后仍必须回读测试单结果，并标注“REST v1 降级回写”。
