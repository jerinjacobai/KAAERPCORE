-- 1. Create a trigger to automatically assign period_id on insert or date update of journal entries
CREATE OR REPLACE FUNCTION public.trigger_set_accounting_entry_period()
RETURNS TRIGGER
AS $$
DECLARE
    v_period_id UUID;
BEGIN
    SELECT id INTO v_period_id
    FROM public.accounting_periods
    WHERE company_id = NEW.company_id
      AND NEW.date BETWEEN start_date AND end_date
    LIMIT 1;
    
    NEW.period_id := v_period_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER set_accounting_entry_period_trigger
BEFORE INSERT OR UPDATE OF date ON public.accounting_journal_entries
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_accounting_entry_period();

-- 2. Update existing entries that have null period_id
UPDATE public.accounting_journal_entries e
SET period_id = (
    SELECT id
    FROM public.accounting_periods p
    WHERE p.company_id = e.company_id
      AND e.date BETWEEN p.start_date AND p.end_date
    LIMIT 1
)
WHERE e.period_id IS NULL;

-- 3. Update rpc_post_accounting_entry function to validate period status
CREATE OR REPLACE FUNCTION public.rpc_post_accounting_entry(p_entry_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_entry RECORD;
    v_total_debit NUMERIC;
    v_total_credit NUMERIC;
    v_period_id UUID;
    v_period_status TEXT;
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

    -- Lookup period
    SELECT id, status INTO v_period_id, v_period_status
    FROM public.accounting_periods
    WHERE company_id = v_entry.company_id
      AND v_entry.date BETWEEN start_date AND end_date
    LIMIT 1;

    IF v_period_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No accounting period defined for this date (' || v_entry.date::TEXT || ')');
    END IF;

    IF v_period_status = 'locked' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cannot post to a locked accounting period');
    END IF;

    -- Update Entry
    UPDATE accounting_journal_entries
    SET 
        state = 'Posted',
        period_id = v_period_id,
        amount_total = v_total_debit,
        amount_residual = v_total_debit
    WHERE id = p_entry_id;

    RETURN jsonb_build_object('success', true, 'message', 'Journal Entry Posted Successfully');
END;
$$;

-- 4. Update rpc_post_accounting_payment function to populate period_id and validate
CREATE OR REPLACE FUNCTION public.rpc_post_accounting_payment(
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
    v_period_id UUID;
    v_period_status TEXT;
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

    -- Find and validate period
    SELECT id, status INTO v_period_id, v_period_status
    FROM public.accounting_periods
    WHERE company_id = v_company_id
      AND v_payment.date BETWEEN start_date AND end_date
    LIMIT 1;

    IF v_period_id IS NULL THEN
        RAISE EXCEPTION 'No open accounting period defined for date %', v_payment.date;
    END IF;

    IF v_period_status = 'locked' THEN
        RAISE EXCEPTION 'Cannot post to a locked accounting period';
    END IF;

    -- 4. Create Journal Entry Header (with period_id)
    INSERT INTO public.accounting_journal_entries (
        company_id, journal_id, date, partner_id, move_type, state, amount_total, reference, notes, period_id
    ) VALUES (
        v_company_id, v_journal.id, v_payment.date, v_payment.partner_id, 'entry', 'Posted', v_payment.amount, v_payment.name, v_payment.notes, v_period_id
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
