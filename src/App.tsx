import React, { useState, useEffect } from 'react';
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
  ProductModal,
  WaveModal,
} from './components/Modals';
import { PartnerQuickMobileView } from './components/PartnerQuickMobileView';
import { AuthView } from './components/auth/AuthView';
import {
  Client,
  Order,
  Partner,
  Payment,
  Product,
  WaveConfig,
} from './types';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { User } from '@supabase/supabase-js';
import {
  getSupabaseSession,
  getUserProfile,
  subscribeToAuthStateChange,
  signOutSupabase,
  UserProfile,
} from './services/supabase';
import { useAkfData } from './hooks/useAkfData';

export default function App() {
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [currentTab, setCurrentTab] = useState<TabType>('ACCUEIL');

  // Relational Navigation & Sub-views
  const [managementSubTab, setManagementSubTab] = useState<ManagementSubTab>('PARTNERS');
  const [managementFilterId, setManagementFilterId] = useState<string | null>(null);
  const [searchInitialQuery, setSearchInitialQuery] = useState('');

  // Hook modulaire de gestion des données (Clean Architecture)
  const {
    loading,
    error,
    toast,
    showToast,
    partners,
    clients,
    orders,
    payments,
    products,
    config,
    syncState,
    auditLogs,
    isSyncing,
    dataSourceMode,
    fetchData,
    handleSyncNow,
    handleRecalculate,
    handleRefreshLogs,
    handleRunDiagnostic,
    handleCreatePartner,
    handleUpdatePartner,
    handleCreateClient,
    handleUpdateClient,
    handleDeleteClient,
    handleCreateOrder,
    handleDeleteOrder,
    handleUpdateOrderStatus,
    handlePromotePartner,
    handleCreatePayment,
    handleSaveProduct,
    handleDeleteProduct,
    handleSaveWave,
    handleActivateWave,
  } = useAkfData();

  // Modals state
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

  const [productModal, setProductModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    product?: Product | null;
  }>({ isOpen: false, mode: 'create' });

  const [waveModal, setWaveModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    wave?: WaveConfig | null;
  }>({ isOpen: false, mode: 'create' });

  // Cycle de vie de l'authentification Supabase (Gatekeeper)
  useEffect(() => {
    let mounted = true;

    async function checkInitialSession() {
      try {
        const session = await getSupabaseSession();
        if (mounted) {
          if (session?.user) {
            setSessionUser(session.user);
            const profile = await getUserProfile(session.user.id);
            if (mounted) setUserProfile(profile);
          } else {
            setSessionUser(null);
            setUserProfile(null);
          }
        }
      } catch (err) {
        console.error('Erreur lors de la vérification de la session:', err);
      } finally {
        if (mounted) setAuthChecking(false);
      }
    }

    checkInitialSession();

    const subscription = subscribeToAuthStateChange(async (user) => {
      if (!mounted) return;
      setSessionUser(user);
      if (user) {
        const profile = await getUserProfile(user.id);
        if (mounted) setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  // Déclenchement de la récupération des données UNIQUEMENT si l'utilisateur est authentifié
  useEffect(() => {
    if (sessionUser) {
      fetchData();
    }
  }, [sessionUser, fetchData]);

  // Déconnexion avec purge de sécurité de la mémoire vive
  const handleSignOut = async () => {
    try {
      await signOutSupabase();
      setSessionUser(null);
      setUserProfile(null);
      showToast('Session fermée avec succès. Cockpit verrouillé.');
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la déconnexion', 'error');
    }
  };

  // Sauts relationnels
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

  const handleOpenQuickCreate = (type: 'PARTNER' | 'CLIENT' | 'ORDER' | 'PAYMENT' | 'PRODUCT') => {
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
    if (type === 'PRODUCT') setProductModal({ isOpen: true, mode: 'create', product: null });
  };

  // 1. Écran de chargement lors du contrôle de session
  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Contrôle d'accès sécurisé...
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Vérification de la session Supabase
          </p>
        </div>
      </div>
    );
  }

  // 2. Barrière de sécurité absolue : Si l'utilisateur n'est pas connecté, afficher UNIQUEMENT AuthView
  if (!sessionUser) {
    return (
      <AuthView
        onLoginSuccess={async (email) => {
          const session = await getSupabaseSession();
          if (session?.user) {
            setSessionUser(session.user);
            const prof = await getUserProfile(session.user.id);
            setUserProfile(prof);
          } else {
            setSessionUser({ email } as User);
          }
          showToast(`Connexion établie : Bienvenue ${email}`);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-['Plus_Jakarta_Sans'] flex flex-col">
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

      {/* Navigation Header & Sidebar / Drawer */}
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
        onSignOut={handleSignOut}
        currentUserEmail={sessionUser?.email || undefined}
        currentUserRole={userProfile?.role || 'ADMIN'}
        dataSourceMode={dataSourceMode}
      />

      {/* Main Content Area */}
      <main className="flex-1 md:pl-64 pt-3 md:pt-6 px-3 sm:px-4 md:px-8 max-w-7xl w-full mx-auto pb-12 md:pb-16">
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
              className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 cursor-pointer"
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
                products={products}
                initialSubTab={managementSubTab}
                filterId={managementFilterId}
                onOpenCreate={handleOpenQuickCreate}
                onSelectPartner={(p) => setPartnerModal({ isOpen: true, mode: 'view', partner: p })}
                onEditPartner={(p) => setPartnerModal({ isOpen: true, mode: 'edit', partner: p })}
                onSelectClient={(c) => setClientModal({ isOpen: true, mode: 'view', client: c })}
                onSelectOrder={(o) => setOrderModal({ isOpen: true, mode: 'view', order: o })}
                onSelectPayment={(pay) => setPaymentModal({ isOpen: true, mode: 'view', payment: pay })}
                onSelectProduct={(p) => setProductModal({ isOpen: true, mode: 'edit', product: p })}
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
                onOpenWaveModal={() => setWaveModal({ isOpen: true, mode: 'create', wave: null })}
                onActivateWave={handleActivateWave}
              />
            )}

            {/* Zone 6 : FICHE EXPRESS MOBILE */}
            {currentTab === 'EXPRESS' && (
              <PartnerQuickMobileView
                partners={partners}
                orders={orders}
                payments={payments}
                clients={clients}
                config={config}
                onInitiatePayment={(p) =>
                  setPaymentModal({
                    isOpen: true,
                    mode: 'create',
                    payment: null,
                    preselectedPartner: p,
                  })
                }
                onSelectPartnerFull={(p) => setPartnerModal({ isOpen: true, mode: 'view', partner: p })}
                onSelectOrder={(o) => setOrderModal({ isOpen: true, mode: 'view', order: o })}
                onOpenCreatePartner={() => setPartnerModal({ isOpen: true, mode: 'create', partner: null })}
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

      <ProductModal
        isOpen={productModal.isOpen}
        onClose={() => setProductModal({ ...productModal, isOpen: false })}
        product={productModal.product}
        mode={productModal.mode}
        onSave={handleSaveProduct}
        onDelete={handleDeleteProduct}
      />

      <WaveModal
        isOpen={waveModal.isOpen}
        onClose={() => setWaveModal({ ...waveModal, isOpen: false })}
        wave={waveModal.wave}
        mode={waveModal.mode}
        onSave={handleSaveWave}
      />
    </div>
  );
}
