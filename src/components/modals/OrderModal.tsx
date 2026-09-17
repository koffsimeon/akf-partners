import React, { useState, useEffect } from 'react';
import {
  X,
  ShoppingBag,
  AlertCircle,
  Check,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { Client, Order, Product, SystemConfig } from '../../types';

export interface OrderModalProps {
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
                          Le chiffre d'affaires, le nombre de commandes, les commissions et le solde du partenaire ainsi que les statistiques du client seront automatiquement recalculés.
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
                      {p.name} — {p.price.toLocaleString()} FCFA {p.isPremium ? '(PREMIUM)' : '(RÉCURRENT)'}
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
                    {selectedProduct?.isPremium ? 'Modifiable (Premium)' : 'Fixe (Grille Commission)'}
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
