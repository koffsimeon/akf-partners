import React, { useState, useEffect } from 'react';
import { X, Check, Package, Sparkles } from 'lucide-react';
import { Product } from '../../types';

export interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  mode?: 'create' | 'edit';
  onSave: (product: Product) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function ProductModal({
  isOpen,
  onClose,
  product,
  mode = 'create',
  onSave,
  onDelete,
}: ProductModalProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [category, setCategory] = useState<'PREMIUM' | 'RÉCURRENT'>('PREMIUM');
  const [commissionType, setCommissionType] = useState<'Pourcentage' | 'Forfaitaire'>('Pourcentage');
  const [commissionNeo, setCommissionNeo] = useState<number>(6);
  const [commissionAmbassador, setCommissionAmbassador] = useState<number>(8);
  const [commissionExcellence, setCommissionExcellence] = useState<number>(10);
  const [commissionSignature, setCommissionSignature] = useState<number>(12);
  const [conditions, setConditions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product && mode === 'edit') {
      setName(product.name || '');
      setPrice(product.price || 0);
      const cat = String(product.category).toUpperCase();
      const isRec = cat === 'RÉCURRENT' || cat === 'RECURRENT';
      setCategory(isRec ? 'RÉCURRENT' : 'PREMIUM');
      setCommissionType(product.commissionType === 'Forfaitaire' ? 'Forfaitaire' : 'Pourcentage');
      setCommissionNeo(product.commissionNeo ?? (isRec ? 150 : 6));
      setCommissionAmbassador(product.commissionAmbassador ?? (isRec ? 150 : 8));
      setCommissionExcellence(product.commissionExcellence ?? (isRec ? 150 : 10));
      setCommissionSignature(product.commissionSignature ?? (isRec ? 150 : 12));
      setConditions(product.conditions || '');
    } else {
      setName('');
      setPrice(25000);
      setCategory('PREMIUM');
      setCommissionType('Pourcentage');
      setCommissionNeo(6);
      setCommissionAmbassador(8);
      setCommissionExcellence(10);
      setCommissionSignature(12);
      setConditions('');
    }
    setError(null);
  }, [product, mode, isOpen]);

  // Si l'utilisateur bascule en Récurrent, on suggère une commission forfaitaire par défaut
  const handleCategoryChange = (newCat: 'PREMIUM' | 'RÉCURRENT') => {
    setCategory(newCat);
    if (newCat === 'RÉCURRENT') {
      setCommissionType('Forfaitaire');
      setCommissionNeo(150);
      setCommissionAmbassador(150);
      setCommissionExcellence(150);
      setCommissionSignature(150);
      if (!conditions) {
        setConditions('Commission forfaitaire par unité commandée sans limite de commandes.');
      }
    } else {
      setCommissionType('Pourcentage');
      setCommissionNeo(6);
      setCommissionAmbassador(8);
      setCommissionExcellence(10);
      setCommissionSignature(12);
      if (!conditions || conditions.includes('sans limite')) {
        setConditions('Limité aux 3 premières commandes d’un client apporté.');
      }
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Le nom du produit est obligatoire.');
      return;
    }
    if (price <= 0) {
      setError('Le prix de vente doit être supérieur à 0 FCFA.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const generatedId = product?.id || `PRD-${Date.now().toString(36).toUpperCase()}`;
      const payload: Product = {
        id: generatedId,
        name: name.trim(),
        price: Number(price),
        category,
        commissionType,
        commissionNeo: Number(commissionNeo) || 0,
        commissionAmbassador: Number(commissionAmbassador) || 0,
        commissionExcellence: Number(commissionExcellence) || 0,
        commissionSignature: Number(commissionSignature) || 0,
        conditions: conditions.trim(),
        isPremium: category === 'PREMIUM',
      };

      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l’enregistrement du produit.');
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
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {mode === 'edit' ? 'Modifier le Produit' : 'Ajouter un Produit au Catalogue'}
              </h3>
              <p className="text-xs text-slate-400">
                Configuration dynamique des prix et règles de commissions
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
          {/* Nom du produit */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nom du Produit ou Plat
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Pack Festif All Koff’s Food ou Atō’lèçé"
              className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 outline-hidden focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Prix & Catégorie */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Prix Unitaire (FCFA)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                required
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 outline-hidden focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catégorie
              </label>
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => handleCategoryChange('PREMIUM')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    category === 'PREMIUM'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  PREMIUM
                </button>
                <button
                  type="button"
                  onClick={() => handleCategoryChange('RÉCURRENT')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    category === 'RÉCURRENT'
                      ? 'bg-white text-emerald-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  RÉCURRENT
                </button>
              </div>
            </div>
          </div>

          {/* Type de Commission */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mode de Calcul de la Commission
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="commType"
                  value="Pourcentage"
                  checked={commissionType === 'Pourcentage'}
                  onChange={() => setCommissionType('Pourcentage')}
                  className="text-indigo-600"
                />
                <span>Pourcentage (%) du montant</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="commType"
                  value="Forfaitaire"
                  checked={commissionType === 'Forfaitaire'}
                  onChange={() => setCommissionType('Forfaitaire')}
                  className="text-emerald-600"
                />
                <span>Forfaitaire unitaire (FCFA / unité)</span>
              </label>
            </div>
          </div>

          {/* Grille par Grade */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
              Commissions par Grade ({commissionType === 'Pourcentage' ? '%' : 'FCFA / unité'})
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Neo</span>
                <input
                  type="number"
                  min="0"
                  step={commissionType === 'Pourcentage' ? '0.5' : '10'}
                  value={commissionNeo}
                  onChange={(e) => setCommissionNeo(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Ambassador</span>
                <input
                  type="number"
                  min="0"
                  step={commissionType === 'Pourcentage' ? '0.5' : '10'}
                  value={commissionAmbassador}
                  onChange={(e) => setCommissionAmbassador(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Excellence</span>
                <input
                  type="number"
                  min="0"
                  step={commissionType === 'Pourcentage' ? '0.5' : '10'}
                  value={commissionExcellence}
                  onChange={(e) => setCommissionExcellence(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Signature</span>
                <input
                  type="number"
                  min="0"
                  step={commissionType === 'Pourcentage' ? '0.5' : '10'}
                  value={commissionSignature}
                  onChange={(e) => setCommissionSignature(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Conditions */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Conditions Particulières & Notes
            </label>
            <textarea
              rows={2}
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              placeholder="Ex: Éligible uniquement sur les 3 premières commandes d'un client apporté."
              className="w-full rounded-2xl border border-slate-200 px-3.5 py-2 text-xs text-slate-800 outline-hidden focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between gap-3">
            {mode === 'edit' && onDelete && product ? (
              <button
                type="button"
                onClick={async () => {
                  if (confirm(`Supprimer le produit "${product.name}" ?`)) {
                    await onDelete(product.id);
                    onClose();
                  }
                }}
                className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
              >
                Supprimer
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
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
                <span>{isSubmitting ? 'Enregistrement...' : 'Enregistrer le Produit'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
