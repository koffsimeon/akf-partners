import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import {
  isSupabaseReady,
  signInWithEmailPassword,
} from '../../services/supabase';
import { AkfLogo } from '../AkfLogo';

interface AuthViewProps {
  onLoginSuccess: (email: string) => void;
}

export function AuthView({ onLoginSuccess }: AuthViewProps) {
  const isConfigured = isSupabaseReady();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!isConfigured) {
      setFeedback({
        type: 'error',
        message:
          'Sécurité applicative : Configuration Supabase introuvable dans le fichier .env.',
      });
      return;
    }

    if (!email.trim() || !password) {
      setFeedback({
        type: 'error',
        message: 'Veuillez saisir votre adresse e-mail et votre mot de passe.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await signInWithEmailPassword(email, password);

      if (error) {
        // Règle de sécurité Niveau 1 : Anti-énumération des utilisateurs
        setFeedback({
          type: 'error',
          message: 'Identifiants incorrects. Veuillez vérifier l’adresse e-mail et le mot de passe.',
        });
        return;
      }

      if (data?.user?.email) {
        onLoginSuccess(data.user.email);
      } else {
        setFeedback({
          type: 'error',
          message: 'Session invalide ou compte inactif. Contactez l’administrateur principal.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message:
          err.message ||
          'Impossible de joindre le service d’authentification. Vérifiez votre connexion.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-['Plus_Jakarta_Sans'] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand & Identity */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-3.5 rounded-3xl bg-slate-800/90 border border-slate-700/80 shadow-2xl backdrop-blur-md mb-1">
            <AkfLogo size="lg" />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white">
                AKF PARTNERS
              </h1>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Portail de pilotage & gestion des commissions • All Koff’s Food
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="rounded-3xl bg-slate-900/90 p-8 shadow-2xl border border-slate-800/90 backdrop-blur-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Authentification Sécurisée
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-500">RLS Actif</span>
          </div>

          {/* Configuration Missing Warning (Anti-Bypass Guard) */}
          {!isConfigured && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
                <span>Système Verrouillé (.env requis)</span>
              </div>
              <p className="text-[11px] text-amber-300/80 leading-relaxed">
                Le fichier <code className="bg-amber-950/80 px-1.5 py-0.5 rounded text-amber-200 font-mono">.env</code> ne contient pas encore les identifiants Supabase de test. Renseignez :
              </p>
              <pre className="p-2 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[10px] overflow-x-auto border border-slate-800">
{`VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=eyJ...`}
              </pre>
            </div>
          )}

          {/* Error Message */}
          {feedback && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-300 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Formulaire de Connexion */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                Adresse E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="direction@allkoffsfood.com"
                  autoComplete="email"
                  required
                  disabled={!isConfigured || isLoading}
                  className="w-full rounded-2xl bg-slate-950/70 border border-slate-800 pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                Mot de Passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                  disabled={!isConfigured || isLoading}
                  className="w-full rounded-2xl bg-slate-950/70 border border-slate-800 pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!isConfigured || isLoading}
              className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Vérification de la session...</span>
                </>
              ) : (
                <>
                  <span>Accéder au Cockpit</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security & Compliance Footer */}
        <div className="text-center space-y-1.5 text-[11px] text-slate-500">
          <p className="flex items-center justify-center gap-1.5 font-medium">
            <Lock className="h-3 w-3 text-emerald-500" />
            <span>Chiffrement SSL / TLS 1.3 • Protection Anti-Brute Force Supabase</span>
          </p>
          <p className="text-[10px] text-slate-600">
            Conformité APDP Bénin • All Koff’s Food © 2026
          </p>
        </div>
      </div>
    </div>
  );
}
