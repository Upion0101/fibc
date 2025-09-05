// src/environments/environment.prod.ts
export const environment = {
  production: true,
  supabase: {
    url: process.env['NG_SUPABASE_URL']!,
    anonKey: process.env['NG_SUPABASE_ANON_KEY']!
  },
  auth0: {
    domain: process.env['NG_AUTH0_DOMAIN']!,
    clientId: process.env['NG_AUTH0_CLIENT_ID']!,
    audience: process.env['NG_AUTH0_AUDIENCE']!,
    authorizationParams: {
      redirect_uri: window.location.origin
    }
  }
};
