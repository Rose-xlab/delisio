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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStripeConfigured = exports.stripe = exports.STRIPE_PLANS = void 0;
const stripe_1 = __importDefault(require("stripe"));
const logger_1 = require("../utils/logger");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
// Get Stripe API key from environment
const stripeApiKey = process.env.STRIPE_SECRET_KEY;
// Check if Stripe API key is configured
if (!stripeApiKey) {
    logger_1.logger.warn('STRIPE_SECRET_KEY is not set in environment variables');
}
// Define plan IDs - replace with your actual Stripe price IDs after creating products
exports.STRIPE_PLANS = {
    FREE: 'free_tier', // Not an actual Stripe product, just for reference
    BASIC: 'price_basic_monthly', // Replace with your actual Stripe price ID
    PREMIUM: 'price_premium_monthly' // Replace with your actual Stripe price ID
};
// Create Stripe client with updated API version
exports.stripe = stripeApiKey ? new stripe_1.default(stripeApiKey, {
    apiVersion: '2025-03-31.basil', // Updated to match the expected version
}) : null;
// Helper function to check if Stripe is properly configured
const isStripeConfigured = () => {
    return !!exports.stripe;
};
exports.isStripeConfigured = isStripeConfigured;
//# sourceMappingURL=stripe.js.map