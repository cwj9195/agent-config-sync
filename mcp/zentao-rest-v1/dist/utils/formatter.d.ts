/**
 * 格式化工具函数
 * 用于将需求、Bug、任务等格式化为 Markdown 或其他格式
 */
import { Story, Bug, Task } from '../types.js';
/**
 * 格式化需求为 Markdown
 */
export declare function formatStoryAsMarkdown(story: Story): string;
/**
 * 格式化 Bug 为 Markdown
 */
export declare function formatBugAsMarkdown(bug: Bug): string;
/**
 * 格式化任务为 Markdown
 */
export declare function formatTaskAsMarkdown(task: Task): string;
/**
 * 生成需求摘要
 */
export declare function generateStorySummary(story: Story): string;
/**
 * 生成 Bug 摘要
 */
export declare function generateBugSummary(bug: Bug): string;
