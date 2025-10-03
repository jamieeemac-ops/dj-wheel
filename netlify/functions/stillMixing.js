const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export async function handler(event) {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const params = event.httpMethod === 'GET' ? event.queryStringParameters : JSON.parse(event.body || '{}');
  const sessionId = params.sessionId;
  if (!sessionId) return { statusCode: 400, body: 'Missing sessionId' };

  const baseUrl = process.env.BASE_URL || 'https://example.netlify.app';
  await fetch(`${baseUrl}/.netlify/functions/scheduleReminder`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ sessionId, minutes: 8 })
  }).catch(()=>{});

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
}
