// Import URL polyfill BEFORE Supabase to fix React Native compatibility
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from './supabaseConfig';

// Create a singleton Supabase client for the app
const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

export default supabase;
