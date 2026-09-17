import React, { useState } from 'react';
import {
  History as HistoryIcon,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { AnalysisHistoryItem, ScriptFile } from '../../../server/aiService';

interface AiHistoryPanelProps {
  historyList: AnalysisHistoryItem[];
  isLoadingHistory: boolean;
  onLoadHistory: () => void;
  historicalFiles: ScriptFile[];
  onAuditHistoricalRef: () => void;
  showTab: 'HISTORY' | 'HISTORICAL_REF';
}

export function AiHistoryPanel({
  historyList,
  isLoadingHistory,
  onLoadHistory,
  historicalFiles,
  onAuditHistoricalRef,
  showTab,
}: AiHistoryPanelProps) {
  const [activeHistoricalIndex, setActiveHistoricalIndex] = useState(0);

  if (showTab === 'HISTORY') {
    return (
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
            onClick={onLoadHistory}
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
    );
  }

  // HISTORICAL_REF tab
  return (
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
          onClick={onAuditHistoricalRef}
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
  );
}
