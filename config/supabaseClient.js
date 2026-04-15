import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// For EAS builds, use environment variables
// For local builds, try to import config file
let supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
let supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Fallback to local config if environment variables aren't set
if (!supabaseUrl || !supabaseAnonKey) {
  try {
    const { SUPABASE_CONFIG } = require('./supabaseConfig');
    supabaseUrl = supabaseUrl || SUPABASE_CONFIG.url;
    supabaseAnonKey = supabaseAnonKey || SUPABASE_CONFIG.anonKey;
  } catch (error) {
    console.error('Supabase config not found. Make sure environment variables are set.');
  }
}

// Validate that we have the required configuration
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('CRITICAL: Supabase URL and/or Anon Key are missing!');
  console.error('supabaseUrl:', supabaseUrl ? 'SET' : 'MISSING');
  console.error('supabaseAnonKey:', supabaseAnonKey ? 'SET' : 'MISSING');
  throw new Error('Supabase configuration is missing. Please check your environment variables or supabaseConfig.js');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;