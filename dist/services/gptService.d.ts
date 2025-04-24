/**
 * Interface for a message in the conversation history
 */
interface MessageHistoryItem {
    role: 'user' | 'assistant';
    content: string;
}
/**
 * Generates a complete recipe JSON string using GPT-4, including categorization and quality assessment.
 */
export declare const generateRecipeContent: (query: string, userPreferences?: {}) => Promise<string>;
/**
 * Generates a chat response JSON string using GPT-4.
 * Now includes conversation history for context.
 */
export declare const generateChatResponse: (message: string, messageHistory?: MessageHistoryItem[]) => Promise<string>;
export {};
