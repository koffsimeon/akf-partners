import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { Partner, Payment, SystemConfig } from '../../types';

export interface PaymentModalProps {
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
                    Paiement impossible. Le montant dépasse le solde disponible ({availableBalance.toLocaleString()} FCFA disponible).
                  </p>
                )}

                {isAmountBelowMin && (
                  <p className="mt-1 text-xs text-amber-600 font-medium">
                    Le montant est inférieur au seuil minimum configuré ({minPayment.toLocaleString()} FCFA).
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
