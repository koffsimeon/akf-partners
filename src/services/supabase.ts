import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

// Récupération des variables Vite (import.meta.env) avec fallback sur process.env ou session
const supabaseUrl =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  sessionStorage.getItem('akf_supabase_url') ||
  '';

const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  sessionStorage.getItem('akf_supabase_anon_key') ||
  '';

export let supabaseClient: SupabaseClient | null = null;

export function isSupabaseReady(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));
}

export function initSupabaseClient(url?: string, anonKey?: string): SupabaseClient | null {
  const targetUrl = url || supabaseUrl;
  const targetKey = anonKey || supabaseAnonKey;

  if (!targetUrl || !targetKey || !targetUrl.startsWith('http')) {
    return null;
  }

  try {
    supabaseClient = createClient(targetUrl, targetKey);
    sessionStorage.setItem('akf_supabase_url', targetUrl);
    sessionStorage.setItem('akf_supabase_anon_key', targetKey);
    return supabaseClient;
  } catch (err) {
    console.error('Erreur d’initialisation du client Supabase Frontend :', err);
    return null;
  }
}

// Initialisation immédiate si disponible
if (isSupabaseReady()) {
  initSupabaseClient(supabaseUrl, supabaseAnonKey);
}

export async function getCurrentUser(): Promise<User | null> {
  if (!supabaseClient) return null;
  const { data } = await supabaseClient.auth.getUser();
  return data?.user || null;
}

export async function signInWithEmailPassword(email: string, password: string) {
  if (!supabaseClient) {
    throw new Error('Supabase n’est pas configuré. Veuillez renseigner l’URL et la clé publique.');
  }
  return supabaseClient.auth.signInWithPassword({ email, password });
}

export async function signOutSupabase() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
}
