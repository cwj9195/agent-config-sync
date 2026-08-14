# @cwj/session-bridge

MCP (Model Context Protocol) server for cross-tool session reading and bidirectional incremental context sync.

Supports reading session history from **Codex**, **Claude Code**, and **VS Code Copilot**, with exact caller identification for all three tools (and extensible to other AI coding tools).

## Tools

| Tool | Description |
|------|-------------|
| `current_session` | Returns the calling tool's current thread/session ID from exact metadata or environment variables; supports Codex `threadId`/`x-codex-turn-metadata.thread_id` and VS Code `vscode.conversationId`; returns `unknown` when unavailable and never infers by `cwd` |
| `list_sessions` | Lists recent Codex, Claude Code, Kilo, and VS Code Copilot sessions with id, source, timestamp, project cwd, and summary |
| `read_session` | Reads a full session transcript; supports `since` (incremental from timestamp) and `max_chars` (output size limit, default 60000) |

## Usage

This is an MCP server — configure it in your MCP host:

### Codex (`~/.codex/config.toml`)

```toml
[mcp_servers.session-bridge]
type = "stdio"
command = "npx"
args = ["-y", "@cwj/session-bridge"]
```

### Claude Code (`~/.claude/settings.json` or project `.claude/settings.json`)

```json
{
  "mcpServers": {
    "session-bridge": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@cwj/session-bridge"]
    }
  }
}
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `SB_STATE_DIR` | `~/.cache/session-bridge` | Runtime state directory (watermark, etc.) |
| `SB_COPILOT_TRANSCRIPTS_DIR` | 自动探测 VS Code workspaceStorage | Optional direct path to the Copilot transcripts directory |
| `SB_DEBUG` | `(unset)` | Set to `1` to enable debug logging to `/tmp/sb.log` |
| `SB_DEBUG_LOG` | `/tmp/sb.log` | Debug log path |

## Development

```bash
# Build and test locally
node mcp-server.mjs --list

# Adapter architecture — add new tool support by pushing to `adapters` array
```

## License

MIT
