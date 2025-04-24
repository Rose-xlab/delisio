import { Queue, Worker } from 'bullmq';
interface MessageHistoryItem {
    role: 'user' | 'assistant';
    content: string;
}
export interface ChatJobData {
    message: string;
    conversationId: string;
    messageHistory?: MessageHistoryItem[];
    userId?: string;
}
export interface ChatJobResult {
    reply: string;
    suggestions?: string[] | null;
    error?: string;
}
export declare const chatQueue: Queue<ChatJobData, ChatJobResult, "process-message", ChatJobData, ChatJobResult, "process-message">;
declare const chatWorker: Worker<ChatJobData, ChatJobResult, "process-message">;
export { chatWorker };
export default chatQueue;
