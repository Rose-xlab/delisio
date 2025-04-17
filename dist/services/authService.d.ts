import { User } from '../models/User';
/**
 * Signs up a new user with email and password
 * @param email User's email
 * @param password User's password
 * @param name User's name
 * @returns User object if successful
 */
export declare const signUp: (email: string, password: string, name: string) => Promise<User>;
/**
 * Signs in a user with email and password
 * @param email User's email
 * @param password User's password
 * @returns User object and session if successful
 */
export declare const signIn: (email: string, password: string) => Promise<{
    user: User;
    session: any;
}>;
/**
 * Signs out the current user
 */
export declare const signOut: () => Promise<void>;
/**
 * Gets the current user from session
 * @returns User object if there is an active session
 */
export declare const getCurrentUser: () => Promise<User | null>;
/**
 * Verifies a JWT token from the request
 * @param token JWT token from request headers
 * @returns User object if token is valid
 */
export declare const verifyToken: (token: string) => Promise<User | null>;
/**
 * Sends a password reset email
 * @param email User's email
 */
export declare const resetPassword: (email: string) => Promise<void>;
