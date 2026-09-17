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
  ChevronDown,
  Sparkles,
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
      {/* TOP HEADER (Universal across Desktop & Mobile)                            */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-30 flex h-20 w-full items-center justify-between border-b border-slate-200/60 bg-white/80 md:bg-slate-50/80 px-4 md:px-8 backdrop-blur-md md:pl-64">
        {/* Mobile Logo (Visible only on small screens) */}
        <div className="flex items-center gap-2.5 md:hidden">
          <AkfLogo size="sm" />
          <span className="text-sm font-black tracking-tight text-slate-900">AKF</span>
        </div>

        {/* Universal Search Bar (Inspi Job.find / Eduka search bar) */}
        <div className="flex-1 max-w-lg mx-2 md:mx-0">
          <button
            type="button"
            onClick={onOpenUniversalSearch}
            className="w-full flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs text-slate-400 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer shadow-2xs"
          >
            <span className="flex items-center gap-2.5 truncate">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="truncate">Rechercher AKF-023, CL024, CMD047, tél...</span>
            </span>
            <kbd className="hidden sm:inline-block rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-500 border border-slate-200">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2 sm:gap-3 ml-2">
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
            <span className="hidden sm:inline">
              {syncState.status === 'SYNCHRONISE'
                ? 'Synchronisé'
                : syncState.status === 'EN_ATTENTE'
                ? 'En attente'
                : 'Erreur'}
            </span>
          </button>

          {/* Quick Create Dropdown "+ Nouveau" (Executive Primary Button) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setQuickMenuOpen(!quickMenuOpen)}
              className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2.5 text-xs font-bold text-white hover:from-emerald-700 hover:to-teal-700 transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nouveau</span>
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
                </div>
              </>
            )}
          </div>

          {/* User Profile Badge (Inspi Job.find / Eduka Profile Avatar) */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center font-extrabold text-xs text-white shadow-xs">
              AD
            </div>
            <div className="leading-tight hidden lg:block">
              <span className="font-bold text-xs text-slate-900 block">Admin</span>
              <span className="text-[10px] text-slate-400 font-medium">Direction AKF</span>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MOBILE BOTTOM NAVIGATION (Fixed bottom on small screens)                  */}
      {/* ========================================================================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-slate-200/80 bg-white/95 px-2 backdrop-blur-md">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id as TabType)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors relative cursor-pointer ${
                isActive ? 'text-slate-900 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-emerald-600' : ''}`} />
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
              {isActive && (
                <span className="absolute bottom-0.5 h-1 w-6 rounded-full bg-emerald-600" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
