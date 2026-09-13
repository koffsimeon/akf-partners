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
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Gestion des Entités AKF
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Administration des partenaires, clients, commandes et paiements
          </p>
        </div>

        {/* Sub-Tabs Pills */}
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-2xs">
          <button
            onClick={() => setSubTab('PARTNERS')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold whitespace-nowrap transition-colors ${
              subTab === 'PARTNERS'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Partenaires ({partners.length})
          </button>
          <button
            onClick={() => setSubTab('CLIENTS')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold whitespace-nowrap transition-colors ${
              subTab === 'CLIENTS'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            Clients ({clients.length})
          </button>
          <button
            onClick={() => setSubTab('ORDERS')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold whitespace-nowrap transition-colors ${
              subTab === 'ORDERS'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            Commandes ({orders.length})
          </button>
          <button
            onClick={() => setSubTab('PAYMENTS')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold whitespace-nowrap transition-colors ${
              subTab === 'PAYMENTS'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            Paiements ({payments.length})
          </button>
        </div>
      </div>

      {/* Relational Filter Banner (if coming from a related click) */}
      {filterId && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900 border border-emerald-200">
          <div className="flex items-center gap-2">
            <span className="font-bold">Filtre relationnel actif :</span>
            <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-200 font-bold">
              {filterId}
            </span>
          </div>
          {onClearFilterId && (
            <button
              onClick={onClearFilterId}
              className="text-xs font-semibold text-emerald-800 hover:underline"
            >
              Afficher tout ✕
            </button>
          )}
        </div>
      )}

      {/* Controls Bar (Search + Specific Filters + Add Button) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={`Rechercher dans ${
                subTab === 'PARTNERS'
                  ? 'les partenaires...'
                  : subTab === 'CLIENTS'
                  ? 'les clients...'
                  : subTab === 'ORDERS'
                  ? 'les commandes...'
                  : 'les paiements...'
              }`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:border-slate-900 outline-hidden"
            />
          </div>

          {subTab === 'PARTNERS' && (
            <div className="flex items-center gap-2">
              <select
                value={rankFilter}
                onChange={(e) => setRankFilter(e.target.value)}
                className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 bg-white"
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
                className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 bg-white"
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
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors shadow-2xs"
            >
              <Plus className="h-4 w-4" />
              + Créer Partenaire
            </button>
          )}
          {subTab === 'CLIENTS' && (
            <button
              onClick={() => onOpenCreate('CLIENT')}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 transition-colors shadow-2xs"
            >
              <Plus className="h-4 w-4" />
              + Créer Client
            </button>
          )}
          {subTab === 'ORDERS' && (
            <button
              onClick={() => onOpenCreate('ORDER')}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl bg-amber-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-800 transition-colors shadow-2xs"
            >
              <Plus className="h-4 w-4" />
              + Nouvelle Commande
            </button>
          )}
          {subTab === 'PAYMENTS' && (
            <button
              onClick={() => onOpenCreate('PAYMENT')}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl bg-purple-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-purple-800 transition-colors shadow-2xs"
            >
              <Plus className="h-4 w-4" />
              + Émettre Paiement
            </button>
          )}
        </div>
      </div>

      {/* 8.1 PARTENAIRES */}
      {subTab === 'PARTNERS' && (
        <div className="space-y-3">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Code / ID</th>
                  <th className="py-3.5 px-4">Nom & Prénom</th>
                  <th className="py-3.5 px-4">Téléphone</th>
                  <th className="py-3.5 px-4">Grade & Vague</th>
                  <th className="py-3.5 px-4 text-right">CA Cumulé</th>
                  <th className="py-3.5 px-4 text-center">Clients</th>
                  <th className="py-3.5 px-4 text-center">Cmds</th>
                  <th className="py-3.5 px-4 text-right">Commissions</th>
                  <th className="py-3.5 px-4 text-right">Solde</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredPartners.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => onSelectPartner(p)}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {p.code}
                      <span className="text-[10px] text-slate-400 block font-normal">{p.id}</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {p.fullName}
                      <span
                        className={`inline-block ml-2 px-1.5 py-0.2 rounded text-[10px] ${
                          p.status === 'Actif'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{p.phone}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          p.rank === 'Signature'
                            ? 'bg-purple-100 text-purple-800'
                            : p.rank === 'Excellence'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.rank === 'Ambassador'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        <Award className="h-3 w-3" />
                        {p.rank}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{p.wave}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 font-['JetBrains_Mono']">
                      {p.ca.toLocaleString()} F
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">{p.clientCount}</td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">{p.orderCount}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600 font-['JetBrains_Mono']">
                      {p.totalCommission.toLocaleString()} F
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-emerald-800 font-['JetBrains_Mono']">
                      {p.balance.toLocaleString()} F
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPartner(p);
                          }}
                          className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                          title="Ouvrir la fiche"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {onEditPartner && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditPartner(p);
                            }}
                            className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                            title="Modifier ce partenaire"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredPartners.map((p) => (
              <div
                key={p.id}
                onClick={() => onSelectPartner(p)}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {p.code}
                    </span>
                    <h3 className="font-bold text-slate-900 mt-1">{p.fullName}</h3>
                    <p className="text-xs text-slate-500">{p.phone}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
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
                        className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                        title="Modifier"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">CA</span>
                    <strong className="font-['JetBrains_Mono']">{p.ca.toLocaleString()} F</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Commissions</span>
                    <strong className="text-emerald-600 font-['JetBrains_Mono']">
                      {p.totalCommission.toLocaleString()} F
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Solde</span>
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
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">ID Client</th>
                  <th className="py-3.5 px-4">Nom & Prénom</th>
                  <th className="py-3.5 px-4">Téléphone</th>
                  <th className="py-3.5 px-4">WhatsApp</th>
                  <th className="py-3.5 px-4">Partenaire Affilié</th>
                  <th className="py-3.5 px-4">Type Client</th>
                  <th className="py-3.5 px-4 text-center">Commandes</th>
                  <th className="py-3.5 px-4 text-right">CA Cumulé</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredClients.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => onSelectClient(c)}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">{c.id}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{c.fullName}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{c.phone}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{c.whatsapp || '-'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {c.partnerCode ? `${c.partnerCode} (${c.partnerName})` : <span className="text-slate-400 font-bold">DIRECT AKF</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.clientType === 'PARTENAIRE'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {c.clientType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-900">{c.orderCount}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 font-['JetBrains_Mono']">
                      {c.totalCa.toLocaleString()} F
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectClient(c);
                        }}
                        className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"
                        title="Ouvrir la fiche client"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredClients.map((c) => (
              <div
                key={c.id}
                onClick={() => onSelectClient(c)}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {c.id}
                    </span>
                    <h3 className="font-bold text-slate-900 mt-1">{c.fullName}</h3>
                    <p className="text-xs text-slate-500">{c.phone}</p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      c.clientType === 'PARTENAIRE' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {c.clientType}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2 text-slate-600">
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
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">ID</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Client</th>
                  <th className="py-3.5 px-4">Partenaire</th>
                  <th className="py-3.5 px-4">Produit</th>
                  <th className="py-3.5 px-4 text-center">Qté</th>
                  <th className="py-3.5 px-4 text-right">Total</th>
                  <th className="py-3.5 px-4 text-center">Rang Prem.</th>
                  <th className="py-3.5 px-4 text-right">Commission</th>
                  <th className="py-3.5 px-4 text-center">Statut Commande</th>
                  <th className="py-3.5 px-4 text-center">Statut Comm.</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredOrders.map((o) => (
                  <tr
                    key={o.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => onSelectOrder(o)}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{o.id}</td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{o.date}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{o.clientName}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {o.partnerCode ? o.partnerCode : <span className="text-slate-400">DIRECT AKF</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900">{o.productName}</span>
                      {o.isPremium && (
                        <span className="ml-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                          ★ Prem
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">{o.quantity}</td>
                    <td className="py-3 px-4 text-right font-extrabold text-slate-900 font-['JetBrains_Mono']">
                      {o.totalAmount.toLocaleString()} F
                    </td>
                    <td className="py-3 px-4 text-center">
                      {o.premiumRankForClient ? (
                        <span className="font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full text-[10px]">
                          Rang #{o.premiumRankForClient}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700 font-['JetBrains_Mono']">
                      {o.commissionAmount > 0 ? `${o.commissionAmount.toLocaleString()} F` : '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          o.orderStatus === 'Livrée'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {o.orderStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          o.commissionStatus === 'Validée'
                            ? 'bg-emerald-100 text-emerald-800'
                            : o.commissionStatus === 'Payée'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {o.commissionStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectOrder(o);
                        }}
                        className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"
                        title="Ouvrir la fiche commande"
                      >
                        <Eye className="h-4 w-4" />
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
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-slate-900">{o.id}</span>
                    <h3 className="font-bold text-slate-900 mt-0.5">{o.productName}</h3>
                    <p className="text-xs text-slate-500">Client : {o.clientName}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-slate-900 font-['JetBrains_Mono']">
                      {o.totalAmount.toLocaleString()} F
                    </span>
                    <span
                      className={`block text-[10px] font-bold px-1.5 py-0.5 rounded mt-1 ${
                        o.orderStatus === 'Livrée' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {o.orderStatus}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2 text-slate-600">
                  <span>Partenaire : <strong>{o.partnerCode || 'DIRECT AKF'}</strong></span>
                  <span className="font-bold text-emerald-700">
                    Comm : {o.commissionAmount.toLocaleString()} FCFA
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
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">ID</th>
                  <th className="py-3.5 px-4">Partenaire</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4 text-right">Montant Réglé</th>
                  <th className="py-3.5 px-4">Mode de Paiement</th>
                  <th className="py-3.5 px-4">Référence</th>
                  <th className="py-3.5 px-4 text-center">Statut</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredPayments.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => onSelectPayment(p)}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-purple-700">{p.id}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {p.partnerCode} — {p.partnerName}
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{p.date}</td>
                    <td className="py-3 px-4 text-right font-extrabold text-purple-900 font-['JetBrains_Mono']">
                      {p.amount.toLocaleString()} FCFA
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{p.paymentMethod}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{p.reference}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPayment(p);
                        }}
                        className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"
                        title="Ouvrir le reçu de paiement"
                      >
                        <Eye className="h-4 w-4" />
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
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                      {p.id}
                    </span>
                    <h3 className="font-bold text-slate-900 mt-1">{p.partnerCode} — {p.partnerName}</h3>
                    <p className="text-xs text-slate-500">{p.paymentMethod}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-purple-900 font-['JetBrains_Mono']">
                      {p.amount.toLocaleString()} F
                    </span>
                    <span className="block text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 mt-1">
                      {p.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2 text-slate-500">
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
