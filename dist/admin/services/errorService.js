"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorTrend = exports.getRecentErrorCount = exports.getSentryUserImpact = exports.getSentryFrequentErrors = exports.getSentryErrorTrends = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const logger_1 = require("../../utils/logger");
// Environment variables for Sentry
const SENTRY_TOKEN = process.env.SENTRY_API_TOKEN;
const SENTRY_ORG = process.env.SENTRY_ORG;
const SENTRY_PROJECT = process.env.SENTRY_PROJECT;
/**
 * Check if Sentry is configured
 */
const isSentryConfigured = () => {
    return !!(SENTRY_TOKEN && SENTRY_ORG && SENTRY_PROJECT);
};
/**
 * Get error trends from Sentry
 */
const getSentryErrorTrends = async (period) => {
    try {
        if (!isSentryConfigured()) {
            logger_1.logger.warn('Sentry is not configured for API access, returning mock data');
            return getMockErrorTrends(period);
        }
        // Parse period to get start date
        const now = new Date();
        let startDate = new Date();
        const statsPeriod = period; // e.g., "24h", "7d", "30d"
        if (period.endsWith('d')) {
            const days = parseInt(period);
            startDate.setDate(now.getDate() - days);
        }
        else if (period.endsWith('h')) {
            const hours = parseInt(period);
            startDate.setHours(now.getHours() - hours);
        }
        else {
            // Default to 7 days
            startDate.setDate(now.getDate() - 7);
            statsPeriod = '7d';
        }
        // Format dates for Sentry API
        const statsPeriodStart = startDate.toISOString();
        const statsPeriodEnd = now.toISOString();
        // Query Sentry API
        const url = `https://sentry.io/api/0/organizations/${SENTRY_ORG}/events-stats/?project=${SENTRY_PROJECT}&statsPeriod=${statsPeriod}&interval=1d&field=count()`;
        const response = await (0, node_fetch_1.default)(url, {
            headers: {
                'Authorization': `Bearer ${SENTRY_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`Sentry API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        // Process the data
        const errorTrends = data.data.map((point) => ({
            date: new Date(point[0] * 1000).toISOString().split('T')[0],
            count: point[1]
        }));
        return errorTrends;
    }
    catch (error) {
        logger_1.logger.error('Error fetching error trends from Sentry:', error);
        return getMockErrorTrends(period);
    }
};
exports.getSentryErrorTrends = getSentryErrorTrends;
/**
 * Get mock error trends for when Sentry is not configured
 */
const getMockErrorTrends = (period) => {
    const now = new Date();
    const results = [];
    let days = 7;
    if (period.endsWith('d')) {
        days = parseInt(period);
    }
    else if (period.endsWith('h')) {
        days = Math.ceil(parseInt(period) / 24);
    }
    // Generate mock data
    for (let i = 0; i < days; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        results.unshift({
            date: date.toISOString().split('T')[0],
            count: Math.floor(Math.random() * 10) // Random count between 0-10
        });
    }
    return results;
};
/**
 * Get most frequent errors from Sentry
 */
const getSentryFrequentErrors = async (limit) => {
    try {
        if (!isSentryConfigured()) {
            logger_1.logger.warn('Sentry is not configured for API access, returning mock data');
            return getMockFrequentErrors(limit);
        }
        // Query Sentry API for issues
        const url = `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?query=is:unresolved&sort=freq&statsPeriod=14d&limit=${limit}`;
        const response = await (0, node_fetch_1.default)(url, {
            headers: {
                'Authorization': `Bearer ${SENTRY_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`Sentry API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        // Process the data
        const frequentErrors = data.map((issue) => ({
            id: issue.id,
            title: issue.title,
            count: issue.count,
            userCount: issue.userCount,
            lastSeen: issue.lastSeen,
            level: issue.level,
            link: `https://sentry.io/organizations/${SENTRY_ORG}/issues/${issue.id}/`
        }));
        return frequentErrors;
    }
    catch (error) {
        logger_1.logger.error('Error fetching frequent errors from Sentry:', error);
        return getMockFrequentErrors(limit);
    }
};
exports.getSentryFrequentErrors = getSentryFrequentErrors;
/**
 * Get mock frequent errors for when Sentry is not configured
 */
const getMockFrequentErrors = (limit) => {
    const mockErrors = [
        {
            id: 'mock-1',
            title: 'TypeError: Cannot read property of undefined',
            count: 28,
            userCount: 15,
            lastSeen: new Date().toISOString(),
            level: 'error',
            link: '#'
        },
        {
            id: 'mock-2',
            title: 'Failed to fetch recipe data from OpenAI',
            count: 17,
            userCount: 12,
            lastSeen: new Date().toISOString(),
            level: 'error',
            link: '#'
        },
        {
            id: 'mock-3',
            title: 'Database query timeout in recipe lookup',
            count: 14,
            userCount: 9,
            lastSeen: new Date().toISOString(),
            level: 'error',
            link: '#'
        },
        {
            id: 'mock-4',
            title: 'Missing required parameter in recipe generation',
            count: 12,
            userCount: 10,
            lastSeen: new Date().toISOString(),
            level: 'warning',
            link: '#'
        },
        {
            id: 'mock-5',
            title: 'Image generation failed: DALL-E API error',
            count: 10,
            userCount: 8,
            lastSeen: new Date().toISOString(),
            level: 'error',
            link: '#'
        }
    ];
    return mockErrors.slice(0, limit);
};
/**
 * Get user impact assessment from Sentry
 */
const getSentryUserImpact = async () => {
    try {
        if (!isSentryConfigured()) {
            logger_1.logger.warn('Sentry is not configured for API access, returning mock data');
            return getMockUserImpact();
        }
        // This would typically need multiple API calls to Sentry 
        // and some server-side calculation to determine impact
        // 1. Get total users affected
        const usersUrl = `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/user-stats/?statsPeriod=14d`;
        const usersResponse = await (0, node_fetch_1.default)(usersUrl, {
            headers: {
                'Authorization': `Bearer ${SENTRY_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        if (!usersResponse.ok) {
            throw new Error(`Sentry API error: ${usersResponse.status} ${usersResponse.statusText}`);
        }
        const usersData = await usersResponse.json();
        // 2. Get issues to determine impact by component
        const issuesUrl = `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?query=is:unresolved&statsPeriod=14d&limit=100`;
        const issuesResponse = await (0, node_fetch_1.default)(issuesUrl, {
            headers: {
                'Authorization': `Bearer ${SENTRY_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        if (!issuesResponse.ok) {
            throw new Error(`Sentry API error: ${issuesResponse.status} ${issuesResponse.statusText}`);
        }
        const issuesData = await issuesResponse.json();
        // Process data to determine component impact
        const componentMap = {};
        let totalUserImpact = 0;
        issuesData.forEach((issue) => {
            // Try to determine component from tags or metadata
            let component = 'unknown';
            if (issue.tags && issue.tags.some((tag) => tag.key === 'component')) {
                const componentTag = issue.tags.find((tag) => tag.key === 'component');
                component = componentTag.value;
            }
            else if (issue.title) {
                // Try to guess component from title
                if (issue.title.toLowerCase().includes('recipe')) {
                    component = 'recipe';
                }
                else if (issue.title.toLowerCase().includes('image')) {
                    component = 'image';
                }
                else if (issue.title.toLowerCase().includes('chat')) {
                    component = 'chat';
                }
                else if (issue.title.toLowerCase().includes('subscription')) {
                    component = 'subscription';
                }
            }
            // Count unique users impacted
            if (issue.userCount) {
                totalUserImpact += issue.userCount;
                componentMap[component] = (componentMap[component] || 0) + issue.userCount;
            }
        });
        // Calculate impact by component
        const impactByComponent = Object.entries(componentMap).map(([component, users]) => ({
            component,
            usersImpacted: users,
            percentage: totalUserImpact > 0 ? (users / totalUserImpact) * 100 : 0
        }));
        return {
            totalUsersImpacted: usersData.total || 0,
            percentageOfAllUsers: usersData.totalUsers > 0
                ? ((usersData.total || 0) / usersData.totalUsers) * 100
                : 0,
            impactByComponent
        };
    }
    catch (error) {
        logger_1.logger.error('Error fetching user impact data from Sentry:', error);
        return getMockUserImpact();
    }
};
exports.getSentryUserImpact = getSentryUserImpact;
/**
 * Get mock user impact data for when Sentry is not configured
 */
const getMockUserImpact = () => {
    return {
        totalUsersImpacted: 45,
        percentageOfAllUsers: 3.2,
        impactByComponent: [
            { component: 'recipe', usersImpacted: 20, percentage: 44.4 },
            { component: 'image', usersImpacted: 12, percentage: 26.7 },
            { component: 'chat', usersImpacted: 8, percentage: 17.8 },
            { component: 'subscription', usersImpacted: 5, percentage: 11.1 }
        ]
    };
};
/**
 * Get recent error count (last 24 hours)
 */
const getRecentErrorCount = async () => {
    try {
        if (!isSentryConfigured()) {
            // Return a random count between 0-20 for mock data
            return Math.floor(Math.random() * 20);
        }
        // Query Sentry API for recent errors
        const url = `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/stats/?stat=received&resolution=1h&statsPeriod=24h`;
        const response = await (0, node_fetch_1.default)(url, {
            headers: {
                'Authorization': `Bearer ${SENTRY_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`Sentry API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        // Sum up all errors received in the period
        const totalErrors = data.reduce((sum, point) => sum + point[1], 0);
        return totalErrors;
    }
    catch (error) {
        logger_1.logger.error('Error getting recent error count from Sentry:', error);
        // Return a random count between 0-20 for mock data on error
        return Math.floor(Math.random() * 20);
    }
};
exports.getRecentErrorCount = getRecentErrorCount;
/**
 * Get error trend over a period
 */
const getErrorTrend = async (period) => {
    // We can reuse the getSentryErrorTrends function
    return await (0, exports.getSentryErrorTrends)(period);
};
exports.getErrorTrend = getErrorTrend;
//# sourceMappingURL=errorService.js.map