import React, { useState, useEffect } from 'react';
import {
  Code2,
  Sparkles,
  AlertTriangle,
  FileCode,
  CheckCircle2,
  RefreshCw,
  Search,
  Stethoscope,
  Wrench,
  BookOpen,
  FolderTree,
  History as HistoryIcon,
  Info,
  Layers,
} from 'lucide-react';
import {
  ScriptFile,
  AiAnalysisResponse,
  ProjectFileSummary,
  AnalysisHistoryItem,
} from '../../../server/aiService';
import { AiAnalysisResultPanel } from './AiAnalysisResultPanel';
import { AiFileExplorerPanel } from './AiFileExplorerPanel';
import { AiHistoryPanel } from './AiHistoryPanel';

export interface AkfCodeAiViewProps {
  onLogCreated?: () => void;
}

// Fichiers historiques Apps Script (.gs) conservés comme référence documentaire
const HISTORICAL_GAS_FILES: ScriptFile[] = [
  {
    name: 'Partners.gs',
    type: 'gs',
    content: `/**
 * [RÉFÉRENCE HISTORIQUE - NON EXÉCUTÉE]
 * Module Partenaires AKF - Google Apps Script (Ancien système)
 * Conservé à titre documentaire pour consultation des anciennes formules.
 */
function getPartnerByCode(code) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PARTENAIRES");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === code) {
      return { id: data[i][0], code: data[i][1], name: data[i][2], rank: data[i][7] };
    }
  }
  return null;
}

function updatePartnerStats(code, amount) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PARTENAIRES");
  var nextRank = calculateNewRankThreshold(code, amount);
  sheet.appendRow([new Date(), code, amount, nextRank]);
}`,
  },
  {
    name: 'Commissions.gs',
    type: 'gs',
    content: `/**
 * [RÉFÉRENCE HISTORIQUE - NON EXÉCUTÉE]
 * Module Commissions AKF - Google Apps Script (Ancien système)
 * Règles historiques de calcul des commissions partenaires.
 */
function computeCommissionForOrder(partnerRank, totalAmount, isPremium, clientOrderRank) {
  // Règle AKF : maximum 3 commandes Premium commissionnées
  if (isPremium && clientOrderRank > 3) {
    return 0;
  }

  var rate = 0.06; // Neo
  if (partnerRank === "Ambassador") {
    rate = 0.08;
  } else if (partnerRank === "Excellence") {
    rate = 0.10;
  } else if (partnerRank === "Signature") {
    rate = 0.12;
  }

  return totalAmount * rate;
}`,
  },
];

type PipelineStepStatus = 'À faire' | 'En cours' | 'Terminé' | 'Bloqué';

interface StepState {
  id: number;
  code: string;
  label: string;
  description: string;
  status: PipelineStepStatus;
}

export function AkfCodeAiView({ onLogCreated }: AkfCodeAiViewProps) {
  // Mode source
  const [sourceMode, setSourceMode] = useState<'CURRENT_CODE' | 'HISTORICAL_GAS'>('CURRENT_CODE');

  // Navigation interne
  const [activeTab, setActiveTab] = useState<'PIPELINE' | 'FILE_EXPLORER' | 'HISTORY' | 'HISTORICAL_REF'>('PIPELINE');

  // Catalogue des fichiers réels du projet
  const [catalog, setCatalog] = useState<ProjectFileSummary[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [selectedFileSummary, setSelectedFileSummary] = useState<ProjectFileSummary | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string>('');
  const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState<string>('ALL');

  // Demande utilisateur & type d'action rapide
  const [instruction, setInstruction] = useState(
    'Expliquer comment la mise à jour automatique de la date de la dernière commande (DERNIÈRE COMMANDE) est implémentée pour chaque client et vérifier la conformité avec la règle d’or des commissions.'
  );
  const [actionType, setActionType] = useState<string>('EXPLAIN');
  const [customContext, setCustomContext] = useState('');
  const [showContextField, setShowContextField] = useState(false);

  // Exécution pipeline
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AiAnalysisResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Validation
  const [validationState, setValidationState] = useState<'PENDING' | 'VALIDATED' | 'REJECTED'>('PENDING');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [decisionFeedback, setDecisionFeedback] = useState<string | null>(null);

  // Historique des analyses
  const [historyList, setHistoryList] = useState<AnalysisHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // État des 8 étapes du pipeline
  const [pipelineSteps, setPipelineSteps] = useState<StepState[]>([
    { id: 1, code: 'EXTRACTION', label: '1. Extraction', description: 'Lecture ciblée des fichiers réels & construction du graphe', status: 'À faire' },
    { id: 2, code: 'ANALYSIS', label: '2. Analyse', description: 'Examen des règles métier & recherche des causes profondes', status: 'À faire' },
    { id: 3, code: 'IMPACT', label: '3. Impact', description: 'Évaluation des impacts (fichiers, routes, Google Sheets)', status: 'À faire' },
    { id: 4, code: 'STRATEGY', label: '4. Stratégie', description: 'Élaboration de la proposition technique de correction', status: 'À faire' },
    { id: 5, code: 'DIFF', label: '5. Diff Ligne', description: 'Génération du diff vérifiable sans supposition', status: 'À faire' },
    { id: 6, code: 'REVISED_CODE', label: '6. Code Révisé', description: 'Production du code complet révisé certifié', status: 'À faire' },
    { id: 7, code: 'HUMAN_CHECK', label: '7. Validation', description: 'Point de contrôle et validation humaine explicite', status: 'À faire' },
    { id: 8, code: 'REPORT', label: '8. Rapport', description: 'Synthèse finale téléchargeable et traçabilité', status: 'À faire' },
  ]);

  // Actions rapides préconfigurées
  const quickActions = [
    {
      id: 'EXPLAIN',
      label: 'Comprendre une règle',
      icon: BookOpen,
      color: 'bg-blue-950/40 border-blue-500 text-blue-300',
      defaultInstruction: 'Expliquer en détail le calcul du solde partenaire (Solde = Commissions validées − Commissions payées) avec preuves extraites du moteur akfEngine.ts.',
    },
    {
      id: 'DIAGNOSTIC',
      label: 'Diagnostiquer un bug',
      icon: Stethoscope,
      color: 'bg-rose-950/40 border-rose-500 text-rose-300',
      defaultInstruction: 'Vérifier si un partenaire peut avoir un solde négatif et analyser les protections de verrouillage sur la route POST /api/payments.',
    },
    {
      id: 'COMPLIANCE',
      label: 'Audit des commissions',
      icon: CheckCircle2,
      color: 'bg-emerald-950/40 border-emerald-500 text-emerald-300',
      defaultInstruction: 'Vérifier que la règle d’or des 3 premières commandes Premium est strictement respectée pour les calculs de commission de chaque client.',
    },
    {
      id: 'SHEETS_IMPACT',
      label: 'Audit Google Sheets',
      icon: FolderTree,
      color: 'bg-amber-950/40 border-amber-500 text-amber-300',
      defaultInstruction: 'Analyser la conformité des 17 colonnes de l’onglet PARTENAIRES et des 14 colonnes de l’onglet Clients avec le code de googleSheetsService.ts.',
    },
    {
      id: 'EVOLUTION',
      label: 'Proposer une évolution',
      icon: Wrench,
      color: 'bg-purple-950/40 border-purple-500 text-purple-300',
      defaultInstruction: 'Proposer une fonction d’export JSON de conformité avec calcul de hash d’intégrité sans altérer le comportement existant.',
    },
    {
      id: 'AUDIT_CURRENT',
      label: 'Audit Global',
      icon: Sparkles,
      color: 'bg-indigo-950/40 border-indigo-500 text-indigo-300',
      defaultInstruction: 'Vérification complète de la cohérence entre akfEngine.ts, googleSheetsRepository.ts et les routes Express de server.ts.',
    },
  ];

  // Chargement initial
  useEffect(() => {
    loadCatalog();
    loadHistory();
  }, []);

  const loadCatalog = async () => {
    try {
      setIsLoadingCatalog(true);
      const res = await fetch('/api/ai/catalog');
      if (res.ok) {
        const data = await res.json();
        setCatalog(data.files || []);
      }
    } catch (e) {
      console.warn('Impossible de charger le catalogue de fichiers :', e);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const loadHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const res = await fetch('/api/ai/history');
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data || []);
      }
    } catch (e) {
      console.warn('Impossible de charger l’historique des analyses :', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSelectFileForPreview = async (file: ProjectFileSummary) => {
    setSelectedFileSummary(file);
    try {
      setIsLoadingFileContent(true);
      const res = await fetch(`/api/ai/file?path=${encodeURIComponent(file.path)}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedFileContent(data.content || '');
      } else {
        setSelectedFileContent('// Impossible de lire le contenu du fichier');
      }
    } catch (e: any) {
      setSelectedFileContent(`// Erreur lors du chargement : ${e.message}`);
    } finally {
      setIsLoadingFileContent(false);
    }
  };

  const handleSelectQuickAction = (act: typeof quickActions[0]) => {
    setActionType(act.id);
    setInstruction(act.defaultInstruction);
  };

  const updateStepStatus = (stepId: number, status: PipelineStepStatus) => {
    setPipelineSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, status } : s))
    );
  };

  const handleRunAnalysis = async () => {
    if (!instruction.trim()) {
      setErrorMsg('Veuillez renseigner votre demande ou choisir une action rapide.');
      return;
    }

    setErrorMsg(null);
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setValidationState('PENDING');
    setDecisionFeedback(null);

    // Réinitialisation des étapes
    setPipelineSteps((prev) =>
      prev.map((s) => ({ ...s, status: s.id === 1 ? 'En cours' : 'À faire' }))
    );

    try {
      // Simuler l'avancement visuel des premières étapes
      setTimeout(() => updateStepStatus(1, 'Terminé'), 800);
      setTimeout(() => updateStepStatus(2, 'En cours'), 900);
      setTimeout(() => updateStepStatus(2, 'Terminé'), 1800);
      setTimeout(() => updateStepStatus(3, 'En cours'), 1900);

      const endpoint = sourceMode === 'CURRENT_CODE' ? '/api/ai/analyze-current' : '/api/ai/analyze';
      const payload =
        sourceMode === 'CURRENT_CODE'
          ? {
              instruction: instruction.trim(),
              actionType,
              context: customContext.trim() || undefined,
            }
          : {
              files: HISTORICAL_GAS_FILES,
              instruction: instruction.trim(),
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erreur serveur (${res.status})`);
      }

      const data: AiAnalysisResponse = await res.json();
      setAnalysisResult(data);

      // Mettre à jour les étapes restantes
      setPipelineSteps((prev) =>
        prev.map((s) => ({
          ...s,
          status: s.id <= 6 ? 'Terminé' : s.id === 7 ? 'En cours' : 'À faire',
        }))
      );

      // Recharger l'historique
      loadHistory();
      if (onLogCreated) onLogCreated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de l’analyse IA');
      setPipelineSteps((prev) =>
        prev.map((s) => (s.status === 'En cours' ? { ...s, status: 'Bloqué' } : s))
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleHumanDecision = async (decision: 'VALIDATED' | 'REJECTED') => {
    if (!analysisResult) return;

    try {
      setIsSubmittingDecision(true);
      const res = await fetch('/api/ai/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: (analysisResult as any).id || `AI-ANALYSIS-${Date.now()}`,
          decision,
          notes:
            decision === 'VALIDATED'
              ? 'Modification expressément certifiée et validée par l’administrateur.'
              : 'Proposition rejetée par décision de l’administrateur.',
        }),
      });

      if (res.ok) {
        setValidationState(decision);
        setDecisionFeedback(
          decision === 'VALIDATED'
            ? 'Décision enregistrée : Modification validée et consignée dans le registre d’audit.'
            : 'Décision enregistrée : Proposition rejetée. Le code de production reste inchangé.'
        );
        updateStepStatus(7, 'Terminé');
        updateStepStatus(8, 'Terminé');
        loadHistory();
        if (onLogCreated) onLogCreated();
      }
    } catch (e: any) {
      setDecisionFeedback(`Erreur lors de l’enregistrement de la décision : ${e.message}`);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const handleDownloadFullReport = () => {
    if (!analysisResult) return;
    const reportText = JSON.stringify(analysisResult, null, 2);
    const blob = new Blob([reportText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AKF-CODE-AI-RAPPORT-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* BANNIÈRE SUPÉRIEURE : PRÉSENTATION AKF CODE AI */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] border border-indigo-500/30 p-6 sm:p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>AKF CODE AI — Système Expert de Maintenance & Traçabilité</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Analyse & Évolution Sécurisée du Code
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              Moteur IA d'audit, de diagnostic et de génération de patchs vérifiables avec preuves matérielles.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/80 p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={() => setSourceMode('CURRENT_CODE')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  sourceMode === 'CURRENT_CODE'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Code Actuel</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('HISTORICAL_GAS')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  sourceMode === 'HISTORICAL_GAS'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Apps Script (.gs)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ONGLET DE NAVIGATION INTERNE */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('PIPELINE')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'PIPELINE'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Pipeline d'Analyse</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('FILE_EXPLORER')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'FILE_EXPLORER'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span>Explorateur de Code</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('HISTORY')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'HISTORY'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <HistoryIcon className="w-3.5 h-3.5" />
          <span>Journal d’Audit</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('HISTORICAL_REF')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'HISTORICAL_REF'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Référence Apps Script (.gs)</span>
        </button>
      </div>

      {/* VUE 1 : PIPELINE D'ANALYSE */}
      {activeTab === 'PIPELINE' && (
        <div className="space-y-8">
          {/* SECTION DEMANDE & RACCOURCIS RAPIDES */}
          <div className="bg-[#1e293b] border border-slate-700/80 rounded-2xl p-6 shadow-lg space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-400" />
                Demande d’analyse ou d’évolution
              </h2>
              <span className="text-xs text-slate-400">
                Source active :{' '}
                <strong className={sourceMode === 'CURRENT_CODE' ? 'text-emerald-400' : 'text-amber-400'}>
                  {sourceMode === 'CURRENT_CODE' ? 'Code source actuel (TypeScript / Express)' : 'Apps Script historique'}
                </strong>
              </span>
            </div>

            {/* RACCOURCIS DE DEMANDES RAPIDES */}
            <div className="space-y-2">
              <div className="text-xs text-slate-400 font-medium">Types de demande rapides :</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {quickActions.map((act) => {
                  const Icon = act.icon;
                  const isSelected = actionType === act.id;
                  return (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => handleSelectQuickAction(act)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                        isSelected
                          ? `${act.color} ring-2 ring-indigo-500/50 font-semibold shadow-md`
                          : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4 mb-1.5" />
                      <span className="text-xs">{act.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* GRAND CHAMP TEXTE DE DEMANDE */}
            <div className="space-y-2">
              <label htmlFor="user-instruction" className="text-xs font-medium text-slate-300">
                Décrivez votre problème, votre question ou l’évolution souhaitée :
              </label>
              <textarea
                id="user-instruction"
                rows={4}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Ex : Expliquer comment la colonne DERNIÈRE COMMANDE est mise à jour pour chaque client..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-sans resize-y"
              />
            </div>

            {/* Contexte optionnel */}
            <div>
              <button
                type="button"
                onClick={() => setShowContextField(!showContextField)}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
              >
                {showContextField ? 'Masquer les précisions' : 'Ajouter des précisions ou contraintes'}
              </button>
              {showContextField && (
                <div className="mt-2">
                  <textarea
                    rows={2}
                    value={customContext}
                    onChange={(e) => setCustomContext(e.target.value)}
                    placeholder="Contraintes spécifiques (ex : ne pas toucher à l’ordre des colonnes du classeur...)"
                    className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* BOUTON LANCER L'ANALYSE */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Info className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Règle d’or : Ne rien inventer. Les affirmations sont étayées par des extraits réels avec numéros de lignes.</span>
              </div>

              <button
                type="button"
                onClick={handleRunAnalysis}
                disabled={isAnalyzing}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-sm shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyse du code source en cours...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Lancer l’analyse</span>
                  </>
                )}
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* PROGRESSION DU PIPELINE EN 8 ÉTAPES */}
          <div className="bg-[#1e293b] border border-slate-700/80 rounded-2xl p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  Progression du pipeline en 8 étapes
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Chaque étape est tracée et vérifiable avec statut en temps réel
                </p>
              </div>
              <div className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {pipelineSteps.filter((s) => s.status === 'Terminé').length} / 8 terminées
              </div>
            </div>

            {/* GRILLE DES 8 ÉTAPES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {pipelineSteps.map((step) => {
                const isDone = step.status === 'Terminé';
                const isRunning = step.status === 'En cours';
                const isBlocked = step.status === 'Bloqué';

                return (
                  <div
                    key={step.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isDone
                        ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                        : isRunning
                        ? 'bg-indigo-950/30 border-indigo-500/50 text-indigo-200 ring-1 ring-indigo-500/30'
                        : isBlocked
                        ? 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                        : 'bg-slate-800/50 border-slate-700/60 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold tracking-wide uppercase">{step.label}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          isDone
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : isRunning
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse'
                            : isBlocked
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-slate-700/50 text-slate-400'
                        }`}
                      >
                        {step.status}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed line-clamp-2">{step.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RÉSULTATS DÉTAILLÉS DE L'ANALYSE */}
          {analysisResult && (
            <AiAnalysisResultPanel
              analysisResult={analysisResult}
              validationState={validationState}
              isSubmittingDecision={isSubmittingDecision}
              decisionFeedback={decisionFeedback}
              onHumanDecision={handleHumanDecision}
              onDownloadFullReport={handleDownloadFullReport}
            />
          )}
        </div>
      )}

      {/* VUE 2 : EXPLORATEUR DU CODE SOURCE ACTUEL DU PROJET */}
      {activeTab === 'FILE_EXPLORER' && (
        <AiFileExplorerPanel
          catalog={catalog}
          isLoadingCatalog={isLoadingCatalog}
          selectedFileSummary={selectedFileSummary}
          selectedFileContent={selectedFileContent}
          isLoadingFileContent={isLoadingFileContent}
          catalogFilter={catalogFilter}
          setCatalogFilter={setCatalogFilter}
          onLoadCatalog={loadCatalog}
          onSelectFile={handleSelectFileForPreview}
        />
      )}

      {/* VUE 3 & 4 : HISTORIQUE & RÉFÉRENCE GAS */}
      {(activeTab === 'HISTORY' || activeTab === 'HISTORICAL_REF') && (
        <AiHistoryPanel
          historyList={historyList}
          isLoadingHistory={isLoadingHistory}
          onLoadHistory={loadHistory}
          historicalFiles={HISTORICAL_GAS_FILES}
          onAuditHistoricalRef={() => {
            setSourceMode('HISTORICAL_GAS');
            setActiveTab('PIPELINE');
          }}
          showTab={activeTab}
        />
      )}
    </div>
  );
}
