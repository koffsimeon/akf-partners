import React, { useState, useEffect, useCallback } from 'react';
import {
  Navigation,
  TabType,
} from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { SearchView } from './components/SearchView';
import { ManagementView, ManagementSubTab } from './components/ManagementView';
import { AnalysisView } from './components/AnalysisView';
import { SystemView } from './components/SystemView';
import {
  PartnerModal,
  ClientModal,
  OrderModal,
  PaymentModal,
} from './components/Modals';
import {
  Client,
  DataSourceMode,
  Order,
  Partner,
  Payment,
  Product,
  SyncState,
  SystemConfig,
  AuditLog,
  DiagnosticResult,
} from './types';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('ACCUEIL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Entities State
  const [partners, setPartners] = useState<Partner[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [config, setConfig] = useState<SystemConfig>({
    ranks: [
      { name: 'Neo', minCa: 0, minOrders: 0, commissionRate: 0.06 },
      { name: 'Ambassador', minCa: 100000, minOrders: 8, commissionRate: 0.08 },
      { name: 'Excellence', minCa: 300000, minOrders: 20, commissionRate: 0.1 },
      { name: 'Signature', minCa: 800000, minOrders: 50, commissionRate: 0.12 },
    ],
    maxPremiumOrdersForCommission: 3,
    minimumPayment: 5000,
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
  });
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'SYNCHRONISE',
    lastSync: new Date().toISOString(),
    pendingCount: 0,
    errorCount: 0,
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>('SHEETS_LIVE');

  // Relational Navigation & Sub-views
  const [managementSubTab, setManagementSubTab] = useState<ManagementSubTab>('PARTNERS');
  const [managementFilterId, setManagementFilterId] = useState<string | null>(null);
  const [searchInitialQuery, setSearchInitialQuery] = useState('');

  // Modals
  const [partnerModal, setPartnerModal] = useState<{
    isOpen: boolean;
    mode: 'view' | 'create' | 'edit';
    partner?: Partner | null;
  }>({ isOpen: false, mode: 'create' });

  const [clientModal, setClientModal] = useState<{
    isOpen: boolean;
    mode: 'view' | 'create';
    client?: Client | null;
  }>({ isOpen: false, mode: 'create' });

  const [orderModal, setOrderModal] = useState<{
    isOpen: boolean;
    mode: 'view' | 'create';
    order?: Order | null;
  }>({ isOpen: false, mode: 'create' });

  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    mode: 'view' | 'create';
    payment?: Payment | null;
    preselectedPartner?: Partner | null;
  }>({ isOpen: false, mode: 'create' });

  // Notification Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch all initial data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const fetchSafeArray = async <T,>(url: string): Promise<T[]> => {
        try {
          const r = await fetch(url);
          const data = await r.json();
          return Array.isArray(data) ? data : [];
        } catch {
          return [];
        }
      };

      const [
        partnersRes,
        clientsRes,
        ordersRes,
        paymentsRes,
        productsRes,
        configRes,
        syncRes,
        logsRes,
        sheetsStatusRes,
      ] = await Promise.all([
        fetchSafeArray<Partner>('/api/partners'),
        fetchSafeArray<Client>('/api/clients'),
        fetchSafeArray<Order>('/api/orders'),
        fetchSafeArray<Payment>('/api/payments'),
        fetchSafeArray<Product>('/api/products'),
        fetch('/api/config').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/sync-state').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetchSafeArray<AuditLog>('/api/logs'),
        fetch('/api/sheets/status').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      setPartners(partnersRes);
      setClients(clientsRes);
      setOrders(ordersRes);
      setPayments(paymentsRes);
      setProducts(productsRes);
      if (configRes && typeof configRes === 'object' && !configRes.error) {
        setConfig(configRes);
      }
      if (syncRes && typeof syncRes === 'object' && !syncRes.error) {
        setSyncState(syncRes);
      }
      setAuditLogs(logsRes);
      if (sheetsStatusRes && sheetsStatusRes.mode) {
        setDataSourceMode(sheetsStatusRes.mode);
      }
    } catch (err: any) {
      console.error('Failed to load initial data:', err);
      setError('Impossible de joindre le serveur AKF. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Synchronisation
  const handleSyncNow = async () => {
    try {
      setIsSyncing(true);
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la synchronisation');
      setSyncState(data.syncState);
      showToast('Synchronisation avec Google Sheets effectuée.');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Erreur synchronisation', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Recalcul Global
  const handleRecalculate = async () => {
    const res = await fetch('/api/recalculate', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors du recalcul');
    await fetchData();
    showToast(`Recalcul terminé : ${data.itemsCorrected} éléments ajustés.`);
    return data;
  };

  // Actualisation ciblée des journaux d'audit (sans rechargement global ni démontage d'écran)
  const handleRefreshLogs = useCallback(async () => {
    try {
      const logsRes = await fetch('/api/logs').then((r) => r.json());
      setAuditLogs(logsRes);
    } catch (err) {
      console.error('Échec de rafraîchissement des journaux d’audit:', err);
    }
  }, []);

  // Diagnostic
  const handleRunDiagnostic = async (): Promise<DiagnosticResult> => {
    const res = await fetch('/api/diagnostic');
    const data = await res.json();
    return data;
  };

  // Actions de création et modification
  const handleCreatePartner = async (formData: { fullName: string; phone: string; whatsapp?: string }) => {
    const res = await fetch('/api/partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast(`Partenaire ${data.code} créé avec succès !`);
    await fetchData();
  };

  const handleUpdatePartner = async (id: string, updates: Partial<Partner>) => {
    const res = await fetch(`/api/partners/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast(`Partenaire ${data.code} mis à jour avec succès !`);
    await fetchData();
  };

  const handleCreateClient = async (formData: {
    fullName: string;
    phone: string;
    whatsapp?: string;
    partnerId?: string;
  }) => {
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast(`Client ${data.id} créé avec succès !`);
    await fetchData();
  };

  const handleUpdateClient = async (clientId: string, updates: Partial<Client>) => {
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message || `Client ${clientId} mis à jour avec succès !`);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message || `Client ${clientId} supprimé avec succès !`);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleCreateOrder = async (formData: {
    clientId: string;
    productId: string;
    quantity: number;
    unitPrice?: number;
    date?: string;
  }) => {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast(`Commande ${data.id} enregistrée avec succès !`);
    await fetchData();
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message || `Commande ${orderId} supprimée avec succès !`);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, orderStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message || `Statut de la commande ${orderId} mis à jour : ${orderStatus}`);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handlePromotePartner = async (partnerId: string) => {
    try {
      const res = await fetch(`/api/partners/${partnerId}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message || `Promotion confirmée avec succès !`);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleCreatePayment = async (formData: {
    partnerId: string;
    amount: number;
    date?: string;
    paymentMethod: any;
    reference?: string;
    note?: string;
  }) => {
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast(`Paiement ${data.id} de ${data.amount.toLocaleString()} FCFA confirmé !`);
    await fetchData();
  };

  // Relational jumps
  const handleNavigateFromModal = (
    type: 'PARTNER' | 'CLIENT' | 'ORDER' | 'PAYMENT',
    filterId: string
  ) => {
    setManagementFilterId(filterId);
    if (type === 'CLIENT') {
      setManagementSubTab('CLIENTS');
      setCurrentTab('GESTION');
    } else if (type === 'ORDER') {
      setManagementSubTab('ORDERS');
      setCurrentTab('GESTION');
    } else if (type === 'PAYMENT') {
      setManagementSubTab('PAYMENTS');
      setCurrentTab('GESTION');
    } else if (type === 'PARTNER') {
      const p = partners.find((item) => item.id === filterId);
      if (p) {
        setPartnerModal({ isOpen: true, mode: 'view', partner: p });
      }
    }
  };

  const handleOpenQuickCreate = (type: 'PARTNER' | 'CLIENT' | 'ORDER' | 'PAYMENT') => {
    if (type === 'PARTNER') setPartnerModal({ isOpen: true, mode: 'create', partner: null });
    if (type === 'CLIENT') setClientModal({ isOpen: true, mode: 'create', client: null });
    if (type === 'ORDER') setOrderModal({ isOpen: true, mode: 'create', order: null });
    if (type === 'PAYMENT')
      setPaymentModal({
        isOpen: true,
        mode: 'create',
        payment: null,
        preselectedPartner: null,
      });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-['Plus_Jakarta_Sans'] flex flex-col">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-20 md:bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl p-4 shadow-xl border backdrop-blur-md animate-in slide-in-from-bottom-5 ${
            toast.type === 'success'
              ? 'bg-emerald-900/90 text-white border-emerald-700'
              : 'bg-rose-900/90 text-white border-rose-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Navigation Header & Sidebar / Bottom bar */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setManagementFilterId(null);
        }}
        syncState={syncState}
        onSyncNow={handleSyncNow}
        isSyncing={isSyncing}
        onOpenQuickCreate={handleOpenQuickCreate}
        onOpenUniversalSearch={() => {
          setCurrentTab('RECHERCHE');
        }}
        dataSourceMode={dataSourceMode}
      />

      {/* Main Content Area */}
      <main className="flex-1 md:pl-60 pt-4 px-4 md:px-8 max-w-7xl w-full mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-sm font-bold text-slate-700">Chargement du programme AKF Partners...</p>
            <p className="text-xs text-slate-400">Vérification de l'intégrité des données</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-900 max-w-md mx-auto my-12">
            <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
            <h3 className="font-bold text-base">Erreur de connexion</h3>
            <p className="text-xs text-red-700 mt-1">{error}</p>
            <button
              onClick={fetchData}
              className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <>
            {/* Zone 1 : ACCUEIL */}
            {currentTab === 'ACCUEIL' && (
              <DashboardView
                partners={partners}
                clients={clients}
                orders={orders}
                payments={payments}
                syncState={syncState}
                onNavigateToTab={(tab) => setCurrentTab(tab)}
                onOpenQuickCreate={handleOpenQuickCreate}
                onSelectPartner={(p) => setPartnerModal({ isOpen: true, mode: 'view', partner: p })}
                onSelectClient={(c) => setClientModal({ isOpen: true, mode: 'view', client: c })}
                onSelectOrder={(o) => setOrderModal({ isOpen: true, mode: 'view', order: o })}
                onSelectPayment={(pay) => setPaymentModal({ isOpen: true, mode: 'view', payment: pay })}
              />
            )}

            {/* Zone 2 : RECHERCHE */}
            {currentTab === 'RECHERCHE' && (
              <SearchView
                partners={partners}
                clients={clients}
                orders={orders}
                payments={payments}
                initialQuery={searchInitialQuery}
                onSelectPartner={(p) => setPartnerModal({ isOpen: true, mode: 'view', partner: p })}
                onSelectClient={(c) => setClientModal({ isOpen: true, mode: 'view', client: c })}
                onSelectOrder={(o) => setOrderModal({ isOpen: true, mode: 'view', order: o })}
                onSelectPayment={(pay) => setPaymentModal({ isOpen: true, mode: 'view', payment: pay })}
              />
            )}

            {/* Zone 3 : GESTION */}
            {currentTab === 'GESTION' && (
              <ManagementView
                partners={partners}
                clients={clients}
                orders={orders}
                payments={payments}
                initialSubTab={managementSubTab}
                filterId={managementFilterId}
                onOpenCreate={handleOpenQuickCreate}
                onSelectPartner={(p) => setPartnerModal({ isOpen: true, mode: 'view', partner: p })}
                onEditPartner={(p) => setPartnerModal({ isOpen: true, mode: 'edit', partner: p })}
                onSelectClient={(c) => setClientModal({ isOpen: true, mode: 'view', client: c })}
                onSelectOrder={(o) => setOrderModal({ isOpen: true, mode: 'view', order: o })}
                onSelectPayment={(pay) => setPaymentModal({ isOpen: true, mode: 'view', payment: pay })}
                onClearFilterId={() => setManagementFilterId(null)}
              />
            )}

            {/* Zone 4 : ANALYSE */}
            {currentTab === 'ANALYSE' && (
              <AnalysisView
                partners={partners}
                clients={clients}
                orders={orders}
                payments={payments}
                onSelectPartner={(p) => setPartnerModal({ isOpen: true, mode: 'view', partner: p })}
                onSelectOrder={(o) => setOrderModal({ isOpen: true, mode: 'view', order: o })}
                onPromotePartner={handlePromotePartner}
                onInitiatePayment={(p) =>
                  setPaymentModal({
                    isOpen: true,
                    mode: 'create',
                    payment: null,
                    preselectedPartner: p,
                  })
                }
              />
            )}

            {/* Zone 5 : SYSTÈME */}
            {currentTab === 'SYSTEME' && (
              <SystemView
                config={config}
                syncState={syncState}
                auditLogs={auditLogs}
                onTriggerSync={handleSyncNow}
                isSyncing={isSyncing}
                onTriggerRecalculate={handleRecalculate}
                onRunDiagnostic={handleRunDiagnostic}
                onRefreshLogs={handleRefreshLogs}
              />
            )}
          </>
        )}
      </main>

      {/* Global Modals */}
      <PartnerModal
        isOpen={partnerModal.isOpen}
        onClose={() => setPartnerModal({ ...partnerModal, isOpen: false })}
        partner={partnerModal.partner}
        mode={partnerModal.mode}
        onSave={handleCreatePartner}
        onUpdate={handleUpdatePartner}
        onSwitchMode={(mode) => setPartnerModal((prev) => ({ ...prev, mode }))}
        onNavigateTo={handleNavigateFromModal}
        onInitiatePayment={(p) =>
          setPaymentModal({
            isOpen: true,
            mode: 'create',
            payment: null,
            preselectedPartner: p,
          })
        }
      />

      <ClientModal
        isOpen={clientModal.isOpen}
        onClose={() => setClientModal({ ...clientModal, isOpen: false })}
        client={clientModal.client}
        partners={partners}
        mode={clientModal.mode}
        onSave={handleCreateClient}
        onUpdate={handleUpdateClient}
        onDelete={handleDeleteClient}
        onNavigateTo={handleNavigateFromModal}
      />

      <OrderModal
        isOpen={orderModal.isOpen}
        onClose={() => setOrderModal({ ...orderModal, isOpen: false })}
        order={orderModal.order}
        clients={clients}
        products={products}
        config={config}
        mode={orderModal.mode}
        onSave={handleCreateOrder}
        onNavigateTo={handleNavigateFromModal}
        onUpdateStatus={handleUpdateOrderStatus}
        onDelete={handleDeleteOrder}
      />

      <PaymentModal
        isOpen={paymentModal.isOpen}
        onClose={() => setPaymentModal({ ...paymentModal, isOpen: false })}
        payment={paymentModal.payment}
        partners={partners}
        preselectedPartner={paymentModal.preselectedPartner}
        config={config}
        mode={paymentModal.mode}
        onSave={handleCreatePayment}
        onNavigateTo={handleNavigateFromModal}
      />
    </div>
  );
}
