# Token Management Setup Guide

This guide explains how to set up and use the Token Management feature in the Spinloot Dashboard.

## Overview

The Token Management feature allows admins to dynamically add, edit, and manage tokens for deposit and withdrawal without code changes. Tokens are stored in Supabase and automatically loaded in the frontend.

## Setup Instructions

### 1. Database Setup

Run the SQL script in `TOKENS_SCHEMA.sql` in your Supabase SQL Editor:

```bash
# Access your Supabase dashboard
# Go to SQL Editor
# Copy and paste the contents of TOKENS_SCHEMA.sql
# Execute the script
```

This will create:
- `tokens` table - stores token configurations
- Necessary indexes and triggers
- Row Level Security (RLS) policies
- Default tokens (SOL, USDC, TOKEN4)

### 2. Access Token Management

1. Log in to the master dashboard
2. Navigate to **Settings** → **Token Management**
3. You'll see a list of all active tokens

## Features

### Add New Token

1. Click **"+ Add New Token"** button
2. Fill in the form:
   - **Token Key**: Unique identifier (e.g., "USDT", "BONK") - uppercase, cannot be changed after creation
   - **Display Name**: User-friendly name (e.g., "Tether", "Bonk")
   - **Symbol**: Token symbol (e.g., "USDT", "BONK")
   - **Mint Address**: Solana token mint address
   - **Decimals**: Token decimals (usually 6 or 9)
   - **CoinGecko ID**: CoinGecko API ID for price fetching (optional)
   - **Fallback Price**: USD price if CoinGecko unavailable
   - **Display Order**: Order in dropdown (lower = first)
   - **Active**: Whether token is available for deposit/withdraw
3. Click **"Add Token"**

### Edit Token

1. Click **"Edit"** next to any token
2. Modify the fields (Key cannot be changed)
3. Click **"Update Token"**

### Delete Token

1. Click **"Delete"** next to any token
2. Confirm deletion
3. Token will be removed from deposit/withdraw options

### Toggle Active Status

1. Click the status badge (Active/Inactive)
2. Token will be enabled/disabled for deposit/withdraw

## Token Configuration

### Required Fields

- **Key**: Must be unique, uppercase, alphanumeric
- **Name**: Display name shown to users
- **Symbol**: Token symbol (usually 3-5 characters)
- **Mint Address**: Valid Solana token mint address
- **Decimals**: Token decimals (0-18)

### Optional Fields

- **CoinGecko ID**: For real-time price fetching
  - Find IDs at: https://www.coingecko.com/en/api
  - Example: "usd-coin" for USDC, "solana" for SOL
- **Fallback Price**: Used when CoinGecko price unavailable
- **Display Order**: Controls dropdown order

## How It Works

1. **Database Storage**: Tokens are stored in Supabase `tokens` table
2. **Frontend Loading**: Purchase.tsx and Withdraw.tsx load tokens from database on mount
3. **Price Service**: CoinGecko IDs are loaded dynamically for price fetching
4. **Fallback**: If database fails, system falls back to config tokens

## Example: Adding USDT

1. Go to Token Management
2. Click "+ Add New Token"
3. Fill in:
   - Key: `USDT`
   - Name: `Tether`
   - Symbol: `USDT`
   - Mint Address: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`
   - Decimals: `6`
   - CoinGecko ID: `tether`
   - Fallback Price: `1`
   - Display Order: `4`
   - Active: ✓
4. Click "Add Token"
5. USDT will immediately appear in deposit/withdraw dropdowns

## Notes

- **OGX Token**: Not included in token management (base token, handled separately)
- **SOL Token**: Special handling for wrapped SOL, but can be managed here
- **Active Status**: Inactive tokens won't appear in dropdowns
- **Display Order**: Lower numbers appear first in dropdown
- **CoinGecko**: If token is not on CoinGecko, leave ID empty and set fallback price

## Troubleshooting

### Token not appearing in dropdown
- Check if token is marked as "Active"
- Verify database connection
- Check browser console for errors

### Price not updating
- Verify CoinGecko ID is correct
- Check if token is listed on CoinGecko
- Fallback price will be used if CoinGecko unavailable

### Deposit/Withdraw not working
- Verify mint address is correct
- Check token decimals match actual token
- Ensure admin wallet has token balance (for withdrawals)


