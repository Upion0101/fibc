// netlify/functions/calendar-sync.js
const { google } = require('googleapis');

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'Content-Type,Authorization',
  'content-type': 'application/json',
};

const DEFAULT_TZ = process.env.GOOGLE_CAL_TZ || 'America/Kentucky/Louisville';

function assertEnv(v, name) {
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function oauthClient() {
  const clientId = assertEnv(process.env.GOOGLE_CLIENT_ID, 'GOOGLE_CLIENT_ID');
  const clientSecret = assertEnv(process.env.GOOGLE_CLIENT_SECRET, 'GOOGLE_CLIENT_SECRET');
  const refreshToken = assertEnv(process.env.GOOGLE_REFRESH_TOKEN, 'GOOGLE_REFRESH_TOKEN');
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

function toDateTime(dateYmd, timeHHmm, tz = DEFAULT_TZ) {
  if (!dateYmd || !timeHHmm) return null;
  const safe = timeHHmm.length === 5 ? `${timeHHmm}:00` : timeHHmm;
  return { dateTime: `${dateYmd}T${safe}`, timeZone: tz };
}

function toAllDay(dateYmd, tz = DEFAULT_TZ) {
  if (!dateYmd) return null;
  const d = new Date(dateYmd + 'T00:00:00');
  const end = new Date(d);
  end.setDate(end.getDate() + 1);
  const toYmd = (x) => x.toISOString().slice(0, 10);
  return { start: { date: toYmd(d) }, end: { date: toYmd(end) }, timeZone: tz };
}

function formatDescription(input) {
  const lines = [];

  // Title details
  if (input?.setlist_name) {
    lines.push(`Setlist: ${input.setlist_name}`);
  } else if (input?.setlist_id) {
    lines.push(`Setlist: ${input.setlist_id}`);
  }

  if (Array.isArray(input?.songs) && input.songs.length) {
    lines.push('Songs:');
    for (const s of input.songs) {
      const title = s?.title || '(Untitled)';
      const authors = s?.authors ? ` — ${s.authors}` : '';
      lines.push(`• ${title}${authors}`);
    }
  }

  if (input?.members) {
    lines.push(`Members: ${input.members}`);
  }

  const notes = input?.notes || input?.description || '';
  if (notes) {
    lines.push('');
    lines.push(notes);
  }

  if (input?.links && (input.links.setlist || input.links.event || input.links.website)) {
    lines.push('');
    lines.push('Links:');
    if (input.links.setlist) lines.push(`• Setlist: ${input.links.setlist}`);
    if (input.links.event)   lines.push(`• Event: ${input.links.event}`);
    if (input.links.website) lines.push(`• Website: ${input.links.website}`);
  }

  return lines.join('\n');
}

// Build the requestBody for insert/update
function buildEventBody(input, tz = DEFAULT_TZ) {
  const name = input?.name || input?.summary || '(Untitled)';
  const date = input?.event_date;
  const start = input?.start_time || null;
  const end = input?.end_time || null;

  let when = {};
  if (date && (start || end)) {
    const startObj = toDateTime(date, start || '09:00', tz);
    let endObj = end ? toDateTime(date, end, tz) : null;

    if (!endObj) {
      const dt = new Date(`${date}T${(start || '09:00')}:00`);
      dt.setMinutes(dt.getMinutes() + 60);
      const hh = `${dt.getHours()}`.padStart(2, '0');
      const mm = `${dt.getMinutes()}`.padStart(2, '0');
      endObj = toDateTime(date, `${hh}:${mm}`, tz);
    }

    const startIso = new Date(startObj.dateTime);
    const endIso = new Date(endObj.dateTime);
    if (endIso <= startIso) {
      endIso.setMinutes(startIso.getMinutes() + 60);
      const hh = `${endIso.getHours()}`.padStart(2, '0');
      const mm = `${endIso.getMinutes()}`.padStart(2, '0');
      endObj = toDateTime(date, `${hh}:${mm}`, tz);
    }
    when = { start: startObj, end: endObj };
  } else if (date) {
    const allday = toAllDay(date, tz);
    when = { start: { date: allday.start.date }, end: { date: allday.end.date } };
  } else {
    const now = new Date();
    const in1h = new Date(now);
    in1h.setHours(in1h.getHours() + 1);
    when = {
      start: { dateTime: now.toISOString(), timeZone: tz },
      end:   { dateTime: in1h.toISOString(), timeZone: tz },
    };
  }

  return {
    summary: name,
    description: formatDescription(input),  // <<— richer, structured description
    visibility: 'public',
    ...when,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const calendarId = assertEnv(process.env.GOOGLE_CALENDAR_ID, 'GOOGLE_CALENDAR_ID');
    const auth = oauthClient();
    const calendar = google.calendar({ version: 'v3', auth });
    const action = body.action;

    if (action === 'list') {
      const timeMin = body.timeMin || new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const timeMax = body.timeMax || new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();
      const resp = await calendar.events.list({
        calendarId,
        singleEvents: true,
        orderBy: 'startTime',
        timeMin,
        timeMax,
        maxResults: 2500,
      });
      return { statusCode: 200, headers: CORS, body: JSON.stringify(resp.data.items || []) };
    }

    if (action === 'get') {
      const id = body.id || body.calendarEvent?.google_event_id;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing event id' }) };
      const resp = await calendar.events.get({ calendarId, eventId: id });
      return { statusCode: 200, headers: CORS, body: JSON.stringify(resp.data) };
    }

    if (action === 'create') {
      const ev = buildEventBody(body.calendarEvent || body, DEFAULT_TZ);
      const resp = await calendar.events.insert({ calendarId, requestBody: ev });
      return { statusCode: 200, headers: CORS, body: JSON.stringify(resp.data) };
    }

    if (action === 'update') {
      const id = body.calendarEvent?.google_event_id || body.id;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing event id' }) };
      const ev = buildEventBody(body.calendarEvent || body, DEFAULT_TZ);
      const resp = await calendar.events.update({ calendarId, eventId: id, requestBody: ev });
      return { statusCode: 200, headers: CORS, body: JSON.stringify(resp.data) };
    }

    if (action === 'delete') {
      const id = body.id || body.calendarEvent?.google_event_id;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing event id' }) };
      await calendar.events.delete({ calendarId, eventId: id });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (err) {
    const details = err?.response?.data || err?.errors || err?.stack || err?.message || err;
    console.error('Google Calendar API Error:', details);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Calendar function failed', details }) };
  }
};
