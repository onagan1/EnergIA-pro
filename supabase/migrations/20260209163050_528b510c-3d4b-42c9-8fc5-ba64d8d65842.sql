
-- Tabela de perfis de utilizador (cada user pode ter vários perfis)
CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_name text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS: Users veem os seus próprios perfis, admins veem todos
CREATE POLICY "Users can view own profiles"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create own profiles"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profiles"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete own profiles"
  ON public.user_profiles FOR DELETE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de comissões associada a perfil
CREATE TABLE public.commission_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  supplier_name text NOT NULL,
  campaign_name text,
  criteria_type text NOT NULL DEFAULT 'fixo',
  criteria_value text,
  commission_value numeric NOT NULL DEFAULT 0,
  commission_unit text NOT NULL DEFAULT 'euro',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_tables ENABLE ROW LEVEL SECURITY;

-- RLS: Admins full access, users podem ler comissões dos seus perfis
CREATE POLICY "Admins full access commissions"
  ON public.commission_tables FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own profile commissions"
  ON public.commission_tables FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = commission_tables.profile_id
        AND user_profiles.user_id = auth.uid()
    )
  );

-- Trigger updated_at
CREATE TRIGGER update_commission_tables_updated_at
  BEFORE UPDATE ON public.commission_tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket para ficheiros comissionais
INSERT INTO storage.buckets (id, name, public)
VALUES ('comissoes', 'comissoes', false);

-- Storage policies - apenas admins
CREATE POLICY "Admins can upload commission files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'comissoes' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read commission files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'comissoes' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete commission files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'comissoes' AND has_role(auth.uid(), 'admin'));
