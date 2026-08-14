# Shared Agent Config

Kilo / Codex / Claude / Copilot / cc-switch 共享 AI Agent 配置仓库。单一事实来源，通过符号链接和同步脚本分发到各工具。

## 目录结构

| 目录 | 用途 | 格式 |
|------|------|------|
| `prompts/` | 系统提示词 (agent, extension-pack, rtk) | `.md` |
| `skills/` | Agent 技能 (SKILL.md 协议，跨工具兼容) | `{name}/SKILL.md` |
| `commands/` | 终端命令 (OpenSpec 工作流等) | `.md` |
| `mcp/` | MCP 服务器定义 + 密钥文件 | `.jsonc` |
| `agents/` | Agent 定义 (预留) | `.md` |
| `scripts/` | 同步脚本 | `.mjs` |

## 同步

```bash
# 全套同步（MCP 配置 + Skills 表 + 符号链接 + AGENTS.md + Copilot 指令）
node ./scripts/sync.mjs all --write

# 仅特定工具
node ./scripts/sync.mjs kilo --write        # Kilo MCP 配置
node ./scripts/sync.mjs codex --write       # Codex config.toml MCP 段
node ./scripts/sync.mjs claude --write      # ~/.mcp.json (Claude/Copilot 共用)
node ./scripts/sync.mjs copilot --write     # Skills + 全局指令
node ./scripts/sync.mjs cc-switch --write   # cc-switch.db (MCP + Skills) + 符号链接
```

## 启用项清单

统一在 `features.shared.jsonc` 配置同步时启用的 MCP 和 Skills：

```jsonc
{
  "mcp": {
    "memos-api-mcp": true,
    "yapi-auto-mcp": false
  },
  "skills": {
    "memos": true,
    "loop": false
  }
}
```

将值改为 `false` 后执行全量同步，对应 MCP 不会写入下游；对应 Skill 的共享符号链接和 cc-switch 记录会被移除。未列出的 MCP 沿用自身 `enabled` 值，未列出的 Skill 默认启用。

### Copilot 额外步骤

Copilot MCP 不直接写入配置文件，而是通过 VS Code 自动发现 `~/.mcp.json`：

1. 确保 `~/.mcp.json` 已同步：`node ./scripts/sync.mjs claude --write`
2. 在 VS Code 中开启自动发现：`"chat.mcp.discovery.enabled": true`

## 密钥管理

MCP 定义使用占位符（`__MASTERGO_TOKEN__`、`__ZHIPU_API_KEY__` 等），实际密钥存于 `mcp/secrets.env`（`.gitignore` 保护）。

## 新增 MCP / Skill / 指令

1. MCP: 编辑 `mcp/mcp-servers.shared.jsonc`
2. Skill: 在 `skills/` 下新增目录 + `SKILL.md`
3. Copilot 指令: 编辑 `scripts/sync.mjs` 中的 `INSTRUCTIONS_CONTENT`
4. 运行 `node ./scripts/sync.mjs all --write`
5. 重启 Kilo / Codex / VS Code 会话
