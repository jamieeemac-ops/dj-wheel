const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
import pkg from '@supabase/supabase-js';
const { createClient } = pkg;

export async function handler(event) {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const params = event.httpMethod === 'GET' ? event.queryStringParameters : JSON.parse(event.body || '{}');
  const sessionId = params.sessionId;
  if (!sessionId) return { statusCode: 400, body: 'Missing sessionId' };

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  const { data: sess } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
  const { data: parts } = await supabase.from('session_participants').select('profile_id').eq('session_id', sessionId).order('position', { ascending: true });

  if (!sess || !parts || parts.length === 0) return { statusCode: 200, body: 'No session/participants' };

  let idx = (sess.active_index || 0);
  let tpt = sess.tracks_per_turn || 1;
  let ttt = sess.tracks_this_turn || 0;

  if (ttt + 1 >= tpt) {
    // increment active DJ's tracks
    const activeProfileId = parts[idx].profile_id;
    await supabase.from('session_stats').upsert({ session_id: sessionId, profile_id: activeProfileId, tracks: 0 });
    // increment via SQL function (if exists)
    await supabase.rpc('increment_track', { s_id: sessionId, p_id: activeProfileId }).catch(async () => {
      const { data: row } = await supabase
        .from('session_stats')
        .select('tracks')
        .eq('session_id', sessionId)
        .eq('profile_id', activeProfileId)
        .single();
      const tracks = (row?.tracks || 0) + 1;
      await supabase.from('session_stats').update({ tracks }).eq('session_id', sessionId).eq('profile_id', activeProfileId);
    });
    ttt = 0;
    idx = (idx + 1) % parts.length; 
  } else {
    ttt = ttt + 1; // within multi-track turn
  }

  await supabase.from('sessions').update({ active_index: idx, tracks_this_turn: ttt }).eq('id', sessionId);

  const baseUrl = process.env.BASE_URL || 'https://example.netlify.app';
  await fetch(`${baseUrl}/.netlify/functions/scheduleReminder`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sessionId, minutes: 8 }) }).catch(()=>{});

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
}
