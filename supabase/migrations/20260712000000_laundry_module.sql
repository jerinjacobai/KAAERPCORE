-- ==============================================================================
-- KAA ERP - Laundry Management Module Schema Setup
-- Migration: 20260712000000_laundry_module.sql
-- ==============================================================================

-- 1. MASTERS

-- Laundry Services Master
CREATE TABLE IF NOT EXISTS public.laundry_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'Standard', -- 'Standard', 'Premium', 'Specialty'
    status TEXT DEFAULT 'Active',
    UNIQUE(company_id, code)
);

ALTER TABLE public.laundry_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_services;
CREATE POLICY "Tenant Isolation" ON public.laundry_services FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Laundry Items Master (Garments)
CREATE TABLE IF NOT EXISTS public.laundry_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    category TEXT DEFAULT 'Apparel', -- 'Apparel', 'Linen', 'Uniform', 'Curtain', 'Other'
    status TEXT DEFAULT 'Active',
    UNIQUE(company_id, code)
);

ALTER TABLE public.laundry_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_items;
CREATE POLICY "Tenant Isolation" ON public.laundry_items FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Laundry Pricing Master Grid
CREATE TABLE IF NOT EXISTS public.laundry_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.laundry_items(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.laundry_services(id) ON DELETE CASCADE,
    unit_price NUMERIC NOT NULL DEFAULT 0.00,
    express_price NUMERIC NOT NULL DEFAULT 0.00,
    status TEXT DEFAULT 'Active',
    UNIQUE(company_id, item_id, service_id)
);

ALTER TABLE public.laundry_pricing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_pricing;
CREATE POLICY "Tenant Isolation" ON public.laundry_pricing FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Laundry Extended Customer Profiles (Avoids modifying crm_customers directly)
CREATE TABLE IF NOT EXISTS public.laundry_customer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
    laundry_customer_type TEXT DEFAULT 'Individual' CHECK (laundry_customer_type IN ('Individual', 'Corporate', 'Hotels', 'Hospitals', 'Factories', 'Restaurants', 'Uniform Contracts')),
    special_instructions TEXT,
    discount_percentage NUMERIC DEFAULT 0.00,
    is_contract_billing BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'Active',
    UNIQUE(company_id, customer_id)
);

ALTER TABLE public.laundry_customer_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_customer_profiles;
CREATE POLICY "Tenant Isolation" ON public.laundry_customer_profiles FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Laundry Machines Master
CREATE TABLE IF NOT EXISTS public.laundry_machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    type TEXT DEFAULT 'Washer' CHECK (type IN ('Washer', 'Dryer', 'Steam Press', 'Boiler', 'Folder', 'Packaging')),
    capacity TEXT, -- e.g. "15kg", "25kg"
    utilization NUMERIC DEFAULT 0.00,
    status TEXT DEFAULT 'Idle', -- 'Idle', 'Running', 'Maintenance', 'Breakdown'
    UNIQUE(company_id, code)
);

ALTER TABLE public.laundry_machines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_machines;
CREATE POLICY "Tenant Isolation" ON public.laundry_machines FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());


-- 2. TRANSACTIONS

-- Laundry Orders Header
CREATE TABLE IF NOT EXISTS public.laundry_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id BIGINT REFERENCES public.locations(id) ON DELETE SET NULL, -- Links to locations branch
    customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE RESTRICT,
    order_number TEXT NOT NULL,
    channel TEXT DEFAULT 'Walk-in', -- 'Walk-in', 'Corporate', 'Hotel', 'Hospital', 'Online', 'WhatsApp', 'Phone'
    status TEXT DEFAULT 'Order' CHECK (status IN ('Order', 'Pickup', 'Branch Receive', 'Sorting', 'Tagging', 'Production Batch', 'Washing', 'Drying', 'Ironing', 'Quality', 'Packing', 'Storage', 'Delivery Assignment', 'Delivery', 'Invoice', 'Completed', 'Cancelled')),
    priority TEXT DEFAULT 'Standard' CHECK (priority IN ('Standard', 'Express', 'Urgent')),
    due_date DATE,
    discount_amount NUMERIC DEFAULT 0.00,
    tax_amount NUMERIC DEFAULT 0.00,
    total_amount NUMERIC DEFAULT 0.00,
    payment_status TEXT DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid', 'Partially Paid', 'Paid')),
    accounting_invoice_id UUID, -- References public.accounting_journal_entries(id) once billed
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    UNIQUE(company_id, order_number)
);

ALTER TABLE public.laundry_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_orders;
CREATE POLICY "Tenant Isolation" ON public.laundry_orders FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Laundry Order Items List
CREATE TABLE IF NOT EXISTS public.laundry_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.laundry_orders(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.laundry_items(id) ON DELETE RESTRICT,
    service_id UUID NOT NULL REFERENCES public.laundry_services(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0.00,
    total_price NUMERIC NOT NULL DEFAULT 0.00,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Processing', 'QC Passed', 'QC Failed', 'Rewash', 'Completed')),
    barcode TEXT, -- Tag barcode
    notes TEXT
);

ALTER TABLE public.laundry_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_order_items;
CREATE POLICY "Tenant Isolation" ON public.laundry_order_items FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Laundry Pickups Logistics Log
CREATE TABLE IF NOT EXISTS public.laundry_pickups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.laundry_orders(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    vehicle_details TEXT,
    status TEXT DEFAULT 'Assigned' CHECK (status IN ('Assigned', 'Transit', 'Completed', 'Failed')),
    pickup_date DATE,
    route_details TEXT,
    notes TEXT
);

ALTER TABLE public.laundry_pickups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_pickups;
CREATE POLICY "Tenant Isolation" ON public.laundry_pickups FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Laundry Deliveries Logistics Log
CREATE TABLE IF NOT EXISTS public.laundry_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.laundry_orders(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    vehicle_details TEXT,
    status TEXT DEFAULT 'Assigned' CHECK (status IN ('Assigned', 'Transit', 'Completed', 'Failed')),
    delivery_date DATE,
    route_details TEXT,
    notes TEXT
);

ALTER TABLE public.laundry_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_deliveries;
CREATE POLICY "Tenant Isolation" ON public.laundry_deliveries FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Laundry Production Batches Group
CREATE TABLE IF NOT EXISTS public.laundry_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    batch_number TEXT NOT NULL,
    stage TEXT DEFAULT 'Washing' CHECK (stage IN ('Sorting', 'Tagging', 'Washing', 'Drying', 'Ironing', 'QC', 'Packing')),
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'In Progress', 'Completed', 'Cancelled')),
    machine_id UUID REFERENCES public.laundry_machines(id) ON DELETE SET NULL,
    operator_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(company_id, batch_number)
);

ALTER TABLE public.laundry_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_batches;
CREATE POLICY "Tenant Isolation" ON public.laundry_batches FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Laundry Production Batch Items mapping
CREATE TABLE IF NOT EXISTS public.laundry_batch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES public.laundry_batches(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES public.laundry_order_items(id) ON DELETE CASCADE,
    UNIQUE(company_id, batch_id, order_item_id)
);

ALTER TABLE public.laundry_batch_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_batch_items;
CREATE POLICY "Tenant Isolation" ON public.laundry_batch_items FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Laundry Machine Log Events
CREATE TABLE IF NOT EXISTS public.laundry_machine_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    machine_id UUID NOT NULL REFERENCES public.laundry_machines(id) ON DELETE CASCADE,
    run_hours NUMERIC DEFAULT 0.00,
    event_type TEXT DEFAULT 'Run' CHECK (event_type IN ('Run', 'Maintenance', 'Breakdown', 'Repair')),
    description TEXT,
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.laundry_machine_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_machine_logs;
CREATE POLICY "Tenant Isolation" ON public.laundry_machine_logs FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Laundry Quality Control logs
CREATE TABLE IF NOT EXISTS public.laundry_quality_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES public.laundry_order_items(id) ON DELETE CASCADE,
    inspector_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    check_status TEXT NOT NULL CHECK (check_status IN ('Passed', 'Failed', 'Rewash')),
    stain_removed BOOLEAN DEFAULT true,
    damage_found BOOLEAN DEFAULT false,
    comments TEXT
);

ALTER TABLE public.laundry_quality_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_quality_logs;
CREATE POLICY "Tenant Isolation" ON public.laundry_quality_logs FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Laundry Order Status History Trace
CREATE TABLE IF NOT EXISTS public.laundry_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.laundry_orders(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT,
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT
);

ALTER TABLE public.laundry_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_status_history;
CREATE POLICY "Tenant Isolation" ON public.laundry_status_history FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Laundry Customer Feedback logs
CREATE TABLE IF NOT EXISTS public.laundry_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.laundry_orders(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comments TEXT
);

ALTER TABLE public.laundry_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_feedback;
CREATE POLICY "Tenant Isolation" ON public.laundry_feedback FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());


-- 3. TRIGGERS & PROCEDURES (INTEGRATIONS)

-- Audit logging triggers (using activity_logs)
CREATE OR REPLACE FUNCTION public.log_laundry_order_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.activity_logs (company_id, user_email, table_name, record_id, action, description, new_data)
        VALUES (
            NEW.company_id,
            (SELECT email FROM auth.users WHERE id = auth.uid()),
            'laundry_orders',
            NEW.id,
            'CREATE',
            'Laundry order created: ' || NEW.order_number,
            row_to_json(NEW)::jsonb
        );
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.activity_logs (company_id, user_email, table_name, record_id, action, description, old_data, new_data)
        VALUES (
            NEW.company_id,
            (SELECT email FROM auth.users WHERE id = auth.uid()),
            'laundry_orders',
            NEW.id,
            'UPDATE',
            'Laundry order status changed from ' || OLD.status || ' to ' || NEW.status,
            row_to_json(OLD)::jsonb,
            row_to_json(NEW)::jsonb
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_laundry_order_activity ON public.laundry_orders;
CREATE TRIGGER trg_laundry_order_activity
AFTER INSERT OR UPDATE ON public.laundry_orders
FOR EACH ROW EXECUTE PROCEDURE public.log_laundry_order_activity();


-- Invoicing integration helper
CREATE OR REPLACE FUNCTION public.laundry_provision_accounting_partner(
    p_crm_customer_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_crm_cust RECORD;
    v_partner_id UUID;
    v_company_id UUID;
    v_ar_account UUID;
BEGIN
    v_company_id := get_my_company_id();
    
    -- Get CRM Customer Details
    SELECT * INTO v_crm_cust FROM public.crm_customers WHERE id = p_crm_customer_id;
    IF v_crm_cust IS NULL THEN
        RAISE EXCEPTION 'CRM Customer not found';
    END IF;
    
    -- Check if partner already exists in accounting_partners
    SELECT id INTO v_partner_id 
    FROM public.accounting_partners 
    WHERE company_id = v_company_id AND name = v_crm_cust.name;
    
    -- Provision partner if it does not exist
    IF v_partner_id IS NULL THEN
        -- Find a default receivable account
        SELECT id INTO v_ar_account 
        FROM public.chart_of_accounts 
        WHERE company_id = v_company_id AND type = 'Asset' AND is_active = true 
        LIMIT 1;
        
        INSERT INTO public.accounting_partners (
            company_id, name, email, phone, tax_id, street, city, state, country, partner_type, property_account_receivable_id
        ) VALUES (
            v_company_id,
            v_crm_cust.name,
            v_crm_cust.primary_email,
            v_crm_cust.primary_phone,
            v_crm_cust.tax_id,
            v_crm_cust.billing_address_line_1,
            v_crm_cust.billing_city,
            v_crm_cust.billing_state,
            v_crm_cust.billing_country,
            'Customer',
            v_ar_account
        ) RETURNING id INTO v_partner_id;
    END IF;
    
    RETURN v_partner_id;
END;
$$;


-- Helper RPC to generate invoice for a laundry order
CREATE OR REPLACE FUNCTION public.rpc_create_laundry_invoice(
    p_order_id UUID,
    p_journal_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_partner_id UUID;
    v_lines JSONB;
    v_invoice_id UUID;
    v_default_item_id UUID;
BEGIN
    -- 1. Fetch Order Details
    SELECT * INTO v_order FROM public.laundry_orders WHERE id = p_order_id;
    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;
    
    IF v_order.accounting_invoice_id IS NOT NULL THEN
        RAISE EXCEPTION 'Invoice already created for this order';
    END IF;
    
    -- 2. Provision Accounting Partner matching CRM customer
    v_partner_id := public.laundry_provision_accounting_partner(v_order.customer_id);
    
    -- 3. Get first default inventory item to map pricing/accounts for invoice lines
    -- (We use the first item_master entry or create a dummy item master representing "Laundry Service Charge")
    SELECT id INTO v_default_item_id FROM public.item_master WHERE company_id = v_order.company_id LIMIT 1;
    IF v_default_item_id IS NULL THEN
        -- Fallback: provision a dummy service item in item_master
        INSERT INTO public.item_master (
            company_id, code, name, category, uom, valuation_method, is_stockable
        ) VALUES (
            v_order.company_id,
            'LAUNDRY-SRV',
            'Laundry Service Charge',
            'Services',
            'Unit',
            'AVG',
            false
        ) RETURNING id INTO v_default_item_id;
    END IF;
    
    -- 4. Construct Invoice Lines JSONB Payload
    -- Each line is {item_id, quantity, unit_price, description}
    SELECT jsonb_agg(
        jsonb_build_object(
            'item_id', v_default_item_id,
            'quantity', quantity,
            'unit_price', unit_price,
            'description', service_name || ' - ' || item_name || COALESCE(' (' || notes || ')', '')
        )
    ) INTO v_lines
    FROM (
        SELECT 
            oi.quantity,
            oi.unit_price,
            oi.notes,
            s.name as service_name,
            i.name as item_name
        FROM public.laundry_order_items oi
        JOIN public.laundry_services s ON s.id = oi.service_id
        JOIN public.laundry_items i ON i.id = oi.item_id
        WHERE oi.order_id = p_order_id
    ) t;

    IF v_lines IS NULL OR jsonb_array_length(v_lines) = 0 THEN
        RAISE EXCEPTION 'Order has no items to bill';
    END IF;

    -- 5. Invoke Accounting Invoicing Engine RPC
    v_invoice_id := public.rpc_create_accounting_invoice(
        v_partner_id,
        p_journal_id,
        CURRENT_DATE,
        CURRENT_DATE + 30, -- 30-day default credit term
        'out_invoice',
        v_lines
    );
    
    -- 6. Link invoice back to laundry order & update status
    UPDATE public.laundry_orders
    SET 
        accounting_invoice_id = v_invoice_id,
        status = 'Invoice'
    WHERE id = p_order_id;
    
    RETURN v_invoice_id;
END;
$$;


-- 4. SEED DATA (IF NOT EXISTING)

-- Seed Default services and items
DO $$
DECLARE
    v_company_id UUID;
    v_service_id UUID;
    v_item_id UUID;
BEGIN
    FOR v_company_id IN SELECT id FROM public.companies LOOP
        -- Seed Default Services
        INSERT INTO public.laundry_services (company_id, name, code, description, category)
        VALUES 
            (v_company_id, 'Wash & Fold', 'WSH-FLD', 'Standard machine wash and tumble dry, folded', 'Standard'),
            (v_company_id, 'Wash & Iron', 'WSH-IRN', 'Standard machine wash, tumble dry, and steam pressed', 'Standard'),
            (v_company_id, 'Dry Clean', 'DRY-CLN', 'Special chemical solvent clean for delicate items', 'Premium'),
            (v_company_id, 'Steam Press Only', 'PRS-ONLY', 'Ironing and steam pressing only', 'Standard'),
            (v_company_id, 'Premium Wash & Press', 'PRM-WSH', 'Delicate washing with premium softeners and hand ironing', 'Premium')
        ON CONFLICT (company_id, code) DO NOTHING;
        
        -- Seed Default Items
        INSERT INTO public.laundry_items (company_id, name, code, category)
        VALUES
            (v_company_id, 'Shirt', 'SHIRT', 'Apparel'),
            (v_company_id, 'Trousers', 'TROUSER', 'Apparel'),
            (v_company_id, 'Bed Sheet (Single)', 'BDSHT-S', 'Linen'),
            (v_company_id, 'Bed Sheet (Double)', 'BDSHT-D', 'Linen'),
            (v_company_id, 'Blanket / Duvet', 'BLANKET', 'Linen'),
            (v_company_id, 'Suit (2-Piece)', 'SUIT2PC', 'Apparel'),
            (v_company_id, 'Curtain (Per Metre)', 'CURTAIN', 'Curtain'),
            (v_company_id, 'Dress / Abaya', 'ABAYA', 'Apparel')
        ON CONFLICT (company_id, code) DO NOTHING;
        
        -- Seed Default Machines
        INSERT INTO public.laundry_machines (company_id, name, code, type, capacity)
        VALUES
            (v_company_id, 'Front Load Washer 15kg', 'WASH-15K-01', 'Washer', '15kg'),
            (v_company_id, 'Front Load Washer 25kg', 'WASH-25K-01', 'Washer', '25kg'),
            (v_company_id, 'Commercial Dryer 20kg', 'DRY-20K-01', 'Dryer', '20kg'),
            (v_company_id, 'Steam Iron Station A', 'STM-IRN-A', 'Steam Press', 'N/A'),
            (v_company_id, 'Automatic Folder', 'FOLD-01', 'Folder', 'N/A')
        ON CONFLICT (company_id, code) DO NOTHING;

        -- Create a default pricing grid mapping standard service to standard items
        -- Wash & Fold mapping
        SELECT id INTO v_service_id FROM public.laundry_services WHERE company_id = v_company_id AND code = 'WSH-FLD';
        IF v_service_id IS NOT NULL THEN
            SELECT id INTO v_item_id FROM public.laundry_items WHERE company_id = v_company_id AND code = 'SHIRT';
            IF v_item_id IS NOT NULL THEN
                INSERT INTO public.laundry_pricing (company_id, item_id, service_id, unit_price, express_price)
                VALUES (v_company_id, v_item_id, v_service_id, 8.00, 12.00) ON CONFLICT (company_id, item_id, service_id) DO NOTHING;
            END IF;
            
            SELECT id INTO v_item_id FROM public.laundry_items WHERE company_id = v_company_id AND code = 'TROUSER';
            IF v_item_id IS NOT NULL THEN
                INSERT INTO public.laundry_pricing (company_id, item_id, service_id, unit_price, express_price)
                VALUES (v_company_id, v_item_id, v_service_id, 10.00, 15.00) ON CONFLICT (company_id, item_id, service_id) DO NOTHING;
            END IF;

            SELECT id INTO v_item_id FROM public.laundry_items WHERE company_id = v_company_id AND code = 'BDSHT-D';
            IF v_item_id IS NOT NULL THEN
                INSERT INTO public.laundry_pricing (company_id, item_id, service_id, unit_price, express_price)
                VALUES (v_company_id, v_item_id, v_service_id, 20.00, 30.00) ON CONFLICT (company_id, item_id, service_id) DO NOTHING;
            END IF;
        END IF;

        -- Dry Clean mapping
        SELECT id INTO v_service_id FROM public.laundry_services WHERE company_id = v_company_id AND code = 'DRY-CLN';
        IF v_service_id IS NOT NULL THEN
            SELECT id INTO v_item_id FROM public.laundry_items WHERE company_id = v_company_id AND code = 'SUIT2PC';
            IF v_item_id IS NOT NULL THEN
                INSERT INTO public.laundry_pricing (company_id, item_id, service_id, unit_price, express_price)
                VALUES (v_company_id, v_item_id, v_service_id, 45.00, 65.00) ON CONFLICT (company_id, item_id, service_id) DO NOTHING;
            END IF;

            SELECT id INTO v_item_id FROM public.laundry_items WHERE company_id = v_company_id AND code = 'ABAYA';
            IF v_item_id IS NOT NULL THEN
                INSERT INTO public.laundry_pricing (company_id, item_id, service_id, unit_price, express_price)
                VALUES (v_company_id, v_item_id, v_service_id, 25.00, 35.00) ON CONFLICT (company_id, item_id, service_id) DO NOTHING;
            END IF;
        END IF;

    END LOOP;
END;
$$;
