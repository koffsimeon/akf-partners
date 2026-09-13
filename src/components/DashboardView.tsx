import React, { useState, useMemo } from 'react';
import {
  Users,
  UserCheck,
  ShoppingBag,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  Clock,
  Award,
  ArrowUpRight,
  ChevronRight,
  Plus,
  CheckCircle2,
  Calendar,
  Sparkles,
  BarChart3,
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

type PeriodType = 'all' | 'today' | '7d' | '30d' | '3m' | 'year' | 'custom';

export function DashboardView({
  partners: rawPartners,
  clients: rawClients,
  orders: rawOrders,
  payments: rawPayments,
  syncState,
  onNavigateToTab,
  onOpenQuickCreate,
  onSelectPartner,
  onSelectClient,
  onSelectOrder,
  onSelectPayment,
}: DashboardViewProps) {
  const partners = Array.isArray(rawPartners) ? rawPartners : [];
  const clients = Array.isArray(rawClients) ? rawClients : [];
  const orders = Array.isArray(rawOrders) ? rawOrders : [];
  const payments = Array.isArray(rawPayments) ? rawPayments : [];

  const [period, setPeriod] = useState<PeriodType>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [hoveredPoint, setHoveredPoint] = useState<{ label: string; ca: number; comm: number } | null>(null);

  // Déterminer la date de début selon la période
  const periodRange = useMemo(() => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (period === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === '30d') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (period === '3m') {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    } else if (period === 'custom') {
      if (customStart) startDate = new Date(`${customStart}T00:00:00.000Z`);
      if (customEnd) endDate = new Date(`${customEnd}T23:59:59.999Z`);
    }

    return { startDate, endDate };
  }, [period, customStart, customEnd]);

  // Filtrer les éléments par période
  const isDateInPeriod = (dateStr?: string) => {
    if (period === 'all') return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    if (periodRange.startDate && d < periodRange.startDate) return false;
    if (periodRange.endDate && d > periodRange.endDate) return false;
    return true;
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => isDateInPeriod(o.date || o.createdAt));
  }, [orders, period, periodRange]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => isDateInPeriod(p.date || p.createdAt));
  }, [payments, period, periodRange]);

  const newPartnersInPeriod = useMemo(() => {
    return partners.filter((p) => isDateInPeriod(p.createdAt));
  }, [partners, period, periodRange]);

  const newClientsInPeriod = useMemo(() => {
    return clients.filter((c) => isDateInPeriod(c.createdAt));
  }, [clients, period, periodRange]);

  // Calculs financiers de la période
  const totalCa = useMemo(
    () => filteredOrders.reduce((sum, o) => sum + (o.orderStatus !== 'Annulée' ? o.totalAmount : 0), 0),
    [filteredOrders]
  );
  const totalCommission = useMemo(
    () => filteredOrders.reduce((sum, o) => sum + (o.commissionAmount || 0), 0),
    [filteredOrders]
  );
  const totalPaid = useMemo(
    () => filteredPayments.reduce((sum, p) => sum + (p.status === 'Effectué' ? p.amount : 0), 0),
    [filteredPayments]
  );
  // Le solde global actuel reste calculé sur les partenaires
  const totalToPay = useMemo(
    () => partners.reduce((sum, p) => sum + Math.max(0, p.balance), 0),
    [partners]
  );

  // Top Partenaires (calculé par CA généré dans la période ou total si 'all')
  const topPartners = useMemo(() => {
    if (period === 'all') {
      return [...partners].sort((a, b) => b.ca - a.ca).slice(0, 5);
    }
    // Calculer le CA sur les commandes filtrées pour chaque partenaire
    const caMap = new Map<string, number>();
    for (const o of filteredOrders) {
      if (o.partnerId && o.orderStatus !== 'Annulée') {
        caMap.set(o.partnerId, (caMap.get(o.partnerId) || 0) + o.totalAmount);
      }
    }
    return [...partners]
      .map((p) => ({
        ...p,
        periodCa: caMap.get(p.id) || 0,
      }))
      .sort((a, b) => (b.periodCa !== a.periodCa ? b.periodCa - a.periodCa : b.ca - a.ca))
      .slice(0, 5);
  }, [partners, filteredOrders, period]);

  // Agrégation du graphique CA par chronologie
  const chartData = useMemo(() => {
    const validOrders = filteredOrders
      .filter((o) => o.orderStatus !== 'Annulée')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (validOrders.length === 0) return [];

    const map = new Map<string, { label: string; ca: number; comm: number }>();

    for (const o of validOrders) {
      const d = o.date ? o.date.slice(5) : 'N/A'; // MM-DD
      const existing = map.get(d) || { label: d, ca: 0, comm: 0 };
      existing.ca += o.totalAmount;
      existing.comm += o.commissionAmount || 0;
      map.set(d, existing);
    }

    return Array.from(map.values());
  }, [filteredOrders]);

  const maxChartCa = useMemo(() => {
    return Math.max(...chartData.map((d) => d.ca), 100000);
  }, [chartData]);

  // Éléments à surveiller
  const inactivePartners = partners.filter((p) => p.status === 'Inactif');
  const partnersCloseToUpgrade = partners.filter((p) => p.nextRank && p.progressPct >= 75);
  const pendingOrders = orders.filter((o) => (o.orderStatus === 'En attente' || o.orderStatus === 'Confirmée') && o.partnerId);
  const eligiblePayments = partners.filter((p) => p.balance >= 5000);
  const negativeBalancePartners = partners.filter((p) => p.balance < 0);

  const kpis = [
    {
      id: 'partenaires',
      label: 'Partenaires',
      value: period === 'all' ? partners.length : newPartnersInPeriod.length,
      subtext:
        period === 'all'
          ? `${partners.filter((p) => p.status === 'Actif').length} actifs (${partners.length} total)`
          : `${newPartnersInPeriod.length} inscrit(s) sur la période`,
      icon: Users,
      color: 'emerald',
      action: () => onNavigateToTab('GESTION'),
    },
    {
      id: 'clients',
      label: 'Clients',
      value: period === 'all' ? clients.length : newClientsInPeriod.length,
      subtext:
        period === 'all'
          ? `${clients.filter((c) => c.clientType === 'PARTENAIRE').length} affiliés (${clients.length} total)`
          : `${newClientsInPeriod.length} créé(s) sur la période`,
      icon: UserCheck,
      color: 'blue',
      action: () => onNavigateToTab('GESTION'),
    },
    {
      id: 'commandes',
      label: 'Commandes',
      value: filteredOrders.length,
      subtext: `${filteredOrders.filter((o) => o.isPremium).length} Premium`,
      icon: ShoppingBag,
      color: 'amber',
      action: () => onNavigateToTab('GESTION'),
    },
    {
      id: 'ca',
      label: 'Chiffre d’Affaires',
      value: `${totalCa.toLocaleString()} F`,
      subtext: period === 'all' ? 'Volume total généré' : 'CA de la période',
      icon: TrendingUp,
      color: 'slate',
      action: () => onNavigateToTab('ANALYSE'),
    },
    {
      id: 'commissions',
      label: 'Commissions',
      value: `${totalCommission.toLocaleString()} F`,
      subtext: `${totalPaid.toLocaleString()} F payés sur la période`,
      icon: Award,
      color: 'purple',
      action: () => onNavigateToTab('ANALYSE'),
    },
    {
      id: 'a_payer',
      label: 'À payer (Actif)',
      value: `${totalToPay.toLocaleString()} F`,
      subtext: `${eligiblePayments.length} partenaire(s) éligible(s)`,
      icon: CreditCard,
      color: totalToPay > 0 ? 'rose' : 'emerald',
      action: () => onNavigateToTab('GESTION'),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Welcome & Period Filter */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Cockpit de Pilotage
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Vue d'ensemble en temps réel du programme AKF Partners
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-2xs">
            {[
              { id: 'all', label: 'Tout' },
              { id: 'today', label: 'Aujourd’hui' },
              { id: '7d', label: '7 jours' },
              { id: '30d', label: '30 jours' },
              { id: '3m', label: '3 mois' },
              { id: 'year', label: 'Année' },
              { id: 'custom', label: 'Personnalisé' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setPeriod(item.id as PeriodType)}
                className={`rounded-lg px-2.5 py-1.5 font-medium whitespace-nowrap transition-colors ${
                  period === item.id
                    ? 'bg-slate-900 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range Inputs */}
          {period === 'custom' && (
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs shadow-2xs">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="text-xs text-slate-700 bg-transparent outline-hidden font-['JetBrains_Mono']"
                title="Date de début"
              />
              <span className="text-slate-300">→</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="text-xs text-slate-700 bg-transparent outline-hidden font-['JetBrains_Mono']"
                title="Date de fin"
              />
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-3 text-white shadow-sm">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2 hidden sm:inline">
          Actions rapides :
        </span>
        <button
          onClick={() => onOpenQuickCreate('PARTNER')}
          className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5 text-emerald-400" />
          + Partenaire
        </button>
        <button
          onClick={() => onOpenQuickCreate('CLIENT')}
          className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5 text-blue-400" />
          + Client
        </button>
        <button
          onClick={() => onOpenQuickCreate('ORDER')}
          className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5 text-amber-400" />
          + Commande
        </button>
        <button
          onClick={() => onOpenQuickCreate('PAYMENT')}
          className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5 text-purple-400" />
          + Paiement
        </button>
      </div>

      {/* 6 Clickable KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.id}
              onClick={kpi.action}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-2xs hover:border-slate-300 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {kpi.label}
                </span>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
                    kpi.color === 'emerald'
                      ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'
                      : kpi.color === 'blue'
                      ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
                      : kpi.color === 'amber'
                      ? 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white'
                      : kpi.color === 'purple'
                      ? 'bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white'
                      : kpi.color === 'rose'
                      ? 'bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white'
                      : 'bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-4">
                <div className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight font-['JetBrains_Mono']">
                  {kpi.value}
                </div>
                <div className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                  {kpi.subtext}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Grid: Visual Analysis (Left) & À Surveiller (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual Analysis (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Graphique Dynamique d'Évolution du CA */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                  Dynamique du Chiffre d'Affaires & Commissions
                </h3>
                <p className="text-xs text-slate-500">
                  {period === 'all'
                    ? 'Historique complet des ventes et commissions'
                    : `Évolution sur la période sélectionnée (${filteredOrders.length} commande(s))`}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-slate-900 inline-block" />
                  <span className="text-slate-600 font-medium">CA</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500 inline-block" />
                  <span className="text-slate-600 font-medium">Commissions</span>
                </div>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs rounded-xl bg-slate-50 border border-dashed border-slate-200">
                <ShoppingBag className="h-6 w-6 mb-1 text-slate-300" />
                Aucune commande enregistrée sur cette période
              </div>
            ) : (
              <div className="space-y-2">
                {/* Bar Chart Container */}
                <div className="h-44 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-slate-100 relative">
                  {/* Tooltip on hover */}
                  {hoveredPoint && (
                    <div className="absolute top-0 right-2 z-10 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] text-white shadow-md">
                      <span className="text-slate-400">{hoveredPoint.label} : </span>
                      <strong className="text-white">{hoveredPoint.ca.toLocaleString()} F</strong>
                      <span className="text-emerald-400 ml-1.5">({hoveredPoint.comm.toLocaleString()} F com.)</span>
                    </div>
                  )}

                  {chartData.map((pt, i) => {
                    const heightPct = Math.max(8, Math.round((pt.ca / maxChartCa) * 100));
                    const commPct = pt.ca > 0 ? Math.round((pt.comm / pt.ca) * 100) : 0;
                    return (
                      <div
                        key={i}
                        onMouseEnter={() => setHoveredPoint(pt)}
                        onMouseLeave={() => setHoveredPoint(null)}
                        className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer"
                      >
                        <div
                          className="w-full max-w-[28px] rounded-t-md bg-slate-900 group-hover:bg-slate-700 transition-all relative overflow-hidden flex flex-col justify-end"
                          style={{ height: `${heightPct}%` }}
                        >
                          {/* Inner Commission segment */}
                          <div
                            className="w-full bg-emerald-500"
                            style={{ height: `${Math.min(100, commPct * 2)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono mt-1.5 group-hover:text-slate-900 font-medium">
                          {pt.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Total CA période : <strong className="text-slate-700">{totalCa.toLocaleString()} FCFA</strong></span>
                  <span>Total Com. période : <strong className="text-emerald-700">{totalCommission.toLocaleString()} FCFA</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Top Partenaires Chart / Ranking */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Top Partenaires {period !== 'all' ? '(Période sélectionnée)' : '(Global)'}
                </h3>
                <p className="text-xs text-slate-500">Classement selon le volume de ventes généré</p>
              </div>
              <button
                onClick={() => onNavigateToTab('ANALYSE')}
                className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Voir tout <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {topPartners.map((p: any, idx) => {
                const partnerCa = period === 'all' ? p.ca : (p.periodCa ?? p.ca);
                const maxCa = period === 'all' ? (topPartners[0]?.ca || 1) : ((topPartners[0] as any)?.periodCa || topPartners[0]?.ca || 1);
                const pct = Math.max(4, Math.round((partnerCa / (maxCa || 1)) * 100));
                return (
                  <div
                    key={p.id}
                    onClick={() => onSelectPartner(p)}
                    className="group cursor-pointer rounded-xl p-2.5 hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-600">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {p.code} — {p.fullName}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            p.rank === 'Signature'
                              ? 'bg-purple-100 text-purple-800'
                              : p.rank === 'Excellence'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {p.rank}
                        </span>
                      </div>
                      <span className="font-extrabold text-slate-900 font-['JetBrains_Mono']">
                        {partnerCa.toLocaleString()} FCFA
                      </span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Évolution CA & Commissions (Summary Box) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Ratios Financiers & Distribution des Commissions</h3>
            <p className="text-xs text-slate-500 mb-4">
              Indicateurs de solvabilité et de répartition effective des commissions
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <span className="text-xs text-slate-500 font-medium">Taux moyen effectif</span>
                <div className="text-xl font-black text-slate-900 font-['JetBrains_Mono'] mt-1">
                  {totalCa > 0 ? ((totalCommission / totalCa) * 100).toFixed(1) : '0'} %
                </div>
                <span className="text-[10px] text-slate-400">Règle max 3 cmd Premium</span>
              </div>

              <div className="rounded-xl bg-emerald-50/70 p-3.5 border border-emerald-100">
                <span className="text-xs text-emerald-800 font-medium">Commissions versées</span>
                <div className="text-xl font-black text-emerald-800 font-['JetBrains_Mono'] mt-1">
                  {totalPaid.toLocaleString()} F
                </div>
                <span className="text-[10px] text-emerald-600">
                  {totalCommission > 0
                    ? `${Math.min(100, Math.round((totalPaid / totalCommission) * 100))}% du dû période`
                    : 'Paiements enregistrés'}
                </span>
              </div>

              <div className="rounded-xl bg-amber-50/70 p-3.5 border border-amber-100">
                <span className="text-xs text-amber-800 font-medium">Solde en attente de retrait</span>
                <div className="text-xl font-black text-amber-800 font-['JetBrains_Mono'] mt-1">
                  {totalToPay.toLocaleString()} F
                </div>
                <span className="text-[10px] text-amber-600">
                  {eligiblePayments.length} partenaire(s) &gt;= 5 000 F
                </span>
              </div>
            </div>

            {negativeBalancePartners.length === 0 && (
              <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Équilibre financier parfait :</strong> Aucun solde négatif détecté parmi l'ensemble des partenaires.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: À Surveiller (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Éléments à Surveiller
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              Cockpit
            </span>
          </div>

          {/* Watchlist Card 1: Paiements à traiter */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-purple-600" />
                Paiements éligibles à traiter ({eligiblePayments.length})
              </span>
              <span className="text-[10px] text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-md">
                &gt;= 5 000 FCFA
              </span>
            </div>

            {eligiblePayments.length === 0 ? (
              <p className="text-xs text-slate-400 py-1">Aucun solde partenaire en attente de paiement.</p>
            ) : (
              <div className="space-y-2 mt-2">
                {eligiblePayments.slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    onClick={() => onSelectPartner(p)}
                    className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 hover:bg-purple-50/50 cursor-pointer transition-colors"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900">{p.code}</span>
                      <span className="text-xs text-slate-600 ml-1.5">{p.fullName}</span>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 font-['JetBrains_Mono']">
                      {p.balance.toLocaleString()} FCFA
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Watchlist Card 2: Proches d'un changement de grade */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Proches d’une promotion ({partnersCloseToUpgrade.length})
              </span>
              <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md">
                &gt;= 75%
              </span>
            </div>

            {partnersCloseToUpgrade.length === 0 ? (
              <p className="text-xs text-slate-400 py-1">Aucun partenaire en phase d'accès imminent.</p>
            ) : (
              <div className="space-y-2.5 mt-2">
                {partnersCloseToUpgrade.slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    onClick={() => onSelectPartner(p)}
                    className="rounded-xl bg-slate-50 p-2.5 hover:bg-amber-50/50 cursor-pointer transition-colors"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-900">{p.code} — {p.fullName}</span>
                      <span className="font-extrabold text-amber-700">{p.progressPct}%</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Vers <strong className="text-slate-700">{p.nextRank}</strong> (CA : {p.ca.toLocaleString()} / {p.targetCaNextRank.toLocaleString()} F)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Watchlist Card 3: Partenaires inactifs */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-rose-500" />
                Partenaires inactifs ({inactivePartners.length})
              </span>
              <span className="text-[10px] text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded-md">
                À relancer
              </span>
            </div>

            {inactivePartners.length === 0 ? (
              <p className="text-xs text-slate-400 py-1">Tous les partenaires sont actuellement actifs.</p>
            ) : (
              <div className="space-y-2 mt-2">
                {inactivePartners.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => onSelectPartner(p)}
                    className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 hover:bg-rose-50/50 cursor-pointer transition-colors"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900">{p.code}</span>
                      <span className="text-xs text-slate-600 ml-1.5">{p.fullName}</span>
                    </div>
                    <span className="text-xs text-slate-400">{p.phone}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Watchlist Card 4: Commissions en attente */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-blue-600" />
                Commandes en cours ({pendingOrders.length})
              </span>
              <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md">
                0 com. acquise
              </span>
            </div>
            {pendingOrders.length === 0 ? (
              <p className="text-xs text-slate-400 py-1">Aucune commande en attente de finalisation.</p>
            ) : (
              <div className="space-y-2 mt-2">
                {pendingOrders.slice(0, 2).map((o) => (
                  <div
                    key={o.id}
                    onClick={() => onSelectOrder(o)}
                    className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 hover:bg-blue-50/50 cursor-pointer transition-colors"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900">{o.id}</span>
                      <span className="text-xs text-slate-600 ml-1.5">{o.partnerCode || o.clientName}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-600 font-['JetBrains_Mono']">
                      {o.orderStatus} • {o.totalAmount.toLocaleString()} F
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Watchlist Card 5: État d'intégrité & Sync */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />
                État d'intégrité & Sync
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  syncState.status === 'SYNCHRONISE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {syncState.status}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Dernière sync : {syncState.lastSync ? new Date(syncState.lastSync).toLocaleTimeString('fr-FR') : 'Non confirmée'}
            </p>
            <button
              onClick={() => onNavigateToTab('SYSTEME')}
              className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Consulter le Diagnostic système (11 contrôles)
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
