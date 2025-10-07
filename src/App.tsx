// src/App.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";

// OneSignal helpers (create these in src/lib/onesignal.ts if you haven't yet)
import {
  initOneSignal,
  ensureSubscribed,
  tagUserAndSession,
  oneSignalDebug,
} from "./lib/onesignal";

// If you already have Supabase Auth wired, you can use your own user hook/context.
// For now we’ll leave userId/sessionId as optional placeholders.
export default function App() {
  const [status, setStatus] = useState("Connecting to Supabase...");

  // 1) Supabase connectivity check (your existing logic)
  useEffect(() => {
    async function checkConnection() {
      try {
        const { error } = await supabase.from("rooms").select("id").limit(1);
        if (error) throw error;
        setStatus("✅ Connected to Supabase successfully!");
      } catch (err: any) {
        setStatus("❌ Connection failed: " + err.message);
      }
    }
    checkConnection();
  }, []);

  // 2) OneSignal init (runs once globally)
  useEffect(() => {
    (async () => {
      const appId = import.meta.env.VITE_ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
      if (!appId) {
        console.warn("OneSignal App ID missing (VITE_ONESIGNAL_APP_ID or NEXT_PUBLIC_ONESIGNAL_APP_ID). Skipping init.");
        return;
      }

      await initOneSignal(appId);

      // Prompt if not yet subscribed
      const subscribed = await ensureSubscribed();
      if (!subscribed) return;

      // OPTIONAL: if you have these values available, tag for precise targeting
      const userId: string | null = null;     // e.g. supabase.auth.getUser().data.user?.id
      const sessionId: string | null = null;  // your current session (room) id, if relevant

      if (userId && sessionId) {
        await tagUserAndSession(userId, sessionId);
      } else if (userId) {
        // still useful to set external_id, even without a session tag
        await tagUserAndSession(userId, "global");
      }

      await oneSignalDebug(); // logs enabled status + ids in console
    })();
  }, []);

  return (
    <div style={{ padding: "2rem", fontSize: "1.2rem", textAlign: "center" }}>
      {status}
    </div>
  );
}

    <div style={{ padding: '2rem', fontSize: '1.2rem', textAlign: 'center' }}>
      {status}
    </div>
  )
}
