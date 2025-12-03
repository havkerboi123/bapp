-- Migration: Add payment features to loans table
-- Run this in Supabase SQL Editor

-- Add wallet address columns to loans table
ALTER TABLE public.loans 
ADD COLUMN IF NOT EXISTS owner_wallet_address TEXT,
ADD COLUMN IF NOT EXISTS partner_wallet_address TEXT;

-- Add on-chain loan ID column (bytes32 stored as hex string)
ALTER TABLE public.loans 
ADD COLUMN IF NOT EXISTS onchain_loan_id TEXT;

-- Add paid back date column
ALTER TABLE public.loans 
ADD COLUMN IF NOT EXISTS paid_back_date TIMESTAMP WITH TIME ZONE;

-- Update status constraint to include new statuses
ALTER TABLE public.loans 
DROP CONSTRAINT IF EXISTS loans_status_check;

ALTER TABLE public.loans 
ADD CONSTRAINT loans_status_check 
CHECK (status IN ('pending', 'accepted', 'rejected', 'waiting on payment', 'paid back'));

-- Populate wallet addresses for existing loans (if any)
UPDATE public.loans l
SET 
  owner_wallet_address = (
    SELECT wallet_address FROM public.users WHERE id = l.owner_user_id
  ),
  partner_wallet_address = (
    SELECT wallet_address FROM public.users WHERE id = l.partner_user_id
  )
WHERE owner_wallet_address IS NULL OR partner_wallet_address IS NULL;

-- Verify the changes
SELECT 
  id,
  status,
  owner_wallet_address,
  partner_wallet_address,
  paid_back_date
FROM public.loans
LIMIT 5;

