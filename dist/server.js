"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/server.ts
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables before initializing any queues or services
dotenv_1.default.config();
const app_1 = __importDefault(require("./app"));
// --- REMOVED WORKER INITIALIZATION FROM API SERVER ---
// The Worker instances should run in their own dedicated processes.
// Importing these files here was causing the Workers to be created
// within the same process as the Express API server.
// import './queues/chatQueue';
// import './queues/imageQueue';
// import './queues/recipeQueue';
// ----------------------------------------------------
// Note: Your controllers (like chatController) will still import the specific
// QUEUE instance (e.g., `import chatQueue from '../queues/chatQueue';`)
// to add jobs. This is correct. Make sure the queue files export the queue instance.
// Get port from environment variables or use default
const PORT = process.env.PORT || 3000;
// Start the API server
app_1.default.listen(PORT, () => {
    // Changed log message slightly for clarity
    console.log(`API Server process started, listening on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
        console.warn('WARNING: OPENAI_API_KEY is not set in .env file');
    }
});
//# sourceMappingURL=server.js.map