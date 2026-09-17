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
  PieChart,
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

  // Répartition des partenaires par grade (Pour le Donut Chart moderne inspiré de "Working Format")
  const rankStats = useMemo(() => {
    const total = partners.length || 1;
    const counts = {
      Neo: partners.filter((p) => p.rank === 'Neo').length,
      Ambassador: partners.filter((p) => p.rank === 'Ambassador').length,
      Excellence: partners.filter((p) => p.rank === 'Excellence').length,
      Signature: partners.filter((p) => p.rank === 'Signature').length,
    };
    return [
      { rank: 'Signature', count: counts.Signature, pct: Math.round((counts.Signature / total) * 100), color: '#8b5cf6' },
      { rank: 'Excellence', count: counts.Excellence, pct: Math.round((counts.Excellence / total) * 100), color: '#10b981' },
      { rank: 'Ambassador', count: counts.Ambassador, pct: Math.round((counts.Ambassador / total) * 100), color: '#f59e0b' },
      { rank: 'Neo', count: counts.Neo, pct: Math.round((counts.Neo / total) * 100), color: '#0ea5e9' },
    ];
  }, [partners]);

  // Éléments à surveiller
  const inactivePartners = partners.filter((p) => p.status === 'Inactif');
  const partnersCloseToUpgrade = partners.filter((p) => p.nextRank && p.progressPct >= 75);
  const pendingOrders = orders.filter((o) => (o.orderStatus === 'En attente' || o.orderStatus === 'Confirmée') && o.partnerId);
  const eligiblePayments = partners.filter((p) => p.balance >= 5000);
  const negativeBalancePartners = partners.filter((p) => p.balance < 0);

  // 6 Cartes KPI inspirées de Job.find et Eduka (dégradés vibrants, squircles translucides)
  const kpiCards = [
    {
      id: 'partenaires',
      label: 'Partenaires',
      value: period === 'all' ? partners.length : newPartnersInPeriod.length,
      subtext:
        period === 'all'
          ? `${partners.filter((p) => p.status === 'Actif').length} actifs (${partners.length} total)`
          : `${newPartnersInPeriod.length} inscrit(s) sur période`,
      icon: Users,
      gradient: 'from-indigo-600 to-violet-600',
      shadowColor: 'shadow-indigo-500/20',
      action: () => onNavigateToTab('GESTION'),
    },
    {
      id: 'ca',
      label: 'Chiffre d’Affaires',
      value: `${totalCa.toLocaleString()} F`,
      subtext: period === 'all' ? 'Volume global généré' : 'CA de la période',
      icon: TrendingUp,
      gradient: 'from-rose-500 to-red-500',
      shadowColor: 'shadow-rose-500/20',
      action: () => onNavigateToTab('ANALYSE'),
    },
    {
      id: 'commissions',
      label: 'Commissions',
      value: `${totalCommission.toLocaleString()} F`,
      subtext: `${totalPaid.toLocaleString()} F payés sur période`,
      icon: Award,
      gradient: 'from-sky-500 to-blue-600',
      shadowColor: 'shadow-blue-500/20',
      action: () => onNavigateToTab('ANALYSE'),
    },
    {
      id: 'commandes',
      label: 'Commandes',
      value: filteredOrders.length,
      subtext: `${filteredOrders.filter((o) => o.isPremium).length} Premium acquises`,
      icon: ShoppingBag,
      gradient: 'from-amber-400 to-orange-500',
      shadowColor: 'shadow-amber-500/20',
      action: () => onNavigateToTab('GESTION'),
    },
    {
      id: 'clients',
      label: 'Clients Affiliés',
      value: period === 'all' ? clients.length : newClientsInPeriod.length,
      subtext:
        period === 'all'
          ? `${clients.filter((c) => c.clientType === 'PARTENAIRE').length} affiliés (${clients.length} total)`
          : `${newClientsInPeriod.length} créé(s) sur période`,
      icon: UserCheck,
      gradient: 'from-emerald-500 to-teal-600',
      shadowColor: 'shadow-emerald-500/20',
      action: () => onNavigateToTab('GESTION'),
    },
    {
      id: 'a_payer',
      label: 'À Payer (Solde)',
      value: `${totalToPay.toLocaleString()} F`,
      subtext: `${eligiblePayments.length} partenaire(s) éligible(s)`,
      icon: CreditCard,
      gradient: 'from-slate-900 to-slate-800',
      shadowColor: 'shadow-slate-900/20',
      action: () => onNavigateToTab('GESTION'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. GREETING & PERIOD SELECTOR (Inspi Eduka & Job.find Header)             */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Cockpit de Pilotage 👋
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Supervision des ventes, commissions & intégrité du réseau AKF Partners
          </p>
        </div>

        {/* Period Selector Tabs (Pill style) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1.5 text-xs shadow-2xs">
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
                className={`rounded-xl px-3 py-1.5 font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  period === item.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range Picker */}
          {period === 'custom' && (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs shadow-2xs">
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

      {/* ========================================================================= */}
      {/* 2. 6 VIBRANT TOP METRIC CARDS (Inspi Job.find & Eduka Stat Cards)         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.id}
              onClick={kpi.action}
              className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${kpi.gradient} p-5 text-left text-white shadow-sm hover:shadow-lg ${kpi.shadowColor} hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col justify-between`}
            >
              {/* Background ambient bubble */}
              <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-white/10 blur-xl pointer-events-none" />

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-white/80">
                  {kpi.label}
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md text-white shadow-xs group-hover:scale-105 transition-transform">
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4">
                <div className="text-2xl sm:text-2xl xl:text-3xl font-black tracking-tight font-['JetBrains_Mono'] text-white">
                  {kpi.value}
                </div>
                <div className="mt-2 inline-flex items-center rounded-xl bg-black/15 px-2.5 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-xs truncate max-w-full">
                  {kpi.subtext}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN DASHBOARD GRID (2 Columns: Analysis & Actions)                    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ----------------------------------------------------------------------- */}
        {/* LEFT COLUMN (7 COLS): CHARTS, TOP PARTNERS & RATIOS                     */}
        {/* ----------------------------------------------------------------------- */}
        <div className="lg:col-span-7 space-y-6">
          {/* Dynamic CA & Commissions Evolution Chart Card */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                  Dynamique du Chiffre d'Affaires & Commissions
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {period === 'all'
                    ? 'Historique complet des ventes et commissions générées'
                    : `Période sélectionnée • ${filteredOrders.length} commande(s)`}
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-900 inline-block" />
                  <span className="text-slate-600 font-semibold">CA</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-slate-600 font-semibold">Commissions</span>
                </div>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-xs rounded-2xl bg-slate-50 border border-dashed border-slate-200">
                <ShoppingBag className="h-7 w-7 mb-2 text-slate-300" />
                Aucune vente enregistrée sur cette période
              </div>
            ) : (
              <div className="space-y-3">
                {/* Modern Bar Chart Container */}
                <div className="h-48 flex items-end gap-2.5 pt-8 pb-2 px-2 border-b border-slate-100 relative">
                  {hoveredPoint && (
                    <div className="absolute top-0 right-2 z-10 rounded-xl bg-slate-900 px-3 py-1.5 text-xs text-white shadow-lg animate-in fade-in">
                      <span className="text-slate-400">{hoveredPoint.label} : </span>
                      <strong className="text-white font-['JetBrains_Mono']">
                        {hoveredPoint.ca.toLocaleString()} F
                      </strong>
                      <span className="text-emerald-400 ml-2 font-['JetBrains_Mono']">
                        ({hoveredPoint.comm.toLocaleString()} F com.)
                      </span>
                    </div>
                  )}

                  {chartData.map((pt, i) => {
                    const heightPct = Math.max(10, Math.round((pt.ca / maxChartCa) * 100));
                    const commPct = pt.ca > 0 ? Math.round((pt.comm / pt.ca) * 100) : 0;
                    return (
                      <div
                        key={i}
                        onMouseEnter={() => setHoveredPoint(pt)}
                        onMouseLeave={() => setHoveredPoint(null)}
                        className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer"
                      >
                        {/* Background track */}
                        <div className="w-full max-w-[32px] h-full flex flex-col justify-end rounded-t-xl bg-slate-100/60 p-0.5 group-hover:bg-slate-100 transition-colors">
                          <div
                            className="w-full rounded-t-lg bg-slate-900 group-hover:bg-slate-700 transition-all relative overflow-hidden flex flex-col justify-end"
                            style={{ height: `${heightPct}%` }}
                          >
                            {/* Inner Commission segment */}
                            <div
                              className="w-full bg-emerald-500"
                              style={{ height: `${Math.min(100, commPct * 2.2)}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono mt-2 group-hover:text-slate-900 font-semibold">
                          {pt.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>
                    Total CA :{' '}
                    <strong className="text-slate-900 font-['JetBrains_Mono']">
                      {totalCa.toLocaleString()} FCFA
                    </strong>
                  </span>
                  <span>
                    Total Commissions :{' '}
                    <strong className="text-emerald-700 font-['JetBrains_Mono']">
                      {totalCommission.toLocaleString()} FCFA
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Top Partenaires (Inspi Job.find Ranked List) */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Top Partenaires {period !== 'all' ? '(Période sélectionnée)' : '(Volume Global)'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Classement des meilleurs apporteurs d'affaires</p>
              </div>
              <button
                onClick={() => onNavigateToTab('ANALYSE')}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Voir tout</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {topPartners.map((p: any, idx) => {
                const partnerCa = period === 'all' ? p.ca : (p.periodCa ?? p.ca);
                const maxCa =
                  period === 'all'
                    ? topPartners[0]?.ca || 1
                    : (topPartners[0] as any)?.periodCa || topPartners[0]?.ca || 1;
                const pct = Math.max(4, Math.round((partnerCa / (maxCa || 1)) * 100));

                const rankBadgeColors =
                  p.rank === 'Signature'
                    ? 'bg-purple-100 text-purple-800'
                    : p.rank === 'Excellence'
                    ? 'bg-emerald-100 text-emerald-800'
                    : p.rank === 'Ambassador'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-sky-100 text-sky-800';

                return (
                  <div
                    key={p.id}
                    onClick={() => onSelectPartner(p)}
                    className="group cursor-pointer rounded-2xl p-3 hover:bg-slate-50 border border-transparent hover:border-slate-200/80 transition-all"
                  >
                    <div className="flex items-center justify-between text-xs mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 font-extrabold text-[11px] text-slate-700 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                          #{idx + 1}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                            {p.fullName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono ml-2">
                            {p.code}
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${rankBadgeColors}`}>
                          {p.rank}
                        </span>
                      </div>
                      <span className="font-extrabold text-slate-900 font-['JetBrains_Mono']">
                        {partnerCa.toLocaleString()} FCFA
                      </span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ratios Financiers & Distribution Card */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Ratios Financiers & Solvabilité du Réseau
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Indicateurs de solvabilité et de répartition effective des commissions
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <span className="text-xs text-slate-500 font-medium">Taux moyen effectif</span>
                <div className="text-xl font-black text-slate-900 font-['JetBrains_Mono'] mt-1">
                  {totalCa > 0 ? ((totalCommission / totalCa) * 100).toFixed(1) : '0'} %
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Plafond 3 cmd Premium
                </span>
              </div>

              <div className="rounded-2xl bg-emerald-50/70 p-4 border border-emerald-100/80">
                <span className="text-xs text-emerald-800 font-medium">Commissions décaissées</span>
                <div className="text-xl font-black text-emerald-800 font-['JetBrains_Mono'] mt-1">
                  {totalPaid.toLocaleString()} F
                </div>
                <span className="text-[10px] text-emerald-600 mt-0.5 block font-medium">
                  {totalCommission > 0
                    ? `${Math.min(100, Math.round((totalPaid / totalCommission) * 100))}% du dû période`
                    : 'Paiements effectués'}
                </span>
              </div>

              <div className="rounded-2xl bg-amber-50/70 p-4 border border-amber-100/80">
                <span className="text-xs text-amber-800 font-medium">Solde en attente de retrait</span>
                <div className="text-xl font-black text-amber-800 font-['JetBrains_Mono'] mt-1">
                  {totalToPay.toLocaleString()} F
                </div>
                <span className="text-[10px] text-amber-600 mt-0.5 block font-medium">
                  {eligiblePayments.length} éligible(s) &gt;= 5 000 F
                </span>
              </div>
            </div>

            {negativeBalancePartners.length === 0 && (
              <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-emerald-50/80 px-4 py-2.5 text-xs text-emerald-800 border border-emerald-200/80">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Équilibre financier parfait :</strong> Aucun solde négatif détecté parmi
                  l'ensemble des partenaires.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* RIGHT COLUMN (5 COLS): DONUT CHART & OPERATIONAL WATCHLIST              */}
        {/* ----------------------------------------------------------------------- */}
        <div className="lg:col-span-5 space-y-6">
          {/* ===================================================================== */}
          {/* DONUT CHART: Répartition par Grade (Inspi "Working Format" Job.find)  */}
          {/* ===================================================================== */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-indigo-600" />
                  Répartition par Grade
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Structure de l'effectif des {partners.length} partenaires
                </p>
              </div>
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-xl">
                4 Niveaux
              </span>
            </div>

            {/* Circular Donut Diagram (SVG) */}
            <div className="flex flex-col items-center py-3">
              <div className="relative flex items-center justify-center">
                <svg className="w-44 h-44 -rotate-90" viewBox="0 0 140 140">
                  {/* Base Circle Track */}
                  <circle
                    cx="70"
                    cy="70"
                    r="54"
                    fill="transparent"
                    stroke="#f1f5f9"
                    strokeWidth="16"
                  />
                  {/* SVG Segments based on rank percentage */}
                  {(() => {
                    const circumference = 2 * Math.PI * 54; // ~339.29
                    let accumulatedOffset = 0;
                    return rankStats.map((item, idx) => {
                      const strokeDasharray = `${(item.pct / 100) * circumference} ${circumference}`;
                      const strokeDashoffset = -accumulatedOffset;
                      accumulatedOffset += (item.pct / 100) * circumference;
                      return (
                        <circle
                          key={idx}
                          cx="70"
                          cy="70"
                          r="54"
                          fill="transparent"
                          stroke={item.color}
                          strokeWidth="16"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          className="transition-all duration-700"
                        />
                      );
                    });
                  })()}
                </svg>

                {/* Donut Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Total
                  </span>
                  <span className="text-3xl font-black text-slate-900 font-['JetBrains_Mono']">
                    {partners.length}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Partenaires</span>
                </div>
              </div>

              {/* Donut Legend (Directly inspired by Job.find legend) */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4 w-full px-2">
                {rankStats.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-slate-600 font-medium">{item.rank}</span>
                    </div>
                    <span className="font-bold text-slate-900 font-['JetBrains_Mono']">
                      {item.count}{' '}
                      <span className="text-slate-400 font-normal">({item.pct}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* OPERATIONAL WATCHLIST / ÉLÉMENTS À SURVEILLER                         */}
          {/* ===================================================================== */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Éléments à Surveiller
              </h3>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-xl">
                Priorité
              </span>
            </div>

            {/* 1. Paiements éligibles */}
            <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-purple-900 flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-purple-600" />
                  Paiements éligibles ({eligiblePayments.length})
                </span>
                <span className="text-[10px] text-purple-700 font-bold bg-purple-100 px-2 py-0.5 rounded-md">
                  &gt;= 5 000 F
                </span>
              </div>

              {eligiblePayments.length === 0 ? (
                <p className="text-xs text-slate-400 py-1">Aucun solde en attente de décaissement.</p>
              ) : (
                <div className="space-y-1.5 pt-1">
                  {eligiblePayments.slice(0, 3).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => onSelectPartner(p)}
                      className="flex items-center justify-between rounded-xl bg-white p-2 hover:bg-purple-100/60 cursor-pointer transition-colors shadow-2xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{p.code}</span>
                        <span className="text-xs text-slate-600">{p.fullName}</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 font-['JetBrains_Mono']">
                        {p.balance.toLocaleString()} F
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Proches d'un changement de grade */}
            <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-900 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  Proches d’une promotion ({partnersCloseToUpgrade.length})
                </span>
                <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-md">
                  &gt;= 75%
                </span>
              </div>

              {partnersCloseToUpgrade.length === 0 ? (
                <p className="text-xs text-slate-400 py-1">Aucun partenaire proche du seuil supérieur.</p>
              ) : (
                <div className="space-y-2 pt-1">
                  {partnersCloseToUpgrade.slice(0, 2).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => onSelectPartner(p)}
                      className="rounded-xl bg-white p-2.5 hover:bg-amber-100/60 cursor-pointer transition-colors shadow-2xs"
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-900">
                          {p.code} — {p.fullName}
                        </span>
                        <span className="font-black text-amber-700">{p.progressPct}%</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Vers <strong className="text-slate-800">{p.nextRank}</strong> (CA :{' '}
                        {p.ca.toLocaleString()} / {p.targetCaNextRank.toLocaleString()} F)
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Partenaires inactifs */}
            <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-rose-900 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-rose-500" />
                  Partenaires inactifs ({inactivePartners.length})
                </span>
                <span className="text-[10px] text-rose-700 font-bold bg-rose-100 px-2 py-0.5 rounded-md">
                  À relancer
                </span>
              </div>

              {inactivePartners.length === 0 ? (
                <p className="text-xs text-slate-400 py-1">Tous les partenaires sont actifs.</p>
              ) : (
                <div className="space-y-1.5 pt-1">
                  {inactivePartners.slice(0, 2).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => onSelectPartner(p)}
                      className="flex items-center justify-between rounded-xl bg-white p-2 hover:bg-rose-100/60 cursor-pointer transition-colors shadow-2xs"
                    >
                      <div>
                        <span className="text-xs font-bold text-slate-900">{p.code}</span>
                        <span className="text-xs text-slate-600 ml-1.5">{p.fullName}</span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">{p.phone}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Commandes en attente */}
            <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-sky-900 flex items-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5 text-sky-600" />
                  Commandes en cours ({pendingOrders.length})
                </span>
                <span className="text-[10px] text-sky-700 font-bold bg-sky-100 px-2 py-0.5 rounded-md">
                  En attente
                </span>
              </div>

              {pendingOrders.length === 0 ? (
                <p className="text-xs text-slate-400 py-1">Aucune commande en attente.</p>
              ) : (
                <div className="space-y-1.5 pt-1">
                  {pendingOrders.slice(0, 2).map((o) => (
                    <div
                      key={o.id}
                      onClick={() => onSelectOrder(o)}
                      className="flex items-center justify-between rounded-xl bg-white p-2 hover:bg-sky-100/60 cursor-pointer transition-colors shadow-2xs"
                    >
                      <div>
                        <span className="text-xs font-bold text-slate-900">{o.id}</span>
                        <span className="text-xs text-slate-600 ml-1.5">
                          {o.partnerCode || o.clientName}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-700 font-['JetBrains_Mono']">
                        {o.totalAmount.toLocaleString()} F
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 5. Intégrité Système & Diagnostic */}
            <div className="pt-2">
              <button
                onClick={() => onNavigateToTab('SYSTEME')}
                className="w-full flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Consulter le Diagnostic Système (11 contrôles)</span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
