// src/supabase.ts
import { createClient } from '@supabase/supabase-js'

// These values are read from your .env file (local) or Netlify environment variables
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!,
  {
    db: { schema: 'public' },
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    realtime: { params: { eventsPerSecond: 5 } },
  }
)
