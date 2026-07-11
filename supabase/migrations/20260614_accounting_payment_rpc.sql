-- ==============================================================================
-- KAA ERP - Accounting Module Enhancement (Payment Posting Logic for Isolated Schema)
-- Migration: 20260614_accounting_payment_rpc.sql
-- ==============================================================================

CREATE OR REPLACE FUNCTION rpc_post_accounting_payment(
    p_payment_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment RECORD;
    v_entry_id UUID;
    v_partner RECORD;
    v_journal RECORD;
    v_liquidity_account_id UUID; -- Bank/Cash Account
    v_counterpart_account_id UUID; -- AR/AP Account
    v_company_id UUID;
BEGIN
    v_company_id := get_my_company_id();
    
    -- 1. Fetch Payment
    SELECT * INTO v_payment FROM accounting_payments WHERE id = p_payment_id;
    IF v_payment.state = 'posted' THEN RAISE EXCEPTION 'Payment already posted'; END IF;

    -- 2. Fetch Partner & new Journal
    SELECT * INTO v_partner FROM accounting_partners WHERE id = v_payment.partner_id;
    SELECT * INTO v_journal FROM accounting_journals WHERE id = COALESCE(v_payment.accounting_journal_id, v_payment.journal_id);
    
    IF v_journal.id IS NULL THEN
        -- Fallback: try to find the new journal by code
        SELECT new_j.* INTO v_journal 
        FROM public.accounting_journals new_j
        JOIN public.journals old_j ON old_j.code = new_j.code
        WHERE old_j.id = v_payment.journal_id AND new_j.company_id = v_company_id;
    END IF;
    
    v_liquidity_account_id := v_journal.default_account_id;
    IF v_liquidity_account_id IS NULL THEN RAISE EXCEPTION 'Journal % has no default account in the new chart of accounts', v_journal.name; END IF;

    -- 3. Determine Counterpart Account (AR/AP in the new chart of accounts)
    IF v_payment.payment_type = 'inbound' THEN
        SELECT new_acc.id INTO v_counterpart_account_id
        FROM public.accounting_chart_of_accounts new_acc
        JOIN public.chart_of_accounts old_acc ON old_acc.code = new_acc.code
        WHERE old_acc.id = v_partner.property_account_receivable_id AND new_acc.company_id = v_company_id;
        
        -- Fallback
        IF v_counterpart_account_id IS NULL THEN
            SELECT id INTO v_counterpart_account_id
            FROM public.accounting_chart_of_accounts
            WHERE company_id = v_company_id AND subtype = 'Receivable'
            LIMIT 1;
        END IF;
    ELSE
        SELECT new_acc.id INTO v_counterpart_account_id
        FROM public.accounting_chart_of_accounts new_acc
        JOIN public.chart_of_accounts old_acc ON old_acc.code = new_acc.code
        WHERE old_acc.id = v_partner.property_account_payable_id AND new_acc.company_id = v_company_id;
        
        -- Fallback
        IF v_counterpart_account_id IS NULL THEN
            SELECT id INTO v_counterpart_account_id
            FROM public.accounting_chart_of_accounts
            WHERE company_id = v_company_id AND subtype = 'Payable'
            LIMIT 1;
        END IF;
    END IF;
    
    IF v_counterpart_account_id IS NULL THEN RAISE EXCEPTION 'Partner % missing AR/AP account in the new chart of accounts', v_partner.name; END IF;

    -- 4. Create Journal Entry Header
    INSERT INTO public.accounting_journal_entries (
        company_id, journal_id, date, partner_id, move_type, state, amount_total, reference, notes
    ) VALUES (
        v_company_id, v_journal.id, v_payment.date, v_payment.partner_id, 'entry', 'Posted', v_payment.amount, v_payment.name, v_payment.notes
    ) RETURNING id INTO v_entry_id;

    -- 5. Create Lines
    IF v_payment.payment_type = 'inbound' THEN
        -- Customer Pays Us:
        -- Dr Bank (Liquidity)
        INSERT INTO public.accounting_journal_lines (company_id, entry_id, account_id, partner_id, name, debit, credit)
        VALUES (v_company_id, v_entry_id, v_liquidity_account_id, v_payment.partner_id, 'Payment Received', v_payment.amount, 0);
        
        -- Cr AR (Counterpart)
        INSERT INTO public.accounting_journal_lines (company_id, entry_id, account_id, partner_id, name, debit, credit)
        VALUES (v_company_id, v_entry_id, v_counterpart_account_id, v_payment.partner_id, 'Payment Received', 0, v_payment.amount);
        
    ELSE
        -- We Pay Vendor:
        -- Dr AP (Counterpart)
        INSERT INTO public.accounting_journal_lines (company_id, entry_id, account_id, partner_id, name, debit, credit)
        VALUES (v_company_id, v_entry_id, v_counterpart_account_id, v_payment.partner_id, 'Payment Sent', v_payment.amount, 0);

        -- Cr Bank (Liquidity)
        INSERT INTO public.accounting_journal_lines (company_id, entry_id, account_id, partner_id, name, debit, credit)
        VALUES (v_company_id, v_entry_id, v_liquidity_account_id, v_payment.partner_id, 'Payment Sent', 0, v_payment.amount);
    END IF;

    -- 6. Update Payment Record
    UPDATE public.accounting_payments 
    SET state = 'posted', 
        accounting_journal_id = v_journal.id,
        accounting_entry_id = v_entry_id 
    WHERE id = p_payment_id;

    RETURN v_entry_id;
END;
$$;
