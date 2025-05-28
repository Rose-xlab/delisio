// src/models/User.ts

/**
 * Interface for user preferences
 * All array fields are now arrays (defaulting to empty if not present from DB),
 * and likedFoodCategoryIds is included.
 */
export interface UserPreferences {
  dietaryRestrictions: string[];
  favoriteCuisines: string[];
  allergies: string[];
  cookingSkill: 'beginner' | 'intermediate' | 'advanced';
  likedFoodCategoryIds: string[]; // Now non-optional, will default to [] if not present in source
}

/**
 * Interface for user model (Backend representation)
 */
export interface User { // This is your BackendUserModel
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  preferences?: UserPreferences; // This will now use the UserPreferences above
}

/**
 * Validates user data (your existing function)
 */
export const validateUser = (userData: any): boolean => {
  if (!userData || typeof userData.email !== 'string' || typeof userData.name !== 'string') {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(userData.email)) {
    return false;
  }
  return true;
};

/**
 * Validates user preferences (your existing function, updated for likedFoodCategoryIds)
 */
export const validateUserPreferences = (preferences: any): boolean => {
  if (!preferences || typeof preferences !== 'object') return false;

  const validSkills = ['beginner', 'intermediate', 'advanced'];
  if (preferences.cookingSkill && !validSkills.includes(preferences.cookingSkill)) {
    return false;
  }
  // If cookingSkill is mandatory, uncomment:
  // if (!preferences.cookingSkill || !validSkills.includes(preferences.cookingSkill)) return false;


  const fieldsToValidateAsArrays: string[] = [ // Use string array for keys
    'dietaryRestrictions',
    'favoriteCuisines',
    'allergies',
    'likedFoodCategoryIds'
  ];

  for (const field of fieldsToValidateAsArrays) {
    // If the field exists, it must be an array of strings.
    // If it doesn't exist, it's fine because our interface allows them to be undefined before defaulting.
    if (preferences[field] !== undefined) {
        if (!Array.isArray(preferences[field])) return false;
        if (!(preferences[field] as any[]).every((item: any) => typeof item === 'string')) return false;
    }
  }
  return true;
};