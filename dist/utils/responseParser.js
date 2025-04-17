"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGptResponse = void 0;
/**
 * Parses GPT response into structured recipe data
 * @param gptResponse Raw text response from GPT
 * @returns Structured recipe data
 */
const parseGptResponse = (gptResponse) => {
    try {
        const title = extractTitle(gptResponse);
        const servings = extractServings(gptResponse);
        const ingredients = extractIngredients(gptResponse);
        const steps = extractSteps(gptResponse);
        const nutrition = extractNutrition(gptResponse);
        return {
            title,
            servings,
            ingredients,
            steps,
            nutrition
        };
    }
    catch (error) {
        console.error('Error parsing GPT response:', error);
        throw new Error(`Failed to parse recipe: ${error.message}`);
    }
};
exports.parseGptResponse = parseGptResponse;
/**
 * Extracts the recipe steps from GPT response
 */
function extractSteps(response) {
    let stepsSection = '';
    const stepsMatch = response.match(/STEPS:|INSTRUCTIONS:|DIRECTIONS:([^]*?)(?=NUTRITION:|$)/is);
    if (stepsMatch && stepsMatch[1]) {
        stepsSection = stepsMatch[1].trim();
    }
    else {
        const altMatch = response.match(/(?:Steps|Instructions|Directions):([^]*?)(?=\n\s*\n|\n\s*Nutrition|$)/i);
        if (altMatch && altMatch[1]) {
            stepsSection = altMatch[1].trim();
        }
    }
    const stepLines = stepsSection
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    const steps = [];
    let currentStepText = '';
    let currentIllustration = '';
    stepLines.forEach(line => {
        if (line.toLowerCase().startsWith('illustration:')) {
            currentIllustration = line.replace(/illustration:/i, '').trim();
            return;
        }
        const stepNumberMatch = line.match(/^(\d+)[\.\)]?\s+(.+)$/);
        if (stepNumberMatch) {
            if (currentStepText) {
                steps.push({ text: currentStepText, illustration: currentIllustration || undefined });
                currentIllustration = '';
            }
            currentStepText = stepNumberMatch[2];
        }
        else {
            if (currentStepText) {
                currentStepText += ' ' + line;
            }
            else {
                currentStepText = line;
            }
        }
    });
    if (currentStepText) {
        steps.push({ text: currentStepText, illustration: currentIllustration || undefined });
    }
    if (steps.length === 0 && stepsSection) {
        steps.push({ text: stepsSection });
    }
    return steps;
}
/**
 * Extracts nutrition information from GPT response
 */
function extractNutrition(response) {
    let nutritionSection = '';
    const nutritionMatch = response.match(/NUTRITION:([^]*?)(?=\n\s*\n|$)/is);
    if (nutritionMatch && nutritionMatch[1]) {
        nutritionSection = nutritionMatch[1].trim();
    }
    else {
        const altMatch = response.match(/Nutrition(?:\s*information)?:([^]*?)(?=\n\s*\n|$)/i);
        if (altMatch && altMatch[1]) {
            nutritionSection = altMatch[1].trim();
        }
    }
    const nutritionInfo = {
        calories: 0,
        protein: '0g',
        fat: '0g',
        carbs: '0g'
    };
    if (nutritionSection) {
        const caloriesMatch = nutritionSection.match(/calories:?\s*(\d+)/i) ||
            nutritionSection.match(/(\d+)\s*calories/i);
        if (caloriesMatch && caloriesMatch[1]) {
            nutritionInfo.calories = parseInt(caloriesMatch[1], 10);
        }
        const proteinMatch = nutritionSection.match(/protein:?\s*(\d+(?:\.\d+)?)\s*g/i);
        if (proteinMatch && proteinMatch[1]) {
            nutritionInfo.protein = `${proteinMatch[1]}g`;
        }
        const fatMatch = nutritionSection.match(/fat:?\s*(\d+(?:\.\d+)?)\s*g/i);
        if (fatMatch && fatMatch[1]) {
            nutritionInfo.fat = `${fatMatch[1]}g`;
        }
        const carbsMatch = nutritionSection.match(/carb(?:ohydrate)?s?:?\s*(\d+(?:\.\d+)?)\s*g/i);
        if (carbsMatch && carbsMatch[1]) {
            nutritionInfo.carbs = `${carbsMatch[1]}g`;
        }
    }
    return nutritionInfo;
}
/**
 * Extracts the recipe title from GPT response
 */
function extractTitle(response) {
    const titleMatch = response.match(/TITLE:\s*(.*?)(?:\n|$)/i) ||
        response.match(/^#\s*(.*?)(?:\n|$)/m) ||
        response.match(/^(.*?)(?:\n|$)/);
    if (titleMatch && titleMatch[1]) {
        return titleMatch[1].trim();
    }
    return 'Recipe';
}
/**
 * Extracts the number of servings from GPT response
 */
function extractServings(response) {
    const servingsMatch = response.match(/SERVINGS:\s*(\d+)/i) ||
        response.match(/SERVES:\s*(\d+)/i) ||
        response.match(/YIELD:\s*(\d+)\s*servings/i) ||
        response.match(/Servings:\s*(\d+)/i);
    if (servingsMatch && servingsMatch[1]) {
        return parseInt(servingsMatch[1], 10);
    }
    return 4;
}
/**
 * Extracts the ingredients list from GPT response
 */
function extractIngredients(response) {
    let ingredientsSection = '';
    const ingredientsMatch = response.match(/INGREDIENTS:(.*?)(?=STEPS:|INSTRUCTIONS:|DIRECTIONS:|NUTRITION:|$)/is);
    if (ingredientsMatch && ingredientsMatch[1]) {
        ingredientsSection = ingredientsMatch[1].trim();
    }
    else {
        const altMatch = response.match(/Ingredients:([^]*?)(?=\n\s*\n|\n\s*Steps|\n\s*Instructions|\n\s*Directions|\n\s*Nutrition|$)/i);
        if (altMatch && altMatch[1]) {
            ingredientsSection = altMatch[1].trim();
        }
    }
    const ingredients = ingredientsSection
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => line.replace(/^[-\u2022\*]|\d+\.\s+|\*/g, '').trim())
        .filter(line => line.length > 0);
    return ingredients;
}
//# sourceMappingURL=responseParser.js.map