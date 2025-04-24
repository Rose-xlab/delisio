"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConversionRates = exports.getChurnAnalysis = exports.getRevenueTrend = exports.getRevenueMetrics = exports.getCurrentMonthRevenue = exports.getSubscriptionTiersOverview = void 0;
const supabase_1 = require("../../config/supabase");
const stripe_1 = require("../../config/stripe");
const logger_1 = require("../../utils/logger");
/**
 * Get subscription tiers overview
 */
const getSubscriptionTiersOverview = async () => {
    try {
        // Get counts per tier
        const { data, error } = await supabase_1.supabase.rpc('get_subscription_tier_counts');
        if (error) {
            logger_1.logger.error('Error getting subscription tier counts:', error);
            throw new Error('Failed to get subscription tier counts');
        }
        const tiers = {
            free: { count: 0, percentage: 0 },
            basic: { count: 0, percentage: 0 },
            premium: { count: 0, percentage: 0 }
        };
        // Process the data
        let totalUsers = 0;
        if (data && data.length > 0) {
            data.forEach((item) => {
                if (item.tier in tiers) {
                    tiers[item.tier].count = item.count;
                    totalUsers += item.count;
                }
            });
            // Calculate percentages
            if (totalUsers > 0) {
                Object.keys(tiers).forEach((tier) => {
                    const tierKey = tier;
                    tiers[tierKey].percentage = parseFloat(((tiers[tierKey].count / totalUsers) * 100).toFixed(1));
                });
            }
        }
        return {
            tiers,
            totalUsers
        };
    }
    catch (error) {
        logger_1.logger.error('Error in getSubscriptionTiersOverview:', error);
        throw error;
    }
};
exports.getSubscriptionTiersOverview = getSubscriptionTiersOverview;
/**
 * Get current month revenue
 */
const getCurrentMonthRevenue = async () => {
    try {
        if (!(0, stripe_1.isStripeConfigured)() || !stripe_1.stripe) {
            logger_1.logger.warn('Stripe is not configured, returning mock revenue data');
            return {
                currentMonth: 0,
                previousMonth: 0,
                growth: 0
            };
        }
        // Get current and previous month boundaries
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        // Get current month revenue
        const currentMonthInvoices = await stripe_1.stripe.invoices.list({
            created: {
                gte: Math.floor(currentMonthStart.getTime() / 1000)
            },
            status: 'paid',
            limit: 100
        });
        const currentMonthRevenue = currentMonthInvoices.data.reduce((total, invoice) => {
            return total + (invoice.amount_paid / 100); // Convert from cents to dollars
        }, 0);
        // Get previous month revenue
        const previousMonthInvoices = await stripe_1.stripe.invoices.list({
            created: {
                gte: Math.floor(previousMonthStart.getTime() / 1000),
                lt: Math.floor(previousMonthEnd.getTime() / 1000)
            },
            status: 'paid',
            limit: 100
        });
        const previousMonthRevenue = previousMonthInvoices.data.reduce((total, invoice) => {
            return total + (invoice.amount_paid / 100); // Convert from cents to dollars
        }, 0);
        // Calculate growth percentage
        const growth = previousMonthRevenue > 0
            ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
            : currentMonthRevenue > 0 ? 100 : 0;
        return {
            currentMonth: parseFloat(currentMonthRevenue.toFixed(2)),
            previousMonth: parseFloat(previousMonthRevenue.toFixed(2)),
            growth: parseFloat(growth.toFixed(1))
        };
    }
    catch (error) {
        logger_1.logger.error('Error getting current month revenue:', error);
        // Return zeros instead of throwing to prevent dashboard failure
        return {
            currentMonth: 0,
            previousMonth: 0,
            growth: 0
        };
    }
};
exports.getCurrentMonthRevenue = getCurrentMonthRevenue;
/**
 * Get revenue metrics over a period
 */
const getRevenueMetrics = async (period) => {
    try {
        if (!(0, stripe_1.isStripeConfigured)() || !stripe_1.stripe) {
            logger_1.logger.warn('Stripe is not configured, returning mock revenue metrics');
            return {
                total: 0,
                recurring: 0,
                oneTime: 0,
                refunds: 0,
                byTier: {
                    basic: 0,
                    premium: 0
                },
                trend: []
            };
        }
        // Parse period and calculate start date
        const now = new Date();
        let startDate = new Date();
        if (period.endsWith('d')) {
            const days = parseInt(period);
            startDate.setDate(now.getDate() - days);
        }
        else if (period.endsWith('m')) {
            const months = parseInt(period);
            startDate.setMonth(now.getMonth() - months);
        }
        else if (period.endsWith('y')) {
            const years = parseInt(period);
            startDate.setFullYear(now.getFullYear() - years);
        }
        else {
            // Default to 30 days
            startDate.setDate(now.getDate() - 30);
        }
        // Get all paid invoices in the period
        const invoices = await stripe_1.stripe.invoices.list({
            created: {
                gte: Math.floor(startDate.getTime() / 1000)
            },
            status: 'paid',
            limit: 100 // Increase if needed
        });
        // Get refunds in the period
        const charges = await stripe_1.stripe.charges.list({
            created: {
                gte: Math.floor(startDate.getTime() / 1000)
            },
            refunded: true,
            limit: 100
        });
        // Categorize revenue
        let totalRevenue = 0;
        let recurringRevenue = 0;
        let oneTimeRevenue = 0;
        let refundsAmount = 0;
        const tierRevenue = {
            basic: 0,
            premium: 0
        };
        // Process invoices
        invoices.data.forEach(invoice => {
            const amount = invoice.amount_paid / 100; // Convert from cents to dollars
            totalRevenue += amount;
            if (invoice.subscription) {
                recurringRevenue += amount;
                // Determine tier from line items
                invoice.lines.data.forEach(line => {
                    if (line.price && line.price.metadata && line.price.metadata.tier) {
                        const tier = line.price.metadata.tier.toLowerCase();
                        if (tier in tierRevenue) {
                            tierRevenue[tier] += amount;
                        }
                    }
                });
            }
            else {
                oneTimeRevenue += amount;
            }
        });
        // Process refunds
        charges.data.forEach(charge => {
            if (charge.refunded) {
                refundsAmount += charge.amount_refunded / 100; // Convert from cents to dollars
            }
        });
        // Calculate monthly trend
        const monthlyTrend = await getMonthlyRevenueTrend(period);
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
    }
    catch (error) {
        logger_1.logger.error('Error in getRevenueMetrics:', error);
        throw error;
    }
};
exports.getRevenueMetrics = getRevenueMetrics;
/**
 * Get monthly revenue trend
 */
const getMonthlyRevenueTrend = async (period) => {
    try {
        if (!(0, stripe_1.isStripeConfigured)() || !stripe_1.stripe) {
            return [];
        }
        // Parse period to determine number of months to fetch
        let months = 6; // Default
        if (period.endsWith('m')) {
            months = parseInt(period);
        }
        else if (period.endsWith('y')) {
            months = parseInt(period) * 12;
        }
        // Limit to reasonable range
        months = Math.min(Math.max(months, 3), 24);
        // Generate monthly boundaries
        const now = new Date();
        const monthlyBoundaries = [];
        for (let i = 0; i < months; i++) {
            const year = now.getFullYear();
            const month = now.getMonth() - i;
            // Handle negative months by adjusting year
            const adjustedYear = month < 0 ? year - Math.ceil(Math.abs(month) / 12) : year;
            const adjustedMonth = month < 0 ? 12 + (month % 12) : month;
            const startDate = new Date(adjustedYear, adjustedMonth, 1);
            const endDate = new Date(adjustedYear, adjustedMonth + 1, 0);
            monthlyBoundaries.push({
                name: startDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
                start: Math.floor(startDate.getTime() / 1000),
                end: Math.floor(endDate.getTime() / 1000)
            });
        }
        // Reverse so that oldest month comes first
        monthlyBoundaries.reverse();
        // Fetch revenue for each month
        const monthlyTrend = [];
        for (const boundary of monthlyBoundaries) {
            const invoices = await stripe_1.stripe.invoices.list({
                created: {
                    gte: boundary.start,
                    lt: boundary.end
                },
                status: 'paid',
                limit: 100
            });
            const monthRevenue = invoices.data.reduce((total, invoice) => {
                return total + (invoice.amount_paid / 100); // Convert from cents to dollars
            }, 0);
            monthlyTrend.push({
                month: boundary.name,
                revenue: parseFloat(monthRevenue.toFixed(2))
            });
        }
        return monthlyTrend;
    }
    catch (error) {
        logger_1.logger.error('Error getting monthly revenue trend:', error);
        return [];
    }
};
/**
 * Get revenue trend over a period
 */
const getRevenueTrend = async (period) => {
    try {
        // For simplicity, reuse the monthly revenue trend function
        const monthlyTrend = await getMonthlyRevenueTrend(period);
        return monthlyTrend;
    }
    catch (error) {
        logger_1.logger.error('Error in getRevenueTrend:', error);
        return [];
    }
};
exports.getRevenueTrend = getRevenueTrend;
/**
 * Get churn analysis
 */
const getChurnAnalysis = async (period) => {
    try {
        if (!(0, stripe_1.isStripeConfigured)() || !stripe_1.stripe) {
            logger_1.logger.warn('Stripe is not configured, returning mock churn data');
            return {
                churnRate: 0,
                canceledSubscriptions: 0,
                totalSubscriptions: 0,
                churnByTier: {
                    basic: 0,
                    premium: 0
                },
                reasons: []
            };
        }
        // Parse period and calculate start date
        const now = new Date();
        let startDate = new Date();
        if (period.endsWith('d')) {
            const days = parseInt(period);
            startDate.setDate(now.getDate() - days);
        }
        else if (period.endsWith('m')) {
            const months = parseInt(period);
            startDate.setMonth(now.getMonth() - months);
        }
        else {
            // Default to 90 days
            startDate.setDate(now.getDate() - 90);
        }
        // Get all subscriptions
        const allSubscriptions = await stripe_1.stripe.subscriptions.list({
            status: 'all',
            limit: 100,
            created: {
                lt: Math.floor(now.getTime() / 1000)
            }
        });
        // Get canceled subscriptions in period
        const canceledSubscriptions = await stripe_1.stripe.subscriptions.list({
            status: 'canceled',
            limit: 100,
            canceled_at: {
                gte: Math.floor(startDate.getTime() / 1000)
            }
        });
        // Calculate churn rate
        const totalSubscriptionsBeforePeriod = allSubscriptions.data.filter(sub => {
            return sub.created < Math.floor(startDate.getTime() / 1000);
        }).length;
        const canceledInPeriodCount = canceledSubscriptions.data.length;
        const churnRate = totalSubscriptionsBeforePeriod > 0
            ? (canceledInPeriodCount / totalSubscriptionsBeforePeriod) * 100
            : 0;
        // Analyze churn by tier
        const churnByTier = {
            basic: 0,
            premium: 0
        };
        canceledSubscriptions.data.forEach(sub => {
            sub.items.data.forEach(item => {
                if (item.price && item.price.metadata && item.price.metadata.tier) {
                    const tier = item.price.metadata.tier.toLowerCase();
                    if (tier in churnByTier) {
                        churnByTier[tier] += 1;
                    }
                }
            });
        });
        // Mock reasons for cancellation (this would typically come from a survey or feedback system)
        const mockReasons = [
            { reason: 'Too expensive', count: Math.floor(canceledInPeriodCount * 0.35) },
            { reason: 'Not using enough', count: Math.floor(canceledInPeriodCount * 0.25) },
            { reason: 'Found alternative', count: Math.floor(canceledInPeriodCount * 0.2) },
            { reason: 'Missing features', count: Math.floor(canceledInPeriodCount * 0.15) },
            { reason: 'Technical issues', count: Math.floor(canceledInPeriodCount * 0.05) }
        ];
        return {
            churnRate: parseFloat(churnRate.toFixed(1)),
            canceledSubscriptions: canceledInPeriodCount,
            totalSubscriptions: totalSubscriptionsBeforePeriod,
            churnByTier,
            reasons: mockReasons
        };
    }
    catch (error) {
        logger_1.logger.error('Error in getChurnAnalysis:', error);
        throw error;
    }
};
exports.getChurnAnalysis = getChurnAnalysis;
/**
 * Get conversion rates between tiers
 */
const getConversionRates = async () => {
    try {
        // Query subscription changes from Supabase
        const { data, error } = await supabase_1.supabase.rpc('get_subscription_conversions');
        if (error) {
            logger_1.logger.error('Error getting subscription conversions:', error);
            throw new Error('Failed to get subscription conversions');
        }
        // Process the data
        const conversionRates = {
            freeToBasic: 0,
            freeToPremium: 0,
            basicToPremium: 0,
            premiumToBasic: 0,
            basicToFree: 0,
            premiumToFree: 0,
            totalConversions: 0
        };
        // Calculate total user base (from subscription tiers overview)
        const tiersData = await (0, exports.getSubscriptionTiersOverview)();
        const totalUsers = tiersData.totalUsers;
        // Process each conversion path
        if (data && data.length > 0) {
            data.forEach((item) => {
                const { from_tier, to_tier, count } = item;
                switch (`${from_tier}To${to_tier.charAt(0).toUpperCase() + to_tier.slice(1)}`) {
                    case 'freeToBasic':
                        conversionRates.freeToBasic = count;
                        break;
                    case 'freeToPremium':
                        conversionRates.freeToPremium = count;
                        break;
                    case 'basicToPremium':
                        conversionRates.basicToPremium = count;
                        break;
                    case 'premiumToBasic':
                        conversionRates.premiumToBasic = count;
                        break;
                    case 'basicToFree':
                        conversionRates.basicToFree = count;
                        break;
                    case 'premiumToFree':
                        conversionRates.premiumToFree = count;
                        break;
                }
                conversionRates.totalConversions += count;
            });
        }
        // Calculate percentages based on tier counts
        const conversionPercentages = {
            freeToBasic: tiersData.tiers.free.count > 0
                ? (conversionRates.freeToBasic / tiersData.tiers.free.count) * 100
                : 0,
            freeToPremium: tiersData.tiers.free.count > 0
                ? (conversionRates.freeToPremium / tiersData.tiers.free.count) * 100
                : 0,
            basicToPremium: tiersData.tiers.basic.count > 0
                ? (conversionRates.basicToPremium / tiersData.tiers.basic.count) * 100
                : 0,
            premiumToBasic: tiersData.tiers.premium.count > 0
                ? (conversionRates.premiumToBasic / tiersData.tiers.premium.count) * 100
                : 0,
            basicToFree: tiersData.tiers.basic.count > 0
                ? (conversionRates.basicToFree / tiersData.tiers.basic.count) * 100
                : 0,
            premiumToFree: tiersData.tiers.premium.count > 0
                ? (conversionRates.premiumToFree / tiersData.tiers.premium.count) * 100
                : 0
        };
        return {
            counts: conversionRates,
            percentages: {
                freeToBasic: parseFloat(conversionPercentages.freeToBasic.toFixed(1)),
                freeToPremium: parseFloat(conversionPercentages.freeToPremium.toFixed(1)),
                basicToPremium: parseFloat(conversionPercentages.basicToPremium.toFixed(1)),
                premiumToBasic: parseFloat(conversionPercentages.premiumToBasic.toFixed(1)),
                basicToFree: parseFloat(conversionPercentages.basicToFree.toFixed(1)),
                premiumToFree: parseFloat(conversionPercentages.premiumToFree.toFixed(1))
            },
            totalUsers,
            totalConversions: conversionRates.totalConversions
        };
    }
    catch (error) {
        logger_1.logger.error('Error in getConversionRates:', error);
        throw error;
    }
};
exports.getConversionRates = getConversionRates;
//# sourceMappingURL=subscriptionService.js.map