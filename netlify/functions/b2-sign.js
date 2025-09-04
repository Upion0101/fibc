const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

exports.handler = async (event) => {
  try {
    const path = event.queryStringParameters?.path;
    if (!path) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing ?path parameter" }),
      };
    }

    console.log("🎯 Requested path:", path);

    const bucket = process.env.B2_BUCKET;
    const endpoint = process.env.B2_ENDPOINT; // e.g. "https://s3.us-west-000.backblazeb2.com"
    const keyId = process.env.B2_KEY_ID;
    const appKey = process.env.B2_APP_KEY;

    if (!bucket || !endpoint || !keyId || !appKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Missing Backblaze environment variables",
        }),
      };
    }

    // Configure S3 client for Backblaze
    const s3 = new S3Client({
      region: "us-west-002", // Backblaze usually maps to us-west-002
      endpoint,
      credentials: {
        accessKeyId: keyId,
        secretAccessKey: appKey,
      },
    });

    // Create signed URL for GET
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: path,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

    console.log("✅ Generated v4 signed URL:", url);

    return {
      statusCode: 200,
      body: JSON.stringify({ url }),
    };
  } catch (err) {
    console.error("❌ Lambda error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
