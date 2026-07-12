-- supabase/migrations/20260712000200_laundry_phase3.sql
-- Phase 3 Extension: Vehicle Fleet, Fuel Logs, GPS Trackings, and Customer Feedbacks

-- ==============================================================================
-- 1. DATABASE TABLES PROVISION
-- ==============================================================================

-- Vehicles Master
CREATE TABLE IF NOT EXISTS public.laundry_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    license_plate TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Van', 'Truck', 'Motorcycle')),
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Maintenance', 'Out of Service')),
    current_mileage NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    insurance_expiry DATE,
    fuel_capacity NUMERIC(8, 2) DEFAULT 60.00 NOT NULL,
    UNIQUE(company_id, license_plate)
);

ALTER TABLE public.laundry_vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_vehicles;
CREATE POLICY "Tenant Isolation" ON public.laundry_vehicles FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Vehicle Fuel Logs
CREATE TABLE IF NOT EXISTS public.laundry_fuel_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES public.laundry_vehicles(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    liters NUMERIC(8, 2) NOT NULL,
    odometer NUMERIC(12, 2) NOT NULL,
    cost NUMERIC(15, 2) NOT NULL
);

ALTER TABLE public.laundry_fuel_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_fuel_logs;
CREATE POLICY "Tenant Isolation" ON public.laundry_fuel_logs FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- GPS Tracks
CREATE TABLE IF NOT EXISTS public.laundry_gps_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    job_id UUID NOT NULL,
    job_type TEXT NOT NULL CHECK (job_type IN ('pickup', 'delivery')),
    latitude NUMERIC(9, 6) NOT NULL,
    longitude NUMERIC(9, 6) NOT NULL,
    speed NUMERIC(5, 2) DEFAULT 0.00
);

ALTER TABLE public.laundry_gps_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_gps_history;
CREATE POLICY "Tenant Isolation" ON public.laundry_gps_history FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- Feedbacks
CREATE TABLE IF NOT EXISTS public.laundry_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id UUID NOT NULL DEFAULT get_my_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.laundry_orders(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comments TEXT,
    status TEXT DEFAULT 'Pending Review' CHECK (status IN ('Pending Review', 'Resolved', 'Archived')),
    UNIQUE(company_id, order_id)
);

ALTER TABLE public.laundry_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.laundry_feedback;
CREATE POLICY "Tenant Isolation" ON public.laundry_feedback FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());


-- ==============================================================================
-- 2. SAMPLE SEED DATA
-- ==============================================================================

DO $$
DECLARE
    v_company_id UUID;
    v_veh_id UUID;
    v_order_id UUID;
    v_cust_id UUID;
BEGIN
    SELECT id INTO v_company_id FROM public.companies LIMIT 1;
    IF v_company_id IS NOT NULL THEN
        -- Seed Vehicles
        INSERT INTO public.laundry_vehicles (company_id, name, license_plate, type, status, current_mileage, insurance_expiry, fuel_capacity)
        VALUES 
            (v_company_id, 'Delivery Van A', '12345-QA', 'Van', 'Active', 12500.50, CURRENT_DATE + INTERVAL '6 months', 60.00),
            (v_company_id, 'Heavy Logistic Truck', '67890-QA', 'Truck', 'Active', 48900.00, CURRENT_DATE + INTERVAL '3 months', 120.00)
        ON CONFLICT DO NOTHING;

        SELECT id INTO v_veh_id FROM public.laundry_vehicles WHERE company_id = v_company_id LIMIT 1;
        IF v_veh_id IS NOT NULL THEN
            -- Seed Fuel Log
            INSERT INTO public.laundry_fuel_logs (company_id, vehicle_id, date, liters, odometer, cost)
            VALUES (v_company_id, v_veh_id, CURRENT_DATE - INTERVAL '2 days', 45.50, 12450.00, 95.00)
            ON CONFLICT DO NOTHING;
        END IF;

        -- Seed Feedback (if orders exist)
        SELECT id, customer_id INTO v_order_id, v_cust_id FROM public.laundry_orders WHERE company_id = v_company_id LIMIT 1;
        IF v_order_id IS NOT NULL AND v_cust_id IS NOT NULL THEN
            INSERT INTO public.laundry_feedback (company_id, order_id, customer_id, rating, comments, status)
            VALUES (v_company_id, v_order_id, v_cust_id, 5, 'Exceptional service! The dry cleaning was perfectly done and garments were returned very fresh.', 'Resolved')
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
END;
$$;
