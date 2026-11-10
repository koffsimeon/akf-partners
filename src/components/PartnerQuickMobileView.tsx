import React, { useState, useMemo } from 'react';
import {
  Search,
  Phone,
  MessageSquare,
  CreditCard,
  Award,
  Copy,
  Check,
  User,
  ShoppingBag,
  Sparkles,
  Wallet,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { Partner, Order, Payment, Client, SystemConfig } from '../types';
import { getRankProgression } from '../engine/akfEngine';

interface PartnerQuickMobileViewProps {
  partners: Partner[];
  orders: Order[];
  payments: Payment[];
  clients: Client[];
  config: SystemConfig;
  onInitiatePayment: (partner: Partner) => void;
  onSelectPartnerFull: (partner: Partner) => void;
  onSelectOrder?: (order: Order) => void;
  onOpenCreatePartner?: () => void;
}

export function PartnerQuickMobileView({
  partners,
  orders,
  payments,
  clients,
  config,
  onInitiatePayment,
  onSelectPartnerFull,
  onSelectOrder,
  onOpenCreatePartner,
}: PartnerQuickMobileViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(
    partners[0]?.id || ''
  );
  const [copiedCode, setCopiedCode] = useState(false);

  // Recherche rapide insensible à la casse
  const filteredPartners = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return partners.slice(0, 15);
    return partners.filter((p) => {
      const codeMatch = p.code?.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q);
      const nameMatch = p.fullName?.toLowerCase().includes(q);
      const phoneMatch = p.phone?.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''));
      return codeMatch || nameMatch || phoneMatch;
    });
  }, [partners, searchQuery]);

  const activePartner = useMemo(() => {
    return partners.find((p) => p.id === selectedPartnerId) || partners[0] || null;
  }, [partners, selectedPartnerId]);

  // Commandes et paiements liés
  const partnerOrders = useMemo(() => {
    if (!activePartner) return [];
    return orders
      .filter((o) => o.partnerId === activePartner.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, activePartner]);

  const partnerPayments = useMemo(() => {
    if (!activePartner) return [];
    return payments
      .filter((p) => p.partnerId === activePartner.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments, activePartner]);

  // Clients parrainés
  const partnerClientsCount = useMemo(() => {
    if (!activePartner) return 0;
    return clients.filter((c) => c.partnerId === activePartner.id).length;
  }, [clients, activePartner]);

  // Calcul dynamique de progression de grade
  const progression = useMemo(() => {
    if (!activePartner) return null;
    return getRankProgression(
      activePartner.ca || 0,
      activePartner.orderCount || 0,
      activePartner.rank,
      config
    );
  }, [activePartner, config]);

  const handleCopyCode = () => {
    if (!activePartner) return;
    navigator.clipboard.writeText(activePartner.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getRankBadgeStyle = (rank: string) => {
    switch (rank) {
      case 'Signature':
        return 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black shadow-xs';
      case 'Excellence':
        return 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold shadow-xs';
      case 'Ambassador':
        return 'bg-gradient-to-r from-blue-600 to-indigo-500 text-white font-bold shadow-xs';
      default:
        return 'bg-slate-200 text-slate-800 font-bold';
    }
  };

  const getOrderStatusStyle = (status: string) => {
    switch (status) {
      case 'Terminée':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Livrée':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Confirmée':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'En attente':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-rose-100 text-rose-800 border-rose-200';
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* En-tête Express */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-white shadow-lg border border-slate-700/60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-white">
                Fiche Express Partenaire
              </h2>
              <p className="text-[11px] text-slate-300">
                Consultation de terrain & actions rapides
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
            {partners.length} Partenaires
          </span>
        </div>

        {/* Barre de Recherche Instantanée */}
        <div className="relative mt-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par code (AKF001, AKF-TOS), nom, téléphone..."
            className="w-full rounded-2xl bg-slate-800/90 pl-10 pr-4 py-3 text-xs text-white placeholder-slate-400 border border-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-1.5 py-0.5 rounded-md bg-slate-700"
            >
              Effacer
            </button>
          )}
        </div>

        {/* Liste défilante des résultats rapides */}
        {searchQuery.trim().length > 0 && (
          <div className="mt-2.5 max-h-48 overflow-y-auto space-y-1 rounded-xl bg-slate-800/95 p-1.5 border border-slate-700 shadow-xl">
            {filteredPartners.length === 0 ? (
              <p className="text-center py-3 text-xs text-slate-400">
                Aucun partenaire ne correspond à « {searchQuery} »
              </p>
            ) : (
              filteredPartners.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedPartnerId(p.id);
                    setSearchQuery('');
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                    activePartner?.id === p.id
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-extrabold bg-slate-900/60 px-1.5 py-0.5 rounded">
                      {p.code}
                    </span>
                    <span className="truncate max-w-[150px]">{p.fullName}</span>
                  </div>
                  <span className="text-[10px] opacity-80">{p.phone}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Partenaire Actif - Fiche Complète */}
      {activePartner ? (
        <div className="space-y-4">
          {/* Carte Principale du Partenaire */}
          <div className="rounded-3xl bg-white p-5 shadow-xs border border-slate-200/80 space-y-4">
            {/* Header Profil */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-black bg-slate-100 text-slate-800 px-2.5 py-1 rounded-xl border border-slate-200">
                    {activePartner.code}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    ({activePartner.id})
                  </span>
                  <span
                    className={`text-[11px] px-2.5 py-0.5 rounded-full ${getRankBadgeStyle(
                      activePartner.rank
                    )}`}
                  >
                    Grade {activePartner.rank}
                  </span>
                </div>
                <h1 className="text-base font-extrabold text-slate-900 mt-2">
                  {activePartner.fullName}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  {activePartner.phone}
                </p>
              </div>

              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-[11px] font-bold transition-colors cursor-pointer shrink-0"
                title="Copier le code partenaire"
              >
                {copiedCode ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copier code</span>
                  </>
                )}
              </button>
            </div>

            {/* Gros Solde Net & Statut Paiement */}
            <div className="rounded-2xl bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/50 p-4 border border-indigo-100/80 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Solde de Commission Dû</span>
                </div>
                <div className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                  {activePartner.balance.toLocaleString('fr-FR')}{' '}
                  <span className="text-xs font-bold text-slate-500">FCFA</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Gagnées : {activePartner.totalCommission.toLocaleString('fr-FR')} F • Déjà réglées :{' '}
                  {activePartner.paidCommission.toLocaleString('fr-FR')} F
                </div>
              </div>

              {activePartner.balance >= 5000 ? (
                <button
                  onClick={() => onInitiatePayment(activePartner)}
                  className="px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Payer</span>
                </button>
              ) : (
                <div className="text-right">
                  <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-500">
                    Seuil min. 5 000 F
                  </span>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Reste {(5000 - activePartner.balance).toLocaleString('fr-FR')} F
                  </div>
                </div>
              )}
            </div>

            {/* Barre de Progression de Grade */}
            {progression && (
              <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <Award className="h-4 w-4 text-indigo-600" />
                    <span>
                      {!progression.nextRank
                        ? 'Grade Sommet Atteint'
                        : `Objectif : Grade ${progression.nextRank}`}
                    </span>
                  </div>
                  <span className="font-extrabold text-indigo-600">
                    {progression.progressPct}%
                  </span>
                </div>

                <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500"
                    style={{ width: `${progression.progressPct}%` }}
                  />
                </div>

                {progression.nextRank && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Commandes : <strong className="text-slate-800">{activePartner.orderCount || 0}</strong> /{' '}
                      {progression.targetCmd}
                    </span>
                    <span>
                      C.A. :{' '}
                      <strong className="text-slate-800">
                        {(activePartner.ca || 0).toLocaleString('fr-FR')}
                      </strong>{' '}
                      / {progression.targetCa.toLocaleString('fr-FR')} F
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Actions Rapides Tactiles (48px de hauteur minimum pour ergonomie mobile) */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {/* Appel direct */}
              <a
                href={`tel:${activePartner.phone}`}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors text-center cursor-pointer min-h-[52px]"
              >
                <Phone className="h-4 w-4 text-emerald-600 mb-1" />
                <span className="text-[11px] font-bold">Appeler</span>
              </a>

              {/* Message WhatsApp */}
              <a
                href={`https://wa.me/${activePartner.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  `Bonjour ${activePartner.fullName}, All Koff's Food vous informe : votre solde de commission est actuellement de ${activePartner.balance.toLocaleString('fr-FR')} FCFA. Merci pour votre engagement !`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/70 transition-colors text-center cursor-pointer min-h-[52px]"
              >
                <MessageSquare className="h-4 w-4 text-emerald-600 mb-1" />
                <span className="text-[11px] font-bold">WhatsApp</span>
              </a>

              {/* Fiche Détail */}
              <button
                onClick={() => onSelectPartnerFull(activePartner)}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200/70 transition-colors text-center cursor-pointer min-h-[52px]"
              >
                <User className="h-4 w-4 text-indigo-600 mb-1" />
                <span className="text-[11px] font-bold">Détails</span>
              </button>
            </div>
          </div>

          {/* Performance Résumée (Chiffres Clés) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Commandes Apportées
              </span>
              <div className="text-xl font-black text-slate-900 mt-1">
                {activePartner.orderCount || 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Sur {partnerOrders.length} enregistrées
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Chiffre d’Affaires
              </span>
              <div className="text-xl font-black text-slate-900 mt-1">
                {(activePartner.ca || 0).toLocaleString('fr-FR')}{' '}
                <span className="text-[10px] text-slate-400">F</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {partnerClientsCount} client(s) affilié(s)
              </p>
            </div>
          </div>

          {/* Dernières Commandes du Partenaire */}
          <div className="rounded-3xl bg-white p-4 border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-slate-600" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Dernières Commandes ({partnerOrders.length})
                </h3>
              </div>
            </div>

            {partnerOrders.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                Aucune commande enregistrée pour ce partenaire.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {partnerOrders.slice(0, 5).map((order) => (
                  <div
                    key={order.id}
                    onClick={() => onSelectOrder?.(order)}
                    className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 rounded-xl px-2 transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-800">{order.id}</span>
                        <span className="text-slate-400 text-[10px]">{order.date}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 truncate max-w-[200px]">
                        {order.productName || 'Produit'} (x{order.quantity})
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getOrderStatusStyle(
                          order.orderStatus
                        )}`}
                      >
                        {order.orderStatus}
                      </span>
                      <div className="text-[11px] font-black text-slate-900 mt-0.5">
                        {order.totalAmount.toLocaleString('fr-FR')} F
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historique des Derniers Paiements */}
          <div className="rounded-3xl bg-white p-4 border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-purple-600" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Règlements Reçus ({partnerPayments.length})
                </h3>
              </div>
            </div>

            {partnerPayments.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                Aucun versement de commission effectué pour l'instant.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {partnerPayments.slice(0, 4).map((pay) => (
                  <div key={pay.id} className="py-2 flex items-center justify-between text-xs px-2">
                    <div>
                      <div className="font-mono font-bold text-slate-800">{pay.id}</div>
                      <div className="text-[10px] text-slate-400">{pay.date} • {pay.paymentMethod}</div>
                    </div>
                    <div className="font-black text-emerald-700">
                      +{pay.amount.toLocaleString('fr-FR')} FCFA
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl bg-white p-8 text-center border border-slate-200 space-y-3">
          <AlertCircle className="h-8 w-8 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">Aucun partenaire disponible</h3>
          <p className="text-xs text-slate-500">
            Créez votre premier partenaire pour démarrer le suivi d'activité.
          </p>
          {onOpenCreatePartner && (
            <button
              onClick={onOpenCreatePartner}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Nouveau Partenaire</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
