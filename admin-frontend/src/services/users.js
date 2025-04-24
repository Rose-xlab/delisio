import api from './api';

export const getUsers = async (params = {}) => {
  try {
    const response = await api.get('/admin/users', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export const getUserDetails = async (userId) => {
  try {
    const response = await api.get(`/admin/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching user ${userId}:`, error);
    throw error;
  }
};

export const updateUserSubscription = async (userId, tier) => {
  try {
    const response = await api.post(`/admin/users/${userId}/subscription`, { tier });
    return response.data;
  } catch (error) {
    console.error(`Error updating subscription for user ${userId}:`, error);
    throw error;
  }
};

export const resetUserLimits = async (userId) => {
  try {
    const response = await api.post(`/admin/users/${userId}/reset-limits`);
    return response.data;
  } catch (error) {
    console.error(`Error resetting limits for user ${userId}:`, error);
    throw error;
  }
};