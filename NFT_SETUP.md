# NFT Achievement Setup Guide

## Summary
When a partner pays back a loan, they automatically receive a cool achievement NFT as a reward! 🎉

## What's Been Implemented ✅

1. **NFT Smart Contract** (`contracts/LoanAchievementNFT.sol`)
   - ERC-721 compliant NFT contract
   - Mints achievement NFTs when loans are paid back
   - Prevents duplicate minting for the same loan
   - Tracks loan-to-NFT mappings

2. **NFT Minting API** (`app/api/nft/mint/route.ts`)
   - Server-side endpoint to mint NFTs
   - Checks for existing NFTs before minting
   - Returns token ID and transaction hash

3. **Payment Integration**
   - Automatically mints NFT after loan payment is confirmed
   - Integrated into `/api/loans/pay` POST endpoint
   - NFT minting failure doesn't block payment completion

## Step 1: Install OpenZeppelin Contracts (for Remix)

The NFT contract uses OpenZeppelin contracts. In Remix:

1. Go to https://remix.ethereum.org
2. In the file explorer, you'll see a `node_modules` folder
3. Open the terminal in Remix and run:
   ```
   npm install @openzeppelin/contracts
   ```

Or use the Remix import feature:
- The contract uses `@openzeppelin/contracts/token/ERC721/ERC721.sol`
- Remix should automatically resolve these imports if you have the npm package installed

## Step 2: Deploy NFT Contract to Base Sepolia

1. **Open Remix**
   - Go to https://remix.ethereum.org
   - Create a new file `LoanAchievementNFT.sol` in the `contracts` folder
   - Copy the entire contract code from `contracts/LoanAchievementNFT.sol`

2. **Compile**
   - Go to "Solidity Compiler" tab
   - Set compiler version to `0.8.20` or higher
   - Click "Compile LoanAchievementNFT.sol"
   - Make sure there are no errors

3. **Deploy**
   - Go to "Deploy & Run Transactions" tab
   - Select "Injected Provider - MetaMask"
   - Make sure MetaMask is connected to **Base Sepolia** testnet
   - Make sure you have Base Sepolia ETH for gas fees
   - In the deploy section, you'll need to provide:
     - `initialOwner`: Your wallet address (the one that will mint NFTs)
     - `baseTokenURI`: Base URL for NFT metadata
       - For local dev: `"http://localhost:3000/api/nft/metadata"`
       - For production: `"https://your-domain.com/api/nft/metadata"`
       - The contract will append `/tokenId` automatically
   - Click "Deploy"
   - Confirm the transaction in MetaMask

4. **Get Contract Address**
   - After deployment, copy the contract address (starts with `0x...`)

## Step 3: Configure Environment Variables

Add these to your `.env.local` file:

```bash
# NFT Contract Address (from Step 2)
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0xYourNFTContractAddressHere

# Private key of the wallet that owns the NFT contract (for minting)
# IMPORTANT: This should be the same address you used as initialOwner when deploying
# NEVER commit this to git! Keep it secure.
NFT_MINTER_PRIVATE_KEY=0xYourPrivateKeyHere

# Base URL for your app (used for internal API calls)
# For local development: http://localhost:3000
# For production: https://your-domain.com
NEXT_PUBLIC_APP_URL=http://localhost:3000

# PKR to ETH rate (should already exist)
NEXT_PUBLIC_PKR_TO_ETH_RATE=0.000003
```

⚠️ **Security Note**: The `NFT_MINTER_PRIVATE_KEY` should be:
- The private key of the wallet that deployed the NFT contract (the owner)
- Stored securely and never committed to git
- Only used server-side (never exposed to the frontend)

## Step 4: NFT Metadata (Already Set Up! ✅)

The NFT metadata endpoint is already created at `/app/api/nft/metadata/[tokenId]/route.ts`!

**What it does:**
- Returns ERC-721 compliant JSON metadata
- Includes a cool SVG image with loan details
- Shows loan amount, dates, and other attributes
- Automatically generates unique images for each NFT

**The metadata includes:**
- Name: "Loan Repayment Achievement #X"
- Description with loan amount
- SVG image (generated dynamically)
- Attributes: loan amount, dates, addresses, etc.

**Note:** When deploying the contract, make sure the `baseTokenURI` points to your metadata endpoint:
- Local: `http://localhost:3000/api/nft/metadata`
- Production: `https://your-domain.com/api/nft/metadata`

**To update base URI later** (if you change domains):
- Call `setBaseTokenURI()` function on the deployed contract
- Use the owner wallet to call this function

## Step 5: Test the Feature

1. **Start your Next.js server:**
   ```bash
   npm run dev
   ```

2. **Test the flow:**
   - Create a loan in the dashboard
   - Have a partner accept the loan
   - Record the loan on-chain
   - Have the partner pay back the loan
   - Check the console logs - you should see:
     ```
     🎉 Achievement NFT minted successfully!
     NFT Token ID: 1
     ```

3. **Verify NFT on Base Sepolia Explorer:**
   - Go to https://sepolia.basescan.org
   - Search for your NFT contract address
   - View the "Token" tab to see minted NFTs
   - Or check the partner's wallet on a block explorer

## How It Works

### Flow:
1. **Partner pays loan** → Payment transaction confirmed on-chain
2. **Payment API called** → `/api/loans/pay` POST endpoint
3. **Loan status updated** → Status changed to "paid back"
4. **NFT minting triggered** → Calls `/api/nft/mint` endpoint
5. **NFT minted** → Achievement NFT sent to partner's wallet
6. **Response returned** → Includes NFT token ID and transaction hash

### NFT Details:
- **Name**: "Loan Repayment Achievement"
- **Symbol**: "LRA"
- **Recipient**: Partner who paid back the loan
- **Uniqueness**: One NFT per loan (prevents duplicates)
- **Metadata**: Can include loan amount, date, description, etc.

## Troubleshooting

### NFT Minting Fails
- Check that `NFT_MINTER_PRIVATE_KEY` is set correctly
- Verify the private key corresponds to the contract owner
- Ensure the owner wallet has Base Sepolia ETH for gas
- Check that `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS` is correct

### "NFT already minted" Error
- This is expected if an NFT was already minted for this loan
- The system prevents duplicate minting

### Contract Compilation Errors in Remix
- Make sure OpenZeppelin contracts are installed
- Check that compiler version is 0.8.20 or higher
- Verify all imports are correct

## Next Steps (Optional Enhancements)

1. **Add NFT metadata endpoint** for rich NFT data
2. **Create NFT gallery page** to display user's achievement NFTs
3. **Add NFT images** with dynamic SVG generation
4. **Add rarity levels** based on loan amount or other factors
5. **Add NFT marketplace integration** (OpenSea, etc.)

## Security Considerations

- ✅ Private key is only used server-side
- ✅ NFT minting failure doesn't block payment
- ✅ Duplicate minting is prevented on-chain
- ⚠️ Keep `NFT_MINTER_PRIVATE_KEY` secure and never commit to git
- ⚠️ Consider using a dedicated wallet for minting (not your main wallet)

