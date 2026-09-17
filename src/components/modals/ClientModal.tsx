import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  ShoppingBag,
  Phone,
  MessageSquare,
  AlertCircle,
  ArrowRight,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Client, Partner } from '../../types';

export interface ClientModalProps {
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
                      <span className="text-slate-400 font-medium">Adresse :</span> {[client.address, client.city].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {client.notes && (
                    <div className="mt-2 text-xs text-slate-600 bg-white p-2 rounded border border-slate-200">
                      <span className="text-slate-400 font-medium">Notes :</span> {client.notes}
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
                        <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 space-y-2.5">
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
