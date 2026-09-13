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
  Check,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  FileText,
  Pencil,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Client, Order, Partner, Payment, Product, SystemConfig } from '../types';
import { normalizePhone } from '../engine/akfEngine';

interface PartnerModalProps {
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
  const whatsappPreview = normalizePhone(whatsapp);

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

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client?: Client | null;
  partners: Partner[];
  mode: 'view' | 'create';
  onSave?: (data: { fullName: string; phone: string; whatsapp?: string; partnerId?: string }) => Promise<void>;
  onNavigateTo?: (type: 'PARTNER' | 'ORDER', id: string) => void;
  onUpdate?: (id: string, updates: Partial<Client>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function ClientModal({
  isOpen,
  onClose,
  client,
  partners,
  mode,
  onSave,
  onNavigateTo,
  onUpdate,
  onDelete,
}: ClientModalProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [partnerSearch, setPartnerSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit / Delete states in view mode
  const [isEditing, setIsEditing] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setFullName('');
    setPhone('');
    setWhatsapp('');
    setPartnerId('');
    setPartnerSearch('');
    setError(null);
    setIsEditing(false);
    setShowDeleteConfirm(false);

    if (client) {
      setEditFullName(client.fullName || '');
      setEditPhone(client.phone || '');
      setEditWhatsapp(client.whatsapp || '');
      setEditCity(client.city || '');
      setEditAddress(client.address || '');
      setEditNotes(client.notes || '');
    }
  }, [isOpen, client]);

  if (!isOpen) return null;

  const filteredPartners = partners.filter(
    (p) =>
      p.code.toLowerCase().includes(partnerSearch.toLowerCase()) ||
      p.fullName.toLowerCase().includes(partnerSearch.toLowerCase()) ||
      p.phoneCanonical.includes(partnerSearch)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) return setError('Le nom & prénom est obligatoire.');
    if (!phone.trim()) return setError('Le numéro de téléphone est obligatoire.');

    try {
      setSubmitting(true);
      if (onSave) {
        await onSave({
          fullName: fullName.trim(),
          phone: phone.trim(),
          whatsapp: whatsapp.trim() || undefined,
          partnerId: partnerId || undefined,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l’enregistrement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !onUpdate) return;
    setError(null);
    if (!editFullName.trim()) return setError('Le nom & prénom est obligatoire.');
    if (!editPhone.trim()) return setError('Le numéro de téléphone est obligatoire.');

    try {
      setSubmitting(true);
      await onUpdate(client.id, {
        fullName: editFullName.trim(),
        phone: editPhone.trim(),
        whatsapp: editWhatsapp.trim() || undefined,
        city: editCity.trim() || undefined,
        address: editAddress.trim() || undefined,
        notes: editNotes.trim() || undefined,
      });
      setIsEditing(false);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!client || !onDelete) return;
    setError(null);
    try {
      setIsDeleting(true);
      await onDelete(client.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {mode === 'create'
                  ? 'Créer un Client'
                  : isEditing
                  ? `Modifier le Client — ${client?.id}`
                  : `Fiche Client — ${client?.id}`}
              </h2>
              <p className="text-xs text-slate-500">
                {mode === 'create' ? 'Rattachement partenaire ou DIRECT AKF' : client?.fullName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-800 border border-red-200">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {mode === 'view' && client ? (
            isEditing ? (
              <form onSubmit={handleUpdateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Nom & Prénom *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Téléphone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 font-['JetBrains_Mono'] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    WhatsApp (Optionnel)
                  </label>
                  <input
                    type="tel"
                    value={editWhatsapp}
                    onChange={(e) => setEditWhatsapp(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 font-['JetBrains_Mono'] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Ville
                    </label>
                    <input
                      type="text"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      placeholder="Ex : Cotonou"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Adresse
                    </label>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder="Ex : Haie Vive"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Notes internes sur le client..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 outline-hidden resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? 'Enregistrement...' : 'Sauvegarder'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Identité</div>
                      <div className="text-base font-bold text-slate-900 mt-0.5">{client.fullName}</div>
                      <div className="text-xs font-mono text-slate-500">ID: {client.id}</div>
                    </div>
                    {onUpdate && (
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Modifier
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-700">
                    <div className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span>{client.phone}</span>
                    </div>
                    {client.whatsapp && (
                      <div className="flex items-center gap-1 text-emerald-700">
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>WA: {client.whatsapp}</span>
                      </div>
                    )}
                  </div>
                  {(client.city || client.address) && (
                    <div className="mt-2 text-xs text-slate-500">
                      📍 {[client.address, client.city].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {client.notes && (
                    <div className="mt-2 text-xs text-slate-600 bg-white p-2 rounded border border-slate-200">
                      📝 {client.notes}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Rattachement</div>
                  <div className="flex items-center justify-between mt-1">
                    <div>
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                          client.clientType === 'PARTENAIRE'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {client.clientType}
                      </span>
                      {client.partnerCode && (
                        <div className="text-sm font-semibold text-slate-900 mt-1">
                          {client.partnerCode} — {client.partnerName}
                        </div>
                      )}
                    </div>
                    {client.partnerId && onNavigateTo && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateTo('PARTNER', client.partnerId!);
                        }}
                        className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1"
                      >
                        Voir partenaire <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="text-xs text-slate-500 font-medium">Commandes passées</span>
                    <div className="text-lg font-bold text-slate-900 mt-0.5">{client.orderCount}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="text-xs text-slate-500 font-medium">CA cumulé</span>
                    <div className="text-lg font-bold text-slate-900 mt-0.5 font-['JetBrains_Mono']">
                      {client.totalCa.toLocaleString()} F
                    </div>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateTo?.('ORDER', client.id);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <ShoppingBag className="h-4 w-4 text-amber-600" />
                    Voir l'historique des commandes ({client.orderCount})
                  </button>

                  {/* Section Suppression Client */}
                  {onDelete && (
                    <div className="pt-2 border-t border-slate-100">
                      {client.orderCount > 0 ? (
                        <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs text-slate-500 flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <strong>Suppression impossible :</strong> Ce client est rattaché à{' '}
                            <strong>{client.orderCount} commande(s)</strong> dans l'historique commercial AKF. Pour préserver l'intégrité de la base et des commissions, la suppression est bloquée.
                          </div>
                        </div>
                      ) : showDeleteConfirm ? (
                        <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-2">
                          <div className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            Confirmation de suppression définitive
                          </div>
                          <p className="text-xs text-red-700">
                            Êtes-vous sûr de vouloir supprimer définitivement le client <strong>{client.fullName}</strong> ({client.id}) ? Cette action est irréversible.
                          </p>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowDeleteConfirm(false)}
                              disabled={isDeleting}
                              className="flex-1 py-1.5 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Annuler
                            </button>
                            <button
                              type="button"
                              onClick={handleDeleteClient}
                              disabled={isDeleting}
                              className="flex-1 py-1.5 px-3 rounded-lg bg-red-600 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {isDeleting ? 'Suppression...' : 'Confirmer la suppression'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(true)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Supprimer ce client
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Nom & Prénom *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex : Bio Alassane"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-hidden"
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
                  placeholder="Ex : 90 11 22 33 ou +22990112233"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 font-['JetBrains_Mono'] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  WhatsApp (Optionnel)
                </label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Ex : +229 90 11 22 33"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 font-['JetBrains_Mono'] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Partenaire associé
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Si aucun partenaire n'est sélectionné, le client sera marqué <strong>DIRECT AKF</strong>.
                </p>

                <input
                  type="text"
                  placeholder="Filtrer par nom, code (AKF-001) ou téléphone..."
                  value={partnerSearch}
                  onChange={(e) => setPartnerSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 mb-2 focus:border-blue-500 outline-hidden"
                />

                <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                  <label className="flex items-center gap-3 p-2.5 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="radio"
                      name="partnerOption"
                      checked={partnerId === ''}
                      onChange={() => setPartnerId('')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-slate-800">DIRECT AKF</span>
                      <span className="text-slate-400 ml-1">(Aucun partenaire affilié)</span>
                    </div>
                  </label>

                  {filteredPartners.map((p) => (
                    <label key={p.id} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="radio"
                        name="partnerOption"
                        checked={partnerId === p.id}
                        onChange={() => setPartnerId(p.id)}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-900">{p.code}</span>
                        <span className="text-slate-700 ml-1.5">{p.fullName}</span>
                        <span className="text-slate-400 ml-1.5 font-mono">({p.phone})</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Validation...' : 'Créer le Client'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order?: Order | null;
  clients: Client[];
  products: Product[];
  config: SystemConfig;
  mode: 'view' | 'create';
  onSave?: (data: { clientId: string; productId: string; quantity: number; unitPrice?: number; date?: string }) => Promise<void>;
  onNavigateTo?: (type: 'PARTNER' | 'CLIENT', id: string) => void;
  onUpdateStatus?: (orderId: string, status: string) => Promise<void>;
  onDelete?: (orderId: string) => Promise<void>;
}

export function OrderModal({
  isOpen,
  onClose,
  order,
  clients,
  products,
  config,
  mode,
  onSave,
  onNavigateTo,
  onUpdateStatus,
  onDelete,
}: OrderModalProps) {
  const [clientId, setClientId] = useState('');
  const [productId, setProductId] = useState('');
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [quantity, setQuantity] = useState<number | string>(1);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'create') {
      if (products.length > 0) {
        const currentProd = products.find((p) => p.id === productId);
        const targetProd = currentProd || products[0];
        setProductId(targetProd.id);
        setUnitPrice(targetProd.price);
      }
      if (clients.length > 0 && (!clientId || !clients.some((c) => c.id === clientId))) {
        setClientId(clients[0].id);
      }
      setError(null);
    }
  }, [isOpen, mode, products, clients]);

  const handleProductChange = (newProductId: string) => {
    setProductId(newProductId);
    const prod = products.find((p) => p.id === newProductId);
    if (prod) {
      setUnitPrice(prod.price);
    }
  };

  if (!isOpen) return null;

  const selectedProduct = products.find((p) => p.id === productId) || (products.length > 0 ? products[0] : undefined);
  const selectedClient = clients.find((c) => c.id === clientId);

  // Source de vérité absolue pour le prix de vente :
  // - RÉCURRENT : strictement fixé par GRILLE_COMMISSION (non modifiable)
  // - PREMIUM : valeur par défaut de GRILLE_COMMISSION mais modifiable lors de la saisie
  const effectiveUnitPrice = selectedProduct?.isPremium
    ? (unitPrice !== undefined && unitPrice !== null && !isNaN(unitPrice) ? unitPrice : (selectedProduct?.price ?? 0))
    : (selectedProduct?.price ?? 0);

  const parsedQty = typeof quantity === 'number' ? quantity : parseInt(String(quantity), 10) || 0;
  const calculatedTotal = effectiveUnitPrice * (parsedQty > 0 ? parsedQty : 1);

  // Détection du produit et du type de commission pour le mode consultation
  const matchedProduct = order
    ? products.find(
        (p) =>
          p.id === order.productId ||
          (p.name && order.productName && p.name.trim().toLowerCase() === order.productName.trim().toLowerCase())
      )
    : null;

  const isForfaitaire =
    order?.isPremium === false ||
    matchedProduct?.category === 'RÉCURRENT' ||
    matchedProduct?.commissionType?.toLowerCase().includes('forfait');

  let unitForfaitAmount = 0;
  if (order && isForfaitaire) {
    if (order.commissionAmount > 0 && order.quantity > 0) {
      unitForfaitAmount = Math.round(order.commissionAmount / order.quantity);
    } else if (matchedProduct) {
      const rank = order.partnerRankAtOrder;
      if (rank === 'Signature') unitForfaitAmount = matchedProduct.commissionSignature ?? 0;
      else if (rank === 'Excellence') unitForfaitAmount = matchedProduct.commissionExcellence ?? 0;
      else if (rank === 'Ambassador') unitForfaitAmount = matchedProduct.commissionAmbassador ?? 0;
      else unitForfaitAmount = matchedProduct.commissionNeo ?? 0;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!clientId) return setError('Le client est obligatoire.');
    if (!productId) return setError('Le produit est obligatoire.');
    const validQty = typeof quantity === 'number' ? quantity : parseInt(String(quantity), 10);
    if (!validQty || isNaN(validQty) || validQty < 1) {
      return setError('La quantité est obligatoire et doit être un entier supérieur ou égal à 1.');
    }
    if (effectiveUnitPrice < 0) return setError('Le prix unitaire ne peut pas être négatif.');

    try {
      setSubmitting(true);
      if (onSave) {
        await onSave({
          clientId,
          productId,
          quantity: validQty,
          unitPrice: Number(effectiveUnitPrice),
          date: orderDate,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l’enregistrement de la commande');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {mode === 'create' ? 'Nouvelle Commande' : `Commande — ${order?.id}`}
              </h2>
              <p className="text-xs text-slate-500">
                {mode === 'create' ? 'Calcul automatique de la commission' : order?.productName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-800 border border-red-200">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {mode === 'view' && order ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div>
                  <div className="text-xs font-semibold text-slate-400">Total Commande</div>
                  <div className="text-2xl font-extrabold text-slate-900 font-['JetBrains_Mono']">
                    {order.totalAmount.toLocaleString()} FCFA
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                      order.orderStatus === 'Terminée' || order.orderStatus === 'Livrée'
                        ? 'bg-emerald-100 text-emerald-800'
                        : order.orderStatus === 'Annulée'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {order.orderStatus}
                  </span>
                  <div className="text-xs text-slate-500 mt-1">{order.date}</div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Client :</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateTo?.('CLIENT', order.clientId);
                    }}
                    className="font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {order.clientName} ({order.clientId}) <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Partenaire bénéficiaire :</span>
                  {order.partnerId ? (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateTo?.('PARTNER', order.partnerId!);
                      }}
                      className="font-bold text-emerald-600 hover:underline flex items-center gap-1"
                    >
                      {order.partnerCode} — {order.partnerName} <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <span className="font-semibold text-slate-400">DIRECT AKF</span>
                  )}
                </div>

                <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Produit commandé :</span>
                  <span className="font-bold text-slate-900">
                    {order.productName} (x{order.quantity})
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Catégorie officielle :</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                      order.isPremium ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {order.isPremium ? 'PREMIUM' : 'RÉCURRENT'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Rang Premium Client :</span>
                  <span className="font-bold text-slate-900">
                    {order.premiumRankForClient ? `Commande n°${order.premiumRankForClient}` : 'Non éligible (>3 ou Non-Premium)'}
                  </span>
                </div>
              </div>

              {/* Commission Box */}
              <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                        Commission Partenaire
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isForfaitaire ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isForfaitaire ? 'FORFAITAIRE' : 'POURCENTAGE'}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-emerald-900 font-['JetBrains_Mono'] mt-0.5">
                      {order.commissionAmount.toLocaleString()} FCFA
                    </div>
                  </div>

                  <div className="sm:text-right">
                    {isForfaitaire ? (
                      <div>
                        <span className="text-xs font-medium text-emerald-700 block">
                          Type de commission ({order.partnerRankAtOrder || 'Neo'})
                        </span>
                        <div className="text-sm font-bold text-emerald-900 font-['JetBrains_Mono'] mt-0.5">
                          Commission forfaitaire : {unitForfaitAmount.toLocaleString()} FCFA × {order.quantity} = {(unitForfaitAmount * order.quantity).toLocaleString()} FCFA
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="text-xs font-medium text-emerald-700 block">Taux appliqué</span>
                        <div className="text-sm font-bold text-emerald-900 mt-0.5">
                          Taux appliqué : {(order.commissionRate * 100).toFixed(0)} % ({order.partnerRankAtOrder || 'N/A'})
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions sur le statut de la commande */}
              {onUpdateStatus && (
                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                  {order.orderStatus !== 'Terminée' && order.orderStatus !== 'Livrée' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await onUpdateStatus(order.id, 'Terminée');
                        onClose();
                      }}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <Check className="h-4 w-4" /> Marquer comme Terminée (Valider la commission)
                    </button>
                  )}
                  {order.orderStatus !== 'Annulée' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await onUpdateStatus(order.id, 'Annulée');
                        onClose();
                      }}
                      className="py-2.5 px-4 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-rose-50 hover:text-rose-700 transition-colors"
                    >
                      Annuler la commande
                    </button>
                  )}
                </div>
              )}

              {/* Section Suppression Commande avec vérification stricte des règles métier AKF */}
              {onDelete && (
                <div className="pt-2 border-t border-slate-100">
                  {order.orderStatus === 'Annulée' ? (
                    <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <strong>Suppression interdite (Piste d'audit AKF) :</strong> Une commande au statut « Annulée » fait partie intégrante de la piste d'audit obligatoire et ne peut être supprimée définitivement.
                      </div>
                    </div>
                  ) : order.commissionStatus === 'Payée' ? (
                    <div className="rounded-xl bg-rose-50 p-3 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Suppression strictement interdite (Règlement effectué) :</strong> La commission de cette commande ({order.commissionAmount.toLocaleString()} FCFA) a déjà été payée ou incluse dans un règlement partenaire enregistré dans « PAIEMENTS ».
                      </div>
                    </div>
                  ) : (order.orderStatus === 'Terminée' || order.orderStatus === 'Livrée') ? (
                    <div className="rounded-xl bg-amber-50 p-3 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Suppression interdite (Commission acquise) :</strong> Cette commande est « {order.orderStatus} » avec commission validée ({order.commissionAmount.toLocaleString()} FCFA). Une commande ayant un historique financier ne peut jamais disparaître simplement pour modifier le solde d'un partenaire.
                      </div>
                    </div>
                  ) : (order.orderStatus === 'Confirmée' && (order.commissionStatus === 'Validée' || order.commissionAmount > 0 && order.commissionStatus !== 'En attente')) ? (
                    <div className="rounded-xl bg-amber-50 p-3 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Suppression interdite :</strong> Cette commande confirmée possède une commission déjà validée ({order.commissionAmount.toLocaleString()} FCFA).
                      </div>
                    </div>
                  ) : showDeleteConfirm ? (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 space-y-2.5">
                      <div className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                        Confirmation de suppression définitive
                      </div>
                      <p className="text-xs text-red-700 leading-relaxed">
                        Êtes-vous sûr de vouloir supprimer définitivement la commande <strong>{order.id}</strong> ({order.productName}, {order.totalAmount.toLocaleString()} FCFA) ?
                        <br />
                        <span className="text-[11px] text-red-600 mt-1 block">
                          ⚠️ Le chiffre d'affaires, le nombre de commandes, les commissions et le solde du partenaire ainsi que les statistiques du client seront automatiquement recalculés.
                        </span>
                      </p>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(false)}
                          disabled={isDeleting}
                          className="flex-1 py-1.5 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              setIsDeleting(true);
                              await onDelete(order.id);
                              onClose();
                            } catch (err: any) {
                              setError(err.message || 'Erreur lors de la suppression de la commande');
                            } finally {
                              setIsDeleting(false);
                              setShowDeleteConfirm(false);
                            }
                          }}
                          disabled={isDeleting}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-red-600 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {isDeleting ? 'Suppression...' : 'Confirmer la suppression'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Supprimer cette commande
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-xl bg-amber-50/70 p-3 text-xs text-amber-900 border border-amber-200">
                <strong>Règle d'automatisation :</strong> Ne saisissez pas le partenaire, le grade, ni la commission. Le système détectera le partenaire du client, vérifiera le rang Premium, et appliquera la commission correspondante.
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Client *
                </label>
                <select
                  required
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-amber-500 outline-hidden bg-white"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} — {c.fullName} ({c.partnerCode ? `Partenaire: ${c.partnerCode}` : 'DIRECT AKF'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Produit *
                </label>
                <select
                  required
                  value={productId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-amber-500 outline-hidden bg-white"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.price.toLocaleString()} FCFA {p.isPremium ? '★ (PREMIUM)' : '(RÉCURRENT)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prix unitaire (Modifiable pour PREMIUM, Verrouillé pour RÉCURRENT) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Prix Unitaire (FCFA) *
                  </label>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                      selectedProduct?.isPremium
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {selectedProduct?.isPremium ? '✏️ Modifiable (Premium)' : '🔒 Fixe (Grille Commission)'}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  required
                  disabled={!selectedProduct?.isPremium}
                  value={effectiveUnitPrice}
                  onChange={(e) => {
                    if (selectedProduct?.isPremium) {
                      setUnitPrice(Math.max(0, parseInt(e.target.value) || 0));
                    }
                  }}
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm font-['JetBrains_Mono'] outline-hidden ${
                    selectedProduct?.isPremium
                      ? 'border-amber-300 bg-white text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                      : 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed'
                  }`}
                />
                <p className="mt-1 text-xs text-slate-500">
                  {selectedProduct?.isPremium
                    ? 'Règle AKF : Le prix par défaut provient de GRILLE_COMMISSION mais peut être ajusté pour cette vente.'
                    : 'Règle AKF : Produit Récurrent — Le prix est strictement fixé par la grille commission officielle.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Quantité *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setQuantity('');
                      } else {
                        const num = parseInt(val, 10);
                        setQuantity(isNaN(num) ? '' : num);
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-amber-500 outline-hidden font-['JetBrains_Mono']"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-amber-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Montant calculé :</span>
                  <span className="font-extrabold text-slate-900 text-sm font-['JetBrains_Mono']">
                    {calculatedTotal.toLocaleString()} FCFA
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Partenaire affilié :</span>
                  <span className="font-semibold text-slate-800">
                    {selectedClient?.partnerCode || 'DIRECT AKF (Aucune commission)'}
                  </span>
                </div>
                {selectedProduct && selectedClient?.partnerCode && (
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                    <span className="text-slate-500">Type de commission :</span>
                    <span className="font-semibold text-emerald-800">
                      {selectedProduct.isPremium
                        ? 'Pourcentage (%) — selon grade du partenaire (max 3 commandes)'
                        : `Forfaitaire (${(selectedProduct.commissionNeo || 1000).toLocaleString()} FCFA / unité en Neo)`}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {submitting ? 'Enregistrement...' : 'Valider la Commande'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment?: Payment | null;
  partners: Partner[];
  preselectedPartner?: Partner | null;
  config: SystemConfig;
  mode: 'view' | 'create';
  onSave?: (data: {
    partnerId: string;
    amount: number;
    date?: string;
    paymentMethod: any;
    reference?: string;
    note?: string;
  }) => Promise<void>;
  onNavigateTo?: (type: 'PARTNER', id: string) => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  payment,
  partners,
  preselectedPartner,
  config,
  mode,
  onSave,
  onNavigateTo,
}: PaymentModalProps) {
  const [partnerId, setPartnerId] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState('Mobile Money (MTN / Moov)');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (preselectedPartner) {
      setPartnerId(preselectedPartner.id);
    } else if (partners.length > 0 && !partnerId) {
      setPartnerId(partners[0].id);
    }
    setAmount('');
    setReference('');
    setNote('');
    setError(null);
  }, [isOpen, preselectedPartner, partners]);

  if (!isOpen) return null;

  const currentPartner = partners.find((p) => p.id === partnerId);
  const availableBalance = currentPartner?.balance || 0;
  const minPayment = config.minimumPayment || 5000;
  const numAmount = Number(amount) || 0;
  const isAmountExcessive = numAmount > availableBalance;
  const isAmountBelowMin = numAmount > 0 && numAmount < minPayment;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!partnerId) return setError('Le partenaire est obligatoire.');
    if (!amount || Number(amount) <= 0) return setError('Le montant doit être supérieur à zéro.');
    if (Number(amount) > availableBalance) {
      return setError(
        `Paiement impossible. Solde disponible insuffisant (${availableBalance.toLocaleString()} FCFA disponible).`
      );
    }
    if (Number(amount) < minPayment) {
      return setError(`Paiement impossible. Le minimum de paiement est de ${minPayment.toLocaleString()} FCFA.`);
    }

    try {
      setSubmitting(true);
      if (onSave) {
        await onSave({
          partnerId,
          amount: Number(amount),
          date,
          paymentMethod,
          reference: reference.trim() || undefined,
          note: note.trim() || undefined,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors du paiement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {mode === 'create' ? 'Émettre un Paiement' : `Paiement — ${payment?.id}`}
              </h2>
              <p className="text-xs text-slate-500">
                {mode === 'create' ? 'Vérification stricte du solde disponible' : payment?.partnerName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-800 border border-red-200">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {mode === 'view' && payment ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div>
                  <div className="text-xs font-semibold text-slate-400">Montant réglé</div>
                  <div className="text-2xl font-extrabold text-slate-900 font-['JetBrains_Mono']">
                    {payment.amount.toLocaleString()} FCFA
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    {payment.status}
                  </span>
                  <div className="text-xs text-slate-500 mt-1">{payment.date}</div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-3 text-sm">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Partenaire bénéficiaire :</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateTo?.('PARTNER', payment.partnerId);
                    }}
                    className="font-bold text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    {payment.partnerCode} — {payment.partnerName} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Mode de règlement :</span>
                  <span className="font-semibold text-slate-800">{payment.paymentMethod}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Référence transaction :</span>
                  <span className="font-mono text-xs font-bold text-slate-800">{payment.reference}</span>
                </div>

                {payment.note && (
                  <div className="pt-1">
                    <span className="text-xs text-slate-400 block mb-0.5">Note administrative :</span>
                    <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg">{payment.note}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Partenaire *
                </label>
                <select
                  required
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-purple-500 outline-hidden bg-white"
                >
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.fullName} (Solde : {p.balance.toLocaleString()} FCFA)
                    </option>
                  ))}
                </select>
              </div>

              {/* Partner Balance Indicator */}
              <div className="rounded-xl bg-purple-50/60 p-3.5 border border-purple-200/80 flex items-center justify-between">
                <div>
                  <span className="text-xs text-purple-900 font-medium">Solde disponible actuel</span>
                  <div className="text-lg font-bold text-purple-950 font-['JetBrains_Mono']">
                    {availableBalance.toLocaleString()} FCFA
                  </div>
                </div>
                <div className="text-right text-[11px] text-purple-700">
                  Minimum requis : <br />
                  <span className="font-bold">{minPayment.toLocaleString()} FCFA</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Montant à payer (FCFA) *
                </label>
                <input
                  type="number"
                  min="5000"
                  step="500"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="Ex : 25000"
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm font-['JetBrains_Mono'] focus:ring-2 outline-hidden ${
                    isAmountExcessive
                      ? 'border-red-500 text-red-900 bg-red-50 focus:ring-red-200'
                      : 'border-slate-200 text-slate-900 focus:border-purple-500 focus:ring-purple-200'
                  }`}
                />

                {isAmountExcessive && (
                  <p className="mt-1 text-xs text-red-600 font-medium">
                    ⚠️ Paiement impossible. Le montant dépasse le solde disponible ({availableBalance.toLocaleString()} FCFA).
                  </p>
                )}

                {isAmountBelowMin && (
                  <p className="mt-1 text-xs text-amber-600 font-medium">
                    ⚠️ Le montant est inférieur au seuil minimum configuré ({minPayment.toLocaleString()} FCFA).
                  </p>
                )}

                {availableBalance >= minPayment && (
                  <button
                    type="button"
                    onClick={() => setAmount(availableBalance)}
                    className="mt-1.5 text-xs text-purple-700 font-semibold hover:underline"
                  >
                    Régler la totalité du solde ({availableBalance.toLocaleString()} FCFA)
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-purple-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Mode
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-purple-500 outline-hidden bg-white"
                  >
                    <option value="Mobile Money (MTN / Moov)">Mobile Money (MTN / Moov)</option>
                    <option value="Virement Bancaire">Virement Bancaire</option>
                    <option value="Espèces">Espèces</option>
                    <option value="Chèque">Chèque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Référence de transaction
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ex : MTN-BJ-00921 ou VIR-BOA-884"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 font-mono focus:border-purple-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Note ou motif
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ex : Règlement commissions Vague 1"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-purple-500 outline-hidden"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting || isAmountExcessive || isAmountBelowMin || availableBalance <= 0}
                  className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {submitting ? 'Validation...' : 'Confirmer le Paiement'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
