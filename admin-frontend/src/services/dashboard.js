import api from './api';

export const getDashboardStats = async () => {
  try {
    const response = await api.get('/admin/dashboard/stats');
    return response.data;
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    throw error;
  }
};

export const getDashboardTrends = async (period = '30d') => {
  try {
    const response = await api.get('/admin/dashboard/trends', {
      params: { period }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching dashboard trends:', error);
    throw error;
  }
};