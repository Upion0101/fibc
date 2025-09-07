// netlify/functions/song-delete.js
// Deletes ONLY songs marked is_custom = true, and removes their B2 files.
// ENV needed: SUPABASE_URL, SUPABASE_SERVICE_ROLE, B2_BUCKET, B2_ENDPOINT, B2_KEY_ID, B2_APP_KEY

const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'Content-Type,Authorization',
  'content-type': 'application/json',
};

function makeS3() {
  const bucket   = process.env.B2_BUCKET;
  const endpoint = process.env.B2_ENDPOINT; // e.g. https://s3.us-west-000.backblazeb2.com
  const keyId    = process.env.B2_KEY_ID;
  const appKey   = process.env.B2_APP_KEY;

  if (!bucket || !endpoint || !keyId || !appKey) {
    const msg = 'Missing Backblaze environment variables';
    throw Object.assign(new Error(msg), { statusCode: 500 });
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId: keyId, secretAccessKey: appKey },
    forcePathStyle: true, // important for B2
  });

  return { s3, bucket };
}

function makeSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE; // service role key
  if (!url || !key) {
    const msg = 'Missing Supabase admin env vars';
    throw Object.assign(new Error(msg), { statusCode: 500 });
  }
  return createClient(url, key);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { song_id } = JSON.parse(event.body || '{}');
    if (!song_id) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing song_id' }) };
    }

    // 1) Fetch row (admin) to see paths + is_custom
    const supabase = makeSupabaseAdmin();
    const { data: song, error } = await supabase
      .from('songs')
      .select('id, title, is_custom, audio_path, pdf_path, json_path')
      .eq('id', song_id)
      .single();

    if (error || !song) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Song not found' }) };
    }
    if (!song.is_custom) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Refusing to delete non-custom song' }) };
    }

    // 2) Delete files from B2
    const { s3, bucket } = makeS3();
    const keys = [song.audio_path, song.pdf_path, song.json_path].filter(Boolean);

    for (const key of keys) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        console.log('🗑️ deleted', key);
      } catch (e) {
        console.warn('Failed to delete', key, e?.message);
      }
    }

    // 3) Delete row
    const { error: delErr } = await supabase.from('songs').delete().eq('id', song_id);
    if (delErr) {
      // (Optional) you could attempt to roll back files, but not needed here
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: delErr.message }) };
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) };
  } catch (err) {
    const status = err?.statusCode || 500;
    console.error('❌ song-delete error:', err);
    return { statusCode: status, headers: CORS, body: JSON.stringify({ error: err?.message || String(err) }) };
  }
};
