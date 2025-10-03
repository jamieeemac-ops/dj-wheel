const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
import pkg from '@supabase/supabase-js';
const { createClient } = pkg;

export async function handler(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const { sessionId, minutes = 8 } = JSON.parse(event.body || '{}');
  if (!sessionId) return { statusCode: 400, body: 'Missing sessionId' };

  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_API_KEY;
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const baseUrl = process.env.BASE_URL || 'https://example.netlify.app';

  // session + participants
  const { data: session, error: sErr } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
  if (sErr || !session) return { statusCode: 404, body: 'Session not found' };

  const { data: parts } = await supabase
    .from('session_participants')
    .select('profile_id')
    .eq('session_id', sessionId)
    .order('position', { ascending: true });

  if (!parts || parts.length === 0) return { statusCode: 200, body: 'No participants' };

  const activeProfileId = parts[(session.active_index || 0)].profile_id;
  const { data: stat } = await supabase
    .from('session_stats')
    .select('player_id')
    .eq('session_id', sessionId)
    .eq('profile_id', activeProfileId)
    .single();

  const playerId = stat?.player_id;
  if (!playerId) return { statusCode: 200, body: 'Active DJ has no playerId; skipping push' };

  const sendAfter = new Date(Date.now() + (parseInt(minutes,10) * 60000)).toISOString();

  const payload = {
    app_id: appId,
    include_player_ids: [playerId],
    headings: { en: 'Still mixing?' },
    contents: { en: `It's been ${minutes} min. Keep going or hand over?` },
    buttons: [
      { id: 'still', text: 'Still mixing', url: `${baseUrl}/.netlify/functions/stillMixing?sessionId=${encodeURIComponent(sessionId)}` },
      { id: 'handover', text: 'Hand over', url: `${baseUrl}/.netlify/functions/handOver?sessionId=${encodeURIComponent(sessionId)}` }
    ],
    send_after: sendAfter,
    ios_badgeType: "Increase",
    ios_badgeCount: 1
  };

  const res = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) return { statusCode: res.status, body: JSON.stringify(data) };

  return { statusCode: 200, body: JSON.stringify({ ok: true, id: data.id }) };
}
