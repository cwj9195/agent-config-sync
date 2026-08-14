import fs from 'fs';
import os from 'os';
import path from 'path';

// 定义配置文件路径
const CONFIG_DIR = path.join(os.homedir(), '.zentao');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_SESSION_TTL_MS = 3000000;

/**
 * 读取正整数环境变量，非法值回退到默认值。
 * @param name 环境变量名
 * @param fallback 默认值
 * @returns 正整数配置
 */
function readPositiveInteger(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    return Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * 补齐本地 MCP 运行配置。
 * @param config 禅道配置
 * @returns 带稳定性参数的配置
 */
function withRuntimeConfig(config: ZentaoConfig): ZentaoConfig {
    return {
        ...config,
        timeoutMs: config.timeoutMs || readPositiveInteger('ZENTAO_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
        sessionTtlMs: config.sessionTtlMs || readPositiveInteger('ZENTAO_SESSION_TTL_MS', DEFAULT_SESSION_TTL_MS),
        apiVersion: 'legacy'
    };
}

// 配置接口（只支持 legacy）
export interface ZentaoConfig {
    url: string;
    username: string;
    password: string;
    apiVersion: 'legacy';  // 固定为 legacy
    timeoutMs?: number;
    sessionTtlMs?: number;
}

// 保存配置
export function saveConfig(config: ZentaoConfig): void {
    // 确保配置目录存在
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    // 强制设置为 legacy
    const legacyConfig: ZentaoConfig = {
        ...config,
        apiVersion: 'legacy'
    };

    // 写入配置文件
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(legacyConfig, null, 2));
}

// 读取配置（优先从环境变量读取，其次从配置文件）
export function loadConfig(): ZentaoConfig | null {
    // 优先从环境变量读取配置
    const envUrl = process.env.ZENTAO_URL;
    const envUsername = process.env.ZENTAO_USERNAME;
    const envPassword = process.env.ZENTAO_PASSWORD;
    
    if (envUrl && envUsername && envPassword) {
        return withRuntimeConfig({
            url: envUrl,
            username: envUsername,
            password: envPassword,
            apiVersion: 'legacy'
        });
    }
    
    // 如果环境变量不存在，从配置文件读取
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            // 强制设置为 legacy
            return withRuntimeConfig(config);
        }
    } catch (error) {
        console.error('读取配置文件失败:', error);
    }
    return null;
}

// 检查是否已配置
export function isConfigured(): boolean {
    return fs.existsSync(CONFIG_FILE);
}
