import { supabase } from "@/supabase";

export async function sendNextDjPush({
  userId,
  sessionId,
  title = "You’re up next!",
  body = "Get ready to drop your track 🎛️",
  url, // optional deep-link
}: {
  userId: string;
  sessionId: string;
  title?: string;
  body?: string;
  url?: string;
}) {
  // 1) Get the current user's JWT access token
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    console.warn("No Supabase session. User must be signed in to call protected function.");
    return { ok: false, error: "no_session" };
  }

  // 2) Call the protected Edge Function with Authorization header
  const base = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL!;
  const res = await fetch(`${base}/send-next-dj`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
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
