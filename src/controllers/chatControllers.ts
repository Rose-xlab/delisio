import { generateChatResponse } from '../services/gptService';
import { AppError } from '../middleware/errorMiddleware';

/**
 * Interface for the structured response expected by the Flutter app
 */
interface ChatResponse {
  reply: string;
  suggestions?: string[]; // Optional array of suggested recipe names
}

/**
 * Interface for a message in the conversation history
 */
interface MessageHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Handles incoming user chat messages, gets a JSON response from GPT service,
 * parses it, and returns the structured response.
 *
 * @param message The user's chat message string.
 * @param conversationId Optional conversation ID for context tracking.
 * @param messageHistory Optional array of previous messages for context.
 * @returns A Promise resolving to a ChatResponse object.
 * @throws {AppError} If processing fails.
 */
export const handleChatMessage = async (
  message: string, 
  conversationId?: string, 
  messageHistory?: MessageHistoryItem[]
): Promise<ChatResponse> => {
  try {
    console.log(`Handling chat message: "${message}" for conversation: ${conversationId || 'new'}`);
    
    if (messageHistory && messageHistory.length > 0) {
      console.log(`Including ${messageHistory.length} previous messages as context`);
    } else {
      console.log("No message history provided, treating as new conversation");
    }

    // Step 1: Get the response JSON string from the GPT service with context history
    const gptJsonResponse = await generateChatResponse(message, messageHistory);
    console.log(`Raw JSON Response String from GPT service:\n${gptJsonResponse}`);

    // Step 2: Parse the JSON string
    let parsedData: any; // Use 'any' initially or define a specific interface
    try {
        parsedData = JSON.parse(gptJsonResponse);
        console.log("Successfully parsed JSON response string.");
    } catch (jsonError) {
        console.error('Error parsing JSON response from OpenAI:', jsonError);
        console.error('Received non-JSON response string:', gptJsonResponse);
        throw new Error('Failed to parse chat structure from AI response.');
    }

    // Step 3: Validate and Extract data from the parsed object
    const reply = parsedData?.reply as string | undefined;
    const suggestionsData = parsedData?.suggestions;

    // Basic validation
    if (typeof reply !== 'string' || reply.trim().length === 0) {
        console.error('Parsed JSON missing valid "reply" string:', parsedData);
        throw new Error('AI response JSON missing required "reply" field.');
    }

    // Preserve formatting from the response (including newlines)
    let formattedReply = reply;
    formattedReply = formattedReply.replace(/\\n/g, '\n');

    let suggestions: string[] | undefined = undefined;
    // Validate suggestions: must be null or an array of strings
    if (suggestionsData !== null && suggestionsData !== undefined) {
        if (Array.isArray(suggestionsData) && suggestionsData.every(item => typeof item === 'string')) {
             // Only assign if it's a non-empty array of strings
             if (suggestionsData.length > 0) {
                  suggestions = suggestionsData as string[];
                  console.log(`Parsed suggestions: ${JSON.stringify(suggestions)}`);
             } else {
                  console.log("Parsed suggestions: Received empty array, treating as None.");
             }

        } else {
            console.warn('Parsed "suggestions" field was not null or a valid string array:', suggestionsData);
            // Keep suggestions as undefined if format is wrong
        }
    } else {
        console.log("Parsed suggestions: None (field was null or undefined).");
         // Keep suggestions as undefined
    }


    // Step 4: Construct the final response object for the Flutter app
    const response: ChatResponse = {
      reply: formattedReply, // Use the formatted reply with preserved newlines
      // Conditionally add suggestions field only if it's a valid, non-empty array
      ...(suggestions && { suggestions: suggestions })
    };

    console.log('Sending processed chat response to client:', response);
    return response;

  } catch (error) {
    console.error('Error in handleChatMessage controller:', error);
    if (error instanceof Error) {
         throw new AppError(`Failed to process chat message: ${error.message}`, 500);
    } else {
         throw new AppError('An unknown error occurred while processing the chat message.', 500);
    }
  }
};