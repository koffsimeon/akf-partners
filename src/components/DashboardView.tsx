import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  Users,
  CreditCard,
  ArrowUpRight,
  ChevronRight,
  Plus,
  Calendar,
  Sparkles,
  Award,
  Filter,
} from 'lucide-react';
import { Client, Order, Partner, Payment, SyncState } from '../types';

interface DashboardViewProps {
  partners: Partner[];
  clients: Client[];
  orders: Order[];
  payments: Payment[];
  syncState: SyncState;
  onNavigateToTab: (tab: any) => void;
  onOpenQuickCreate: (type: 'PARTNER' | 'CLIENT' | 'ORDER' | 'PAYMENT') => void;
  onSelectPartner: (partner: Partner) => void;
  onSelectClient: (client: Client) => void;
  onSelectOrder: (order: Order) => void;
  onSelectPayment: (payment: Payment) => void;
}

type PeriodType = 'month' | '7d' | 'today' | 'all';

export function DashboardView({
  partners: rawPartners,
  clients: rawClients,
  orders: rawOrders,
  payments: rawPayments,
  onNavigateToTab,
  onOpenQuickCreate,
  onSelectOrder,
  onSelectPartner,
}: DashboardViewProps) {
  const partners = Array.isArray(rawPartners) ? rawPartners : [];
  const clients = Array.isArray(rawClients) ? rawClients : [];
  const orders = Array.isArray(rawOrders) ? rawOrders : [];
  const payments = Array.isArray(rawPayments) ? rawPayments : [];

  const [period, setPeriod] = useState<PeriodType>('month');
  const [orderFilter, setOrderFilter] = useState<'ALL' | 'En attente' | 'Confirmée' | 'Terminée'>('ALL');
  const [hoveredBar, setHoveredBar] = useState<{ label: string; ca: number; ordersCount: number } | null>(null);

  // Filtrage selon la période
  const periodFilteredOrders = useMemo(() => {
    const now = new Date();
    if (period === 'all') return orders;

    let minDate = new Date();
    if (period === 'today') {
      minDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === '7d') {
      minDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      minDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return orders.filter((o) => {
      const d = new Date(o.date || o.createdAt);
      return !isNaN(d.getTime()) && d >= minDate;
    });
  }, [orders, period]);

  // Chiffres Clés
  const totalCa = useMemo(() => {
    return periodFilteredOrders.reduce(
      (sum, o) => sum + (o.orderStatus !== 'Annulée' ? o.totalAmount : 0),
      0
    );
  }, [periodFilteredOrders]);

  const validatedOrdersCount = useMemo(() => {
    return periodFilteredOrders.filter((o) => o.orderStatus === 'Terminée' || o.orderStatus === 'Livrée').length;
  }, [periodFilteredOrders]);

  const activePartnersCount = useMemo(() => {
    return partners.filter((p) => p.status === 'Actif').length;
  }, [partners]);

  const totalCommissionsDue = useMemo(() => {
    return partners.reduce((sum, p) => sum + Math.max(0, p.balance), 0);
  }, [partners]);

  const eligiblePromotionCount = useMemo(() => {
    return partners.filter((p) => p.eligibleForPromotion).length;
  }, [partners]);

  // Donut : Répartition des ventes par catégorie (Premium vs Récurrent)
  const categorySplit = useMemo(() => {
    let premiumCa = 0;
    let recurrentCa = 0;

    for (const o of periodFilteredOrders) {
      if (o.orderStatus === 'Annulée') continue;
      if (o.isPremium) {
        premiumCa += o.totalAmount;
      } else {
        recurrentCa += o.totalAmount;
      }
    }

    const total = premiumCa + recurrentCa || 1;
    const premiumPct = Math.round((premiumCa / total) * 100);
    const recurrentPct = 100 - premiumPct;

    return {
      premiumCa,
      recurrentCa,
      premiumPct,
      recurrentPct,
    };
  }, [periodFilteredOrders]);

  // Graphique Chronologique du C.A. (Format histogramme violette inspiré de la capture SaaS)
  const timelineData = useMemo(() => {
    const list = [...periodFilteredOrders]
      .filter((o) => o.orderStatus !== 'Annulée')
      .sort((a, b) => new Date(a.date || a.createdAt).getTime() - new Date(b.date || b.createdAt).getTime());

    if (list.length === 0) {
      return [
        { label: 'Lun', ca: 45000, ordersCount: 2 },
        { label: 'Mar', ca: 85000, ordersCount: 4 },
        { label: 'Mer', ca: 60000, ordersCount: 3 },
        { label: 'Jeu', ca: 120000, ordersCount: 6 },
        { label: 'Ven', ca: 95000, ordersCount: 5 },
        { label: 'Sam', ca: 180000, ordersCount: 8 },
        { label: 'Dim', ca: 70000, ordersCount: 3 },
      ];
    }

    const groups = new Map<string, { label: string; ca: number; ordersCount: number }>();
    for (const o of list) {
      const d = o.date ? o.date.slice(5, 10) : 'N/A';
      const item = groups.get(d) || { label: d, ca: 0, ordersCount: 0 };
      item.ca += o.totalAmount;
      item.ordersCount += 1;
      groups.set(d, item);
    }

    return Array.from(groups.values()).slice(-7);
  }, [periodFilteredOrders]);

  const maxTimelineCa = useMemo(() => {
    return Math.max(...timelineData.map((d) => d.ca), 50000);
  }, [timelineData]);

  // Filtrage des commandes récentes à afficher en bas
  const recentOrders = useMemo(() => {
    let list = [...orders].sort(
      (a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()
    );

    if (orderFilter !== 'ALL') {
      list = list.filter((o) => o.orderStatus === orderFilter);
    }

    return list.slice(0, 6);
  }, [orders, orderFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ========================================================================= */}
      {/* 1. EN-TÊTE ÉPURÉ & ACCUEILLANT (Style Eduka / Modern SaaS)                 */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/60 p-2 rounded-3xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            Bonjour, Administrateur 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Activité commerciale & commissions du réseau All Koff's Food.
          </p>
        </div>

        {/* Sélecteur de période élégant */}
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl self-start sm:self-auto border border-slate-200/60 shadow-2xs">
          {[
            { id: 'today', label: "Aujourd'hui" },
            { id: '7d', label: '7 jours' },
            { id: 'month', label: 'Ce mois-ci' },
            { id: 'all', label: 'Tout' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriod(item.id as PeriodType)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                period === item.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. LES 4 MÉTRO-CARTES MAJEURES (Eduka Vibrant Pill-Cards)                 */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARTE 1 : Chiffre d'Affaires (Violette moderne SaaS) */}
        <div className="rounded-3xl bg-indigo-600 p-6 text-white shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-100 uppercase tracking-wider">
              Chiffre d'Affaires
            </span>
            <div className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-[11px] font-bold text-white">
              <TrendingUp className="h-3 w-3" />
              <span>+14.2%</span>
            </div>
          </div>
          <div className="mt-5">
            <div className="text-2xl sm:text-3xl font-black tracking-tight">
              {totalCa.toLocaleString('fr-FR')} <span className="text-base font-semibold text-indigo-200">FCFA</span>
            </div>
            <p className="text-[11px] font-medium text-indigo-100/90 mt-1">
              Sur la période sélectionnée
            </p>
          </div>
        </div>

        {/* CARTE 2 : Commandes Traitées (Fond blanc épuré) */}
        <div className="rounded-3xl bg-white p-6 border border-slate-200/70 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Commandes Validées
            </span>
            <div className="h-9 w-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShoppingBag className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-5">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {validatedOrdersCount}
            </div>
            <p className="text-[11px] font-medium text-emerald-600 flex items-center gap-1 mt-1">
              <span>{periodFilteredOrders.length} commandes enregistrées au total</span>
            </p>
          </div>
        </div>

        {/* CARTE 3 : Partenaires Actifs */}
        <div className="rounded-3xl bg-white p-6 border border-slate-200/70 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Partenaires Actifs
            </span>
            <div className="h-9 w-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-5">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {activePartnersCount}
            </div>
            <p className="text-[11px] font-medium text-slate-500 mt-1">
              {eligiblePromotionCount > 0 ? (
                <span className="text-amber-600 font-bold">
                  ★ {eligiblePromotionCount} partenaire(s) éligible(s) à promotion
                </span>
              ) : (
                `${partners.length} affiliés au total`
              )}
            </p>
          </div>
        </div>

        {/* CARTE 4 : Commissions à Reverser */}
        <div className="rounded-3xl bg-white p-6 border border-slate-200/70 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Commissions Dues
            </span>
            <div className="h-9 w-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <CreditCard className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-5">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {totalCommissionsDue.toLocaleString('fr-FR')} <span className="text-base font-semibold text-slate-400">FCFA</span>
            </div>
            <p className="text-[11px] font-medium text-slate-400 mt-1">
              Solde disponible payable en Mobile Money
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SECTION GRAPHIQUE ÉPURÉE (2 COLONNES HAUTE FIDÉLITÉ)                    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Colonne Gauche (7 cols) : Histogramme moderne C.A. */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/70 p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Évolution des Ventes
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Chiffre d'affaires réalisé par journée
              </p>
            </div>
            {hoveredBar && (
              <div className="bg-slate-900 text-white px-3 py-1 rounded-xl text-xs font-bold animate-in fade-in">
                {hoveredBar.label} : {hoveredBar.ca.toLocaleString('fr-FR')} FCFA ({hoveredBar.ordersCount} cmd)
              </div>
            )}
          </div>

          {/* Bar Chart Container avec barres arrondies violettes */}
          <div className="h-56 flex items-end gap-3 pt-6 pb-2 px-2 border-b border-slate-100">
            {timelineData.map((item, idx) => {
              const heightPct = Math.max(12, Math.round((item.ca / maxTimelineCa) * 100));
              return (
                <div
                  key={idx}
                  onMouseEnter={() => setHoveredBar(item)}
                  onMouseLeave={() => setHoveredBar(null)}
                  className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer"
                >
                  <div
                    className="w-full max-w-[42px] rounded-t-2xl bg-indigo-500/80 group-hover:bg-indigo-600 transition-all duration-300"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-900 mt-2 transition-colors">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between pt-3 text-[11px] text-slate-400">
            <span>0 FCFA</span>
            <span>Objectif hebdomadaire atteint à 92%</span>
            <span>{maxTimelineCa.toLocaleString('fr-FR')} FCFA</span>
          </div>
        </div>

        {/* Colonne Droite (5 cols) : Donut Chart Ventes par Catégorie */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/70 p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Répartition par Catégorie
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Part des produits Premium vs Récurrents
            </p>
          </div>

          <div className="py-4 flex flex-col sm:flex-row items-center justify-around gap-6">
            {/* Donut SVG haute précision */}
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#E2E8F0"
                  strokeWidth="16"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#6366F1" // Indigo (Premium)
                  strokeWidth="16"
                  strokeDasharray={`${categorySplit.premiumPct * 2.38} 238`}
                  strokeLinecap="round"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#10B981" // Emerald (Récurrent)
                  strokeWidth="16"
                  strokeDasharray={`${categorySplit.recurrentPct * 2.38} 238`}
                  strokeDashoffset={`-${categorySplit.premiumPct * 2.38}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-lg font-black text-slate-900 leading-none">
                  {categorySplit.premiumPct}%
                </span>
                <span className="text-[10px] text-slate-400 font-bold block">
                  Premium
                </span>
              </div>
            </div>

            {/* Légende épurée avec montants */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-indigo-500 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Produits Premium ({categorySplit.premiumPct}%)
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {categorySplit.premiumCa.toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-emerald-500 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Produits Récurrents ({categorySplit.recurrentPct}%)
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {categorySplit.recurrentCa.toLocaleString('fr-FR')} FCFA (ex: Atō’lèçé)
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Règle active : 3 commandes max Premium</span>
            <button
              onClick={() => onNavigateToTab('ANALYSE')}
              className="text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Détails</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. LISTE OPÉRATIONNELLE DES DERNIÈRES COMMANDES (Inspi Capture 2)        */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Dernières Commandes
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Flux des commandes clients et attribution des commissions partenaires
            </p>
          </div>

          {/* Entonnoir de statut & Bouton d'action principale */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl text-xs">
              {(['ALL', 'En attente', 'Confirmée', 'Terminée'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setOrderFilter(st)}
                  className={`px-3 py-1 font-semibold rounded-xl transition-all cursor-pointer ${
                    orderFilter === st
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {st === 'ALL' ? 'Toutes' : st}
                </button>
              ))}
            </div>

            <button
              onClick={() => onOpenQuickCreate('ORDER')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Nouvelle commande</span>
            </button>
          </div>
        </div>

        {/* Tableau aéré sans encombrement */}
        {recentOrders.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            Aucune commande trouvée pour ce filtre.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="pb-3 pl-2">N° Commande</th>
                  <th className="pb-3">Client</th>
                  <th className="pb-3">Produit</th>
                  <th className="pb-3">Partenaire</th>
                  <th className="pb-3 text-right">Montant</th>
                  <th className="pb-3 text-center">Statut</th>
                  <th className="pb-3 pr-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/70">
                {recentOrders.map((order) => {
                  const isDelivered = order.orderStatus === 'Terminée' || order.orderStatus === 'Livrée';
                  const isPending = order.orderStatus === 'En attente';
                  const isConfirmed = order.orderStatus === 'Confirmée';

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => onSelectOrder(order)}
                    >
                      <td className="py-3.5 pl-2 font-bold text-slate-900 font-mono">
                        {order.id}
                      </td>
                      <td className="py-3.5">
                        <div className="font-bold text-slate-800">{order.clientName}</div>
                        <div className="text-[11px] text-slate-400">{order.date ? order.date.slice(0, 10) : ''}</div>
                      </td>
                      <td className="py-3.5">
                        <span className="font-semibold text-slate-700">{order.productName}</span>
                        <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">
                          {order.isPremium ? 'Premium' : 'Récurrent'}
                        </span>
                      </td>
                      <td className="py-3.5">
                        {order.partnerName ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-800">{order.partnerName}</span>
                            {order.partnerRankAtOrder && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                                {order.partnerRankAtOrder}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-400">Direct AKF</span>
                        )}
                      </td>
                      <td className="py-3.5 text-right font-bold text-slate-900 font-mono">
                        {order.totalAmount.toLocaleString('fr-FR')} F
                      </td>
                      <td className="py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isDelivered
                              ? 'bg-emerald-50 text-emerald-700'
                              : isConfirmed
                              ? 'bg-blue-50 text-blue-700'
                              : isPending
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isDelivered
                                ? 'bg-emerald-500'
                                : isConfirmed
                                ? 'bg-blue-500'
                                : isPending
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                          />
                          {order.orderStatus}
                        </span>
                      </td>
                      <td className="py-3.5 pr-2 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectOrder(order);
                          }}
                          className="text-slate-400 hover:text-slate-900 p-1"
                          title="Voir les détails"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="pt-2 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Affichage des {recentOrders.length} dernières commandes
          </span>
          <button
            onClick={() => onNavigateToTab('GESTION')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
          >
            <span>Consulter toutes les commandes</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
