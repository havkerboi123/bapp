-- Migration: Add contract_address column to track which contract a loan was recorded on
-- Run this in Supabase SQL Editor

-- Add contract_address column to loans table
ALTER TABLE public.loans 
ADD COLUMN IF NOT EXISTS contract_address TEXT;

-- Set default for existing loans to the old contract (if they have onchain_loan_id)
UPDATE public.loans 
SET contract_address = '0x33331E6AE32a094e1955044f6A67394B25DeeDa1'
WHERE contract_address IS NULL 
  AND onchain_loan_id IS NOT NULL;

-- Verify the changes
SELECT 
  id,
  status,
  onchain_loan_id,
  contract_address
FROM public.loans
WHERE onchain_loan_id IS NOT NULL
LIMIT 5;

