import { Queue, Worker, QueueEvents } from 'bullmq';
import { Recipe } from '../models/Recipe';
import { SubscriptionTier } from '../models/Subscription';
export interface RecipeJobData {
    query: string;
    userPreferences?: any;
    requestId: string;
    userId?: string;
    save?: boolean;
    cancelled?: boolean;
    enableProgressiveDisplay?: boolean;
    subscriptionTier: SubscriptionTier;
}
export interface RecipeJobResult {
    recipe?: Recipe;
    cancelled?: boolean;
    error?: string;
}
export declare const recipeQueue: Queue<RecipeJobData, RecipeJobResult, "generate-recipe", RecipeJobData, RecipeJobResult, "generate-recipe">;
export declare const imageQueueEvents: QueueEvents;
export declare const recipeWorker: Worker<RecipeJobData, RecipeJobResult, "generate-recipe">;
