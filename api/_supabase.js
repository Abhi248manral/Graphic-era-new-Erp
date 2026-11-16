import { createClient } from '@supabase/supabase-js';
import { triggerRestore } from './_wake.js';

if (typeof process !== 'undefined' && process.loadEnvFile) {
  try { process.loadEnvFile('.env'); } catch {}
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://tyfxuwwqegxhnzzrpwmp.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    global: {
      fetch: async (url, options) => {
        const res = await fetch(url, options);
        if (!res.ok && res.status >= 500) triggerRestore();
        return res;
      },
    },
  }
);

export default supabase;
