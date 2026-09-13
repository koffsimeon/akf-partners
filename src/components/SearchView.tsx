import React, { useState, useEffect } from 'react';
import {
  Search,
  User,
  Users,
  ShoppingBag,
  CreditCard,
  Phone,
  ArrowRight,
  Filter,
  CheckCircle2,
  ChevronRight,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Client, Order, Partner, Payment } from '../types';
import { normalizePhone } from '../engine/akfEngine';

interface SearchViewProps {
  partners: Partner[];
  clients: Client[];
  orders: Order[];
  payments: Payment[];
  initialQuery?: string;
  onSelectPartner: (partner: Partner) => void;
  onSelectClient: (client: Client) => void;
  onSelectOrder: (order: Order) => void;
  onSelectPayment: (payment: Payment) => void;
}

export function SearchView({
  partners: rawPartners,
  clients: rawClients,
  orders: rawOrders,
  payments: rawPayments,
  initialQuery = '',
  onSelectPartner,
  onSelectClient,
  onSelectOrder,
  onSelectPayment,
}: SearchViewProps) {
  const partners = Array.isArray(rawPartners) ? rawPartners : [];
  const clients = Array.isArray(rawClients) ? rawClients : [];
  const orders = Array.isArray(rawOrders) ? rawOrders : [];
  const payments = Array.isArray(rawPayments) ? rawPayments : [];

  const [query, setQuery] = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PARTNER' | 'CLIENT' | 'ORDER' | 'PAYMENT'>('ALL');
  const [selectedEntity, setSelectedEntity] = useState<{
    type: 'PARTNER' | 'CLIENT';
    item: Partner | Client;
  } | null>(null);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  const norm = normalizePhone(query);
  const trimmedQ = query.trim().toLowerCase();
  const phoneCanonical = norm.canonical;

  // Détection automatique du type d'identifiant
  const detectedType = /^akf-?\d+$/i.test(trimmedQ)
    ? 'PARTENAIRE (AKFxxx)'
    : /^cl\d+$/i.test(trimmedQ)
    ? 'CLIENT (CLxxx)'
    : /^cmd\d+$/i.test(trimmedQ)
    ? 'COMMANDE (CMDxxx)'
    : /^pay\d+$/i.test(trimmedQ)
    ? 'PAIEMENT (PAYxxx)'
    : phoneCanonical
    ? `TÉLÉPHONE (+229 normalisé)`
    : null;

  // Filtrage multi-entités
  const filteredPartners = partners.filter((p) => {
    if (activeFilter !== 'ALL' && activeFilter !== 'PARTNER') return false;
    if (!trimmedQ) return true;
    return (
      p.code.toLowerCase().includes(trimmedQ) ||
      p.id.toLowerCase().includes(trimmedQ) ||
      p.fullName.toLowerCase().includes(trimmedQ) ||
      (phoneCanonical && p.phoneCanonical.includes(phoneCanonical))
    );
  });

  const filteredClients = clients.filter((c) => {
    if (activeFilter !== 'ALL' && activeFilter !== 'CLIENT') return false;
    if (!trimmedQ) return true;
    return (
      c.id.toLowerCase().includes(trimmedQ) ||
      c.fullName.toLowerCase().includes(trimmedQ) ||
      (c.partnerCode && c.partnerCode.toLowerCase().includes(trimmedQ)) ||
      (phoneCanonical && c.phoneCanonical.includes(phoneCanonical))
    );
  });

  const filteredOrders = orders.filter((o) => {
    if (activeFilter !== 'ALL' && activeFilter !== 'ORDER') return false;
    if (!trimmedQ) return true;
    return (
      o.id.toLowerCase().includes(trimmedQ) ||
      o.clientName.toLowerCase().includes(trimmedQ) ||
      o.productName.toLowerCase().includes(trimmedQ) ||
      (o.partnerCode && o.partnerCode.toLowerCase().includes(trimmedQ))
    );
  });

  const filteredPayments = payments.filter((p) => {
    if (activeFilter !== 'ALL' && activeFilter !== 'PAYMENT') return false;
    if (!trimmedQ) return true;
    return (
      p.id.toLowerCase().includes(trimmedQ) ||
      p.partnerName.toLowerCase().includes(trimmedQ) ||
      p.partnerCode.toLowerCase().includes(trimmedQ) ||
      p.reference.toLowerCase().includes(trimmedQ)
    );
  });

  const totalResults =
    filteredPartners.length + filteredClients.length + filteredOrders.length + filteredPayments.length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
          Recherche Universelle & Arbre Relationnel
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Tapez un ID (AKF-023, CL024, CMD047, PAY015), un nom ou un numéro de téléphone béninois
        </p>
      </div>

      {/* Main Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex : AKF-001, CL001, CMD003, 97 12 34 56, Koffi..."
            className="w-full rounded-xl border border-slate-200 pl-12 pr-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-hidden font-['Plus_Jakarta_Sans']"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-3 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              Effacer
            </button>
          )}
        </div>

        {/* Auto Detection Badge */}
        {detectedType && (
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Format reconnu automatiquement :</span>
            <span className="font-bold text-slate-900 font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200">
              {detectedType}
            </span>
            {phoneCanonical && (
              <span className="text-slate-400 font-mono text-[11px]">
                (Normalisé : {phoneCanonical})
              </span>
            )}
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
          {[
            { id: 'ALL', label: `Tout (${totalResults})` },
            { id: 'PARTNER', label: `Partenaires (${filteredPartners.length})` },
            { id: 'CLIENT', label: `Clients (${filteredClients.length})` },
            { id: 'ORDER', label: `Commandes (${filteredOrders.length})` },
            { id: 'PAYMENT', label: `Paiements (${filteredPayments.length})` },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id as any)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                activeFilter === f.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Relational Inspection Panel (if an entity is clicked for relationship exploration) */}
      {selectedEntity && (
        <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/30 p-5 shadow-sm space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-emerald-200/60 pb-3">
            <div className="flex items-center gap-2.5">
              <Layers className="h-5 w-5 text-emerald-700" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Arbre relationnel : {selectedEntity.type === 'PARTNER' ? (selectedEntity.item as Partner).code : (selectedEntity.item as Client).id}
                </h3>
                <p className="text-xs text-slate-500">
                  PARTENAIRE ↓ CLIENTS ↓ COMMANDES ↓ COMMISSIONS ↓ PAIEMENTS
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedEntity(null)}
              className="text-xs text-slate-500 hover:text-slate-700 font-semibold"
            >
              Fermer l'arbre ✕
            </button>
          </div>

          {selectedEntity.type === 'PARTNER' && (
            <div className="space-y-3">
              {/* Partner summary */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-xl border border-emerald-200">
                <div>
                  <span className="text-xs font-bold text-slate-900">{(selectedEntity.item as Partner).fullName}</span>
                  <span className="text-xs text-slate-500 ml-2 font-mono">{(selectedEntity.item as Partner).phone}</span>
                </div>
                <div className="text-xs">
                  <span className="text-slate-500 mr-1">Solde disponible :</span>
                  <strong className="text-emerald-700 font-['JetBrains_Mono']">
                    {(selectedEntity.item as Partner).balance.toLocaleString()} FCFA
                  </strong>
                </div>
              </div>

              {/* Related Clients */}
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  1. Clients affiliés ({clients.filter((c) => c.partnerId === selectedEntity.item.id).length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {clients
                    .filter((c) => c.partnerId === selectedEntity.item.id)
                    .map((c) => (
                      <div
                        key={c.id}
                        onClick={() => onSelectClient(c)}
                        className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 cursor-pointer text-xs"
                      >
                        <div className="font-bold text-slate-900">{c.fullName}</div>
                        <div className="text-slate-500 font-mono text-[11px]">{c.id} • {c.orderCount} cmd(s)</div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Related Orders */}
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  2. Commandes & Commissions
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {orders
                    .filter((o) => o.partnerId === selectedEntity.item.id)
                    .map((o) => (
                      <div
                        key={o.id}
                        onClick={() => onSelectOrder(o)}
                        className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-amber-400 cursor-pointer text-xs flex justify-between items-center"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{o.id} — {o.productName}</div>
                          <div className="text-slate-500 text-[11px]">Client : {o.clientName}</div>
                        </div>
                        <div className="text-right font-['JetBrains_Mono']">
                          <div className="font-bold text-slate-900">{o.totalAmount.toLocaleString()} F</div>
                          <div className="text-emerald-600 text-[11px]">Comm : +{o.commissionAmount.toLocaleString()} F</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Related Payments */}
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  3. Historique des Paiements
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {payments
                    .filter((p) => p.partnerId === selectedEntity.item.id)
                    .map((p) => (
                      <div
                        key={p.id}
                        onClick={() => onSelectPayment(p)}
                        className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-purple-400 cursor-pointer text-xs flex justify-between items-center"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{p.id} — {p.date}</div>
                          <div className="text-slate-500 text-[11px]">{p.paymentMethod}</div>
                        </div>
                        <span className="font-extrabold text-purple-700 font-['JetBrains_Mono']">
                          {p.amount.toLocaleString()} FCFA
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Groups */}
      <div className="space-y-6">
        {/* Partenaires */}
        {(activeFilter === 'ALL' || activeFilter === 'PARTNER') && filteredPartners.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <User className="h-4 w-4 text-emerald-600" />
              <span>Partenaires ({filteredPartners.length})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredPartners.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded-md text-slate-800">
                          {p.code}
                        </span>
                        <h4 className="font-bold text-slate-900">{p.fullName}</h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {p.phone}
                      </p>
                    </div>
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
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block">CA</span>
                      <strong className="text-xs text-slate-900 font-['JetBrains_Mono']">
                        {p.ca.toLocaleString()} F
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Commissions</span>
                      <strong className="text-xs text-emerald-600 font-['JetBrains_Mono']">
                        {p.totalCommission.toLocaleString()} F
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Solde</span>
                      <strong className="text-xs text-emerald-800 font-['JetBrains_Mono']">
                        {p.balance.toLocaleString()} F
                      </strong>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onSelectPartner(p)}
                      className="flex-1 rounded-xl bg-slate-50 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 text-center"
                    >
                      Ouvrir Fiche
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedEntity({ type: 'PARTNER', item: p })}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 flex items-center gap-1"
                    >
                      Arbre relationnel <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clients */}
        {(activeFilter === 'ALL' || activeFilter === 'CLIENT') && filteredClients.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Users className="h-4 w-4 text-blue-600" />
              <span>Clients ({filteredClients.length})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredClients.map((c) => (
                <div
                  key={c.id}
                  onClick={() => onSelectClient(c)}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-blue-300 cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">
                          {c.id}
                        </span>
                        <h4 className="font-bold text-slate-900">{c.fullName}</h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        c.clientType === 'PARTENAIRE' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {c.clientType}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs border-t border-slate-100 pt-2 text-slate-600">
                    <span>Partenaire : <strong>{c.partnerCode || 'DIRECT AKF'}</strong></span>
                    <span>Commandes : <strong>{c.orderCount}</strong> (CA : {c.totalCa.toLocaleString()} F)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Commandes */}
        {(activeFilter === 'ALL' || activeFilter === 'ORDER') && filteredOrders.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <ShoppingBag className="h-4 w-4 text-amber-600" />
              <span>Commandes ({filteredOrders.length})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredOrders.map((o) => (
                <div
                  key={o.id}
                  onClick={() => onSelectOrder(o)}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-amber-300 cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-900">{o.id}</span>
                      <h4 className="font-bold text-slate-900 mt-0.5">{o.productName}</h4>
                      <p className="text-xs text-slate-500">Client : {o.clientName}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-extrabold text-slate-900 font-['JetBrains_Mono']">
                        {o.totalAmount.toLocaleString()} FCFA
                      </div>
                      <span
                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md mt-1 ${
                          o.orderStatus === 'Livrée' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {o.orderStatus}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-emerald-700 bg-emerald-50/60 p-2 rounded-lg flex justify-between items-center">
                    <span>Partenaire : {o.partnerCode || 'DIRECT AKF'}</span>
                    <span className="font-bold">Commission : {o.commissionAmount.toLocaleString()} FCFA</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Paiements */}
        {(activeFilter === 'ALL' || activeFilter === 'PAYMENT') && filteredPayments.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <CreditCard className="h-4 w-4 text-purple-600" />
              <span>Paiements ({filteredPayments.length})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredPayments.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onSelectPayment(p)}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-purple-300 cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-900">{p.id}</span>
                      <h4 className="font-bold text-slate-900 mt-0.5">{p.partnerCode} — {p.partnerName}</h4>
                      <p className="text-xs text-slate-500">{p.paymentMethod} • {p.date}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-extrabold text-purple-800 font-['JetBrains_Mono']">
                        {p.amount.toLocaleString()} FCFA
                      </div>
                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 mt-1">
                        {p.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {totalResults === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center bg-white">
            <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">Aucun résultat trouvé</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Essayez un autre mot-clé, un identifiant (ex: AKF-001) ou un numéro de téléphone avec préfixe béninois.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
