ALTER TABLE public.commission_tables 
ADD COLUMN payment_mode text NOT NULL DEFAULT 'one_shot';