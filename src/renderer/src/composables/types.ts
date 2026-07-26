import { Ref } from "vue";

export interface AIConfig {
  apiKey: string | '(已保存)'
  model: 'deepseek-v4-flash' | 'deepseek-v4-pro'
}

export type AIconfigType = {
    settingsVisible: Ref<boolean, boolean>;
    config: Ref<{
        apiKey: string | '(已保存)';
        model: "deepseek-v4-flash" | "deepseek-v4-pro";
    }, AIConfig | {
        apiKey: string | '(已保存)';
        model: "deepseek-v4-flash" | "deepseek-v4-pro";
    }>;
    ready: Ref<boolean, boolean>;
    openSettings: () => void;
    closeSettings: () => void;
    saveConfig: (newConfig: AIConfig) => Promise<void>;
    loadConfig: () => Promise<void>;
}
