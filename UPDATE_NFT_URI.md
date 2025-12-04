# How to Update NFT Contract Base URI After Vercel Deployment

## The Problem
When you deployed your NFT contract on Remix, you used a local URL like `http://localhost:3000/api/nft/metadata`. This won't work in production because localhost is only accessible on your local machine.

## The Solution
Your NFT contract has a `setBaseTokenURI()` function that allows you to update the base URI after deployment. Here's how to do it:

## Step 1: Deploy to Vercel First

1. **Deploy your Next.js app to Vercel:**
   ```bash
   # If you haven't already, install Vercel CLI
   npm i -g vercel
   
   # Deploy
   vercel
   ```
   
   Or use the Vercel dashboard:
   - Go to https://vercel.com
   - Import your GitHub repository
   - Add all environment variables from `.env.local`
   - Deploy

2. **Get your Vercel URL:**
   - After deployment, you'll get a URL like: `https://your-app.vercel.app`
   - Your metadata endpoint will be: `https://your-app.vercel.app/api/nft/metadata`

## Step 2: Update the Contract Base URI

You have two options:

### Option A: Using Remix (Easiest)

1. **Go to Remix:**
   - Open https://remix.ethereum.org
   - Make sure you're connected to **Base Sepolia** testnet

2. **Load your deployed contract:**
   - In the "Deploy & Run Transactions" tab
   - Under "Deployed Contracts", find your NFT contract
   - If you don't see it, paste your contract address in the "At Address" field

3. **Call `setBaseTokenURI`:**
   - Expand your contract in the "Deployed Contracts" section
   - Find the `setBaseTokenURI` function
   - Enter your new Vercel URL: `https://your-app.vercel.app/api/nft/metadata`
   - Click "transact"
   - Confirm the transaction in MetaMask

### Option B: Using a Script (More Advanced)

Create a script to update the URI programmatically:

```javascript
// update-nft-uri.js
const { createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');

const NFT_CONTRACT_ADDRESS = '0xYourNFTContractAddress';
const NEW_BASE_URI = 'https://your-app.vercel.app/api/nft/metadata';
const OWNER_PRIVATE_KEY = process.env.NFT_MINTER_PRIVATE_KEY;

const account = privateKeyToAccount(OWNER_PRIVATE_KEY);

const client = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http('https://sepolia.base.org')
});

async function updateBaseURI() {
  const hash = await client.writeContract({
    address: NFT_CONTRACT_ADDRESS,
    abi: [{
      name: 'setBaseTokenURI',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'newBaseTokenURI', type: 'string' }],
      outputs: []
    }],
    functionName: 'setBaseTokenURI',
    args: [NEW_BASE_URI]
  });
  
  console.log('Transaction hash:', hash);
  console.log('View on BaseScan:', `https://sepolia.basescan.org/tx/${hash}`);
}

updateBaseURI();
```

## Step 3: Update Environment Variables on Vercel

After deploying to Vercel, make sure to add/update these environment variables in Vercel dashboard:

```bash
# Your Vercel URL (important!)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# NFT Contract Address (should already be set)
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0xYourNFTContractAddress

# Private key for minting (keep secure!)
NFT_MINTER_PRIVATE_KEY=0xYourPrivateKey

# Other existing variables...
NEXT_PUBLIC_LOAN_LEDGER_CONTRACT=0xYourLoanLedgerAddress
NEXT_PUBLIC_PKR_TO_ETH_RATE=0.000003
NEXT_PUBLIC_ONCHAINKIT_API_KEY=your_key
# ... etc
```

## Step 4: Verify It Works

1. **Check the contract:**
   - Go to https://sepolia.basescan.org
   - Search for your NFT contract address
   - Go to "Contract" → "Read Contract"
   - Call `baseTokenURI()` - it should show your Vercel URL

2. **Test NFT metadata:**
   - Visit: `https://your-app.vercel.app/api/nft/metadata/1`
   - You should see JSON metadata for token ID 1
   - If you get an error, check that the contract was updated correctly

## Important Notes

⚠️ **Important:**
- Only the contract **owner** can call `setBaseTokenURI()`
- Make sure you're using the same wallet that deployed the contract
- The new URI will apply to **all future NFTs** minted after the update
- **Existing NFTs** that were already minted will still have the old URI (unless you update them individually)

✅ **Good news:**
- You don't need to redeploy the contract
- The update is instant (one transaction)
- Future NFTs will use the new Vercel URL automatically

## Troubleshooting

**"Only owner can call this function" error:**
- Make sure you're using the wallet that deployed the contract
- Check that you're connected to the correct network (Base Sepolia)

**Metadata not loading:**
- Verify the Vercel URL is correct
- Make sure your Vercel deployment is live
- Check that the `/api/nft/metadata/[tokenId]` route is working

**Transaction fails:**
- Make sure you have Base Sepolia ETH for gas
- Check that the contract address is correct
- Verify you're on the Base Sepolia network

