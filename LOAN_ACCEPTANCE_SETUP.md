# Loan Acceptance System Setup

## Summary
Loans now require **partner acceptance** before being finalized. When an owner adds a loan, it starts as "pending". The partner must accept or reject it. Only accepted loans count toward totals and are recorded on-chain.

## What's Done ✅

1. **Database Schema** - Loans table needs `status` column
2. **Loan Creation** - New loans start as "pending"
3. **Accept/Reject API** - Partners can accept or reject loans
4. **Pending Loans Page** - Partners can view and respond to pending loans
5. **Dashboard Updates** - Shows loan status (pending/accepted/rejected)
6. **Totals Calculation** - Only counts accepted loans

## Database Setup

Run this SQL in Supabase to add the `status` column:

```sql
-- Add status column to loans table
alter table public.loans 
add column if not exists status text default 'pending';

-- Add constraint to ensure valid status values
alter table public.loans 
add constraint loans_status_check 
check (status in ('pending', 'accepted', 'rejected'));

-- Update existing loans to 'accepted' (if any exist)
update public.loans 
set status = 'accepted' 
where status is null;
```

## How It Works

### Flow:
1. **Owner adds loan** → Status = "pending"
2. **Partner visits `/loans`** → Sees all pending loans sent to them
3. **Partner accepts/rejects** → Status changes to "accepted" or "rejected"
4. **On-chain recording** → Only happens when partner accepts (future: we'll add this)
5. **Dashboard shows status** → Owner sees pending/accepted/rejected badges

### Pages:
- **`/dashboard`** - Owner's view: shows all loans with status badges
- **`/loans`** - Partner's view: shows pending loans they need to accept/reject

### Status Badges:
- 🟡 **Pending** - Waiting for partner acceptance
- 🟢 **Accepted** - Partner accepted, loan is active
- 🔴 **Rejected** - Partner rejected the loan

## Next Steps (Future Enhancement)

When partner accepts, we can:
- Record the loan on-chain (Base Sepolia)
- Store transaction hash
- Show it in the loan details

For now, acceptance just updates the status in the database.

