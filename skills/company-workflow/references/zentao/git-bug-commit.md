# Bug 与代码提交关联

用户明确要求“提交代码并关联 Bug”时才读取本文件。

## 流程

```text
READ_STAGED → VALIDATE_SCOPE → PREPARE+CONFIRM → COMMIT_ONCE → READ_BACK
```

1. 读取仓库边界、`git status --short`、暂存统计、暂存差异和未暂存差异。
2. 只保留本会话实际修改的代码块；混合文件必须逐块选择，无法确认归属时排除或请求确认。
3. 不使用 `git add -A`、`git commit -a`，不自动移出其他会话的暂存内容。
4. 必要时用临时 `GIT_INDEX_FILE` 隔离提交；无法可靠隔离时停止提交。
5. 提交信息必须符合：`fix(<scope>): #<bug号> <说明>`。
6. 确认仓库、文件、统计、排除项、Bug 号和提交信息后，只提交一次。
7. 回读提交 ID、提交信息、文件清单、状态和暂存区；确认未暂存差异仍按预期保留。

Bug 状态写回与 Git 提交是两个独立写操作，必须分别确认和回读。
