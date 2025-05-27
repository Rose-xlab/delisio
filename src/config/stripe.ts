//C:\Users\mukas\Downloads\delisio\delisio\src\config\stripe.ts

import Stripe from 'stripe';
import { logger } from '../utils/logger';
import * as dotenv from 'dotenv';

dotenv.config();

// Get Stripe API key from environment
const stripeApiKey = process.env.STRIPE_SECRET_KEY;

// Check if Stripe API key is configured
if (!stripeApiKey) {
  logger.warn('STRIPE_SECRET_KEY is not set in environment variables');
}

// Define plan IDs - replace with your actual Stripe price IDs after creating products
export const STRIPE_PLANS = {
  FREE: 'free_tier', // Not an actual Stripe product, just for reference
  BASIC: 'price_basic_monthly', // Replace with your actual Stripe price ID
  PREMIUM: 'price_premium_monthly' // Replace with your actual Stripe price ID
};

// Create Stripe client with updated API version
export const stripe = stripeApiKey ? new Stripe(stripeApiKey, {
  apiVersion: '2024-04-10' as Stripe.LatestApiVersion, // Updated to the latest version supported by the types
}) : null;

// Helper function to check if Stripe is properly configured
export const isStripeConfigured = (): boolean => {
  return !!stripe;
};