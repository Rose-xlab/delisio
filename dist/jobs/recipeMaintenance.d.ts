/**
 * Maintenance job to process the recipe database:
 * - Detect and merge duplicates
 * - Re-evaluate recipe quality
 * - Update categories and tags
 * - Clean up unused or invalid entries
 */
export declare function runRecipeMaintenance(): Promise<void>;
