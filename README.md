# Cooking-Assistant Backend

A Node.js/Express.js backend for the Cooking-Assistant mobile app, which uses AI to help users discover, learn, and prepare recipes through interactive chat, illustrated step-by-step guidance, and nutritional insights.

## Features

- Recipe generation with OpenAI GPT-4
- Recipe illustration with OpenAI DALL·E 3
- Interactive AI chat for cooking questions and guidance
- User authentication and profile management with Supabase
- User preferences for dietary restrictions, allergies, and cooking skill level
- Recipe saving and favorites
- Nutritional information for recipes

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI Models**: OpenAI GPT-4 and DALL·E 3

## Project Structure

```
cooking-assistant-backend/
├── src/
│   ├── app.ts              # Express app initialization
│   ├── server.ts           # Server startup
│   ├── routes/             # API route definitions
│   │   ├── recipeRoutes.ts
│   │   ├── chatRoutes.ts
│   │   ├── authRoutes.ts
│   │   └── userRoutes.ts
│   ├── controllers/        # Request handlers
│   │   ├── recipeController.ts
│   │   └── chatController.ts
│   ├── services/           # Business logic
│   │   ├── gptService.ts
│   │   ├── dalleService.ts
│   │   ├── nutritionService.ts
│   │   ├── authService.ts
│   │   └── supabaseService.ts
│   ├── middleware/         # Express middleware
│   │   └── authMiddleware.ts
│   ├── utils/              # Utility functions
│   │   ├── promptBuilder.ts
│   │   └── responseParser.ts
│   └── models/             # Data models
│       ├── Recipe.ts
│       └── User.ts
├── .env                    # Environment variables
├── package.json
├── tsconfig.json
└── README.md
```

## API Endpoints

### Recipe Endpoints

- `POST /api/recipes` - Generate a recipe based on query

### Chat Endpoints

- `POST /api/chat` - Send a message to the AI assistant

### Auth Endpoints

- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/signin` - Sign in an existing user
- `POST /api/auth/signout` - Sign out current user
- `GET /api/auth/me` - Get current user profile
- `POST /api/auth/reset-password` - Send password reset email
- `PUT /api/auth/preferences` - Update user preferences

### User Endpoints

- `GET /api/users/recipes` - Get all recipes for the current user
- `GET /api/users/recipes/:id` - Get a specific recipe by ID
- `POST /api/users/recipes` - Save a recipe for the current user

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn
- Supabase account
- OpenAI API key

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/your-username/cooking-assistant-backend.git
   cd cooking-assistant-backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=3000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   OPENAI_API_KEY=your-openai-api-key
   GPT_MODEL=gpt-4-1106-preview
   DALLE_MODEL=dall-e-3
   IMAGE_SIZE=1024x1024
   IMAGE_QUALITY=standard
   IMAGE_STYLE=natural
   SUPABASE_URL=your-supabase-url
   SUPABASE_KEY=your-supabase-anon-key
   JWT_SECRET=your-jwt-secret
   ```

4. Set up the Supabase database using the schema in `supabase-schema.sql`

5. Start the development server:
   ```
   npm run dev
   ```

## Database Setup

1. Create a new project in Supabase
2. Go to the SQL Editor in the Supabase dashboard
3. Run the SQL script from `supabase-schema.sql` to create tables and policies

## Environment Variables

- `PORT` - Port number for the server (default: 3000)
- `NODE_ENV` - Environment (development, production)
- `FRONTEND_URL` - URL of the Flutter frontend (for CORS)
- `OPENAI_API_KEY` - Your OpenAI API key
- `GPT_MODEL` - GPT model to use (default: gpt-4-1106-preview)
- `DALLE_MODEL` - DALL-E model to use (default: dall-e-3)
- `IMAGE_SIZE` - Size of generated images (default: 1024x1024)
- `IMAGE_QUALITY` - Quality of generated images (default: standard)
- `IMAGE_STYLE` - Style of generated images (default: natural)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase anon key
- `JWT_SECRET` - Secret for JWT token verification

## License

This project is licensed under the MIT License.