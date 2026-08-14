#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
bad_total=0
old_terms=("R""EQ" "F""IELD" "R""ULE" "F""LOW" "S""TATE" "P""ERM" "A""PIHINT" "R""N" "P""ASS" "F""AIL" "B""locked" "V""erified" "F""allback" "U""nverified")
old_pattern="$(IFS='|'; echo "${old_terms[*]}")"
old_human_1="Review"" Notes"
old_human_2="UI"" Source"
old_file_refs="requirements\\.md|ui\\.md|prototype\\.md|review-notes\\.md"
old_anchors="ui-evidence|prototype-flow|review-notes|api-hints|gate-checklist|fields-permissions"
allowed_status="通过|失败|阻塞|已验证|未验证|降级证据|待确认"
mastergo_pattern="mastergo://|mastergo\\.com|\\.mastergo\\.com|/goto/|getd2c|D2C"

fail() {
  local message="$1"
  echo "  失败: $message"
  bad_total=$((bad_total + 1))
}

if [[ ! -d "$ROOT" ]]; then
  echo "目录不存在: $ROOT"
  exit 2
fi

echo "开始校验模块拆分产物: $ROOT"

has_mastergo_link=0
mastergo_structured_ready=0
mastergo_blocked_report=0
mastergo_degrade_confirmed=0
if [[ -f "$ROOT/sources/PRD.md" ]] && grep -Eiq "$mastergo_pattern" "$ROOT/sources/PRD.md"; then
  has_mastergo_link=1
fi
if [[ -f "$ROOT/module-index.md" ]] && grep -Eiq "$mastergo_pattern" "$ROOT/module-index.md"; then
  has_mastergo_link=1
fi
if find "$ROOT" -path '*/sources/mastergo/*.dsl.json' -type f | grep -q .; then
  mastergo_structured_ready=1
fi

if find "$ROOT" -mindepth 2 -maxdepth 2 -name '_gate.json' | grep -q .; then
  echo "检查: 旧检查文件"
  while IFS= read -r gate_file; do
    fail "发现旧 _gate.json，需求拆分新产物必须把模块检查写入 module.md: $gate_file"
  done < <(find "$ROOT" -mindepth 2 -maxdepth 2 -name '_gate.json' | sort)
fi

index_file="$ROOT/module-index.md"
if [[ ! -f "$index_file" ]]; then
  echo "检查: module-index.md"
  fail "缺少 module-index.md"
else
  echo "检查: module-index.md"
  if grep -Eq "\\b(${old_pattern})\\b|${old_human_1}|${old_human_2}|${old_anchors}|${old_file_refs}|_gate\\.json" "$index_file"; then
    fail "module-index.md 存在旧英文标签、旧锚点、旧四件套或 _gate.json 引用"
  fi
  if grep -Eq 'API-[A-Za-z0-9-]+' "$index_file"; then
    fail "module-index.md 存在机器接口别名，需求拆分产物不得使用 API-Mx-xxx"
  fi
  if ! grep -Eq '^#{2,4}[[:space:]]*数据源检查[[:space:]]*$' "$index_file"; then
    fail "module-index.md 缺少数据源检查段"
  fi
  if [[ "$has_mastergo_link" -eq 1 ]]; then
    data_source_section="$(
      awk '
        /^#{2,4}[[:space:]]*数据源检查[[:space:]]*$/ {in_section=1; next}
        /^#{1,4}[[:space:]]+/ && in_section {exit}
        in_section {print}
      ' "$index_file"
    )"
    if [[ -z "$data_source_section" ]]; then
      fail "存在 MasterGo 链接但数据源检查段为空"
    elif ! grep -Eq 'MasterGo|DSL|D2C|MCP|阻塞|降级证据|已验证|未验证' <<<"$data_source_section"; then
      fail "存在 MasterGo 链接但数据源检查未登记 MasterGo 状态"
    fi
    mastergo_audit="$(
      python3 - "$ROOT" <<'PY'
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1])
prd = root / 'sources' / 'PRD.md'
index = root / 'module-index.md'
link_re = re.compile(
    r'(?:https?://[^\s\]\)|<>，,；;]+(?:mastergo\.com|/goto/)[^\s\]\)|<>，,；;]*)'
    r'|(?:mastergo://[^\s\]\)|<>，,；;]+)'
    r'|(?:getd2c/[A-Za-z0-9._:/-]+)'
    r'|(?:D2C[:：]?\s*[A-Za-z0-9._:/-]+)',
    re.IGNORECASE,
)

def read(path):
    return path.read_text(encoding='utf-8') if path.exists() else ''

def normalize(value):
    return value.strip().strip('.,;，。；、)]）')

def extract_links(text):
    return sorted({normalize(m.group(0)) for m in link_re.finditer(text) if normalize(m.group(0))})

def extract_section(text):
    lines = text.splitlines()
    captured = []
    in_section = False
    for line in lines:
        if re.match(r'^#{2,4}\s*数据源检查\s*$', line):
            in_section = True
            continue
        if in_section and re.match(r'^#{1,4}\s+', line):
            break
        if in_section:
            captured.append(line)
    return '\n'.join(captured)

links = extract_links(read(prd) + '\n' + read(index))
section = extract_section(read(index))
errors = []
verified_count = 0
blocked = False
degrade_confirmed = '用户确认降级' in section

def file_exists(ref):
    candidate = root / ref
    if candidate.exists():
        return True
    basename = pathlib.Path(ref).name
    return any(p.name == basename for p in root.glob('**/sources/mastergo/*.dsl.json'))

for link in links:
    row = next((line for line in section.splitlines() if link in line), '')
    if not row:
        errors.append(f'MasterGo/D2C 链接未逐条登记到数据源检查: {link}')
        continue
    refs = re.findall(r'(?:[\w./-]+)?sources/mastergo/[^\]\)\s|]+\.dsl\.json', row)
    status_verified = '已验证' in row or re.search(r'\|\s*通过\s*\|', row)
    status_blocked = '阻塞' in row
    status_degraded = '降级证据' in row or '未验证' in row
    if status_verified:
        if not refs:
            errors.append(f'已验证的 MasterGo/D2C 链接缺少落盘 DSL: {link}')
        elif not all(file_exists(ref) for ref in refs):
            errors.append(f'MasterGo/D2C 链接登记的 DSL 文件不存在: {link}')
        else:
            verified_count += 1
    elif status_blocked:
        blocked = True
    elif status_degraded:
        if not degrade_confirmed:
            errors.append(f'MasterGo/D2C 链接降级缺少用户确认降级: {link}')
    else:
        errors.append(f'MasterGo/D2C 链接状态不明确: {link}')

if links and verified_count == len(links):
    print('FLAG:all_ready=1')
else:
    print('FLAG:all_ready=0')
print(f'FLAG:blocked_report={1 if blocked else 0}')
print(f'FLAG:degrade_confirmed={1 if degrade_confirmed else 0}')
for error in errors:
    print(f'ERR:{error}')
PY
    )"
    while IFS= read -r audit_line; do
      case "$audit_line" in
        FLAG:all_ready=1) mastergo_structured_ready=1 ;;
        FLAG:all_ready=0) mastergo_structured_ready=0 ;;
        FLAG:blocked_report=1) mastergo_blocked_report=1 ;;
        FLAG:degrade_confirmed=1) mastergo_degrade_confirmed=1 ;;
        ERR:*) fail "${audit_line#ERR:}" ;;
      esac
    done <<< "$mastergo_audit"
    if [[ "$mastergo_structured_ready" -eq 0 ]] && [[ "$mastergo_degrade_confirmed" -eq 0 ]] && grep -Eq '最终结论[[:space:]]*\|[[:space:]]*通过|通过[[:space:]]*\|[[:space:]]*最终结论' <<<"$data_source_section"; then
      fail "存在 MasterGo 链接但未全部落盘 DSL，且无用户确认降级，数据源检查最终结论不得写通过"
    fi
  fi
fi

if [[ "$has_mastergo_link" -eq 1 ]]; then
  if [[ "$mastergo_structured_ready" -eq 0 ]]; then
    if [[ "$mastergo_blocked_report" -eq 1 ]] || [[ "$mastergo_degrade_confirmed" -eq 1 ]]; then
      echo "检查: MasterGo 数据源"
      echo "  结论: 阻塞或用户确认降级已登记"
    else
      echo "检查: MasterGo 数据源"
      fail "存在 MasterGo 链接但未发现 sources/mastergo/*.dsl.json，且未登记阻塞/降级"
    fi
  fi
fi

module_count=0
while IFS= read -r module_file; do
  module_count=$((module_count + 1))
  module_dir="$(dirname "$module_file")"
  module_name="$(basename "$module_dir")"
  module_bad=0

  echo "检查: $module_name"

  record_bad() {
    local message="$1"
    echo "  失败: $message"
    module_bad=$((module_bad + 1))
  }

  if grep -Eq "\\b(${old_pattern})\\b|${old_human_1}|${old_human_2}|${old_anchors}|${old_file_refs}|_gate\\.json" "$module_file"; then
    record_bad "存在旧英文标签、旧锚点、旧四件套或 _gate.json 引用"
  fi

  if grep -Eq 'API-[A-Za-z0-9-]+' "$module_file"; then
    record_bad "存在机器接口别名，需求拆分 module.md 不得使用 API-Mx-xxx"
  fi

  if ! grep -Eq '^#{2,4}[[:space:]]*模块检查[[:space:]]*$' "$module_file"; then
    record_bad "缺少模块检查段"
  else
    check_section="$(
      awk '
        /^#{2,4}[[:space:]]*模块检查[[:space:]]*$/ {in_section=1; next}
        /^#{1,4}[[:space:]]+/ && in_section {exit}
        in_section {print}
      ' "$module_file"
    )"
    if ! grep -Eq "(${allowed_status})" <<<"$check_section"; then
      record_bad "模块检查段缺少中文状态"
    fi
    for required_label in "证据完整性" "字段完整性" "界面证据" "接口线索" "审查记录" "最终结论"; do
      if ! grep -q "$required_label" <<<"$check_section"; then
        record_bad "模块检查段缺少 $required_label"
      fi
    done
    if [[ "$has_mastergo_link" -eq 1 ]] && [[ "$mastergo_structured_ready" -eq 0 ]]; then
      if grep -Eq '界面证据[[:space:]]*\|[[:space:]]*(通过|已验证)' <<<"$check_section"; then
        record_bad "存在 MasterGo 链接但未落盘 DSL，界面证据不得写通过或已验证"
      fi
    fi
  fi

  if grep -Eq '\|[[:space:]]*字段-M[0-9]+-[0-9]+[[:space:]]*\|[[:space:]]*字段[[:space:]]*\|[[:space:]]*(\*\*字段名称\*\*|\*\*展示内容\*\*|\*\*展示规则\*\*|:---|[0-9]+)[[:space:]]*\|' "$module_file"; then
    record_bad "字段列表疑似混入表头或分隔符"
  fi

  short_needs="$(awk -F'|' '/\|[[:space:]]*需求-M[0-9]+-[0-9]+/ {gsub(/^ +| +$/, "", $4); if (length($4) <= 10) count++} END {print count + 0}' "$module_file")"
  if [[ "${short_needs:-0}" -gt 0 ]]; then
    record_bad "存在疑似标题搬运的短需求 $short_needs 条"
  fi

  if grep -Eq '\|[[:space:]]*规则-M[0-9]+-[0-9]+.*(<img|<font|<br|/>)' "$module_file"; then
    record_bad "规则中存在 HTML 碎片"
  fi

  if grep -Eq '模块特有：PRD中[0-9]+个子章节|参数替换模板' "$module_file"; then
    record_bad "审查记录疑似模板化"
  fi

  # 项目启发式检查：用于捕捉 PIM 当前产物中高频的接口线索错配，不代表通用完整检查。
  if echo "$module_name" | grep -q '钉钉' && grep -q '接口线索.*批量导入' "$module_file"; then
    record_bad "项目启发式检查: 钉钉通知模块出现不相关导入接口线索"
  fi

  # 项目启发式检查：用于捕捉 PIM 当前产物中高频的接口线索错配，不代表通用完整检查。
  if echo "$module_name" | grep -q '推送' && grep -q '接口线索.*列表查询' "$module_file"; then
    record_bad "项目启发式检查: 推送模块出现泛化列表查询接口线索"
  fi

  dsl_missing="$(
    python3 - "$module_file" <<'PY'
import pathlib
import re
import sys

module = pathlib.Path(sys.argv[1])
text = module.read_text(encoding='utf-8')
lines = text.splitlines()
candidate_lines = [
    line for line in lines
    if '已验证' in line and ('界面-' in line or 'sources/mastergo/' in line)
]
missing = []
for line in candidate_lines:
    refs = re.findall(r'sources/mastergo/([^\]\)\s|]+\.dsl\.json)', line)
    if not refs:
        missing.append('已验证界面缺少 DSL 文件链接')
        continue
    for ref in refs:
        if not (module.parent / 'sources' / 'mastergo' / ref).exists():
            missing.append(ref)
for item in missing:
    print(item)
PY
  )"
  if [[ -n "$dsl_missing" ]]; then
    record_bad "已验证 DSL 文件不存在或未链接: $dsl_missing"
  fi

  if [[ "$module_bad" -gt 0 ]]; then
    echo "  结论: 失败 ($module_bad)"
    bad_total=$((bad_total + module_bad))
  else
    echo "  结论: 通过"
  fi
done < <(find "$ROOT" -mindepth 2 -maxdepth 2 -name module.md | sort)

if [[ "$module_count" -eq 0 ]]; then
  if [[ "$has_mastergo_link" -eq 1 ]] && [[ "$mastergo_structured_ready" -eq 0 ]] && [[ "$mastergo_blocked_report" -eq 1 ]]; then
    echo "检查: 模块文件"
    echo "  结论: 数据源阻塞报告允许暂不生成 module.md"
  else
    fail "未发现任何模块 module.md"
  fi
fi

if [[ "$bad_total" -gt 0 ]]; then
  echo "总计失败项: $bad_total"
  exit 1
fi

echo "全部通过"
