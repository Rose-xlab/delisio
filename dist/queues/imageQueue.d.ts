import { Queue, Worker } from 'bullmq';
import { SubscriptionTier } from '../models/Subscription';
export interface ImageJobData {
    prompt: string;
    recipeId: string;
    stepIndex: number;
    requestId?: string;
    recipeData?: any;
    subscriptionTier: SubscriptionTier;
}
export interface ImageJobResult {
    imageUrl?: string;
    error?: string;
    stepIndex?: number;
    requestId?: string;
}
export declare const imageQueue: Queue<ImageJobData, ImageJobResult, string, ImageJobData, ImageJobResult, string>;
export declare const imageWorker: Worker<ImageJobData, ImageJobResult, string>;
