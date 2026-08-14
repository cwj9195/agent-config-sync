/**
 * 操作建议工具
 * 根据当前上下文，建议下一步操作
 */
import { Story, Bug, Task } from '../types.js';
export interface NextActionSuggestion {
    action: string;
    description: string;
    tool?: string;
    toolArgs?: Record<string, any>;
    priority: 'high' | 'medium' | 'low';
}
/**
 * 根据需求上下文生成下一步建议
 */
export declare function suggestNextActionsForStory(story: Story, hasRelatedBugs: boolean, hasTestCases: boolean): NextActionSuggestion[];
/**
 * 根据 Bug 上下文生成下一步建议
 */
export declare function suggestNextActionsForBug(bug: Bug, hasRelatedStory: boolean, isActive: boolean): NextActionSuggestion[];
/**
 * 根据任务上下文生成下一步建议
 */
export declare function suggestNextActionsForTask(task: Task, isCompleted?: boolean): NextActionSuggestion[];
/**
 * 格式化建议为 Markdown
 */
export declare function formatSuggestionsAsMarkdown(suggestions: NextActionSuggestion[]): string;
