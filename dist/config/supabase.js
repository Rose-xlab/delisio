"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
// src/config/supabase.ts
const supabase_js_1 = require("@supabase/supabase-js");
const logger_1 = require("../utils/logger");
const dotenv = __importStar(require("dotenv"));
// Load environment variables from .env file
// Ensure this runs before any code that needs process.env variables
// Alternatively, call dotenv.config() once in your main application entry point file.
dotenv.config();
// Use specific variable names for clarity
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Recommended name
// Check if credentials are provided and throw if missing
if (!supabaseUrl) {
    const errorMsg = 'Missing Supabase URL. Set SUPABASE_URL in .env file';
    logger_1.logger.error(errorMsg);
    throw new Error(errorMsg);
}
if (!supabaseServiceKey) {
    const errorMsg = 'Missing Supabase Service Role Key. Set SUPABASE_SERVICE_ROLE_KEY in .env file';
    logger_1.logger.error(errorMsg);
    throw new Error(errorMsg);
}
// Initialize and export the typed Supabase client
// Using 'export const' instead of 'export default' is often preferred for clarity, but default is fine too.
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey, {
    auth: {
        persistSession: false, // Good for server-side
        autoRefreshToken: false, // Recommended when using service_role key
        detectSessionInUrl: false // Good for server-side
    }
});
logger_1.logger.info('Supabase client initialized successfully.'); // Use info level for success
//# sourceMappingURL=supabase.js.map