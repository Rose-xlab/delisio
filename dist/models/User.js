"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUserPreferences = exports.validateUser = void 0;
/**
 * Validates user data
 * @param userData User data to validate
 * @returns Boolean indicating if user data is valid
 */
const validateUser = (userData) => {
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
exports.validateUser = validateUser;
/**
 * Validates user preferences
 * @param preferences User preferences to validate
 * @returns Boolean indicating if preferences are valid
 */
const validateUserPreferences = (preferences) => {
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
exports.validateUserPreferences = validateUserPreferences;
//# sourceMappingURL=User.js.map