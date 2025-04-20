import { logger } from '../utils/logger';
import { Recipe, RecipeStep, NutritionInfo } from '../models/Recipe';
import { supabase } from '../config/supabase';
import { createHash } from 'crypto';
import { Json } from '../types/supabase'; // Import Json type

/**
 * Interface for recipe similarity result
 */
interface SimilarityResult {
  isDuplicate: boolean;
  similarityScore: number;
  existingRecipeId: string | null;
  similarityDetails: {
    titleSimilarity: number;
    ingredientSimilarity: number;
    stepsSimilarity: number;
  };
}

/**
 * Interface for ingredient analysis
 */
interface IngredientAnalysis {
  normalizedIngredients: string[];
  mainIngredients: string[];
}

/**
 * Checks if a recipe might be a duplicate of an existing recipe
 * @param recipe The recipe to check for duplicates
 * @returns Similarity information and duplicate status
 */
export const checkForDuplicates = async (recipe: Recipe): Promise<SimilarityResult> => {
  try {
    logger.info(`Checking for duplicates of recipe: ${recipe.title}`);

    // Generate a similarity hash for the recipe
    const similarityHash = generateSimilarityHash(recipe);

    // First, check for exact title matches or very similar titles
    const normalizedTitle = normalizeText(recipe.title);

    // Get recipes with similar titles or ingredients
    const { data: potentialDuplicates, error } = await supabase
      .from('recipes')
      .select('*')
      .or(`title.ilike.%${normalizedTitle}%,similarity_hash.eq.${similarityHash}`)
      .limit(10);

    if (error) {
      logger.error('Error querying for potential duplicates:', error);
      return {
        isDuplicate: false,
        similarityScore: 0,
        existingRecipeId: null,
        similarityDetails: { titleSimilarity: 0, ingredientSimilarity: 0, stepsSimilarity: 0 }
      };
    }

    if (!potentialDuplicates || potentialDuplicates.length === 0) {
      logger.info('No potential duplicates found');
      return {
        isDuplicate: false,
        similarityScore: 0,
        existingRecipeId: null,
        similarityDetails: { titleSimilarity: 0, ingredientSimilarity: 0, stepsSimilarity: 0 }
      };
    }

    // Analyze ingredients in the new recipe
    const newRecipeIngredientAnalysis = analyzeIngredients(recipe.ingredients);

    // Find the most similar recipe among potential duplicates
    let highestSimilarityScore = 0;
    let mostSimilarRecipe: Recipe | null = null;
    let mostSimilarDetails = { titleSimilarity: 0, ingredientSimilarity: 0, stepsSimilarity: 0 };

    for (const potentialDuplicate of potentialDuplicates) {
      const dbRecipe: Recipe = {
        id: potentialDuplicate.id,
        title: potentialDuplicate.title,
        servings: potentialDuplicate.servings || 0,
        ingredients: potentialDuplicate.ingredients || [],
        steps: (potentialDuplicate.steps || []) as unknown as RecipeStep[],
        nutrition: (potentialDuplicate.nutrition || {}) as unknown as NutritionInfo,
        query: potentialDuplicate.query || '',
        createdAt: new Date(potentialDuplicate.created_at || Date.now()),
        prepTime: potentialDuplicate.prep_time_minutes ?? undefined,
        cookTime: potentialDuplicate.cook_time_minutes ?? undefined,
        totalTime: potentialDuplicate.total_time_minutes ?? undefined,
      };

      if (dbRecipe.id === recipe.id) continue;

      const similarityDetails = calculateRecipeSimilarity(
        recipe,
        dbRecipe,
        newRecipeIngredientAnalysis
      );

      const combinedScore = (
        similarityDetails.titleSimilarity * 0.3 +
        similarityDetails.ingredientSimilarity * 0.5 +
        similarityDetails.stepsSimilarity * 0.2
      );

      if (combinedScore > highestSimilarityScore) {
        highestSimilarityScore = combinedScore;
        mostSimilarRecipe = dbRecipe;
        mostSimilarDetails = similarityDetails;
      }
    }

    const SIMILARITY_THRESHOLD = 0.8;
    const isDuplicate = highestSimilarityScore >= SIMILARITY_THRESHOLD;

    logger.info(`Duplicate check result for ${recipe.title}: ${isDuplicate ? 'IS' : 'NOT'} a duplicate. Similarity score: ${highestSimilarityScore.toFixed(2)}`);

    return {
      isDuplicate,
      similarityScore: highestSimilarityScore,
      existingRecipeId: mostSimilarRecipe?.id || null,
      similarityDetails: mostSimilarDetails
    };
  } catch (error) {
    logger.error('Error checking for duplicates:', error);
    return {
      isDuplicate: false,
      similarityScore: 0,
      existingRecipeId: null,
      similarityDetails: { titleSimilarity: 0, ingredientSimilarity: 0, stepsSimilarity: 0 }
    };
  }
};

/**
 * Merges a new recipe with an existing one, keeping the best parts of both
 * @param newRecipe The new recipe to merge
 * @param existingRecipeId The ID of the existing recipe to merge with
 * @returns The merged recipe object (in-memory representation)
 */
export const mergeRecipes = async (
  newRecipe: Recipe,
  existingRecipeId: string
): Promise<Recipe> => {
  try {
    logger.info(`Merging recipe ${newRecipe.title} with existing recipe ID ${existingRecipeId}`);

    // Get the existing recipe
    const { data: existingRecipeData, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', existingRecipeId)
      .single();

    if (error || !existingRecipeData) {
      logger.error('Error fetching existing recipe for merge:', error || 'No data returned');
      throw new Error('Failed to fetch existing recipe for merge');
    }

    const existingRecipe: Recipe = {
      id: existingRecipeData.id,
      title: existingRecipeData.title,
      servings: existingRecipeData.servings || 0,
      ingredients: existingRecipeData.ingredients || [],
      steps: (existingRecipeData.steps || []) as unknown as RecipeStep[],
      nutrition: (existingRecipeData.nutrition || {}) as unknown as NutritionInfo,
      query: existingRecipeData.query || '',
      createdAt: new Date(existingRecipeData.created_at || Date.now()),
      prepTime: existingRecipeData.prep_time_minutes ?? undefined,
      cookTime: existingRecipeData.cook_time_minutes ?? undefined,
      totalTime: existingRecipeData.total_time_minutes ?? undefined,
    };

    // Perform the merge
    const mergedTitle =
      existingRecipe.title.length > newRecipe.title.length
        ? existingRecipe.title
        : newRecipe.title;

    const allIngredients = [...existingRecipe.ingredients, ...newRecipe.ingredients];
    const uniqueIngredients = Array.from(
      new Set(allIngredients.map(normalizeText))
    )
      .map(normalized => {
        const matching = allIngredients.filter(
          ing => normalizeText(ing) === normalized
        );
        return matching.length > 0
          ? matching.reduce((a, b) => (b.length > a.length ? b : a), matching[0])
          : '';
      })
      .filter(ing => ing !== '');

    const mergedSteps =
      existingRecipe.steps.length >= newRecipe.steps.length
        ? existingRecipe.steps
        : newRecipe.steps;

    const existingHasNutrition =
      !!existingRecipe.nutrition.calories &&
      !!existingRecipe.nutrition.protein &&
      !!existingRecipe.nutrition.fat &&
      !!existingRecipe.nutrition.carbs;
    const newHasNutrition =
      !!newRecipe.nutrition.calories &&
      !!newRecipe.nutrition.protein &&
      !!newRecipe.nutrition.fat &&
      !!newRecipe.nutrition.carbs;

    const mergedNutrition =
      existingHasNutrition
        ? existingRecipe.nutrition
        : newHasNutrition
        ? newRecipe.nutrition
        : existingRecipe.nutrition;

    const mergedPrepTime = mergeTimeValues(
      existingRecipe.prepTime,
      newRecipe.prepTime
    );
    const mergedCookTime = mergeTimeValues(
      existingRecipe.cookTime,
      newRecipe.cookTime
    );
    const mergedTotalTime = mergeTimeValues(
      existingRecipe.totalTime,
      newRecipe.totalTime
    );

    const mergedRecipe: Recipe = {
      id: existingRecipe.id,
      title: mergedTitle,
      servings: existingRecipe.servings || newRecipe.servings,
      ingredients: uniqueIngredients,
      steps: mergedSteps,
      nutrition: mergedNutrition,
      query: existingRecipe.query || newRecipe.query,
      createdAt: existingRecipe.createdAt,
      prepTime: mergedPrepTime,
      cookTime: mergedCookTime,
      totalTime: mergedTotalTime,
    };

    // Update the existing recipe in the database with the merged data
    await supabase
      .from('recipes')
      .update({
        title: mergedRecipe.title,
        servings: mergedRecipe.servings,
        ingredients: mergedRecipe.ingredients,
        steps: mergedRecipe.steps as unknown as Json,
        nutrition: mergedRecipe.nutrition as unknown as Json,
        prep_time_minutes: mergedRecipe.prepTime ?? null,
        cook_time_minutes: mergedRecipe.cookTime ?? null,
        total_time_minutes: mergedRecipe.totalTime ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingRecipeId);

    logger.info(`Successfully merged recipes. Keeping ID ${existingRecipeId}`);

    return mergedRecipe;
  } catch (error) {
    logger.error('Error merging recipes:', error);
    throw new Error(`Failed to merge recipes: ${(error as Error).message}`);
  }
};

/**
 * Generates a similarity hash for a recipe for quick comparison
 * @param recipe The recipe to generate a hash for
 * @returns A hash string that can be used for similarity comparison
 */
export const generateSimilarityHash = (recipe: Recipe): string => {
  const { mainIngredients } = analyzeIngredients(recipe.ingredients);
  const titlePart = normalizeText(recipe.title || '');
  const ingredientsPart = mainIngredients.sort().join('|');
  const servingsPart = String(recipe.servings || 0);
  const hashInput = titlePart + '|' + ingredientsPart + '|' + servingsPart;
  return createHash('sha256').update(Buffer.from(hashInput)).digest('hex');
};

function analyzeIngredients(ingredients: string[]): IngredientAnalysis {
  const normalizedIngredients = ingredients
    .map(ingredient => {
      let processed = ingredient.replace(/^[\s*]*\d+(\s*\/\s*\d+)?(\s*(?:oz|g|kg|lb|cup|tsp|tbsp|ml|l|pinch|dash|clove|slice|piece)s?)?(\s+of)?\s+/i, '');
      processed = processed.replace(/\b(fresh|dried|chopped|minced|diced|sliced|grated|crushed|ground|finely|roughly|to taste|optional|for garnish|peeled|seeded|cored|rinsed|drained|cooked|uncooked|raw|frozen|thawed|at room temperature|softened|melted|divided)\b/gi, '');
      processed = processed.replace(/\([^)]*\)/g, '');
      processed = processed.split(',')[0];
      return normalizeText(processed);
    })
    .filter(ing => ing.length > 2);
  return { normalizedIngredients, mainIngredients: normalizedIngredients };
}

function calculateRecipeSimilarity(
  recipe1: Recipe,
  recipe2: Recipe,
  recipe1IngredientAnalysis?: IngredientAnalysis
) {
  const titleSimilarity = calculateJaccardSimilarity(
    normalizeText(recipe1.title).split(' '),
    normalizeText(recipe2.title).split(' ')
  );
  const analysis1 = recipe1IngredientAnalysis || analyzeIngredients(recipe1.ingredients);
  const analysis2 = analyzeIngredients(recipe2.ingredients);
  const ingredientSimilarity = calculateJaccardSimilarity(
    analysis1.normalizedIngredients,
    analysis2.normalizedIngredients
  );
  const steps1Keywords = recipe1.steps
    .map(s => normalizeText(s.text).split(' ').filter(w => w.length > 3 && !commonWords.includes(w)))
    .flat();
  const steps2Keywords = recipe2.steps
    .map(s => normalizeText(s.text).split(' ').filter(w => w.length > 3 && !commonWords.includes(w)))
    .flat();
  const stepsSimilarity = calculateJaccardSimilarity(steps1Keywords, steps2Keywords);
  return { titleSimilarity, ingredientSimilarity, stepsSimilarity };
}

function calculateJaccardSimilarity(set1: string[], set2: string[]): number {
  const a = new Set(set1), b = new Set(set2);
  const intersection = [...a].filter(x => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 1 : intersection / union;
}

function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text.toLowerCase().trim().replace(/[\W_]+/g, ' ').replace(/\s+/g, ' ');
}

function mergeTimeValues(
  time1?: number,
  time2?: number
): number | undefined {
  if (time1 == null && time2 == null) return undefined;
  if (time1 == null) return time2;
  if (time2 == null) return time1;
  return Math.round((time1 + time2) / 2);
}

const commonWords = [
  'a', 'about', 'add', 'after', 'again', 'all', 'also', 'an', 'and', 'any', 'are', 'as', 'at',
  'bake', 'be', 'been', 'before', 'being', 'below', 'between', 'boil', 'both', 'bowl', 'but', 'by',
  'can', 'cannot', 'combine', 'cook', 'could', 'cover', 'cut',
  'did', 'do', 'does', 'doing', 'down', 'drain', 'during',
  'each', 'few', 'for', 'from', 'further',
  'get', 'gently', 'gradually',
  'had', 'has', 'have', 'having', 'heat', 'her', 'here', 'hers', 'herself', 'high', 'him', 'himself', 'his', 'how',
  'if', 'in', 'into', 'is', 'it', 'its', 'itself',
  'just',
  'large', 'let', 'like', 'low',
  'make', 'medium', 'mix', 'more', 'most', 'my', 'myself',
  'no', 'nor', 'not', 'now',
  'of', 'off', 'on', 'once', 'one', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'pan', 'place', 'pour',
  'remove', 'repeat',
  'same', 'season', 'serve', 'set', 'she', 'should', 'simmer', 'since', 'small', 'so', 'some', 'stir', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those',
  'through', 'to', 'together', 'too', 'toss', 'turn',
  'under', 'until', 'up', 'use',
  'very',
  'was', 'we', 'well', 'were', 'what', 'when', 'where', 'which', 'while', 'whisk', 'who', 'whom', 'why', 'will', 'with', 'wok', 'would',
  'you', 'your', 'yours', 'yourself', 'yourselves'
];
