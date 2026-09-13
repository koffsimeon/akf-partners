import React, { useState } from 'react';
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
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import { DataSourceMode, SyncState } from '../types';
import { AkfLogo } from './AkfLogo';

export type TabType = 'ACCUEIL' | 'RECHERCHE' | 'GESTION' | 'ANALYSE' | 'SYSTEME';

interface NavigationProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  syncState: SyncState;
  onSyncNow: () => Promise<void>;
  isSyncing: boolean;
  onOpenQuickCreate: (type: 'PARTNER' | 'CLIENT' | 'ORDER' | 'PAYMENT') => void;
  onOpenUniversalSearch: () => void;
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
  dataSourceMode = 'SHEETS_LIVE',
}: NavigationProps) {
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);

  const navItems = [
    { id: 'ACCUEIL', label: 'Accueil', icon: Home, badge: null },
    { id: 'RECHERCHE', label: 'Recherche', icon: Search, badge: null },
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
      {/* Top Header (Persistent on Mobile & Desktop) */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 md:px-6 backdrop-blur-md">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <AkfLogo size="md" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-slate-900">AKF PARTNERS</h1>
              {/* Beninese color accent dots */}
              <div className="hidden sm:flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" title="Vert AKF" />
                <span className="h-2 w-2 rounded-full bg-amber-500" title="Jaune AKF" />
                <span className="h-2 w-2 rounded-full bg-red-500" title="Rouge AKF" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 font-medium leading-none hidden sm:block">
              Cockpit de pilotage & commissions
            </p>
          </div>
        </div>

        {/* Universal Search Quick Trigger */}
        <div className="flex-1 max-w-md mx-3 hidden md:block">
          <button
            type="button"
            onClick={onOpenUniversalSearch}
            className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600 hover:border-slate-300 transition-colors shadow-xs"
          >
            <span className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <span>Rechercher AKF-023, CL024, CMD047, téléphone...</span>
            </span>
            <kbd className="hidden sm:inline-block rounded bg-white px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-200">
              Recherche
            </kbd>
          </button>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Source de données : Google Sheets — Gestionnaire de l'application */}
          <button
            type="button"
            onClick={() => onSelectTab('SYSTEME')}
            title="Source de données active : Google Sheets officiel (Gestionnaire de l'application)"
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold border bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 transition-all shadow-2xs"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
            <span className="hidden sm:inline">
              Google Sheets — Gestionnaire de l'application
            </span>
          </button>

          {/* Sync Status Badge */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={onSyncNow}
              disabled={isSyncing}
              title={`État de synchronisation : ${syncState.status}. Cliquez pour synchroniser maintenant.`}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold border transition-all ${
                syncState.status === 'SYNCHRONISE'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : syncState.status === 'EN_ATTENTE'
                  ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              }`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-slate-600' : ''}`} />
              <span className="hidden sm:inline">
                {syncState.status === 'SYNCHRONISE'
                  ? '🟢 Synchronisé'
                  : syncState.status === 'EN_ATTENTE'
                  ? '🟠 En attente'
                  : '🔴 Erreur'}
              </span>
            </button>
          </div>

          {/* Quick Create Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setQuickMenuOpen(!quickMenuOpen)}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nouveau</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {quickMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setQuickMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white p-1.5 shadow-xl border border-slate-200 z-50 animate-in fade-in zoom-in-95">
                  <button
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenQuickCreate('PARTNER');
                    }}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                  >
                    <UserPlus className="h-4 w-4 text-emerald-600" />
                    + Partenaire (AKFxxx)
                  </button>
                  <button
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenQuickCreate('CLIENT');
                    }}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-800 transition-colors"
                  >
                    <UserCheck className="h-4 w-4 text-blue-600" />
                    + Client (CLxxx)
                  </button>
                  <button
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenQuickCreate('ORDER');
                    }}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-800 transition-colors"
                  >
                    <ShoppingBag className="h-4 w-4 text-amber-600" />
                    + Commande (CMDxxx)
                  </button>
                  <button
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenQuickCreate('PAYMENT');
                    }}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-800 transition-colors"
                  >
                    <CreditCard className="h-4 w-4 text-purple-600" />
                    + Paiement (PAYxxx)
                  </button>
                </div>
              </>
            )}
          </div>

          {/* User badge */}
          <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-200 text-xs">
            <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700">
              AD
            </div>
            <div className="leading-tight">
              <span className="font-bold text-slate-800 block">Admin</span>
              <span className="text-[10px] text-slate-400">Direction AKF</span>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop Sidebar (Left side, fixed) */}
      <aside className="hidden md:flex fixed top-16 bottom-0 left-0 w-60 flex-col justify-between border-r border-slate-200 bg-white p-4 z-20">
        <div className="space-y-1">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Navigation Principale
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id as TabType)}
                className={`w-full flex items-center justify-between rounded-xl px-3.5 py-3 text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sheets Mock Notice in Sidebar */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900">
          <div className="flex items-center gap-1.5 font-bold mb-1">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
            <span>Phase 1 — Mock actif</span>
          </div>
          <p className="leading-tight text-amber-800/90 text-[10px]">
            Données isolées sans connexion Google Sheets fictive. Prêt pour le branchement réel (Phase 4).
          </p>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (Fixed bottom on small screens) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-slate-200 bg-white/95 px-2 backdrop-blur-md">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id as TabType)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors relative ${
                isActive ? 'text-slate-900 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-emerald-600' : ''}`} />
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
              {isActive && (
                <span className="absolute bottom-0 h-1 w-6 rounded-full bg-emerald-600" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
