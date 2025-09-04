const AWS = require("aws-sdk");

exports.handler = async function (event) {
  try {
    const { key } = JSON.parse(event.body || "{}");
    if (!key) {
      return { statusCode: 400, body: "Missing file key" };
    }

    const s3 = new AWS.S3({
      endpoint: process.env.B2_ENDPOINT,
      accessKeyId: process.env.B2_KEY_ID,
      secretAccessKey: process.env.B2_APP_KEY,
      signatureVersion: "v4",
    });

    const params = {
      Bucket: process.env.B2_BUCKET,
      Key: key,
      Expires: 3600,
    };

    const url = await s3.getSignedUrlPromise("getObject", params);

    return {
      statusCode: 200,
      body: JSON.stringify({ url }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "Error generating signed URL" };
  }
};
