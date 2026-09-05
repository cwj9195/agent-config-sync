/**
 * 自定义错误类型
 */
export var ErrorCode;
(function (ErrorCode) {
    ErrorCode["AUTH_FAILED"] = "AUTH_FAILED";
    ErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
    ErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ErrorCode["INVALID_PARAMS"] = "INVALID_PARAMS";
    ErrorCode["API_ERROR"] = "API_ERROR";
    ErrorCode["CONFIG_ERROR"] = "CONFIG_ERROR";
    ErrorCode["SESSION_EXPIRED"] = "SESSION_EXPIRED";
})(ErrorCode || (ErrorCode = {}));
export class ZentaoError extends Error {
    constructor(code, message, statusCode, originalError) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.originalError = originalError;
        this.name = 'ZentaoError';
        Object.setPrototypeOf(this, ZentaoError.prototype);
    }
    /**
     * 转换为用户友好的错误消息
     */
    toUserFriendlyMessage() {
        const messages = {
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
export function createError(code, message, statusCode, originalError) {
    return new ZentaoError(code, message, statusCode, originalError);
}
