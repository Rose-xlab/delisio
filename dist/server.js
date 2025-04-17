"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Get port from environment variables or use default
const PORT = process.env.PORT || 3000;
// Start the server
app_1.default.listen(PORT, () => {
    console.log(`Cooking-Assistant server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
        console.warn('WARNING: OPENAI_API_KEY is not set in .env file');
    }
});
//# sourceMappingURL=server.js.map