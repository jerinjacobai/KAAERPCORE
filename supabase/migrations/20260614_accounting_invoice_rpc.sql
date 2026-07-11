-- ==============================================================================
-- KAA ERP - Accounting Module Enhancement (Isolated Invoicing Logic)
-- Migration: 20260614_accounting_invoice_rpc.sql
-- ==============================================================================

CREATE OR REPLACE FUNCTION rpc_create_accounting_invoice(
    p_partner_id UUID,
    p_journal_id UUID,
    p_date DATE,
    p_due_date DATE,
    p_move_type TEXT, -- 'out_invoice', 'in_invoice'
    p_lines JSONB -- Array of {item_id, quantity, unit_price, cost_center_id, project_cost_center_id, contract_cost_center_id}
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_entry_id UUID;
    v_company_id UUID;
    v_line JSONB;
    v_item RECORD;
    v_partner RECORD;
    v_account_id UUID; -- The income/expense account
    v_receivable_payable_account_id UUID; -- The AR/AP account
    v_total_amount NUMERIC := 0;
BEGIN
    v_company_id := get_my_company_id();
    
    -- 1. Get Partner Details & AR/AP Account in the new chart of accounts
    SELECT * INTO v_partner FROM accounting_partners WHERE id = p_partner_id;
    IF p_move_type = 'out_invoice' THEN
        -- Map partner's property_account_receivable_id to new accounting_chart_of_accounts by matching code
        SELECT new_acc.id INTO v_receivable_payable_account_id
        FROM public.accounting_chart_of_accounts new_acc
        JOIN public.chart_of_accounts old_acc ON old_acc.code = new_acc.code
        WHERE old_acc.id = v_partner.property_account_receivable_id AND new_acc.company_id = v_company_id;
        
        -- Fallback if not configured or not found
        IF v_receivable_payable_account_id IS NULL THEN
            SELECT id INTO v_receivable_payable_account_id
            FROM public.accounting_chart_of_accounts
            WHERE company_id = v_company_id AND subtype = 'Receivable'
            LIMIT 1;
        END IF;
    ELSIF p_move_type = 'in_invoice' THEN
        -- Map partner's property_account_payable_id to new accounting_chart_of_accounts by matching code
        SELECT new_acc.id INTO v_receivable_payable_account_id
        FROM public.accounting_chart_of_accounts new_acc
        JOIN public.chart_of_accounts old_acc ON old_acc.code = new_acc.code
        WHERE old_acc.id = v_partner.property_account_payable_id AND new_acc.company_id = v_company_id;
        
        -- Fallback if not configured or not found
        IF v_receivable_payable_account_id IS NULL THEN
            SELECT id INTO v_receivable_payable_account_id
            FROM public.accounting_chart_of_accounts
            WHERE company_id = v_company_id AND subtype = 'Payable'
            LIMIT 1;
        END IF;
    END IF;

    IF v_receivable_payable_account_id IS NULL THEN
        RAISE EXCEPTION 'Partner % missing default Receivable/Payable account in the new chart of accounts', v_partner.name;
    END IF;

    -- 2. Create Header (Draft State) in the new accounting_journal_entries
    INSERT INTO public.accounting_journal_entries (
        company_id, journal_id, date, invoice_date, due_date, 
        partner_id, move_type, state, amount_total
    ) VALUES (
        v_company_id, p_journal_id, p_date, p_date, p_due_date,
        p_partner_id, p_move_type, 'Draft', 0
    ) RETURNING id INTO v_entry_id;

    -- 3. Process Lines
    -- Loop through items
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        -- Get Item Details
        SELECT * INTO v_item FROM item_master WHERE id = (v_line->>'item_id')::UUID;
        
        IF p_move_type = 'out_invoice' THEN
            -- Map item's income_account_id to new accounting_chart_of_accounts by matching code
            SELECT new_acc.id INTO v_account_id
            FROM public.accounting_chart_of_accounts new_acc
            JOIN public.chart_of_accounts old_acc ON old_acc.code = new_acc.code
            WHERE old_acc.id = v_item.income_account_id AND new_acc.company_id = v_company_id;
            
            -- Fallback: first revenue account
            IF v_account_id IS NULL THEN
                SELECT id INTO v_account_id
                FROM public.accounting_chart_of_accounts
                WHERE company_id = v_company_id AND subtype = 'Revenue'
                LIMIT 1;
            END IF;
            
            IF v_account_id IS NULL THEN RAISE EXCEPTION 'Item % missing Income Account in new chart of accounts', v_item.name; END IF;
            
            -- Credit Income (Income is credited on invoice)
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name,
                debit, credit, cost_center_id, project_cost_center_id, contract_cost_center_id
            ) VALUES (
                v_company_id, v_entry_id, v_account_id, p_partner_id, v_item.name,
                0, (v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric,
                NULLIF(v_line->>'cost_center_id', '')::uuid, 
                NULLIF(v_line->>'project_cost_center_id', '')::uuid, 
                NULLIF(v_line->>'contract_cost_center_id', '')::uuid
            );
            
            v_total_amount := v_total_amount + ((v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric);

        ELSIF p_move_type = 'in_invoice' THEN
            -- Map item's expense_account_id to new accounting_chart_of_accounts by matching code
            SELECT new_acc.id INTO v_account_id
            FROM public.accounting_chart_of_accounts new_acc
            JOIN public.chart_of_accounts old_acc ON old_acc.code = new_acc.code
            WHERE old_acc.id = v_item.expense_account_id AND new_acc.company_id = v_company_id;
            
            -- Fallback: first COGS or Expense account
            IF v_account_id IS NULL THEN
                SELECT id INTO v_account_id
                FROM public.accounting_chart_of_accounts
                WHERE company_id = v_company_id AND type = 'Expense'
                ORDER BY code ASC
                LIMIT 1;
            END IF;
            
            IF v_account_id IS NULL THEN RAISE EXCEPTION 'Item % missing Expense Account in new chart of accounts', v_item.name; END IF;
             
            -- Debit Expense (Expense is debited on bill)
            INSERT INTO public.accounting_journal_lines (
                company_id, entry_id, account_id, partner_id, name,
                debit, credit, cost_center_id, project_cost_center_id, contract_cost_center_id
            ) VALUES (
                v_company_id, v_entry_id, v_account_id, p_partner_id, v_item.name,
                (v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric, 0,
                NULLIF(v_line->>'cost_center_id', '')::uuid, 
                NULLIF(v_line->>'project_cost_center_id', '')::uuid, 
                NULLIF(v_line->>'contract_cost_center_id', '')::uuid
            );
            v_total_amount := v_total_amount + ((v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric);
        END IF;
        
    END LOOP;

    -- 4. Create Balancing AR/AP Line in new accounting_journal_lines
    IF p_move_type = 'out_invoice' THEN
        -- Debit AR
        INSERT INTO public.accounting_journal_lines (
            company_id, entry_id, account_id, partner_id, name,
            debit, credit
        ) VALUES (
            v_company_id, v_entry_id, v_receivable_payable_account_id, p_partner_id, 'Invoice/Bill',
            v_total_amount, 0
        );
    ELSIF p_move_type = 'in_invoice' THEN
         -- Credit AP
         INSERT INTO public.accounting_journal_lines (
            company_id, entry_id, account_id, partner_id, name,
            debit, credit
        ) VALUES (
            v_company_id, v_entry_id, v_receivable_payable_account_id, p_partner_id, 'Invoice/Bill',
            0, v_total_amount
        );
    END IF;

    -- Update Total
    UPDATE public.accounting_journal_entries SET amount_total = v_total_amount WHERE id = v_entry_id;

    RETURN v_entry_id;
END;
$$;
