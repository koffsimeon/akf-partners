import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  ShoppingBag,
  CreditCard,
  Search,
  Plus,
  Phone,
  MessageSquare,
  Award,
  ChevronRight,
  TrendingUp,
  Filter,
  CheckCircle2,
  AlertCircle,
  Eye,
  Pencil,
  X,
} from 'lucide-react';
import { Client, Order, Partner, Payment } from '../types';

export type ManagementSubTab = 'PARTNERS' | 'CLIENTS' | 'ORDERS' | 'PAYMENTS';

interface ManagementViewProps {
  partners: Partner[];
  clients: Client[];
  orders: Order[];
  payments: Payment[];
  initialSubTab?: ManagementSubTab;
  filterId?: string | null;
  onOpenCreate: (type: 'PARTNER' | 'CLIENT' | 'ORDER' | 'PAYMENT') => void;
  onSelectPartner: (partner: Partner) => void;
  onEditPartner?: (partner: Partner) => void;
  onSelectClient: (client: Client) => void;
  onSelectOrder: (order: Order) => void;
  onSelectPayment: (payment: Payment) => void;
  onClearFilterId?: () => void;
}

export function ManagementView({
  partners: rawPartners,
  clients: rawClients,
  orders: rawOrders,
  payments: rawPayments,
  initialSubTab = 'PARTNERS',
  filterId = null,
  onOpenCreate,
  onSelectPartner,
  onEditPartner,
  onSelectClient,
  onSelectOrder,
  onSelectPayment,
  onClearFilterId,
}: ManagementViewProps) {
  const partners = Array.isArray(rawPartners) ? rawPartners : [];
  const clients = Array.isArray(rawClients) ? rawClients : [];
  const orders = Array.isArray(rawOrders) ? rawOrders : [];
  const payments = Array.isArray(rawPayments) ? rawPayments : [];

  const [subTab, setSubTab] = useState<ManagementSubTab>(initialSubTab);
  const [search, setSearch] = useState('');
  const [rankFilter, setRankFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Filtrage Partenaires
  const filteredPartners = partners.filter((p) => {
    const q = search.toLowerCase();
    const matchQuery =
      !q ||
      p.fullName.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.phone.includes(q);
    const matchRank = rankFilter === 'ALL' || p.rank === rankFilter;
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
    const matchRel = !filterId || p.id === filterId;
    return matchQuery && matchRank && matchStatus && matchRel;
  });

  // Filtrage Clients
  const filteredClients = clients.filter((c) => {
    const q = search.toLowerCase();
    const matchQuery =
      !q ||
      c.fullName.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.partnerCode && c.partnerCode.toLowerCase().includes(q));
    const matchRel = !filterId || c.partnerId === filterId || c.id === filterId;
    return matchQuery && matchRel;
  });

  // Filtrage Commandes
  const filteredOrders = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchQuery =
      !q ||
      o.id.toLowerCase().includes(q) ||
      o.clientName.toLowerCase().includes(q) ||
      o.productName.toLowerCase().includes(q) ||
      (o.partnerCode && o.partnerCode.toLowerCase().includes(q));
    const matchRel =
      !filterId || o.partnerId === filterId || o.clientId === filterId || o.id === filterId;
    return matchQuery && matchRel;
  });

  // Filtrage Paiements
  const filteredPayments = payments.filter((p) => {
    const q = search.toLowerCase();
    const matchQuery =
      !q ||
      p.id.toLowerCase().includes(q) ||
      p.partnerName.toLowerCase().includes(q) ||
      p.partnerCode.toLowerCase().includes(q) ||
      p.reference.toLowerCase().includes(q);
    const matchRel = !filterId || p.partnerId === filterId || p.id === filterId;
    return matchQuery && matchRel;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Gestion des Entités AKF
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">
            Administration des partenaires, clients, commandes et paiements
          </p>
        </div>

        {/* Sub-Tabs Pills (Inspi Eduka clean tabbed pills) */}
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1.5 text-xs shadow-2xs">
          <button
            onClick={() => setSubTab('PARTNERS')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 font-bold whitespace-nowrap transition-all cursor-pointer ${
              subTab === 'PARTNERS'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Partenaires</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${subTab === 'PARTNERS' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {partners.length}
            </span>
          </button>
          <button
            onClick={() => setSubTab('CLIENTS')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 font-bold whitespace-nowrap transition-all cursor-pointer ${
              subTab === 'CLIENTS'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>Clients</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${subTab === 'CLIENTS' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {clients.length}
            </span>
          </button>
          <button
            onClick={() => setSubTab('ORDERS')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 font-bold whitespace-nowrap transition-all cursor-pointer ${
              subTab === 'ORDERS'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Commandes</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${subTab === 'ORDERS' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {orders.length}
            </span>
          </button>
          <button
            onClick={() => setSubTab('PAYMENTS')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 font-bold whitespace-nowrap transition-all cursor-pointer ${
              subTab === 'PAYMENTS'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>Paiements</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${subTab === 'PAYMENTS' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {payments.length}
            </span>
          </button>
        </div>
      </div>

      {/* Relational Filter Banner (if coming from a related click) */}
      {filterId && (
        <div className="flex items-center justify-between rounded-2xl bg-emerald-50/80 px-4 py-3 text-xs text-emerald-900 border border-emerald-200/80">
          <div className="flex items-center gap-2">
            <span className="font-bold">Filtre relationnel actif :</span>
            <span className="font-mono bg-white px-2.5 py-0.5 rounded-lg border border-emerald-200 font-bold">
              {filterId}
            </span>
          </div>
          {onClearFilterId && (
            <button
              onClick={onClearFilterId}
              className="flex items-center gap-1 text-xs font-bold text-emerald-800 hover:underline cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              <span>Afficher tout</span>
            </button>
          )}
        </div>
      )}

      {/* Controls Bar (Search + Specific Filters + Add Button) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-2xs">
        <div className="flex flex-1 items-center gap-2.5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={`Rechercher dans ${
                subTab === 'PARTNERS'
                  ? 'les partenaires (nom, code, téléphone)...'
                  : subTab === 'CLIENTS'
                  ? 'les clients (nom, ID, téléphone)...'
                  : subTab === 'ORDERS'
                  ? 'les commandes (ID, client, produit)...'
                  : 'les paiements (ID, partenaire, référence)...'
              }`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-xs text-slate-800 focus:bg-white focus:border-slate-400 outline-hidden font-medium"
            />
          </div>

          {subTab === 'PARTNERS' && (
            <div className="flex items-center gap-2">
              <select
                value={rankFilter}
                onChange={(e) => setRankFilter(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-medium text-slate-700 outline-hidden cursor-pointer"
              >
                <option value="ALL">Tous les grades</option>
                <option value="Neo">Neo (6%)</option>
                <option value="Ambassador">Ambassador (8%)</option>
                <option value="Excellence">Excellence (10%)</option>
                <option value="Signature">Signature (12%)</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-medium text-slate-700 outline-hidden cursor-pointer"
              >
                <option value="ALL">Tous statuts</option>
                <option value="Actif">Actif</option>
                <option value="Inactif">Inactif</option>
              </select>
            </div>
          )}
        </div>

        <div>
          {subTab === 'PARTNERS' && (
            <button
              onClick={() => onOpenCreate('PARTNER')}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-xs font-bold text-white transition-all shadow-xs shadow-indigo-600/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ Créer Partenaire</span>
            </button>
          )}
          {subTab === 'CLIENTS' && (
            <button
              onClick={() => onOpenCreate('CLIENT')}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition-all shadow-xs shadow-emerald-600/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ Créer Client</span>
            </button>
          )}
          {subTab === 'ORDERS' && (
            <button
              onClick={() => onOpenCreate('ORDER')}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-2xl bg-amber-500 hover:bg-amber-600 px-4 py-2.5 text-xs font-bold text-white transition-all shadow-xs shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ Nouvelle Commande</span>
            </button>
          )}
          {subTab === 'PAYMENTS' && (
            <button
              onClick={() => onOpenCreate('PAYMENT')}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-2xl bg-purple-600 hover:bg-purple-700 px-4 py-2.5 text-xs font-bold text-white transition-all shadow-xs shadow-purple-600/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ Émettre Paiement</span>
            </button>
          )}
        </div>
      </div>

      {/* 8.1 PARTENAIRES (Inspi "Employee Status" Table from Job.find) */}
      {subTab === 'PARTNERS' && (
        <div className="space-y-3">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-5">Partenaire</th>
                  <th className="py-4 px-4">Contact</th>
                  <th className="py-4 px-4">Grade & Vague</th>
                  <th className="py-4 px-4 text-right">CA Cumulé</th>
                  <th className="py-4 px-4 text-center">Clients</th>
                  <th className="py-4 px-4 text-center">Cmds</th>
                  <th className="py-4 px-4 text-right">Commissions</th>
                  <th className="py-4 px-4 text-right">Solde</th>
                  <th className="py-4 px-4 text-center">Statut</th>
                  <th className="py-4 px-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80 font-medium text-slate-700">
                {filteredPartners.map((p) => {
                  const initials = p.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  const rankColors =
                    p.rank === 'Signature'
                      ? 'bg-purple-50 text-purple-700 border-purple-200/60'
                      : p.rank === 'Excellence'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                      : p.rank === 'Ambassador'
                      ? 'bg-amber-50 text-amber-700 border-amber-200/60'
                      : 'bg-sky-50 text-sky-700 border-sky-200/60';

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                      onClick={() => onSelectPartner(p)}
                    >
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-100 border border-indigo-200/60 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {initials}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block text-xs">
                              {p.fullName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {p.code} • {p.id}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600 text-xs">{p.phone}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${rankColors}`}
                        >
                          <Award className="h-3 w-3" />
                          {p.rank}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{p.wave}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 font-['JetBrains_Mono']">
                        {p.ca.toLocaleString()} F
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">{p.clientCount}</td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">{p.orderCount}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-600 font-['JetBrains_Mono']">
                        {p.totalCommission.toLocaleString()} F
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-emerald-800 font-['JetBrains_Mono']">
                        {p.balance.toLocaleString()} F
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            p.status === 'Actif'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectPartner(p);
                            }}
                            className="rounded-xl bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                            title="Ouvrir la fiche"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {onEditPartner && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditPartner(p);
                              }}
                              className="rounded-xl bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                              title="Modifier ce partenaire"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredPartners.map((p) => (
              <div
                key={p.id}
                onClick={() => onSelectPartner(p)}
                className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                      {p.code}
                    </span>
                    <h3 className="font-bold text-slate-900 mt-1.5">{p.fullName}</h3>
                    <p className="text-xs text-slate-500 font-mono">{p.phone}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        p.rank === 'Signature'
                          ? 'bg-purple-100 text-purple-800'
                          : p.rank === 'Excellence'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {p.rank}
                    </span>
                    {onEditPartner && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditPartner(p);
                        }}
                        className="rounded-xl bg-slate-100 p-2 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                        title="Modifier"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2.5 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">CA</span>
                    <strong className="font-['JetBrains_Mono']">{p.ca.toLocaleString()} F</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Commissions</span>
                    <strong className="text-emerald-600 font-['JetBrains_Mono']">
                      {p.totalCommission.toLocaleString()} F
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Solde</span>
                    <strong className="text-emerald-800 font-['JetBrains_Mono']">
                      {p.balance.toLocaleString()} F
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8.2 CLIENTS */}
      {subTab === 'CLIENTS' && (
        <div className="space-y-3">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-5">Client</th>
                  <th className="py-4 px-4">Contact</th>
                  <th className="py-4 px-4">Partenaire Affilié</th>
                  <th className="py-4 px-4">Type Client</th>
                  <th className="py-4 px-4 text-center">Commandes</th>
                  <th className="py-4 px-4 text-right">CA Cumulé</th>
                  <th className="py-4 px-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80 font-medium text-slate-700">
                {filteredClients.map((c) => {
                  const initials = c.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                      onClick={() => onSelectClient(c)}
                    >
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100 border border-emerald-200/60 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {initials}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block text-xs">
                              {c.fullName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{c.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        <div>{c.phone}</div>
                        {c.whatsapp && (
                          <div className="text-[10px] text-slate-400">WA: {c.whatsapp}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {c.partnerCode ? (
                          <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg text-[11px]">
                              {c.partnerCode}
                            </span>
                            <span className="text-slate-500 font-normal">({c.partnerName})</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold">DIRECT AKF</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            c.clientType === 'PARTENAIRE'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {c.clientType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800">{c.orderCount}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 font-['JetBrains_Mono']">
                        {c.totalCa.toLocaleString()} F
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectClient(c);
                          }}
                          className="rounded-xl bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 cursor-pointer transition-colors"
                          title="Ouvrir la fiche client"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredClients.map((c) => (
              <div
                key={c.id}
                onClick={() => onSelectClient(c)}
                className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-2.5 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg">
                      {c.id}
                    </span>
                    <h3 className="font-bold text-slate-900 mt-1.5">{c.fullName}</h3>
                    <p className="text-xs text-slate-500 font-mono">{c.phone}</p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      c.clientType === 'PARTENAIRE'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {c.clientType}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2.5 text-slate-600">
                  <span>Partenaire : <strong>{c.partnerCode || 'DIRECT AKF'}</strong></span>
                  <span>Cmds : <strong>{c.orderCount}</strong> ({c.totalCa.toLocaleString()} F)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8.3 COMMANDES */}
      {subTab === 'ORDERS' && (
        <div className="space-y-3">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-5">ID & Date</th>
                  <th className="py-4 px-4">Client</th>
                  <th className="py-4 px-4">Partenaire</th>
                  <th className="py-4 px-4">Produit</th>
                  <th className="py-4 px-4 text-center">Qté</th>
                  <th className="py-4 px-4 text-right">Total</th>
                  <th className="py-4 px-4 text-center">Rang Prem.</th>
                  <th className="py-4 px-4 text-right">Commission</th>
                  <th className="py-4 px-4 text-center">Statut Commande</th>
                  <th className="py-4 px-4 text-center">Statut Comm.</th>
                  <th className="py-4 px-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80 font-medium text-slate-700">
                {filteredOrders.map((o) => (
                  <tr
                    key={o.id}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    onClick={() => onSelectOrder(o)}
                  >
                    <td className="py-3.5 px-5 font-mono">
                      <span className="font-bold text-slate-900 block">{o.id}</span>
                      <span className="text-[10px] text-slate-400">{o.date}</span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{o.clientName}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {o.partnerCode ? (
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                          {o.partnerCode}
                        </span>
                      ) : (
                        <span className="text-slate-400">DIRECT AKF</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900">{o.productName}</span>
                      {o.isPremium && (
                        <span className="ml-1.5 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                          PREMIUM
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-800">{o.quantity}</td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 font-['JetBrains_Mono']">
                      {o.totalAmount.toLocaleString()} F
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {o.premiumRankForClient ? (
                        <span className="font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full text-[10px]">
                          Rang #{o.premiumRankForClient}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-700 font-['JetBrains_Mono']">
                      {o.commissionAmount > 0 ? `${o.commissionAmount.toLocaleString()} F` : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          o.orderStatus === 'Livrée'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {o.orderStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          o.commissionStatus === 'Validée'
                            ? 'bg-emerald-50 text-emerald-700'
                            : o.commissionStatus === 'Payée'
                            ? 'bg-purple-50 text-purple-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {o.commissionStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectOrder(o);
                        }}
                        className="rounded-xl bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 cursor-pointer transition-colors"
                        title="Ouvrir la fiche commande"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredOrders.map((o) => (
              <div
                key={o.id}
                onClick={() => onSelectOrder(o)}
                className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-2.5 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                      {o.id}
                    </span>
                    <h3 className="font-bold text-slate-900 mt-1">{o.productName}</h3>
                    <p className="text-xs text-slate-500">Client : {o.clientName}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-slate-900 font-['JetBrains_Mono']">
                      {o.totalAmount.toLocaleString()} F
                    </span>
                    <span
                      className={`block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                        o.orderStatus === 'Livrée'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {o.orderStatus}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2.5 text-slate-600">
                  <span>Partenaire : <strong>{o.partnerCode || 'DIRECT AKF'}</strong></span>
                  <span className="font-bold text-emerald-700 font-['JetBrains_Mono']">
                    Comm : {o.commissionAmount.toLocaleString()} F
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8.4 PAIEMENTS */}
      {subTab === 'PAYMENTS' && (
        <div className="space-y-3">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-5">ID & Réf</th>
                  <th className="py-4 px-4">Partenaire</th>
                  <th className="py-4 px-4">Date</th>
                  <th className="py-4 px-4 text-right">Montant Réglé</th>
                  <th className="py-4 px-4">Mode de Paiement</th>
                  <th className="py-4 px-4 text-center">Statut</th>
                  <th className="py-4 px-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80 font-medium text-slate-700">
                {filteredPayments.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    onClick={() => onSelectPayment(p)}
                  >
                    <td className="py-3.5 px-5 font-mono">
                      <span className="font-bold text-purple-700 block">{p.id}</span>
                      <span className="text-[10px] text-slate-400">{p.reference}</span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg text-[11px] font-bold mr-1.5">
                        {p.partnerCode}
                      </span>
                      {p.partnerName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{p.date}</td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-purple-900 font-['JetBrains_Mono']">
                      {p.amount.toLocaleString()} FCFA
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{p.paymentMethod}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPayment(p);
                        }}
                        className="rounded-xl bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 cursor-pointer transition-colors"
                        title="Ouvrir le reçu de paiement"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredPayments.map((p) => (
              <div
                key={p.id}
                onClick={() => onSelectPayment(p)}
                className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-2.5 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-lg">
                      {p.id}
                    </span>
                    <h3 className="font-bold text-slate-900 mt-1.5">
                      {p.partnerCode} — {p.partnerName}
                    </h3>
                    <p className="text-xs text-slate-500">{p.paymentMethod}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-purple-900 font-['JetBrains_Mono']">
                      {p.amount.toLocaleString()} F
                    </span>
                    <span className="block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 mt-1">
                      {p.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2.5 text-slate-500">
                  <span>Réf : {p.reference}</span>
                  <span>Date : {p.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
