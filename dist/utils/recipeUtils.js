"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSimilarityHash = void 0;
exports.extractMainIngredients = extractMainIngredients;
exports.normalizeText = normalizeText;
exports.calculateJaccardSimilarity = calculateJaccardSimilarity;
exports.categorizeRecipe = categorizeRecipe;
exports.parseTimeToMinutes = parseTimeToMinutes;
exports.getRecipePreview = getRecipePreview;
exports.generateRecipeTags = generateRecipeTags;
exports.calculateBasicQualityScore = calculateBasicQualityScore;
const crypto_1 = require("crypto");
const categories_1 = require("../config/categories"); // Assuming this import is correct
/**
 * Generates a similarity hash for a recipe for quick comparison
 * @param recipe The recipe to generate a hash for
 * @returns A hash string that can be used for similarity comparison
 */
const generateSimilarityHash = (recipe) => {
    // Analyze the recipe's ingredients to get main ingredients
    const mainIngredients = extractMainIngredients(recipe.ingredients);
    // Create a normalized string representation of key recipe elements
    const normalizedTitle = normalizeText(recipe.title ?? ''); // Handle potential null/undefined defensively
    const mainIngredientsString = mainIngredients.sort().join('|'); // Should be string
    const servings = String(recipe.servings ?? 0); // Ensure string
    // Generate a SHA-256 hash of this string
    const hashInput = `${normalizedTitle}|${mainIngredientsString}|${servings}`; // Now guaranteed string
    // Use non-null assertion as previous fix
    const hash = (0, crypto_1.createHash)('sha256').update(hashInput).digest('hex');
    return hash;
};
exports.generateSimilarityHash = generateSimilarityHash;
/**
 * Extracts the main ingredients from a list of ingredient strings
 * @param ingredients List of ingredient strings with quantities, etc.
 * @returns Array of normalized ingredient names
 */
function extractMainIngredients(ingredients) {
    // Normalize the ingredients by removing quantities, units, and extra text
    const mainIngredients = ingredients.map(ingredient => {
        // Remove quantities (numbers with optional fractions and units)
        let processed = ingredient.replace(/^[\s*]*\d+(\s*\/\s*\d+)?(\s*(?:oz|g|kg|lb|cup|tsp|tbsp|ml|l|pinch|dash|clove|slice|piece)s?)?(\s+of)?\s+/i, '');
        // Remove descriptors like "fresh", "chopped", etc. - more comprehensive list
        processed = processed.replace(/\b(fresh|dried|chopped|minced|diced|sliced|grated|crushed|ground|finely|roughly|to taste|optional|for garnish|peeled|seeded|cored|rinsed|drained|cooked|uncooked|raw|frozen|thawed|at room temperature|softened|melted|divided)\b/gi, '');
        // Remove parenthetical notes
        processed = processed.replace(/\([^)]*\)/g, '');
        // Remove text after comma (often preparations or alternatives)
        processed = processed.split(',')[0];
        // Trim and lowercase
        return normalizeText(processed); // normalizeText removes punctuation and extra spaces
    }).filter(ing => ing.length > 2); // Filter out very short/empty results
    return mainIngredients;
}
/**
 * Normalizes text for comparison (lowercase, remove punctuation, normalize whitespace)
 * @param text Text to normalize
 * @returns Normalized text
 */
function normalizeText(text) {
    if (!text)
        return ''; // Handle null/undefined input
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]|_/g, '') // Remove punctuation including underscore
        .replace(/\s+/g, ' '); // Normalize whitespace
}
/**
 * Calculates Jaccard similarity between two sets of strings
 * @param set1 First set of strings
 * @param set2 Second set of strings
 * @returns Similarity score between 0 and 1
 */
function calculateJaccardSimilarity(set1, set2) {
    const set1Set = new Set(set1);
    const set2Set = new Set(set2);
    const intersectionSize = [...set1Set].filter(item => set2Set.has(item)).length;
    const unionSize = new Set([...set1Set, ...set2Set]).size;
    return unionSize === 0 ? 1 : intersectionSize / unionSize; // Avoid division by zero, treat empty sets as similar
}
/**
 * Categorizes a recipe based on its content
 * @param recipe The recipe to categorize
 * @returns Category ID string
 */
function categorizeRecipe(recipe) {
    // Extract text from steps
    const stepsText = recipe.steps.map(step => step.text);
    // Detect category
    return (0, categories_1.detectRecipeCategory)(recipe.title, recipe.ingredients, stepsText);
}
/**
 * Converts time descriptions to minutes
 * @param timeDescription String description of time (e.g., "1 hour 15 minutes", "45 min")
 * @returns Time in minutes as a number or null if unparseable
 */
function parseTimeToMinutes(timeDescription) {
    if (!timeDescription)
        return null;
    const normalized = timeDescription.toLowerCase();
    let totalMinutes = 0;
    // Extract hours (match "1 hour", "2 hr", "3h")
    const hoursMatch = normalized.match(/(\d+)\s*(?:hours?|hr|h)/);
    if (hoursMatch && hoursMatch[1]) {
        totalMinutes += parseInt(hoursMatch[1], 10) * 60;
    }
    // Extract minutes (match "15 minutes", "30 min", "45m")
    const minutesMatch = normalized.match(/(\d+)\s*(?:minutes?|min|m)/);
    if (minutesMatch && minutesMatch[1]) {
        if (!hoursMatch || !normalized.includes(minutesMatch[0])) {
            totalMinutes += parseInt(minutesMatch[1], 10);
        }
        else if (hoursMatch && normalized.indexOf(minutesMatch[0]) > normalized.indexOf(hoursMatch[0])) {
            totalMinutes += parseInt(minutesMatch[1], 10);
        }
    }
    // If ONLY a number is present, assume minutes
    if (totalMinutes === 0 && !hoursMatch && !minutesMatch) {
        const numberMatch = normalized.match(/^\s*(\d+)\s*$/);
        if (numberMatch && numberMatch[1]) {
            totalMinutes = parseInt(numberMatch[1], 10);
        }
    }
    return totalMinutes > 0 ? totalMinutes : null;
}
/**
 * Get a shorter preview of recipe instructions for display in lists
 * @param recipe The recipe to generate a preview for
 * @returns Short preview string (max 100 characters)
 */
function getRecipePreview(recipe) {
    if (recipe.steps && recipe.steps.length > 0) {
        const firstStepText = recipe.steps[0].text;
        if (firstStepText.length > 100) {
            return firstStepText.substring(0, 97) + '...';
        }
        return firstStepText;
    }
    return recipe.title;
}
/**
  * Generates search-friendly tags for a recipe
  * @param recipe The recipe to generate tags for
  * @returns Array of relevant search tags
  */
function generateRecipeTags(recipe) {
    const tags = new Set();
    const recipeCategory = recipe.category;
    if (recipeCategory && typeof recipeCategory === 'string') {
        tags.add(recipeCategory);
    }
    const cuisineTypes = ['italian', 'mexican', 'chinese', 'indian', 'japanese',
        'thai', 'french', 'greek', 'spanish', 'american',
        'mediterranean', 'korean', 'vietnamese'];
    const combinedTextForCuisine = (recipe.title + ' ' + recipe.ingredients.join(' ')).toLowerCase();
    for (const cuisine of cuisineTypes) {
        if (combinedTextForCuisine.includes(cuisine)) {
            tags.add(cuisine);
        }
    }
    const ingredientsLower = recipe.ingredients.join(' ').toLowerCase();
    const mainIngredientsLower = extractMainIngredients(recipe.ingredients).join(' ');
    const hasMeat = /beef|pork|lamb|chicken|turkey|duck|veal|sausage|bacon|ham|fish|salmon|tuna|shrimp|crab|lobster|mussel|clam|scallop|seafood/.test(mainIngredientsLower);
    const hasDairy = /milk|cheese|yogurt|butter|cream|sour cream|ghee/.test(ingredientsLower);
    const hasEgg = /egg/.test(ingredientsLower);
    const hasGluten = /wheat|flour|bread|pasta|noodle|barley|rye|semolina|couscous|bulgur|spelt|farro|kamut|gluten/.test(ingredientsLower);
    if (!hasMeat) {
        tags.add('vegetarian');
        if (!hasDairy && !hasEgg) {
            tags.add('vegan');
        }
    }
    if (!hasGluten) {
        tags.add('gluten-free');
    }
    if (recipe.totalTime && recipe.totalTime > 0 && recipe.totalTime <= 30) {
        tags.add('quick');
        tags.add('easy');
    }
    else if (recipe.totalTime && recipe.totalTime > 0 && recipe.totalTime <= 60) {
        tags.add('under-1-hour');
    }
    if (recipeCategory && tags.has(recipeCategory)) {
        tags.delete(recipeCategory);
    }
    return Array.from(tags);
}
/**
   * Calculate recipe quality score based on completeness and detail
   * @param recipe The recipe to evaluate
   * @returns Quality score (0-10)
   */
function calculateBasicQualityScore(recipe) {
    let score = 0;
    if (recipe.title && recipe.title.length > 5)
        score += 1;
    if (recipe.servings && recipe.servings > 0)
        score += 0.5;
    const ingredientsList = recipe.ingredients;
    if (ingredientsList && ingredientsList.length > 0) {
        score += 1;
        const currentIngredientsLength = ingredientsList.length;
        if (currentIngredientsLength >= 5)
            score += 0.5;
        if (currentIngredientsLength >= 10)
            score += 0.5;
        const detailedIngredientsCount = ingredientsList.filter(i => /\d/.test(i) ||
            /cup|tbsp|tsp|teaspoon|tablespoon|ounce|oz|pound|lb|gram|g|kg|ml|l|pinch|dash|clove/i.test(i)).length;
        const detailedIngredientsRatio = currentIngredientsLength > 0 ?
            detailedIngredientsCount / currentIngredientsLength : 0;
        score += detailedIngredientsRatio * 2;
    }
    const stepsList = recipe.steps;
    if (stepsList && stepsList.length > 0) {
        score += 1;
        const currentStepsLength = stepsList.length;
        if (currentStepsLength >= 3)
            score += 0.5;
        if (currentStepsLength >= 5)
            score += 0.5;
        // Simplified: always use step.text
        let totalStepLength = 0;
        let validStepsCount = 0;
        stepsList.forEach(step => {
            const text = step.text;
            if (text.length > 0) {
                totalStepLength += text.length;
                validStepsCount++;
            }
        });
        const averageStepLength = validStepsCount > 0 ?
            totalStepLength / validStepsCount : 0;
        score += Math.min(2, averageStepLength / 50);
    }
    if (recipe.nutrition) {
        score += 0.5;
        let nutritionDetailScore = 0;
        if (recipe.nutrition.calories && recipe.nutrition.calories > 0)
            nutritionDetailScore += 0.25;
        if (recipe.nutrition.protein && parseFloat(recipe.nutrition.protein) >= 0)
            nutritionDetailScore += 0.25;
        if (recipe.nutrition.carbs && parseFloat(recipe.nutrition.carbs) >= 0)
            nutritionDetailScore += 0.25;
        if (recipe.nutrition.fat && parseFloat(recipe.nutrition.fat) >= 0)
            nutritionDetailScore += 0.25;
        score += nutritionDetailScore;
    }
    let timeScore = 0;
    if (recipe.prepTime && recipe.prepTime > 0)
        timeScore += 0.25;
    if (recipe.cookTime && recipe.cookTime > 0)
        timeScore += 0.25;
    if (recipe.totalTime && recipe.totalTime > 0)
        timeScore += 0.25;
    if (recipe.prepTime && recipe.cookTime && recipe.totalTime && Math.abs((recipe.prepTime + recipe.cookTime) - recipe.totalTime) <= 5) {
        timeScore += 0.25;
    }
    score += Math.min(0.75, timeScore);
    return Math.min(10, Math.max(0, score));
}
//# sourceMappingURL=recipeUtils.js.map