import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";

import {
  initOneSignal,
  ensureSubscribed,
  tagUserAndSession,
  oneSignalDebug,
} from "./lib/onesignal";

// =====================
// Authenticated function helper (Option 2)
// =====================
async function sendNextDjPush({
  userId,
  sessionId,
  title = "You’re up next 🎧",
  body = "Get ready to drop your track!",
  url,
}: {
  userId: string;
  sessionId: string;
  title?: string;
  body?: string;
  url?: string;
}) {
  // 1) get current user's access token
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    console.warn("No Supabase session: user must be signed in to call protected function");
    return { ok: false, error: "no_session" };
  }

  // 2) call the protected Edge Function with Authorization header
  const base = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL!;
  const res = await fetch(`${base}/send-next-dj`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId, sessionId, title, body, url }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn("send-next-dj failed", res.status, json);
    return { ok: false, error: json };
  }
  return { ok: true, result: json };
}

// --- ClaimHostButton ---
function ClaimHostButton({
  sessionId,
  hostUserId,
  userId,
}: {
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
function StartSessionButton({
  sessionId,
  hostUserId,
  userId,
  sessionStarted,
  onNotifyFirst,
}: {
  sessionId: string;
  hostUserId: string | null;
  userId: string | null;
  sessionStarted: boolean;
  onNotifyFirst?: () => void;
}) {
  const isHost = !!userId && userId === hostUserId;
  if (!isHost || sessionStarted) return null;

  const onStart = async () => {
    const { error } = await supabase.rpc("start_session", { p_session: sessionId });
    if (error) return console.error(error);
    // optional: immediately notify first DJ after starting
    if (onNotifyFirst) onNotifyFirst();
  };

  return <button onClick={onStart}>Start Session</button>;
}

export default function App() {
  const [status, setStatus] = useState("Connecting to Supabase...");
  const [session, setSession] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // --- 0. Auth: load logged-in user id (required for Option 2) ---
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    })();
  }, []);

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

  // --- 2. Load a test session (replace with real session id logic if needed) ---
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
        process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ||
        (import.meta as any).env?.VITE_ONESIGNAL_APP_ID;
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

  // --- demo helper to notify "next DJ": here we just notify ourselves for testing ---
  async function testNotifyMe() {
    if (!userId || !session?.id) return;
    await sendNextDjPush({
      userId, // in real flow, use the *next* participant's auth user id
      sessionId: session.id,
      url: `${window.location.origin}/session/${session.id}`,
    });
  }

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
            onNotifyFirst={testNotifyMe} // optional: ping someone at start
          />

          {session.session_started && (
            <p style={{ marginTop: "1rem", color: "green" }}>
              ✅ Session started at {session.session_start_time}
            </p>
          )}

          {/* Temporary test button so you can verify the authenticated call */}
          <div style={{ marginTop: 16 }}>
            <button onClick={testNotifyMe}>Send test authenticated push (to me)</button>
          </div>
        </div>
      ) : (
        <p>Loading session info...</p>
      )}
    </div>
  );
}

