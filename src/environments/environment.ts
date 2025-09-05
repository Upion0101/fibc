export const environment = {
  production: false,
  supabase: {
    url: 'https://tbijwxzogmeytmelanbv.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiaWp3eHpvZ21leXRtZWxhbmJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MzUyMjMsImV4cCI6MjA3MjUxMTIyM30.MvsRVQtTe5P9XKq2vuXhIpgCBYLmsy935jeEv9RL7_Q' // the anon key from Supabase → Settings → API
  },
  auth0: {
    domain: 'dev-kkj35gs466jb87ma.us.auth0.com',
    clientId: 'Tio7lP6wSISASZYvHTh2znOXIStIuDrT',
    audience: 'https://tbijwxzogmeytmelanbv.supabase.co',
    authorizationParams: {
      redirect_uri: window.location.origin
    }
  }
};
