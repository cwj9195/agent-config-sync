/**
 * REST v1 优先、Legacy 兜底的禅道 API 适配器。
 */
import { ZentaoConfig } from './config.js';
import { ZentaoLegacyAPI } from './zentaoLegacyApi.js';
import { Bug, BugResolution, BugUpdate, CreateTaskRequest, Task, TaskUpdate } from './types.js';
/**
 * REST v1 优先、Legacy 兜底的完整禅道 API。
 */
export declare class ZentaoRestV1API extends ZentaoLegacyAPI {
    /** REST v1 客户端。 */
    private readonly restV1;
    /**
     * 初始化双通道 API。
     * @param config 禅道连接配置
     */
    constructor(config: ZentaoConfig);
    /**
     * REST v1 读取失败时回退 Legacy 读取。
     * @param label 操作名称
     * @param restReader REST v1 读取函数
     * @param legacyReader Legacy 读取函数
     * @returns 首个成功读取结果
     */
    private readWithFallback;
    /**
     * REST v1 优先读取 Bug 详情。
     * @param bugId Bug ID
     * @returns Bug 详情
     */
    getBugDetail(bugId: number): Promise<Bug>;
    /**
     * REST v1 优先读取任务详情。
     * @param taskId 任务 ID
     * @returns 任务详情
     */
    getTaskDetail(taskId: number): Promise<Task>;
    /**
     * REST v1 优先创建任务，明确未实现时回退 Legacy 创建。
     * @param request 创建任务字段
     * @returns 已回读任务详情
     */
    createTask(request: CreateTaskRequest): Promise<Task>;
    /**
     * REST v1 优先更新 Bug，路由不兼容时回退 Legacy。
     * @param bugId Bug ID
     * @param update 更新字段
     * @returns 已回读 Bug 详情
     */
    updateBug(bugId: number, update: BugUpdate): Promise<Bug>;
    /**
     * REST v1 优先解决 Bug，路由不兼容时回退 Legacy。
     * @param bugId Bug ID
     * @param resolution 解决字段
     */
    resolveBug(bugId: number, resolution: BugResolution): Promise<void>;
    /**
     * REST v1 优先更新任务，路由不兼容时回退 Legacy。
     * @param taskId 任务 ID
     * @param update 更新字段
     * @returns 已回读任务详情
     */
    updateTask(taskId: number, update: TaskUpdate): Promise<Task>;
    /**
     * REST v1 优先完成任务，路由不兼容时回退 Legacy。
     * @param taskId 任务 ID
     * @param update 完成字段
     */
    finishTask(taskId: number, update: TaskUpdate): Promise<void>;
}
