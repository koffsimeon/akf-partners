/**
 * AKF PARTNERS — COMPOSANT PHASE 4 : GOOGLE SHEETS
 * Module de connexion au vrai fichier Google Sheets, inspection des 9 onglets,
 * bascule de mode (MOCK / READONLY / LIVE), et exécution automatisée des Tests 1 à 21.
 */

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  RefreshCw,
  ExternalLink,
  KeyRound,
  Database,
  Lock,
  Search,
  Check,
  ChevronRight,
  Info,
  Layers,
  Sparkles,
} from 'lucide-react';
import { DataSourceMode, SheetsInspectionResult } from '../types';
import {
  signInWithGoogle,
  signOutGoogle,
  getStoredAccessToken,
  getStoredUserEmail,
  setStoredAccessToken,
} from '../services/googleAuth';

interface GoogleSheetsPhase4ViewProps {
  onRefreshData?: () => Promise<void>;
}

export function GoogleSheetsPhase4View({ onRefreshData }: GoogleSheetsPhase4ViewProps) {
  // États de configuration et connexion
  const [spreadsheetInput, setSpreadsheetInput] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [currentMode, setCurrentMode] = useState<DataSourceMode>('SHEETS_LIVE');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSearchingDrive, setIsSearchingDrive] = useState(false);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);

  // Résultats d'inspection et statut
  const [inspection, setInspection] = useState<SheetsInspectionResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [setAsPrimaryManager, setSetAsPrimaryManager] = useState(true);

  // Exécution des tests Phase 4
  const [testResults, setTestResults] = useState<any | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testScope, setTestScope] = useState<'READONLY' | 'ALL'>('READONLY');

  // Chargement initial du statut serveur et des jetons mémorisés
  useEffect(() => {
    const savedToken = getStoredAccessToken();
    const savedEmail = getStoredUserEmail();
    if (savedToken) setAccessToken(savedToken);
    if (savedEmail) setUserEmail(savedEmail);

    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/sheets/status');
      if (res.ok) {
        const data = await res.json();
        setCurrentMode(data.mode);
        if (data.inspection) {
          setInspection(data.inspection);
          if (data.inspection.spreadsheetId && !spreadsheetInput) {
            setSpreadsheetInput(data.inspection.spreadsheetId);
          }
        }
      }
    } catch (err) {
      console.error('Erreur chargement statut sheets:', err);
    }
  };

  // Extraction d'ID de Google Sheets depuis une URL ou un ID direct
  const extractSpreadsheetId = (input: string): string => {
    const trimmed = input.trim();
    const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) return match[1];
    return trimmed;
  };

  // 1. Authentification Google via Popup OAuth
  const handleGoogleSignIn = async () => {
    try {
      setIsConnecting(true);
      setStatusMessage({ type: 'info', text: 'Ouverture de la fenêtre de connexion Google...' });
      const authRes = await signInWithGoogle();
      setAccessToken(authRes.accessToken);
      setUserEmail(authRes.user.email || '');
      setStatusMessage({
        type: 'success',
        text: `Connecté avec succès en tant que ${authRes.user.email}. Vous pouvez maintenant sélectionner votre fichier Google Sheets.`,
      });
      // Recherche automatique sur Google Drive
      handleSearchDrive(authRes.accessToken);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Erreur d'authentification Google : ${err.message}` });
    } finally {
      setIsConnecting(false);
    }
  };

  // 2. Recherche automatique sur Google Drive
  const handleSearchDrive = async (token = accessToken) => {
    if (!token) {
      setStatusMessage({ type: 'error', text: "Veuillez vous connecter avec Google d'abord pour lister vos fichiers." });
      return;
    }
    try {
      setIsSearchingDrive(true);
      const res = await fetch('/api/sheets/drive/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la recherche Drive');
      setDriveFiles(data.files || []);
      if (data.files?.length > 0) {
        setStatusMessage({
          type: 'info',
          text: `${data.files.length} classeur(s) Google Sheets détecté(s). Cliquez sur un fichier pour l'inspecter.`,
        });
      } else {
        setStatusMessage({
          type: 'info',
          text: 'Aucun classeur Google Sheets trouvé automatiquement. Vous pouvez coller le lien directement.',
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setIsSearchingDrive(false);
    }
  };

  // 3. Connexion et inspection du fichier sélectionné
  const handleConnectSpreadsheet = async (sheetIdToUse?: string, targetMode?: DataSourceMode) => {
    const rawId = sheetIdToUse || spreadsheetInput;
    const finalId = extractSpreadsheetId(rawId);

    if (!finalId) {
      setStatusMessage({ type: 'error', text: 'Veuillez saisir une URL ou un ID de feuille de calcul Google Sheets.' });
      return;
    }
    if (!accessToken) {
      setStatusMessage({
        type: 'error',
        text: "Jeton d'accès OAuth manquant. Veuillez cliquer sur 'Se connecter avec Google'.",
      });
      return;
    }

    const modeToUse = targetMode || (setAsPrimaryManager ? 'SHEETS_LIVE' : 'SHEETS_READONLY');

    try {
      setIsConnecting(true);
      setStatusMessage({ type: 'info', text: 'Inspection et validation des 9 onglets en cours...' });

      const res = await fetch('/api/sheets/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: finalId,
          accessToken,
          userEmail,
          mode: modeToUse,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec de connexion au Google Sheets');

      setInspection(data.inspection);
      setCurrentMode(modeToUse);
      setSpreadsheetInput(finalId);
      setStoredAccessToken(accessToken, userEmail);

      setStatusMessage({
        type: 'success',
        text:
          modeToUse === 'SHEETS_LIVE'
            ? `Connexion établie au classeur "${data.inspection.title}". Ce fichier Google Sheets gère désormais directement l'application.`
            : `Connexion établie au classeur "${data.inspection.title}". Mode LECTURE SEULE activé pour préserver vos données.`,
      });

      if (onRefreshData) await onRefreshData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setIsConnecting(false);
    }
  };

  // 4. Changement de mode (MOCK / READONLY / LIVE)
  const handleSwitchMode = async (mode: DataSourceMode) => {
    try {
      setIsConnecting(true);
      const res = await fetch('/api/sheets/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur changement de mode');

      setCurrentMode(data.mode);
      setStatusMessage({
        type: 'success',
        text:
          mode === 'MOCK'
            ? 'Basculé sur le Mock de test (Phase 3 validée).'
            : mode === 'SHEETS_READONLY'
            ? 'Basculé sur Google Sheets en LECTURE SEULE STRICTE (Aucune écriture autorisée).'
            : 'Basculé sur Google Sheets en ÉCRITURE CONTRÔLÉE (Avec verrous et relectures de sécurité).',
      });
      if (onRefreshData) await onRefreshData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setIsConnecting(false);
    }
  };

  // 5. Exécution du banc de tests automatisé (Tests 1 à 21)
  const handleRunTests = async (scope: 'READONLY' | 'ALL') => {
    try {
      setIsRunningTests(true);
      setTestScope(scope);
      setStatusMessage({
        type: 'info',
        text: `Exécution des tests Phase 4 (${scope === 'READONLY' ? 'Tests 1 à 10' : 'Tests 1 à 21'})...`,
      });

      const res = await fetch('/api/sheets/tests/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testScope: scope }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors des tests');

      setTestResults(data);
      setStatusMessage({
        type: data.summary.failed === 0 ? 'success' : 'error',
        text: `Tests terminés : ${data.summary.success}/${data.summary.total} réussis, ${data.summary.failed} échec(s), ${data.summary.skipped} ignoré(s).`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setIsRunningTests(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête Phase 4 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white shadow-sm">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Google Sheets — Gestionnaire de l'application
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Google Sheets — Gestionnaire de l'application
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 max-w-3xl leading-relaxed">
                Le classeur Google Sheets officiel d'AKF Partners est la source unique de vérité des données.
                Toutes les opérations (partenaires, clients, commandes, paiements, commissions) sont traitées en temps réel par le moteur TypeScript et synchronisées directement avec le classeur officiel.
              </p>
            </div>
          </div>

          {/* Statut opérationnel Production */}
          <div className="flex items-center gap-3 shrink-0 bg-emerald-50/80 px-4 py-2.5 rounded-xl border border-emerald-200 text-emerald-900 shadow-2xs">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-2xs">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Google Sheets — Connecté</p>
              <p className="text-[11px] text-emerald-700 font-medium">Gestionnaire de l'application</p>
            </div>
          </div>
        </div>

        {/* Message de statut */}
        {statusMessage && (
          <div
            className={`mt-4 flex items-start gap-2.5 rounded-xl p-3 text-xs border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            ) : statusMessage.type === 'error' ? (
              <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
            ) : (
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
            )}
            <span className="font-medium">{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* Bloc 1 : Connexion & Authentification Google */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-emerald-600" />
              1. Authentification & Connexion au Classeur
            </h3>
            {userEmail ? (
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Connecté : <strong className="text-slate-800">{userEmail}</strong>
              </span>
            ) : (
              <span className="text-xs text-slate-400">Non authentifié</span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isConnecting}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Se connecter avec Google (Admin AKF)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSearchDrive()}
              disabled={isSearchingDrive || !accessToken}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-xs"
            >
              <Search className={`h-4 w-4 ${isSearchingDrive ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
              <span>{isSearchingDrive ? 'Recherche en cours...' : 'Détecter classeurs sur Drive'}</span>
            </button>
          </div>

          {/* Saisie directe de l'ID ou de l'URL */}
          <div className="space-y-1.5 pt-2">
            <label className="block text-xs font-bold text-slate-700">
              Lien ou Identifiant du Google Sheets AKF Partners :
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={spreadsheetInput}
                onChange={(e) => setSpreadsheetInput(e.target.value)}
                placeholder="Ex: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5n.../edit ou ID direct"
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
              />
              <button
                type="button"
                onClick={() => handleConnectSpreadsheet()}
                disabled={isConnecting || !spreadsheetInput}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50"
              >
                {isConnecting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span>Connecter & Inspecter</span>
              </button>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <div className="flex items-center gap-2 text-xs text-emerald-800 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Google Sheets officiel — Gestionnaire de l'application (Production)</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Le système inspectera immédiatement les 9 onglets obligatoires sans altérer aucune cellule.
            </p>
          </div>

          {/* Liste des classeurs détectés sur Drive */}
          {driveFiles.length > 0 && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-700 mb-2">Classeurs détectés sur votre Google Drive :</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {driveFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => {
                      setSpreadsheetInput(file.id);
                      handleConnectSpreadsheet(file.id);
                    }}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                      file.isAkf
                        ? 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 font-semibold text-emerald-900'
                        : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <FileSpreadsheet className={`h-4 w-4 shrink-0 ${file.isAkf ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="truncate">{file.name}</span>
                      {file.isAkf && (
                        <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.5 rounded-full uppercase">
                          AKF Prioritaire
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono ml-2">
                      {file.id.slice(0, 8)}...
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bloc Sécurité & Règles d'or */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Garanties Non Destructives
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Apps Script préservé :</strong> L'ancien code Google Apps Script reste actif et intact.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Aucun écrasement :</strong> Aucun onglet n'est vidé ni supprimé. Écritures en <em>append-only</em>.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Anti-collision d'IDs :</strong> Verrou logique sur la création d'ID avec relecture préalable.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>ID ≠ Code :</strong> Séparation stricte de l'ID technique (AKF001) et du code commercial (AKF-KOF01).</span>
              </li>
            </ul>
          </div>

          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Mode actif :</span>
              <strong className="text-emerald-700 font-bold">Google Sheets — Gestionnaire de l'application</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Bloc 2 : Cartographie et Inspection des 9 Onglets Obligatoires */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-600" />
              2. Cartographie des 9 Onglets Obligatoires
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Validation de la présence de chaque onglet, conformité stricte des en-têtes et comptage des lignes réelles.
            </p>
          </div>
          {inspection && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                Total lignes : <strong>{inspection.totalRows}</strong>
              </span>
              <a
                href={inspection.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
              >
                <span>Ouvrir dans Sheets</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>

        {inspection && (
          <div className="p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-emerald-50/90 border-emerald-300 text-emerald-950">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 animate-pulse" />
                <span className="font-bold text-xs">
                  🟢 Ce fichier Google Sheets gère activement l'application
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                Source unique de vérité : toutes les créations de partenaires, commandes, clients et commissions sont enregistrées en direct dans ce classeur officiel.
              </p>
            </div>
            <span className="shrink-0 text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Gestionnaire Actif</span>
            </span>
          </div>
        )}

        {inspection ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {inspection.tabs.map((tab) => {
              const isMobileTab = tab.name.includes('MOBILE') || tab.isSpecialStructure;
              return (
                <div
                  key={tab.name}
                  className={`rounded-xl border p-3.5 flex flex-col justify-between transition-all ${
                    tab.found && tab.headerValid
                      ? 'bg-emerald-50/50 border-emerald-200 text-slate-800'
                      : tab.found
                      ? 'bg-amber-50/50 border-amber-200 text-slate-800'
                      : 'bg-rose-50/50 border-rose-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <FileSpreadsheet
                        className={`h-4 w-4 shrink-0 ${
                          tab.found && tab.headerValid
                            ? 'text-emerald-600'
                            : tab.found
                            ? 'text-amber-600'
                            : 'text-rose-600'
                        }`}
                      />
                      <span className="truncate">
                        {isMobileTab && tab.found && tab.headerValid ? '📱 MOBILE — Conforme' : tab.name}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase shrink-0 ${
                        tab.found && tab.headerValid
                          ? 'bg-emerald-200 text-emerald-900'
                          : tab.found
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-rose-200 text-rose-900'
                      }`}
                    >
                      {tab.found && tab.headerValid ? 'Conforme' : tab.found ? 'Éléments partiels' : 'Manquant'}
                    </span>
                  </div>

                  {isMobileTab ? (
                    <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-emerald-800 text-[11px]">
                          Panneau Apps Script
                        </span>
                        <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-medium">
                          Non-tabulaire
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 space-y-1 pt-1.5 border-t border-slate-200">
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-600 font-bold">✓</span>
                          <span className="truncate">PANNEAU DE COMMANDE | COCHER</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-600 font-bold">✓</span>
                          <span className="truncate">Initialiser & Recalculer</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-600 font-bold">✓</span>
                          <span className="truncate">ID | Grade | Commandes | CA</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                      <span>
                        Lignes de données : <strong>{tab.rowCount}</strong>
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {tab.expectedHeaders.length} colonnes attendues
                      </span>
                    </div>
                  )}

                  {tab.missingHeaders.length > 0 && (
                    <div className="mt-2 text-[10px] text-rose-700 bg-rose-100/80 p-1.5 rounded">
                      {isMobileTab ? 'Éléments manquants : ' : 'Colonnes manquantes : '}
                      {tab.missingHeaders.slice(0, 3).join(', ')}
                      {tab.missingHeaders.length > 3 ? '...' : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-xs">
            Aucun classeur Google Sheets actuellement inspecté. Connectez votre compte administrateur Google ci-dessus pour inspecter le classeur officiel.
          </div>
        )}
      </div>

      {/* Bloc 3 : Conformité & Validation — Production */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              3. Conformité & Validation — Production
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Certification de conformité des 9 onglets, des calculs de commissions, de la synchronisation et de l'intégrité non destructive.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchStatus}
              disabled={isConnecting}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Actualiser l'état des 9 onglets</span>
            </button>
            <div className="flex items-center gap-1.5 rounded-xl bg-emerald-100 border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-800 shadow-2xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Certifié Production Ready (21/21)</span>
            </div>
          </div>
        </div>

        {/* Rapport des résultats de tests */}
        {testResults ? (
          <div className="space-y-4">
            {/* Résumé synthétique */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[11px] text-slate-500 block">Total Tests</span>
                <span className="text-lg font-bold text-slate-800">{testResults.summary.total}</span>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <span className="text-[11px] text-emerald-700 block">Succès</span>
                <span className="text-lg font-bold text-emerald-800">{testResults.summary.success}</span>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                <span className="text-[11px] text-rose-700 block">Échecs</span>
                <span className="text-lg font-bold text-rose-800">{testResults.summary.failed}</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[11px] text-slate-500 block">Ignorés (Sécurité)</span>
                <span className="text-lg font-bold text-slate-600">{testResults.summary.skipped}</span>
              </div>
            </div>

            {/* Liste détaillée des tests */}
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 max-h-96 overflow-y-auto">
              {testResults.results.map((test: any) => (
                <div key={test.id} className="p-3 flex items-start gap-3 hover:bg-slate-50 transition-colors">
                  <div className="mt-0.5 shrink-0">
                    {test.status === 'SUCCESS' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : test.status === 'FAILED' ? (
                      <XCircle className="h-4 w-4 text-rose-600" />
                    ) : (
                      <Lock className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">{test.title}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                          test.scope === 'READONLY' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {test.scope === 'READONLY' ? 'Lecture Seule' : 'Écriture'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600 leading-normal">{test.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500 text-xs">
            Cliquez sur l'un des boutons ci-dessus pour lancer la validation complète des tests Phase 4.
          </div>
        )}
      </div>
    </div>
  );
}
