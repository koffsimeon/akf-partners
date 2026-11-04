import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  Key,
  Database,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  LogOut,
  ExternalLink,
  Layers,
} from 'lucide-react';
import {
  isSupabaseReady,
  initSupabaseClient,
  signInWithEmailPassword,
  signOutSupabase,
  getCurrentUser,
} from '../../services/supabase';
import { AkfLogo } from '../AkfLogo';

interface AuthViewProps {
  onDismiss?: () => void;
  onLoginSuccess?: (email: string) => void;
}

export function AuthView({ onDismiss, onLoginSuccess }: AuthViewProps) {
  const [isConfigured, setIsConfigured] = useState(isSupabaseReady());
  const [supabaseUrl, setSupabaseUrl] = useState(
    sessionStorage.getItem('akf_supabase_url') || ''
  );
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(
    sessionStorage.getItem('akf_supabase_anon_key') || ''
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [showConfigForm, setShowConfigForm] = useState(!isSupabaseReady());

  useEffect(() => {
    async function checkUser() {
      const u = await getCurrentUser();
      if (u?.email) {
        setCurrentUserEmail(u.email);
      }
    }
    checkUser();
  }, [isConfigured]);

  const handleSaveSupabaseConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!supabaseUrl.startsWith('https://') || !supabaseAnonKey.trim()) {
      setFeedback({
        type: 'error',
        message: 'Veuillez saisir une URL Supabase valide (https://...) et votre clé Anon.',
      });
      return;
    }

    try {
      const client = initSupabaseClient(supabaseUrl.trim(), supabaseAnonKey.trim());
      if (client) {
        setIsConfigured(true);
        setShowConfigForm(false);
        setFeedback({
          type: 'success',
          message: 'Connexion Supabase initialisée avec succès !',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Échec d'initialisation : ${err.message || 'identifiants non reconnus'}`,
      });
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsLoading(true);

    try {
      const { data, error } = await signInWithEmailPassword(email, password);
      if (error) {
        throw error;
      }
      if (data?.user?.email) {
        setCurrentUserEmail(data.user.email);
        setFeedback({
          type: 'success',
          message: `Connexion réussie. Bienvenue ${data.user.email} !`,
        });
        onLoginSuccess?.(data.user.email);
        setTimeout(() => {
          onDismiss?.();
        }, 1200);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message:
          err.message === 'Invalid login credentials'
            ? 'Identifiants invalides. Vérifiez l’adresse e-mail et le mot de passe.'
            : err.message || 'Erreur lors de la connexion',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutSupabase();
    setCurrentUserEmail(null);
    setFeedback({
      type: 'success',
      message: 'Vous avez été déconnecté avec succès.',
    });
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl border border-slate-200/80 space-y-6 animate-in fade-in duration-300">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-slate-900 shadow-sm mb-1">
            <AkfLogo size="lg" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            AKF PARTNERS
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Portail de gestion & synchronisation sécurisée
          </p>
        </div>

        {/* Supabase Status Pill */}
        <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-800">Serveur Supabase</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="text-[11px] font-bold text-slate-600">
              {isConfigured ? 'Prêt & Connecté' : 'Non configuré'}
            </span>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`rounded-2xl p-3.5 text-xs font-semibold flex items-start gap-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-rose-50 text-rose-900 border border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Current User Session or Login Form */}
        {currentUserEmail ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Session Authentifiée</span>
            </div>
            <div className="font-mono text-xs font-bold text-slate-800 bg-white p-2.5 rounded-xl border border-emerald-200">
              {currentUserEmail}
            </div>
            <div className="text-[11px] text-emerald-800">
              Rôle actif : <strong className="font-extrabold">ADMINISTRATION AKF</strong>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={handleSignOut}
                className="flex-1 py-2.5 rounded-xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Déconnexion</span>
              </button>
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Accéder au Cockpit
                </button>
              )}
            </div>
          </div>
        ) : showConfigForm ? (
          /* Formulaire de configuration Supabase si le projet vient d'être créé */
          <form onSubmit={handleSaveSupabaseConfig} className="space-y-3.5">
            <div className="rounded-xl bg-amber-50/80 p-3 border border-amber-200 text-[11px] text-amber-900 space-y-1">
              <span className="font-bold block">Création du projet Supabase en cours ?</span>
              <p>
                Renseignez ci-dessous l'URL et la clé publique (Anon Key) générées sur votre console
                Supabase pour activer l'authentification et les migrations SQL.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Project URL Supabase
              </label>
              <div className="relative">
                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="url"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  required
                  className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Clé Publique (Anon Key)
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  required
                  className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Enregistrer & Connecter</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowConfigForm(false);
                }}
                className="text-center text-xs font-bold text-slate-500 hover:text-slate-800 py-1"
              >
                Utiliser le compte de démonstration / local
              </button>
            </div>
          </form>
        ) : (
          /* Formulaire de Connexion Email / Mot de passe */
          <form onSubmit={handleSignIn} className="space-y-3.5">
            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Adresse E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="direction@allkoffsfood.com"
                  required
                  className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Mot de Passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{isLoading ? 'Connexion en cours...' : 'Se connecter au Cockpit'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <div className="flex items-center justify-between pt-2 text-[11px] text-slate-500">
                <button
                  type="button"
                  onClick={() => setShowConfigForm(true)}
                  className="font-bold text-indigo-600 hover:underline cursor-pointer"
                >
                  Configurer URL Supabase
                </button>
                {onDismiss && (
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="hover:underline cursor-pointer"
                  >
                    Continuer en mode local
                  </button>
                )}
              </div>
            </div>
          </form>
        )}

        {/* Footer info */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
          <span>AKF Partners v1.0.0</span>
          <span>Bénin (+229) • All Koff's Food</span>
        </div>
      </div>
    </div>
  );
}
