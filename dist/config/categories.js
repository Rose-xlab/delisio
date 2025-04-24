"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recipeCategories = void 0;
exports.detectRecipeCategory = detectRecipeCategory;
exports.getRelatedCategories = getRelatedCategories;
exports.recipeCategories = [
    {
        id: 'breakfast',
        name: 'Breakfast',
        description: 'Morning meals to start your day',
        keyIngredients: ['eggs', 'bacon', 'oatmeal', 'pancake', 'waffle', 'cereal', 'granola', 'yogurt'],
        keyTerms: ['breakfast', 'brunch', 'morning', 'toast']
    },
    {
        id: 'lunch',
        name: 'Lunch',
        description: 'Midday meals that are quick and satisfying',
        keyIngredients: ['sandwich', 'wrap', 'salad', 'soup'],
        keyTerms: ['lunch', 'quick', 'midday', 'light']
    },
    {
        id: 'dinner',
        name: 'Dinner',
        description: 'Evening meals for the whole family',
        keyIngredients: ['steak', 'roast', 'casserole', 'risotto'],
        keyTerms: ['dinner', 'supper', 'evening', 'main course']
    },
    {
        id: 'dessert',
        name: 'Dessert',
        description: 'Sweet treats for after meals',
        keyIngredients: ['chocolate', 'sugar', 'ice cream', 'cake', 'cookie', 'pie', 'pudding'],
        keyTerms: ['dessert', 'sweet', 'treat', 'bake', 'confection']
    },
    {
        id: 'appetizer',
        name: 'Appetizer',
        description: 'Small bites to start a meal',
        keyIngredients: ['dip', 'spread', 'cracker', 'cheese'],
        keyTerms: ['appetizer', 'starter', 'hors d\'oeuvre', 'finger food', 'snack']
    },
    {
        id: 'side-dish',
        name: 'Side Dish',
        description: 'Accompaniments to main courses',
        keyIngredients: ['potato', 'rice', 'pasta', 'vegetable'],
        keyTerms: ['side', 'accompaniment', 'complement']
    },
    {
        id: 'salad',
        name: 'Salad',
        description: 'Fresh and healthy salad dishes',
        keyIngredients: ['lettuce', 'greens', 'vegetable', 'dressing', 'vinaigrette'],
        keyTerms: ['salad', 'fresh', 'toss', 'bowl']
    },
    {
        id: 'soup',
        name: 'Soup',
        description: 'Warm and comforting soups and stews',
        keyIngredients: ['broth', 'stock', 'vegetable', 'bean', 'noodle'],
        keyTerms: ['soup', 'stew', 'chowder', 'bisque', 'chili']
    },
    {
        id: 'vegetarian',
        name: 'Vegetarian',
        description: 'Meat-free recipes for vegetarians',
        keyIngredients: ['tofu', 'tempeh', 'seitan', 'legume', 'vegetable'],
        keyTerms: ['vegetarian', 'meatless', 'plant-based']
    },
    {
        id: 'vegan',
        name: 'Vegan',
        description: 'Plant-based recipes without animal products',
        keyIngredients: ['tofu', 'tempeh', 'seitan', 'legume', 'vegetable', 'nutritional yeast'],
        keyTerms: ['vegan', 'plant-based', 'dairy-free', 'egg-free']
    },
    {
        id: 'gluten-free',
        name: 'Gluten-Free',
        description: 'Recipes without gluten for those with sensitivities',
        keyIngredients: ['rice flour', 'almond flour', 'gluten-free'],
        keyTerms: ['gluten-free', 'celiac', 'wheat-free']
    },
    {
        id: 'seafood',
        name: 'Seafood',
        description: 'Fish and shellfish dishes from the sea',
        keyIngredients: ['fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'mussel', 'clam', 'scallop'],
        keyTerms: ['seafood', 'fish', 'shellfish', 'ocean']
    },
    {
        id: 'meat',
        name: 'Meat',
        description: 'Hearty meat-based dishes for carnivores',
        keyIngredients: ['beef', 'chicken', 'pork', 'lamb', 'turkey', 'sausage'],
        keyTerms: ['meat', 'carnivore', 'protein']
    },
    {
        id: 'pasta',
        name: 'Pasta',
        description: 'Italian-inspired pasta dishes',
        keyIngredients: ['pasta', 'spaghetti', 'noodle', 'linguine', 'fettuccine', 'penne', 'macaroni'],
        keyTerms: ['pasta', 'italian', 'noodle']
    },
    {
        id: 'baking',
        name: 'Baking',
        description: 'Sweet and savory baked goods',
        keyIngredients: ['flour', 'sugar', 'butter', 'egg', 'yeast', 'baking powder', 'baking soda'],
        keyTerms: ['bake', 'pastry', 'bread', 'dough', 'oven']
    },
    {
        id: 'slow-cooker',
        name: 'Slow Cooker',
        description: 'Set-it-and-forget-it slow cooker recipes',
        keyIngredients: ['meat', 'vegetable', 'broth'],
        keyTerms: ['slow cooker', 'crockpot', 'slow', 'simmer']
    },
    {
        id: 'quick-easy',
        name: 'Quick & Easy',
        description: 'Fast recipes for busy days',
        keyTerms: ['quick', 'easy', 'simple', 'fast', '30-minute', '20-minute', '15-minute']
    },
    {
        id: 'healthy',
        name: 'Healthy',
        description: 'Nutritious recipes for a balanced diet',
        keyIngredients: ['vegetable', 'fruit', 'whole grain', 'lean protein'],
        keyTerms: ['healthy', 'nutritious', 'wellness', 'balanced', 'low-calorie', 'diet']
    },
    {
        id: 'beverage',
        name: 'Beverage',
        description: 'Drinks from smoothies to cocktails',
        keyIngredients: ['milk', 'juice', 'tea', 'coffee', 'alcohol', 'fruit', 'yogurt'],
        keyTerms: ['drink', 'beverage', 'smoothie', 'cocktail', 'milkshake', 'juice', 'tea', 'coffee']
    },
    {
        id: 'international',
        name: 'International',
        description: 'Cuisine from around the world',
        keyTerms: ['international', 'ethnic', 'world', 'exotic', 'fusion']
    },
    {
        id: 'other',
        name: 'Other',
        description: 'Recipes that don\'t fit other categories'
    }
];
/**
 * Detect which category a recipe belongs to based on its title, ingredients, and content
 * @param title Recipe title
 * @param ingredients List of ingredients
 * @param steps Recipe preparation steps as text
 * @returns Most likely category ID
 */
function detectRecipeCategory(title, ingredients, steps) {
    // Normalize input text
    const normalizedTitle = title.toLowerCase();
    const normalizedIngredients = ingredients.map(i => i.toLowerCase());
    const normalizedSteps = steps.map(s => typeof s === 'string' ? s.toLowerCase() :
        typeof s === 'object' && s && 'text' in s ? s.text.toLowerCase() : '');
    const combinedText = [normalizedTitle, ...normalizedIngredients, ...normalizedSteps].join(' ');
    // Score each category based on matching terms and ingredients
    const categoryScores = exports.recipeCategories.map(category => {
        let score = 0;
        // Title matching carries most weight
        if (category.keyTerms) {
            for (const term of category.keyTerms) {
                if (normalizedTitle.includes(term)) {
                    score += 10; // Higher score for title matches
                }
                if (combinedText.includes(term)) {
                    score += 3;
                }
            }
        }
        // Ingredient matching
        if (category.keyIngredients) {
            for (const ingredient of category.keyIngredients) {
                if (normalizedIngredients.some(i => i.includes(ingredient))) {
                    score += 5;
                }
            }
        }
        return { id: category.id, score };
    });
    // Sort by score (highest first)
    categoryScores.sort((a, b) => b.score - a.score);
    // Return the highest scoring category, or 'other' if none scored above 0
    return categoryScores[0].score > 0 ? categoryScores[0].id : 'other';
}
/**
 * Get related categories that might also apply to a recipe
 * @param primaryCategory Primary category ID
 * @param title Recipe title
 * @param ingredients List of ingredients
 * @returns Array of related category IDs (up to 3)
 */
function getRelatedCategories(primaryCategory, title, ingredients) {
    // Skip if primary category is already set to 'other'
    if (primaryCategory === 'other') {
        return [];
    }
    // Normalize input
    const normalizedTitle = title.toLowerCase();
    const normalizedIngredients = ingredients.map(i => i.toLowerCase()).join(' ');
    // Get all categories except the primary one
    const otherCategories = exports.recipeCategories.filter(c => c.id !== primaryCategory);
    // Score each category
    const relatedScores = otherCategories.map(category => {
        let score = 0;
        // Check title for key terms
        if (category.keyTerms) {
            for (const term of category.keyTerms) {
                if (normalizedTitle.includes(term)) {
                    score += 3;
                }
            }
        }
        // Check ingredients
        if (category.keyIngredients) {
            for (const ingredient of category.keyIngredients) {
                if (normalizedIngredients.includes(ingredient)) {
                    score += 2;
                }
            }
        }
        return { id: category.id, score };
    });
    // Sort by score (highest first) and filter for scores > 0
    relatedScores.sort((a, b) => b.score - a.score);
    const filteredRelated = relatedScores.filter(c => c.score > 0);
    // Return up to 3 related categories
    return filteredRelated.slice(0, 3).map(c => c.id);
}
//# sourceMappingURL=categories.js.map