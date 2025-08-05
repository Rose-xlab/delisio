
// src/schemas/chat.schema.ts

import { z } from 'zod';

/**
 * Defines the strict schema for a valid AI chat response.
 * This is the single source of truth for our application.
 * - reply: Must be a non-empty string.
 * - suggestions: An optional array of strings. Defaults to an empty array if missing.
 * - error: An optional string for technical error codes.
 */
export const AiChatResponseSchema = z.object({
  reply: z.string().min(1, { message: "Reply cannot be empty." }),
  suggestions: z.array(z.string()).optional().default([]),
  error: z.string().optional(),
});

/**
 * Inferred TypeScript type from our Zod schema.
 * We will use this type throughout our application for full type-safety.
 */
export type AiChatResponse = z.infer<typeof AiChatResponseSchema>;