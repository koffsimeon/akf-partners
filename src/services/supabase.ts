import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

// Récupération sécurisée depuis le fichier .env (variables Vite VITE_*)
const supabaseUrl =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || '';

const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || '';

export let supabaseClient: SupabaseClient | null = null;

export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  role: 'CONSULTATION' | 'OPERATIONS' | 'FINANCE' | 'ADMIN' | 'SUPER_ADMIN';
  active: boolean;
}

export function isSupabaseReady(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));
}

if (isSupabaseReady()) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    console.error('Erreur d’initialisation du client Supabase Frontend :', err);
    supabaseClient = null;
  }
}

/**
 * Récupère la session courante active
 */
export async function getSupabaseSession(): Promise<Session | null> {
  if (!supabaseClient) return null;
  try {
    const { data } = await supabaseClient.auth.getSession();
    return data?.session || null;
  } catch {
    return null;
  }
}

/**
 * Récupère l'utilisateur actuellement authentifié
 */
export async function getCurrentUser(): Promise<User | null> {
  if (!supabaseClient) return null;
  try {
    const { data } = await supabaseClient.auth.getUser();
    return data?.user || null;
  } catch {
    return null;
  }
}

/**
 * Récupère le profil et le rôle RBAC depuis public.profiles
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!supabaseClient) return null;
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('id, email, full_name, role, active')
      .eq('id', userId)
      .single();

    if (error || !data) {
      // Fallback gracieux si la table profiles n'a pas encore de ligne pour cet utilisateur
      return {
        id: userId,
        email: '',
        role: 'ADMIN',
        active: true,
      };
    }

    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      role: data.role || 'ADMIN',
      active: data.active !== false,
    };
  } catch {
    return {
      id: userId,
      email: '',
      role: 'ADMIN',
      active: true,
    };
  }
}

/**
 * Écouteur réactif des changements d'état d'authentification
 */
export function subscribeToAuthStateChange(callback: (user: User | null) => void) {
  if (!supabaseClient) {
    return { unsubscribe: () => {} };
  }
  const {
    data: { subscription },
  } = supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    callback(session?.user || null);
  });
  return subscription;
}

/**
 * Connexion sécurisée avec identifiants
 */
export async function signInWithEmailPassword(email: string, password: string) {
  if (!supabaseClient) {
    throw new Error(
      'Supabase n’est pas configuré. Veuillez renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans votre fichier .env.'
    );
  }
  return supabaseClient.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
}

/**
 * Déconnexion sécurisée immédiate
 */
export async function signOutSupabase(): Promise<void> {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
}
