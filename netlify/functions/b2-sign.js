// netlify/functions/b2-sign.js
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'Content-Type,Authorization',
  'content-type': 'application/json',
};

function makeClient() {
  const bucket   = process.env.B2_BUCKET;
  const endpoint = process.env.B2_ENDPOINT; // e.g. https://s3.us-west-000.backblazeb2.com
  const keyId    = process.env.B2_KEY_ID;
  const appKey   = process.env.B2_APP_KEY;

  if (!bucket || !endpoint || !keyId || !appKey) {
    const msg = 'Missing Backblaze environment variables';
    throw Object.assign(new Error(msg), { statusCode: 500 });
  }

  const s3 = new S3Client({
    region: 'auto',       // B2 ignores region; keep for SDK
    endpoint,
    credentials: { accessKeyId: keyId, secretAccessKey: appKey },
    forcePathStyle: true, // important for B2 (no virtual-hosted-style)
  });

  return { s3, bucket };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  try {
    const { s3, bucket } = makeClient();

    if (event.httpMethod === 'GET') {
      // Read signer: /.netlify/functions/b2-sign?path=...&expires=600[&contentType=...][&download=filename]
      const qs = event.queryStringParameters || {};
      const raw = qs.path;
      if (!raw) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing ?path' }) };
      }

      const path = String(raw).replace(/^\/+/, '').trim();
      let expires = parseInt(qs.expires || '600', 10);
      if (!(expires > 0)) expires = 600;
      if (expires > 3600) expires = 3600;

      const contentType = qs.contentType && String(qs.contentType);
      const download    = qs.download && String(qs.download).trim();

      const getParams = {
        Bucket: bucket,
        Key: path,
        ...(contentType ? { ResponseContentType: contentType } : {}),
        ...(download ? { ResponseContentDisposition: `attachment; filename="${download}"` } : {}),
      };

      const url = await getSignedUrl(s3, new GetObjectCommand(getParams), { expiresIn: expires });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ url }) };
    }

    if (event.httpMethod === 'POST') {
      // Upload signer: body { objectKey, contentType, expires? }
      let body = {};
      try { body = JSON.parse(event.body || '{}'); }
      catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON body' }) }; }

      const { objectKey, contentType, expires: expIn } = body;
      if (!objectKey || !contentType) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing objectKey or contentType' }) };
      }

      const key = String(objectKey).replace(/^\/+/, '').trim();
      let expires = parseInt(expIn || '300', 10);
      if (!(expires > 0)) expires = 300;
      if (expires > 3600) expires = 3600;

      const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
      const url = await getSignedUrl(s3, cmd, { expiresIn: expires });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ url }) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (err) {
    const status = err?.statusCode || 500;
    console.error('❌ b2-sign error:', err);
    return { statusCode: status, headers: CORS, body: JSON.stringify({ error: err?.message || String(err) }) };
  }
};
