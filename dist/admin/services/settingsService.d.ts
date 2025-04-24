interface SystemSettings {
    ai: {
        gptModel: string;
        dalleModel: string;
        maxTokens: number;
        temperature: number;
    };
    limits: {
        recipeGenerationsPerMonthFree: number;
        recipeGenerationsPerMonthBasic: number;
        chatMessagesPerDayFree: number;
        chatMessagesPerDayBasic: number;
    };
    features: {
        imageGenerationEnabled: boolean;
        chatEnabled: boolean;
        subscriptionsEnabled: boolean;
    };
    monitoring: {
        sentryEnabled: boolean;
        errorReportingLevel: 'debug' | 'info' | 'warn' | 'error';
    };
}
/**
 * Get system settings
 */
export declare const getSystemSettings: () => Promise<SystemSettings>;
/**
 * Update system settings
 */
export declare const updateSystemSettings: (settings: SystemSettings) => Promise<void>;
export {};
