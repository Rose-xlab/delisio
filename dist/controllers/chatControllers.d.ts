/**
 * Interface for chat response
 */
interface ChatResponse {
    reply: string;
    can_generate_recipe: boolean;
    suggested_recipe?: string;
}
/**
 * Handles user chat messages and generates AI responses
 * @param message The user's chat message
 * @returns AI response with suggestion and recipe generation flag
 */
export declare const handleChatMessage: (message: string) => Promise<ChatResponse>;
export {};
