-- Clear all loans from all accounts
DELETE FROM public.loans;

-- Verify loans are cleared
SELECT COUNT(*) as remaining_loans FROM public.loans;

-- Check all users (to verify users still exist)
SELECT id, username, name, wallet_address FROM public.users;

-- Optional: If you also want to clear partners (uncomment if needed)
-- DELETE FROM public.partners;

-- Optional: If you also want to clear users (uncomment if needed)
-- DELETE FROM public.users;

