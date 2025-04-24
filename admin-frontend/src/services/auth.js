import api from './api';

/**
 * Log in to the admin dashboard
 * @param {string} email - Admin email
 * @param {string} password - Admin password
 * @returns {Promise<object>} User session data
 */
export const login = async (email, password) => {
  try {
    const response = await api.post('/auth/signin', { email, password });
    
    if (response.data?.session?.access_token) {
      localStorage.setItem('nord_admin_token', response.data.session.access_token);
      localStorage.setItem('nord_admin_user', JSON.stringify(response.data.user));
    }
    
    return response.data;
  } catch (error) {
    console.error('Login error:', error);
    
    // Enhance error handling with more specific messages
    if (error.response) {
      if (error.response.status === 401) {
        throw new Error('Invalid email or password');
      } else if (error.response.status === 403) {
        throw new Error('You do not have admin privileges');
      } else {
        throw new Error(`Login failed: ${error.response.data?.message || 'Server error'}`);
      }
    }
    
    throw error;
  }
};

/**
 * Log out from the admin dashboard
 */
export const logout = async () => {
  try {
    await api.post('/auth/signout');
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Always clear local storage regardless of API success
    localStorage.removeItem('nord_admin_token');
    localStorage.removeItem('nord_admin_user');
  }
};

/**
 * Get the current user from localStorage
 * @returns {object|null} User object or null if not logged in
 */
export const getCurrentUser = () => {
  try {
    const userStr = localStorage.getItem('nord_admin_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user;
    }
    return null;
  } catch (error) {
    console.error('Error getting current user from storage:', error);
    return null;
  }
};

/**
 * Check if user has admin access by pinging an admin-only endpoint
 * @returns {Promise<boolean>} True if user has admin access
 */
export const checkAdminAccess = async () => {
  try {
    // Try to access an admin-only endpoint
    await api.get('/admin/dashboard/stats');
    return true;
  } catch (error) {
    if (error.response && error.response.status === 403) {
      return false;
    }
    throw error;
  }
};

/**
 * Verify if the current authentication token is valid
 * @returns {Promise<boolean>} True if token is valid
 */
export const verifyAuthToken = async () => {
  try {
    const token = localStorage.getItem('nord_admin_token');
    if (!token) {
      return false;
    }
    
    // Attempt to access a protected route
    await api.get('/admin/auth/verify');
    return true;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      // Token is invalid, clear storage
      localStorage.removeItem('nord_admin_token');
      localStorage.removeItem('nord_admin_user');
      return false;
    }
    // For other errors, assume token might still be valid
    console.error('Error verifying auth token:', error);
    return true;
  }
};