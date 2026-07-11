-- ==============================================================================
-- KAA ERP - Accounting Module Enhancement (Sub-reports for Isolated Schema)
-- Migration: 20260614_accounting_subreports_rpcs.sql
-- ==============================================================================

-- 1. Sales Ledger Report
CREATE OR REPLACE FUNCTION rpc_get_accounting_sales_ledger_report(
    p_start_date DATE,
    p_end_date DATE
)
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
            sl.name as ledger_name,
            a.code as account_code,
            a.name as account_name,
            COALESCE(SUM(l.credit - l.debit), 0) as total_amount,
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'date', e.date,
                        'reference', e.reference,
                        'partner_name', p.name,
                        'description', l.name,
                        'amount', l.credit - l.debit
                    ) ORDER BY e.date DESC
                ) FILTER (WHERE l.id IS NOT NULL AND e.id IS NOT NULL),
                '[]'::jsonb
            ) as transactions
        FROM public.accounting_sales_ledgers sl
        JOIN public.accounting_chart_of_accounts a ON a.id = sl.account_id
        LEFT JOIN public.accounting_journal_lines l ON l.account_id = a.id
        LEFT JOIN public.accounting_journal_entries e ON e.id = l.entry_id AND e.state = 'Posted' AND e.date BETWEEN p_start_date AND p_end_date
        LEFT JOIN public.accounting_partners p ON p.id = e.partner_id
        WHERE sl.company_id = v_company_id
        GROUP BY sl.name, a.code, a.name
        ORDER BY sl.name
    ) t;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$$;

-- 2. Purchase Ledger Report
CREATE OR REPLACE FUNCTION rpc_get_accounting_purchase_ledger_report(
    p_start_date DATE,
    p_end_date DATE
)
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
            pl.name as ledger_name,
            a.code as account_code,
            a.name as account_name,
            COALESCE(SUM(l.debit - l.credit), 0) as total_amount,
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'date', e.date,
                        'reference', e.reference,
                        'partner_name', p.name,
                        'description', l.name,
                        'amount', l.debit - l.credit
                    ) ORDER BY e.date DESC
                ) FILTER (WHERE l.id IS NOT NULL AND e.id IS NOT NULL),
                '[]'::jsonb
            ) as transactions
        FROM public.accounting_purchase_ledgers pl
        JOIN public.accounting_chart_of_accounts a ON a.id = pl.account_id
        LEFT JOIN public.accounting_journal_lines l ON l.account_id = a.id
        LEFT JOIN public.accounting_journal_entries e ON e.id = l.entry_id AND e.state = 'Posted' AND e.date BETWEEN p_start_date AND p_end_date
        LEFT JOIN public.accounting_partners p ON p.id = e.partner_id
        WHERE pl.company_id = v_company_id
        GROUP BY pl.name, a.code, a.name
        ORDER BY pl.name
    ) t;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$$;

-- 3. Expense Analysis Report
CREATE OR REPLACE FUNCTION rpc_get_accounting_expense_analysis(
    p_start_date DATE,
    p_end_date DATE
)
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
        -- Direct Expenses
        SELECT 
            del.name as category,
            a.code as account_code,
            a.name as account_name,
            COALESCE(SUM(l.debit - l.credit), 0) as amount,
            'Direct' as type
        FROM public.accounting_direct_expense_ledgers del
        JOIN public.accounting_chart_of_accounts a ON a.id = del.account_id
        LEFT JOIN public.accounting_journal_lines l ON l.account_id = a.id
        LEFT JOIN public.accounting_journal_entries e ON e.id = l.entry_id AND e.state = 'Posted' AND e.date BETWEEN p_start_date AND p_end_date
        WHERE del.company_id = v_company_id
        GROUP BY del.name, a.code, a.name
        
        UNION ALL
        
        -- Indirect Expenses
        SELECT 
            'Indirect Expense' as category,
            a.code as account_code,
            a.name as account_name,
            COALESCE(SUM(l.debit - l.credit), 0) as amount,
            'Indirect' as type
        FROM public.accounting_chart_of_accounts a
        LEFT JOIN public.accounting_journal_lines l ON l.account_id = a.id
        LEFT JOIN public.accounting_journal_entries e ON e.id = l.entry_id AND e.state = 'Posted' AND e.date BETWEEN p_start_date AND p_end_date
        WHERE a.company_id = v_company_id
          AND a.type = 'Expense'
          AND a.subtype != 'COGS'
          AND a.id NOT IN (SELECT account_id FROM public.accounting_direct_expense_ledgers WHERE company_id = v_company_id)
        GROUP BY a.code, a.name
        
        ORDER BY type, category, account_code
    ) t WHERE t.amount != 0;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$$;
