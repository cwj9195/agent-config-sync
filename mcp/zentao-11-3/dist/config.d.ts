export interface ZentaoConfig {
    url: string;
    username: string;
    password: string;
    apiVersion: 'legacy';
    timeoutMs?: number;
    sessionTtlMs?: number;
}
export declare function saveConfig(config: ZentaoConfig): void;
export declare function loadConfig(): ZentaoConfig | null;
export declare function isConfigured(): boolean;
