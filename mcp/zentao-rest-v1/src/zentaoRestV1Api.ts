/**
 * REST v1 优先、Legacy 兜底的禅道 API 适配器。
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ZentaoConfig } from './config.js';
import { ZentaoLegacyAPI } from './zentaoLegacyApi.js';
import { Bug, BugResolution, BugStatus, BugUpdate, CreateTaskRequest, Task, TaskStatus, TaskUpdate } from './types.js';

/**
 * REST v1 客户端内部使用的 JSON 记录类型。
 */
type RestRecord = Record<string, any>;

/**
 * 标记 REST v1 路由不兼容，允许安全地回退到 Legacy。
 */
class RestV1FallbackError extends Error {
    /** 是否允许在写入前回退到 Legacy。 */
    readonly safeToFallback: boolean;

    /**
     * 创建 REST v1 回退错误。
     * @param message 错误摘要
     * @param safeToFallback 是否确认没有发生业务写入
     */
    constructor(message: string, safeToFallback: boolean) {
        super(message);
        this.name = 'RestV1FallbackError';
        this.safeToFallback = safeToFallback;
    }
}

/**
 * REST v1 任务创建请求的服务端字段。
 */
interface RestV1CreateTaskBody {
    execution: number;
    name: string;
    type: string;
    assignedTo?: string;
    estStarted?: string;
    deadline?: string;
    pri?: number;
    estimate?: number;
    module?: number;
    story?: number;
    parent?: number;
    desc?: string;
}

/**
 * REST v1 认证和请求客户端。
 */
class RestV1Client {
    /** Axios 实例。 */
    private readonly client: AxiosInstance;
    /** 禅道账号。 */
    private readonly username: string;
    /** 禅道密码，仅保存在当前进程内。 */
    private readonly password: string;
    /** 本地缓存的 REST v1 Token。 */
    private token: string | null = null;
    /** Token 过期时间，服务端未返回过期时间时使用配置 TTL。 */
    private tokenExpiresAt = 0;
    /** 并发登录合并 Promise。 */
    private tokenPromise: Promise<string> | null = null;
    /** Token 本地缓存时长。 */
    private readonly tokenTtlMs: number;

    /**
     * 初始化 REST v1 客户端。
     * @param config 禅道连接配置
     */
    constructor(config: ZentaoConfig) {
        // 去掉末尾斜杠和误传的 API 后缀，保留部署目录例如 /zentao。
        const siteUrl = config.url.trim().replace(/\/+$/, '').replace(/\/api\.php\/v[12]$/i, '');
        // 创建固定指向 REST v1 的请求实例。
        this.client = axios.create({
            baseURL: `${siteUrl}/api.php/v1`,
            timeout: config.timeoutMs || 30000,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });
        // 保存认证信息到内存，禁止写入配置文件。
        this.username = config.username;
        this.password = config.password;
        // 复用现有会话 TTL，避免频繁请求 Token。
        this.tokenTtlMs = config.sessionTtlMs || 3000000;
    }

    /**
     * 判断 REST v1 Token 是否仍可复用。
     * @returns Token 是否有效
     */
    private hasValidToken(): boolean {
        return Boolean(this.token) && Date.now() < this.tokenExpiresAt;
    }

    /**
     * 清除本地 REST v1 Token。
     */
    private clearToken(): void {
        this.token = null;
        this.tokenExpiresAt = 0;
    }

    /**
     * 判断错误是否为认证失效。
     * @param error 请求错误
     * @returns 是否应重新获取 Token
     */
    private isAuthenticationError(error: unknown): boolean {
        if (!axios.isAxiosError(error)) return false;
        return [401, 403].includes(error.response?.status || 0);
    }

    /**
     * 判断服务端是否明确返回了不兼容的 API 路由。
     * @param error 请求错误
     * @returns 是否可以在写入前安全回退
     */
    private isSafeFallbackError(error: unknown): boolean {
        if (error instanceof RestV1FallbackError) return error.safeToFallback;
        if (axios.isAxiosError(error)) {
            return [404, 405, 501].includes(error.response?.status || 0);
        }
        return false;
    }

    /**
     * 获取 REST v1 Token。
     * @returns Token 字符串
     */
    private async getToken(): Promise<string> {
        if (this.hasValidToken()) return this.token as string;
        if (this.tokenPromise) return this.tokenPromise;

        // 合并并发登录请求，避免同一进程重复获取 Token。
        const promise = (async (): Promise<string> => {
            // 使用禅道 REST v1 官方认证接口。
            const response = await this.client.post('/tokens', {
                account: this.username,
                password: this.password,
            });
            // 读取直接返回的 Token，不记录或输出其内容。
            const token = response.data?.token;
            if (typeof token !== 'string' || !token) {
                throw new RestV1FallbackError('REST v1 登录未返回 Token', false);
            }
            // 缓存 Token 到当前进程。
            this.token = token;
            this.tokenExpiresAt = Date.now() + this.tokenTtlMs;
            return token;
        })();

        this.tokenPromise = promise;
        try {
            return await promise;
        } finally {
            // 只清理当前这一轮登录 Promise。
            if (this.tokenPromise === promise) this.tokenPromise = null;
        }
    }

    /**
     * 发起 REST v1 请求。
     * @param request Axios 请求配置
     * @param retryAuth 是否允许认证失效时重新获取一次 Token
     * @returns 服务端 JSON 数据
     */
    private async request<T>(request: AxiosRequestConfig, retryAuth = true): Promise<T> {
        // 获取当前请求使用的 Token。
        const token = await this.getToken();
        try {
            // 附加 REST v1 所需的 Token 请求头。
            const response = await this.client.request<T>({
                ...request,
                headers: {
                    ...request.headers,
                    Token: token,
                },
            });
            // HTML 致命错误或模块缺失不是有效业务响应，可安全回退。
            if (typeof response.data === 'string' && /<html|Fatal error|bugEntry|not found/i.test(response.data)) {
                throw new RestV1FallbackError('REST v1 服务端返回不兼容错误页', true);
            }
            // 统一识别 REST v1 的失败信封，避免把失败当成成功。
            const body = response.data as RestRecord;
            if (body?.status === 'fail' || body?.error) {
                throw new RestV1FallbackError('REST v1 服务端返回失败响应', false);
            }
            return response.data;
        } catch (error) {
            // 读取请求在认证失效时只重新认证一次。
            if (retryAuth && this.isAuthenticationError(error)) {
                this.clearToken();
                return this.request<T>(request, false);
            }
            throw error;
        }
    }

    /**
     * 从 REST v1 响应中读取对象 ID。
     * @param payload 服务端响应
     * @param field 对象字段名
     * @returns 正整数 ID
     */
    private getId(payload: unknown, field: string): number {
        // 兼容直接返回对象、data 嵌套和对象节点嵌套。
        const record = payload as RestRecord;
        const candidates = [record?.id, record?.[field], record?.data?.id, record?.data?.[field], record?.task?.id];
        // 依次尝试所有已知返回结构。
        for (const candidate of candidates) {
            const id = Number(candidate);
            if (Number.isInteger(id) && id > 0) return id;
        }
        // 缺少 ID 时必须阻断后续回读和成功判断。
        throw new Error(`REST v1 响应缺少 ${field} ID`);
    }

    /**
     * 读取 Bug 详情。
     * @param bugId Bug ID
     * @returns 标准化 Bug 详情
     */
    async getBugDetail(bugId: number): Promise<Bug> {
        // 获取 REST v1 直接返回的 Bug 对象。
        const data = await this.request<RestRecord>({ method: 'GET', url: `/bugs/${bugId}` });
        // 校验并转换 Bug ID。
        const id = Number(data.id);
        if (!Number.isInteger(id) || id <= 0) throw new Error(`REST v1 Bug ${bugId} 详情缺少 id`);
        // 映射 REST v1 字段到现有 MCP 的 Bug 类型。
        return {
            id,
            title: String(data.title || ''),
            status: String(data.status || 'active') as BugStatus,
            severity: Number(data.severity || 0),
            steps: String(data.steps || ''),
            openedDate: data.openedDate,
            story: data.story || undefined,
            product: data.product || undefined,
            productName: data.productName || undefined,
        };
    }

    /**
     * 读取任务详情。
     * @param taskId 任务 ID
     * @returns 标准化任务详情
     */
    async getTaskDetail(taskId: number): Promise<Task> {
        // 获取 REST v1 直接返回的任务对象。
        const data = await this.request<RestRecord>({ method: 'GET', url: `/tasks/${taskId}` });
        // 校验并转换任务 ID。
        const id = Number(data.id);
        if (!Number.isInteger(id) || id <= 0) throw new Error(`REST v1 任务 ${taskId} 详情缺少 id`);
        // 映射 REST v1 字段到现有 MCP 的 Task 类型。
        return {
            id,
            name: String(data.name || ''),
            status: String(data.status || 'wait') as TaskStatus,
            pri: Number(data.pri || 0),
            type: data.type || undefined,
            execution: data.execution ?? data.executionID ?? undefined,
            project: data.project ?? data.projectID ?? undefined,
            assignedTo: data.assignedTo || undefined,
            estimate: data.estimate != null ? Number(data.estimate) : undefined,
            estStarted: data.estStarted || undefined,
            deadline: data.deadline || undefined,
            desc: data.desc || '',
            story: data.story || undefined,
            product: data.product || undefined,
        };
    }

    /**
     * 创建任务。
     * @param request 创建任务字段
     * @returns 已回读核验的任务详情
     */
    async createTask(request: CreateTaskRequest): Promise<Task> {
        // 组装禅道 REST v1 创建任务字段。
        const body: RestV1CreateTaskBody = {
            execution: request.executionId,
            name: request.name.trim(),
            type: request.type,
            assignedTo: request.assignedTo,
            estStarted: request.estStarted,
            deadline: request.deadline,
            pri: request.pri,
            estimate: request.estimate,
            module: request.module,
            story: request.story,
            parent: request.parent,
            desc: request.desc,
        };
        try {
            // REST v1 创建是一次性写入，禁止认证之外的自动重试。
            const response = await this.request<RestRecord>({ method: 'POST', url: `/executions/${request.executionId}/tasks`, data: body }, false);
            // 写入响应必须返回任务 ID，才能进入回读。
            const taskId = this.getId(response, 'taskId');
            // 通过 REST v1 读取刚创建的任务，失败时只回退读取而不重复创建。
            const task = await this.getTaskDetail(taskId);
            // 校验回读标题，避免误认其他任务。
            if (task.name !== request.name.trim()) throw new Error(`REST v1 创建任务回读名称不一致: ${taskId}`);
            // 如果返回执行 ID，则校验任务归属。
            if (task.execution !== undefined && Number(task.execution) !== request.executionId) {
                throw new Error(`REST v1 创建任务回读执行不一致: ${taskId}`);
            }
            return task;
        } catch (error) {
            // 只有明确是未实现路由时，才允许在写入前转 Legacy。
            if (this.isSafeFallbackError(error)) throw error;
            throw error;
        }
    }

    /**
     * 更新 Bug。
     * @param bugId Bug ID
     * @param update 用户明确要求更新的字段
     * @returns 已回读的 Bug 详情
     */
    async updateBug(bugId: number, update: BugUpdate): Promise<Bug> {
        // 先读取完整 Bug，补齐禅道 PUT 接口要求的必填字段。
        const current = await this.request<RestRecord>({ method: 'GET', url: `/bugs/${bugId}` });
        // 合并用户明确字段和当前值，避免 PUT 清空未修改字段。
        const body: RestRecord = {
            branch: update.branch ?? current.branch,
            module: update.module ?? current.module,
            execution: update.execution ?? current.execution,
            title: update.title ?? current.title,
            keywords: update.keywords ?? current.keywords,
            severity: update.severity ?? Number(current.severity),
            pri: update.pri ?? Number(current.pri),
            type: update.type ?? current.type,
            os: update.os ?? current.os,
            browser: update.browser ?? current.browser,
            steps: update.steps ?? current.steps,
            story: update.story ?? current.story,
            task: update.task ?? current.task,
            deadline: update.deadline ?? current.deadline,
        };
        // 仅在用户明确指定影响版本，或服务端返回可直接复用的数组/编号时提交。
        if (update.openedBuild !== undefined) {
            body.openedBuild = update.openedBuild;
        } else if (Array.isArray(current.openedBuild) || typeof current.openedBuild === 'number') {
            body.openedBuild = current.openedBuild;
        }
        // REST v1 更新是一次性写入，禁止认证之外的自动重试。
        await this.request<RestRecord>({ method: 'PUT', url: `/bugs/${bugId}`, data: body }, false);
        // 写后回读由上层调用本类的 v1 优先读取完成。
        return this.getBugDetail(bugId);
    }

    /**
     * 解决 Bug。
     * @param bugId Bug ID
     * @param resolution 解决字段
     */
    async resolveBug(bugId: number, resolution: BugResolution): Promise<void> {
        // 组装 REST v1 Bug 解决字段。
        const body: RestRecord = {
            resolution: resolution.resolution,
            resolvedBuild: resolution.resolvedBuild || 'trunk',
            comment: resolution.comment || '',
        };
        // 重复 Bug 仅在用户明确提供时提交。
        if (resolution.duplicateBug) body.duplicateBug = resolution.duplicateBug;
        // REST v1 专用解决接口只提交一次。
        await this.request<RestRecord>({ method: 'POST', url: `/bugs/${bugId}/resolve`, data: body }, false);
    }

    /**
     * 更新任务。
     * @param taskId 任务 ID
     * @param update 用户明确要求更新的字段
     * @returns 已回读的任务详情
     */
    async updateTask(taskId: number, update: TaskUpdate): Promise<Task> {
        // 只提交用户明确提供的更新字段。
        const body = Object.fromEntries(Object.entries(update).filter(([, value]) => value !== undefined));
        // REST v1 写入只提交一次。
        await this.request<RestRecord>({ method: 'PUT', url: `/tasks/${taskId}`, data: body }, false);
        // 写后回读任务详情。
        return this.getTaskDetail(taskId);
    }

    /**
     * 完成任务。
     * @param taskId 任务 ID
     * @param update 完成任务字段
     */
    async finishTask(taskId: number, update: TaskUpdate): Promise<void> {
        // 只提交用户明确提供的完成字段。
        const body = Object.fromEntries(Object.entries({
            consumed: update.consumed,
            left: update.left,
            comment: update.comment,
        }).filter(([, value]) => value !== undefined));
        // REST v1 完成操作只提交一次。
        await this.request<RestRecord>({ method: 'POST', url: `/tasks/${taskId}/finish`, data: body }, false);
    }
}

/**
 * REST v1 优先、Legacy 兜底的完整禅道 API。
 */
export class ZentaoRestV1API extends ZentaoLegacyAPI {
    /** REST v1 客户端。 */
    private readonly restV1: RestV1Client;

    /**
     * 初始化双通道 API。
     * @param config 禅道连接配置
     */
    constructor(config: ZentaoConfig) {
        super(config);
        this.restV1 = new RestV1Client(config);
    }

    /**
     * REST v1 读取失败时回退 Legacy 读取。
     * @param label 操作名称
     * @param restReader REST v1 读取函数
     * @param legacyReader Legacy 读取函数
     * @returns 首个成功读取结果
     */
    private async readWithFallback<T>(label: string, restReader: () => Promise<T>, legacyReader: () => Promise<T>): Promise<T> {
        try {
            return await restReader();
        } catch (error) {
            // 不输出服务端原始响应，避免日志泄露认证或内部信息。
            console.warn(`${label} REST v1 不可用，回退 Legacy 接口`);
            return legacyReader();
        }
    }

    /**
     * REST v1 优先读取 Bug 详情。
     * @param bugId Bug ID
     * @returns Bug 详情
     */
    override async getBugDetail(bugId: number): Promise<Bug> {
        return this.readWithFallback(`Bug ${bugId} 详情`, () => this.restV1.getBugDetail(bugId), () => super.getBugDetail(bugId));
    }

    /**
     * REST v1 优先读取任务详情。
     * @param taskId 任务 ID
     * @returns 任务详情
     */
    override async getTaskDetail(taskId: number): Promise<Task> {
        return this.readWithFallback(`任务 ${taskId} 详情`, () => this.restV1.getTaskDetail(taskId), () => super.getTaskDetail(taskId));
    }

    /**
     * REST v1 优先创建任务，明确未实现时回退 Legacy 创建。
     * @param request 创建任务字段
     * @returns 已回读任务详情
     */
    override async createTask(request: CreateTaskRequest): Promise<Task> {
        try {
            return await this.restV1.createTask(request);
        } catch (error) {
            // 只有 HTTP 404/405/501 或明确路由错误才允许回退，避免重复写入。
            const canFallback = error instanceof RestV1FallbackError
                ? error.safeToFallback
                : axios.isAxiosError(error) && [404, 405, 501].includes(error.response?.status || 0);
            if (!canFallback) throw error;
            return super.createTask(request);
        }
    }

    /**
     * REST v1 优先更新 Bug，路由不兼容时回退 Legacy。
     * @param bugId Bug ID
     * @param update 更新字段
     * @returns 已回读 Bug 详情
     */
    async updateBug(bugId: number, update: BugUpdate): Promise<Bug> {
        try {
            return await this.restV1.updateBug(bugId, update);
        } catch (error) {
            // 写入前仅允许明确的未实现路由回退。
            const canFallback = error instanceof RestV1FallbackError
                ? error.safeToFallback
                : axios.isAxiosError(error) && [404, 405, 501].includes(error.response?.status || 0);
            if (!canFallback) throw error;
            return super.updateBug(bugId, update);
        }
    }

    /**
     * REST v1 优先解决 Bug，路由不兼容时回退 Legacy。
     * @param bugId Bug ID
     * @param resolution 解决字段
     */
    override async resolveBug(bugId: number, resolution: BugResolution): Promise<void> {
        try {
            await this.restV1.resolveBug(bugId, resolution);
        } catch (error) {
            // 只有明确的未实现路由才允许回退，避免不明确写入重复提交。
            const canFallback = error instanceof RestV1FallbackError
                ? error.safeToFallback
                : axios.isAxiosError(error) && [404, 405, 501].includes(error.response?.status || 0);
            if (!canFallback) throw error;
            await super.resolveBug(bugId, resolution);
        }
    }

    /**
     * REST v1 优先更新任务，路由不兼容时回退 Legacy。
     * @param taskId 任务 ID
     * @param update 更新字段
     * @returns 已回读任务详情
     */
    override async updateTask(taskId: number, update: TaskUpdate): Promise<Task> {
        try {
            return await this.restV1.updateTask(taskId, update);
        } catch (error) {
            // 只有明确的未实现路由才允许回退。
            const canFallback = error instanceof RestV1FallbackError
                ? error.safeToFallback
                : axios.isAxiosError(error) && [404, 405, 501].includes(error.response?.status || 0);
            if (!canFallback) throw error;
            return super.updateTask(taskId, update);
        }
    }

    /**
     * REST v1 优先完成任务，路由不兼容时回退 Legacy。
     * @param taskId 任务 ID
     * @param update 完成字段
     */
    override async finishTask(taskId: number, update: TaskUpdate): Promise<void> {
        try {
            await this.restV1.finishTask(taskId, update);
        } catch (error) {
            // 只有明确的未实现路由才允许回退。
            const canFallback = error instanceof RestV1FallbackError
                ? error.safeToFallback
                : axios.isAxiosError(error) && [404, 405, 501].includes(error.response?.status || 0);
            if (!canFallback) throw error;
            await super.finishTask(taskId, update);
        }
    }
}
