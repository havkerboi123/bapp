# On-Chain Loan Recording Setup

## Summary
Every loan added in the dashboard is now recorded on **Base Sepolia testnet** for permanent, tamper-proof proof. Each loan gets a transaction hash that users can verify on Base Sepolia explorer.

## What's Done ✅

1. **Smart Contract Created** (`contracts/LoanLedger.sol`)
   - Records loans on-chain with owner, partner, amount, dates, description
   - Emits events for easy querying

2. **Database Updated**
   - Loans table now stores `tx_hash` column
   - Partners API returns wallet addresses

3. **Dashboard Updated**
   - Shows transaction hash for each loan
   - Clickable link to Base Sepolia explorer
   - On-chain recording integrated

4. **Network Changed to Base Sepolia**
   - App now uses Base Sepolia testnet (not mainnet)

## Database Setup

Run this SQL in Supabase to add the `tx_hash` column:

```sql
-- Add tx_hash column to loans table
alter table public.loans 
add column if not exists tx_hash text;

-- Add index for faster lookups
create index if not exists loans_tx_hash_idx on public.loans(tx_hash);
```

## Contract Deployment (Next Step)

1. **Deploy the contract to Base Sepolia:**
   - Use Remix, Hardhat, or Foundry
   - Deploy `contracts/LoanLedger.sol` to Base Sepolia
   - Copy the deployed contract address

2. **Add contract address to `.env.local`:**
   ```bash
   NEXT_PUBLIC_LOAN_LEDGER_CONTRACT=0xYourDeployedContractAddress
   ```

3. **Test it:**
   - Add a loan in the dashboard
   - It will automatically record on-chain
   - Transaction hash will appear in the loan list
   - Click the hash to view on Base Sepolia explorer

## How It Works

1. User adds a loan → Dashboard calls `recordLoanOnChain()`
2. Transaction is sent to Base Sepolia → User signs in wallet
3. Transaction hash is received → Saved to database
4. Loan appears in list → With clickable Base Sepolia explorer link

## Base Sepolia Explorer

All transaction hashes link to:
`https://sepolia.basescan.org/tx/{txHash}`

Users can click any loan's transaction hash to verify it on-chain!

