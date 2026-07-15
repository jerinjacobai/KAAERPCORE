-- Migration: 20260716000000_laundry_standalone_architecture.sql
-- Description: Transition the Laundry module into a standalone architecture with local customer and client-employee registries, and paper receipt grids.

-- 1. Create Standalone Laundry Customers Table
CREATE TABLE IF NOT EXISTS public.laundry_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    mobile TEXT,
    email TEXT,
    type TEXT DEFAULT 'Individual' CHECK (type IN ('Individual', 'Corporate', 'Hotels', 'Hospitals', 'Factories', 'Restaurants', 'Uniform Contracts')),
    status TEXT DEFAULT 'Active',
    UNIQUE(company_id, name)
);

ALTER TABLE public.laundry_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_customers;
CREATE POLICY "Tenant Isolation" ON public.laundry_customers FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- 2. Create Corporate Client Employees Table (e.g. Thennarasu, No. 24535 linked to QDS)
CREATE TABLE IF NOT EXISTS public.laundry_client_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    client_customer_id UUID NOT NULL REFERENCES public.laundry_customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    employee_no TEXT NOT NULL,
    mobile TEXT,
    room_no TEXT,
    building_no TEXT,
    status TEXT DEFAULT 'Active',
    UNIQUE(company_id, client_customer_id, employee_no)
);

ALTER TABLE public.laundry_client_employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_client_employees;
CREATE POLICY "Tenant Isolation" ON public.laundry_client_employees FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- 3. Alter laundry_orders to support standalone properties and link to local laundry_customers
-- First drop the global crm_customers reference if it exists
ALTER TABLE public.laundry_orders DROP CONSTRAINT IF EXISTS laundry_orders_customer_id_fkey;

-- Make customer_id reference laundry_customers(id) instead of crm_customers
ALTER TABLE public.laundry_orders ADD CONSTRAINT laundry_orders_customer_id_local_fkey 
FOREIGN KEY (customer_id) REFERENCES public.laundry_customers(id) ON DELETE RESTRICT;

-- Add paper receipt data columns to laundry_orders
ALTER TABLE public.laundry_orders 
ADD COLUMN IF NOT EXISTS receipt_no TEXT,
ADD COLUMN IF NOT EXISTS client_employee_name TEXT,
ADD COLUMN IF NOT EXISTS client_employee_no TEXT,
ADD COLUMN IF NOT EXISTS room_no TEXT,
ADD COLUMN IF NOT EXISTS building_no TEXT,
ADD COLUMN IF NOT EXISTS client_mobile TEXT;

-- 4. Alter laundry_order_items to add paper receipt columns
ALTER TABLE public.laundry_order_items 
ADD COLUMN IF NOT EXISTS qty_issued INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS qty_recv INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS qty_ret INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS qty_ack INTEGER DEFAULT 0;

-- 5. Add branch_id to laundry_pricing to allow branch-specific rules
ALTER TABLE public.laundry_pricing 
ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES public.locations(id) ON DELETE SET NULL;
