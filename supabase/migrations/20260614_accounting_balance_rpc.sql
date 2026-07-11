-- ==============================================================================
-- KAA ERP - Accounting Module Enhancement (Account Balance for Isolated Schema)
-- Migration: 20260614_accounting_balance_rpc.sql
-- ==============================================================================

CREATE OR REPLACE FUNCTION rpc_get_accounting_account_balance(p_account_id UUID, p_date DATE)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance NUMERIC;
BEGIN
    SELECT COALESCE(SUM(debit - credit), 0) INTO v_balance
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON l.entry_id = e.id
    WHERE l.account_id = p_account_id AND e.date <= p_date AND e.state = 'Posted';
    
    RETURN v_balance;
END;
$$;
