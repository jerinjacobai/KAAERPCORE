-- ==============================================================================
-- KAA ERP - Accounting Module Enhancements
-- Migration: 20260615_fix_dashboard_rpcs.sql
-- Redefine dashboard functions to query the new isolated tables
-- ==============================================================================

-- 1. Fix rpc_finance_dashboard_summary
CREATE OR REPLACE FUNCTION public.rpc_finance_dashboard_summary(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_receivables NUMERIC := 0;
    v_payables NUMERIC := 0;
    v_bank NUMERIC := 0;
    v_revenue NUMERIC := 0;
    v_expenses NUMERIC := 0;
BEGIN
    -- Receivables (Out invoices where state is Posted)
    SELECT COALESCE(SUM(amount_residual), 0) INTO v_receivables 
    FROM public.accounting_journal_entries 
    WHERE company_id = p_company_id 
      AND move_type = 'out_invoice' 
      AND state = 'Posted';

    -- Payables (In invoices where state is Posted)
    SELECT COALESCE(SUM(amount_residual), 0) INTO v_payables 
    FROM public.accounting_journal_entries 
    WHERE company_id = p_company_id 
      AND move_type = 'in_invoice' 
      AND state = 'Posted';
    
    -- Bank/Cash balance (Debit - Credit)
    SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO v_bank 
    FROM public.accounting_journal_lines l 
    JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id 
    JOIN public.accounting_journal_entries m ON m.id = l.entry_id 
    WHERE m.company_id = p_company_id 
      AND m.state = 'Posted' 
      AND a.type = 'Asset' 
      AND a.subtype IN ('Bank', 'Cash');
    
    -- Revenue for Current Year (Income type)
    SELECT COALESCE(SUM(l.credit - l.debit), 0) INTO v_revenue 
    FROM public.accounting_journal_lines l 
    JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id 
    JOIN public.accounting_journal_entries m ON m.id = l.entry_id 
    WHERE m.company_id = p_company_id 
      AND m.state = 'Posted' 
      AND a.type = 'Income' 
      AND EXTRACT(YEAR FROM m.date) = EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Expenses for Current Year (Expense type)
    SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO v_expenses 
    FROM public.accounting_journal_lines l 
    JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id 
    JOIN public.accounting_journal_entries m ON m.id = l.entry_id 
    WHERE m.company_id = p_company_id 
      AND m.state = 'Posted' 
      AND a.type = 'Expense' 
      AND EXTRACT(YEAR FROM m.date) = EXTRACT(YEAR FROM CURRENT_DATE);

    RETURN jsonb_build_object(
        'receivables', v_receivables,
        'payables', v_payables,
        'bank_balance', v_bank,
        'revenue', v_revenue,
        'expenses', v_expenses,
        'net_profit', v_revenue - v_expenses
    );
END;
$$;


-- 2. Fix rpc_ar_aging
CREATE OR REPLACE FUNCTION public.rpc_ar_aging(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now DATE := CURRENT_DATE;
BEGIN
    RETURN (
        SELECT jsonb_build_object(
            'current', COALESCE(SUM(CASE WHEN due_date >= v_now THEN amount_residual ELSE 0 END), 0),
            'days_1_30', COALESCE(SUM(CASE WHEN v_now - due_date BETWEEN 1 AND 30 THEN amount_residual ELSE 0 END), 0),
            'days_31_60', COALESCE(SUM(CASE WHEN v_now - due_date BETWEEN 31 AND 60 THEN amount_residual ELSE 0 END), 0),
            'days_61_90', COALESCE(SUM(CASE WHEN v_now - due_date BETWEEN 61 AND 90 THEN amount_residual ELSE 0 END), 0),
            'days_over_90', COALESCE(SUM(CASE WHEN v_now - due_date > 90 THEN amount_residual ELSE 0 END), 0),
            'total', COALESCE(SUM(amount_residual), 0)
        )
        FROM public.accounting_journal_entries
        WHERE company_id = p_company_id 
          AND move_type = 'out_invoice' 
          AND state = 'Posted' 
          AND amount_residual > 0
    );
END;
$$;


-- 3. Fix rpc_revenue_expense_trend
CREATE OR REPLACE FUNCTION public.rpc_revenue_expense_trend(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN COALESCE(
        (SELECT jsonb_agg(row_to_json(t))
         FROM (
             WITH months AS (
                 SELECT generate_series(
                     date_trunc('month', CURRENT_DATE - interval '5 months'),
                     date_trunc('month', CURRENT_DATE),
                     '1 month'::interval
                 ) AS month_date
             ),
             monthly_data AS (
                 SELECT 
                     date_trunc('month', m.date) as month_date,
                     SUM(CASE WHEN a.type = 'Income' THEN (l.credit - l.debit) ELSE 0 END) as revenue,
                     SUM(CASE WHEN a.type = 'Expense' THEN (l.debit - l.credit) ELSE 0 END) as expense
                 FROM public.accounting_journal_lines l
                 JOIN public.accounting_chart_of_accounts a ON a.id = l.account_id
                 JOIN public.accounting_journal_entries m ON m.id = l.entry_id
                 WHERE m.company_id = p_company_id 
                   AND m.state = 'Posted'
                   AND m.date >= (CURRENT_DATE - interval '6 months')
                 GROUP BY date_trunc('month', m.date)
             )
             SELECT 
                 to_char(m.month_date, 'Mon') as month,
                 COALESCE(d.revenue, 0) as revenue,
                 COALESCE(d.expense, 0) as expense
             FROM months m
             LEFT JOIN monthly_data d ON m.month_date = d.month_date
             ORDER BY m.month_date
         ) t),
        '[]'::jsonb
    );
END;
$$;


-- 4. Fix rpc_global_dashboard
CREATE OR REPLACE FUNCTION public.rpc_global_dashboard(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_hr JSON;
    v_finance JSON;
    v_inventory JSON;
    v_approvals JSON;

    -- HR Variables
    v_active_employees INT := 0;
    v_attendance_pct INT := 0;
    v_present_today INT := 0;

    -- Finance Variables
    v_receivables NUMERIC := 0;
    v_payables NUMERIC := 0;
    v_overdue_invoices INT := 0;

    -- Inventory Variables
    v_stock_value NUMERIC := 0;
    v_low_stock_items INT := 0;
    
    -- Approvals Variables
    v_pending_leaves INT := 0;
    v_pending_transitions INT := 0;
BEGIN
    -- HR
    SELECT COUNT(*) INTO v_active_employees 
    FROM public.employees 
    WHERE company_id = p_company_id AND status = 'Active';

    SELECT COUNT(*) INTO v_present_today
    FROM public.attendance
    WHERE company_id = p_company_id AND date = CURRENT_DATE AND status = 'Present';

    IF v_active_employees > 0 THEN
        v_attendance_pct := ROUND((v_present_today::NUMERIC / v_active_employees::NUMERIC) * 100);
    END IF;

    v_hr := json_build_object(
        'active_employees', v_active_employees,
        'attendance_pct', v_attendance_pct
    );

    -- Finance (Using new isolated double entry journal entries)
    SELECT COALESCE(SUM(amount_residual), 0) INTO v_receivables
    FROM public.accounting_journal_entries
    WHERE company_id = p_company_id AND move_type = 'out_invoice' AND state = 'Posted' AND amount_residual > 0;

    SELECT COALESCE(SUM(amount_residual), 0) INTO v_payables
    FROM public.accounting_journal_entries
    WHERE company_id = p_company_id AND move_type = 'in_invoice' AND state = 'Posted' AND amount_residual > 0;

    SELECT COUNT(*) INTO v_overdue_invoices
    FROM public.accounting_journal_entries
    WHERE company_id = p_company_id AND move_type = 'out_invoice' AND state = 'Posted' AND due_date < CURRENT_DATE AND amount_residual > 0;

    v_finance := json_build_object(
        'receivables', v_receivables,
        'payables', v_payables,
        'overdue_invoices', v_overdue_invoices
    );

    -- Inventory
    SELECT COALESCE(SUM(total_value), 0) INTO v_stock_value
    FROM public.inventory_transactions
    WHERE company_id = p_company_id;


    SELECT COUNT(*) INTO v_low_stock_items
    FROM (
        SELECT sm.item_id, SUM(CASE WHEN sm.movement_type = 'IN' THEN sm.quantity ELSE -sm.quantity END) AS net_qty
        FROM public.stock_movements sm
        WHERE sm.company_id = p_company_id
        GROUP BY sm.item_id
    ) inventory
    JOIN public.item_master im ON inventory.item_id = im.id
    WHERE inventory.net_qty <= COALESCE(im.reorder_level, 10);

    v_inventory := json_build_object(
        'stock_value', v_stock_value,
        'low_stock_items', v_low_stock_items
    );

    -- Approvals
    SELECT COUNT(*) INTO v_pending_leaves
    FROM public.leaves
    WHERE company_id = p_company_id AND status = 'Pending';
    
    SELECT COUNT(*) INTO v_pending_transitions
    FROM public.employee_job_transitions
    WHERE company_id = p_company_id AND status = 'Pending';

    v_approvals := json_build_object(
        'pending_leaves', v_pending_leaves,
        'pending_transitions', v_pending_transitions
    );

    RETURN json_build_object(
        'hr', v_hr,
        'finance', v_finance,
        'inventory', v_inventory,
        'approvals', v_approvals
    );
END;
$$;

NOTIFY pgrst, 'reload schema';
