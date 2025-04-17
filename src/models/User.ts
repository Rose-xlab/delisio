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
  export const validateUser = (userData: any): boolean => {
    // Check if user has required fields
    if (!userData.email || !userData.name) {
      return false;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      return false;
    }
    
    return true;
  };
  
  /**
   * Validates user preferences
   * @param preferences User preferences to validate
   * @returns Boolean indicating if preferences are valid
   */
  export const validateUserPreferences = (preferences: any): boolean => {
    // Check if preferences has required fields
    if (!preferences.cookingSkill) {
      return false;
    }
    
    // Validate cooking skill value
    const validSkills = ['beginner', 'intermediate', 'advanced'];
    if (!validSkills.includes(preferences.cookingSkill)) {
      return false;
    }
    
    // Validate arrays
    if (preferences.dietaryRestrictions && !Array.isArray(preferences.dietaryRestrictions)) {
      return false;
    }
    
    if (preferences.favoriteCuisines && !Array.isArray(preferences.favoriteCuisines)) {
      return false;
    }
    
    if (preferences.allergies && !Array.isArray(preferences.allergies)) {
      return false;
    }
    
    return true;
  };