/**
 * 自定义错误类型
 */

export enum ErrorCode {
    AUTH_FAILED = 'AUTH_FAILED',
    NETWORK_ERROR = 'NETWORK_ERROR',
    NOT_FOUND = 'NOT_FOUND',
    INVALID_PARAMS = 'INVALID_PARAMS',
    API_ERROR = 'API_ERROR',
    CONFIG_ERROR = 'CONFIG_ERROR',
    SESSION_EXPIRED = 'SESSION_EXPIRED'
}

export class ZentaoError extends Error {
    constructor(
        public code: ErrorCode,
        message: string,
        public statusCode?: number,
        public originalError?: any
    ) {
        super(message);
        this.name = 'ZentaoError';
        Object.setPrototypeOf(this, ZentaoError.prototype);
    }

    /**
     * 转换为用户友好的错误消息
     */
    toUserFriendlyMessage(): string {
        const messages: Record<ErrorCode, string> = {
            [ErrorCode.AUTH_FAILED]: '认证失败，请检查用户名和密码',
            [ErrorCode.NETWORK_ERROR]: '网络连接失败，请检查网络或服务器地址',
            [ErrorCode.NOT_FOUND]: '未找到请求的资源',
            [ErrorCode.INVALID_PARAMS]: '参数错误，请检查输入参数',
            [ErrorCode.API_ERROR]: '禅道 API 返回错误',
            [ErrorCode.CONFIG_ERROR]: '配置错误，请检查配置信息',
            [ErrorCode.SESSION_EXPIRED]: 'Session 已过期，请重新初始化连接'
        };

        return messages[this.code] || this.message;
    }

    /**
     * 转换为 JSON
     */
    toJSON() {
        return {
            code: this.code,
            message: this.message,
            userFriendlyMessage: this.toUserFriendlyMessage(),
            statusCode: this.statusCode,
            name: this.name
        };
    }
}

/**
 * 创建错误对象
 */
export function createError(
    code: ErrorCode,
    message: string,
    statusCode?: number,
    originalError?: any
): ZentaoError {
    return new ZentaoError(code, message, statusCode, originalError);
}

