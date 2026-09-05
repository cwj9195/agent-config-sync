/**
 * 智能分析工具
 * 用于分析需求复杂度、Bug 优先级等
 */

import { Story, Bug, Task } from '../types.js';

export interface ComplexityAnalysis {
    score: number; // 1-10 复杂度评分
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
    score: number; // 1-10 优先级评分
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
export function analyzeStoryComplexity(
    story: Story,
    relatedBugsCount: number = 0,
    testCasesCount: number = 0
): ComplexityAnalysis {
    let score = 0;
    const factors: ComplexityAnalysis['factors'] = {
        descriptionLength: 0,
        hasImages: false,
        relatedBugsCount,
        testCasesCount
    };

    // 描述长度分析
    if (story.spec) {
        factors.descriptionLength = story.spec.length;
        if (story.spec.length > 1000) {
            score += 3;
        } else if (story.spec.length > 500) {
            score += 2;
        } else if (story.spec.length > 200) {
            score += 1;
        }
    }

    // 图片分析（有图片通常意味着更复杂的需求）
    if (story.spec && story.spec.includes('<img')) {
        factors.hasImages = true;
        score += 1;
    }

    // 关联 Bug 数量（Bug 多可能意味着需求复杂）
    factors.relatedBugsCount = relatedBugsCount;
    if (relatedBugsCount > 5) {
        score += 2;
    } else if (relatedBugsCount > 2) {
        score += 1;
    }

    // 测试用例数量（测试用例多可能意味着功能复杂）
    factors.testCasesCount = testCasesCount;
    if (testCasesCount > 10) {
        score += 2;
    } else if (testCasesCount > 5) {
        score += 1;
    }

    // 优先级影响
    if (story.pri === 1) {
        score += 1; // 高优先级需求可能更复杂
    }

    // 确保分数在 1-10 范围内
    score = Math.max(1, Math.min(10, score));

    // 估算工时（基于复杂度）
    let estimatedHours: number | undefined;
    if (score <= 3) {
        estimatedHours = 2; // 简单需求
    } else if (score <= 6) {
        estimatedHours = 4; // 中等需求
    } else if (score <= 8) {
        estimatedHours = 8; // 复杂需求
    } else {
        estimatedHours = 16; // 非常复杂的需求
    }

    // 优先级建议
    let prioritySuggestion: 'low' | 'medium' | 'high';
    if (score <= 3) {
        prioritySuggestion = 'low';
    } else if (score <= 6) {
        prioritySuggestion = 'medium';
    } else {
        prioritySuggestion = 'high';
    }

    return {
        score,
        factors,
        estimatedHours,
        prioritySuggestion
    };
}

/**
 * 分析 Bug 优先级
 */
export function analyzeBugPriority(bug: Bug, hasRelatedStory: boolean = false): PriorityAnalysis {
    let score = 0;
    const factors: PriorityAnalysis['factors'] = {
        severity: bug.severity || 0,
        hasRelatedStory,
        status: bug.status || ''
    };

    // 严重程度分析
    factors.severity = bug.severity || 0;
    if (bug.severity === 1) {
        score += 4; // 致命 Bug
    } else if (bug.severity === 2) {
        score += 3; // 严重 Bug
    } else if (bug.severity === 3) {
        score += 2; // 一般 Bug
    } else {
        score += 1; // 轻微 Bug
    }

    // 状态分析
    if (bug.status === 'active') {
        score += 2; // 激活状态的 Bug 需要优先处理
    } else if (bug.status === 'resolved') {
        score -= 1; // 已解决的 Bug 优先级降低
    }

    // 关联需求分析
    factors.hasRelatedStory = hasRelatedStory;
    if (hasRelatedStory) {
        score += 1; // 有关联需求的 Bug 可能需要优先处理
    }

    // 确保分数在 1-10 范围内
    score = Math.max(1, Math.min(10, score));

    // 优先级建议
    let suggestion: 'low' | 'medium' | 'high' | 'urgent';
    if (score <= 3) {
        suggestion = 'low';
    } else if (score <= 5) {
        suggestion = 'medium';
    } else if (score <= 7) {
        suggestion = 'high';
    } else {
        suggestion = 'urgent';
    }

    return {
        score,
        factors,
        suggestion
    };
}

/**
 * 分析任务工作量
 */
export function analyzeTaskWorkload(task: Task): {
    estimatedHours: number;
    difficulty: 'easy' | 'medium' | 'hard';
    factors: {
        descriptionLength: number;
        priority: number;
        hasDeadline: boolean;
    };
} {
    const factors = {
        descriptionLength: task.desc?.length || 0,
        priority: task.pri || 0,
        hasDeadline: !!task.deadline
    };

    let estimatedHours = 2; // 默认 2 小时

    // 描述长度影响
    if (factors.descriptionLength > 500) {
        estimatedHours += 2;
    } else if (factors.descriptionLength > 200) {
        estimatedHours += 1;
    }

    // 优先级影响（高优先级任务可能需要更多时间）
    if (factors.priority === 1) {
        estimatedHours += 1;
    }

    // 难度评估
    let difficulty: 'easy' | 'medium' | 'hard';
    if (estimatedHours <= 2) {
        difficulty = 'easy';
    } else if (estimatedHours <= 4) {
        difficulty = 'medium';
    } else {
        difficulty = 'hard';
    }

    return {
        estimatedHours,
        difficulty,
        factors
    };
}

