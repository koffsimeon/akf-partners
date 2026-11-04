import React, { useState, useEffect } from 'react';
import { X, Check, Sliders, Sparkles } from 'lucide-react';
import { WaveConfig } from '../../types';

export interface WaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  wave?: WaveConfig | null;
  mode?: 'create' | 'edit';
  onSave: (wave: WaveConfig) => Promise<void>;
}

export function WaveModal({
  isOpen,
  onClose,
  wave,
  mode = 'create',
  onSave,
}: WaveModalProps) {
  const [waveName, setWaveName] = useState('');
  const [ambassadorCmd, setAmbassadorCmd] = useState<number>(8);
  const [ambassadorCa, setAmbassadorCa] = useState<number>(100000);
  const [excellenceCmd, setExcellenceCmd] = useState<number>(20);
  const [excellenceCa, setExcellenceCa] = useState<number>(300000);
  const [signatureCmd, setSignatureCmd] = useState<number>(50);
  const [signatureCa, setSignatureCa] = useState<number>(800000);
  const [active, setActive] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wave && mode === 'edit') {
      setWaveName(wave.wave || '');
      setAmbassadorCmd(wave.ambassadorCmd ?? 8);
      setAmbassadorCa(wave.ambassadorCa ?? 100000);
      setExcellenceCmd(wave.excellenceCmd ?? 20);
      setExcellenceCa(wave.excellenceCa ?? 300000);
      setSignatureCmd(wave.signatureCmd ?? 50);
      setSignatureCa(wave.signatureCa ?? 800000);
      setActive(Boolean(wave.active));
    } else {
      setWaveName('Vague 2 — Nouvelle Campagne');
      setAmbassadorCmd(10);
      setAmbassadorCa(150000);
      setExcellenceCmd(25);
      setExcellenceCa(400000);
      setSignatureCmd(60);
      setSignatureCa(1000000);
      setActive(true);
    }
    setError(null);
  }, [wave, mode, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waveName.trim()) {
      setError('Le nom de la vague est obligatoire.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const payload: WaveConfig = {
        wave: waveName.trim(),
        ambassadorCmd: Number(ambassadorCmd) || 0,
        ambassadorCa: Number(ambassadorCa) || 0,
        excellenceCmd: Number(excellenceCmd) || 0,
        excellenceCa: Number(excellenceCa) || 0,
        signatureCmd: Number(signatureCmd) || 0,
        signatureCa: Number(signatureCa) || 0,
        active,
      };

      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l’enregistrement de la vague.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {mode === 'edit' ? 'Modifier la Vague' : 'Créer une Nouvelle Vague de Seuils'}
              </h3>
              <p className="text-xs text-slate-400">
                Paliers de passage de grade appliqués par le moteur
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nom ou Identifiant de la Vague
            </label>
            <input
              type="text"
              required
              value={waveName}
              onChange={(e) => setWaveName(e.target.value)}
              placeholder="Ex: Vague 2 — Rentrée 2026"
              className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 outline-hidden focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Ambassador */}
          <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/60 space-y-2">
            <span className="text-xs font-extrabold text-blue-900 block">
              Grade 2 : Ambassador (8% commission)
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-blue-700 block mb-0.5">
                  Commandes requises
                </label>
                <input
                  type="number"
                  min="0"
                  value={ambassadorCmd}
                  onChange={(e) => setAmbassadorCmd(Number(e.target.value))}
                  className="w-full rounded-xl border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-blue-700 block mb-0.5">
                  C.A. minimum (FCFA)
                </label>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={ambassadorCa}
                  onChange={(e) => setAmbassadorCa(Number(e.target.value))}
                  className="w-full rounded-xl border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Excellence */}
          <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200/60 space-y-2">
            <span className="text-xs font-extrabold text-purple-900 block">
              Grade 3 : Excellence (10% commission)
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-purple-700 block mb-0.5">
                  Commandes requises
                </label>
                <input
                  type="number"
                  min="0"
                  value={excellenceCmd}
                  onChange={(e) => setExcellenceCmd(Number(e.target.value))}
                  className="w-full rounded-xl border border-purple-200 bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-purple-700 block mb-0.5">
                  C.A. minimum (FCFA)
                </label>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={excellenceCa}
                  onChange={(e) => setExcellenceCa(Number(e.target.value))}
                  className="w-full rounded-xl border border-purple-200 bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Signature */}
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/60 space-y-2">
            <span className="text-xs font-extrabold text-amber-900 block">
              Grade 4 : Signature (12% commission)
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-amber-700 block mb-0.5">
                  Commandes requises
                </label>
                <input
                  type="number"
                  min="0"
                  value={signatureCmd}
                  onChange={(e) => setSignatureCmd(Number(e.target.value))}
                  className="w-full rounded-xl border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-amber-700 block mb-0.5">
                  C.A. minimum (FCFA)
                </label>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={signatureCa}
                  onChange={(e) => setSignatureCa(Number(e.target.value))}
                  className="w-full rounded-xl border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Activer immédiatement */}
          <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs font-bold text-slate-800">
              Définir immédiatement comme Vague Active pour tout le réseau
            </span>
          </label>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              <span>{isSubmitting ? 'Enregistrement...' : 'Enregistrer les Seuils'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
