// C:\Users\mukas\Downloads\delisio\delisio\src\admin\services\subscriptionServiceFix.ts
import { stripe } from '../../config/stripe';
import { logger } from '../../utils/logger';
import { supabase } from '../../config/supabase';
// Import Database type if you haven't already, often helpful
// Adjust path as needed
// import type { Database } from '../../types/supabase';

// --- MOVED & EXPORTED INTERFACES ---
// Define the structure expected by the frontend (and returned by the service function)
export interface TierDetail {
    count: number;
    percentage: number;
}
export interface TiersOverviewResult {
    tiers: Record<string, TierDetail>;
    totalUsers: number;
}
// --- END OF MOVED INTERFACES ---


/**
 * Get current month revenue
 * This is a simplified version with fallback for testing
 */
export const getCurrentMonthRevenue = async (): Promise<number> => {
 try {
  // Try to get revenue from Stripe
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Make sure we have the Stripe API configured
  if (!stripe) {
   logger.warn('Stripe not configured, returning mock data for revenue');
   return getMockRevenue();
  }

  try {
   // Try to fetch from Stripe
   const charges = await stripe.charges.list({
    created: {
     gte: Math.floor(startOfMonth.getTime() / 1000),
     lte: Math.floor(endOfMonth.getTime() / 1000)
    },
    limit: 100 // Adjust as needed
   });

   // Calculate total revenue
   const revenue = charges.data.reduce((total, charge) => {
    if (charge.status === 'succeeded') {
     return total + (charge.amount / 100); // Convert cents to dollars
    }
    return total;
   }, 0);

   return revenue;
  } catch (stripeError) {
   logger.error('Error getting revenue from Stripe:', stripeError);

   // Fallback to database
   return getRevenueFromDatabase();
  }
 } catch (error) {
  logger.error('Error in getCurrentMonthRevenue:', error);
  return getMockRevenue();
 }
};

/**
 * Fallback to get revenue from database if Stripe fails
 */
async function getRevenueFromDatabase(): Promise<number> {
 try {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Query subscriptions table for active subscriptions this month
  // Note: This DB query might not accurately reflect real Stripe revenue
  const { data, error } = await supabase
   .from('subscriptions')
   .select('tier')
   .eq('status', 'active')
   .gte('created_at', startOfMonth.toISOString());

  if (error || !data) { // Added check for data
   logger.error('Error or no data getting revenue from database:', error);
   return getMockRevenue();
  }

  // Calculate revenue based on subscription tiers
  const tierPrices = {
   'free': 0,
   'basic': 9.99,
   'premium': 19.99,
   'professional': 49.99
  };

  const revenue = data.reduce((total, subscription) => {
   // Ensure subscription.tier is a key of tierPrices before accessing
   const tier = subscription.tier as keyof typeof tierPrices;
   return total + (tierPrices[tier] || 0);
  }, 0);

  return revenue;
 } catch (error) {
  logger.error('Error getting revenue from database:', error);
  return getMockRevenue();
 }
}

/**
 * Generate mock revenue for development
 */
function getMockRevenue(): number {
 return Math.floor(Math.random() * 10000) / 100; // Random amount between $0-$100
}

/**
 * Get revenue trend data (mock)
 */
export const getRevenueTrend = async (period: string): Promise<{ month: string; revenue: number }[]> => {
 logger.info(`Generating mock revenue trend for period: ${period}`);
 const mockMonths = ['Nov 2024', 'Dec 2024', 'Jan 2025', 'Feb 2025', 'Mar 2025', 'Apr 2025'];
 return mockMonths.map(month => ({
  month,
  revenue: Math.floor(Math.random() * 10000) / 100
 }));
};


/**
 * Get subscription tiers overview, processed for frontend
 */
// This function now implicitly returns Promise<TiersOverviewResult>
export const getSubscriptionTiersOverview = async () => {
 // Define the expected return type from the RPC call - CAN stay local
 interface RpcTierCount { tier: string; count: number; }

 // Define mock data structure matching the final exported type
 const mockOverview: TiersOverviewResult = {
    tiers: {
        free: { count: 1200, percentage: 60 },
        basic: { count: 450, percentage: 22.5 },
        premium: { count: 280, percentage: 14 },
        professional: { count: 70, percentage: 3.5 }
    },
    totalUsers: 2000
 };


 try {
  // 1. Call the correct RPC function
  const { data: tierData, error: tierError } = await supabase.rpc('get_subscription_tier_counts');

  // 2. Check for errors or empty data from RPC
  if (tierError || !tierData || tierData.length === 0) {
   logger.warn('Error or no data getting subscription tiers from database RPC, using mock data', tierError);
   return mockOverview; // Return structured mock data
  }

  // 3. Process the data array into the structure expected by the frontend
  const processedTiers: Record<string, TierDetail> = {};
  // Type assertion for safety, assuming RPC returns the expected structure
  const dataArray = tierData as RpcTierCount[];
  const totalUsers = dataArray.reduce((sum, item) => sum + (item.count || 0), 0);

  dataArray.forEach(item => {
    // Ensure tier name is valid before using as key
    if (item.tier && typeof item.tier === 'string') {
        const count = item.count || 0;
        // Calculate percentage safely
        const percentage = totalUsers > 0 ? parseFloat(((count / totalUsers) * 100).toFixed(1)) : 0;
        processedTiers[item.tier] = { count, percentage };
    } else {
        logger.warn('Invalid tier item received from RPC:', item);
    }
  });

  // Ensure result conforms to the exported type
  const result: TiersOverviewResult = {
    tiers: processedTiers,
    totalUsers: totalUsers
  };

  logger.info('Subscription tiers overview fetched and processed from DB.');
  // 4. Return the processed data
  return result;

 } catch (error) {
  logger.error('Error in getSubscriptionTiersOverview processing:', error);
  // Return structured mock data on any processing error
  return mockOverview;
 }
};


/**
 * Get revenue metrics including current month, previous month, and growth
 * NOW RETURNS FULL STRUCTURE EXPECTED BY FRONTEND (WITH MOCK DATA FOR SOME FIELDS)
 */
// Define return type structure explicitly for clarity (optional but good practice)
interface RevenueMetricsResult {
    total: number;
    recurring: number;
    oneTime: number;
    byTier: {
        basic: number;
        premium: number;
        // Add other tiers if needed
    };
    refunds: number;
    trend: { month: string; revenue: number }[];
}

export const getRevenueMetrics = async (period?: string): Promise<RevenueMetricsResult> => {
 try {
  logger.info(`Getting revenue metrics for period: ${period || 'default'}`);

  // 1. Get Total Revenue (using existing function)
  const totalRevenue = await getCurrentMonthRevenue();

  // 2. Get Revenue Trend (using existing function)
  const revenueTrend = await getRevenueTrend(period || '30d'); // Pass period

  // --- MOCK DATA SECTION (Replace with real calculations) ---
  const recurringRevenue = totalRevenue * 0.8;
  const oneTimeRevenue = totalRevenue - recurringRevenue;
  const basicRevenue = totalRevenue * 0.3;
  const premiumRevenue = totalRevenue * 0.7;
  const refunds = totalRevenue * 0.05;
  // --- END OF MOCK DATA SECTION ---

  // 7. Construct the full object expected by the frontend
  const revenueMetricsData: RevenueMetricsResult = {
   total: parseFloat(totalRevenue.toFixed(2)),
   recurring: parseFloat(recurringRevenue.toFixed(2)),
   oneTime: parseFloat(oneTimeRevenue.toFixed(2)),
   byTier: {
    basic: parseFloat(basicRevenue.toFixed(2)),
    premium: parseFloat(premiumRevenue.toFixed(2))
   },
   refunds: parseFloat(refunds.toFixed(2)),
   trend: revenueTrend
  };

  logger.info('Returning calculated/mocked revenue metrics:', revenueMetricsData);
  return revenueMetricsData;

 } catch (error) {
  logger.error('Error in getRevenueMetrics:', error);

  // Return mock data on error, MATCHING THE FULL FRONTEND STRUCTURE
  const defaultTrend = ['Mar 2025', 'Apr 2025'].map(month => ({ month, revenue: getMockRevenue() }));
  // Ensure mock data conforms to the type
  const mockResult: RevenueMetricsResult = {
   total: 4875.50,
   recurring: 4000.00,
   oneTime: 875.50,
   byTier: {
    basic: 1500.00,
    premium: 3375.50
   },
   refunds: 243.78,
   trend: defaultTrend
  };
  return mockResult;
 }
};


/**
 * Get churn analysis data
 */
// Define return type
interface ChurnReason { reason: string; count: number; }
interface ChurnAnalysisResult {
    churnRate: number;
    canceledSubscriptions: number;
    totalSubscriptionsAtStart: number;
    churnByTier: { basic: number; premium: number; }; // Adjust if more tiers
    reasons: ChurnReason[];
}

export const getChurnAnalysis = async (period: string = '90d'): Promise<ChurnAnalysisResult> => {
 try {
  logger.info(`Getting churn analysis for period: ${period}`);
  // MOCK DATA FOR NOW - Structure matches frontend expectation
  const canceled = Math.floor(10 + Math.random() * 40);
  const startSubs = Math.floor(canceled / (0.01 + Math.random() * 0.04));
  const churnRate = startSubs > 0 ? parseFloat(((canceled / startSubs) * 100).toFixed(1)) : 0;

  const result: ChurnAnalysisResult = {
   churnRate: churnRate,
   canceledSubscriptions: canceled,
   totalSubscriptionsAtStart: startSubs,
   churnByTier: {
    basic: Math.floor(canceled * 0.6),
    premium: Math.floor(canceled * 0.4)
   },
   reasons: [
    { reason: 'Too expensive', count: Math.floor(canceled * 0.3) },
    { reason: 'Didn\'t use enough', count: Math.floor(canceled * 0.4) },
    { reason: 'Technical issues', count: Math.floor(canceled * 0.1) },
    { reason: 'Switched service', count: Math.floor(canceled * 0.1) },
    { reason: 'Other', count: Math.floor(canceled * 0.1) }
   ]
  };
  return result;
 } catch (error) {
  logger.error('Error in getChurnAnalysis:', error);

  // Return mock data on error matching type
  const mockResult: ChurnAnalysisResult = {
   churnRate: 3.1,
   canceledSubscriptions: 28,
   totalSubscriptionsAtStart: 903,
   churnByTier: { basic: 17, premium: 11 },
   reasons: [
    { reason: 'Too expensive', count: 8 },
    { reason: 'Didn\'t use enough', count: 11 },
    { reason: 'Technical issues', count: 3 },
    { reason: 'Switched service', count: 3 },
    { reason: 'Other', count: 3 }
   ]
  };
  return mockResult;
 }
};

/**
 * Get conversion rates from free to paid tiers
 */
// Define return type
interface ConversionCounts {
    freeToBasic: number;
    freeToPremium: number;
    basicToPremium: number;
    premiumToBasic: number;
    basicToFree: number;
    premiumToFree: number;
    // Add others if needed
}
interface ConversionPercentages {
    freeToBasic: number;
    freeToPremium: number;
    basicToPremium: number;
    premiumToBasic: number;
    basicToFree: number;
    premiumToFree: number;
    // Add others if needed
}
interface ConversionRatesResult {
    counts: ConversionCounts;
    percentages: ConversionPercentages;
    totalConversions: number;
}

export const getConversionRates = async (period: string = '6m'): Promise<ConversionRatesResult> => {
 try {
  logger.info(`Getting conversion rates for period: ${period}`);
  logger.warn('Using mock data for conversion rates');

  const mockCounts: ConversionCounts = {
   freeToBasic: 85, freeToPremium: 42, basicToPremium: 35,
   premiumToBasic: 10, basicToFree: 15, premiumToFree: 5
  };
  const totalConversions = Object.values(mockCounts).reduce((sum, count) => sum + count, 0);

  const result: ConversionRatesResult = {
   counts: mockCounts,
   percentages: {
    freeToBasic: 5.2, freeToPremium: 2.6, basicToPremium: 21.1,
    premiumToBasic: 3.0, basicToFree: 4.0, premiumToFree: 1.5
   },
   totalConversions: totalConversions
  };
  return result;
 } catch (error) {
  logger.error('Error in getConversionRates:', error);

  // Return mock data on error matching type
  const mockResult: ConversionRatesResult = {
   counts: { freeToBasic: 80, freeToPremium: 40, basicToPremium: 30, premiumToBasic: 8, basicToFree: 12, premiumToFree: 4 },
   percentages: { freeToBasic: 5.0, freeToPremium: 2.5, basicToPremium: 20.0, premiumToBasic: 2.8, basicToFree: 3.8, premiumToFree: 1.2 },
   totalConversions: 174
  };
  return mockResult;
 }
};