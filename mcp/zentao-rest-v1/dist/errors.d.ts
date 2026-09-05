/**
 * 自定义错误类型
 */
export declare enum ErrorCode {
    AUTH_FAILED = "AUTH_FAILED",
    NETWORK_ERROR = "NETWORK_ERROR",
    NOT_FOUND = "NOT_FOUND",
    INVALID_PARAMS = "INVALID_PARAMS",
    API_ERROR = "API_ERROR",
    CONFIG_ERROR = "CONFIG_ERROR",
    SESSION_EXPIRED = "SESSION_EXPIRED"
}
export declare class ZentaoError extends Error {
    code: ErrorCode;
    statusCode?: number | undefined;
    originalError?: any | undefined;
    constructor(code: ErrorCode, message: string, statusCode?: number | undefined, originalError?: any | undefined);
    /**
     * 转换为用户友好的错误消息
     */
    toUserFriendlyMessage(): string;
    /**
     * 转换为 JSON
     */
    toJSON(): {
        code: ErrorCode;
        message: string;
        userFriendlyMessage: string;
        statusCode: number | undefined;
        name: string;
    };
}
/**
 * 创建错误对象
 */
export declare function createError(code: ErrorCode, message: string, statusCode?: number, originalError?: any): ZentaoError;
