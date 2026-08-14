/**
 * 格式化工具函数
 * 用于将需求、Bug、任务等格式化为 Markdown 或其他格式
 */
/**
 * 格式化需求为 Markdown
 */
export function formatStoryAsMarkdown(story) {
    const lines = [];
    lines.push(`# 需求 #${story.id}: ${story.title}`);
    lines.push('');
    if (story.productName) {
        lines.push(`**产品**: ${story.productName}`);
    }
    if (story.moduleName) {
        lines.push(`**模块**: ${story.moduleName}`);
    }
    if (story.status) {
        lines.push(`**状态**: ${story.status}`);
    }
    if (story.pri) {
        lines.push(`**优先级**: ${story.pri}`);
    }
    if (story.stage) {
        lines.push(`**阶段**: ${story.stage}`);
    }
    if (story.estimate) {
        lines.push(`**预估工时**: ${story.estimate} 小时`);
    }
    if (story.assignedTo) {
        lines.push(`**指派给**: ${story.assignedTo}`);
    }
    if (story.openedBy) {
        lines.push(`**创建人**: ${story.openedBy}`);
    }
    if (story.openedDate) {
        lines.push(`**创建时间**: ${story.openedDate}`);
    }
    lines.push('');
    lines.push('## 需求描述');
    lines.push('');
    if (story.spec) {
        lines.push(story.spec);
    }
    else {
        lines.push('*暂无描述*');
    }
    return lines.join('\n');
}
/**
 * 格式化 Bug 为 Markdown
 */
export function formatBugAsMarkdown(bug) {
    const lines = [];
    lines.push(`# Bug #${bug.id}: ${bug.title}`);
    lines.push('');
    if (bug.productName) {
        lines.push(`**产品**: ${bug.productName}`);
    }
    if (bug.status) {
        lines.push(`**状态**: ${bug.status}`);
    }
    if (bug.severity) {
        lines.push(`**严重程度**: ${bug.severity}`);
    }
    if (bug.openedDate) {
        lines.push(`**创建时间**: ${bug.openedDate}`);
    }
    if (bug.story) {
        lines.push(`**关联需求**: #${bug.story}`);
    }
    lines.push('');
    lines.push('## 复现步骤');
    lines.push('');
    if (bug.steps) {
        lines.push(bug.steps);
    }
    else {
        lines.push('*暂无复现步骤*');
    }
    return lines.join('\n');
}
/**
 * 格式化任务为 Markdown
 */
export function formatTaskAsMarkdown(task) {
    const lines = [];
    lines.push(`# 任务 #${task.id}: ${task.name}`);
    lines.push('');
    lines.push(`**状态**: ${task.status}`);
    lines.push(`**优先级**: ${task.pri}`);
    if (task.deadline) {
        lines.push(`**截止日期**: ${task.deadline}`);
    }
    if (task.story) {
        lines.push(`**关联需求**: #${task.story}`);
    }
    if (task.product) {
        lines.push(`**产品**: #${task.product}`);
    }
    lines.push('');
    lines.push('## 任务描述');
    lines.push('');
    if (task.desc) {
        lines.push(task.desc);
    }
    else {
        lines.push('*暂无描述*');
    }
    return lines.join('\n');
}
/**
 * 生成需求摘要
 */
export function generateStorySummary(story) {
    const parts = [];
    parts.push(`需求 #${story.id}: ${story.title}`);
    if (story.status) {
        parts.push(`状态: ${story.status}`);
    }
    if (story.pri) {
        parts.push(`优先级: ${story.pri}`);
    }
    if (story.productName) {
        parts.push(`产品: ${story.productName}`);
    }
    if (story.spec) {
        const specPreview = story.spec.length > 100
            ? story.spec.substring(0, 100) + '...'
            : story.spec;
        parts.push(`描述: ${specPreview}`);
    }
    return parts.join(' | ');
}
/**
 * 生成 Bug 摘要
 */
export function generateBugSummary(bug) {
    const parts = [];
    parts.push(`Bug #${bug.id}: ${bug.title}`);
    if (bug.status) {
        parts.push(`状态: ${bug.status}`);
    }
    if (bug.severity) {
        parts.push(`严重程度: ${bug.severity}`);
    }
    if (bug.productName) {
        parts.push(`产品: ${bug.productName}`);
    }
    if (bug.steps) {
        const stepsPreview = bug.steps.length > 100
            ? bug.steps.substring(0, 100) + '...'
            : bug.steps;
        parts.push(`复现步骤: ${stepsPreview}`);
    }
    return parts.join(' | ');
}
