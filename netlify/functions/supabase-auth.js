// netlify/functions/supabase-auth.js
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

const auth0Domain = process.env.AUTH0_DOMAIN; // e.g. "fibc-worship.us.auth0.com"
const supabaseSecret = process.env.SUPABASE_JWT_SECRET; // Supabase → Settings → API → JWT Secret

if (!auth0Domain) {
  console.error("❌ AUTH0_DOMAIN not set in environment variables");
}
if (!supabaseSecret) {
  console.error("❌ SUPABASE_JWT_SECRET not set in environment variables");
}

const client = jwksClient({
  jwksUri: `https://${auth0Domain}/.well-known/jwks.json`,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err) {
      console.error("❌ Error getting signing key:", err);
      return callback(err);
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

exports.handler = async (event) => {
  try {
    const { token } = JSON.parse(event.body || "{}");
    if (!token) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing Auth0 token" }),
        headers: { "Content-Type": "application/json" },
      };
    }

    console.log("🔑 Received token (truncated):", token.slice(0, 30));

    // Verify Auth0 token
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          audience: process.env.AUTH0_AUDIENCE,
          issuer: `https://${auth0Domain}/`,
        },
        (err, decoded) => {
          if (err) {
            console.error("❌ Verification failed:", err.message);
            reject(err);
          } else {
            console.log("✅ Verified token:", decoded);
            resolve(decoded);
          }
        }
      );
    });

    // Create Supabase JWT
    const supabaseJwt = jwt.sign({ sub: decoded.sub }, supabaseSecret, {
      expiresIn: "1h",
    });

    console.log("✅ Supabase token created:", supabaseJwt.slice(0, 30));

    return {
      statusCode: 200,
      body: JSON.stringify({ supabaseToken: supabaseJwt }),
      headers: { "Content-Type": "application/json" }, // 👈 enforce JSON
    };
  } catch (err) {
    console.error("❌ Function error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message, stack: err.stack }),
      headers: { "Content-Type": "application/json" },
    };
  }
};
