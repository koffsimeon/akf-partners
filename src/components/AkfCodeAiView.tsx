import React, { useState, useEffect } from 'react';
import {
  Code2,
  Sparkles,
  AlertTriangle,
  FileCode,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Copy,
  Download,
  Check,
  X,
  FileText,
  ShieldCheck,
  ChevronRight,
  Eye,
  GitCompare,
  Terminal,
  Layers,
  ArrowRight,
  Search,
  Stethoscope,
  Wrench,
  BarChart3,
  BookOpen,
  Clock,
  Lock,
  FolderTree,
  Database,
  ExternalLink,
  History as HistoryIcon,
  ShieldAlert,
  Info,
} from 'lucide-react';
import {
  ScriptFile,
  AiAnalysisResponse,
  FileDiff,
  ProjectFileSummary,
  VerifiableCodeProof,
  AnalysisHistoryItem,
  GoogleSheetsTabImpact,
} from '../../server/aiService';

interface AkfCodeAiViewProps {
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

  // Diff et validation
  const [diffMode, setDiffMode] = useState<'unified' | 'side-by-side'>('unified');
  const [selectedDiffIndex, setSelectedDiffIndex] = useState(0);
  const [validationState, setValidationState] = useState<'PENDING' | 'VALIDATED' | 'REJECTED'>('PENDING');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [decisionFeedback, setDecisionFeedback] = useState<string | null>(null);

  // Historique des analyses
  const [historyList, setHistoryList] = useState<AnalysisHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Copie code / rapport
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedProofIndex, setCopiedProofIndex] = useState<number | null>(null);

  // Fichiers Apps Script historiques (référence uniquement)
  const [historicalFiles] = useState<ScriptFile[]>(HISTORICAL_GAS_FILES);
  const [activeHistoricalIndex, setActiveHistoricalIndex] = useState(0);

  // Charger le catalogue et l'historique au montage
  useEffect(() => {
    loadCatalog();
    loadHistory();
  }, []);

  const loadCatalog = async () => {
    try {
      setIsLoadingCatalog(true);
      const res = await fetch('/api/ai/source-catalog');
      if (res.ok) {
        const data = await res.json();
        setCatalog(data.files || []);
        if (data.files && data.files.length > 0) {
          setSelectedFileSummary(data.files[0]);
          loadFileContent(data.files[0].path);
        }
      }
    } catch (e) {
      console.warn('Impossible de charger le catalogue de fichiers:', e);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const loadFileContent = async (filePath: string) => {
    try {
      setIsLoadingFileContent(true);
      const res = await fetch(`/api/ai/read-file?path=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedFileContent(data.content || '');
      } else {
        setSelectedFileContent('// Impossible de lire le fichier');
      }
    } catch (e) {
      setSelectedFileContent('// Erreur de lecture');
    } finally {
      setIsLoadingFileContent(false);
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
      console.warn('Impossible de charger l’historique:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Types de demandes rapides
  const quickActions = [
    {
      id: 'AUDIT',
      label: 'Auditer',
      icon: Search,
      color: 'border-blue-500 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20',
      defaultText:
        'Auditer le code actuel de l’application pour vérifier la conformité des flux, les règles de commissions et la persistance dans Google Sheets.',
    },
    {
      id: 'DIAGNOSTIC',
      label: 'Diagnostiquer',
      icon: Stethoscope,
      color: 'border-amber-500 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20',
      defaultText:
        'Diagnostiquer les éventuels points de fragilité, les dépendances critiques et les risques de collision sur les écritures Google Sheets.',
    },
    {
      id: 'EVOLVE',
      label: 'Faire évoluer',
      icon: Wrench,
      color: 'border-indigo-500 text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20',
      defaultText:
        'Proposer une évolution maîtrisée pour enrichir les informations synchronisées avec Google Sheets sans modifier les règles métier validées.',
    },
    {
      id: 'IMPACT',
      label: 'Analyser l’impact',
      icon: BarChart3,
      color: 'border-emerald-500 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20',
      defaultText:
        'Analyser l’impact d’une modification de la structure de données sur les routes API, les services et les colonnes du classeur Google Sheets.',
    },
    {
      id: 'CORRECTION',
      label: 'Proposer une correction',
      icon: GitCompare,
      color: 'border-rose-500 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20',
      defaultText:
        'Proposer une correction sécurisée avec diff ligne par ligne et code source complet sans rien modifier automatiquement.',
    },
    {
      id: 'EXPLAIN',
      label: 'Expliquer le code',
      icon: BookOpen,
      color: 'border-sky-500 text-sky-400 bg-sky-500/10 hover:bg-sky-500/20',
      defaultText:
        'Expliquer comment la mise à jour automatique de la date de dernière commande est implémentée pour chaque client et vérifier la conformité avec la règle d’or des commissions.',
    },
  ];

  const handleSelectQuickAction = (act: (typeof quickActions)[0]) => {
    setActionType(act.id);
    setInstruction(act.defaultText);
  };

  // Calcul dynamique des 8 étapes du pipeline
  const pipelineSteps: StepState[] = [
    {
      id: 1,
      code: 'ANALYSE',
      label: '1. Analyse',
      description: 'Cartographie de l’architecture et des faits observés',
      status: isAnalyzing ? 'En cours' : analysisResult ? 'Terminé' : 'À faire',
    },
    {
      id: 2,
      code: 'DIAGNOSTIC',
      label: '2. Diagnostic',
      description: 'Identification des anomalies avec preuves vérifiables',
      status: isAnalyzing ? 'En cours' : analysisResult ? 'Terminé' : 'À faire',
    },
    {
      id: 3,
      code: 'IMPACT',
      label: '3. Impact',
      description: 'Évaluation des fichiers, routes et colonnes Sheets',
      status: isAnalyzing ? 'En cours' : analysisResult ? 'Terminé' : 'À faire',
    },
    {
      id: 4,
      code: 'PROPOSITION',
      label: '4. Proposition',
      description: 'Solution structurée et conséquences sans invention',
      status: isAnalyzing ? 'En cours' : analysisResult ? 'Terminé' : 'À faire',
    },
    {
      id: 5,
      code: 'DIFF',
      label: '5. Diff',
      description: 'Comparaison ligne par ligne (Ajouts / Suppressions)',
      status: isAnalyzing ? 'En cours' : analysisResult ? 'Terminé' : 'À faire',
    },
    {
      id: 6,
      code: 'CODE',
      label: '6. Code Source',
      description: 'Fichier complet révisé prêt pour inspection',
      status: isAnalyzing ? 'En cours' : analysisResult ? 'Terminé' : 'À faire',
    },
    {
      id: 7,
      code: 'VALIDATION',
      label: '7. Validation Humaine',
      description: 'Décision explicite obligatoire de l’administrateur',
      status:
        validationState === 'VALIDATED'
          ? 'Terminé'
          : validationState === 'REJECTED'
          ? 'Bloqué'
          : analysisResult
          ? 'En cours'
          : 'À faire',
    },
    {
      id: 8,
      code: 'EXPORT',
      label: '8. Export / Intégration',
      description: 'Copie ou exportation du code et des tests',
      status:
        validationState === 'VALIDATED'
          ? 'Terminé'
          : validationState === 'REJECTED'
          ? 'Bloqué'
          : 'À faire',
    },
  ];

  // Lancement de l'analyse sur le code actuel ou Apps Script
  const handleRunAnalysis = async () => {
    if (!instruction.trim()) {
      setErrorMsg('Veuillez spécifier votre question ou instruction.');
      return;
    }

    try {
      setIsAnalyzing(true);
      setErrorMsg(null);
      setAnalysisResult(null);
      setValidationState('PENDING');
      setDecisionFeedback(null);
      setActiveTab('PIPELINE');

      if (sourceMode === 'CURRENT_CODE') {
        const response = await fetch('/api/ai/analyze-current', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instruction,
            actionType,
            context: customContext,
          }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Erreur lors de l’analyse du code actuel.');
        }

        const data: AiAnalysisResponse = await response.json();
        setAnalysisResult(data);
      } else {
        // Mode Apps Script historique (référence uniquement)
        const response = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: historicalFiles,
            instruction,
            context: customContext,
          }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Erreur lors de l’analyse Apps Script.');
        }

        const data: AiAnalysisResponse = await response.json();
        setAnalysisResult(data);
      }

      await loadHistory();
      if (onLogCreated) onLogCreated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Échec de l’analyse');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Soumission de la décision humaine (Étape 7)
  const handleHumanDecision = async (decision: 'VALIDATED' | 'REJECTED') => {
    if (!analysisResult) return;

    try {
      setIsSubmittingDecision(true);
      const res = await fetch('/api/ai/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          proposalTitle: analysisResult.proposal.title,
          files: analysisResult.proposal.filesToModify,
          reason:
            decision === 'VALIDATED'
              ? 'Validation explicite accordée par l’administrateur après revue du diff.'
              : 'Proposition rejetée par l’administrateur.',
          analysisId: (analysisResult as any).analysisId,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setValidationState(decision);
        setDecisionFeedback(data.message);
        await loadHistory();
        if (onLogCreated) onLogCreated();
      } else {
        setDecisionFeedback(`Erreur : ${data.error}`);
      }
    } catch (e: any) {
      setDecisionFeedback(`Erreur de communication : ${e.message}`);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyProof = (snippet: string, index: number) => {
    navigator.clipboard.writeText(snippet);
    setCopiedProofIndex(index);
    setTimeout(() => setCopiedProofIndex(null), 2000);
  };

  const handleDownloadFullReport = () => {
    if (!analysisResult) return;
    const reportText = JSON.stringify(analysisResult, null, 2);
    const blob = new Blob([reportText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-akf-code-ai-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtrage du catalogue
  const filteredCatalog = catalog.filter((item) => {
    if (catalogFilter === 'ALL') return true;
    return item.category === catalogFilter;
  });

  const categories = [
    { id: 'ALL', label: 'Tous les fichiers' },
    { id: 'ENGINE', label: 'Moteur central (akfEngine)' },
    { id: 'GOOGLE_SHEETS_SERVICE', label: 'Service Sheets API' },
    { id: 'REPOSITORIES', label: 'Dépôts (Repositories)' },
    { id: 'API_ROUTES', label: 'Routes API (server.ts)' },
    { id: 'TYPES', label: 'Types TypeScript' },
    { id: 'REACT_COMPONENTS', label: 'Composants React' },
    { id: 'CONFIG', label: 'Configurations' },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* 1. EN-TÊTE PRINCIPAL AVEC INDICATEUR DE SOURCE */}
      <div className="bg-[#1e293b] border border-slate-700/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg shadow-indigo-500/20">
                <Code2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  AKF CODE AI
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold tracking-normal">
                    Moteur de Maintenance v2.0
                  </span>
                </h1>
                <p className="text-sm text-slate-400">
                  Assistant d’ingénierie et de conformité pour l’application AKF PARTNERS
                </p>
              </div>
            </div>
          </div>

          {/* INDICATEURS DE SOURCE OFFICIELS */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Indicateur Source Principale */}
            <div
              className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs font-medium transition-all ${
                sourceMode === 'CURRENT_CODE'
                  ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-300 ring-1 ring-emerald-500/30'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
              } cursor-pointer`}
              onClick={() => setSourceMode('CURRENT_CODE')}
              title="Le code actuel de l'application est la source de vérité principale"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <div className="flex flex-col">
                <span className="font-semibold text-emerald-200">Code actuel accessible</span>
                <span className="text-[10px] text-emerald-400/80">Lecture seule ({catalog.length} fichiers réels)</span>
              </div>
            </div>

            {/* Indicateur Référence Historique Apps Script */}
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                sourceMode === 'HISTORICAL_GAS'
                  ? 'bg-amber-950/50 border-amber-500/60 text-amber-300 ring-1 ring-amber-500/30'
                  : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-slate-300'
              } cursor-pointer`}
              onClick={() => setSourceMode('HISTORICAL_GAS')}
              title="Les fichiers Apps Script servent uniquement de référence historique"
            >
              <FileCode className="w-4 h-4 text-amber-400" />
              <div className="flex flex-col">
                <span className="text-amber-200">Apps Script historique</span>
                <span className="text-[10px] text-amber-400/80">Référence documentaire uniquement</span>
              </div>
            </div>

            {/* Sceau de Sécurité Absolue */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700 text-[11px] text-slate-300">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              <span>Zéro écriture automatique en prod</span>
            </div>
          </div>
        </div>

        {/* Barre de navigation des vues AKF CODE AI */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-800">
          <button
            onClick={() => setActiveTab('PIPELINE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'PIPELINE'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Pipeline d’analyse (8 étapes)
          </button>

          <button
            onClick={() => setActiveTab('FILE_EXPLORER')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'FILE_EXPLORER'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            Explorateur du code actuel ({catalog.length})
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'HISTORY'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <HistoryIcon className="w-3.5 h-3.5" />
            Historique & Audit ({historyList.length})
          </button>

          <button
            onClick={() => setActiveTab('HISTORICAL_REF')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'HISTORICAL_REF'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Ancien Apps Script (.gs)
          </button>
        </div>
      </div>

      {/* VUE 1 : PIPELINE D'ANALYSE EN 8 ÉTAPES */}
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
                {showContextField ? '▼ Masquer les précisions' : '▶ Ajouter des précisions ou contraintes'}
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
            <div className="space-y-8">
              {/* ÉTAPE 1 & 2 : PREUVES ET CONSTATS OBSERVÉS */}
              <div className="bg-[#1e293b] border border-slate-700/80 rounded-2xl p-6 shadow-lg space-y-6">
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">
                        1 & 2. Preuves vérifiables et Faits observés
                      </h3>
                      <p className="text-xs text-slate-400">
                        Zéro supposition : les éléments ci-dessous sont extraits du code réel sur disque
                      </p>
                    </div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                    Confiance : {analysisResult.confidence.score}% ({analysisResult.confidence.level})
                  </span>
                </div>

                {/* Synthèse de l'architecture */}
                <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 space-y-2">
                  <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    Synthèse architecturale :
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {analysisResult.analysis.architectureSummary}
                  </p>
                </div>

                {/* LISTE DES PREUVES VÉRIFIABLES */}
                {analysisResult.proofs && analysisResult.proofs.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-sky-400" />
                        Preuves matérielles extraites du code ({analysisResult.proofs.length})
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Fichier, fonction, lignes réelles et dépendances
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {analysisResult.proofs.map((proof, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-900 rounded-xl border border-slate-700/80 overflow-hidden shadow-sm"
                        >
                          <div className="bg-slate-800/90 px-4 py-2.5 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-sky-300">{proof.file}</span>
                              <span className="text-slate-500">›</span>
                              <span className="font-mono text-indigo-300 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-800/60">
                                {proof.componentOrFunction}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                (lignes {proof.startLine} à {proof.endLine})
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyProof(proof.codeSnippet, idx)}
                              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
                            >
                              {copiedProofIndex === idx ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copié</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copier l'extrait</span>
                                </>
                              )}
                            </button>
                          </div>

                          <div className="p-4 space-y-3">
                            <pre className="font-mono text-xs text-slate-300 bg-black/40 p-3 rounded-lg overflow-x-auto border border-slate-800/80 leading-relaxed">
                              {proof.codeSnippet}
                            </pre>

                            {proof.dependencies && proof.dependencies.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                                <span className="font-medium text-slate-300">Dépendances :</span>
                                {proof.dependencies.map((dep, dIdx) => (
                                  <span
                                    key={dIdx}
                                    className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono text-[10px]"
                                  >
                                    {dep}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="text-[11px] text-slate-400 italic">
                              {proof.explanation}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Faits observés & Déductions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800 space-y-2">
                    <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
                      Faits observés (100% vérifiés) :
                    </span>
                    <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                      {analysisResult.analysis.observedFacts.map((fact, fIdx) => (
                        <li key={fIdx} className="leading-relaxed">
                          {fact}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800 space-y-2">
                    <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                      Déductions logiques :
                    </span>
                    <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                      {analysisResult.analysis.deductions.map((ded, dIdx) => (
                        <li key={dIdx} className="leading-relaxed">
                          {ded}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Diagnostic & Bugs éventuels */}
                {analysisResult.diagnostic.bugs.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                      Anomalies détectées ({analysisResult.diagnostic.bugs.length}) :
                    </div>
                    {analysisResult.diagnostic.bugs.map((b, bIdx) => (
                      <div
                        key={bIdx}
                        className="p-3 bg-rose-950/30 border border-rose-800/60 rounded-xl text-xs text-rose-200 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <strong className="font-semibold">{b.description}</strong>
                          <span className="px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 text-[10px]">
                            {b.severity}
                          </span>
                        </div>
                        <p className="text-[11px] text-rose-300/80">{b.verifiedProof}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ÉTAPE 3 : ANALYSE D'IMPACT SUR LE CODE & GOOGLE SHEETS */}
              <div className="bg-[#1e293b] border border-slate-700/80 rounded-2xl p-6 shadow-lg space-y-6">
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">
                        3. Analyse d’Impact (Fichiers, Routes et Google Sheets)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Évaluation exhaustive du périmètre avant toute prise de décision
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Niveau de risque :</span>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                        analysisResult.impact.riskLevel === 'FAIBLE'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : analysisResult.impact.riskLevel === 'MOYEN'
                          ? 'bg-amber-950 text-amber-300 border border-amber-700'
                          : 'bg-rose-950 text-rose-300 border border-rose-700'
                      }`}
                    >
                      {analysisResult.impact.riskLevel}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Fichiers concernés */}
                  <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 space-y-2">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <FileCode className="w-4 h-4 text-indigo-400" />
                      Fichiers réels concernés :
                    </span>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {analysisResult.impact.affectedFiles.map((af, i) => (
                        <li key={i} className="font-mono text-indigo-300">
                          • {af}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Routes et services concernés */}
                  <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 space-y-2">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <ExternalLink className="w-4 h-4 text-sky-400" />
                      Routes & Services API :
                    </span>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {((analysisResult.impact as any).affectedRoutesServices || ['Service interne']).map((rs: string, i: number) => (
                        <li key={i} className="font-mono text-sky-300">
                          • {rs}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Risques de régression */}
                  <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 space-y-2">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                      Maîtrise des régressions :
                    </span>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {analysisResult.impact.regressionRisks.map((rr, i) => (
                        <li key={i}>• {rr}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Impact sur les onglets et colonnes Google Sheets */}
                {(analysisResult.impact as any).affectedGoogleSheetsTabsColumns &&
                  (analysisResult.impact as any).affectedGoogleSheetsTabsColumns.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Database className="w-4 h-4 text-emerald-400" />
                        Données Google Sheets potentiellement concernées :
                      </div>

                      <div className="border border-slate-800 rounded-xl overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-800/80 text-slate-400 uppercase font-medium">
                            <tr>
                              <th className="px-4 py-2.5">Onglet Google Sheets</th>
                              <th className="px-4 py-2.5">Colonnes concernées</th>
                              <th className="px-4 py-2.5">Description de l'impact</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {((analysisResult.impact as any).affectedGoogleSheetsTabsColumns as GoogleSheetsTabImpact[]).map(
                              (tabImpact, tIdx) => (
                                <tr key={tIdx} className="hover:bg-slate-800/30">
                                  <td className="px-4 py-3 font-semibold text-emerald-300">
                                    "{tabImpact.sheetTab}"
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-1">
                                      {tabImpact.columns.map((col, cIdx) => (
                                        <span
                                          key={cIdx}
                                          className="px-2 py-0.5 bg-slate-800 text-slate-200 border border-slate-700 rounded font-mono text-[10px]"
                                        >
                                          {col}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-slate-300">
                                    {tabImpact.impactDescription}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                {/* Tests recommandés */}
                {analysisResult.impact.recommendedTests && analysisResult.impact.recommendedTests.length > 0 && (
                  <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800 space-y-1.5">
                    <span className="text-xs font-semibold text-slate-300">Tests recommandés :</span>
                    <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                      {analysisResult.impact.recommendedTests.map((test, i) => (
                        <li key={i}>{test}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* ÉTAPE 4 & 5 : PROPOSITION ET DIFF LIGNE PAR LIGNE */}
              <div className="bg-[#1e293b] border border-slate-700/80 rounded-2xl p-6 shadow-lg space-y-6">
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg">
                      <GitCompare className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">
                        4 & 5. Proposition et Diff ligne par ligne
                      </h3>
                      <p className="text-xs text-slate-400">
                        {analysisResult.proposal.title}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDiffMode(diffMode === 'unified' ? 'side-by-side' : 'unified')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-all"
                    >
                      Mode : {diffMode === 'unified' ? 'Unifié (+ / -)' : 'Côte à côte'}
                    </button>
                  </div>
                </div>

                {/* Synthèse de la proposition */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1.5">
                    <span className="font-semibold text-slate-300">Cause racine :</span>
                    <p className="text-slate-300 leading-relaxed">{analysisResult.proposal.rootCause}</p>
                  </div>
                  <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1.5">
                    <span className="font-semibold text-emerald-300">Solution recommandée :</span>
                    <p className="text-slate-300 leading-relaxed">{analysisResult.proposal.recommendedSolution}</p>
                  </div>
                </div>

                {/* VUE DU DIFF RÉEL */}
                {analysisResult.diff && analysisResult.diff.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Eye className="w-4 h-4 text-indigo-400" />
                        Visualisation du Diff ({analysisResult.diff[selectedDiffIndex]?.fileName || 'Fichier'})
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-emerald-400 font-mono">
                          +
                          {
                            analysisResult.diff[selectedDiffIndex]?.chunks.filter((c) => c.type === 'addition')
                              .length
                          }{' '}
                          ajouts
                        </span>
                        <span className="text-[11px] text-rose-400 font-mono">
                          -
                          {
                            analysisResult.diff[selectedDiffIndex]?.chunks.filter((c) => c.type === 'deletion')
                              .length
                          }{' '}
                          suppr.
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
                      <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-slate-400 text-[11px]">
                        <span>{analysisResult.diff[selectedDiffIndex]?.fileName}</span>
                        <span>Diff calculé par AKF CODE AI</span>
                      </div>

                      <div className="max-h-96 overflow-y-auto divide-y divide-slate-900 p-2">
                        {analysisResult.diff[selectedDiffIndex]?.chunks.map((chunk, cIdx) => (
                          <div
                            key={cIdx}
                            className={`px-3 py-1 flex items-start gap-3 rounded ${
                              chunk.type === 'addition'
                                ? 'bg-emerald-950/40 text-emerald-200 border-l-2 border-emerald-500'
                                : chunk.type === 'deletion'
                                ? 'bg-rose-950/40 text-rose-200 border-l-2 border-rose-500'
                                : 'text-slate-400 hover:bg-slate-900/50'
                            }`}
                          >
                            <span className="w-8 text-[10px] text-slate-600 text-right select-none shrink-0">
                              {chunk.newLineNumber || chunk.oldLineNumber || ' '}
                            </span>
                            <span className="select-none font-bold w-3 text-center shrink-0">
                              {chunk.type === 'addition' ? '+' : chunk.type === 'deletion' ? '-' : ' '}
                            </span>
                            <span className="whitespace-pre-wrap break-all">{chunk.line}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ÉTAPE 6 & 7 : CODE PROPOSÉ ET VALIDATION HUMAINE OBLIGATOIRE */}
              <div className="bg-[#1e293b] border border-slate-700/80 rounded-2xl p-6 shadow-lg space-y-6">
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">
                        6 & 7. Code source révisé & Validation Humaine
                      </h3>
                      <p className="text-xs text-slate-400">
                        Aucune modification n'est appliquée sans validation explicite
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyCode(analysisResult.correctedFiles[0]?.fullCode || '')}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium transition-all"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Copié !' : 'Copier le code'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadFullReport}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Télécharger le rapport</span>
                    </button>
                  </div>
                </div>

                {/* VUE DU CODE COMPLET */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
                  <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-slate-400 text-[11px]">
                    <span>{analysisResult.correctedFiles[0]?.fileName}</span>
                    <span>Code complet certifié sans troncature</span>
                  </div>
                  <pre className="p-4 max-h-80 overflow-y-auto text-slate-300 whitespace-pre leading-relaxed">
                    {analysisResult.correctedFiles[0]?.fullCode}
                  </pre>
                </div>

                {/* CARTE DE VALIDATION HUMAINE OBLIGATOIRE (Étape 7) */}
                <div className="p-5 rounded-xl border bg-slate-900 border-indigo-500/40 shadow-inner space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        <Lock className="w-4 h-4 text-indigo-400" />
                        Décision de l’administrateur (Point de contrôle obligatoire)
                      </div>
                      <p className="text-xs text-slate-400">
                        Sécurité absolue : aucune modification du code de production, aucun déploiement automatique, aucune altération de Google Sheets sans confirmation humaine.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleHumanDecision('VALIDATED')}
                        disabled={isSubmittingDecision || validationState === 'VALIDATED'}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                          validationState === 'VALIDATED'
                            ? 'bg-emerald-600 text-white cursor-default'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                        <span>{validationState === 'VALIDATED' ? '✓ Modification Validée' : 'Valider la modification'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleHumanDecision('REJECTED')}
                        disabled={isSubmittingDecision || validationState === 'REJECTED'}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                          validationState === 'REJECTED'
                            ? 'bg-rose-700 text-white cursor-default'
                            : 'bg-rose-600 hover:bg-rose-500 text-white shadow-md'
                        }`}
                      >
                        <X className="w-4 h-4" />
                        <span>{validationState === 'REJECTED' ? '✕ Proposition Rejetée' : 'Refuser'}</span>
                      </button>
                    </div>
                  </div>

                  {decisionFeedback && (
                    <div
                      className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                        validationState === 'VALIDATED'
                          ? 'bg-emerald-950/50 border border-emerald-800 text-emerald-200'
                          : 'bg-rose-950/50 border border-rose-800 text-rose-200'
                      }`}
                    >
                      <Info className="w-4 h-4 shrink-0" />
                      <span>{decisionFeedback}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VUE 2 : EXPLORATEUR DU CODE SOURCE ACTUEL DU PROJET (LECTURE SEULE) */}
      {activeTab === 'FILE_EXPLORER' && (
        <div className="bg-[#1e293b] border border-slate-700/80 rounded-2xl p-6 shadow-lg space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-indigo-400" />
                Explorateur du code actuel de l’application AKF PARTNERS
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Accès en lecture seule stricte aux fichiers réels hébergés dans le projet
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800 font-medium">
                ● Lecture seule activée
              </span>
              <button
                type="button"
                onClick={loadCatalog}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                title="Actualiser les fichiers"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCatalog ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Filtres par catégories */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCatalogFilter(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  catalogFilter === cat.id
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Disposition 2 colonnes : Liste des fichiers & Lecteur de code */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Colonne gauche : liste des fichiers */}
            <div className="lg:col-span-5 space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredCatalog.map((file) => {
                const isSelected = selectedFileSummary?.path === file.path;
                return (
                  <div
                    key={file.path}
                    onClick={() => {
                      setSelectedFileSummary(file);
                      loadFileContent(file.path);
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-md'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-semibold text-sky-300 truncate">
                        {file.path}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {file.lineCount} lignes
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{file.description}</p>
                    {file.functions && file.functions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {file.functions.slice(0, 3).map((fn, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 text-[9px] font-mono"
                          >
                            {fn}
                          </span>
                        ))}
                        {file.functions.length > 3 && (
                          <span className="text-[9px] text-slate-500 self-center">
                            +{file.functions.length - 3} autres
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Colonne droite : visualiseur de code en lecture seule */}
            <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
              <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-400" />
                  <span className="font-mono text-slate-200 font-semibold">
                    {selectedFileSummary?.path || 'Sélectionnez un fichier'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                    Lecture seule
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(selectedFileContent)}
                    className="p-1 hover:text-white text-slate-400 transition-colors"
                    title="Copier le code"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-4 flex-1 overflow-auto max-h-[550px]">
                {isLoadingFileContent ? (
                  <div className="flex items-center justify-center py-16 text-slate-500 text-xs">
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    Chargement du fichier réel...
                  </div>
                ) : (
                  <pre className="font-mono text-xs text-slate-300 whitespace-pre leading-relaxed">
                    {selectedFileContent}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VUE 3 : HISTORIQUE DES ANALYSES & AUDIT */}
      {activeTab === 'HISTORY' && (
        <div className="bg-[#1e293b] border border-slate-700/80 rounded-2xl p-6 shadow-lg space-y-6">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <HistoryIcon className="w-4 h-4 text-indigo-400" />
                Journal d’audit et Historique des analyses AKF CODE AI
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Traçabilité inaltérable de chaque requête, proposition et décision humaine
              </p>
            </div>
            <button
              type="button"
              onClick={loadHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              <span>Actualiser</span>
            </button>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-800/80 text-slate-400 uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">Date & Heure</th>
                  <th className="px-4 py-3">Demande</th>
                  <th className="px-4 py-3">Résultat / Proposition</th>
                  <th className="px-4 py-3">Fichiers concernés</th>
                  <th className="px-4 py-3">Risque</th>
                  <th className="px-4 py-3 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {historyList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Aucune analyse enregistrée pour le moment.
                    </td>
                  </tr>
                ) : (
                  historyList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">
                        {new Date(item.timestamp).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 max-w-xs font-medium text-slate-200 truncate" title={item.instruction}>
                        {item.instruction}
                      </td>
                      <td className="px-4 py-3 max-w-xs text-slate-300 truncate" title={item.resultSummary}>
                        {item.resultSummary}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {item.affectedFiles.map((af, afIdx) => (
                            <span
                              key={afIdx}
                              className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono text-[9px] border border-slate-700"
                            >
                              {af.split('/').pop()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            item.riskLevel === 'FAIBLE'
                              ? 'bg-emerald-950 text-emerald-400'
                              : item.riskLevel === 'MOYEN'
                              ? 'bg-amber-950 text-amber-400'
                              : 'bg-rose-950 text-rose-400'
                          }`}
                        >
                          {item.riskLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                            item.status === 'Validé'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : item.status === 'Refusé'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VUE 4 : APPS SCRIPT HISTORIQUE (RÉFÉRENCE DOCUMENTAIRE UNIQUEMENT) */}
      {activeTab === 'HISTORICAL_REF' && (
        <div className="bg-[#1e293b] border border-amber-800/60 rounded-2xl p-6 shadow-lg space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-800/40 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <h2 className="text-base font-semibold text-amber-200">
                  Fichiers Apps Script historiques (.gs)
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700 font-bold uppercase">
                  Référence uniquement
                </span>
              </div>
              <p className="text-xs text-amber-300/80 mt-1">
                Ces fichiers correspondent à l'ancien système Apps Script. Ils ne sont plus le moteur actuel et servent exclusivement de référence documentaire.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSourceMode('HISTORICAL_GAS');
                setActiveTab('PIPELINE');
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs shadow transition-all"
            >
              Auditer cette référence dans le pipeline
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Liste des fichiers .gs */}
            <div className="lg:col-span-4 space-y-2">
              {historicalFiles.map((file, idx) => (
                <div
                  key={file.name}
                  onClick={() => setActiveHistoricalIndex(idx)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    activeHistoricalIndex === idx
                      ? 'bg-amber-950/40 border-amber-500 text-white shadow'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-amber-300">{file.name}</span>
                    <span className="text-[10px] text-slate-500">Apps Script (V8)</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Visualiseur de code .gs */}
            <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
              <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 text-xs flex items-center justify-between text-slate-400">
                <span className="font-mono">{historicalFiles[activeHistoricalIndex]?.name}</span>
                <span className="text-amber-400 text-[10px]">Non exécuté en production</span>
              </div>
              <pre className="p-4 text-xs font-mono text-slate-300 whitespace-pre overflow-x-auto leading-relaxed">
                {historicalFiles[activeHistoricalIndex]?.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
