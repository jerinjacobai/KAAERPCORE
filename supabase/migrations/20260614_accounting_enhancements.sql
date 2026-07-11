-- ==============================================================================
-- KAA ERP - Accounting Module Enhancement (Isolated P&L Structure)
-- Migration: 20260614_accounting_enhancements.sql
-- ==============================================================================

-- 1. Fiscal Years Table
CREATE TABLE IF NOT EXISTS public.accounting_fiscal_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., 'FY 2026-2027'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uk_accounting_fiscal_year_name UNIQUE (company_id, name)
);

-- 2. Alter existing accounting_periods to support the new fiscal years (optional linkage)
ALTER TABLE public.accounting_periods 
ADD COLUMN IF NOT EXISTS accounting_fiscal_year_id UUID REFERENCES public.accounting_fiscal_years(id) ON DELETE CASCADE;

-- 3. Account Groups Table
CREATE TABLE IF NOT EXISTS public.accounting_account_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code_prefix_start TEXT,
    code_prefix_end TEXT,
    type TEXT NOT NULL CHECK (type IN ('Asset', 'Liability', 'Equity', 'Income', 'Expense')),
    parent_id UUID REFERENCES public.accounting_account_groups(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uk_accounting_account_group_name UNIQUE (company_id, name)
);

-- 4. Chart of Accounts Table
CREATE TABLE IF NOT EXISTS public.accounting_chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Asset', 'Liability', 'Equity', 'Income', 'Expense')),
    subtype TEXT CHECK (subtype IN ('Receivable', 'Payable', 'Bank', 'Cash', 'COGS', 'Revenue', 'Other')),
    account_group_id UUID REFERENCES public.accounting_account_groups(id) ON DELETE SET NULL,
    currency_id UUID REFERENCES public.financial_masters_currencies(id) ON DELETE SET NULL,
    is_reconcilable BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uk_accounting_coa_code UNIQUE (company_id, code)
);

-- 5. Cost Centers Table
CREATE TABLE IF NOT EXISTS public.accounting_cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('PROJECT', 'CONTRACT', 'GENERIC')),
    parent_id UUID REFERENCES public.accounting_cost_centers(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uk_accounting_cost_center_code UNIQUE (company_id, code)
);

-- 6. Journals Table
CREATE TABLE IF NOT EXISTS public.accounting_journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Sale', 'Purchase', 'Cash', 'Bank', 'General')),
    default_account_id UUID REFERENCES public.accounting_chart_of_accounts(id) ON DELETE SET NULL,
    sequence_prefix TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uk_accounting_journal_code UNIQUE (company_id, code)
);

-- 7. Taxes Table
CREATE TABLE IF NOT EXISTS public.accounting_taxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Percent' CHECK (type IN ('Percent', 'Fixed', 'Group')),
    scope TEXT NOT NULL DEFAULT 'Sales' CHECK (scope IN ('Sales', 'Purchase', 'None')),
    amount NUMERIC NOT NULL,
    account_id UUID REFERENCES public.accounting_chart_of_accounts(id) ON DELETE SET NULL,
    refund_account_id UUID REFERENCES public.accounting_chart_of_accounts(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uk_accounting_taxes_name UNIQUE (company_id, name)
);

-- 8. Payment Terms Table
CREATE TABLE IF NOT EXISTS public.accounting_payment_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    days INTEGER NOT NULL CHECK (days >= 0),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uk_accounting_payment_term_name UNIQUE (company_id, name)
);

-- 9. Stock Categories Table
CREATE TABLE IF NOT EXISTS public.accounting_stock_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    item_category TEXT NOT NULL,
    asset_account_id UUID REFERENCES public.accounting_chart_of_accounts(id) ON DELETE SET NULL,
    cogs_account_id UUID REFERENCES public.accounting_chart_of_accounts(id) ON DELETE SET NULL,
    adjustment_account_id UUID REFERENCES public.accounting_chart_of_accounts(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uk_accounting_stock_category_name UNIQUE (company_id, name)
);

-- 10. Purchase Ledgers Table
CREATE TABLE IF NOT EXISTS public.accounting_purchase_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    account_id UUID REFERENCES public.accounting_chart_of_accounts(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uk_accounting_purchase_ledger_name UNIQUE (company_id, name)
);

-- 11. Sales Ledgers Table
CREATE TABLE IF NOT EXISTS public.accounting_sales_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    account_id UUID REFERENCES public.accounting_chart_of_accounts(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uk_accounting_sales_ledger_name UNIQUE (company_id, name)
);

-- 12. Direct Expense Ledgers Table
CREATE TABLE IF NOT EXISTS public.accounting_direct_expense_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    account_id UUID REFERENCES public.accounting_chart_of_accounts(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uk_accounting_direct_expense_ledger_name UNIQUE (company_id, name)
);

-- 13. Indirect Income Ledgers Table
CREATE TABLE IF NOT EXISTS public.accounting_indirect_income_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    account_id UUID REFERENCES public.accounting_chart_of_accounts(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uk_accounting_indirect_income_ledger_name UNIQUE (company_id, name)
);

-- 14. Journal Entries Table (Headers)
CREATE TABLE IF NOT EXISTS public.accounting_journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    journal_id UUID NOT NULL REFERENCES public.accounting_journals(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_id UUID REFERENCES public.accounting_periods(id) ON DELETE SET NULL,
    reference TEXT,
    notes TEXT,
    partner_id UUID REFERENCES public.accounting_partners(id) ON DELETE SET NULL,
    state TEXT NOT NULL DEFAULT 'Draft' CHECK (state IN ('Draft', 'Posted', 'Cancelled')),
    move_type TEXT NOT NULL DEFAULT 'entry' CHECK (move_type IN ('entry', 'out_invoice', 'in_invoice', 'out_refund', 'in_refund')),
    invoice_date DATE,
    due_date DATE,
    amount_total NUMERIC NOT NULL DEFAULT 0,
    amount_residual NUMERIC NOT NULL DEFAULT 0,
    approval_status TEXT NOT NULL DEFAULT 'approved',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15. Journal Lines Table (Detail rows)
CREATE TABLE IF NOT EXISTS public.accounting_journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    entry_id UUID NOT NULL REFERENCES public.accounting_journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounting_chart_of_accounts(id) ON DELETE RESTRICT,
    partner_id UUID REFERENCES public.accounting_partners(id) ON DELETE SET NULL,
    name TEXT,
    debit NUMERIC NOT NULL DEFAULT 0 CHECK (debit >= 0),
    credit NUMERIC NOT NULL DEFAULT 0 CHECK (credit >= 0),
    balance NUMERIC GENERATED ALWAYS AS (debit - credit) STORED,
    cost_center_id UUID REFERENCES public.accounting_cost_centers(id) ON DELETE SET NULL,
    project_cost_center_id UUID REFERENCES public.accounting_cost_centers(id) ON DELETE SET NULL,
    contract_cost_center_id UUID REFERENCES public.accounting_cost_centers(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- Row Level Security (RLS) policies
-- ==============================================================================

ALTER TABLE public.accounting_fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_account_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_payment_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_stock_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_purchase_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_sales_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_direct_expense_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_indirect_income_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_journal_lines ENABLE ROW LEVEL SECURITY;

-- Dynamic Tenant Isolation Policy
CREATE POLICY "Tenant Isolation" ON public.accounting_fiscal_years USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON public.accounting_account_groups USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON public.accounting_chart_of_accounts USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON public.accounting_cost_centers USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON public.accounting_journals USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON public.accounting_taxes USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON public.accounting_payment_terms USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON public.accounting_stock_categories USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON public.accounting_purchase_ledgers USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON public.accounting_sales_ledgers USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON public.accounting_direct_expense_ledgers USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON public.accounting_indirect_income_ledgers USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON public.accounting_journal_entries USING (company_id = get_my_company_id());
CREATE POLICY "Tenant Isolation" ON public.accounting_journal_lines USING (company_id = get_my_company_id());

-- Allow all actions for users belonging to the same tenant company (permissive write)
CREATE POLICY "Permissive Tenant Insert" ON public.accounting_fiscal_years FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Update" ON public.accounting_fiscal_years FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_fiscal_years FOR DELETE USING (company_id = get_my_company_id());

CREATE POLICY "Permissive Tenant Insert" ON public.accounting_account_groups FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Update" ON public.accounting_account_groups FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_account_groups FOR DELETE USING (company_id = get_my_company_id());

CREATE POLICY "Permissive Tenant Insert" ON public.accounting_chart_of_accounts FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Update" ON public.accounting_chart_of_accounts FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_chart_of_accounts FOR DELETE USING (company_id = get_my_company_id());

CREATE POLICY "Permissive Tenant Insert" ON public.accounting_cost_centers FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Update" ON public.accounting_cost_centers FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_cost_centers FOR DELETE USING (company_id = get_my_company_id());

CREATE POLICY "Permissive Tenant Insert" ON public.accounting_journals FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Update" ON public.accounting_journals FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_journals FOR DELETE USING (company_id = get_my_company_id());

CREATE POLICY "Permissive Tenant Insert" ON public.accounting_taxes FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Update" ON public.accounting_taxes FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_taxes FOR DELETE USING (company_id = get_my_company_id());

CREATE POLICY "Permissive Tenant Insert" ON public.accounting_payment_terms FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Update" ON public.accounting_payment_terms FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_payment_terms FOR DELETE USING (company_id = get_my_company_id());

CREATE POLICY "Permissive Tenant Insert" ON public.accounting_stock_categories FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Update" ON public.accounting_stock_categories FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_stock_categories FOR DELETE USING (company_id = get_my_company_id());

CREATE POLICY "Permissive Tenant Insert" ON public.accounting_purchase_ledgers FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Update" ON public.accounting_purchase_ledgers FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_purchase_ledgers FOR DELETE USING (company_id = get_my_company_id());

CREATE POLICY "Permissive Tenant Insert" ON public.accounting_sales_ledgers FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Update" ON public.accounting_sales_ledgers FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_sales_ledgers FOR DELETE USING (company_id = get_my_company_id());

CREATE POLICY "Permissive Tenant Insert" ON public.accounting_direct_expense_ledgers FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Update" ON public.accounting_direct_expense_ledgers FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_direct_expense_ledgers FOR DELETE USING (company_id = get_my_company_id());

CREATE POLICY "Permissive Tenant Insert" ON public.accounting_indirect_income_ledgers FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Update" ON public.accounting_indirect_income_ledgers FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_indirect_income_ledgers FOR DELETE USING (company_id = get_my_company_id());

CREATE POLICY "Permissive Tenant Insert" ON public.accounting_journal_entries FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Update" ON public.accounting_journal_entries FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_journal_entries FOR DELETE USING (company_id = get_my_company_id());

CREATE POLICY "Permissive Tenant Insert" ON public.accounting_journal_lines FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Update" ON public.accounting_journal_lines FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "Permissive Tenant Delete" ON public.accounting_journal_lines FOR DELETE USING (company_id = get_my_company_id());

-- ==============================================================================
-- Function for Auto posting journal entry (equivalent to rpc_post_move but for new tables)
-- ==============================================================================

CREATE OR REPLACE FUNCTION rpc_post_accounting_entry(p_entry_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_entry RECORD;
    v_total_debit NUMERIC;
    v_total_credit NUMERIC;
    v_period_id UUID;
BEGIN
    SELECT * INTO v_entry FROM accounting_journal_entries WHERE id = p_entry_id;
    
    IF v_entry.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Journal Entry not found');
    END IF;

    IF v_entry.state = 'Posted' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Entry is already posted');
    END IF;

    SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0) INTO v_total_debit, v_total_credit
    FROM accounting_journal_lines
    WHERE entry_id = p_entry_id;

    IF v_total_debit != v_total_credit THEN
        RETURN jsonb_build_object('success', false, 'message', 'Journal Entry is unbalanced. Debits (' || v_total_debit::TEXT || ') != Credits (' || v_total_credit::TEXT || ')');
    END IF;

    IF v_total_debit = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cannot post an empty journal entry');
    END IF;

    -- Update Entry
    UPDATE accounting_journal_entries
    SET 
        state = 'Posted',
        amount_total = v_total_debit,
        amount_residual = v_total_debit
    WHERE id = p_entry_id;

    RETURN jsonb_build_object('success', true, 'message', 'Journal Entry Posted Successfully');
END;
$$;
