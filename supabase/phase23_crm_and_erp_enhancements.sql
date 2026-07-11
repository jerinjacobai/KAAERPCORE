-- ==============================================================================
-- KAA ERP V2.4 - CRM & ERP ENHANCEMENTS MIGRATION
-- ==============================================================================

-- 1. Alter Existing Tables to Add Attachment & Image Columns
DO $$
BEGIN
    -- item_master updates
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'item_master' AND column_name = 'photo_url') THEN
        ALTER TABLE item_master ADD COLUMN photo_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'item_master' AND column_name = 'image_urls') THEN
        ALTER TABLE item_master ADD COLUMN image_urls JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- leaves updates
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leaves' AND column_name = 'attachment_url') THEN
        ALTER TABLE leaves ADD COLUMN attachment_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leaves' AND column_name = 'attachment_name') THEN
        ALTER TABLE leaves ADD COLUMN attachment_name TEXT;
    END IF;

    -- tickets updates
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'attachment_url') THEN
        ALTER TABLE tickets ADD COLUMN attachment_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'attachment_name') THEN
        ALTER TABLE tickets ADD COLUMN attachment_name TEXT;
    END IF;

    -- resignations updates
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resignations' AND column_name = 'attachment_url') THEN
        ALTER TABLE resignations ADD COLUMN attachment_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resignations' AND column_name = 'attachment_name') THEN
        ALTER TABLE resignations ADD COLUMN attachment_name TEXT;
    END IF;

    -- profiles updates
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
        ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
    END IF;
END $$;


-- 2. Create Missing CRM Tables (Quotations, Invoices, Delivery Notes, Attachments)

-- crm_attachments
CREATE TABLE IF NOT EXISTS crm_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    module TEXT NOT NULL,
    record_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    uploaded_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE crm_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation crm_attachments" ON crm_attachments USING (company_id = get_my_company_id());

-- crm_quotations
CREATE TABLE IF NOT EXISTS crm_quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    series TEXT,
    customer_id UUID REFERENCES crm_customers(id),
    quotation_date DATE,
    valid_until DATE,
    status TEXT DEFAULT 'Draft',
    currency TEXT DEFAULT 'QAR',
    subtotal NUMERIC(15,2) DEFAULT 0.00,
    tax_amount NUMERIC(15,2) DEFAULT 0.00,
    discount_amount NUMERIC(15,2) DEFAULT 0.00,
    grand_total NUMERIC(15,2) DEFAULT 0.00,
    terms_and_conditions TEXT,
    notes TEXT,
    opportunity_id UUID REFERENCES crm_opportunities(id),
    owner_id UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE crm_quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation crm_quotations" ON crm_quotations USING (company_id = get_my_company_id());

-- crm_quotation_lines
CREATE TABLE IF NOT EXISTS crm_quotation_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID REFERENCES crm_quotations(id) ON DELETE CASCADE,
    item_id UUID REFERENCES item_master(id),
    item_name TEXT NOT NULL,
    description TEXT,
    quantity NUMERIC(15,4) NOT NULL DEFAULT 1,
    rate NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    discount_percent NUMERIC(5,2) DEFAULT 0.00,
    tax_percent NUMERIC(5,2) DEFAULT 0.00,
    sort_order INTEGER DEFAULT 0
);
ALTER TABLE crm_quotation_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation crm_quotation_lines" ON crm_quotation_lines USING (
    quotation_id IN (SELECT id FROM crm_quotations WHERE company_id = get_my_company_id())
);

-- crm_sales_invoices
CREATE TABLE IF NOT EXISTS crm_sales_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    series TEXT,
    customer_id UUID REFERENCES crm_customers(id),
    quotation_id UUID REFERENCES crm_quotations(id) ON DELETE SET NULL,
    invoice_date DATE,
    due_date DATE,
    status TEXT DEFAULT 'Draft',
    currency TEXT DEFAULT 'QAR',
    subtotal NUMERIC(15,2) DEFAULT 0.00,
    tax_amount NUMERIC(15,2) DEFAULT 0.00,
    discount_amount NUMERIC(15,2) DEFAULT 0.00,
    grand_total NUMERIC(15,2) DEFAULT 0.00,
    amount_paid NUMERIC(15,2) DEFAULT 0.00,
    terms_and_conditions TEXT,
    notes TEXT,
    owner_id UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE crm_sales_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation crm_sales_invoices" ON crm_sales_invoices USING (company_id = get_my_company_id());

-- crm_sales_invoice_lines
CREATE TABLE IF NOT EXISTS crm_sales_invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES crm_sales_invoices(id) ON DELETE CASCADE,
    item_id UUID REFERENCES item_master(id),
    item_name TEXT NOT NULL,
    description TEXT,
    quantity NUMERIC(15,4) NOT NULL DEFAULT 1,
    rate NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    discount_percent NUMERIC(5,2) DEFAULT 0.00,
    tax_percent NUMERIC(5,2) DEFAULT 0.00,
    sort_order INTEGER DEFAULT 0
);
ALTER TABLE crm_sales_invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation crm_sales_invoice_lines" ON crm_sales_invoice_lines USING (
    invoice_id IN (SELECT id FROM crm_sales_invoices WHERE company_id = get_my_company_id())
);

-- crm_delivery_notes
CREATE TABLE IF NOT EXISTS crm_delivery_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    series TEXT,
    customer_id UUID REFERENCES crm_customers(id),
    invoice_id UUID REFERENCES crm_sales_invoices(id) ON DELETE SET NULL,
    quotation_id UUID REFERENCES crm_quotations(id) ON DELETE SET NULL,
    delivery_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'Pending',
    owner_id UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE crm_delivery_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation crm_delivery_notes" ON crm_delivery_notes USING (company_id = get_my_company_id());

-- crm_delivery_note_lines
CREATE TABLE IF NOT EXISTS crm_delivery_note_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_note_id UUID REFERENCES crm_delivery_notes(id) ON DELETE CASCADE,
    item_id UUID REFERENCES item_master(id),
    item_name TEXT NOT NULL,
    description TEXT,
    quantity_ordered NUMERIC(15,4) NOT NULL DEFAULT 0,
    quantity_delivered NUMERIC(15,4) NOT NULL DEFAULT 0,
    uom TEXT DEFAULT 'EA',
    sort_order INTEGER DEFAULT 0
);
ALTER TABLE crm_delivery_note_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation crm_delivery_note_lines" ON crm_delivery_note_lines USING (
    delivery_note_id IN (SELECT id FROM crm_delivery_notes WHERE company_id = get_my_company_id())
);


-- 3. Create Tool Tracking Table (Inventory Enhancement)
CREATE TABLE IF NOT EXISTS tool_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    tool_name TEXT NOT NULL,
    item_code TEXT,
    serial_number TEXT,
    quantity_out INTEGER DEFAULT 1,
    employee_id UUID REFERENCES employees(id),
    employee_name TEXT,
    department_id UUID REFERENCES departments(id),
    department_name TEXT,
    project_name TEXT,
    date_out DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_return_date DATE,
    remarks_out TEXT,
    approval_status TEXT DEFAULT 'Approved',
    quantity_returned INTEGER DEFAULT 0,
    date_returned DATE,
    condition_status TEXT,
    remarks_in TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE tool_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation tool_tracking" ON tool_tracking USING (company_id = get_my_company_id());


-- 4. Create Employee Targets Table
CREATE TABLE IF NOT EXISTS employee_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    target_period TEXT NOT NULL, -- 'Monthly', 'Quarterly', 'Annual'
    target_year INTEGER NOT NULL,
    target_period_val INTEGER NOT NULL, -- Month (1-12) or Quarter (1-4)
    target_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    achieved_amount NUMERIC(15,2) DEFAULT 0.00,
    incentive_rate NUMERIC(5,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(company_id, employee_id, target_period, target_year, target_period_val)
);
ALTER TABLE employee_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation employee_targets" ON employee_targets USING (company_id = get_my_company_id());


-- 5. Create Real-Time Chat System Tables

-- chat_rooms
CREATE TABLE IF NOT EXISTS chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    name TEXT,
    type TEXT NOT NULL, -- 'direct', 'group', 'department'
    department_id UUID REFERENCES departments(id),
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation chat_rooms" ON chat_rooms USING (company_id = get_my_company_id());

-- chat_participants
CREATE TABLE IF NOT EXISTS chat_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation chat_participants" ON chat_participants USING (
    room_id IN (SELECT id FROM chat_rooms WHERE company_id = get_my_company_id())
);

-- chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation chat_messages" ON chat_messages USING (
    room_id IN (SELECT id FROM chat_rooms WHERE company_id = get_my_company_id())
);


-- 6. Create Quotation Request Workflow System Tables

-- crm_proposal_requests
CREATE TABLE IF NOT EXISTS crm_proposal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    requester_id UUID REFERENCES employees(id),
    customer_id UUID REFERENCES crm_customers(id),
    customer_details JSONB,
    requirements TEXT NOT NULL,
    requested_delivery_date DATE,
    status TEXT DEFAULT 'Pending Proposal Creation',
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE crm_proposal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation crm_proposal_requests" ON crm_proposal_requests USING (company_id = get_my_company_id());

-- crm_proposals
CREATE TABLE IF NOT EXISTS crm_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    request_id UUID REFERENCES crm_proposal_requests(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES crm_customers(id),
    title TEXT NOT NULL,
    pricing_details JSONB DEFAULT '[]'::jsonb,
    grand_total NUMERIC(15,2) DEFAULT 0.00,
    terms_and_conditions TEXT,
    status TEXT DEFAULT 'Draft',
    is_locked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE crm_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation crm_proposals" ON crm_proposals USING (company_id = get_my_company_id());


-- 7. Create SLA & Timeline Tracking Table
CREATE TABLE IF NOT EXISTS sla_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL DEFAULT get_my_company_id(),
    entity_type TEXT NOT NULL, -- 'LEAVE', 'PROPOSAL', 'TICKET'
    entity_id UUID NOT NULL,
    sla_hours INTEGER NOT NULL DEFAULT 48,
    start_time TIMESTAMPTZ DEFAULT now(),
    due_time TIMESTAMPTZ NOT NULL,
    completed_time TIMESTAMPTZ,
    status TEXT DEFAULT 'Pending', -- 'Pending', 'Completed', 'Overdue'
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sla_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation sla_tracking" ON sla_tracking USING (company_id = get_my_company_id());


-- 8. Setup Private Attachments Bucket & RLS Policies
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Attachments Tenant Isolation Select" ON storage.objects;
CREATE POLICY "Attachments Tenant Isolation Select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = (SELECT company_id::text FROM profiles WHERE id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS "Attachments Tenant Isolation Insert" ON storage.objects;
CREATE POLICY "Attachments Tenant Isolation Insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = (SELECT company_id::text FROM profiles WHERE id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS "Attachments Tenant Isolation Delete" ON storage.objects;
CREATE POLICY "Attachments Tenant Isolation Delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = (SELECT company_id::text FROM profiles WHERE id = auth.uid() LIMIT 1));

-- 9. SLA Overdue Processing Function
CREATE OR REPLACE FUNCTION check_and_process_overdue_slas()
RETURNS void AS $$
DECLARE
    rec RECORD;
    v_recipient_id UUID;
BEGIN
    -- Find pending SLAs that have passed their due_time
    FOR rec IN 
        SELECT s.*, w.assigned_to_user_id, w.requester_id
        FROM sla_tracking s
        LEFT JOIN workflow_instances w ON w.entity_id = s.entity_id
        WHERE s.status = 'Pending' AND s.due_time < now()
    LOOP
        -- 1. Update SLA status to Overdue
        UPDATE sla_tracking SET status = 'Overdue' WHERE id = rec.id;

        -- 2. Determine recipient (default to requester if no assignee)
        v_recipient_id := COALESCE(rec.assigned_to_user_id, rec.requester_id);

        -- 3. Insert notification for recipient
        IF v_recipient_id IS NOT NULL THEN
            INSERT INTO notifications (company_id, user_id, title, message, type, link)
            VALUES (
                rec.company_id,
                v_recipient_id,
                'SLA OVERDUE Alert',
                'The ' || rec.entity_type || ' request is overdue. Action is required immediately.',
                'ALERT',
                CASE 
                    WHEN rec.entity_type = 'LEAVE' THEN '/essp'
                    WHEN rec.entity_type = 'TICKET' THEN '/help_desk'
                    ELSE '/crm'
                END
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
