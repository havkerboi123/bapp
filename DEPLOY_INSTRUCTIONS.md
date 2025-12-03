# Deploy LoanLedger Contract to Base Sepolia

## Step 1: Open Remix
1. Go to https://remix.ethereum.org
2. Create a new file called `LoanLedger.sol` in the `contracts` folder

## Step 2: Copy the Contract Code
Copy the entire contract code from `contracts/LoanLedger.sol` into Remix

## Step 3: Compile
1. Go to the "Solidity Compiler" tab (left sidebar)
2. Set compiler version to `0.8.20` or higher
3. Click "Compile LoanLedger.sol"
4. Make sure there are no errors

## Step 4: Deploy
1. Go to the "Deploy & Run Transactions" tab
2. Select "Injected Provider - MetaMask" as the environment
3. Make sure your MetaMask is connected to **Base Sepolia** testnet
   - If not, add Base Sepolia network:
     - Network Name: Base Sepolia
     - RPC URL: https://sepolia.base.org
     - Chain ID: 84532
     - Currency Symbol: ETH
     - Block Explorer: https://sepolia.basescan.org
4. Make sure you have some Base Sepolia ETH for gas fees
   - Get testnet ETH from: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
5. Select "LoanLedger" from the contract dropdown
6. Click "Deploy"
7. Confirm the transaction in MetaMask

## Step 5: Get Contract Address
1. After deployment, the contract address will appear in the "Deployed Contracts" section
2. Copy the contract address (it starts with `0x...`)

## Step 6: Add to Your App
1. Open your `.env.local` file
2. Add or update:
   ```
   NEXT_PUBLIC_LOAN_LEDGER_CONTRACT=0xYourContractAddressHere
   ```
3. Replace `0xYourContractAddressHere` with the actual contract address from Remix
4. Restart your Next.js dev server (`npm run dev`)

## Step 7: Test
1. Go to your dashboard
2. Accept a loan (or wait for one to be accepted)
3. You should see a MetaMask popup asking to sign the transaction
4. After confirmation, the transaction hash will appear next to the loan!

## Need Testnet ETH?
- Base Sepolia Faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
- Or use the official Base faucet if available

## Verify on Base Sepolia Explorer
After deployment, you can view your contract at:
`https://sepolia.basescan.org/address/YOUR_CONTRACT_ADDRESS`

