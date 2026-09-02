// Loaded after config.js and the Supabase CDN script.
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.CRISSYY_CONFIG;

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
