-- Clear all loans and payments from database
-- This will remove all loan records, including payment information
-- Run this in Supabase SQL Editor

-- Delete all loans (this also clears all payment records since they're stored in the loans table)
DELETE FROM public.loans;

-- Verify all loans are cleared
SELECT COUNT(*) as remaining_loans FROM public.loans;

-- Optional: Reset the sequence if you want IDs to start from 1 again
-- Uncomment the line below if your loans table uses a serial/sequence for ID
-- ALTER SEQUENCE public.loans_id_seq RESTART WITH 1;

-- Show summary
SELECT 
  'Loans cleared successfully' as status,
  COUNT(*) as remaining_loans_count
FROM public.loans;

