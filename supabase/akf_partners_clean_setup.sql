-- ============================================================================
-- AKF PARTNERS — INITIALISATION COMPLÈTE & PROPRE SUPABASE (SANS DONNÉES FICTIVES)
-- All Koff's Food : Base de données de production / test vierge
-- Date : 04 Novembre 2026
-- Compatible : Supabase PostgreSQL 15+
-- ============================================================================

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. TYPES ET ÉNUMÉRATIONS MÉTIER
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'CONSULTATION',
    'OPERATIONS',
    'FINANCE',
    'ADMIN',
    'SUPER_ADMIN'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE partner_rank AS ENUM (
    'Neo',
    'Ambassador',
    'Excellence',
    'Signature'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE client_type AS ENUM (
    'DIRECT AKF',
    'PARTENAIRE'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE product_category AS ENUM (
    'PREMIUM',
    'RÉCURRENT'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE commission_calc_type AS ENUM (
    'Pourcentage',
    'Forfaitaire'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'En attente',
    'Confirmée',
    'Terminée',
    'Livrée',
    'Annulée'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE commission_status AS ENUM (
    'En attente',
    'Validée',
    'Payée',
    'Non éligible',
    'Annulée'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ----------------------------------------------------------------------------
-- 2. TABLE PROFILES (Utilisateurs & Rôles RBAC)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'CONSULTATION',
  avatar_url TEXT,
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 3. TABLES DE CONFIGURATION DYNAMIQUE : VAGUES ET SEUILS DE GRADES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.waves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.rank_thresholds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wave_id UUID NOT NULL REFERENCES public.waves(id) ON DELETE CASCADE,
  rank partner_rank NOT NULL,
  min_orders INTEGER NOT NULL DEFAULT 0,
  min_ca NUMERIC(12, 2) NOT NULL DEFAULT 0,
  default_commission_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.0600,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_wave_rank UNIQUE (wave_id, rank)
);

-- ----------------------------------------------------------------------------
-- 4. TABLE DU CATALOGUE PRODUITS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  category product_category NOT NULL DEFAULT 'PREMIUM',
  commission_type commission_calc_type NOT NULL DEFAULT 'Pourcentage',
  commission_neo NUMERIC(10, 2) NOT NULL DEFAULT 6,
  commission_ambassador NUMERIC(10, 2) NOT NULL DEFAULT 8,
  commission_excellence NUMERIC(10, 2) NOT NULL DEFAULT 10,
  commission_signature NUMERIC(10, 2) NOT NULL DEFAULT 12,
  conditions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 5. TABLE PARTENAIRES (Réseau AKF)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partners (
  id TEXT PRIMARY KEY, -- Format AKF001, AKF002
  code TEXT NOT NULL UNIQUE, -- Format AKF-MEN01
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_canonical TEXT NOT NULL UNIQUE,
  whatsapp TEXT,
  rank partner_rank NOT NULL DEFAULT 'Neo',
  wave_id UUID REFERENCES public.waves(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Actif',
  ca NUMERIC(12, 2) NOT NULL DEFAULT 0,
  client_count INTEGER NOT NULL DEFAULT 0,
  order_count INTEGER NOT NULL DEFAULT 0,
  total_commission NUMERIC(12, 2) NOT NULL DEFAULT 0,
  validated_commission NUMERIC(12, 2) NOT NULL DEFAULT 0,
  paid_commission NUMERIC(12, 2) NOT NULL DEFAULT 0,
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 6. TABLE CLIENTS (Portefeuille affilié)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id TEXT PRIMARY KEY, -- Format CL001, CL002
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_canonical TEXT NOT NULL,
  whatsapp TEXT,
  type client_type NOT NULL DEFAULT 'DIRECT AKF',
  partner_id TEXT REFERENCES public.partners(id) ON DELETE SET NULL,
  order_count INTEGER NOT NULL DEFAULT 0,
  total_spend NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 7. TABLE COMMANDES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY, -- Format CMD001
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  partner_id TEXT REFERENCES public.partners(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_category product_category NOT NULL DEFAULT 'PREMIUM',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  order_status order_status NOT NULL DEFAULT 'En attente',
  commission_status commission_status NOT NULL DEFAULT 'En attente',
  commission_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  rank_at_order partner_rank,
  client_order_index INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 8. TABLE PAIEMENTS (Règlements de commissions aux partenaires)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id TEXT PRIMARY KEY, -- Format PAY001
  partner_id TEXT NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 5000), -- Seuil métier minimum 5 000 FCFA
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'Mobile Money',
  reference TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 9. TABLE AUDIT LOGS (Traçabilité & Événements sensibles)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  action TEXT NOT NULL,
  performed_by TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 10. INDEX DE PERFORMANCE
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_partners_rank ON public.partners(rank);
CREATE INDEX IF NOT EXISTS idx_partners_status ON public.partners(status);
CREATE INDEX IF NOT EXISTS idx_clients_partner ON public.clients(partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_client ON public.orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_partner ON public.orders(partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON public.orders(date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_payments_partner ON public.payments(partner_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- 11. TRIGGERS POUR MISE À JOUR AUTOMATIQUE DE updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE OR REPLACE TRIGGER trg_waves_updated BEFORE UPDATE ON public.waves FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE OR REPLACE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE OR REPLACE TRIGGER trg_partners_updated BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE OR REPLACE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE OR REPLACE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 12. GESTION DES UTILISATEURS (PROFILES) AVEC MOINDRE PRIVILÈGE
-- Crée le profil avec le rôle 'CONSULTATION' par défaut.
-- L'administrateur peut ensuite promouvoir le compte manuellement en ADMIN.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'CONSULTATION', -- Rôle de sécurité minimal par défaut
    true
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- 13. FONCTION DE CONTRÔLE DE RÔLE ACTUEL
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid() AND active = true),
    'CONSULTATION'::user_role
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ----------------------------------------------------------------------------
-- 14. POLITIQUES DE SÉCURITÉ ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Politiques Profiles :
CREATE POLICY "Lecture de son propre profil ou lecture globale pour les admins"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.current_user_role() IN ('ADMIN', 'SUPER_ADMIN'));

CREATE POLICY "Gestion des profils réservée aux administrateurs"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('ADMIN', 'SUPER_ADMIN'));

-- Politiques Waves & Rank Thresholds :
CREATE POLICY "Lecture des vagues pour tout utilisateur authentifié"
  ON public.waves FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestion des vagues réservée aux administrateurs"
  ON public.waves FOR ALL TO authenticated USING (public.current_user_role() IN ('ADMIN', 'SUPER_ADMIN'));

CREATE POLICY "Lecture des seuils pour tout utilisateur authentifié"
  ON public.rank_thresholds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestion des seuils réservée aux administrateurs"
  ON public.rank_thresholds FOR ALL TO authenticated USING (public.current_user_role() IN ('ADMIN', 'SUPER_ADMIN'));

-- Politiques Products :
CREATE POLICY "Lecture des produits pour tout utilisateur authentifié"
  ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Modification des produits réservée aux administrateurs"
  ON public.products FOR ALL TO authenticated USING (public.current_user_role() IN ('ADMIN', 'SUPER_ADMIN'));

-- Politiques Partners, Clients, Orders :
CREATE POLICY "Lecture autorisée pour tous les utilisateurs authentifiés"
  ON public.partners FOR SELECT TO authenticated USING (true);
CREATE POLICY "Création partenaires autorisée pour OPERATIONS, ADMIN, SUPER_ADMIN"
  ON public.partners FOR INSERT TO authenticated WITH CHECK (public.current_user_role() IN ('OPERATIONS', 'ADMIN', 'SUPER_ADMIN'));
CREATE POLICY "Mise à jour partenaires autorisée pour OPERATIONS, FINANCE, ADMIN, SUPER_ADMIN"
  ON public.partners FOR UPDATE TO authenticated USING (public.current_user_role() IN ('OPERATIONS', 'FINANCE', 'ADMIN', 'SUPER_ADMIN'));

CREATE POLICY "Lecture clients autorisée pour tous les utilisateurs authentifiés"
  ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Création et modification clients autorisées pour OPERATIONS, ADMIN, SUPER_ADMIN"
  ON public.clients FOR ALL TO authenticated USING (public.current_user_role() IN ('OPERATIONS', 'ADMIN', 'SUPER_ADMIN'));

CREATE POLICY "Lecture commandes autorisée pour tous les rôles"
  ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestion commandes autorisée pour OPERATIONS, ADMIN, SUPER_ADMIN"
  ON public.orders FOR ALL TO authenticated USING (public.current_user_role() IN ('OPERATIONS', 'ADMIN', 'SUPER_ADMIN'));

-- Politiques Payments :
CREATE POLICY "Lecture paiements autorisée pour tous les rôles"
  ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestion paiements autorisée pour FINANCE, ADMIN, SUPER_ADMIN"
  ON public.payments FOR ALL TO authenticated USING (public.current_user_role() IN ('FINANCE', 'ADMIN', 'SUPER_ADMIN'));

-- Politiques Audit Logs :
CREATE POLICY "Lecture des logs d'audit réservée aux administrateurs"
  ON public.audit_logs FOR SELECT TO authenticated USING (public.current_user_role() IN ('ADMIN', 'SUPER_ADMIN'));
CREATE POLICY "Insertion des logs d'audit autorisée pour tout utilisateur authentifié"
  ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 15. CONFIGURATION MÉTIER OFFICIELLE (UNIQUEMENT VAGUES ET PRODUITS AKF)
-- AUCUN partenaire, AUCUN client, AUCUNE commande fictive insérée ici !
-- ----------------------------------------------------------------------------

-- VAGUE 1 OFFICIELLE (Active)
INSERT INTO public.waves (id, name, is_active, description)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'Vague 1 — Lancement AKF', true, 'Configuration initiale des paliers pour le réseau All Koff’s Food')
ON CONFLICT (name) DO UPDATE SET is_active = true;

-- SEUILS DE GRADES OFFICIELS POUR VAGUE 1
INSERT INTO public.rank_thresholds (wave_id, rank, min_orders, min_ca, default_commission_rate)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Neo', 0, 0, 0.0600),
  ('a0000000-0000-0000-0000-000000000001', 'Ambassador', 8, 100000, 0.0800),
  ('a0000000-0000-0000-0000-000000000001', 'Excellence', 20, 300000, 0.1000),
  ('a0000000-0000-0000-0000-000000000001', 'Signature', 50, 800000, 0.1200)
ON CONFLICT (wave_id, rank) DO UPDATE 
SET min_orders = EXCLUDED.min_orders, min_ca = EXCLUDED.min_ca, default_commission_rate = EXCLUDED.default_commission_rate;

-- PRODUITS OFFICIELS DU CATALOGUE ALL KOFF'S FOOD
INSERT INTO public.products (id, name, price, category, commission_type, commission_neo, commission_ambassador, commission_excellence, commission_signature, conditions, is_active)
VALUES
  (
    'PRD-ATOLECE',
    'Atō’lèçé (Plat Signature)',
    1500,
    'RÉCURRENT',
    'Forfaitaire',
    150, -- 150 FCFA / unité forfaitaire
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
    1500, -- 6% Neo
    2000, -- 8% Ambassador
    2500, -- 10% Excellence
    3000, -- 12% Signature
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
