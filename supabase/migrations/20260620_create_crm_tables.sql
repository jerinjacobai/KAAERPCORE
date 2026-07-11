-- 1. Create org_lead_sources
CREATE TABLE IF NOT EXISTS public.org_lead_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.org_lead_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Isolation" ON public.org_lead_sources;
CREATE POLICY "Tenant Isolation" ON public.org_lead_sources FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- 2. Create crm_leads
CREATE TABLE IF NOT EXISTS public.crm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    series TEXT,
    status TEXT DEFAULT 'New',
    salutation TEXT,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    last_name TEXT,
    gender TEXT,
    job_title TEXT,
    email TEXT,
    mobile TEXT,
    phone TEXT,
    phone_ext TEXT,
    whatsapp TEXT,
    website TEXT,
    lead_type TEXT,
    request_type TEXT,
    lead_source_id UUID REFERENCES public.org_lead_sources(id) ON DELETE SET NULL,
    lead_owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    organization_name TEXT,
    no_of_employees TEXT,
    annual_revenue NUMERIC,
    industry TEXT,
    market_segment TEXT,
    territory TEXT,
    fax TEXT,
    address_line_1 TEXT,
    address_line_2 TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    zip_code TEXT,
    qualification_notes TEXT,
    is_converted BOOLEAN DEFAULT false,
    converted_customer_id UUID,
    converted_opportunity_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Isolation" ON public.crm_leads;
CREATE POLICY "Tenant Isolation" ON public.crm_leads FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- 3. Create crm_customers
CREATE TABLE IF NOT EXISTS public.crm_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    customer_type TEXT DEFAULT 'Company',
    lifecycle_stage TEXT DEFAULT 'Customer',
    primary_email TEXT,
    primary_phone TEXT,
    billing_address_line_1 TEXT,
    billing_address_line_2 TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_country TEXT,
    billing_zip_code TEXT,
    website TEXT,
    industry TEXT,
    tax_id TEXT,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.crm_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Isolation" ON public.crm_customers;
CREATE POLICY "Tenant Isolation" ON public.crm_customers FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());

-- 4. Create crm_opportunities
CREATE TABLE IF NOT EXISTS public.crm_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    series TEXT,
    customer_id UUID REFERENCES public.crm_customers(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,
    stage_id UUID REFERENCES public.org_crm_stages(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'Open',
    probability NUMERIC DEFAULT 0,
    type TEXT DEFAULT 'Sales',
    source_id UUID REFERENCES public.org_lead_sources(id) ON DELETE SET NULL,
    expected_closing_date DATE,
    currency TEXT DEFAULT 'USD',
    amount NUMERIC DEFAULT 0,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Isolation" ON public.crm_opportunities;
CREATE POLICY "Tenant Isolation" ON public.crm_opportunities FOR ALL USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
