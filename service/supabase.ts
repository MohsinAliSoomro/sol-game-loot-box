import { createClient } from "@supabase/supabase-js";

// const databaseUrl = "postgresql://postgres.zkltmkbmzxvfovsgotpt:ee#L9#9guGE6X7Z@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres";
const publicAnon =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprbHRta2Jtenh2Zm92c2dvdHB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA4Njk3MjIsImV4cCI6MjAzNjQ0NTcyMn0.6tE9XPKidVj-iEoJP7bmtXP22reuvx20syljOy-_TNI";
// Create a single supabase client for interacting with your database
// export const supabase = createClient(databaseUrl, publicAnon);

// import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://zkltmkbmzxvfovsgotpt.supabase.co";
// const supabaseKey = process.env.SUPABASE_KEY;
export const supabase = createClient(supabaseUrl, publicAnon);
