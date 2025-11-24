# Spotly Auth & Database Walkthrough

I have implemented the login system and database integration using Supabase.

## Changes
- **Dependencies**: Installed `@supabase/supabase-js`.
- **Login System**: Created a clean, black & white `Login` component (`src/components/Login.jsx`).
- **Authentication**: Updated `App.jsx` to handle user sessions.
- **Database Integration**: Modified `Map.jsx` to load and save visited points to Supabase.
- **Schema**: Created `supabase_schema.sql` with the necessary database table and policies.

## Next Steps for You
1.  **Create Supabase Project**: Go to [Supabase](https://supabase.com/) and create a new project.
2.  **Run SQL**: Copy the contents of `supabase_schema.sql` and run it in the Supabase SQL Editor to create the `profiles` table.
3.  **Get Credentials**:
    - Go to Project Settings -> API.
    - Copy the **Project URL** and **anon public key**.
4.  **Update Code**:
    - Open `src/supabaseClient.js`.
    - Replace `YOUR_SUPABASE_URL_HERE` and `YOUR_SUPABASE_ANON_KEY_HERE` with your actual values.
    - Alternatively, create a `.env` file with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Verification
1.  Start the app: `npm run dev`.
2.  You should see the Login screen.
3.  Sign up with an email and password.
4.  Once logged in, you will see the map.
5.  Move around to generate "visited points".
6.  Refresh the page; the visited points (cleared fog) should persist.
