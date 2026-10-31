---
name: openapi-json-generator
description: 根据业务需求生成纯 JSON 的 OpenAPI 3.0.3 文档，统一错误响应、通用 Schema、BearerAuth 安全方案与字段级变更标记（x-change / x-change-note）。适用于需要输出 OpenAPI 3.0.3 JSON（非 YAML）、统一通用结构与字段级变更标记的接口文档生成场景。
---

# Skill: OpenAPI 3.0.3 JSON Generator

## 目标
根据业务需求生成**纯 JSON** 的 OpenAPI 3.0.3 文档，满足以下全部硬性约束。

## 何时使用
- 需要输出 OpenAPI 3.0.3 JSON（不是 YAML）
- 需要统一的错误响应、通用 Schema、BearerAuth 安全方案
- 需要字段级变更标记（x-change / x-change-note）

## 输出模式
- 默认使用 `refs` 引用模式，通用结构通过 `$ref` 复用，适合维护和减少重复。
- 用户明确要求“不引用 `$ref`”“内聚”“内联”或“每个接口自包含”时，使用 `inline` 内联模式，不再追问。
- 两种模式都保持 OpenAPI 3.0.3 的六个顶层键、字段级约束、变更标记和安全定义；模式只决定 Schema/Response 如何复用。
- `inline` 模式将请求体、成功响应和错误响应 Schema 展开到使用位置；`components.schemas` 可为空对象，`components.responses` 保留统一错误响应名称但各自内联错误 Schema。不得留下任何 `$ref`。
- 内联展开遇到递归业务结构时，按 PRD 明确的业务层级展开；若层级未定义，在末端说明层级限制，不保留递归 `$ref`。

## 文档受众与信息分流
- OpenAPI JSON 面向接口使用者，`info.description`、operation/parameter/schema 的 `description` 只写接口用途、字段含义、约束、枚举及可观察的请求/响应行为。
- 不在 OpenAPI 的描述字段写内部研判，例如“路径为设计候选”“PRD/YApi 尚未确认”“需后端确认”“参考某接口推导”“是否拆独立接口”等；这些内容会被读者误认为契约定义。
- 将 YApi 核对结论、未确认项、候选路径/字段、方案取舍和待办记录在配套的内部核对文档（如 `接口核对记录.md`），按设计编号或 path 关联；PRD 来源位置按下方规则同步写入 OpenAPI 的 `x-internal-note`。其他内部备注只有在用户要求保留于同一 OpenAPI JSON 时才写入对应 operation/parameter/schema 对象，且不得混入 `description`。
- PRD 已提供时，默认在每个 operation 的 `x-internal-note` 中写对应的需求关联位置；优先定位到 PRD 小节、表格行或字段，并同时写可读的章节/条目名称与行号/页码。若 PRD 只描述业务交互、没有定义独立接口，明确写出关联的业务需求位置，并说明接口拆分属于设计推导，不要伪称 PRD 声明了该接口。
- 需求位置尽量提供可点击链接。Markdown PRD 优先使用相对 OpenAPI 文件的链接和行锚点，例如 `[PRD《商品调价申请》单头字段第 423 行](./PRD.md#L423)`；相对路径必须按 OpenAPI 文件所在目录计算。链接旁保留章节/条目名称和行号，作为不支持链接跳转时的文本兜底。PDF 可使用查看器支持的页码锚点；DOCX 或不支持行锚点的格式写章节、表格行或页码，不要拼造无效锚点。
- 添加链接前核实源文件路径和位置确实存在，并确认引用内容支持该接口行为。找不到精确来源时，标注最近的相关需求位置及“PRD 未定义接口级契约/此处为接口设计推导”；不得猜测或编造行号、页码。
- `x-internal-note` 是 OpenAPI 扩展字段，不是私密字段；工具或 YApi 可能保留或显示它，也可能不渲染 Markdown 链接，不能承诺导入后隐藏或可点击。需要发布纯契约稿时，按用户要求另行移除该扩展。
- 路径或字段尚未确认时，在内部核对文档记录状态和候选方案。只有用户需要评审候选契约时才把候选接口放进 OpenAPI 草案；其描述仍写候选接口预期提供的业务行为，确认状态留在内部文档。
- `x-change` / `x-change-note` 是按需提供的差异审阅元数据，不替代接口描述；内部状态说明使用配套核对文档或用户指定的 `x-internal-note`。

## 输出硬性约束
1. 只输出**纯 JSON**，不要 Markdown 代码块、不要注释、不要多余文字。
2. 顶层必须且仅包含：`openapi`、`info`、`servers`、`tags`、`paths`、`components`。
3. `openapi` 固定为 `"3.0.3"`。
4. 请求体、响应体**只写 schema，不写 example / examples**。
5. **每个字段一行一个**：字段名 + 其完整 schema 对象必须在同一行。
6. `components.responses` 统一定义（仅在用户明确要求错误响应时才在 paths 中引用，默认不引用）：
   - `BadRequest` → 400
   - `Unauthorized` → 401
   - `Forbidden` → 403
   - `NotFound` → 404
   - `ServerError` → 500
6.1. **paths 中每个 operation 的 responses 默认只写 200 成功响应**，不引用错误响应。
7. `refs` 模式下 `components.schemas` 至少定义：
   - `ApiResponse`
   - `ErrorResponse`
   - `PageMeta`
   - `UserSummary`
   - 业务嵌套结构（按需）
   `inline` 模式将 Schema 写在接口使用位置，`components.schemas` 可为空对象。
8. `components.securitySchemes` 定义 `BearerAuth`：`type=http`、`scheme=bearer`、`bearerFormat=JWT`。
9. `refs` 模式下通用结构用 `$ref` 引用；`inline` 模式下展开结构且禁止 `$ref`。
10. 字段级变更使用：
    - `x-change: added | removed | changed | rule-changed`
    - `x-change-note: "<一句话说明>"`
11. 字段在业务契约中存在明确枚举值时，必须在对应 schema 中使用 `enum` 列出所有允许值；枚举值的类型必须与字段 `type` 一致。
11.1. 每个业务枚举字段都在 `description` 中标注“枚举值由后端根据字典补充”，确保 YApi 等文档工具可显示；不要用自定义 `x-enum-note` 代替可见说明。已由 PRD/YApi 明确的值仍列在 `enum` 中，未明确的值不得猜测。若枚举值尚未确认或缺失，省略 `enum` 并保留字典补充说明。HTTP 方法等协议固定值不属于业务字典枚举，应在说明中标注为固定协议值。
12. `refs` 模式下所有 `$ref` 必须能在 `components` 中找到；`inline` 模式下全文件不得出现 `$ref`。

## 生成流程
1. 解析业务实体，列出请求/响应字段，并把接口契约事实与内部核对信息分开记录；PRD 已提供时，为每个 operation 建立到具体需求小节/字段/表格行的映射，并核实位置。
2. 为每个字段标注 type/description 及 x-change；契约明确枚举取值时添加 `enum`；只有前端契约明确要求必传时才添加 `"required": true`。
3. 按输出模式复用 `components.responses` 与 `components.schemas`，或将结构完整展开到接口使用位置。
4. 组装 paths，每个 operation 的 responses 默认只写 200 成功响应；仅当用户明确要求错误响应时才添加到对应 operation，`refs` 模式引用 `components.responses`，`inline` 模式直接内联响应 Schema。
5. 自检：顶层键、模式对应的 `$ref` 规则、无 example、字段一行一个、responses 默认仅 200，并检查 OpenAPI 描述不含内部核对状态或推导过程。

## 字段书写细则（核心）
- **每个字段占且仅占一行**，字段名与其 schema 对象写在同一行：
  `"id": { "type": "string", "description": "用户ID", "required": true },`
- 字段内保留：`type`、`description`，以及变更时的 `x-change` / `x-change-note`；只有前端明确要求必传时才添加 `required: true`。
- 字段存在明确枚举时，在该字段 schema 对象内增加 `enum`，完整列出契约允许值；字符串枚举写字符串值，整数枚举写整数值等，保证枚举项类型与字段 `type` 一致。描述中的示例值、未经确认的候选值不能据此推断为枚举。
- 每个已列出 `enum` 的业务字段，在 `description` 中增加“枚举值由后端根据字典补充”；PRD/YApi 已知枚举照常列出，后端字典未确认的取值不自行推断。尚未列出取值的枚举字段，在 `description` 中保留该说明，不添加自定义扩展字段代替可见说明。
- 一行内多个键用 `, ` 分隔，行尾按 JSON 语法加 `,` 或省略。
- **不拆分字段对象到多行**。
- **不使用**对象级 `required` 数组。
- `refs` 模式的 `$ref` 用法：
  - 错误响应：`"$ref": "#/components/responses/BadRequest"`
  - 通用 Schema：`"$ref": "#/components/schemas/ApiResponse"`
  - 安全方案：`"security": [{ "BearerAuth": [] }]`

## required 规则
- 仅当前端契约明确要求字段必传时，在字段对象内部写 `"required": true`。
- 前端类型、校验或请求组装未明确要求必传时，省略 `required`；禁止写 `"required": false`。
- 不得仅凭字段有值、后端 DTO 或 OpenAPI 通用惯例推断字段必传；无法确认时省略并记录待确认点。
- 不使用对象级 `required` 数组。

## x-change 语义与省略规则
- `added`：新增字段
- `removed`：删除字段
- `changed`：类型/名称变更
- `rule-changed`：校验规则变更

**省略规则：**
- 无变更时不写 `x-change` 与 `x-change-note`。
- 仅当变更时写 `x-change`，且必须同时写 `x-change-note`。
- `x-change` / `x-change-note` 是差异审阅标记，不是接口字段。删除字段应记录在差异清单，不要在最终目标 Schema 中保留带 `x-change: removed` 的字段；同步到 YApi 前也不得把这些标记写成请求/响应字段。

## 禁止项
- 禁止 example / examples
- 禁止 YAML
- 禁止顶层出现第 7 个键
- `refs` 模式禁止无 `$ref` 可达性保障
- `inline` 模式禁止出现任何 `$ref`（包括组件响应和递归结构）
- 禁止对象级 `required` 数组
- 禁止把字段对象拆成多行
- 禁止对无变更字段写 `x-change` / `x-change-note`
- 禁止遗漏契约中明确存在的字段枚举或使用与字段类型不一致的枚举值

## 自检清单
- [ ] openapi = 3.0.3
- [ ] 顶层仅 6 个键
- [ ] 无 example/examples
- [ ] 错误响应 5 个齐全（仅存于 components.responses，默认不在 paths 引用）
- [ ] paths 中每个 operation 的 responses 默认只有 200
- [ ] BearerAuth 存在且为 JWT
- [ ] 仅前端明确必传的字段写 `required: true`；其他字段不写 `required`，无 `required: false`
- [ ] 每个字段占一行（字段名与 schema 同行）
- [ ] OpenAPI 描述只说明接口契约；PRD/YApi 证据、候选状态、待确认项和方案讨论不混入 `description`
- [ ] PRD 已提供时，每个 operation 的 `x-internal-note` 都关联到已核实的 PRD 位置；若可行，附相对 Markdown 链接与行锚点，并保留章节名/行号文本兜底
- [ ] PRD 未定义独立接口时，`x-internal-note` 指向相关业务需求并明确标为接口设计推导；无精确来源时不编造定位
- [ ] 无对象级 required 数组
- [ ] 仅变更字段带 x-change / x-change-note
- [ ] 写了 x-change 的字段必有 x-change-note
- [ ] 契约明确有枚举的字段均使用 enum 完整列出允许值，且值类型与字段 type 一致
- [ ] 已列出 `enum` 的业务字段在 `description` 中标注由后端按字典补充；未列出枚举值的字段也保留该说明；协议固定值注明为非业务字典枚举
- [ ] `refs` 模式下所有 `$ref` 可解析；`inline` 模式下全文无 `$ref`

## 基础骨架（可直接作为起点）
```json
{
  "openapi": "3.0.3",
  "info": { "title": "API", "version": "1.0.0", "description": "OpenAPI 3.0.3 基础模板" },
  "servers": [
    { "url": "https://api.example.com", "description": "生产环境" }
  ],
  "tags": [
    { "name": "User", "description": "用户相关接口" }
  ],
  "paths": {},
  "components": {
    "securitySchemes": {
      "BearerAuth": { "type": "http", "scheme": "bearer", "bearerFormat": "JWT", "description": "JWT 认证" }
    },
    "responses": {
      "BadRequest": { "description": "请求参数错误", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" } } } },
      "Unauthorized": { "description": "未认证", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" } } } },
      "Forbidden": { "description": "无权限", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" } } } },
      "NotFound": { "description": "资源不存在", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" } } } },
      "ServerError": { "description": "服务器内部错误", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" } } } }
    },
    "schemas": {
      "ApiResponse": {
        "type": "object",
        "description": "通用响应结构",
        "properties": {
          "code": { "type": "integer", "description": "业务状态码" },
          "message": { "type": "string", "description": "提示信息" },
          "data": { "type": "object", "description": "业务数据", "nullable": true }
        }
      },
      "ErrorResponse": {
        "type": "object",
        "description": "错误响应结构",
        "properties": {
          "code": { "type": "integer", "description": "错误码" },
          "message": { "type": "string", "description": "错误信息" },
          "traceId": { "type": "string", "description": "链路追踪ID", "x-change": "added", "x-change-note": "新增链路追踪ID便于排查" }
        }
      },
      "PageMeta": {
        "type": "object",
        "description": "分页元信息",
        "properties": {
          "page": { "type": "integer", "description": "当前页码" },
          "pageSize": { "type": "integer", "description": "每页数量" },
          "total": { "type": "integer", "description": "总条数" }
        }
      },
      "UserSummary": {
        "type": "object",
        "description": "用户摘要",
        "properties": {
          "id": { "type": "string", "description": "用户ID" },
          "name": { "type": "string", "description": "用户名" },
          "email": { "type": "string", "description": "邮箱", "x-change": "changed", "x-change-note": "新增邮箱格式校验" }
        }
      }
    }
  }
}
```
