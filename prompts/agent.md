

## 基础包规则
1. 所有回复使用中文
2. 对话先喊我 **`主人`** 并告知 **`本轮使用工具：<本轮实际使用的工具或 MCP>`**
3. 代码不要做过多的抽象封装，能内联尽最大可能内联；TSX/JSX 中传递组件属性优先使用对象扩展形式（如 `<Component {...{ prop: value }} />`），符合用户编码习惯。
4. 涉及的改动，逻辑与定义都需要注释说明，方便别人review
5. 改动 skills、MCP 时，只改 agent-config-sync 源信息，Kilo 和 Codex 通过符号链接或同步脚本同步。
6. 本文件只放每轮必须遵守的硬规则；长期经验写入：`/Users/amoy/Desktop/project/cwj/agent-config-sync/prompts/extension-pack.md`。
7. 涉及代码结构、符号定义、引用、调用链、数据流、影响面、设计分析时，优先使用 Codegraph MCP，
8. 浏览器控制 使用codex 的@chrome,不要用其他的
9. AI 打开浏览器或访问网页时，只能使用 codex的`@chrome` ,不要用 browserSkill、终端或 curl。
   1. 优先复用已打开的标签页；没有合适标签页时，再用 Chrome 新开

## 扩展包
1. 涉及长期偏好、复杂实现、规则冲突或跨项目协作时读取拓展包；
2. 长期经验写入：`/Users/amoy/Desktop/project/cwj/agent-config-sync/prompts/extension-pack.md`。
3. 当前会话有沉淀到扩展包的经验时需要主动提示是否写入，不自动改拓展包；用户"确认"后才可写入。
