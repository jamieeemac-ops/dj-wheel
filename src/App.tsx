// at the top of App.tsx
import { createClient } from '@supabase/supabase-js';
const sb = createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_ANON_KEY!);

// inside the component
const [userId, setUserId] = useState<string | null>(null);
useEffect(() => {
  (async () => {
    const { data: { user } } = await sb.auth.getUser();
    setUserId(user?.id ?? null);
  })();
}, []);



import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";

import {
  initOneSignal,
  ensureSubscribed,
  tagUserAndSession,
  oneSignalDebug,
} from "./lib/onesignal";

// --- ClaimHostButton ---
function ClaimHostButton({ sessionId, hostUserId, userId }: {
  sessionId: string;
  hostUserId: string | null;
  userId: string | null;
}) {
  if (hostUserId || !userId) return null;

  const onClaim = async () => {
    const { error } = await supabase.rpc("claim_host", { p_session: sessionId });
    if (error) console.error(error);
  };

  return <button onClick={onClaim}>Claim Host</button>;
}

// --- StartSessionButton ---
function StartSessionButton({ sessionId, hostUserId, userId, sessionStarted }: {
  sessionId: string;
  hostUserId: string | null;
  userId: string | null;
  sessionStarted: boolean;
}) {
  const isHost = !!userId && userId === hostUserId;
  if (!isHost || sessionStarted) return null;

  const onStart = async () => {
    const { error } = await supabase.rpc("start_session", { p_session: sessionId });
    if (error) console.error(error);
  };

  return <button onClick={onStart}>Start Session</button>;
}

export default function App() {
  const [status, setStatus] = useState("Connecting to Supabase...");
  const [session, setSession] = useState<any>(null);
  const userId = null; // later: set this to your logged-in user's id

  // --- 1. Check Supabase connection ---
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

  // --- 2. Load a test session (replace with real session id) ---
  useEffect(() => {
    async function loadSession() {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .limit(1)
        .single();
      if (!error && data) setSession(data);
    }
    loadSession();
  }, []);

  // --- 3. OneSignal init (global) ---
  useEffect(() => {
    (async () => {
      const appId =
        import.meta.env.VITE_ONESIGNAL_APP_ID ||
        process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
      if (!appId) return;

      await initOneSignal(appId);
      if (!(await ensureSubscribed())) return;

      if (userId && session?.id) {
        await tagUserAndSession(userId, session.id);
        await oneSignalDebug();
      }
    })();
  }, [session?.id, userId]);

  // --- 4. Live session subscription (optional) ---
  useEffect(() => {
    if (!session?.id) return;
    const ch = supabase
      .channel(`session:${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${session.id}`,
        },
        (payload) => setSession(payload.new)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [session?.id]);

  return (
    <div style={{ padding: "2rem", fontSize: "1.2rem", textAlign: "center" }}>
      <p>{status}</p>

      {session ? (
        <div style={{ marginTop: "2rem" }}>
          <h2>Session: {session.name ?? session.id}</h2>

          <ClaimHostButton
            sessionId={session.id}
            hostUserId={session.host_user_id}
            userId={userId}
          />

          <StartSessionButton
            sessionId={session.id}
            hostUserId={session.host_user_id}
            userId={userId}
            sessionStarted={session.session_started}
          />

          {session.session_started && (
            <p style={{ marginTop: "1rem", color: "green" }}>
              ✅ Session started at {session.session_start_time}
            </p>
          )}
        </div>
      ) : (
        <p>Loading session info...</p>
      )}
    </div>
  );
}

