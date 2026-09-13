import React, { useState } from 'react';
import {
  Settings,
  Activity,
  RefreshCw,
  FileText,
  Sliders,
  Database,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Play,
  Layers,
  ShieldCheck,
  Code2,
  Check,
  X,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { AuditLog, DiagnosticResult, SyncState, SystemConfig } from '../types';
import { AkfCodeAiView } from './AkfCodeAiView';
import { GoogleSheetsPhase4View } from './GoogleSheetsPhase4View';

export type SystemSubTab = 'DIAGNOSTIC' | 'RECALCULATE' | 'LOGS' | 'CONFIG' | 'SYNC' | 'CODE_AI';

interface SystemViewProps {
  config: SystemConfig;
  syncState: SyncState;
  auditLogs: AuditLog[];
  onTriggerSync: () => Promise<void>;
  isSyncing: boolean;
  onTriggerRecalculate: () => Promise<any>;
  onRunDiagnostic: () => Promise<DiagnosticResult>;
  onRefreshLogs?: () => Promise<void>;
}

export function SystemView({
  config,
  syncState,
  auditLogs,
  onTriggerSync,
  isSyncing,
  onTriggerRecalculate,
  onRunDiagnostic,
  onRefreshLogs,
}: SystemViewProps) {
  const [subTab, setSubTab] = useState<SystemSubTab>('DIAGNOSTIC');
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [runningDiag, setRunningDiag] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalculateReport, setRecalculateReport] = useState<any | null>(null);
  const [logFilter, setLogFilter] = useState('ALL');
  const [logSearch, setLogSearch] = useState('');

  const handleRunDiagnostic = async () => {
    try {
      setRunningDiag(true);
      const res = await onRunDiagnostic();
      setDiagnosticResult(res);
    } catch (e: any) {
      console.error(e);
    } finally {
      setRunningDiag(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      const res = await onTriggerRecalculate();
      const rep = res?.report || res || {};
      const processed = res?.itemsProcessed ?? (
        rep.processedCount
          ? (rep.processedCount.partners || 0) + (rep.processedCount.clients || 0) + (rep.processedCount.orders || 0) + (rep.processedCount.payments || 0)
          : 0
      );
      const corrected = res?.itemsCorrected ?? rep.correctedCount ?? 0;
      const anomalies = res?.anomaliesCount ?? (Array.isArray(rep.anomalies) ? rep.anomalies.length : 0);
      const details = Array.isArray(res?.details)
        ? res.details
        : Array.isArray(rep.anomalies)
        ? rep.anomalies
        : [];

      setRecalculateReport({
        timestamp: rep.timestamp || new Date().toISOString(),
        itemsProcessed: processed,
        itemsCorrected: corrected,
        anomaliesCount: anomalies,
        details,
      });
    } catch (e: any) {
      console.error(e);
    } finally {
      setRecalculating(false);
    }
  };

  const filteredLogs = auditLogs.filter((l) => {
    const matchFilter = logFilter === 'ALL' || l.action === logFilter;
    const matchSearch =
      !logSearch ||
      l.details.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.entityId.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.action.toLowerCase().includes(logSearch.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Administration & Diagnostic Système
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Moteur de calcul, audits, configuration, synchronisation et module AKF CODE AI
          </p>
        </div>

        {/* Sub-Tabs Pills */}
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-2xs">
          <button
            onClick={() => setSubTab('DIAGNOSTIC')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold whitespace-nowrap transition-colors ${
              subTab === 'DIAGNOSTIC'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            Diagnostic
          </button>
          <button
            onClick={() => setSubTab('RECALCULATE')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold whitespace-nowrap transition-colors ${
              subTab === 'RECALCULATE'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Recalcul Global
          </button>
          <button
            onClick={() => setSubTab('LOGS')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold whitespace-nowrap transition-colors ${
              subTab === 'LOGS'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Journaux ({auditLogs.length})
          </button>
          <button
            onClick={() => setSubTab('CONFIG')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold whitespace-nowrap transition-colors ${
              subTab === 'CONFIG'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            Configuration
          </button>
          <button
            onClick={() => setSubTab('SYNC')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold whitespace-nowrap transition-colors ${
              subTab === 'SYNC'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-emerald-800 hover:bg-emerald-50'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            Google Sheets (Phase 4)
          </button>
          <button
            onClick={() => setSubTab('CODE_AI')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold whitespace-nowrap transition-colors ${
              subTab === 'CODE_AI'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-purple-700 hover:bg-purple-50'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            AKF CODE AI
          </button>
        </div>
      </div>

      {/* 10.1 DIAGNOSTIC SYSTÈME */}
      {subTab === 'DIAGNOSTIC' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Audit de Santé et Contrôle d’Intégrité (11 Contrôles)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Vérification des API, liaisons relationnelles, règles de commissions et détection des incohérences.
              </p>
            </div>
            <button
              onClick={handleRunDiagnostic}
              disabled={runningDiag}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
            >
              <Play className={`h-3.5 w-3.5 ${runningDiag ? 'animate-spin' : ''}`} />
              {runningDiag ? 'Analyse en cours...' : 'LANCER LE DIAGNOSTIC'}
            </button>
          </div>

          {diagnosticResult ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-black ${
                      diagnosticResult.overallStatus === 'OK'
                        ? 'bg-emerald-100 text-emerald-800'
                        : diagnosticResult.overallStatus === 'AVERTISSEMENT'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    Statut Global : {diagnosticResult.overallStatus}
                  </span>
                  <span className="text-xs text-slate-500">
                    {diagnosticResult.checks.length} contrôles exécutés le {new Date(diagnosticResult.timestamp).toLocaleTimeString('fr-FR')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {diagnosticResult.checks.map((c) => {
                  const isOk = c.status === 'OK';
                  const isWarning = c.status === 'AVERTISSEMENT' || c.status === 'WARNING';
                  const isError = c.status === 'ERREUR' || c.status === 'ERROR';
                  const statusLabel = isOk ? 'OK' : isWarning ? 'AVERTISSEMENT' : 'ERREUR';
                  
                  const messageText = c.message || (typeof c.details === 'string' ? c.details : '');
                  const detailsList: string[] = Array.isArray(c.details)
                    ? c.details
                    : typeof c.details === 'string' && c.details.trim() !== messageText.trim()
                    ? [c.details]
                    : [];

                  return (
                    <div
                      key={c.id}
                      className={`rounded-2xl border p-4 shadow-2xs space-y-2 ${
                        isOk
                          ? 'bg-white border-slate-200'
                          : isWarning
                          ? 'bg-amber-50/50 border-amber-200'
                          : 'bg-rose-50/50 border-rose-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {isOk && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
                          {isWarning && <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />}
                          {isError && <XCircle className="h-4 w-4 text-rose-600 shrink-0" />}
                          <h4 className="text-xs font-bold text-slate-900">{c.name}</h4>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isOk
                              ? 'bg-emerald-100 text-emerald-800'
                              : isWarning
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      {messageText && <p className="text-xs text-slate-600">{messageText}</p>}

                      {detailsList.length > 0 && (
                        <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-700 font-mono space-y-0.5 border border-slate-200">
                          {detailsList.map((d, i) => (
                            <div key={i}>• {d}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center bg-white">
              <Activity className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-700">Aucun diagnostic exécuté récemment</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                Cliquez sur le bouton pour auditer l’intégralité des 11 règles d’intégrité du système AKF.
              </p>
              <button
                onClick={handleRunDiagnostic}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                Lancer le diagnostic
              </button>
            </div>
          )}
        </div>
      )}

      {/* 10.2 RECALCUL GLOBAL */}
      {subTab === 'RECALCULATE' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-emerald-700" />
                Recalcul Global de l'Intégrité Métier
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Le recalcul global recalcule chronologiquement chaque commande, identifie l'éligibilité Premium des clients (max 3 commandes), calcule les commissions selon le grade du partenaire à la date de vente, ajuste les soldes disponibles en déduisant les paiements réels, et réévalue l'avancement vers le grade supérieur.
              </p>
            </div>

            <div className="rounded-xl bg-amber-50 p-4 border border-amber-200 text-xs text-amber-900">
              <strong>Opération idempotente :</strong> Le recalcul peut être exécuté à tout moment sans risque de doubler des commissions ou de corrompre les données.
            </div>

            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
              {recalculating ? 'Recalcul du moteur métier en cours...' : 'RECALCULER TOUT'}
            </button>
          </div>

          {recalculateReport && (
            <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-2xs space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <h4 className="text-sm font-bold text-slate-900">Rapport de Recalcul Exécuté</h4>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {new Date(recalculateReport.timestamp).toLocaleString('fr-FR')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <span className="text-xs text-slate-500 font-medium">Éléments traités</span>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {recalculateReport.itemsProcessed}
                  </div>
                  <span className="text-[10px] text-slate-400">Partenaires, clients, commandes, paiements</span>
                </div>

                <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-100">
                  <span className="text-xs text-emerald-800 font-medium">Éléments corrigés</span>
                  <div className="text-xl font-bold text-emerald-900 mt-1">
                    {recalculateReport.itemsCorrected}
                  </div>
                  <span className="text-[10px] text-emerald-600">Commissions ou grades réajustés</span>
                </div>

                <div className="rounded-xl bg-rose-50 p-4 border border-rose-100">
                  <span className="text-xs text-rose-800 font-medium">Anomalies identifiées</span>
                  <div className="text-xl font-bold text-rose-900 mt-1">
                    {recalculateReport.anomaliesCount}
                  </div>
                  <span className="text-[10px] text-rose-600">Points d'attention consignés</span>
                </div>
              </div>

              {recalculateReport.details && Array.isArray(recalculateReport.details) && recalculateReport.details.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-slate-700 block mb-1">Détails des ajustements :</span>
                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 space-y-1 font-mono border border-slate-200 max-h-48 overflow-y-auto">
                    {recalculateReport.details.map((d: any, idx: number) => (
                      <div key={idx}>• {typeof d === 'string' ? d : JSON.stringify(d)}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 10.3 JOURNAUX D'AUDIT */}
      {subTab === 'LOGS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
            <div className="flex flex-1 items-center gap-2">
              <input
                type="text"
                placeholder="Filtrer les logs par mot-clé, ID, utilisateur..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full max-w-sm rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-800 outline-hidden"
              />

              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 bg-white"
              >
                <option value="ALL">Toutes actions</option>
                <option value="CREATE_PARTNER">Création Partenaire</option>
                <option value="CREATE_CLIENT">Création Client</option>
                <option value="CREATE_ORDER">Création Commande</option>
                <option value="CREATE_PAYMENT">Création Paiement</option>
                <option value="SYNC">Synchronisation</option>
                <option value="RECALCUL">Recalcul</option>
                <option value="SYSTEM_BOOT">Démarrage Système</option>
              </select>
            </div>
            <span className="text-xs text-slate-400">{filteredLogs.length} entrée(s)</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Horodatage</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entité / ID</th>
                  <th className="py-3 px-4">Utilisateur</th>
                  <th className="py-3 px-4">Détails de l’opération</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('fr-FR')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                      {log.entityType} : {log.entityId}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{log.user}</td>
                    <td className="py-3 px-4 text-slate-800">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 10.4 CONFIGURATION */}
      {subTab === 'CONFIG' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Grille Officielle des Grades AKF</h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Source de vérité : CONFIG_GRADES
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Valeurs dynamiques extraites directement de l'onglet Google Sheets « CONFIG_GRADES » (Ligne Active = OUI)
                </p>
              </div>
              {config.activeWave && (
                <div className="text-xs font-semibold px-3 py-1 bg-purple-50 text-purple-700 rounded-lg border border-purple-200 self-start sm:self-auto">
                  Vague en cours : <strong>{config.activeWave}</strong>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(
                config.ranks || [
                  { name: 'Neo', minCa: 0, minOrders: 0, commissionRate: 0.06 },
                  { name: 'Ambassador', minCa: 100000, minOrders: 8, commissionRate: 0.08 },
                  { name: 'Excellence', minCa: 300000, minOrders: 20, commissionRate: 0.10 },
                  { name: 'Signature', minCa: 800000, minOrders: 50, commissionRate: 0.12 },
                ]
              ).map((r) => (
                <div key={r.name} className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-slate-900">{r.name}</span>
                    <span className="font-extrabold text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-['JetBrains_Mono']">
                      {(r.commissionRate * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div>
                      Seuil CA : <strong className="font-mono text-slate-900">{r.minCa.toLocaleString()} FCFA</strong>
                    </div>
                    <div>
                      Seuil Commandes : <strong className="font-mono text-slate-900">{r.minOrders}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tableau dynamique des vagues depuis CONFIG_GRADES */}
            {config.waves && config.waves.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Données réelles de l'onglet « CONFIG_GRADES »
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                    <thead className="bg-slate-50 font-semibold text-slate-600">
                      <tr>
                        <th className="py-2.5 px-3">Vague</th>
                        <th className="py-2.5 px-3">Ambassador Cmd</th>
                        <th className="py-2.5 px-3">Ambassador CA</th>
                        <th className="py-2.5 px-3">Excellence Cmd</th>
                        <th className="py-2.5 px-3">Excellence CA</th>
                        <th className="py-2.5 px-3">Signature Cmd</th>
                        <th className="py-2.5 px-3">Signature CA</th>
                        <th className="py-2.5 px-3 text-center">Active</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {config.waves.map((w, idx) => (
                        <tr key={idx} className={w.active ? 'bg-emerald-50/50 font-medium' : 'text-slate-500'}>
                          <td className="py-2 px-3 font-bold text-slate-800">
                            {w.wave}
                            {w.active && (
                              <span className="ml-1.5 text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">
                                EN VIGUEUR
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono">{w.ambassadorCmd}</td>
                          <td className="py-2 px-3 font-mono">{w.ambassadorCa.toLocaleString()} FCFA</td>
                          <td className="py-2 px-3 font-mono">{w.excellenceCmd}</td>
                          <td className="py-2 px-3 font-mono">{w.excellenceCa.toLocaleString()} FCFA</td>
                          <td className="py-2 px-3 font-mono">{w.signatureCmd}</td>
                          <td className="py-2 px-3 font-mono">{w.signatureCa.toLocaleString()} FCFA</td>
                          <td className="py-2 px-3 text-center">
                            {w.active ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                                OUI
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600">
                                NON
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Règle Commandes Premium
              </span>
              <div className="text-lg font-black text-slate-900">
                Max {config.maxPremiumOrdersForCommission || config.premiumCommissionMaxOrders || 3} commandes commissionnées
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Chaque client ne génère de commission partenaire que sur ses 3 premières commandes Premium au maximum. Au-delà, aucune commission n'est allouée.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Seuil Minimum de Paiement
              </span>
              <div className="text-lg font-black text-purple-900 font-['JetBrains_Mono']">
                {config.minimumPayment.toLocaleString()} FCFA
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Montant minimal exigé pour déclencher un décaissement envers un partenaire affilié.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 10.5 SYNCHRONISATION ET CONNEXION GOOGLE SHEETS (PHASE 4) */}
      {subTab === 'SYNC' && (
        <GoogleSheetsPhase4View onRefreshData={onTriggerSync} />
      )}

      {/* 12. MODULE RÉEL : AKF CODE AI */}
      {subTab === 'CODE_AI' && (
        <AkfCodeAiView onLogCreated={onRefreshLogs} />
      )}
    </div>
  );
}
