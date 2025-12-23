import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zkltmkbmzxvfovsgotpt.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprbHRta2Jtenh2Zm92c2dvdHB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA4Njk3MjIsImV4cCI6MjAzNjQ0NTcyMn0.6tE9XPKidVj-iEoJP7bmtXP22reuvx20syljOy-_TNI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
