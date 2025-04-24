import Stripe from 'stripe';
export declare const STRIPE_PLANS: {
    FREE: string;
    BASIC: string;
    PREMIUM: string;
};
export declare const stripe: Stripe | null;
export declare const isStripeConfigured: () => boolean;
