# comgenerator_V1

## Overview
ComGenerator is a React application that helps teachers generate assessments and communications. It relies on Supabase for authentication, database storage and edge functions while OpenAI is used to create the text content.

## Architecture
- **React + Vite** for the front‑end UI with Tailwind CSS
- **Supabase** handles auth, data and serverless functions
- **OpenAI** powers text generation

## Setup
1. Install dependencies
   ```bash
   npm install
   ```
2. Create a `.env` file and fill it with the environment variables described below
3. Start the development server
   ```bash
   npm run dev
   ```
4. Build for production
   ```bash
   npm run build
   ```
5. Preview the production build
   ```bash
   npm run preview
   ```

## Environment variables
- `VITE_SUPABASE_URL` – URL of your Supabase project
- `VITE_SUPABASE_ANON_KEY` – Supabase anonymous key
- `VITE_OPENAI_API_KEY` – API key for OpenAI
- `SUPABASE_URL` – Used by Supabase edge functions
- `SUPABASE_SERVICE_ROLE_KEY` – Service role key for edge functions

Set these variables in `.env` or in your deployment environment.


## Commands
- `npm run dev` – start the dev server
- `npm run build` – create a production build
- `npm run preview` – preview the build locally


