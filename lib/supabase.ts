import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// These environment variables will be provided by the user
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        'Missing Supabase Environment Variables. Database features will not work. ' +
        'Please define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'
    );
}

// Fallback to placeholder values to prevent app crash on load when variables are missing
export const supabase = createClient<Database>(
    supabaseUrl || 'https://placeholder-project-id.supabase.co',
    supabaseAnonKey || 'placeholder-anon-key',
    {
        auth: {
            lock: async (_name, _acquireTimeout, fn) => fn(),
        }
    }
);
