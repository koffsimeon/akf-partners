import React, { useState, useEffect } from 'react';
import {
  Home,
  Search,
  FolderKanban,
  BarChart3,
  Settings,
  RefreshCw,
  Plus,
  UserPlus,
  UserCheck,
  ShoppingBag,
  CreditCard,
  ChevronDown,
  Sparkles,
  Smartphone,
  Package,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { DataSourceMode, SyncState } from '../types';
import { AkfLogo } from './AkfLogo';

export type TabType = 'ACCUEIL' | 'RECHERCHE' | 'GESTION' | 'ANALYSE' | 'SYSTEME' | 'EXPRESS';

interface NavigationProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  syncState: SyncState;
  onSyncNow: () => Promise<void>;
  isSyncing: boolean;
  onOpenQuickCreate: (type: 'PARTNER' | 'CLIENT' | 'ORDER' | 'PAYMENT' | 'PRODUCT') => void;
  onOpenUniversalSearch: () => void;
  onOpenAuth?: () => void;
  onSignOut?: () => void;
  currentUserEmail?: string;
  currentUserRole?: string;
  dataSourceMode?: DataSourceMode;
}

export function Navigation({
  currentTab,
  onSelectTab,
  syncState,
  onSyncNow,
  isSyncing,
  onOpenQuickCreate,
  onOpenUniversalSearch,
  onOpenAuth,
  onSignOut,
  currentUserEmail,
  currentUserRole,
  dataSourceMode = 'SHEETS_LIVE',
}: NavigationProps) {
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);

  // Verrouille le défilement de l'arrière-plan quand le drawer mobile est ouvert
  useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileDrawerOpen]);

  const navItems = [
    { id: 'ACCUEIL', label: 'Accueil', icon: Home, badge: null },
    { id: 'EXPRESS', label: 'Express', icon: Smartphone, badge: null },
    { id: 'GESTION', label: 'Gestion', icon: FolderKanban, badge: null },
    { id: 'ANALYSE', label: 'Analyse', icon: BarChart3, badge: null },
    {
      id: 'SYSTEME',
      label: 'Système',
      icon: Settings,
      badge: syncState.status === 'ERREUR' ? '!' : null,
    },
  ] as const;

  return (
    <>
      {/* ========================================================================= */}
      {/* DESKTOP SIDEBAR (Fixed Left, Full Height, Inspi Job.find / Eduka)         */}
      {/* ========================================================================= */}
      <aside className="hidden md:flex fixed top-0 bottom-0 left-0 w-64 flex-col justify-between border-r border-slate-200/80 bg-white p-5 z-40 shadow-xs select-none">
        <div>
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-2 py-1 mb-6">
            <AkfLogo size="md" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold tracking-tight text-slate-900">
                  AKF PARTNERS
                </span>
                {/* Accent dots */}
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                </div>
              </div>
              <p className="text-[11px] font-medium text-slate-400 leading-none mt-1">
                Cockpit de pilotage & commissions
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="space-y-1.5">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Menu Principal
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id as TabType)}
                  className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 transition-colors ${
                        isActive ? 'text-white' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer Widgets */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          {/* Data Source Indicator */}
          <div
            onClick={() => onSelectTab('SYSTEME')}
            className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-2.5 text-xs text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-slate-800 truncate">
                {dataSourceMode === 'MOCK' ? 'Mode Local Démo' : 'Google Sheets Connecté'}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {syncState.status === 'SYNCHRONISE' ? 'Données synchronisées' : 'Vérification requise'}
              </p>
            </div>
          </div>

          {/* Quick System Check Button */}
          <button
            onClick={() => onSelectTab('SYSTEME')}
            className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Contrôle Système (11 tests)</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">v1.0</span>
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MOBILE SLIDE-OVER DRAWER (True Mobile Sidebar)                            */}
      {/* ========================================================================= */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Slide-in Panel */}
          <aside className="fixed top-0 bottom-0 left-0 w-[84vw] max-w-xs bg-white z-50 flex flex-col justify-between border-r border-slate-200 shadow-2xl overflow-y-auto animate-in slide-in-from-left duration-250 select-none">
            <div>
              {/* Drawer Brand & Close Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <AkfLogo size="sm" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-extrabold tracking-tight text-slate-900">
                        AKF PARTNERS
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Cockpit de pilotage & commissions
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
                  aria-label="Fermer le menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* User Profile Card */}
              <div className="p-4 bg-slate-50/80 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 flex items-center justify-center font-extrabold text-xs text-white shadow-xs shrink-0">
                    {currentUserEmail ? currentUserEmail.slice(0, 2).toUpperCase() : 'AD'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {currentUserEmail ? currentUserEmail.split('@')[0] : 'Administrateur'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200/60">
                        {currentUserRole || 'SUPER_ADMIN'}
                      </span>
                      <span className="text-[10px] text-slate-400">En ligne</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Items */}
              <div className="p-3 space-y-1">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Navigation
                </div>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectTab(item.id as TabType);
                        setMobileDrawerOpen(false);
                      }}
                      className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className={`h-4 w-4 transition-colors ${
                            isActive ? 'text-white' : 'text-slate-400'
                          }`}
                        />
                        <span>{item.label}</span>
                        {item.id === 'EXPRESS' && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              isActive
                                ? 'bg-white/20 text-white'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            Terrain
                          </span>
                        )}
                      </div>
                      {item.badge && item.badge === '!' && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Quick Add Section inside Drawer */}
                <div className="pt-4 mt-2 border-t border-slate-100">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Actions Rapides
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1 px-1">
                    <button
                      onClick={() => {
                        setMobileDrawerOpen(false);
                        onOpenQuickCreate('PARTNER');
                      }}
                      className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200/90 bg-white text-[11px] font-semibold text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 transition-colors cursor-pointer"
                    >
                      <UserPlus className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                      <span className="truncate">Partenaire</span>
                    </button>
                    <button
                      onClick={() => {
                        setMobileDrawerOpen(false);
                        onOpenQuickCreate('ORDER');
                      }}
                      className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200/90 bg-white text-[11px] font-semibold text-slate-700 hover:bg-amber-50 hover:border-amber-200 transition-colors cursor-pointer"
                    >
                      <ShoppingBag className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">Commande</span>
                    </button>
                    <button
                      onClick={() => {
                        setMobileDrawerOpen(false);
                        onOpenQuickCreate('CLIENT');
                      }}
                      className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200/90 bg-white text-[11px] font-semibold text-slate-700 hover:bg-emerald-50 hover:border-emerald-200 transition-colors cursor-pointer"
                    >
                      <UserCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">Client</span>
                    </button>
                    <button
                      onClick={() => {
                        setMobileDrawerOpen(false);
                        onOpenQuickCreate('PAYMENT');
                      }}
                      className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200/90 bg-white text-[11px] font-semibold text-slate-700 hover:bg-purple-50 hover:border-purple-200 transition-colors cursor-pointer"
                    >
                      <CreditCard className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                      <span className="truncate">Paiement</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer Widgets */}
            <div className="p-4 border-t border-slate-100 space-y-2.5 bg-slate-50/60">
              {/* Data Source status */}
              <div className="flex items-center justify-between text-xs text-slate-700 px-3 py-2 rounded-xl bg-white border border-slate-200/80">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-800 truncate">
                      {dataSourceMode === 'MOCK' ? 'Mode Démo' : 'Supabase Live'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {syncState.status === 'SYNCHRONISE' ? 'Données à jour' : 'Synchronisation requise'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSyncNow()}
                  disabled={isSyncing}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                  title="Synchroniser"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
                </button>
              </div>

              {/* Diagnostic Button in Mobile Drawer */}
              <button
                onClick={() => {
                  setMobileDrawerOpen(false);
                  onSelectTab('SYSTEME');
                }}
                className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>Contrôle Système (11 tests)</span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {/* Sign Out Button in Mobile Drawer */}
              {onSignOut && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    onSignOut();
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200/80 hover:bg-rose-100 active:scale-95 transition-all cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Se déconnecter (Verrouiller)</span>
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TOP HEADER (Adaptive: Sleek on Mobile h-14, Spacious on Desktop h-18)     */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-30 flex h-14 md:h-18 w-full items-center justify-between border-b border-slate-200/70 bg-white/90 md:bg-slate-50/90 px-3 md:px-8 backdrop-blur-md md:pl-64 transition-all">
        {/* MOBILE LEFT: Hamburger + Brand */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Ouvrir le menu"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1.5" onClick={() => onSelectTab('ACCUEIL')}>
            <AkfLogo size="sm" />
            <div className="flex items-center gap-1">
              <span className="text-sm font-black tracking-tight text-slate-900">AKF</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>
          </div>
        </div>

        {/* DESKTOP CENTER: Universal Search Bar */}
        <div className="hidden md:block flex-1 max-w-lg mx-0">
          <button
            type="button"
            onClick={onOpenUniversalSearch}
            className="w-full flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs text-slate-400 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer shadow-2xs"
          >
            <span className="flex items-center gap-2.5 truncate">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="truncate">Rechercher AKF-023, CL024, CMD047, tél...</span>
            </span>
            <kbd className="inline-block rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-500 border border-slate-200">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* MOBILE RIGHT: Compact Search + Nouveau + Avatar */}
        <div className="flex items-center gap-1.5 md:hidden">
          {/* Mobile Search Button */}
          <button
            type="button"
            onClick={onOpenUniversalSearch}
            aria-label="Recherche universelle"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-all cursor-pointer"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Mobile Quick Add Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setQuickMenuOpen(!quickMenuOpen)}
              aria-label="Créer"
              className="flex h-9 items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-2.5 text-xs font-bold text-white shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span className="text-[11px]">Nouveau</span>
            </button>

            {/* Quick Add Menu Dropdown for Mobile & Desktop */}
            {quickMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setQuickMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white p-2 shadow-2xl border border-slate-100 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Ajout Rapide
                  </div>
                  <button
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenQuickCreate('PARTNER');
                    }}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                      <UserPlus className="h-3.5 w-3.5" />
                    </div>
                    <span>Partenaire (AKFxxx)</span>
                  </button>
                  <button
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenQuickCreate('CLIENT');
                    }}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                      <UserCheck className="h-3.5 w-3.5" />
                    </div>
                    <span>Client (CLxxx)</span>
                  </button>
                  <button
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenQuickCreate('ORDER');
                    }}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors cursor-pointer"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                      <ShoppingBag className="h-3.5 w-3.5" />
                    </div>
                    <span>Commande (CMDxxx)</span>
                  </button>
                  <button
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenQuickCreate('PAYMENT');
                    }}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition-colors cursor-pointer"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                      <CreditCard className="h-3.5 w-3.5" />
                    </div>
                    <span>Paiement (PAYxxx)</span>
                  </button>
                  <button
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenQuickCreate('PRODUCT');
                    }}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition-colors cursor-pointer"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 text-teal-600">
                      <Package className="h-3.5 w-3.5" />
                    </div>
                    <span>Produit (Catalogue)</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Mobile User Avatar with Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMobileUserMenuOpen(!mobileUserMenuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 font-extrabold text-xs text-white shadow-xs active:scale-95 transition-all cursor-pointer"
              title={currentUserEmail || 'Compte'}
            >
              {currentUserEmail ? currentUserEmail.slice(0, 2).toUpperCase() : 'AD'}
            </button>

            {mobileUserMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMobileUserMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-white p-3 shadow-2xl border border-slate-100 z-50 animate-in fade-in zoom-in-95">
                  <div className="pb-2.5 mb-2.5 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {currentUserEmail || 'Administrateur'}
                    </p>
                    <span className="inline-block mt-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                      {currentUserRole || 'SUPER_ADMIN'}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setMobileUserMenuOpen(false);
                      onSyncNow();
                    }}
                    disabled={isSyncing}
                    className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer mb-1"
                  >
                    <span className="flex items-center gap-2">
                      <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : 'text-slate-400'}`} />
                      <span>Synchroniser</span>
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold">Live</span>
                  </button>

                  {onSignOut && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileUserMenuOpen(false);
                        onSignOut();
                      }}
                      className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Se déconnecter</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* DESKTOP RIGHT ACTIONS: Sync + Nouveau + Profile */}
        <div className="hidden md:flex items-center gap-3 ml-2">
          {/* Synchronisation Button */}
          <button
            type="button"
            onClick={onSyncNow}
            disabled={isSyncing}
            title={`État de synchronisation : ${syncState.status}. Cliquez pour synchroniser maintenant.`}
            className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${
              syncState.status === 'SYNCHRONISE'
                ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100'
                : syncState.status === 'EN_ATTENTE'
                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
            }`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-slate-600' : ''}`} />
            <span>
              {syncState.status === 'SYNCHRONISE'
                ? 'Synchronisé'
                : syncState.status === 'EN_ATTENTE'
                ? 'En attente'
                : 'Erreur'}
            </span>
          </button>

          {/* Quick Create Dropdown "+ Nouveau" Desktop */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setQuickMenuOpen(!quickMenuOpen)}
              className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2.5 text-xs font-bold text-white hover:from-emerald-700 hover:to-teal-700 transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Nouveau</span>
              <ChevronDown className="h-3 w-3 text-emerald-100" />
            </button>

            {quickMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setQuickMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white p-2 shadow-2xl border border-slate-100 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Ajout Rapide
                  </div>
                  <button
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenQuickCreate('PARTNER');
                    }}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                      <UserPlus className="h-3.5 w-3.5" />
                    </div>
                    <span>Partenaire (AKFxxx)</span>
                  </button>
                  <button
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenQuickCreate('CLIENT');
                    }}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                      <UserCheck className="h-3.5 w-3.5" />
                    </div>
                    <span>Client (CLxxx)</span>
                  </button>
                  <button
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenQuickCreate('ORDER');
                    }}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors cursor-pointer"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                      <ShoppingBag className="h-3.5 w-3.5" />
                    </div>
                    <span>Commande (CMDxxx)</span>
                  </button>
                  <button
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenQuickCreate('PAYMENT');
                    }}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition-colors cursor-pointer"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                      <CreditCard className="h-3.5 w-3.5" />
                    </div>
                    <span>Paiement (PAYxxx)</span>
                  </button>
                  <button
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenQuickCreate('PRODUCT');
                    }}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition-colors cursor-pointer"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 text-teal-600">
                      <Package className="h-3.5 w-3.5" />
                    </div>
                    <span>Produit (Catalogue)</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* User Profile Badge & Logout Desktop */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 flex items-center justify-center font-extrabold text-xs text-white shadow-xs">
                {currentUserEmail ? currentUserEmail.slice(0, 2).toUpperCase() : 'AD'}
              </div>
              <div className="leading-tight max-w-[140px]">
                <span className="font-bold text-xs text-slate-900 block truncate" title={currentUserEmail}>
                  {currentUserEmail ? currentUserEmail.split('@')[0] : 'Admin'}
                </span>
                <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 inline-block mt-0.5">
                  {currentUserRole || 'SUPER_ADMIN'}
                </span>
              </div>
            </div>

            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Se déconnecter (Verrouiller le cockpit)"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MOBILE BOTTOM NAVIGATION (Thumb-friendly, Ergonomic Safe-Area Nav)        */}
      {/* ========================================================================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-lg shadow-slate-900/5 select-none">
        <div className="grid grid-cols-5 gap-1 items-center max-w-md mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id as TabType)}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all relative cursor-pointer min-h-[50px] active:scale-95 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`h-4 w-4 transition-transform ${
                      isActive ? 'text-white' : 'text-slate-500'
                    }`}
                  />
                  {item.badge && item.badge === '!' && (
                    <span className="absolute -top-1 -right-2 h-3 w-3 rounded-full bg-rose-600 text-[8px] font-black text-white flex items-center justify-center">
                      !
                    </span>
                  )}
                  {item.id === 'EXPRESS' && !isActive && (
                    <span className="absolute -top-0.5 -right-1.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </div>
                <span
                  className={`text-[10px] mt-1 tracking-tight leading-none truncate w-full text-center ${
                    isActive ? 'font-bold text-white' : 'font-medium'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
