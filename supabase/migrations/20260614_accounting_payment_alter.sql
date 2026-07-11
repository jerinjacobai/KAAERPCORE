-- ==============================================================================
-- KAA ERP - Accounting Module Enhancement (Alter Payments to reference new isolated tables)
-- Migration: 20260614_accounting_payment_alter.sql
-- ==============================================================================

ALTER TABLE public.accounting_payments
ADD COLUMN IF NOT EXISTS accounting_journal_id UUID REFERENCES public.accounting_journals(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS accounting_entry_id UUID REFERENCES public.accounting_journal_entries(id) ON DELETE SET NULL,
ALTER COLUMN journal_id DROP NOT NULL;
