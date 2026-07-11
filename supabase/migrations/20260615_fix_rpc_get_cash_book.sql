-- ==============================================================================
-- KAA ERP - Accounting Module Enhancement
-- Migration: 20260615_fix_rpc_get_cash_book.sql
-- ==============================================================================

CREATE OR REPLACE FUNCTION rpc_get_cash_book(p_start_date DATE, p_end_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id UUID;
    v_data JSONB;
BEGIN
    v_company_id := get_my_company_id();

    SELECT jsonb_agg(t) INTO v_data FROM (
        SELECT 
            e.date,
            l.name as description,
            a.name as account_name,
            l.debit,
            l.credit,
            SUM(l.debit - l.credit) OVER (ORDER BY e.date, l.created_at) as running_balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date BETWEEN p_start_date AND p_end_date
          AND a.subtype = 'Cash'
        ORDER BY e.date, l.created_at
    ) t;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$$;
