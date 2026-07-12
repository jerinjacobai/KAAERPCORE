-- supabase/migrations/20260712000100_laundry_phase2.sql
-- Phase 2 Extension: Corporate Contracts, Customer Wallets, Machine Maintenance, and Driver Shifts

-- ==============================================================================
-- 1. DATABASE TABLES PROVISION
-- ==============================================================================

-- Customer Wallet Registry
CREATE TABLE IF NOT EXISTS public.laundry_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
    balance NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    loyalty_points INTEGER DEFAULT 0 NOT NULL,
    UNIQUE(company_id, customer_id)
);

ALTER TABLE public.laundry_wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_wallets;
CREATE POLICY "Tenant Isolation" ON public.laundry_wallets FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Wallet Transactions Log
CREATE TABLE IF NOT EXISTS public.laundry_wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.laundry_wallets(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('Deposit', 'Deduction', 'Refund', 'LoyaltyCredit')),
    description TEXT
);

ALTER TABLE public.laundry_wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_wallet_transactions;
CREATE POLICY "Tenant Isolation" ON public.laundry_wallet_transactions FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Corporate Contracts Manager
CREATE TABLE IF NOT EXISTS public.laundry_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
    contract_number TEXT NOT NULL,
    sla_days INTEGER DEFAULT 2 NOT NULL,
    discount_percentage NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
    monthly_limit NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Terminated')),
    UNIQUE(company_id, contract_number)
);

ALTER TABLE public.laundry_contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_contracts;
CREATE POLICY "Tenant Isolation" ON public.laundry_contracts FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Machinery Servicing Logs
CREATE TABLE IF NOT EXISTS public.laundry_maintenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    machine_id UUID NOT NULL REFERENCES public.laundry_machines(id) ON DELETE CASCADE,
    technician_name TEXT,
    type TEXT NOT NULL CHECK (type IN ('Preventive', 'AMC', 'Corrective', 'Breakdown')),
    cost NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    description TEXT,
    performed_at DATE DEFAULT CURRENT_DATE NOT NULL
);

ALTER TABLE public.laundry_maintenance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_maintenance;
CREATE POLICY "Tenant Isolation" ON public.laundry_maintenance FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Driver Weekly Shifts Roster
CREATE TABLE IF NOT EXISTS public.laundry_driver_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    shift_type TEXT NOT NULL CHECK (shift_type IN ('Morning', 'Afternoon', 'Night')),
    status TEXT DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'On Duty', 'Completed', 'Absent')),
    UNIQUE(company_id, driver_id, shift_date)
);

ALTER TABLE public.laundry_driver_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_driver_shifts;
CREATE POLICY "Tenant Isolation" ON public.laundry_driver_shifts FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());


-- ==============================================================================
-- 2. SAMPLE SEED DATA
-- ==============================================================================

-- Seed a few wallet balances and sample corporate contracts if customers exist
DO $$
DECLARE
    v_company_id UUID;
    v_cust_id UUID;
    v_driver_id UUID;
    v_mach_id UUID;
BEGIN
    SELECT id INTO v_company_id FROM public.companies LIMIT 1;
    IF v_company_id IS NOT NULL THEN
        -- Find a sample customer
        SELECT id INTO v_cust_id FROM public.crm_customers WHERE company_id = v_company_id LIMIT 1;
        -- Find a driver/employee
        SELECT id INTO v_driver_id FROM public.employees WHERE company_id = v_company_id LIMIT 1;
        -- Find a machine
        SELECT id INTO v_mach_id FROM public.laundry_machines WHERE company_id = v_company_id LIMIT 1;
        
        -- Seed Wallet
        IF v_cust_id IS NOT NULL THEN
            INSERT INTO public.laundry_wallets (company_id, customer_id, balance, loyalty_points)
            VALUES (v_company_id, v_cust_id, 350.00, 120)
            ON CONFLICT DO NOTHING;
            
            -- Seed Corporate Contract
            INSERT INTO public.laundry_contracts (company_id, customer_id, contract_number, sla_days, discount_percentage, monthly_limit, start_date, end_date, status)
            VALUES (v_company_id, v_cust_id, 'CON-LAUND-2026-01', 1, 15.00, 5000.00, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', 'Active')
            ON CONFLICT DO NOTHING;
        END IF;

        -- Seed Shift
        IF v_driver_id IS NOT NULL THEN
            INSERT INTO public.laundry_driver_shifts (company_id, driver_id, shift_date, shift_type, status)
            VALUES (v_company_id, v_driver_id, CURRENT_DATE, 'Morning', 'Scheduled')
            ON CONFLICT DO NOTHING;
        END IF;

        -- Seed Maintenance Entry
        IF v_mach_id IS NOT NULL THEN
            INSERT INTO public.laundry_maintenance (company_id, machine_id, technician_name, type, cost, description, performed_at)
            VALUES (v_company_id, v_mach_id, 'John Doe Tech', 'Preventive', 150.00, 'Monthly washer seal lubrication and belt tensioning check', CURRENT_DATE)
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
END;
$$;
