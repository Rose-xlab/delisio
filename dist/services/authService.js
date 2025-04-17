"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.verifyToken = exports.getCurrentUser = exports.signOut = exports.signIn = exports.signUp = void 0;
const supabase_1 = require("../config/supabase");
const logger_1 = require("../utils/logger");
/**
 * Signs up a new user with email and password
 * @param email User's email
 * @param password User's password
 * @param name User's name
 * @returns User object if successful
 */
const signUp = async (email, password, name) => {
    try {
        // Create user in Supabase auth
        const { data, error } = await supabase_1.supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name
                }
            }
        });
        if (error) {
            logger_1.logger.error('Error signing up user:', error);
            throw error;
        }
        if (!data.user) {
            throw new Error('Failed to create user');
        }
        return {
            id: data.user.id,
            email: data.user.email || '',
            name: data.user.user_metadata.full_name || '',
            createdAt: new Date(data.user.created_at || Date.now())
        };
    }
    catch (error) {
        logger_1.logger.error('Error signing up:', error);
        throw new Error(`Failed to sign up: ${error.message}`);
    }
};
exports.signUp = signUp;
/**
 * Signs in a user with email and password
 * @param email User's email
 * @param password User's password
 * @returns User object and session if successful
 */
const signIn = async (email, password) => {
    try {
        const { data, error } = await supabase_1.supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) {
            logger_1.logger.error('Error signing in user:', error);
            throw error;
        }
        if (!data.user || !data.session) {
            throw new Error('Failed to sign in');
        }
        const user = {
            id: data.user.id,
            email: data.user.email || '',
            name: data.user.user_metadata.full_name || '',
            createdAt: new Date(data.user.created_at || Date.now())
        };
        return { user, session: data.session };
    }
    catch (error) {
        logger_1.logger.error('Error signing in:', error);
        throw new Error(`Failed to sign in: ${error.message}`);
    }
};
exports.signIn = signIn;
/**
 * Signs out the current user
 */
const signOut = async () => {
    try {
        const { error } = await supabase_1.supabase.auth.signOut();
        if (error) {
            logger_1.logger.error('Error signing out user:', error);
            throw error;
        }
    }
    catch (error) {
        logger_1.logger.error('Error signing out:', error);
        throw new Error(`Failed to sign out: ${error.message}`);
    }
};
exports.signOut = signOut;
/**
 * Gets the current user from session
 * @returns User object if there is an active session
 */
const getCurrentUser = async () => {
    try {
        const { data, error } = await supabase_1.supabase.auth.getUser();
        if (error) {
            logger_1.logger.error('Error getting current user:', error);
            throw error;
        }
        if (!data.user) {
            return null;
        }
        return {
            id: data.user.id,
            email: data.user.email || '',
            name: data.user.user_metadata.full_name || '',
            createdAt: new Date(data.user.created_at || Date.now())
        };
    }
    catch (error) {
        logger_1.logger.error('Error getting current user:', error);
        return null;
    }
};
exports.getCurrentUser = getCurrentUser;
/**
 * Verifies a JWT token from the request
 * @param token JWT token from request headers
 * @returns User object if token is valid
 */
const verifyToken = async (token) => {
    try {
        const { data, error } = await supabase_1.supabase.auth.getUser(token);
        if (error) {
            logger_1.logger.error('Error verifying token:', error);
            throw error;
        }
        if (!data.user) {
            return null;
        }
        return {
            id: data.user.id,
            email: data.user.email || '',
            name: data.user.user_metadata.full_name || '',
            createdAt: new Date(data.user.created_at || Date.now())
        };
    }
    catch (error) {
        logger_1.logger.error('Error verifying token:', error);
        return null;
    }
};
exports.verifyToken = verifyToken;
/**
 * Sends a password reset email
 * @param email User's email
 */
const resetPassword = async (email) => {
    try {
        const { error } = await supabase_1.supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
        });
        if (error) {
            logger_1.logger.error('Error sending password reset:', error);
            throw error;
        }
    }
    catch (error) {
        logger_1.logger.error('Error sending password reset:', error);
        throw new Error(`Failed to send password reset: ${error.message}`);
    }
};
exports.resetPassword = resetPassword;
//# sourceMappingURL=authService.js.map