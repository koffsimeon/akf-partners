-- ============================================================================
-- AKF PARTNERS — SCHÉMA POSTGRESQL & POLITIQUES DE SÉCURITÉ SUPABASE (RLS)
-- Date de création : 04 Novembre 2026
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
-- 2. TABLE PROFILES (Utilisateurs et Rôles RBAC)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'CONSULTATION',
  avatar_url TEXT,
  phone TEXT,
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
  CONSTRAINT unique_wave_rank UNIQUE (wave_id, rank)
);

-- ----------------------------------------------------------------------------
-- 4. TABLE PRODUITS (Dynamique, Pourcentage vs Forfaitaire)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  category product_category NOT NULL DEFAULT 'PREMIUM',
  commission_type commission_calc_type NOT NULL DEFAULT 'Pourcentage',
  commission_neo NUMERIC(12, 2) NOT NULL DEFAULT 0,
  commission_ambassador NUMERIC(12, 2) NOT NULL DEFAULT 0,
  commission_excellence NUMERIC(12, 2) NOT NULL DEFAULT 0,
  commission_signature NUMERIC(12, 2) NOT NULL DEFAULT 0,
  conditions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 5. TABLE PARTENAIRES (AKFxxx)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partners (
  id TEXT PRIMARY KEY, -- Format AKF001
  code TEXT NOT NULL UNIQUE, -- Format AKF-TOS02
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_canonical TEXT NOT NULL,
  whatsapp TEXT,
  rank partner_rank NOT NULL DEFAULT 'Neo',
  wave_id UUID REFERENCES public.waves(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('Actif', 'Inactif')) DEFAULT 'Actif',
  ca NUMERIC(14, 2) NOT NULL DEFAULT 0,
  client_count INTEGER NOT NULL DEFAULT 0,
  order_count INTEGER NOT NULL DEFAULT 0,
  total_commission NUMERIC(14, 2) NOT NULL DEFAULT 0,
  validated_commission NUMERIC(14, 2) NOT NULL DEFAULT 0,
  paid_commission NUMERIC(14, 2) NOT NULL DEFAULT 0,
  balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 6. TABLE CLIENTS (CLxxx)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id TEXT PRIMARY KEY, -- Format CL001
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_canonical TEXT NOT NULL,
  whatsapp TEXT,
  city TEXT,
  address TEXT,
  notes TEXT,
  partner_id TEXT REFERENCES public.partners(id) ON DELETE SET NULL,
  client_type client_type NOT NULL DEFAULT 'DIRECT AKF',
  order_count INTEGER NOT NULL DEFAULT 0,
  total_ca NUMERIC(14, 2) NOT NULL DEFAULT 0,
  last_order_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 7. TABLE COMMANDES (CMDxxx)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY, -- Format CMD001
  date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  partner_id TEXT REFERENCES public.partners(id) ON DELETE SET NULL,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  category product_category NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  order_status order_status NOT NULL DEFAULT 'En attente',
  commission_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  commission_status commission_status NOT NULL DEFAULT 'En attente',
  payment_method TEXT NOT NULL DEFAULT 'Espèces',
  rank_at_order partner_rank,
  premium_rank INTEGER,
  observation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 8. TABLE PAIEMENTS DE COMMISSIONS (PAYxxx)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id TEXT PRIMARY KEY, -- Format PAY001
  date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  partner_id TEXT NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 5000), -- Minimum métier 5 000 FCFA
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Mobile Money (MTN / Moov)', 'Virement Bancaire', 'Espèces', 'Chèque')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('Effectué', 'En attente', 'Rejeté')) DEFAULT 'Effectué',
  observation TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 9. TABLE AUDIT LOGS (Traçabilité : Qui a fait quoi et quand)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT NOT NULL,
  payload_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 10. INDEX POUR PERFORMANCES OPTIMALES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_partners_code ON public.partners(code);
CREATE INDEX IF NOT EXISTS idx_partners_phone ON public.partners(phone_canonical);
CREATE INDEX IF NOT EXISTS idx_clients_partner ON public.clients(partner_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone_canonical);
CREATE INDEX IF NOT EXISTS idx_orders_client ON public.orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_partner ON public.orders(partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON public.orders(date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_payments_partner ON public.payments(partner_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- 11. TRIGGER POUR MISE À JOUR AUTOMATIQUE DE updated_at
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
-- 12. FONCTION UTILITAIRE : RÔLE UTILISATEUR COURANT DANS SUPABASE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ----------------------------------------------------------------------------
-- 13. POLITIQUES DE SÉCURITÉ ROW LEVEL SECURITY (RLS)
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
CREATE POLICY "Les utilisateurs authentifiés peuvent lire leur profil"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.current_user_role() IN ('ADMIN', 'SUPER_ADMIN'));

CREATE POLICY "Les admins peuvent gérer les profils"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('ADMIN', 'SUPER_ADMIN'));

-- Politiques Waves & Rank Thresholds :
CREATE POLICY "Lecture publique des vagues pour tout utilisateur authentifié"
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
CREATE POLICY "Lecture autorisée pour tous les rôles authentifiés"
  ON public.partners FOR SELECT TO authenticated USING (true);
CREATE POLICY "Écriture partenaires autorisée pour OPERATIONS, ADMIN, SUPER_ADMIN"
  ON public.partners FOR INSERT TO authenticated WITH CHECK (public.current_user_role() IN ('OPERATIONS', 'ADMIN', 'SUPER_ADMIN'));
CREATE POLICY "Mise à jour partenaires autorisée pour OPERATIONS, ADMIN, SUPER_ADMIN"
  ON public.partners FOR UPDATE TO authenticated USING (public.current_user_role() IN ('OPERATIONS', 'FINANCE', 'ADMIN', 'SUPER_ADMIN'));

CREATE POLICY "Lecture clients autorisée pour tous les rôles"
  ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Création/Mise à jour clients autorisée pour OPERATIONS, ADMIN, SUPER_ADMIN"
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
