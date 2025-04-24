import { supabase } from '../../config/supabase';
import { stripe, isStripeConfigured } from '../../config/stripe'; // Ensure stripe can be null if not configured
import { logger } from '../../utils/logger';

/**
 * Get subscription tiers overview
 */
export const getSubscriptionTiersOverview = async () => {
  try {
    // Get counts per tier using Supabase RPC
    // Ensure the RPC function 'get_subscription_tier_counts' exists and returns expected data format: { tier: string, count: number }[]
    const { data, error } = await supabase.rpc('get_subscription_tier_counts');

    if (error) {
      logger.error('Error getting subscription tier counts:', error);
      throw new Error('Failed to get subscription tier counts');
    }

    // Initialize tier structure
    const tiers: Record<string, { count: number; percentage: number }> = {
      free: { count: 0, percentage: 0 },
      basic: { count: 0, percentage: 0 },
      premium: { count: 0, percentage: 0 }
      // Add other tiers if applicable
    };

    let totalUsers = 0;

    // Process the data safely
    if (data && Array.isArray(data)) {
      data.forEach((item: any) => {
        // Check if item has the expected structure and tier exists
        if (item && typeof item.tier === 'string' && typeof item.count === 'number' && item.tier in tiers) {
          tiers[item.tier].count = item.count;
          totalUsers += item.count;
        } else {
           logger.warn('Received unexpected item format from get_subscription_tier_counts RPC:', item);
        }
      });

      // Calculate percentages only if totalUsers > 0
      if (totalUsers > 0) {
        Object.keys(tiers).forEach((tierKey) => {
          tiers[tierKey].percentage = parseFloat(((tiers[tierKey].count / totalUsers) * 100).toFixed(1));
        });
      }
    } else {
        logger.warn('No data or unexpected data format received from get_subscription_tier_counts RPC.');
    }

    return {
      tiers,
      totalUsers
    };
  } catch (error) {
    logger.error('Error in getSubscriptionTiersOverview:', error);
    // Re-throw the error to be handled by the caller
    throw error;
  }
};

/**
 * Get current month revenue compared to previous month
 */
export const getCurrentMonthRevenue = async () => {
  try {
    if (!isStripeConfigured() || !stripe) {
      logger.warn('Stripe is not configured, returning zero revenue data');
      // Return zero values consistent with expected return type
      return {
        currentMonth: 0,
        previousMonth: 0,
        growth: 0
      };
    }

    // Calculate date boundaries (UTC recommended for consistency)
    const now = new Date();
    const currentMonthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const previousMonthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
    // End of previous month is the millisecond before the start of the current month
    const previousMonthEnd = currentMonthStart;


    // --- Fetch Current Month Revenue ---
    let currentMonthRevenue = 0;
    // Use auto-pagination for potentially more than 100 invoices
    for await (const invoice of stripe.invoices.list({
        created: { gte: Math.floor(currentMonthStart / 1000) },
        status: 'paid',
        // limit: 100 // Let auto-pagination handle limits
    })) {
        currentMonthRevenue += (invoice.amount_paid / 100); // Convert cents to dollars/euros etc.
    }


    // --- Fetch Previous Month Revenue ---
     let previousMonthRevenue = 0;
     for await (const invoice of stripe.invoices.list({
         created: {
             gte: Math.floor(previousMonthStart / 1000),
             lt: Math.floor(previousMonthEnd / 1000) // Use less than current month start
         },
         status: 'paid',
     })) {
         previousMonthRevenue += (invoice.amount_paid / 100);
     }


    // Calculate growth percentage safely
    let growth = 0;
    if (previousMonthRevenue > 0) {
         growth = ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100;
    } else if (currentMonthRevenue > 0) {
         growth = Infinity; // Or 100 if preferred to indicate growth from zero
    }


    return {
      currentMonth: parseFloat(currentMonthRevenue.toFixed(2)),
      previousMonth: parseFloat(previousMonthRevenue.toFixed(2)),
      growth: isFinite(growth) ? parseFloat(growth.toFixed(1)) : (growth > 0 ? Infinity: -Infinity) // Handle Infinity case
    };

  } catch (error: any) { // Catch specific Stripe errors if needed
    logger.error('Error getting current month revenue from Stripe:', error);
    // Return zeros instead of throwing to prevent dashboard failure
    return {
      currentMonth: 0,
      previousMonth: 0,
      growth: 0
    };
  }
};


/**
 * Get revenue metrics over a specified period (e.g., '30d', '3m', '1y')
 */
export const getRevenueMetrics = async (period: string) => {
  try {
    if (!isStripeConfigured() || !stripe) {
      logger.warn('Stripe is not configured, returning mock revenue metrics');
      // Return zeroed structure matching the expected output
       return {
           total: 0, recurring: 0, oneTime: 0, refunds: 0,
           byTier: { basic: 0, premium: 0 }, trend: []
       };
    }

    // Calculate start date based on period string
    const now = new Date();
    let startDate = new Date();
    const periodMatch = period.match(/^(\d+)([dmy])$/); // Match number and d/m/y

    if (periodMatch) {
        const value = parseInt(periodMatch[1]);
        const unit = periodMatch[2];
        if (unit === 'd') startDate.setUTCDate(now.getUTCDate() - value);
        else if (unit === 'm') startDate.setUTCMonth(now.getUTCMonth() - value);
        else if (unit === 'y') startDate.setUTCFullYear(now.getUTCFullYear() - value);
        else startDate.setUTCDate(now.getUTCDate() - 30); // Default fallback
    } else {
        startDate.setUTCDate(now.getUTCDate() - 30); // Default to 30 days if format is invalid
        logger.warn(`Invalid period format '${period}'. Defaulting to 30 days.`);
    }
    const startTimestamp = Math.floor(startDate.getTime() / 1000);


    // --- Fetch Paid Invoices in Period ---
    let totalRevenue = 0;
    let recurringRevenue = 0;
    let oneTimeRevenue = 0;
    const tierRevenue: Record<string, number> = { basic: 0, premium: 0 };

    for await (const invoice of stripe.invoices.list({
        created: { gte: startTimestamp },
        status: 'paid',
        expand: ['data.subscription.items.data.price'] // Expand necessary fields
    })) {
        const amount = invoice.amount_paid / 100;
        totalRevenue += amount;

        if (invoice.subscription) {
            recurringRevenue += amount;
            // Attempt to determine tier from line items (requires price expansion)
             if (invoice.lines && invoice.lines.data) {
                 invoice.lines.data.forEach(line => {
                     // Check expanded price object and metadata
                     if (line.price && line.price.metadata && typeof line.price.metadata.tier === 'string') {
                         const tier = line.price.metadata.tier.toLowerCase();
                         if (tier in tierRevenue) {
                             tierRevenue[tier] += amount; // Could pro-rate if multiple lines, but simpler to assign full invoice amount
                         }
                     }
                 });
             }
        } else {
            oneTimeRevenue += amount;
        }
    }


    // --- Fetch Refunds in Period ---
    // *** FIX for Error 1: Use stripe.refunds.list ***
    let refundsAmount = 0;
    for await (const refund of stripe.refunds.list({
        created: { gte: startTimestamp },
        // limit: 100 // Handled by auto-pagination
    })) {
        refundsAmount += refund.amount / 100; // Sum refund amounts
    }


    // --- Get Monthly Trend ---
    const monthlyTrend = await getMonthlyRevenueTrend(period); // Reuse helper function


    return {
      total: parseFloat(totalRevenue.toFixed(2)),
      recurring: parseFloat(recurringRevenue.toFixed(2)),
      oneTime: parseFloat(oneTimeRevenue.toFixed(2)),
      refunds: parseFloat(refundsAmount.toFixed(2)),
      byTier: {
        basic: parseFloat(tierRevenue.basic.toFixed(2)),
        premium: parseFloat(tierRevenue.premium.toFixed(2))
      },
      trend: monthlyTrend
    };

  } catch (error: any) {
    logger.error(`Error in getRevenueMetrics for period '${period}':`, error);
    // Depending on requirements, either re-throw or return a zeroed/error structure
    // throw error;
     return { // Return zeroed structure on error to avoid breaking dashboards
         total: 0, recurring: 0, oneTime: 0, refunds: 0,
         byTier: { basic: 0, premium: 0 }, trend: []
     };
  }
};


/**
 * Helper function to get monthly revenue trend data
 */
const getMonthlyRevenueTrend = async (period: string): Promise<{ month: string; revenue: number }[]> => {
  try {
    // Assign stripe to a local variable
    const stripeClient = stripe; // <-- FIX: Assign to local variable

    // Perform the check using the local variable
    if (!isStripeConfigured() || !stripeClient) { // <-- FIX: Check local variable
        logger.warn('Stripe not configured, returning empty trend for getMonthlyRevenueTrend.');
        return []; // Return empty array if Stripe not configured
    }
    // --- TypeScript now knows stripeClient is not null beyond this point ---


    // Determine number of months based on period
    let months = 6; // Default
    const periodMatch = period.match(/^(\d+)([dmy])$/);
    if (periodMatch) {
        const value = parseInt(periodMatch[1]);
        const unit = periodMatch[2];
        if (unit === 'm') months = value;
        else if (unit === 'y') months = value * 12;
        else if (unit === 'd' && value <= 30) months = 1; // Approx 1 month for short day periods
        else if (unit === 'd' && value <= 90) months = 3; // Approx 3 months
        // Add more logic if needed for day ranges spanning multiple months
    }
    months = Math.min(Math.max(months, 1), 36); // Limit range (e.g., 1 to 36 months)


    // Generate monthly boundaries (UTC)
    const now = new Date();
    const monthlyBoundaries = [];
    for (let i = 0; i < months; i++) {
        const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        const startTimestamp = Math.floor(monthDate.getTime() / 1000);
        // End timestamp is the start of the *next* month
        const endTimestamp = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1) / 1000);

        monthlyBoundaries.push({
            // Format month name (e.g., 'Apr 2025')
            name: monthDate.toLocaleString('default', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
            start: startTimestamp,
            end: endTimestamp // Use less than (<) this timestamp
        });
    }
    monthlyBoundaries.reverse(); // Oldest first


    // Fetch revenue for each month boundary using Promise.all for concurrency
    const trendPromises = monthlyBoundaries.map(async (boundary) => {
        let monthRevenue = 0;
        try {
             // Use the non-null stripeClient variable here
             for await (const invoice of stripeClient.invoices.list({ // <-- FIX: Use local variable
                 created: {
                     gte: boundary.start,
                     lt: boundary.end
                 },
                 status: 'paid',
             })) {
                 monthRevenue += (invoice.amount_paid / 100);
             }
        } catch (monthError) {
            logger.error(`Error fetching revenue for month ${boundary.name}:`, monthError);
            // Decide how to handle errors for a single month (e.g., return 0 or skip)
            monthRevenue = 0; // Default to 0 on error for this month
        }
        return {
            month: boundary.name,
            revenue: parseFloat(monthRevenue.toFixed(2))
        };
    });

    return await Promise.all(trendPromises);

  } catch (error: any) {
    logger.error('Error getting monthly revenue trend:', error);
    return []; // Return empty array on general failure
  }
};


// NOTE: getRevenueTrend seems redundant if getRevenueMetrics already calculates and returns the trend.
// Consider removing this exported function if getRevenueMetrics serves the purpose.
/**
 * Get revenue trend over a period (Potentially redundant)
 */
// export const getRevenueTrend = async (period: string) => {
//   try {
//     // For simplicity, reuse the monthly revenue trend function
//     const monthlyTrend = await getMonthlyRevenueTrend(period);
//     return monthlyTrend;
//   } catch (error) {
//     logger.error('Error in getRevenueTrend:', error);
//     return [];
//   }
// };


/**
 * Get churn analysis over a period
 */
export const getChurnAnalysis = async (period: string) => {
  try {
    if (!isStripeConfigured() || !stripe) {
      logger.warn('Stripe is not configured, returning mock churn data');
       return { // Return structure consistent with success case
           churnRate: 0, canceledSubscriptions: 0, totalSubscriptionsAtStart: 0,
           churnByTier: { basic: 0, premium: 0 }, reasons: []
       };
    }

    // Calculate start date based on period string
    const now = new Date();
    let startDate = new Date();
    const periodMatch = period.match(/^(\d+)([dmy])$/);
     if (periodMatch) {
         const value = parseInt(periodMatch[1]);
         const unit = periodMatch[2];
         if (unit === 'd') startDate.setUTCDate(now.getUTCDate() - value);
         else if (unit === 'm') startDate.setUTCMonth(now.getUTCMonth() - value);
         else if (unit === 'y') startDate.setUTCFullYear(now.getUTCFullYear() - value);
         else startDate.setUTCDate(now.getUTCDate() - 90); // Default fallback
     } else {
         startDate.setUTCDate(now.getUTCDate() - 90); // Default to 90 days if format is invalid
         logger.warn(`Invalid period format '${period}'. Defaulting to 90 days for churn.`);
     }
     const startTimestamp = Math.floor(startDate.getTime() / 1000);

    // --- Get Total Subscriptions Active at the START of the period ---
    // This is tricky. A simple way is to count subs created before the start date
    // that were not canceled before the start date. This requires iterating.
    let totalSubscriptionsAtStart = 0;
     for await (const sub of stripe.subscriptions.list({
         status: 'all', // Get active, canceled, etc.
         created: { lt: startTimestamp }, // Created before the period started
         limit: 100, // Use auto-pagination
         expand: ['data.items.data.price']
     })) {
        // Count if it wasn't canceled *before* the period started
        if (!sub.canceled_at || sub.canceled_at >= startTimestamp) {
             totalSubscriptionsAtStart++;
        }
     }

    // --- Get Canceled Subscriptions WITHIN the Period ---
    // *** FIX for Error 2: Fetch by status: 'canceled' and filter by canceled_at date in code ***
    const canceledInPeriodSubs = [];
    for await (const sub of stripe.subscriptions.list({
        status: 'canceled',
        // Remove canceled_at filter from here
        limit: 100, // Handled by auto-pagination
        expand: ['data.items.data.price'] // Expand price to get metadata.tier
    })) {
        // Filter based on the cancellation timestamp AFTER fetching
        if (sub.canceled_at && sub.canceled_at >= startTimestamp) {
            canceledInPeriodSubs.push(sub);
        }
    }
    const canceledInPeriodCount = canceledInPeriodSubs.length;


    // Calculate churn rate
    const churnRate = totalSubscriptionsAtStart > 0
      ? (canceledInPeriodCount / totalSubscriptionsAtStart) * 100
      : 0;


    // Analyze churn by tier using the filtered list
    const churnByTier: Record<string, number> = { basic: 0, premium: 0 };
    canceledInPeriodSubs.forEach(sub => {
        if (sub.items && sub.items.data) {
            sub.items.data.forEach(item => {
                // Check expanded price object
                 if (item.price && item.price.metadata && typeof item.price.metadata.tier === 'string') {
                    const tier = item.price.metadata.tier.toLowerCase();
                    if (tier in churnByTier) {
                        churnByTier[tier] += 1;
                    }
                 }
            });
        }
    });

    // Mock reasons for cancellation (replace with real data source if available)
    const mockReasons = [
       { reason: 'Too expensive', count: Math.max(0, Math.floor(canceledInPeriodCount * 0.35)) },
       { reason: 'Not using enough', count: Math.max(0, Math.floor(canceledInPeriodCount * 0.25)) },
       { reason: 'Found alternative', count: Math.max(0, Math.floor(canceledInPeriodCount * 0.2)) },
       { reason: 'Missing features', count: Math.max(0, Math.floor(canceledInPeriodCount * 0.15)) },
       { reason: 'Technical issues', count: Math.max(0, Math.floor(canceledInPeriodCount * 0.05)) }
    ];
    // Ensure counts add up reasonably (optional adjustment)
     const assignedCount = mockReasons.reduce((sum, r) => sum + r.count, 0);
     if (assignedCount < canceledInPeriodCount && mockReasons.length > 0) {
         mockReasons[0].count += (canceledInPeriodCount - assignedCount); // Add remainder to first reason
     }


    return {
      churnRate: parseFloat(churnRate.toFixed(1)),
      canceledSubscriptions: canceledInPeriodCount,
      totalSubscriptionsAtStart: totalSubscriptionsAtStart, // Renamed for clarity
      churnByTier,
      reasons: mockReasons
    };

  } catch (error: any) {
    logger.error(`Error in getChurnAnalysis for period '${period}':`, error);
    // Re-throw or return zeroed structure
    // throw error;
     return {
         churnRate: 0, canceledSubscriptions: 0, totalSubscriptionsAtStart: 0,
         churnByTier: { basic: 0, premium: 0 }, reasons: []
     };
  }
};


/**
 * Get conversion rates between tiers using Supabase RPC
 */
export const getConversionRates = async () => {
  try {
    // Ensure the RPC function 'get_subscription_conversions' exists
    // and returns data like: { from_tier: string, to_tier: string, count: number }[]
    const { data: conversionData, error: rpcError } = await supabase.rpc('get_subscription_conversions');

    if (rpcError) {
      logger.error('Error getting subscription conversions RPC:', rpcError);
      throw new Error('Failed to get subscription conversions data');
    }

    // Initialize structure for conversion counts
    const conversionCounts: Record<string, number> = {
      freeToBasic: 0, freeToPremium: 0,
      basicToPremium: 0, premiumToBasic: 0,
      basicToFree: 0, premiumToFree: 0,
    };
    let totalConversions = 0;

    // Process RPC data
    if (conversionData && Array.isArray(conversionData)) {
      conversionData.forEach((item: any) => {
         if (item && typeof item.from_tier === 'string' && typeof item.to_tier === 'string' && typeof item.count === 'number') {
              // Construct key like 'freeToBasic'
              const from = item.from_tier.toLowerCase();
              const to = item.to_tier.charAt(0).toUpperCase() + item.to_tier.slice(1).toLowerCase();
              const key = `${from}To${to}`;

              if (key in conversionCounts) {
                  conversionCounts[key] = item.count;
                  totalConversions += item.count;
              } else {
                  logger.warn(`Unexpected conversion path from RPC: ${from} -> ${to}`);
              }
         } else {
             logger.warn('Received unexpected item format from get_subscription_conversions RPC:', item);
         }
      });
    } else {
        logger.warn('No data or unexpected data format received from get_subscription_conversions RPC.');
    }


    // Get current tier counts for calculating percentages
    const tiersOverview = await getSubscriptionTiersOverview();
    const tierCounts = tiersOverview.tiers;


    // Calculate percentages, avoiding division by zero
    const calculatePercentage = (count: number, base: number): number => {
         return base > 0 ? parseFloat(((count / base) * 100).toFixed(1)) : 0;
    };

    const conversionPercentages = {
        freeToBasic: calculatePercentage(conversionCounts.freeToBasic, tierCounts.free.count),
        freeToPremium: calculatePercentage(conversionCounts.freeToPremium, tierCounts.free.count),
        basicToPremium: calculatePercentage(conversionCounts.basicToPremium, tierCounts.basic.count),
        premiumToBasic: calculatePercentage(conversionCounts.premiumToBasic, tierCounts.premium.count),
        basicToFree: calculatePercentage(conversionCounts.basicToFree, tierCounts.basic.count),
        premiumToFree: calculatePercentage(conversionCounts.premiumToFree, tierCounts.premium.count)
    };

    return {
      counts: conversionCounts,
      percentages: conversionPercentages,
      totalUsers: tiersOverview.totalUsers,
      totalConversions: totalConversions
    };

  } catch (error: any) {
    logger.error('Error in getConversionRates:', error);
    // Re-throw error or handle appropriately
    throw error;
  }
};