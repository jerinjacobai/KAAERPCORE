-- ==============================================================================
-- KAA ERP - Accounting Module Enhancement (Reporting Functions for Isolated Schema)
-- Migration: 20260614_accounting_reporting_rpcs.sql
-- ==============================================================================

-- 1. Balance Sheet
CREATE OR REPLACE FUNCTION rpc_get_accounting_balance_sheet(
    p_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id UUID;
    v_assets JSONB;
    v_liabilities JSONB;
    v_equity JSONB;
    v_current_year_earnings NUMERIC;
BEGIN
    v_company_id := get_my_company_id();

    -- Calculate Current Year Earnings (Net Profit/Loss up to p_date)
    SELECT COALESCE(SUM(l.credit - l.debit), 0)
    INTO v_current_year_earnings
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
    WHERE e.company_id = v_company_id
      AND e.state = 'Posted'
      AND e.date <= p_date
      AND a.type IN ('Income', 'Expense');

    -- Assets (Debit - Credit)
    SELECT jsonb_agg(t) INTO v_assets FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.debit - l.credit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date <= p_date
          AND a.type = 'Asset'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.debit - l.credit) != 0
        ORDER BY a.code
    ) t;

    -- Liabilities (Credit - Debit)
    SELECT jsonb_agg(t) INTO v_liabilities FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.credit - l.debit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date <= p_date
          AND a.type = 'Liability'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.credit - l.debit) != 0
        ORDER BY a.code
    ) t;

    -- Equity (Credit - Debit)
    SELECT jsonb_agg(t) INTO v_equity FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.credit - l.debit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date <= p_date
          AND a.type = 'Equity'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.credit - l.debit) != 0
        
        UNION ALL
        
        SELECT 
            '999999' as code, 
            'Current Year Earnings' as name, 
            'Retained Earnings' as subtype, 
            v_current_year_earnings as balance
        WHERE v_current_year_earnings != 0
        
        ORDER BY code
    ) t;

    RETURN jsonb_build_object(
        'date', p_date,
        'assets', COALESCE(v_assets, '[]'::jsonb),
        'liabilities', COALESCE(v_liabilities, '[]'::jsonb),
        'equity', COALESCE(v_equity, '[]'::jsonb)
    );
END;
$$;

-- 2. Profit & Loss
CREATE OR REPLACE FUNCTION rpc_get_accounting_profit_loss(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id UUID;
    v_revenue JSONB;
    v_cogs JSONB;
    v_indirect_income JSONB;
    v_indirect_expense JSONB;
    v_total_revenue NUMERIC := 0;
    v_total_cogs NUMERIC := 0;
    v_total_indirect_income NUMERIC := 0;
    v_total_indirect_expense NUMERIC := 0;
    v_gross_profit NUMERIC := 0;
    v_net_profit NUMERIC := 0;
BEGIN
    v_company_id := get_my_company_id();

    -- 1. Revenue (Credit - Debit)
    SELECT COALESCE(SUM(l.credit - l.debit), 0) INTO v_total_revenue
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
    WHERE e.company_id = v_company_id
      AND e.state = 'Posted'
      AND e.date BETWEEN p_start_date AND p_end_date
      AND a.type = 'Income' AND a.subtype = 'Revenue';

    SELECT jsonb_agg(t) INTO v_revenue FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.credit - l.debit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date BETWEEN p_start_date AND p_end_date
          AND a.type = 'Income' AND a.subtype = 'Revenue'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.credit - l.debit) != 0
        ORDER BY a.code
    ) t;

    -- 2. Cost of Sales (Debit - Credit)
    SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO v_total_cogs
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
    WHERE e.company_id = v_company_id
      AND e.state = 'Posted'
      AND e.date BETWEEN p_start_date AND p_end_date
      AND a.type = 'Expense' AND a.subtype = 'COGS';

    SELECT jsonb_agg(t) INTO v_cogs FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.debit - l.credit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date BETWEEN p_start_date AND p_end_date
          AND a.type = 'Expense' AND a.subtype = 'COGS'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.debit - l.credit) != 0
        ORDER BY a.code
    ) t;

    v_gross_profit := v_total_revenue - v_total_cogs;

    -- 3. Indirect Income (Credit - Debit)
    SELECT COALESCE(SUM(l.credit - l.debit), 0) INTO v_total_indirect_income
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
    WHERE e.company_id = v_company_id
      AND e.state = 'Posted'
      AND e.date BETWEEN p_start_date AND p_end_date
      AND a.type = 'Income' AND a.subtype != 'Revenue';

    SELECT jsonb_agg(t) INTO v_indirect_income FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.credit - l.debit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date BETWEEN p_start_date AND p_end_date
          AND a.type = 'Income' AND a.subtype != 'Revenue'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.credit - l.debit) != 0
        ORDER BY a.code
    ) t;

    -- 4. Indirect Expenses (Debit - Credit)
    SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO v_total_indirect_expense
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
    WHERE e.company_id = v_company_id
      AND e.state = 'Posted'
      AND e.date BETWEEN p_start_date AND p_end_date
      AND a.type = 'Expense' AND a.subtype != 'COGS';

    SELECT jsonb_agg(t) INTO v_indirect_expense FROM (
        SELECT 
            a.code, a.name, a.subtype,
            SUM(l.debit - l.credit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date BETWEEN p_start_date AND p_end_date
          AND a.type = 'Expense' AND a.subtype != 'COGS'
        GROUP BY a.code, a.name, a.subtype
        HAVING SUM(l.debit - l.credit) != 0
        ORDER BY a.code
    ) t;

    v_net_profit := v_gross_profit + v_total_indirect_income - v_total_indirect_expense;

    RETURN jsonb_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date,
        'revenue', COALESCE(v_revenue, '[]'::jsonb),
        'cogs', COALESCE(v_cogs, '[]'::jsonb),
        'indirect_income', COALESCE(v_indirect_income, '[]'::jsonb),
        'indirect_expense', COALESCE(v_indirect_expense, '[]'::jsonb),
        'total_revenue', v_total_revenue,
        'total_cogs', v_total_cogs,
        'gross_profit', v_gross_profit,
        'total_indirect_income', v_total_indirect_income,
        'total_indirect_expense', v_total_indirect_expense,
        'net_profit', v_net_profit
    );
END;
$$;

-- 3. Trial Balance
CREATE OR REPLACE FUNCTION rpc_get_accounting_trial_balance(p_date DATE)
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
            a.code,
            a.name,
            a.type,
            SUM(l.debit) as total_debit,
            SUM(l.credit) as total_credit,
            SUM(l.debit - l.credit) as balance
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date <= p_date
        GROUP BY a.code, a.name, a.type
        HAVING SUM(l.debit) != 0 OR SUM(l.credit) != 0
        ORDER BY a.code
    ) t;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$$;

-- 4. Partner Aging
CREATE OR REPLACE FUNCTION rpc_get_accounting_partner_aging(p_partner_type TEXT, p_date DATE)
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
            p.name as partner_name,
            SUM(CASE WHEN (p_date - e.due_date) <= 0 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as current,
            SUM(CASE WHEN (p_date - e.due_date) BETWEEN 1 AND 30 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as bucket_30,
            SUM(CASE WHEN (p_date - e.due_date) BETWEEN 31 AND 60 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as bucket_60,
            SUM(CASE WHEN (p_date - e.due_date) BETWEEN 61 AND 90 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as bucket_90,
            SUM(CASE WHEN (p_date - e.due_date) > 90 THEN (CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) ELSE 0 END) as bucket_90_plus,
            SUM(CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) as total_overdue
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_partners p ON p.id = e.partner_id
        JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
        WHERE e.company_id = v_company_id
          AND e.state = 'Posted'
          AND e.date <= p_date
          AND a.subtype IN ('Receivable', 'Payable')
          AND p.partner_type IN (p_partner_type, 'Both')
        GROUP BY p.name
        HAVING SUM(CASE WHEN p_partner_type = 'Customer' THEN l.debit - l.credit ELSE l.credit - l.debit END) != 0
        ORDER BY p.name
    ) t;

    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$$;
