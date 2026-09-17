import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Users,
  ShoppingBag,
  CreditCard,
  Phone,
  MessageSquare,
  Award,
  AlertCircle,
  TrendingUp,
  Pencil,
} from 'lucide-react';
import { Partner } from '../../types';
import { normalizePhone } from '../../engine/akfEngine';

export interface PartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner?: Partner | null;
  mode: 'view' | 'create' | 'edit';
  onSave?: (data: { fullName: string; phone: string; whatsapp?: string }) => Promise<void>;
  onUpdate?: (id: string, updates: Partial<Partner>) => Promise<void>;
  onNavigateTo?: (type: 'CLIENT' | 'ORDER' | 'PAYMENT', filterId: string) => void;
  onInitiatePayment?: (partner: Partner) => void;
  onSwitchMode?: (mode: 'view' | 'create' | 'edit') => void;
}

export function PartnerModal({
  isOpen,
  onClose,
  partner,
  mode,
  onSave,
  onUpdate,
  onNavigateTo,
  onInitiatePayment,
  onSwitchMode,
}: PartnerModalProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [status, setStatus] = useState<'Actif' | 'Inactif'>('Actif');
  const [wave, setWave] = useState('Vague 1');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (partner && mode !== 'create') {
      setFullName(partner.fullName || '');
      setPhone(partner.phone || '');
      setWhatsapp(partner.whatsapp || '');
      setStatus(partner.status || 'Actif');
      setWave(partner.wave || 'Vague 1');
    } else {
      setFullName('');
      setPhone('');
      setWhatsapp('');
      setStatus('Actif');
      setWave('Vague 1');
    }
    setError(null);
  }, [partner, mode, isOpen]);

  if (!isOpen) return null;

  const phonePreview = normalizePhone(phone);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError('Le nom et prénom sont obligatoires.');
      return;
    }
    if (!phone.trim()) {
      setError('Le numéro de téléphone est obligatoire.');
      return;
    }

    try {
      setSubmitting(true);
      if (mode === 'edit' && partner) {
        if (onUpdate) {
          await onUpdate(partner.id, {
            fullName: fullName.trim(),
            phone: phone.trim(),
            whatsapp: whatsapp.trim() || undefined,
            status,
            wave: wave.trim() || 'Vague 1',
          });
        }
      } else if (mode === 'create') {
        if (onSave) {
          await onSave({
            fullName: fullName.trim(),
            phone: phone.trim(),
            whatsapp: whatsapp.trim() || undefined,
          });
        }
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l’enregistrement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {mode === 'create'
                  ? 'Créer un Partenaire'
                  : mode === 'edit'
                  ? `Modifier ${partner?.code}`
                  : `Fiche Partenaire — ${partner?.code}`}
              </h2>
              <p className="text-xs text-slate-500">
                {mode === 'create'
                  ? 'Génération automatique de l’ID AKF et du Code partenaire'
                  : `Inscrit le ${partner?.createdAt ? new Date(partner.createdAt).toLocaleDateString('fr-FR') : '-'}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'view' && partner && onSwitchMode && (
              <button
                type="button"
                onClick={() => onSwitchMode('edit')}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5 text-slate-500" />
                Modifier
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-800 border border-red-200">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {mode === 'view' && partner ? (
            <div className="space-y-6">
              {/* Top Banner Status */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-slate-50 p-4 border border-slate-200/80">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Grade & Vague</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        partner.rank === 'Signature'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : partner.rank === 'Excellence'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : partner.rank === 'Ambassador'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      <Award className="h-3.5 w-3.5" />
                      {partner.rank}
                    </span>
                    <span className="text-xs font-medium text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                      {partner.wave || 'Vague 1'}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                        partner.status === 'Actif'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {partner.status}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Solde disponible</span>
                  <div className="text-xl font-extrabold text-emerald-700 font-['JetBrains_Mono']">
                    {partner.balance.toLocaleString()} FCFA
                  </div>
                </div>
              </div>

              {/* Identity & Contacts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 p-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Nom & Prénom</span>
                  <div className="text-base font-bold text-slate-900 mt-1">{partner.fullName}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">ID: {partner.id} | Code: {partner.code}</div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Coordonnées</span>
                  <div className="flex items-center gap-2 text-sm text-slate-800 mt-1">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>{partner.phone}</span>
                  </div>
                  {partner.whatsapp && (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 mt-1">
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>WhatsApp: {partner.whatsapp}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress to Next Rank */}
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                    Progression de grade
                  </span>
                  <span className="font-bold text-slate-900">
                    {partner.nextRank ? `Vers ${partner.nextRank} (${partner.progressPct}%)` : 'Grade maximal (Signature)'}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-500"
                    style={{ width: `${partner.progressPct}%` }}
                  />
                </div>
                {partner.nextRank && (
                  <div className="flex justify-between text-[11px] text-slate-500 mt-2">
                    <span>CA: {partner.ca.toLocaleString()} / {partner.targetCaNextRank.toLocaleString()} FCFA</span>
                    <span>Commandes: {partner.orderCount} / {partner.targetCmdNextRank}</span>
                  </div>
                )}
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[11px] font-medium text-slate-500">Chiffre d’affaires</span>
                  <div className="text-sm font-bold text-slate-900 mt-0.5 font-['JetBrains_Mono']">
                    {partner.ca.toLocaleString()} F
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[11px] font-medium text-slate-500">Clients rattachés</span>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{partner.clientCount}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[11px] font-medium text-slate-500">Commissions générées</span>
                  <div className="text-sm font-bold text-emerald-600 mt-0.5 font-['JetBrains_Mono']">
                    {partner.totalCommission.toLocaleString()} F
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[11px] font-medium text-slate-500">Commissions payées</span>
                  <div className="text-sm font-bold text-slate-700 mt-0.5 font-['JetBrains_Mono']">
                    {partner.paidCommission.toLocaleString()} F
                  </div>
                </div>
              </div>

              {/* Relational Navigation Buttons */}
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                  Navigation relationnelle
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateTo?.('CLIENT', partner.id);
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
                  >
                    <Users className="h-4 w-4 text-blue-600" />
                    Clients ({partner.clientCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateTo?.('ORDER', partner.id);
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
                  >
                    <ShoppingBag className="h-4 w-4 text-amber-600" />
                    Commandes ({partner.orderCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateTo?.('ORDER', partner.id);
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
                  >
                    <Award className="h-4 w-4 text-emerald-600" />
                    Commissions
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateTo?.('PAYMENT', partner.id);
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
                  >
                    <CreditCard className="h-4 w-4 text-purple-600" />
                    Paiements
                  </button>
                </div>
              </div>

              {/* Action: Pay */}
              {partner.balance >= 5000 && onInitiatePayment && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onInitiatePayment(partner);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
                  >
                    <CreditCard className="h-4 w-4" />
                    Émettre un paiement pour {partner.code} (Solde : {partner.balance.toLocaleString()} FCFA)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'edit' && partner ? (
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Code Partenaire (Invariant) :</span>
                    <strong className="text-slate-900 font-mono text-sm">{partner.code}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">ID Système :</span>
                    <span className="text-slate-700 font-mono">{partner.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Grade actuel (Géré par le moteur de calcul) :</span>
                    <span className="font-bold text-emerald-800">{partner.rank}</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-amber-50/70 p-3 text-xs text-amber-900 border border-amber-200">
                  <strong>Règle système :</strong> Le formulaire ne contient que le nom, téléphone et WhatsApp.
                  L’identifiant (AKFxxx), le code (AKF-xxx), le grade initial (Neo) et la vague sont automatiquement attribués côté serveur.
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Nom & Prénom *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex : Koffi Mensah"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Téléphone *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex : +229 97 12 34 56 ou 97123456"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden font-['JetBrains_Mono']"
                />
                {phone && (
                  <p className="mt-1 text-xs text-slate-500">
                    Format canonique calculé : <code className="text-emerald-700 font-bold">{phonePreview.canonical}</code>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  WhatsApp (Optionnel)
                </label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Ex : +229 97 12 34 56"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden font-['JetBrains_Mono']"
                />
              </div>

              {mode === 'edit' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Statut
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'Actif' | 'Inactif')}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden"
                    >
                      <option value="Actif">Actif</option>
                      <option value="Inactif">Inactif</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Vague
                    </label>
                    <input
                      type="text"
                      value={wave}
                      onChange={(e) => setWave(e.target.value)}
                      placeholder="Ex : Vague 1"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (mode === 'edit' && onSwitchMode) {
                      onSwitchMode('view');
                    } else {
                      onClose();
                    }
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting
                    ? 'Enregistrement...'
                    : mode === 'edit'
                    ? 'Enregistrer les modifications'
                    : 'Créer le Partenaire'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
