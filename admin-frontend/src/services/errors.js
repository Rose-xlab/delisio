import api from './api';

/**
 * Get error trends for a specific period
 */
export const getErrorTrends = async (period = '7d') => {
  try {
    const response = await api.get('/admin/errors/trends', {
      params: { period }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching error trends:', error);
    throw error;
  }
};

/**
 * Get most frequent errors
 */
export const getFrequentErrors = async (limit = 10) => {
  try {
    const response = await api.get('/admin/errors/frequent', {
      params: { limit }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching frequent errors:', error);
    throw error;
  }
};

/**
 * Get user impact data
 */
export const getUserImpact = async () => {
  try {
    const response = await api.get('/admin/errors/impact');
    return response.data;
  } catch (error) {
    console.error('Error fetching user impact data:', error);
    throw error;
  }
};