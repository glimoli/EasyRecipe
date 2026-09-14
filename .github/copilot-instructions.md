# EasyRecipe — Copilot Instructions

## Project Overview
EasyRecipe is a recipe-importing and organization app for Android + Web.
It extracts recipes from social media (TikTok, Instagram, YouTube, Pinterest, Facebook), recipe websites, images, and manual input. It also supports AI recipe generation and remixing.

## Tech Stack
- **Frontend**: React Native (Expo) with TypeScript, react-native-web for browser
- **Backend**: Firebase Cloud Functions (Node.js/TypeScript)
- **Database**: Firebase Firestore (real-time sync, offline support)
- **Auth**: Firebase Authentication (Google Sign-In + email/password)
- **Storage**: Firebase Storage (images)
- **Recipe Parsing**: Cheerio + JSON-LD + OpenAI LLM fallback
- **Nutrition**: USDA FoodData Central API
- **Sync/Backup**: Google Drive API v3

## Folder Structure
```
.github/                      # CI/CD, Copilot instructions
datasources/                  # Reference data (MyFitnessPal definition, etc.)
Input/                        # App definition, prompts
output/                       # Generated artifacts
src/
  app/                        # React Native (Expo) app
    components/               # Reusable UI components
    screens/                  # Screen-level views
    navigation/               # React Navigation config
    services/                 # Firebase client wrappers, API calls
    models/                   # TypeScript types/interfaces
    utils/                    # Helpers (unit conversion, scaling)
    assets/                   # Icons, images
  functions/                  # Firebase Cloud Functions
    src/
      extractors/             # URL scraping + recipe parsing
      nutrition/              # USDA API integration
      drive/                  # Google Drive export logic
      generators/             # AI recipe generation + remix
```

## Key Data Models
- `Recipe` — sourceType tracks origin: tiktok|instagram|youtube|pinterest|facebook|web|image|manual|ai-generated|ai-remix
- All AI-generated recipes must be labeled and include a safety disclaimer
- Every recipe preserves its source URL and platform tag

## Execution Rules
1. Always retrieve from datasources before generating content
2. Never surface citations/references/URLs in user-facing output
3. Follow the phased approach: MVP (import + organize) → scaling/AI → nutrition/tracking → Drive/polish

## Coding Conventions
- TypeScript strict mode everywhere
- Firebase Firestore paths: `users/{uid}/recipes`, `users/{uid}/cookbooks`, etc.
- Cloud Functions: validate all inputs, rate-limit external endpoints
- Components: functional components with hooks
- State management: React Context for auth, local state for screens
