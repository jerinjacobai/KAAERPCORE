-- FIX RLS INFINITE RECURSION ON PROFILES TABLE & FIX USER LINKING TRIGGER
-- Description: Redefines get_my_company_id() as SECURITY DEFINER to bypass RLS checks, drops/recreates profile policies to avoid infinite recursion, updates handle_new_user() trigger to link profile_id to employees table, and runs self-healing data repair.

-- 1. Redefine get_my_company_id as SECURITY DEFINER
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Direct lookup with security definer to bypass RLS for this specific query
  SELECT company_id INTO v_company_id
  FROM profiles
  WHERE id = auth.uid();
  
  RETURN v_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing problematic RLS policy
DROP POLICY IF EXISTS "Users can only see profiles in their company" ON profiles;

-- Create optimized non-recursive policies
DROP POLICY IF EXISTS "Users can see own profile" ON profiles;
CREATE POLICY "Users can see own profile" ON profiles
    FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can see colleagues" ON profiles;
CREATE POLICY "Users can see colleagues" ON profiles
    FOR SELECT USING (company_id = get_my_company_id());

-- 2. Update handle_new_user trigger to link employee profile_id back
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_emp_id UUID;
    v_company_id UUID;
    v_role TEXT := 'Employee'; -- Default role
    v_role_id UUID;
BEGIN
    -- 1. Try to find a matching employee by email (case-insensitive)
    SELECT id, company_id, role
    INTO v_emp_id, v_company_id, v_role
    FROM public.employees
    WHERE lower(office_email) = lower(NEW.email) OR lower(personal_email) = lower(NEW.email) OR lower(email) = lower(NEW.email)
    LIMIT 1;

    -- Look up role ID for user_company_access. Default to Employee role or NULL if none.
    IF v_company_id IS NOT NULL THEN
        SELECT id INTO v_role_id FROM public.roles WHERE company_id = v_company_id AND lower(name) = lower(COALESCE(v_role, 'Employee')) LIMIT 1;
        IF v_role_id IS NULL THEN
            SELECT id INTO v_role_id FROM public.roles WHERE company_id = v_company_id LIMIT 1;
        END IF;

        -- Grant access to the company immediately so the user isn't stuck empty
        INSERT INTO public.user_company_access (user_id, company_id, is_default, status, role_id)
        VALUES (NEW.id, v_company_id, true, 'active', v_role_id)
        ON CONFLICT (user_id, company_id) DO NOTHING;

        -- ALSO UPDATE the employee record to link the profile_id back!
        UPDATE public.employees
        SET profile_id = NEW.id
        WHERE id = v_emp_id;
    END IF;

    -- 2. Insert into public.profiles
    INSERT INTO public.profiles (
        id,
        email,
        role,
        employee_id,
        company_id
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(v_role, 'Employee'),
        v_emp_id,
        v_company_id
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        employee_id = COALESCE(public.profiles.employee_id, EXCLUDED.employee_id),
        company_id = COALESCE(public.profiles.company_id, EXCLUDED.company_id);

    RETURN NEW;
END;
$function$;

-- 3. One-time self-healing data updates to sync existing records
-- A. Link existing employees to profiles by matching email and mark as linked
UPDATE public.employees e
SET profile_id = p.id,
    user_account_linked = true
FROM public.profiles p
WHERE (lower(e.office_email) = lower(p.email) OR lower(e.personal_email) = lower(p.email) OR lower(e.email) = lower(p.email)) 
  AND e.profile_id IS NULL;

-- B. Link profiles to employees by matching email (setting both employee_id and company_id)
UPDATE public.profiles p
SET employee_id = e.id,
    company_id = e.company_id
FROM public.employees e
WHERE (lower(e.office_email) = lower(p.email) OR lower(e.personal_email) = lower(p.email) OR lower(e.email) = lower(p.email))
  AND (p.employee_id IS NULL OR p.company_id IS NULL);

-- C. Link existing profiles to employee company IDs (fallback for already matched employee_id)
UPDATE public.profiles p
SET company_id = e.company_id
FROM public.employees e
WHERE p.employee_id = e.id AND p.company_id IS NULL;
