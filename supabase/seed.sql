-- ============================================================================
-- AKF PARTNERS — DONNÉES DE CONFIGURATION INITIALES (SEED PROPRE)
-- All Koff's Food : Vague 1 et Produits Officiels (Zéro donnée fictive)
-- ============================================================================

-- 1. VAGUE 1 (Vague active par défaut)
INSERT INTO public.waves (id, name, is_active, description)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'Vague 1 — Lancement AKF', true, 'Configuration initiale des paliers pour le réseau All Koff’s Food')
ON CONFLICT (name) DO UPDATE SET is_active = true;

-- 2. SEUILS DE GRADES POUR VAGUE 1
INSERT INTO public.rank_thresholds (wave_id, rank, min_orders, min_ca, default_commission_rate)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Neo', 0, 0, 0.0600),
  ('a0000000-0000-0000-0000-000000000001', 'Ambassador', 8, 100000, 0.0800),
  ('a0000000-0000-0000-0000-000000000001', 'Excellence', 20, 300000, 0.1000),
  ('a0000000-0000-0000-0000-000000000001', 'Signature', 50, 800000, 0.1200)
ON CONFLICT (wave_id, rank) DO UPDATE 
SET min_orders = EXCLUDED.min_orders, min_ca = EXCLUDED.min_ca, default_commission_rate = EXCLUDED.default_commission_rate;

-- 3. PRODUITS INITIALS OFFICIELS (PREMIUM & RÉCURRENT)
INSERT INTO public.products (id, name, price, category, commission_type, commission_neo, commission_ambassador, commission_excellence, commission_signature, conditions, is_active)
VALUES
  (
    'PRD-ATOLECE',
    'Atō’lèçé (Plat Signature)',
    1500,
    'RÉCURRENT',
    'Forfaitaire',
    150, -- 150 FCFA / unité
    150,
    150,
    150,
    'Commission forfaitaire de 150 FCFA par unité commandée, sans limite sur le nombre de commandes.',
    true
  ),
  (
    'PRD-FESTIF',
    'Pack Festif All Koff’s Food',
    25000,
    'PREMIUM',
    'Pourcentage',
    1500, -- 6%
    2000, -- 8%
    2500, -- 10%
    3000, -- 12%
    'Éligible à la commission sur les 3 premières commandes d’un client apporté.',
    true
  ),
  (
    'PRD-PRESTIGE',
    'Box Événementielle Prestige AKF',
    50000,
    'PREMIUM',
    'Pourcentage',
    3000, -- 6%
    4000, -- 8%
    5000, -- 10%
    6000, -- 12%
    'Prix personnalisable lors de la saisie. Commission proportionnelle au montant final.',
    true
  )
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, price = EXCLUDED.price, category = EXCLUDED.category, commission_type = EXCLUDED.commission_type;
