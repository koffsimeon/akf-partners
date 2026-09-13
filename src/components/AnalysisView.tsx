import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Award,
  AlertTriangle,
  Target,
  Users,
  ShoppingBag,
  CreditCard,
  CheckCircle2,
  ChevronRight,
  Filter,
  DollarSign,
  PieChart,
  ArrowUpRight,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { Client, Order, Partner, Payment } from '../types';

export type AnalysisSubTab = 'OVERVIEW' | 'PERFORMANCE' | 'PROGRESSION' | 'COMMISSIONS' | 'ANOMALIES' | 'DECISION';

interface AnalysisViewProps {
  partners: Partner[];
  clients: Client[];
  orders: Order[];
  payments: Payment[];
  onSelectPartner: (partner: Partner) => void;
  onSelectOrder: (order: Order) => void;
  onInitiatePayment: (partner: Partner) => void;
  onPromotePartner?: (partnerId: string) => Promise<void>;
}

export function AnalysisView({
  partners: rawPartners,
  clients: rawClients,
  orders: rawOrders,
  payments: rawPayments,
  onSelectPartner,
  onSelectOrder,
  onInitiatePayment,
  onPromotePartner,
}: AnalysisViewProps) {
  const partners = Array.isArray(rawPartners) ? rawPartners : [];
  const clients = Array.isArray(rawClients) ? rawClients : [];
  const orders = Array.isArray(rawOrders) ? rawOrders : [];
  const payments = Array.isArray(rawPayments) ? rawPayments : [];

  const [subTab, setSubTab] = useState<AnalysisSubTab>('DECISION');
  const [rankFilter, setRankFilter] = useState('ALL');
  const [waveFilter, setWaveFilter] = useState('ALL');

  // Calculs financiers
  const totalCa = orders.reduce((sum, o) => sum + (o.orderStatus !== 'Annulée' ? o.totalAmount : 0), 0);
  const totalValidatedCommissions = orders
    .filter((o) => o.commissionStatus === 'Validée')
    .reduce((sum, o) => sum + (o.commissionAmount || 0), 0);
  const totalPendingCommissions = orders
    .filter((o) => o.commissionStatus === 'En attente')
    .reduce((sum, o) => sum + (o.commissionAmount || 0), 0);
  const totalCommission = totalValidatedCommissions + totalPendingCommissions;
  const totalPaid = payments.reduce((sum, p) => sum + (p.status === 'Effectué' ? p.amount : 0), 0);
  const totalRemainingDue = Math.max(0, totalValidatedCommissions - totalPaid);
  const totalRemainingBalance = partners.reduce((sum, p) => sum + Math.max(0, p.balance), 0);

  const validOrdersCount = orders.filter((o) => o.orderStatus !== 'Annulée').length;
  const averageBasket = validOrdersCount > 0 ? Math.round(totalCa / validOrdersCount) : 0;
  const averageOrdersPerClient = clients.length > 0 ? (orders.length / clients.length).toFixed(1) : '0';

  // Performance ranking
  const filteredPerformancePartners = partners.filter((p) => {
    const matchRank = rankFilter === 'ALL' || p.rank === rankFilter;
    const matchWave = waveFilter === 'ALL' || p.wave === waveFilter;
    return matchRank && matchWave;
  }).sort((a, b) => b.ca - a.ca);

  // Proches d'une promotion (>75%)
  const closePartners = partners.filter((p) => p.nextRank && p.progressPct >= 75);

  // Détection des anomalies
  const negativeBalances = partners.filter((p) => p.balance < 0);
  const clientsWithoutPartnerAndNotDirect = clients.filter(
    (c) => !c.partnerId && c.clientType !== 'DIRECT AKF'
  );
  const premiumOrdersOverRank3Commissioned = orders.filter(
    (o) => o.premiumRankForClient && o.premiumRankForClient > 3 && o.commissionAmount > 0
  );
  const ordersWithMathMismatch = orders.filter(
    (o) => o.unitPrice * o.quantity !== o.totalAmount
  );
  const ordersWithoutClient = orders.filter((o) => !o.clientId || !o.clientName);

  // Décisionnel: "Où dois-je agir ?"
  const whoToPayToday = partners.filter((p) => p.balance >= 5000);
  const whoToReactivate = partners.filter((p) => p.status === 'Inactif' || p.orderCount === 0);
  const whoToPromote = closePartners;
  const priorityAnomaliesCount =
    negativeBalances.length +
    clientsWithoutPartnerAndNotDirect.length +
    premiumOrdersOverRank3Commissioned.length +
    ordersWithMathMismatch.length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Centre d’Analyse & Décision
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Indicateurs clés, progression des grades, contrôle des anomalies et recommandations
          </p>
        </div>

        {/* Sub-Tabs Pills */}
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-2xs">
          <button
            onClick={() => setSubTab('DECISION')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold whitespace-nowrap transition-colors ${
              subTab === 'DECISION'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Target className="h-3.5 w-3.5" />
            🎯 Où dois-je agir ?
          </button>
          <button
            onClick={() => setSubTab('OVERVIEW')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold whitespace-nowrap transition-colors ${
              subTab === 'OVERVIEW'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Vue générale
          </button>
          <button
            onClick={() => setSubTab('PERFORMANCE')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold whitespace-nowrap transition-colors ${
              subTab === 'PERFORMANCE'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Performance
          </button>
          <button
            onClick={() => setSubTab('PROGRESSION')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold whitespace-nowrap transition-colors ${
              subTab === 'PROGRESSION'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Progression
          </button>
          <button
            onClick={() => setSubTab('COMMISSIONS')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold whitespace-nowrap transition-colors ${
              subTab === 'COMMISSIONS'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Commissions
          </button>
          <button
            onClick={() => setSubTab('ANOMALIES')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold whitespace-nowrap transition-colors ${
              subTab === 'ANOMALIES'
                ? 'bg-rose-600 text-white shadow-xs'
                : priorityAnomaliesCount > 0
                ? 'text-rose-600 hover:bg-rose-50 font-bold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Anomalies ({priorityAnomaliesCount})
          </button>
        </div>
      </div>

      {/* 9.6 ASSISTANT DÉCISIONNEL : OÙ DOIS-JE AGIR ? */}
      {subTab === 'DECISION' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-900 p-6 text-white shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-emerald-400">
                <Target className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-white">
                  Assistant Décisionnel Administrateur — AKF
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Synthèse des priorités opérationnelles générées par le moteur métier
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Box 1: Qui doit être payé aujourd'hui ? */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">1. Qui doit être payé aujourd'hui ?</h4>
                    <p className="text-xs text-slate-400">Soldes éligibles (&gt;= 5 000 FCFA)</p>
                  </div>
                </div>
                <span className="text-xs font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                  {whoToPayToday.length} partenaire(s)
                </span>
              </div>

              {whoToPayToday.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">Aucun partenaire n’a atteint le seuil de 5 000 FCFA.</p>
              ) : (
                <div className="space-y-2.5">
                  {whoToPayToday.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl bg-slate-50 p-3 hover:bg-purple-50/40 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900">{p.code}</span>
                          <span className="text-xs font-bold text-slate-900">{p.fullName}</span>
                        </div>
                        <span className="text-[11px] text-slate-500">{p.phone}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-extrabold text-purple-900 font-['JetBrains_Mono']">
                          {p.balance.toLocaleString()} FCFA
                        </span>
                        <button
                          onClick={() => onInitiatePayment(p)}
                          className="rounded-lg bg-purple-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-purple-700 transition-colors shadow-2xs"
                        >
                          Payer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Box 2: Qui est sur le point de monter en grade ? */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">2. Promotion imminente de grade</h4>
                    <p className="text-xs text-slate-400">Objectif atteint à &gt;= 75%</p>
                  </div>
                </div>
                <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  {whoToPromote.length} proche(s)
                </span>
              </div>

              {whoToPromote.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">Aucun partenaire proche du palier supérieur.</p>
              ) : (
                <div className="space-y-2.5">
                  {whoToPromote.map((p) => {
                    const caMissing = Math.max(0, p.targetCaNextRank - p.ca);
                    const cmdMissing = Math.max(0, p.targetCmdNextRank - p.orderCount);
                    return (
                      <div
                        key={p.id}
                        onClick={() => onSelectPartner(p)}
                        className="rounded-xl bg-slate-50 p-3 hover:bg-amber-50/40 cursor-pointer transition-colors space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900">{p.code} — {p.fullName}</span>
                          <span className="font-extrabold text-amber-700">{p.progressPct}%</span>
                        </div>
                        <div className="text-[11px] text-slate-600">
                          Vers <strong className="text-slate-800">{p.nextRank}</strong> : Manque encore{' '}
                          <strong className="text-emerald-700">{caMissing.toLocaleString()} FCFA</strong> de CA et{' '}
                          <strong className="text-emerald-700">{cmdMissing}</strong> commande(s).
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Box 3: Qui doit être relancé ? */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">3. Partenaires inactifs / sans vente</h4>
                    <p className="text-xs text-slate-400">À contacter ou relancer sur WhatsApp</p>
                  </div>
                </div>
                <span className="text-xs font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                  {whoToReactivate.length} partenaire(s)
                </span>
              </div>

              {whoToReactivate.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">Aucun partenaire inactif.</p>
              ) : (
                <div className="space-y-2">
                  {whoToReactivate.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => onSelectPartner(p)}
                      className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 hover:bg-rose-50/40 cursor-pointer"
                    >
                      <div>
                        <span className="text-xs font-bold text-slate-900">{p.code} — {p.fullName}</span>
                        <div className="text-[11px] text-slate-400">{p.phone} • {p.wave}</div>
                      </div>
                      <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                        0 commande
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Box 4: Anomalies prioritaires */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">4. Anomalies système prioritaires</h4>
                    <p className="text-xs text-slate-400">Contrôles d'intégrité comptable</p>
                  </div>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    priorityAnomaliesCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {priorityAnomaliesCount} anomalie(s)
                </span>
              </div>

              {priorityAnomaliesCount === 0 ? (
                <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 p-3 rounded-xl">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Toutes les règles d'intégrité sont respectées. Aucune anomalie détectée.</span>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  {negativeBalances.length > 0 && (
                    <div className="rounded-xl bg-rose-50 p-2.5 text-rose-800 border border-rose-200">
                      <strong>{negativeBalances.length}</strong> partenaire(s) avec un solde négatif !
                    </div>
                  )}
                  {premiumOrdersOverRank3Commissioned.length > 0 && (
                    <div className="rounded-xl bg-rose-50 p-2.5 text-rose-800 border border-rose-200">
                      <strong>{premiumOrdersOverRank3Commissioned.length}</strong> commande(s) Premium &gt; rang 3 ont reçu une commission indue !
                    </div>
                  )}
                  {clientsWithoutPartnerAndNotDirect.length > 0 && (
                    <div className="rounded-xl bg-amber-50 p-2.5 text-amber-800 border border-amber-200">
                      <strong>{clientsWithoutPartnerAndNotDirect.length}</strong> client(s) sans partenaire non marqués DIRECT AKF.
                    </div>
                  )}
                  <button
                    onClick={() => setSubTab('ANOMALIES')}
                    className="w-full text-center py-2 text-xs font-bold text-rose-700 hover:underline"
                  >
                    Voir le détail complet des anomalies →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 9.1 VUE GÉNÉRALE */}
      {subTab === 'OVERVIEW' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Chiffre d’affaires total</span>
              <div className="text-2xl font-black text-slate-900 font-['JetBrains_Mono'] mt-2">
                {totalCa.toLocaleString()} FCFA
              </div>
              <p className="text-[11px] text-slate-500 mt-1">{validOrdersCount} commandes validées</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Commissions totales</span>
              <div className="text-2xl font-black text-emerald-700 font-['JetBrains_Mono'] mt-2">
                {totalCommission.toLocaleString()} FCFA
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Générées pour les partenaires</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Commissions payées</span>
              <div className="text-2xl font-black text-purple-700 font-['JetBrains_Mono'] mt-2">
                {totalPaid.toLocaleString()} FCFA
              </div>
              <p className="text-[11px] text-slate-500 mt-1">{payments.length} paiements exécutés</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Solde restant à régler</span>
              <div className="text-2xl font-black text-amber-700 font-['JetBrains_Mono'] mt-2">
                {totalRemainingBalance.toLocaleString()} FCFA
              </div>
              <p className="text-[11px] text-slate-500 mt-1">En attente de versement</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Panier moyen</span>
              <div className="text-xl font-black text-slate-900 font-['JetBrains_Mono'] mt-2">
                {averageBasket.toLocaleString()} FCFA
              </div>
              <p className="text-xs text-slate-500 mt-1">Montant moyen dépensé par commande</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Commandes par client</span>
              <div className="text-xl font-black text-slate-900 font-['JetBrains_Mono'] mt-2">
                {averageOrdersPerClient} commandes
              </div>
              <p className="text-xs text-slate-500 mt-1">Fréquence moyenne de réachat par client</p>
            </div>
          </div>
        </div>
      )}

      {/* 9.2 PERFORMANCE DES PARTENAIRES */}
      {subTab === 'PERFORMANCE' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-700">Filtres performance :</span>
              <select
                value={rankFilter}
                onChange={(e) => setRankFilter(e.target.value)}
                className="rounded-xl border border-slate-200 px-2.5 py-1 text-xs text-slate-700 bg-white"
              >
                <option value="ALL">Tous les grades</option>
                <option value="Neo">Neo</option>
                <option value="Ambassador">Ambassador</option>
                <option value="Excellence">Excellence</option>
                <option value="Signature">Signature</option>
              </select>

              <select
                value={waveFilter}
                onChange={(e) => setWaveFilter(e.target.value)}
                className="rounded-xl border border-slate-200 px-2.5 py-1 text-xs text-slate-700 bg-white"
              >
                <option value="ALL">Toutes les vagues</option>
                <option value="Vague 1">Vague 1</option>
                <option value="Vague 2">Vague 2</option>
              </select>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {filteredPerformancePartners.length} partenaire(s) classé(s)
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Rang</th>
                  <th className="py-3 px-4">Code / Partenaire</th>
                  <th className="py-3 px-4">Grade</th>
                  <th className="py-3 px-4 text-right">CA Réalisé</th>
                  <th className="py-3 px-4 text-center">Commandes</th>
                  <th className="py-3 px-4 text-center">Clients</th>
                  <th className="py-3 px-4 text-right">Commissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredPerformancePartners.map((p, idx) => (
                  <tr
                    key={p.id}
                    onClick={() => onSelectPartner(p)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-slate-400">#{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {p.code} — {p.fullName}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-bold text-slate-800">{p.rank}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 font-['JetBrains_Mono']">
                      {p.ca.toLocaleString()} FCFA
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">{p.orderCount}</td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">{p.clientCount}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700 font-['JetBrains_Mono']">
                      {p.totalCommission.toLocaleString()} FCFA
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9.3 PROGRESSION ET OBJECTIFS */}
      {subTab === 'PROGRESSION' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-blue-50/70 p-4 border border-blue-200 text-xs text-blue-950 space-y-1.5">
            <div className="font-bold flex items-center gap-2 text-blue-900">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Architecture Officielle des 3 Piliers de Progression AKF
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 text-[11px] text-blue-900">
              <div className="bg-white/80 p-2.5 rounded-xl border border-blue-100">
                <strong>1. Performance Réelle :</strong> Commandes réelles confirmées + CA total généré depuis Google Sheets.
              </div>
              <div className="bg-white/80 p-2.5 rounded-xl border border-blue-100">
                <strong>2. Progression :</strong> Calculée vers le palier supérieur avec conditions cumulatives obligatoires (Commandes <u>ET</u> CA).
              </div>
              <div className="bg-white/80 p-2.5 rounded-xl border border-blue-100">
                <strong>3. Grade & Commission :</strong> Le grade officiel confirmé sert de référence pour le taux de commission. Promotion par validation humaine.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {partners.map((p) => {
              const caMissing = Math.max(0, p.targetCaNextRank - p.ca);
              const cmdMissing = Math.max(0, p.targetCmdNextRank - p.orderCount);
              const isMaxRank = !p.nextRank || p.rank === 'Signature';
              const isEligible = p.eligibleForPromotion || (p.potentialRank && p.potentialRank !== p.rank);

              return (
                <div
                  key={p.id}
                  className={`rounded-2xl border bg-white p-5 shadow-2xs transition-all space-y-4 ${
                    isEligible ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                          {p.code}
                        </span>
                        <span className="text-[11px] text-slate-500">{p.wave || 'Vague 1'}</span>
                      </div>
                      <h4
                        onClick={() => onSelectPartner(p)}
                        className="font-bold text-slate-900 mt-1 cursor-pointer hover:text-amber-600 transition-colors"
                      >
                        {p.fullName}
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                        Grade Actuel : {p.rank}
                      </span>
                      <div className="text-[11px] font-semibold text-emerald-700 mt-1">
                        Taux commission : {p.commissionRate || (p.rank === 'Signature' ? 12 : p.rank === 'Excellence' ? 10 : p.rank === 'Ambassador' ? 8 : 6)}%
                      </div>
                    </div>
                  </div>

                  {/* 1. Axe Performance Réelle */}
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                      <span>1. Performance Réelle</span>
                      <span className="text-slate-500 font-normal">Basée sur données réelles</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500">Commandes réelles :</span>
                        <div className="text-sm font-extrabold text-slate-900 font-['JetBrains_Mono']">
                          {p.orderCount} cmd(s)
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500">CA Réel généré :</span>
                        <div className="text-sm font-extrabold text-slate-900 font-['JetBrains_Mono']">
                          {p.ca.toLocaleString()} FCFA
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Axe Progression vers le Prochain Grade */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">
                        2. Progression vers {p.nextRank || 'Signature (Palier Max)'}
                      </span>
                      <span className="font-extrabold text-slate-900">{p.progressPct}%</span>
                    </div>

                    <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          p.progressPct >= 100
                            ? 'bg-emerald-500'
                            : p.progressPct >= 75
                            ? 'bg-amber-500'
                            : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(100, p.progressPct)}%` }}
                      />
                    </div>

                    {!isMaxRank ? (
                      <div className="text-[11px] text-slate-600 bg-amber-50/50 p-2 rounded-lg border border-amber-100 flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span>
                          Obj. Commandes : <strong>{p.orderCount} / {p.targetCmdNextRank}</strong>{' '}
                          {cmdMissing > 0 ? `(reste ${cmdMissing})` : '✓ Atteint'}
                        </span>
                        <span>
                          Obj. CA : <strong>{p.ca.toLocaleString()} / {p.targetCaNextRank.toLocaleString()} F</strong>{' '}
                          {caMissing > 0 ? `(reste ${caMissing.toLocaleString()} F)` : '✓ Atteint'}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-purple-900 bg-purple-50 p-2 rounded-lg text-center font-bold">
                        🏆 Grade maximal atteint (Signature)
                      </div>
                    )}
                  </div>

                  {/* 3. Axe Grade Maximal / Théorique & Panneau de Validation Humaine */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 text-[11px]">Grade théorique potentiel :</span>
                      <div className="font-bold text-slate-800">{p.potentialRank || p.rank}</div>
                    </div>

                    {isEligible && onPromotePartner && p.nextRank && (
                      <button
                        type="button"
                        onClick={() => onPromotePartner(p.id)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-xs hover:bg-amber-400 transition-colors shadow-xs flex items-center gap-1"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Confirmer promotion vers {p.nextRank}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 9.4 ANALYSE DES COMMISSIONS */}
      {subTab === 'COMMISSIONS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Commissions Validées</span>
              <div className="text-xl font-black text-emerald-700 font-['JetBrains_Mono'] mt-1">
                {totalValidatedCommissions.toLocaleString()} FCFA
              </div>
              <p className="text-xs text-slate-400 mt-1">Total acquis (commandes terminées)</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Commissions Payées</span>
              <div className="text-xl font-black text-purple-700 font-['JetBrains_Mono'] mt-1">
                {totalPaid.toLocaleString()} FCFA
              </div>
              <p className="text-xs text-slate-400 mt-1">Enregistrées dans PAIEMENTS</p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Commission Restante à Payer</span>
              <div className="text-xl font-black text-amber-800 font-['JetBrains_Mono'] mt-1">
                {totalRemainingDue.toLocaleString()} FCFA
              </div>
              <p className="text-xs text-amber-600 mt-1">Validées − Payées (minimum 0)</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Commissions En attente</span>
              <div className="text-xl font-black text-slate-700 font-['JetBrains_Mono'] mt-1">
                {totalPendingCommissions.toLocaleString()} FCFA
              </div>
              <p className="text-xs text-slate-400 mt-1">Commandes en cours non terminées</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 flex items-center justify-between">
            <div>
              <strong>Règle financière AKF :</strong> Solde restant dû = Commissions validées ({totalValidatedCommissions.toLocaleString()} FCFA) − Commissions effectivement décaissées ({totalPaid.toLocaleString()} FCFA) = <strong className="text-amber-700">{totalRemainingDue.toLocaleString()} FCFA</strong>.
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              Source PAIEMENTS certifiée
            </span>
          </div>
        </div>
      )}

      {/* 9.5 DÉTECTION DES ANOMALIES */}
      {subTab === 'ANOMALIES' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-2xs">
            <h3 className="text-base font-bold text-slate-900 mb-2">Audit d'Intégrité des Données</h3>
            <p className="text-xs text-slate-500 mb-4">
              Vérification continue des 7 règles critiques de cohérence financière et relationnelle
            </p>

            <div className="space-y-3">
              {/* Règle 1 : Soldes négatifs */}
              <div className={`p-4 rounded-xl border ${negativeBalances.length > 0 ? 'bg-red-50 border-red-200 text-red-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>1. Solde négatif détecté</span>
                  <span>{negativeBalances.length === 0 ? '🟢 AUCUNE ANOMALIE' : `🔴 ${negativeBalances.length} ERREUR(S)`}</span>
                </div>
                {negativeBalances.length > 0 && (
                  <p className="text-xs mt-1">Partenaires avec solde &lt; 0 : {negativeBalances.map((p) => `${p.code} (${p.balance} F)`).join(', ')}</p>
                )}
              </div>

              {/* Règle 2 : Clients sans partenaire */}
              <div className={`p-4 rounded-xl border ${clientsWithoutPartnerAndNotDirect.length > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>2. Client sans partenaire non marqué DIRECT AKF</span>
                  <span>{clientsWithoutPartnerAndNotDirect.length === 0 ? '🟢 CONFORME' : `🟠 ${clientsWithoutPartnerAndNotDirect.length} NON CONFORME`}</span>
                </div>
              </div>

              {/* Règle 3 : Rang Premium > 3 commissionné */}
              <div className={`p-4 rounded-xl border ${premiumOrdersOverRank3Commissioned.length > 0 ? 'bg-red-50 border-red-200 text-red-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>3. Commande Premium &gt; rang 3 avec commission indue</span>
                  <span>{premiumOrdersOverRank3Commissioned.length === 0 ? '🟢 RÈGLE RESPECTÉE (Max 3 cmd Premium)' : `🔴 ${premiumOrdersOverRank3Commissioned.length} INCOHÉRENCE(S)`}</span>
                </div>
              </div>

              {/* Règle 4 : Prix unitaire * Quantité != Montant Total */}
              <div className={`p-4 rounded-xl border ${ordersWithMathMismatch.length > 0 ? 'bg-red-50 border-red-200 text-red-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>4. Incohérence arithmétique commande (PU x Qté != Total)</span>
                  <span>{ordersWithMathMismatch.length === 0 ? '🟢 CALCULS EXACTS' : `🔴 ${ordersWithMathMismatch.length} ERREUR(S)`}</span>
                </div>
              </div>

              {/* Règle 5 : Commande sans client */}
              <div className={`p-4 rounded-xl border ${ordersWithoutClient.length > 0 ? 'bg-red-50 border-red-200 text-red-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>5. Commande orpheline sans client</span>
                  <span>{ordersWithoutClient.length === 0 ? '🟢 AUCUNE COMMANDE ORPHELINE' : `🔴 ${ordersWithoutClient.length} ERREUR(S)`}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
