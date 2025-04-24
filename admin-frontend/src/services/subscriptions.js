import api from './api';

/**
 * Get overview of subscription tiers
 */
export const getTiersOverview = async () => {
  try {
    const response = await api.get('/admin/subscriptions/tiers');
    return response.data;
  } catch (error) {
    console.error('Error fetching subscription tiers overview:', error);
    throw error;
  }
};

/**
 * Get revenue metrics for a specified period
 */
export const getRevenueMetrics = async (period = '30d') => {
  try {
    const response = await api.get('/admin/subscriptions/revenue', {
      params: { period }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching revenue metrics:', error);
    throw error;
  }
};

/**
 * Get churn analysis for a specified period
 */
export const getChurnAnalysis = async (period = '90d') => {
  try {
    const response = await api.get('/admin/subscriptions/churn', {
      params: { period }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching churn analysis:', error);
    throw error;
  }
};

/**
 * Get conversion rates between subscription tiers
 */
export const getConversionRates = async () => {
  try {
    const response = await api.get('/admin/subscriptions/conversions');
    return response.data;
  } catch (error) {
    console.error('Error fetching conversion rates:', error);
    throw error;
  }
};