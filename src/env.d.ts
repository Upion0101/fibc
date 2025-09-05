interface ImportMetaEnv {
  readonly NG_SUPABASE_URL: string;
  readonly NG_SUPABASE_ANON_KEY: string;
  readonly NG_AUTH0_DOMAIN: string;
  readonly NG_AUTH0_CLIENT_ID: string;
  readonly NG_AUTH0_AUDIENCE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
