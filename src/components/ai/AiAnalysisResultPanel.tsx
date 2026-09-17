import React, { useState } from 'react';
import {
  CheckCircle2,
  Terminal,
  Copy,
  Check,
  Layers,
  BarChart3,
  FileCode,
  ExternalLink,
  ShieldAlert,
  Database,
  GitCompare,
  Eye,
  ShieldCheck,
  Download,
  Lock,
  X,
  Info,
} from 'lucide-react';
import {
  AiAnalysisResponse,
  GoogleSheetsTabImpact,
} from '../../../server/aiService';

interface AiAnalysisResultPanelProps {
  analysisResult: AiAnalysisResponse;
  validationState: 'PENDING' | 'VALIDATED' | 'REJECTED';
  isSubmittingDecision: boolean;
  decisionFeedback: string | null;
  onHumanDecision: (decision: 'VALIDATED' | 'REJECTED') => Promise<void>;
  onDownloadFullReport: () => void;
}

export function AiAnalysisResultPanel({
  analysisResult,
  validationState,
  isSubmittingDecision,
  decisionFeedback,
  onHumanDecision,
  onDownloadFullReport,
}: AiAnalysisResultPanelProps) {
  const [copiedProofIndex, setCopiedProofIndex] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [diffMode, setDiffMode] = useState<'unified' | 'side-by-side'>('unified');
  const [selectedDiffIndex] = useState(0);

  const handleCopyProof = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedProofIndex(idx);
    setTimeout(() => setCopiedProofIndex(null), 2000);
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
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
              onClick={onDownloadFullReport}
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
                onClick={() => onHumanDecision('VALIDATED')}
                disabled={isSubmittingDecision || validationState === 'VALIDATED'}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  validationState === 'VALIDATED'
                    ? 'bg-emerald-600 text-white cursor-default'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>{validationState === 'VALIDATED' ? 'Modification Validée' : 'Valider la modification'}</span>
              </button>

              <button
                type="button"
                onClick={() => onHumanDecision('REJECTED')}
                disabled={isSubmittingDecision || validationState === 'REJECTED'}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  validationState === 'REJECTED'
                    ? 'bg-rose-700 text-white cursor-default'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-md'
                }`}
              >
                <X className="w-4 h-4" />
                <span>{validationState === 'REJECTED' ? 'Proposition Rejetée' : 'Refuser'}</span>
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
  );
}
