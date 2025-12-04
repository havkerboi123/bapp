# Deploying NFT Contract for Vercel

Now that you have a public Vercel URL, you have two options:

## Option 1: Update Existing Contract (If Already Deployed)

If you already deployed your NFT contract with a localhost URL, you can update it without redeploying:

### Using the Script (Easiest)

1. **Your Vercel URL:**
   ```bash
   https://khitab.vercel.app
   ```

2. **Set your environment variables (if not already set):**
   ```bash
   export NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0xYourContractAddress
   export NFT_MINTER_PRIVATE_KEY=0xYourPrivateKey
   ```

3. **Run the update script:**
   ```bash
   npx tsx scripts/update-nft-uri.ts https://khitab.vercel.app
   ```

   The script will:
   - Show current base URI
   - Update to your Vercel URL
   - Wait for confirmation
   - Verify the update

### Using Remix (Alternative)

1. Go to https://remix.ethereum.org
2. Connect to **Base Sepolia** testnet
3. Load your deployed contract (paste address in "At Address")
4. Call `setBaseTokenURI` with: `https://khitab.vercel.app/api/nft/metadata`
5. Confirm transaction in MetaMask

## Option 2: Deploy New Contract (If Not Deployed Yet)

If you haven't deployed the NFT contract yet, deploy it directly with your Vercel URL:

1. **Go to Remix:**
   - https://remix.ethereum.org
   - Make sure you're on **Base Sepolia** testnet

2. **Deploy the contract:**
   - In the deploy section, provide:
     - `initialOwner`: Your wallet address
     - `baseTokenURI`: `https://khitab.vercel.app/api/nft/metadata`
   - Click "Deploy"
   - Copy the contract address

3. **Update environment variables:**
   - Add `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS` to your Vercel environment variables
   - Add `NFT_MINTER_PRIVATE_KEY` to your Vercel environment variables (keep it secret!)

## Important: Update Vercel Environment Variables

After deploying/updating, make sure these are set in Vercel:

```bash
# Your Vercel URL (important for metadata links)
NEXT_PUBLIC_APP_URL=https://khitab.vercel.app

# NFT Contract Address
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0xYourContractAddress

# Private key of contract owner (for minting)
NFT_MINTER_PRIVATE_KEY=0xYourPrivateKey

# Other required variables...
NEXT_PUBLIC_LOAN_LEDGER_CONTRACT=0xYourLoanLedgerAddress
NEXT_PUBLIC_PKR_TO_ETH_RATE=0.000003
# ... etc
```

## Verify It Works

1. **Check the contract base URI:**
   - Go to https://sepolia.basescan.org
   - Search for your NFT contract
   - Go to "Contract" → "Read Contract"
   - Call `baseTokenURI()` - should show your Vercel URL

2. **Test metadata endpoint:**
   - Visit: `https://khitab.vercel.app/api/nft/metadata/1`
   - Should return JSON metadata (even if token doesn't exist yet, the endpoint should work)

## Notes

- ✅ You don't need to redeploy if you already deployed - just update the base URI
- ✅ Future NFTs will automatically use the new Vercel URL
- ⚠️ Only the contract owner can update the base URI
- ⚠️ Make sure `NFT_MINTER_PRIVATE_KEY` matches the contract owner address

