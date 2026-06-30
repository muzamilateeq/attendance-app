import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// TODO: Replace these with your actual Supabase Project URL and Anon Key
// You can find these in your Supabase Dashboard -> Project Settings -> API
const SUPABASE_URL = 'https://eznsjqwhbmkndwfasrfl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6bnNqcXdoYm1rbmR3ZmFzcmZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0ODgwNjgsImV4cCI6MjA5ODA2NDA2OH0.Dst2HwEAiZawYEUEeX2w_4NSCnoxLMSd2vl47-hmRbI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
