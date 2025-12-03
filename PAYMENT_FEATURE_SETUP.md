# Payment Feature Setup

## Summary
Added complete payment functionality to the loan system. Partners can now pay back their loans on-chain via Base Sepolia testnet.

## What's Been Implemented ✅

### 1. Database Schema Updates
- Added `owner_wallet_address` and `partner_wallet_address` columns to loans table
- Added `onchain_loan_id` column to store the bytes32 loan ID from the smart contract
- Added `paid_back_date` column to track when loans are paid
- Updated status constraint to include "waiting on payment" and "paid back"

### 2. Smart Contract Updates
- Added `payLoan(bytes32 loanId)` function that:
  - Accepts loan ID and exact payment amount
  - Verifies caller is the partner
  - Transfers funds from partner to owner
  - Marks loan as paid
  - Emits `LoanPaid` event
- Added `isLoanPaid(bytes32 loanId)` view function to check payment status

### 3. API Updates
- **Loan Creation**: Now stores wallet addresses when creating loans
- **Loan Acceptance**: Stores wallet addresses when partner accepts
- **Update TX**: Now stores on-chain loan ID and changes status to "waiting on payment" after recording
- **Payment Endpoint** (`/api/loans/pay`):
  - GET: Returns loan details needed for payment
  - POST: Updates loan to "paid back" status after payment confirmation

### 4. Frontend Updates
- **Dashboard**: Shows new statuses ("waiting on payment", "paid back") with appropriate badges
- **Loans Page**: 
  - Shows pending loans (for acceptance)
  - Shows payment loans (for payment)
  - Payment button that calls smart contract
  - Handles payment confirmation and status updates

## Database Migration

**IMPORTANT**: Run this SQL in Supabase SQL Editor:

```sql
-- See MIGRATION_ADD_PAYMENT_FEATURES.sql for the complete migration script
```

Or run the migration file: `MIGRATION_ADD_PAYMENT_FEATURES.sql`

## How It Works

### Flow:
1. **Owner creates loan** → Status = "pending", wallet addresses stored
2. **Partner accepts loan** → Status = "accepted", wallet addresses updated
3. **Owner records on-chain** → Status = "waiting on payment", on-chain loan ID stored
4. **Partner pays loan** → Calls `payLoan()` on smart contract with loan ID
5. **Payment confirmed** → Status = "paid back", `paid_back_date` set

### Status Flow:
- `pending` → `accepted` → `waiting on payment` → `paid back`
- Can also go: `pending` → `rejected` (stops here)

### Smart Contract Payment:
- Partner must be on Base Sepolia (Chain ID: 84532)
- Partner calls `payLoan(loanId)` with exact amount in wei
- Contract verifies:
  - Loan exists
  - Caller is the partner
  - Loan hasn't been paid
  - Payment amount matches loan amount exactly
- Funds are transferred from partner to owner
- Loan is marked as paid on-chain

## Testing Checklist

1. ✅ Run database migration
2. ✅ Deploy updated smart contract to Base Sepolia
3. ✅ Update contract address in `.env.local` if needed
4. ✅ Test loan creation (wallet addresses should be stored)
5. ✅ Test loan acceptance (wallet addresses should be updated)
6. ✅ Test on-chain recording (status should change to "waiting on payment")
7. ✅ Test payment flow (partner should be able to pay)
8. ✅ Verify payment updates status to "paid back"

## Notes

- The on-chain loan ID (bytes32) is extracted from the `LoanRecorded` event in the transaction receipt
- Payment amount must match exactly (no interest/fees currently)
- Partners need Base Sepolia ETH to pay loans
- All wallet addresses are normalized (lowercase with 0x prefix)

