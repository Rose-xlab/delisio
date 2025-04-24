// src/admin/services/errorService.ts
import fetch from 'node-fetch';
import { logger } from '../../utils/logger';

// --- Define expected structures from Sentry API ---
interface SentryStatsDataPoint {
  date: string;
  count: number;
}

interface SentryIssue {
  id: string;
  title: string;
  count?: number; // Make count optional as it might be missing
  userCount?: number; // Make userCount optional
  lastSeen: string;
  level: string;
  permalink?: string; // Use permalink if available
  metadata?: { // Include metadata if used for component guessing
      filename?: string;
  };
  tags?: { key: string; value: string }[]; // Include tags if used
}

// Type for the Sentry Stats API response
interface SentryStatsResponse {
    data: [number, { count: number }[]][]; // Array of [timestamp, [{count: number}]]
}

// Type for the Sentry Issues API response
type SentryIssuesResponse = SentryIssue[];


// Environment variables for Sentry
const SENTRY_TOKEN = process.env.SENTRY_AUTH_TOKEN;
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
export const getSentryErrorTrends = async (period: string): Promise<SentryStatsDataPoint[]> => { // Added return type
  try {
    if (!isSentryConfigured()) {
      logger.warn('Sentry is not configured for API access, returning mock data');
      return getMockErrorTrends(period);
    }

    // Parse period to get start date
    const now = new Date();
    let startDate = new Date();
    // FIX: Declare statsPeriod with let to allow reassignment
    let statsPeriod = period; // e.g., "24h", "7d", "30d"

    if (period.endsWith('d')) {
      const days = parseInt(period);
      if (!isNaN(days)) { // Ensure parsing was successful
          startDate.setDate(now.getDate() - days);
      } else {
           logger.warn(`Invalid day period format '${period}'. Defaulting to 7d.`);
           startDate.setDate(now.getDate() - 7);
           statsPeriod = '7d'; // Assign default period
      }
    } else if (period.endsWith('h')) {
      const hours = parseInt(period);
       if (!isNaN(hours)) { // Ensure parsing was successful
           startDate.setHours(now.getHours() - hours);
       } else {
            logger.warn(`Invalid hour period format '${period}'. Defaulting to 7d.`);
            startDate.setDate(now.getDate() - 7); // Fallback to default days
            statsPeriod = '7d'; // Assign default period
       }
    } else {
      // Default to 7 days if format is unrecognized
      logger.warn(`Unrecognized period format '${period}'. Defaulting to 7d.`);
      startDate.setDate(now.getDate() - 7);
      statsPeriod = '7d'; // Assign default period
    }

    const interval = statsPeriod.endsWith('h') ? '1h' : '1d';
    const url = `https://sentry.io/api/0/organizations/${SENTRY_ORG}/events-stats/?project=${SENTRY_PROJECT}&statsPeriod=${statsPeriod}&interval=${interval}&field=count()&query=`;

    logger.info(`Querying Sentry stats: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${SENTRY_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(`Sentry API error: ${response.status} ${response.statusText}. Body: ${errorBody}`);
      throw new Error(`Sentry API error: ${response.status} ${response.statusText}`);
    }

    // Explicitly type the response data
    const responseData: SentryStatsResponse = await response.json();

    if (!responseData || !Array.isArray(responseData.data)) {
         logger.error('Unexpected Sentry API response format:', responseData);
         throw new Error('Unexpected data format received from Sentry API.');
    }

    // Process the data using the defined structure
    const errorTrends = responseData.data.map((point: [number, { count: number }[]]) => { // Type for point inferred here
        const countObject = point[1]?.[0];
        return {
          date: new Date(point[0] * 1000).toISOString().split('T')[0],
          count: countObject?.count || 0
        };
    }).filter((item): item is SentryStatsDataPoint => item.count !== undefined); // Type guard ensures correct type


    return errorTrends;
  } catch (error) {
    logger.error('Error fetching error trends from Sentry:', error);
    return getMockErrorTrends(period);
  }
};

/**
 * Get mock error trends for when Sentry is not configured or on error
 */
const getMockErrorTrends = (period: string): SentryStatsDataPoint[] => { // Added return type
  const now = new Date();
  const results: SentryStatsDataPoint[] = []; // Use defined type
  let days = 7; // Default
  const periodMatch = period.match(/^(\d+)([dh])$/);

  if (periodMatch) {
      const value = parseInt(periodMatch[1]);
      const unit = periodMatch[2];
      if (unit === 'd') days = value;
      else if (unit === 'h') days = Math.max(1, Math.ceil(value / 24));
  }
  days = Math.min(days, 90);


  // Generate mock data
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    results.unshift({ // Add to beginning so oldest is first
      date: date.toISOString().split('T')[0],
      count: Math.floor(Math.random() * 10) + i
    });
  }

  return results;
};

/**
 * Get most frequent errors from Sentry
 */
export const getSentryFrequentErrors = async (limit: number): Promise<any[]> => { // Consider defining a specific return type too
  try {
    if (!isSentryConfigured()) {
      logger.warn('Sentry is not configured for API access, returning mock data');
      return getMockFrequentErrors(limit);
    }

    const statsPeriod = '14d';
    const query = 'is:unresolved';
    const url = `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?query=${query}&sort=freq&statsPeriod=${statsPeriod}&limit=${limit}`;

    logger.info(`Querying Sentry frequent errors: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${SENTRY_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
       const errorBody = await response.text();
       logger.error(`Sentry API error fetching frequent errors: ${response.status} ${response.statusText}. Body: ${errorBody}`);
      throw new Error(`Sentry API error: ${response.status} ${response.statusText}`);
    }

    // Explicitly type the response data as an array of SentryIssue
    const responseData: SentryIssuesResponse = await response.json();

    // Process the data using the SentryIssue type
    // FIX: Apply SentryIssue type to the map parameter 'issue'
    const frequentErrors = responseData.map((issue: SentryIssue) => ({
      id: issue.id,
      title: issue.title,
      count: issue.count || 0,
      userCount: issue.userCount || 0,
      lastSeen: issue.lastSeen,
      level: issue.level,
      link: issue.permalink || `https://sentry.io/organizations/${SENTRY_ORG}/issues/${issue.id}/`
    }));

    return frequentErrors;
  } catch (error) {
    logger.error('Error fetching frequent errors from Sentry:', error);
    return getMockFrequentErrors(limit);
  }
};

/**
 * Get mock frequent errors for when Sentry is not configured or on error
 */
const getMockFrequentErrors = (limit: number): any[] => {
  const mockErrors = [
    {
      id: 'mock-1', title: 'TypeError: Cannot read property of undefined', count: 28, userCount: 15,
      lastSeen: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), level: 'error', link: '#'
    },
    {
      id: 'mock-2', title: 'Failed to fetch recipe data from OpenAI', count: 17, userCount: 12,
      lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), level: 'error', link: '#'
    },
    {
      id: 'mock-3', title: 'Database query timeout in recipe lookup', count: 14, userCount: 9,
      lastSeen: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), level: 'error', link: '#'
    },
     {
       id: 'mock-4', title: 'Missing required parameter in recipe generation', count: 12, userCount: 10,
       lastSeen: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(), level: 'warning', link: '#'
     },
     {
       id: 'mock-5', title: 'Image generation failed: DALL-E API error', count: 10, userCount: 8,
       lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), level: 'error', link: '#'
     }
  ];

  return mockErrors.slice(0, limit);
};

/**
 * Get user impact assessment from Sentry (Simplified Example)
 */
export const getSentryUserImpact = async (): Promise<any> => {
  try {
    if (!isSentryConfigured()) {
      logger.warn('Sentry is not configured for API access, returning mock user impact data');
      return getMockUserImpact();
    }

    const statsPeriod = '14d';
    const limit = 100;
    const issuesUrl = `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?query=is:unresolved&sort=user&statsPeriod=${statsPeriod}&limit=${limit}`;

    logger.info(`Querying Sentry user impact (issues): ${issuesUrl}`);

    const issuesResponse = await fetch(issuesUrl, {
      headers: {
        'Authorization': `Bearer ${SENTRY_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!issuesResponse.ok) {
       const errorBody = await issuesResponse.text();
       logger.error(`Sentry API error fetching issues for user impact: ${issuesResponse.status} ${issuesResponse.statusText}. Body: ${errorBody}`);
      throw new Error(`Sentry API error: ${issuesResponse.status} ${issuesResponse.statusText}`);
    }

    // Use the defined SentryIssue type
    const issuesData: SentryIssuesResponse = await issuesResponse.json();

    const componentUserCount: Record<string, number> = {};
    let totalUserImpactCount = 0;

    // FIX: Apply SentryIssue type to the forEach parameter 'issue'
    issuesData.forEach((issue: SentryIssue) => {
      const currentUserCount = issue.userCount || 0; // Use 0 if undefined
      if (currentUserCount === 0) return;

      totalUserImpactCount += currentUserCount;

      let component = 'unknown';
      const componentTag = issue.tags?.find((tag: any) => tag.key === 'component'); // 'any' for tag ok here or define tag type
      if (componentTag?.value) {
        component = componentTag.value;
      } else if (issue.metadata?.filename?.includes('/workers/')) {
          component = issue.metadata.filename.split('/workers/')[1].split('.')[0] + ' worker';
      } else if (issue.title) {
          if (issue.title.toLowerCase().includes('recipe')) component = 'recipe';
          else if (issue.title.toLowerCase().includes('image')) component = 'image';
          else if (issue.title.toLowerCase().includes('chat')) component = 'chat';
          else if (issue.title.toLowerCase().includes('subscription')) component = 'subscription';
          else if (issue.title.toLowerCase().includes('user')) component = 'user service';
      }

      componentUserCount[component] = (componentUserCount[component] || 0) + currentUserCount;
    });


    // Format component impact data
    const impactByComponent = Object.entries(componentUserCount)
        .map(([component, users]) => ({
            component,
            usersImpacted: users,
            percentage: totalUserImpactCount > 0 ? parseFloat(((users / totalUserImpactCount) * 100).toFixed(1)) : 0
        }))
        .sort((a, b) => b.usersImpacted - a.usersImpacted);

    const estimatedTotalUsers = 1000;

    return {
      totalUsersImpactedApproximation: totalUserImpactCount,
      percentageOfAllUsersApproximation: estimatedTotalUsers > 0
        ? parseFloat(((totalUserImpactCount / estimatedTotalUsers) * 100).toFixed(1))
        : 0,
      impactByComponent
    };
  } catch (error) {
    logger.error('Error fetching user impact data from Sentry:', error);
    return getMockUserImpact();
  }
};

/**
 * Get mock user impact data for when Sentry is not configured or on error
 */
const getMockUserImpact = (): any => {
  return {
    totalUsersImpactedApproximation: 45,
    percentageOfAllUsersApproximation: 3.2,
    impactByComponent: [
      { component: 'recipe', usersImpacted: 20, percentage: 44.4 },
      { component: 'image', usersImpacted: 12, percentage: 26.7 },
      { component: 'chat', usersImpacted: 8, percentage: 17.8 },
      { component: 'subscription', usersImpacted: 5, percentage: 11.1 }
    ]
  };
};

/**
 * Get recent error count (last 24 hours) from Sentry stats
 */
export const getRecentErrorCount = async (): Promise<number> => {
  try {
    if (!isSentryConfigured()) {
      logger.warn('Sentry not configured, returning mock recent error count.');
      return Math.floor(Math.random() * 20);
    }

    const url = `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/stats/?stat=received&since=${Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000)}`;

    logger.info(`Querying Sentry recent errors: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${SENTRY_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(`Sentry API error getting recent error count: ${response.status} ${response.statusText}. Body: ${errorBody}`);
      throw new Error(`Sentry API error: ${response.status} ${response.statusText}`);
    }

    const responseData: any = await response.json();

    let totalErrors = 0;
     if (Array.isArray(responseData)) {
         // Assuming structure [ [timestamp, count], ... ]
         totalErrors = responseData.reduce((sum: number, point: [number, number]) => sum + (point?.[1] || 0), 0); // Add check for point[1]
     } else if (responseData?.totals?.received) {
         // Assuming structure { totals: { received: number } }
         totalErrors = responseData.totals.received;
     } else {
         logger.warn('Unexpected format for Sentry recent error count:', responseData);
     }

    return totalErrors;
  } catch (error) {
    logger.error('Error getting recent error count from Sentry:', error);
    return Math.floor(Math.random() * 20);
  }
};

/**
 * Get error trend over a period (Reuses getSentryErrorTrends)
 */
export const getErrorTrend = async (period: string): Promise<SentryStatsDataPoint[]> => { // Added return type
  return await getSentryErrorTrends(period);
};