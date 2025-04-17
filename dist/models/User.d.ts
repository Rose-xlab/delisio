/**
 * Interface for user preferences
 */
export interface UserPreferences {
    dietaryRestrictions: string[];
    favoriteCuisines: string[];
    allergies: string[];
    cookingSkill: 'beginner' | 'intermediate' | 'advanced';
}
/**
 * Interface for user model
 */
export interface User {
    id: string;
    email: string;
    name: string;
    createdAt: Date;
    preferences?: UserPreferences;
}
/**
 * Validates user data
 * @param userData User data to validate
 * @returns Boolean indicating if user data is valid
 */
export declare const validateUser: (userData: any) => boolean;
/**
 * Validates user preferences
 * @param preferences User preferences to validate
 * @returns Boolean indicating if preferences are valid
 */
export declare const validateUserPreferences: (preferences: any) => boolean;
