-- ==============================================================================
-- KAA ERP - Accounting Module Seeding & Company Hook
-- Migration: 20260614_accounting_seeds_rpc.sql
-- ==============================================================================

CREATE OR REPLACE FUNCTION rpc_seed_accounting_masters(v_company_id UUID)
RETURNS VOID AS $$
DECLARE
    v_group_asset UUID;
    v_group_liability UUID;
    v_group_equity UUID;
    v_group_income UUID;
    v_group_expense UUID;
    v_group_cogs UUID;
    
    v_acc_cash UUID;
    v_acc_bank UUID;
    v_acc_ar UUID;
    v_acc_ap UUID;
    v_acc_retained UUID;
    
    v_acc_pur_c1 UUID;
    v_acc_pur_c2 UUID;
    v_acc_pur_c3 UUID;
    
    v_acc_sales_m1 UUID;
    v_acc_sales_m2 UUID;
    v_acc_sales_m3 UUID;
    v_acc_sales_m4 UUID;
    v_acc_sales_m5 UUID;

    v_acc_exp_d1 UUID;
    v_acc_exp_d2 UUID;
    v_acc_exp_d3 UUID;
    v_acc_exp_d4 UUID;
    v_acc_exp_d5 UUID;

    v_acc_inc_i1 UUID;
    v_acc_inc_i2 UUID;
    v_acc_inc_i3 UUID;
    v_acc_inc_i4 UUID;
BEGIN
    RAISE NOTICE 'Seeding Accounting Masters for company_id: %', v_company_id;

    -- ------------------------------------------------------------------------------
    -- 1. Account Groups
    -- ------------------------------------------------------------------------------
    INSERT INTO public.accounting_account_groups (company_id, name, code_prefix_start, code_prefix_end, type) VALUES
    (v_company_id, 'Assets Group', '1000', '1999', 'Asset') ON CONFLICT (company_id, name) DO NOTHING;
    SELECT id INTO v_group_asset FROM public.accounting_account_groups WHERE company_id = v_company_id AND name = 'Assets Group';

    INSERT INTO public.accounting_account_groups (company_id, name, code_prefix_start, code_prefix_end, type) VALUES
    (v_company_id, 'Liabilities Group', '2000', '2999', 'Liability') ON CONFLICT (company_id, name) DO NOTHING;
    SELECT id INTO v_group_liability FROM public.accounting_account_groups WHERE company_id = v_company_id AND name = 'Liabilities Group';

    INSERT INTO public.accounting_account_groups (company_id, name, code_prefix_start, code_prefix_end, type) VALUES
    (v_company_id, 'Equity Group', '3000', '3999', 'Equity') ON CONFLICT (company_id, name) DO NOTHING;
    SELECT id INTO v_group_equity FROM public.accounting_account_groups WHERE company_id = v_company_id AND name = 'Equity Group';

    INSERT INTO public.accounting_account_groups (company_id, name, code_prefix_start, code_prefix_end, type) VALUES
    (v_company_id, 'Income Group', '4000', '4999', 'Income') ON CONFLICT (company_id, name) DO NOTHING;
    SELECT id INTO v_group_income FROM public.accounting_account_groups WHERE company_id = v_company_id AND name = 'Income Group';

    INSERT INTO public.accounting_account_groups (company_id, name, code_prefix_start, code_prefix_end, type) VALUES
    (v_company_id, 'Expenses Group', '5000', '5999', 'Expense') ON CONFLICT (company_id, name) DO NOTHING;
    SELECT id INTO v_group_expense FROM public.accounting_account_groups WHERE company_id = v_company_id AND name = 'Expenses Group';

    -- Cost of Goods Sold subgroup under Expense Group
    INSERT INTO public.accounting_account_groups (company_id, name, code_prefix_start, code_prefix_end, type, parent_id) VALUES
    (v_company_id, 'Cost of Goods Sold (COGS)', '5100', '5199', 'Expense', v_group_expense) ON CONFLICT (company_id, name) DO NOTHING;
    SELECT id INTO v_group_cogs FROM public.accounting_account_groups WHERE company_id = v_company_id AND name = 'Cost of Goods Sold (COGS)';

    -- ------------------------------------------------------------------------------
    -- 2. Chart of Accounts (Default + Workbook Ledger Accounts)
    -- ------------------------------------------------------------------------------
    -- Bank and Cash Accounts
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, account_group_id, is_reconcilable) VALUES
    (v_company_id, '1001', 'Petty Cash', 'Asset', 'Cash', v_group_asset, true),
    (v_company_id, '1002', 'QNB Main Bank Account', 'Asset', 'Bank', v_group_asset, true),
    -- AR & AP
    (v_company_id, '1100', 'Accounts Receivable', 'Asset', 'Receivable', v_group_asset, true),
    (v_company_id, '2001', 'Accounts Payable', 'Liability', 'Payable', v_group_liability, true),
    -- Equity
    (v_company_id, '3001', 'Retained Earnings', 'Equity', 'Other', v_group_equity, false)
    ON CONFLICT (company_id, code) DO NOTHING;

    -- Query created core IDs
    SELECT id INTO v_acc_cash FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '1001';
    SELECT id INTO v_acc_bank FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '1002';
    SELECT id INTO v_acc_ar FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '1100';
    SELECT id INTO v_acc_ap FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '2001';
    SELECT id INTO v_acc_retained FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '3001';

    -- Workbook Purchase Accounts
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, account_group_id, is_reconcilable) VALUES
    (v_company_id, '5010', 'Purchase – 3X Bobipreg & Consumables', 'Expense', 'COGS', v_group_cogs, false),
    (v_company_id, '5011', 'Purchase – 3X Reinforcekit 4D', 'Expense', 'COGS', v_group_cogs, false),
    (v_company_id, '5012', 'Purchase – CH ARC Industrial Coatings', 'Expense', 'COGS', v_group_cogs, false)
    ON CONFLICT (company_id, code) DO NOTHING;
    SELECT id INTO v_acc_pur_c1 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '5010';
    SELECT id INTO v_acc_pur_c2 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '5011';
    SELECT id INTO v_acc_pur_c3 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '5012';

    -- Workbook Sales Accounts
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, account_group_id, is_reconcilable) VALUES
    (v_company_id, '4010', 'Manpower Contracts Income', 'Income', 'Revenue', v_group_income, false),
    (v_company_id, '4011', 'Projects Income', 'Income', 'Revenue', v_group_income, false),
    (v_company_id, '4012', 'Sales Discount / Rebate', 'Income', 'Revenue', v_group_income, false),
    (v_company_id, '4013', 'Trading – 3X Engineering Income', 'Income', 'Revenue', v_group_income, false),
    (v_company_id, '4014', 'Trading – Chesterton Income', 'Income', 'Revenue', v_group_income, false)
    ON CONFLICT (company_id, code) DO NOTHING;
    SELECT id INTO v_acc_sales_m1 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '4010';
    SELECT id INTO v_acc_sales_m2 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '4011';
    SELECT id INTO v_acc_sales_m3 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '4012';
    SELECT id INTO v_acc_sales_m4 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '4013';
    SELECT id INTO v_acc_sales_m5 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '4014';

    -- Workbook Direct Expenses
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, account_group_id, is_reconcilable) VALUES
    (v_company_id, '5210', 'COS – Packaging', 'Expense', 'COGS', v_group_cogs, false),
    (v_company_id, '5211', 'COS – Projects', 'Expense', 'COGS', v_group_cogs, false),
    (v_company_id, '5212', 'Customs Duty & Legalization Charges', 'Expense', 'COGS', v_group_cogs, false),
    (v_company_id, '5213', 'Freight Charges', 'Expense', 'COGS', v_group_cogs, false),
    (v_company_id, '5214', 'Employee Benefit Related Costs', 'Expense', 'Other', v_group_expense, false)
    ON CONFLICT (company_id, code) DO NOTHING;
    SELECT id INTO v_acc_exp_d1 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '5210';
    SELECT id INTO v_acc_exp_d2 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '5211';
    SELECT id INTO v_acc_exp_d3 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '5212';
    SELECT id INTO v_acc_exp_d4 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '5213';
    SELECT id INTO v_acc_exp_d5 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '5214';

    -- Workbook Indirect Incomes
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, account_group_id, is_reconcilable) VALUES
    (v_company_id, '4101', 'Exchange Gain', 'Income', 'Other', v_group_income, false),
    (v_company_id, '4102', 'Interest Income', 'Income', 'Other', v_group_income, false),
    (v_company_id, '4103', 'Other Indirect Income', 'Income', 'Other', v_group_income, false),
    (v_company_id, '4104', 'Rental Income', 'Income', 'Other', v_group_income, false)
    ON CONFLICT (company_id, code) DO NOTHING;
    SELECT id INTO v_acc_inc_i1 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '4101';
    SELECT id INTO v_acc_inc_i2 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '4102';
    SELECT id INTO v_acc_inc_i3 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '4103';
    SELECT id INTO v_acc_inc_i4 FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '4104';

    -- ------------------------------------------------------------------------------
    -- 3. Stock Categories (Linking Item Category name to default Asset/COGS/Adjustment COA accounts)
    -- ------------------------------------------------------------------------------
    -- Ensure Asset Accounts exist for Stock
    INSERT INTO public.accounting_chart_of_accounts (company_id, code, name, type, subtype, account_group_id) VALUES
    (v_company_id, '1210', 'Stock Inventory - Bobipreg', 'Asset', 'Other', v_group_asset),
    (v_company_id, '1211', 'Stock Inventory - Fillers & Primers', 'Asset', 'Other', v_group_asset),
    (v_company_id, '1212', 'Stock Inventory - Reinforcekit 4D', 'Asset', 'Other', v_group_asset),
    (v_company_id, '1213', 'Stock Inventory - Rollerkit', 'Asset', 'Other', v_group_asset)
    ON CONFLICT (company_id, code) DO NOTHING;

    INSERT INTO public.accounting_stock_categories (company_id, name, item_category, asset_account_id, cogs_account_id, adjustment_account_id) VALUES
    (v_company_id, '3X Bobipreg & Consumables', 'Bobipreg', 
     (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '1210' LIMIT 1), v_acc_pur_c1, v_acc_pur_c1),
    (v_company_id, '3X Fillers & Primers', 'Fillers', 
     (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '1211' LIMIT 1), v_acc_pur_c1, v_acc_pur_c1),
    (v_company_id, '3X Reinforcekit 4D', 'Reinforcekit', 
     (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '1212' LIMIT 1), v_acc_pur_c2, v_acc_pur_c2),
    (v_company_id, '3X Rollerkit', 'Rollerkit', 
     (SELECT id FROM public.accounting_chart_of_accounts WHERE company_id = v_company_id AND code = '1213' LIMIT 1), v_acc_pur_c1, v_acc_pur_c1)
    ON CONFLICT (company_id, name) DO NOTHING;

    -- ------------------------------------------------------------------------------
    -- 4. Purchase Ledger Masters
    -- ------------------------------------------------------------------------------
    INSERT INTO public.accounting_purchase_ledgers (company_id, name, account_id) VALUES
    (v_company_id, 'Purchase – 3X Bobipreg & Consumables', v_acc_pur_c1),
    (v_company_id, 'Purchase – 3X Reinforcekit 4D', v_acc_pur_c2),
    (v_company_id, 'Purchase – CH ARC Industrial Coatings', v_acc_pur_c3)
    ON CONFLICT (company_id, name) DO NOTHING;

    -- ------------------------------------------------------------------------------
    -- 5. Sales Ledger Masters
    -- ------------------------------------------------------------------------------
    INSERT INTO public.accounting_sales_ledgers (company_id, name, account_id) VALUES
    (v_company_id, 'Manpower Contracts Income', v_acc_sales_m1),
    (v_company_id, 'Projects Income', v_acc_sales_m2),
    (v_company_id, 'Sales Discount / Rebate', v_acc_sales_m3),
    (v_company_id, 'Trading – 3X Engineering Income', v_acc_sales_m4),
    (v_company_id, 'Trading – Chesterton Income', v_acc_sales_m5)
    ON CONFLICT (company_id, name) DO NOTHING;

    -- ------------------------------------------------------------------------------
    -- 6. Direct Expense Ledger Masters
    -- ------------------------------------------------------------------------------
    INSERT INTO public.accounting_direct_expense_ledgers (company_id, name, account_id) VALUES
    (v_company_id, 'COS – Packaging', v_acc_exp_d1),
    (v_company_id, 'COS – Projects', v_acc_exp_d2),
    (v_company_id, 'Customs Duty & Legalization Charges', v_acc_exp_d3),
    (v_company_id, 'Freight Charges', v_acc_exp_d4),
    (v_company_id, 'Employee Benefit Related Costs', v_acc_exp_d5)
    ON CONFLICT (company_id, name) DO NOTHING;

    -- ------------------------------------------------------------------------------
    -- 7. Indirect Income Ledger Masters
    -- ------------------------------------------------------------------------------
    INSERT INTO public.accounting_indirect_income_ledgers (company_id, name, account_id) VALUES
    (v_company_id, 'Exchange Gain', v_acc_inc_i1),
    (v_company_id, 'Interest Income', v_acc_inc_i2),
    (v_company_id, 'Other Indirect Income', v_acc_inc_i3),
    (v_company_id, 'Rental Income', v_acc_inc_i4)
    ON CONFLICT (company_id, name) DO NOTHING;

    -- ------------------------------------------------------------------------------
    -- 8. Cost Centers (Projects, Contracts, General)
    -- ------------------------------------------------------------------------------
    INSERT INTO public.accounting_cost_centers (company_id, code, name, type) VALUES
    (v_company_id, 'PROJECT-001', 'QP Industrial Project', 'PROJECT'),
    (v_company_id, 'PROJECT-002', 'RasGas Expansion', 'PROJECT'),
    (v_company_id, 'MANPOWER-QP', 'QP Manpower Deputation', 'CONTRACT'),
    (v_company_id, 'MANPOWER-RASGAS', 'RasGas Manpower Deputation', 'CONTRACT'),
    (v_company_id, 'GENERIC-ADMIN', 'General Administration Cost Center', 'GENERIC')
    ON CONFLICT (company_id, code) DO NOTHING;

    -- ------------------------------------------------------------------------------
    -- 9. Journals (Link default accounts)
    -- ------------------------------------------------------------------------------
    INSERT INTO public.accounting_journals (company_id, name, code, type, default_account_id, sequence_prefix) VALUES
    (v_company_id, 'Customer Invoices', 'INV', 'Sale', v_acc_ar, 'INV/2026/'),
    (v_company_id, 'Vendor Bills', 'BILL', 'Purchase', v_acc_ap, 'BILL/2026/'),
    (v_company_id, 'Bank Journal', 'BNK1', 'Bank', v_acc_bank, 'BNK1/2026/'),
    (v_company_id, 'Cash Journal', 'CSH', 'Cash', v_acc_cash, 'CSH/2026/'),
    (v_company_id, 'General Operations', 'GEN', 'General', v_acc_retained, 'GEN/2026/')
    ON CONFLICT (company_id, code) DO NOTHING;

    -- ------------------------------------------------------------------------------
    -- 10. Payment Terms
    -- ------------------------------------------------------------------------------
    INSERT INTO public.accounting_payment_terms (company_id, name, days) VALUES
    (v_company_id, 'Immediate Payment', 0),
    (v_company_id, '15 Days', 15),
    (v_company_id, '30 Days Net', 30),
    (v_company_id, '45 Days Net', 45),
    (v_company_id, '60 Days Net', 60)
    ON CONFLICT (company_id, name) DO NOTHING;

    -- ------------------------------------------------------------------------------
    -- 11. Taxes
    -- ------------------------------------------------------------------------------
    INSERT INTO public.accounting_taxes (company_id, name, type, scope, amount, account_id) VALUES
    (v_company_id, 'Zero VAT', 'Percent', 'Sales', 0.00, v_acc_retained),
    (v_company_id, 'Standard VAT 5%', 'Percent', 'Sales', 5.00, v_acc_retained),
    (v_company_id, 'Purchase VAT 5%', 'Percent', 'Purchase', 5.00, v_acc_retained)
    ON CONFLICT (company_id, name) DO NOTHING;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- Hook into existing rpc_seed_company_data
-- ==============================================================================

CREATE OR REPLACE FUNCTION rpc_seed_company_data_wrapper(v_company_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Call the original seeding function
    PERFORM rpc_seed_company_data(v_company_id);
    
    -- Call the new isolated accounting seeding function
    PERFORM rpc_seed_accounting_masters(v_company_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replace rpc_seed_company_data with our wrapper implementation
CREATE OR REPLACE FUNCTION rpc_seed_company_data(v_company_id UUID)
RETURNS VOID AS $$
BEGIN
    RAISE NOTICE 'Triggering original seed + accounting seed...';
    -- Seeding attributes
    INSERT INTO org_faiths (code, name, company_id) VALUES
    ('HINDU', 'Hinduism', v_company_id), ('MUSLIM', 'Islam', v_company_id),
    ('CHRISTIAN', 'Christianity', v_company_id), ('SIKH', 'Sikhism', v_company_id),
    ('BUDDHIST', 'Buddhism', v_company_id), ('JAIN', 'Jainism', v_company_id),
    ('OTHER', 'Other', v_company_id), ('PREFER_NOT_TO_SAY', 'Prefer not to say', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_marital_status (code, name, company_id) VALUES
    ('SINGLE', 'Single', v_company_id), ('MARRIED', 'Married', v_company_id),
    ('DIVORCED', 'Divorced', v_company_id), ('WIDOWED', 'Widowed', v_company_id),
    ('SEPARATED', 'Separated', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_blood_groups (code, name, company_id) VALUES
    ('A_POSITIVE', 'A+', v_company_id), ('A_NEGATIVE', 'A-', v_company_id),
    ('B_POSITIVE', 'B+', v_company_id), ('B_NEGATIVE', 'B-', v_company_id),
    ('O_POSITIVE', 'O+', v_company_id), ('O_NEGATIVE', 'O-', v_company_id),
    ('AB_POSITIVE', 'AB+', v_company_id), ('AB_NEGATIVE', 'AB-', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_nationalities (code, name, company_id) VALUES
    ('IN', 'Indian', v_company_id), ('US', 'American', v_company_id),
    ('GB', 'British', v_company_id), ('CA', 'Canadian', v_company_id),
    ('AU', 'Australian', v_company_id), ('UAE', 'Emirati', v_company_id),
    ('SG', 'Singaporean', v_company_id), ('OTHER', 'Other', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;

    INSERT INTO org_designations (code, name, description, company_id) VALUES
    ('TL', 'Team Lead', 'Team leadership position', v_company_id),
    ('MGR', 'Manager', 'Department manager', v_company_id),
    ('SMGR', 'Senior Manager', 'Senior management role', v_company_id),
    ('DIR', 'Director', 'Directorial position', v_company_id),
    ('VP', 'Vice President', 'VP level position', v_company_id),
    ('SWE', 'Software Engineer', 'Software development role', v_company_id),
    ('SSWE', 'Senior Software Engineer', 'Senior software development role', v_company_id),
    ('ANALYST', 'Business Analyst', 'Business analysis role', v_company_id),
    ('HR', 'HR Executive', 'Human resources role', v_company_id),
    ('SALES', 'Sales Executive', 'Sales position', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_grades (code, name, description, company_id) VALUES
    ('G1', 'Grade 1', 'Entry level', v_company_id),
    ('G2', 'Grade 2', 'Junior level', v_company_id),
    ('G3', 'Grade 3', 'Mid level', v_company_id),
    ('G4', 'Grade 4', 'Senior level', v_company_id),
    ('G5', 'Grade 5', 'Principal level', v_company_id),
    ('G6', 'Grade 6', 'Director level', v_company_id),
    ('G7', 'Grade 7', 'Executive level', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_employment_types (code, name, description, company_id) VALUES
    ('FT', 'Full-time', 'Full-time permanent employee', v_company_id),
    ('PT', 'Part-time', 'Part-time employee', v_company_id),
    ('CONTRACT', 'Contract', 'Contract-based employment', v_company_id),
    ('INTERN', 'Intern', 'Internship position', v_company_id),
    ('CONSULTANT', 'Consultant', 'External consultant', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_probation_periods (code, name, duration_months, company_id) VALUES
    ('PROB_3', '3 Months', 3, v_company_id),
    ('PROB_6', '6 Months', 6, v_company_id),
    ('PROB_12', '12 Months', 12, v_company_id),
    ('NO_PROB', 'No Probation', 0, v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_confirmation_status (code, name, company_id) VALUES
    ('PROBATION', 'On Probation', v_company_id),
    ('CONFIRMED', 'Confirmed', v_company_id),
    ('PENDING_CONF', 'Pending Confirmation', v_company_id),
    ('EXTENDED_PROB', 'Extended Probation', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_exit_reasons (code, name, company_id) VALUES
    ('RESIGNATION', 'Resignation', v_company_id),
    ('TERMINATION', 'Termination', v_company_id),
    ('RETIREMENT', 'Retirement', v_company_id),
    ('END_OF_CONTRACT', 'End of Contract', v_company_id),
    ('MUTUAL_SEPARATION', 'Mutual Separation', v_company_id),
    ('HEALTH_REASONS', 'Health Reasons', v_company_id),
    ('RELOCATION', 'Relocation', v_company_id),
    ('HIGHER_STUDIES', 'Higher Studies', v_company_id),
    ('BETTER_OPPORTUNITY', 'Better Opportunity', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_salary_components (code, name, component_type, is_taxable, company_id) VALUES
    ('BASIC', 'Basic Salary', 'EARNING', true, v_company_id),
    ('HRA', 'House Rent Allowance', 'EARNING', true, v_company_id),
    ('DA', 'Dearness Allowance', 'EARNING', true, v_company_id),
    ('TA', 'Transport Allowance', 'EARNING', false, v_company_id),
    ('MEDICAL', 'Medical Allowance', 'EARNING', false, v_company_id),
    ('SPECIAL', 'Special Allowance', 'EARNING', true, v_company_id),
    ('BONUS', 'Performance Bonus', 'EARNING', true, v_company_id),
    ('PF', 'Provident Fund', 'DEDUCTION', false, v_company_id),
    ('ESI', 'Employee State Insurance', 'DEDUCTION', false, v_company_id),
    ('PT', 'Professional Tax', 'DEDUCTION', false, v_company_id),
    ('TDS', 'Tax Deducted at Source', 'DEDUCTION', false, v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_pay_groups (code, name, pay_frequency, company_id) VALUES
    ('MONTHLY', 'Monthly Payroll', 'MONTHLY', v_company_id),
    ('WEEKLY', 'Weekly Payroll', 'WEEKLY', v_company_id),
    ('BI_WEEKLY', 'Bi-weekly Payroll', 'BI_WEEKLY', v_company_id),
    ('CONTRACT', 'Contract Payroll', 'MONTHLY', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_bank_configs (code, name, bank_name, company_id) VALUES
    ('HDFC', 'HDFC Bank', 'HDFC Bank', v_company_id),
    ('ICICI', 'ICICI Bank', 'ICICI Bank', v_company_id),
    ('SBI', 'State Bank of India', 'State Bank of India', v_company_id),
    ('AXIS', 'Axis Bank', 'Axis Bank', v_company_id),
    ('KOTAK', 'Kotak Mahindra Bank', 'Kotak Mahindra Bank', v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_leave_types (code, name, default_balance, is_paid, requires_approval, company_id) VALUES
    ('CL', 'Casual Leave', 12, true, true, v_company_id),
    ('SL', 'Sick Leave', 10, true, false, v_company_id),
    ('PL', 'Privilege Leave', 15, true, true, v_company_id),
    ('EL', 'Earned Leave', 15, true, true, v_company_id),
    ('ML', 'Maternity Leave', 180, true, true, v_company_id),
    ('PL_PATERNITY', 'Paternity Leave', 15, true, true, v_company_id),
    ('COMP_OFF', 'Compensatory Off', 0, true, true, v_company_id),
    ('LWP', 'Leave Without Pay', 0, false, true, v_company_id),
    ('BEREAVEMENT', 'Bereavement Leave', 5, true, false, v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_leave_policies (code, name, leave_type_id, max_consecutive_days, can_carry_forward, company_id) 
    SELECT 'CL_POLICY', 'Casual Leave Policy', id, 3, false, v_company_id 
    FROM org_leave_types WHERE code = 'CL' AND company_id = v_company_id LIMIT 1
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_leave_policies (code, name, leave_type_id, max_consecutive_days, can_carry_forward, company_id) 
    SELECT 'PL_POLICY', 'Privilege Leave Policy', id, 15, true, v_company_id 
    FROM org_leave_types WHERE code = 'PL' AND company_id = v_company_id LIMIT 1
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_holiday_calendar (name, holiday_date, is_mandatory, company_id) VALUES
    ('Republic Day', '2026-01-26', true, v_company_id), ('Holi', '2026-03-14', true, v_company_id),
    ('Good Friday', '2026-04-03', false, v_company_id), ('Independence Day', '2026-08-15', true, v_company_id),
    ('Gandhi Jayanti', '2026-10-02', true, v_company_id), ('Diwali', '2026-10-20', true, v_company_id),
    ('Christmas', '2026-12-25', true, v_company_id)
    ON CONFLICT (company_id, holiday_date) DO NOTHING;
    
    INSERT INTO org_shift_timings (code, name, start_time, end_time, grace_period_minutes, company_id) VALUES
    ('GENERAL', 'General Shift (9 AM - 6 PM)', '09:00:00', '18:00:00', 15, v_company_id),
    ('MORNING', 'Morning Shift (7 AM - 4 PM)', '07:00:00', '16:00:00', 10, v_company_id),
    ('EVENING', 'Evening Shift (2 PM - 11 PM)', '14:00:00', '23:00:00', 10, v_company_id),
    ('NIGHT', 'Night Shift (10 PM - 7 AM)', '22:00:00', '07:00:00', 15, v_company_id),
    ('FLEXIBLE', 'Flexible Shift', '00:00:00', '23:59:59', 0, v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_weekoff_rules (code, name, weekdays, company_id) VALUES
    ('SAT_SUN', 'Saturday & Sunday', ARRAY['SATURDAY', 'SUNDAY'], v_company_id),
    ('SUN_ONLY', 'Sunday Only', ARRAY['SUNDAY'], v_company_id),
    ('FRI_SAT', 'Friday & Saturday', ARRAY['FRIDAY', 'SATURDAY'], v_company_id),
    ('ALT_SAT', 'Alternate Saturdays', ARRAY['SUNDAY'], v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_attendance_status (code, name, affects_salary, company_id) VALUES
    ('PRESENT', 'Present', false, v_company_id), ('ABSENT', 'Absent', true, v_company_id),
    ('HALF_DAY', 'Half Day', true, v_company_id), ('ON_LEAVE', 'On Leave', false, v_company_id),
    ('WEEK_OFF', 'Week Off', false, v_company_id), ('HOLIDAY', 'Holiday', false, v_company_id),
    ('WORK_FROM_HOME', 'Work From Home', false, v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;
    
    INSERT INTO org_punch_rules (code, name, min_work_hours, overtime_threshold_hours, company_id) VALUES
    ('STANDARD', 'Standard 8-hour rule', 8.0, 9.0, v_company_id),
    ('RELAXED', 'Relaxed 7-hour rule', 7.0, 10.0, v_company_id),
    ('STRICT', 'Strict 9-hour rule', 9.0, 10.0, v_company_id)
    ON CONFLICT (company_id, code) DO NOTHING;

    -- Call accounting seed function!
    PERFORM rpc_seed_accounting_masters(v_company_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
