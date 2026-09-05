/**
 * 智能分析工具
 * 用于分析需求复杂度、Bug 优先级等
 */
import { Story, Bug, Task } from '../types.js';
export interface ComplexityAnalysis {
    score: number;
    factors: {
        descriptionLength: number;
        hasImages: boolean;
        relatedBugsCount: number;
        testCasesCount: number;
    };
    estimatedHours?: number;
    prioritySuggestion: 'low' | 'medium' | 'high';
}
export interface PriorityAnalysis {
    score: number;
    factors: {
        severity: number;
        hasRelatedStory: boolean;
        status: string;
    };
    suggestion: 'low' | 'medium' | 'high' | 'urgent';
}
/**
 * 分析需求复杂度
 */
export declare function analyzeStoryComplexity(story: Story, relatedBugsCount?: number, testCasesCount?: number): ComplexityAnalysis;
/**
 * 分析 Bug 优先级
 */
export declare function analyzeBugPriority(bug: Bug, hasRelatedStory?: boolean): PriorityAnalysis;
/**
 * 分析任务工作量
 */
export declare function analyzeTaskWorkload(task: Task): {
    estimatedHours: number;
    difficulty: 'easy' | 'medium' | 'hard';
    factors: {
        descriptionLength: number;
        priority: number;
        hasDeadline: boolean;
    };
};
