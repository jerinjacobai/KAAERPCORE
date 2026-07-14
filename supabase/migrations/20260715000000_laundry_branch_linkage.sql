-- Migration: Add branch_id to laundry_machines and laundry_vehicles to enable multi-branch asset mapping
ALTER TABLE public.laundry_machines 
ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.laundry_vehicles 
ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES public.locations(id) ON DELETE SET NULL;
