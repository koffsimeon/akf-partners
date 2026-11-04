-- ============================================================================
-- AKF PARTNERS — JEU DE DONNÉES INITIAL (SEED)
-- All Koff's Food : Vague 1, Produits, Partenaires, Clients et Commandes de test
-- ============================================================================

-- 1. VAGUE 1 (Vague active par défaut)
INSERT INTO public.waves (id, name, is_active, description)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'Vague 1 — Lancement AKF', true, 'Configuration initiale des paliers pour le réseau All Koff’s Food')
ON CONFLICT (name) DO NOTHING;

-- 2. SEUILS DE GRADES POUR VAGUE 1
INSERT INTO public.rank_thresholds (wave_id, rank, min_orders, min_ca, default_commission_rate)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Neo', 0, 0, 0.0600),
  ('a0000000-0000-0000-0000-000000000001', 'Ambassador', 8, 100000, 0.0800),
  ('a0000000-0000-0000-0000-000000000001', 'Excellence', 20, 300000, 0.1000),
  ('a0000000-0000-0000-0000-000000000001', 'Signature', 50, 800000, 0.1200)
ON CONFLICT (wave_id, rank) DO UPDATE 
SET min_orders = EXCLUDED.min_orders, min_ca = EXCLUDED.min_ca, default_commission_rate = EXCLUDED.default_commission_rate;

-- 3. PRODUITS INITIALS (PREMIUM & RÉCURRENT avec règles conformes au DATR)
INSERT INTO public.products (id, name, price, category, commission_type, commission_neo, commission_ambassador, commission_excellence, commission_signature, conditions, is_active)
VALUES
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
  ),
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
    'PRD-PLATEAU',
    'Plateau Déjeuner d’Entreprise',
    3500,
    'RÉCURRENT',
    'Forfaitaire',
    250, -- 250 FCFA / unité
    250,
    250,
    250,
    'Commission forfaitaire de 250 FCFA par unité commandée pour les récurrents entreprise.',
    true
  )
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, price = EXCLUDED.price, category = EXCLUDED.category, commission_type = EXCLUDED.commission_type;

-- 4. PARTENAIRES INITIAUX
INSERT INTO public.partners (id, code, full_name, phone, phone_canonical, whatsapp, rank, wave_id, status, ca, client_count, order_count, total_commission, validated_commission, paid_commission, balance, notes)
VALUES
  (
    'AKF001',
    'AKF-MEN01',
    'Simeon Koffi Mensah',
    '+229 97 12 34 56',
    '+22997123456',
    '+22997123456',
    'Ambassador',
    'a0000000-0000-0000-0000-000000000001',
    'Actif',
    185000,
    3,
    9,
    14800,
    14800,
    10000,
    4800,
    'Partenaire Vague 1 très actif sur Cotonou'
  ),
  (
    'AKF002',
    'AKF-TOS02',
    'Aminata Tossou',
    '+229 96 44 22 11',
    '+22996442211',
    '+22996442211',
    'Neo',
    'a0000000-0000-0000-0000-000000000001',
    'Actif',
    75000,
    2,
    3,
    4500,
    4500,
    0,
    4500,
    'En progression vers le grade Ambassador'
  ),
  (
    'AKF003',
    'AKF-ADE03',
    'Adeyemi Mensah',
    '+229 95 88 77 66',
    '+22995887766',
    '+22995887766',
    'Excellence',
    'a0000000-0000-0000-0000-000000000001',
    'Actif',
    420000,
    5,
    24,
    42000,
    42000,
    30000,
    12000,
    'Partenaire d’affaires corporate'
  )
ON CONFLICT (id) DO NOTHING;

-- 5. CLIENTS INITIAUX
INSERT INTO public.clients (id, full_name, phone, phone_canonical, whatsapp, city, address, notes, partner_id, client_type, order_count, total_ca, last_order_date)
VALUES
  (
    'CL001',
    'Marcelle Agbodjan',
    '+229 97 00 11 22',
    '+22997001122',
    '+22997001122',
    'Cotonou',
    'Haie Vive',
    'Cliente fidèle apportée par Simeon',
    'AKF001',
    'PARTENAIRE',
    4,
    85000,
    NOW() - INTERVAL '2 days'
  ),
  (
    'CL002',
    'Gratien Dossou',
    '+229 96 11 33 55',
    '+22996113355',
    '+22996113355',
    'Porto-Novo',
    'Ouando',
    'Client apporté par Aminata',
    'AKF002',
    'PARTENAIRE',
    2,
    50000,
    NOW() - INTERVAL '5 days'
  ),
  (
    'CL003',
    'Direction Générale Bourse Régionale',
    '+229 95 22 44 66',
    '+22995224466',
    NULL,
    'Cotonou',
    'Zone Commerciale Ganhi',
    'Client institutionnel direct',
    NULL,
    'DIRECT AKF',
    5,
    150000,
    NOW() - INTERVAL '1 day'
  )
ON CONFLICT (id) DO NOTHING;

-- 6. COMMANDES DE TEST
INSERT INTO public.orders (id, date, client_id, partner_id, product_id, category, quantity, unit_price, total_amount, order_status, commission_amount, commission_status, payment_method, rank_at_order, premium_rank, observation)
VALUES
  (
    'CMD001',
    NOW() - INTERVAL '10 days',
    'CL001',
    'AKF001',
    'PRD-FESTIF',
    'PREMIUM',
    1,
    25000,
    25000,
    'Terminée',
    2000,
    'Validée',
    'Mobile Money (MTN / Moov)',
    'Ambassador',
    1,
    'Première commande Premium validée pour Marcelle'
  ),
  (
    'CMD002',
    NOW() - INTERVAL '3 days',
    'CL001',
    'AKF001',
    'PRD-ATOLECE',
    'RÉCURRENT',
    35,
    1500,
    52500,
    'Terminée',
    5250, -- 35 * 150 FCFA
    'Validée',
    'Mobile Money (MTN / Moov)',
    'Ambassador',
    NULL,
    'Commande récurrente Atō’lèçé (35 unités x 150 F)'
  ),
  (
    'CMD003',
    NOW() - INTERVAL '1 day',
    'CL002',
    'AKF002',
    'PRD-FESTIF',
    'PREMIUM',
    1,
    25000,
    25000,
    'Confirmée',
    1500,
    'En attente',
    'Espèces',
    'Neo',
    1,
    'Commande en attente de livraison'
  )
ON CONFLICT (id) DO NOTHING;

-- 7. PAIEMENTS DE COMMISSIONS
INSERT INTO public.payments (id, date, partner_id, amount, payment_method, payment_status, observation)
VALUES
  (
    'PAY001',
    NOW() - INTERVAL '7 days',
    'AKF001',
    10000,
    'Mobile Money (MTN / Moov)',
    'Effectué',
    'Règlement commission Vague 1 via MTN MoMo (+229 97 12 34 56)'
  ),
  (
    'PAY002',
    NOW() - INTERVAL '15 days',
    'AKF003',
    30000,
    'Virement Bancaire',
    'Effectué',
    'Virement mensuel commission Excellence'
  )
ON CONFLICT (id) DO NOTHING;
