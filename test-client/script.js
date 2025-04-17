// Utility functions
function getApiBaseUrl() {
    return document.getElementById('apiBaseUrl').value.trim();
}

function getAuthToken() {
    return document.getElementById('authToken').value.trim();
}

function setAuthToken(token) {
    document.getElementById('authToken').value = token;
    localStorage.setItem('authToken', token);
}

function clearToken() {
    document.getElementById('authToken').value = '';
    localStorage.removeItem('authToken');
}

function displayResponse(elementId, data, isError = false) {
    const element = document.getElementById(elementId);
    
    if (isError) {
        element.innerHTML = `<span style="color: red;">ERROR: ${JSON.stringify(data, null, 2)}</span>`;
    } else {
        element.innerHTML = JSON.stringify(data, null, 2);
    }
}

async function makeApiRequest(endpoint, method, body = null, requiresAuth = false) {
    const url = `${getApiBaseUrl()}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (requiresAuth) {
        const token = getAuthToken();
        if (!token) {
            return { error: 'Authentication token required but not provided' };
        }
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const options = {
        method,
        headers,
        credentials: 'include'
    };
    
    if (body && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(body);
    }
    
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        
        if (!response.ok) {
            throw data;
        }
        
        return data;
    } catch (error) {
        console.error('API Request Error:', error);
        return { error: error.error || error.message || 'Something went wrong' };
    }
}

// Authentication Endpoints
async function registerUser() {
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    const name = document.getElementById('registerName').value.trim();
    
    if (!email || !password || !name) {
        displayResponse('registerResponse', { error: 'Please fill in all fields' }, true);
        return;
    }
    
    const response = await makeApiRequest('/api/auth/signup', 'POST', {
        email,
        password,
        name
    });
    
    if (response.error) {
        displayResponse('registerResponse', response, true);
    } else {
        displayResponse('registerResponse', response);
    }
}

async function loginUser() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    
    if (!email || !password) {
        displayResponse('loginResponse', { error: 'Please fill in all fields' }, true);
        return;
    }
    
    const response = await makeApiRequest('/api/auth/signin', 'POST', {
        email,
        password
    });
    
    if (response.error) {
        displayResponse('loginResponse', response, true);
    } else {
        displayResponse('loginResponse', response);
        
        // Save the token if available
        if (response.session && response.session.access_token) {
            setAuthToken(response.session.access_token);
        }
    }
}

async function getCurrentUser() {
    const response = await makeApiRequest('/api/auth/me', 'GET', null, true);
    
    if (response.error) {
        displayResponse('userResponse', response, true);
    } else {
        displayResponse('userResponse', response);
    }
}

async function updatePreferences() {
    const dietaryRestrictionsInput = document.getElementById('dietaryRestrictions').value.trim();
    const favoriteCuisinesInput = document.getElementById('favoriteCuisines').value.trim();
    const allergiesInput = document.getElementById('allergies').value.trim();
    const cookingSkill = document.getElementById('cookingSkill').value;
    
    const dietaryRestrictions = dietaryRestrictionsInput ? dietaryRestrictionsInput.split(',').map(item => item.trim()) : [];
    const favoriteCuisines = favoriteCuisinesInput ? favoriteCuisinesInput.split(',').map(item => item.trim()) : [];
    const allergies = allergiesInput ? allergiesInput.split(',').map(item => item.trim()) : [];
    
    const response = await makeApiRequest('/api/auth/preferences', 'PUT', {
        dietaryRestrictions,
        favoriteCuisines,
        allergies,
        cookingSkill
    }, true);
    
    if (response.error) {
        displayResponse('preferencesResponse', response, true);
    } else {
        displayResponse('preferencesResponse', response);
    }
}

// Recipe Endpoints
async function generateRecipe() {
    const query = document.getElementById('recipeQuery').value.trim();
    const save = document.getElementById('saveRecipe').checked;
    
    if (!query) {
        displayResponse('recipeResponse', { error: 'Please enter a recipe query' }, true);
        return;
    }
    
    const requiresAuth = save;
    const response = await makeApiRequest('/api/recipes', 'POST', {
        query,
        save
    }, requiresAuth);
    
    if (response.error) {
        displayResponse('recipeResponse', response, true);
        document.getElementById('recipeDisplay').style.display = 'none';
    } else {
        displayResponse('recipeResponse', response);
        displayRecipe(response);
    }
}

function displayRecipe(recipe) {
    // Display recipe details
    document.getElementById('recipeTitle').textContent = recipe.title;
    
    // Ingredients
    const ingredientsList = document.getElementById('ingredientsList');
    ingredientsList.innerHTML = '';
    recipe.ingredients.forEach(ingredient => {
        const li = document.createElement('li');
        li.textContent = ingredient;
        ingredientsList.appendChild(li);
    });
    
    // Nutrition
    const nutritionList = document.getElementById('nutritionList');
    nutritionList.innerHTML = '';
    const nutritionItems = [
        `Calories: ${recipe.nutrition.calories}`,
        `Protein: ${recipe.nutrition.protein}`,
        `Fat: ${recipe.nutrition.fat}`,
        `Carbs: ${recipe.nutrition.carbs}`
    ];
    
    nutritionItems.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        nutritionList.appendChild(li);
    });
    
    // Steps with images
    const stepsContainer = document.getElementById('stepsContainer');
    stepsContainer.innerHTML = '';
    
    recipe.steps.forEach((step, index) => {
        const stepDiv = document.createElement('div');
        stepDiv.className = 'mb-4';
        
        const stepNum = document.createElement('h6');
        stepNum.textContent = `Step ${index + 1}:`;
        stepDiv.appendChild(stepNum);
        
        const stepText = document.createElement('p');
        stepText.textContent = step.text;
        stepDiv.appendChild(stepText);
        
        if (step.image_url) {
            const img = document.createElement('img');
            img.src = step.image_url;
            img.alt = `Step ${index + 1}`;
            img.className = 'step-img';
            stepDiv.appendChild(img);
        }
        
        stepsContainer.appendChild(stepDiv);
    });
    
    // Show the recipe display
    document.getElementById('recipeDisplay').style.display = 'block';
}

async function getUserRecipes() {
    const response = await makeApiRequest('/api/users/recipes', 'GET', null, true);
    
    if (response.error) {
        displayResponse('userRecipesResponse', response, true);
        document.getElementById('recipesListContainer').style.display = 'none';
    } else {
        displayResponse('userRecipesResponse', response);
        displayRecipesList(response.recipes);
    }
}

function displayRecipesList(recipes) {
    const recipesList = document.getElementById('recipesList');
    recipesList.innerHTML = '';
    
    if (recipes.length === 0) {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item';
        listItem.textContent = 'No recipes found';
        recipesList.appendChild(listItem);
    } else {
        recipes.forEach(recipe => {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
            
            const title = document.createElement('span');
            title.textContent = recipe.title;
            listItem.appendChild(title);
            
            const viewBtn = document.createElement('button');
            viewBtn.textContent = 'View';
            viewBtn.className = 'btn btn-sm btn-primary';
            viewBtn.onclick = () => {
                document.getElementById('recipeId').value = recipe.id;
                getRecipeById();
                document.getElementById('apiTabs').querySelector('button[data-bs-target="#recipes"]').click();
            };
            listItem.appendChild(viewBtn);
            
            recipesList.appendChild(listItem);
        });
    }
    
    // Show the recipes list container
    document.getElementById('recipesListContainer').style.display = 'block';
}

async function getRecipeById() {
    const recipeId = document.getElementById('recipeId').value.trim();
    
    if (!recipeId) {
        displayResponse('recipeByIdResponse', { error: 'Please enter a recipe ID' }, true);
        return;
    }
    
    const response = await makeApiRequest(`/api/users/recipes/${recipeId}`, 'GET', null, true);
    
    if (response.error) {
        displayResponse('recipeByIdResponse', response, true);
    } else {
        displayResponse('recipeByIdResponse', response);
    }
}

// Chat Endpoints
async function sendChatMessage() {
    const message = document.getElementById('chatMessage').value.trim();
    
    if (!message) {
        displayResponse('chatResponse', { error: 'Please enter a message' }, true);
        return;
    }
    
    const response = await makeApiRequest('/api/chat', 'POST', {
        message
    });
    
    if (response.error) {
        displayResponse('chatResponse', response, true);
        document.getElementById('chatDisplay').style.display = 'none';
    } else {
        displayResponse('chatResponse', response);
        displayChatResponse(response);
    }
}

function displayChatResponse(response) {
    // Display chat response
    document.getElementById('assistantReply').textContent = response.reply;
    
    // Check if recipe generation is suggested
    if (response.can_generate_recipe && response.suggested_recipe) {
        document.getElementById('suggestedRecipe').textContent = response.suggested_recipe;
        document.getElementById('recipeGenerationContainer').style.display = 'block';
        // Store the suggested recipe to use later
        window.suggestedRecipe = response.suggested_recipe;
    } else {
        document.getElementById('recipeGenerationContainer').style.display = 'none';
    }
    
    // Show the chat display
    document.getElementById('chatDisplay').style.display = 'block';
}

async function generateSuggestedRecipe() {
    if (window.suggestedRecipe) {
        document.getElementById('recipeQuery').value = window.suggestedRecipe;
        document.getElementById('apiTabs').querySelector('button[data-bs-target="#recipes"]').click();
        generateRecipe();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Load token from localStorage if available
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
        setAuthToken(savedToken);
    }
});