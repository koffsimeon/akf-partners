import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldAlert,
  Loader2,
  Sparkles,
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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!isConfigured) {
      setFeedback({
        type: 'error',
        message:
          'Sécurité applicative : Configuration Supabase introuvable dans le fichier .env (SUPABASE_URL et SUPABASE_ANON_KEY requis).',
      });
      return;
    }

    if (!email.trim() || !password) {
      setFeedback({
        type: 'error',
        message: 'Veuillez renseigner votre adresse e-mail et votre mot de passe.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await signInWithEmailPassword(email, password);

      if (error) {
        // Règle de sécurité Niveau 1 : Anti-énumération d'utilisateurs
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
          message: 'Session invalide ou compte inactif. Contactez la direction All Koff’s Food.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message:
          err.message ||
          'Impossible de joindre le serveur d’authentification. Vérifiez votre connexion.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef1f5] text-slate-800 font-['Plus_Jakarta_Sans'] flex flex-col justify-center items-center p-4 sm:p-6 md:p-10">
      {/* Top tiny badge (Inspi alexkyr.com in screenshot) */}
      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-1.5 shadow-xs border border-slate-200/70 backdrop-blur-md">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-black text-white">
          A
        </div>
        <span className="text-xs font-bold text-slate-700 tracking-tight">
          allkoffsfood.com
        </span>
      </div>

      {/* Main Split Floating Card */}
      <div className="w-full max-w-4xl rounded-[36px] bg-white p-4 sm:p-6 md:p-7 shadow-2xl border border-slate-200/60 transition-all duration-300">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-center">
          {/* ========================================================================= */}
          {/* LEFT COLUMN: Gâteau Red Velvet Haute Définition (Inspi visuel utilisateur) */}
          {/* ========================================================================= */}
          <div className="relative h-[280px] sm:h-[340px] md:h-[520px] w-full rounded-[28px] overflow-hidden shadow-inner group">
            <img
              src="/images/akf_cake.jpg"
              alt="Gâteau d'exception All Koff's Food"
              className="h-full w-full object-cover object-center transform group-hover:scale-105 transition-transform duration-700 ease-out"
            />
            {/* Subtle Gradient & Culinary Glass Badge */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/15 to-transparent pointer-events-none" />

            
          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: Formulaire Moderne de Connexion (Inspi Welcome Back Screen)  */}
          {/* ========================================================================= */}
          <div className="flex flex-col justify-center px-2 sm:px-6 md:px-4 py-2 space-y-6">
            {/* Mini Brand Header */}
            <div className="flex items-center gap-2.5">
              <AkfLogo size="sm" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black tracking-tight text-slate-900 uppercase">
                  AKF PARTNERS
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </div>
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Bon retour parmi nous !
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                Saisissez vos identifiants pour accéder à votre cockpit.
              </p>
            </div>

            

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* E-mail Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="direction@allkoffsfood.com"
                    autoComplete="email"
                    required
                    disabled={!isConfigured || isLoading}
                    className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 transition-all disabled:opacity-50"
                  />
                  <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Password Field with Eye Toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    required
                    disabled={!isConfigured || isLoading}
                    className="w-full rounded-2xl bg-slate-50 border border-slate-200 pl-4 pr-11 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 transition-all disabled:opacity-50 font-mono tracking-tight"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded-md border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                  />
                  <span>Se souvenir de moi</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    alert(
                      'Pour réinitialiser votre mot de passe administrateur, veuillez contacter la Direction Générale All Koff’s Food.'
                    )
                  }
                  className="text-xs font-semibold text-slate-500 hover:text-slate-900 hover:underline cursor-pointer"
                >
                  Mot de passe oublié ?
                </button>
              </div>

              {/* Primary Log In Button (Full Rounded Pill in screenshot) */}
              <button
                type="submit"
                disabled={!isConfigured || isLoading}
                className="w-full mt-2 py-3.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-lg shadow-slate-900/10 transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Connexion sécurisée...</span>
                  </>
                ) : (
                  <span>Se connecter</span>
                )}
              </button>
            </form>

            {/* Footer security note */}
            <div className="pt-2 text-center text-[11px] text-slate-400">
              <span>Authentification chiffrée SSL / TLS 1.3 • Supabase Auth</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
