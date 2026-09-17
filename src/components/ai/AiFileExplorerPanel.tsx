import React from 'react';
import {
  FolderTree,
  RefreshCw,
  FileCode,
  Eye,
  Search,
} from 'lucide-react';
import { ProjectFileSummary } from '../../../server/aiService';

interface AiFileExplorerPanelProps {
  catalog: ProjectFileSummary[];
  isLoadingCatalog: boolean;
  selectedFileSummary: ProjectFileSummary | null;
  selectedFileContent: string;
  isLoadingFileContent: boolean;
  catalogFilter: string;
  setCatalogFilter: (filter: string) => void;
  onLoadCatalog: () => void;
  onSelectFile: (file: ProjectFileSummary) => void;
}

export function AiFileExplorerPanel({
  catalog,
  isLoadingCatalog,
  selectedFileSummary,
  selectedFileContent,
  isLoadingFileContent,
  catalogFilter,
  setCatalogFilter,
  onLoadCatalog,
  onSelectFile,
}: AiFileExplorerPanelProps) {
  const categories = [
    { id: 'ALL', label: 'Tous les fichiers' },
    { id: 'ENGINE', label: 'Moteur Métier (engine)' },
    { id: 'SERVER', label: 'Backend & Repository' },
    { id: 'UI', label: 'Vues & Composants' },
    { id: 'TYPES', label: 'Types & Config' },
  ];

  const filteredCatalog = catalog.filter((file) => {
    if (catalogFilter === 'ENGINE') return file.category === 'ENGINE';
    if (catalogFilter === 'SERVER') return file.category === 'API_ROUTES' || file.category === 'REPOSITORIES' || file.category === 'GOOGLE_SHEETS_SERVICE';
    if (catalogFilter === 'UI') return file.category === 'REACT_COMPONENTS';
    if (catalogFilter === 'TYPES') return file.category === 'TYPES' || file.category === 'CONFIG' || file.category === 'SERVICES';
    return true;
  });

  return (
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
            onClick={onLoadCatalog}
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
        {/* Liste des fichiers */}
        <div className="lg:col-span-5 space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {isLoadingCatalog ? (
            <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
              <span>Chargement des fichiers...</span>
            </div>
          ) : (
            filteredCatalog.map((file) => {
              const isSelected = selectedFileSummary?.path === file.path;
              return (
                <div
                  key={file.path}
                  onClick={() => onSelectFile(file)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500 text-white shadow'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <FileCode className={`w-4 h-4 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                      <span className="font-mono text-xs font-semibold text-sky-300">{file.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{file.lineCount} l.</span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{file.description}</p>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="font-mono text-slate-400">{file.path}</span>
                    <span className="flex items-center gap-1 text-indigo-400 font-medium">
                      <Eye className="w-3 h-3" />
                      Voir
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Visualiseur de code en direct */}
        <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[600px]">
          <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-indigo-400" />
              <span className="font-mono text-slate-200 font-semibold">
                {selectedFileSummary?.name || 'Sélectionnez un fichier'}
              </span>
              {selectedFileSummary && (
                <span className="text-[10px] text-slate-500 font-mono">
                  ({selectedFileSummary.lineCount} lignes, {Math.round(selectedFileSummary.sizeBytes / 1024)} Ko)
                </span>
              )}
            </div>
            {selectedFileSummary && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                {selectedFileSummary.path}
              </span>
            )}
          </div>

          <div className="p-4 flex-1 overflow-auto">
            {isLoadingFileContent ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Lecture du fichier source sur le disque...</span>
              </div>
            ) : !selectedFileSummary ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                <Search className="w-8 h-8 text-slate-600" />
                <span>Cliquez sur un fichier à gauche pour inspecter son code réel</span>
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
  );
}
