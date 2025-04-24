import api from './api';

export const getQueueStatus = async () => {
  try {
    const response = await api.get('/admin/jobs/queues');
    return response.data;
  } catch (error) {
    console.error('Error fetching queue status:', error);
    throw error;
  }
};

export const getFailedJobs = async (params = {}) => {
  try {
    const response = await api.get('/admin/jobs/failed', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching failed jobs:', error);
    throw error;
  }
};

export const retryJob = async (jobId, queue) => {
  try {
    const response = await api.post(`/admin/jobs/${jobId}/retry`, { queue });
    return response.data;
  } catch (error) {
    console.error(`Error retrying job ${jobId}:`, error);
    throw error;
  }
};

export const cancelJob = async (jobId, queue) => {
  try {
    const response = await api.post(`/admin/jobs/${jobId}/cancel`, { queue });
    return response.data;
  } catch (error) {
    console.error(`Error cancelling job ${jobId}:`, error);
    throw error;
  }
};

export const getPerformanceMetrics = async (queue, period) => {
  try {
    const response = await api.get('/admin/jobs/performance', {
      params: { queue, period }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching job performance metrics:', error);
    throw error;
  }
};