---
name: algorand-mcp-lite
description: >
  Comprehensive guide for interacting with Algorand blockchain via Algorand Remote MCP Lite (Wallet Edition) —
  a managed MCP server with 59 tools for wallet operations, ALGO/ASA transactions, atomic groups, account queries,
  NFD lookups, Haystack Router DEX-aggregated swaps, Alpha Arcade prediction markets, Pera asset verification,
  ARC-26 QR codes, transaction receipts, AP2 payment mandates, and rich structured-data UI widgets.
  Use this skill whenever working with Algorand Remote MCP Lite tools, building agents that interact with Algorand
  via MCP, querying Algorand accounts/assets/transactions, sending payments, swapping tokens, trading prediction
  markets, generating payment QR codes or receipts, or managing an MCP-based Algorand wallet. Also use when the
  user mentions "Algorand MCP", "wallet edition", "remote MCP lite", Haystack Router swaps, Alpha Arcade markets,
  or any on-chain Algorand operation through MCP tools.
---

# Algorand Remote MCP Lite (Wallet Edition)

This skill defines capabilities, workflows, and best practices for interacting with the Algorand blockchain using Algorand Remote MCP Lite (Wallet Edition). The server provides 55 MCP tools for wallet management, transactions, blockchain queries, DEX swaps, prediction markets, and more — all with server-side signing via HashiCorp Vault.

---

## Response Handling — MCP Apps UI Widgets

Algorand Remote MCP Lite uses the MCP Apps SDK (`@modelcontextprotocol/ext-apps`) to register tools with interactive UI widgets via `registerAppTool()`. Widget resources are registered via `registerAppResource()`.

### How it works

- **55 tools** are registered as App tools with `_meta.ui.resourceUri` linking each tool to an HTML widget resource.
- Each tool returns both `content` (text fallback) and `structuredContent` (typed data for the widget).
- The host detects `_meta.ui.resourceUri` on the tool and renders the widget inline — **the widget IS the complete response**.
- 4 plain utility tools (`sdk_encode_address`, `sdk_decode_address`, `algorand_mcp_skill`, `haystack_needs_optin`) have no UI and return text only.

### Agent behavior rules

1. **When the host supports MCP Apps UI**: The widget renders inline as the complete response. Do NOT repeat, reformat, or summarize the `content` text — the user already sees the widget. Simply confirm the action succeeded.
2. **For text-only clients**: The host shows the `content` text fallback automatically. No special agent handling is needed.
3. If the user explicitly asks for raw data, display the `content` text.

---

## Security Rules

1. **Mainnet Warning**: All operations use real assets with real value. Exercise extreme caution.
2. **Transaction Verification**: Always verify parameters before submission. Mainnet transactions are irreversible.
3. **Double-Check Recipients**: Confirm addresses with user before sending.
4. **Simulation**: Simulate critical transactions before submitting when possible.
5. **Wallet Reset**: `wallet_reset_account` is destructive — all funds and assets will be permanently lost. Always transfer funds first and warn the user.
6. **Signing**: Server-side signing via HashiCorp Vault — never request private keys or mnemonics unless the user explicitly asks.
7. **Wallet Role UUID**: Retrieved only via `wallet_get_role` — this is sensitive information. Always warn users to protect it and never share it.
8. **Asset Verification**: Check `pera_verified_asset_query` before interacting with unknown assets. Warn about suspicious/unverified tiers.
9. **Spending Limits**: If a transaction is rejected due to wallet limits, inform the user rather than bypassing.

---

## Pagination

All API tools accept optional `itemsPerPage` (default 10) and `pageToken` parameters. Pass `pageToken` from a previous response to fetch the next page.

---

## Best Practices

1. **Always start with `wallet_get_info`** — verify wallet before any blockchain operation.
2. **Check balances before transactions** — include MBR and fees in calculations.
3. **Verify asset opt-in** before any asset transfer.
4. **Use `depositAccount`** from NFD responses for transactions, never other address fields.
5. **Handle ALGO funding first** when both ALGO and asset top-ups are needed.
6. **Prefer Haystack Router for swaps** — it finds the best price across multiple DEXes automatically.
7. **Verify recipients** — use `sdk_validate_address` to confirm addresses before sending.
8. **Simulate critical transactions** before submitting to catch errors without spending funds.

---

## Complete Tool Reference (59 tools — 55 App tools with UI widgets, 4 plain text-only tools)

### 1. Wallet Management (4 tools)

| Tool | Purpose |
|------|---------|
| `wallet_get_info` | Get wallet account info (address, publicKey, balance, assets) — always call first |
| `wallet_get_assets` | Get all asset holdings for the wallet |
| `wallet_get_role` | Get wallet user role UUID (sensitive!) |
| `wallet_reset_account` | Reset/recreate wallet account (DESTRUCTIVE — warn user!) |

### 2. Account (1 tool)

| Tool | Purpose |
|------|---------|
| `sdk_check_account_balance` | Check ALGO balance of an Algorand account |

### 3. Transactions (4 tools)

| Tool | Purpose |
|------|---------|
| `sdk_txn_payment_transaction` | Create an ALGO payment transaction |
| `wallet_sign_transaction` | Sign a transaction with the agent wallet (via Vault) |
| `sdk_submit_transaction` | Submit a signed transaction to the network |
| `sdk_send_raw_transaction` | Submit raw signed transaction bytes to the network |

### 4. Asset Transactions (4 tools)

| Tool | Purpose |
|------|---------|
| `sdk_txn_asset_create` | Create a new Algorand Standard Asset (ASA) |
| `sdk_txn_asset_optin` | Opt-in to an ASA |
| `sdk_txn_asset_transfer` | Transfer an ASA |
| `wallet_usdc_optin` | One-step USDC opt-in (builds, signs, submits) |

#### Key Transaction Parameters

**`sdk_txn_payment_transaction`:**
```
{
  from: "sender_address",
  to: "receiver_address",
  amount: 1000000,          // microAlgos (1 ALGO = 1,000,000)
  note: "optional note",
  fee: 1000,                // Optional, default 1000 (minimum fee)
  flatFee: false,           // Optional, if true use fee exactly as specified
  closeRemainderTo: "...",  // Optional, close account and send remainder
  rekeyTo: "...",           // Optional, rekey account
  network: "mainnet"
}
```

**`sdk_txn_asset_transfer`:**
```
{
  from: "sender_address",
  to: "receiver_address",
  assetIndex: 31566704,     // ASA ID
  amount: 1000000,          // Amount in base units
  fee: 1000,                // Optional
  flatFee: false,           // Optional
  closeRemainderTo: "...",  // Optional, close asset holding
  network: "mainnet"
}
```

**`sdk_txn_asset_create`:**
```
{
  from: "[creator_address]",
  total: 1000000000,       // Total supply in base units
  decimals: 6,
  defaultFrozen: false,
  unitName: "MYT",
  assetName: "My Token",
  assetURL: "https://example.com/my-token",
  manager: "[creator_address]",
  reserve: "[creator_address]",
  freeze: "[creator_address]",
  clawback: "[creator_address]",
  network: "mainnet"
}
```

### 5. Atomic Groups (5 tools)

| Tool | Purpose |
|------|---------|
| `sdk_assign_group_id` | Assign group ID to transactions for atomic execution |
| `sdk_create_atomic_group` | Create an atomic transaction group from multiple transactions |
| `sdk_sign_atomic_group` | Sign an atomic transaction group (SDK-level) |
| `wallet_sign_atomic_group` | Sign an atomic transaction group (via wallet/Vault) |
| `sdk_submit_atomic_group` | Submit a signed atomic group to the network |

### 6. Blockchain Queries — Algod (4 tools)

| Tool | Purpose |
|------|---------|
| `algod_get_account_info` | Get live account state (balance, assets, apps) |
| `algod_get_account_asset_info` | Check specific asset holding for an account |
| `algod_get_asset_info` | Get asset details (name, decimals, supply, creator) |
| `algod_get_pending_txn_info` | Check pending transaction status |

### 7. Pera Asset Verification (2 tools)

| Tool | Purpose |
|------|---------|
| `pera_verified_asset_query` | Get asset details and verification status from Pera |
| `pera_verified_assets_search` | Search Pera verified assets by name |

Verification tiers: `verified` (highest), `trusted`, `suspicious` (warn user!), `unverified`.

### 8. Blockchain Queries — Indexer (7 tools)

| Tool | Purpose |
|------|---------|
| `indexer_search` | General search for accounts, transactions, assets, applications |
| `indexer_search_for_accounts` | Search for accounts with specific criteria |
| `indexer_search_for_assets` | Search for assets with specific criteria |
| `indexer_lookup_account_assets` | Look up assets held by an account |
| `indexer_lookup_account_transactions` | Look up transaction history for an account |
| `indexer_lookup_asset_balances` | Look up accounts holding a specific asset |
| `indexer_lookup_transaction_by_id` | Look up transaction details by ID |

### 9. NFDomains — .algo Names (2 tools)

| Tool | Purpose |
|------|---------|
| `api_nfd_get_nfd` | Look up NFD by name (e.g., "example.algo") |
| `api_nfd_get_nfds_for_address` | Get NFDs owned by an address |

**CRITICAL**: When transacting with NFD addresses, always use the `depositAccount` field from the NFD response, never any other address field.

**NFD Lookup examples:**
```
// Look up an NFD name
api_nfd_get_nfd { nameOrID: "example.algo", view: "full", network: "mainnet" }
// Use depositAccount from response for transactions!

// Get NFDs owned by an address
api_nfd_get_nfds_for_address {
  address: "ALGO_ADDRESS",
  view: "brief",
  limit: 10,
  network: "mainnet"
}
```

### 10. Haystack Router — DEX Aggregator (3 tools)

Haystack Router aggregates quotes across Tinyman V2, Pact, Folks, and LST protocols (tALGO, xALGO) to find optimal swap routes. Supports multi-hop and parallel (combo) swaps.

| Tool | Purpose |
|------|---------|
| `haystack_get_swap_quote` | Get best-price swap quote across all DEXes — preview pricing, route, price impact |
| `haystack_execute_swap` | All-in-one: quote + sign via wallet + submit + confirm |
| `haystack_needs_optin` | Check if an address needs to opt into an asset before swapping |

**Parameters:**
```
haystack_get_swap_quote / haystack_execute_swap:
  fromASAID: 0,             // Input asset (0 = ALGO)
  toASAID: 31566704,        // Output asset (USDC)
  amount: 1000000,          // Amount in base units
  type: "fixed-input",      // or "fixed-output"
  slippage: 1,              // Execute only: % slippage tolerance
  address: "<address>",     // Optional, for opt-in detection
  maxGroupSize: 16,         // Optional
  maxDepth: 4,              // Optional
  note: "my swap",          // Execute only: optional text note
  network: "mainnet"

haystack_needs_optin:
  address: "<address>",
  assetId: 31566704,
  network: "mainnet"
  → Returns: { address, assetId, needsOptIn: true/false, network }
```

**Quote response fields:** expectedOutput, inputAmount, usdIn, usdOut, userPriceImpact, route, flattenedRoute, requiredAppOptIns, protocolFees

**Execute response fields:** status, confirmedRound, txIds, signer, nickname, quote details, summary (inputAmount, outputAmount, totalFees, transactionCount)

**Slippage guidance:**

| Pair Type | Recommended Slippage |
|-----------|---------------------|
| Stable pairs (ALGO/USDC) | 0.1–0.5% |
| Major ASA pairs | 0.5–1% |
| Volatile pairs | 1–3% |
| Low liquidity pairs | 3–5% |

Slippage is verified on the **final output** of the swap, not on individual hops.

### 11. Alpha Arcade — Prediction Markets (14 tools)

**Read tools:**

| Tool | Purpose |
|------|---------|
| `alpha_get_live_markets` | Fetch all live prediction markets |
| `alpha_get_reward_markets` | Fetch markets with liquidity rewards |
| `alpha_get_market` | Get full details for a single market |
| `alpha_get_orderbook` | Get on-chain orderbook for a market |
| `alpha_get_open_orders` | Get open orders for wallet on a market |
| `alpha_get_positions` | Get YES/NO token positions across markets |

**Trade tools:**

| Tool | Purpose |
|------|---------|
| `alpha_create_limit_order` | Place limit order at exact price |
| `alpha_create_market_order` | Place market order with auto-matching |
| `alpha_amend_order` | Modify existing unfilled order |
| `alpha_cancel_order` | Cancel an open order |
| `alpha_split_shares` | Split USDC into YES + NO tokens |
| `alpha_merge_shares` | Merge YES + NO tokens back into USDC |
| `alpha_claim` | Claim USDC from a resolved market |
| `alpha_propose_match` | Propose match between compatible orders |

### 12. ARC-26 URI & QR Code (1 tool)

| Tool | Purpose |
|------|---------|
| `generate_algorand_qrcode` | Generate ARC-26 Algorand URI and QR code for payment/transfer |

**Parameters:**
```
{
  address: "[wallet_address]",
  amount: 5000000,          // Required amount including MBR and fees
  asset: 31566704,          // Optional: ASA ID for token top-ups
  note: "Fund account"
}
→ Returns: URI string + UTF-8 text QR code
```

When displaying QR codes, paste the UTF-8 QR block inside a code block and show the URI string below it.

### 13. Transaction Receipts (1 tool)

| Tool | Purpose |
|------|---------|
| `generate_algorand_receipt` | Generate a transaction receipt with QR code |

### 14. AP2 Payment Mandates (1 tool)

| Tool | Purpose |
|------|---------|
| `generate_ap2_mandate` | Create AP2 intent/cart/payment mandate |

### 15. Blockchain Stats (1 tool)

| Tool | Purpose |
|------|---------|
| `api_get_algorand_weather` | Get Algorand chain weather/stats (TPS, block time, health) |

### 16. Utility Tools (4 tools)

| Tool | Purpose |
|------|---------|
| `sdk_validate_address` | Validate an Algorand address format |
| `sdk_encode_address` | Encode public key to Algorand address |
| `sdk_decode_address` | Decode Algorand address to public key bytes |
| `sdk_app_address_by_id` | Get escrow address for a given application ID |

### 17. Skill Resource (1 tool)

| Tool | Purpose |
|------|---------|
| `algorand_mcp_skill` | Returns this skill content for MCP usage guidance |

---

## Pre-Transaction Validation Checklist

Before ANY transaction, validate these requirements:

### 1. Minimum Balance Requirement (MBR)
- Base MBR: 0.1 ALGO to keep account active
- Each asset opt-in: +0.1 ALGO
- Each app opt-in: +0.1 ALGO
- Always include MBR in required funds calculation

### 2. Asset Opt-In Verification
- For asset transactions, check opt-in with `algod_get_account_asset_info`
- If not opted in, use `sdk_txn_asset_optin` → `wallet_sign_transaction` → `sdk_submit_transaction`
- For USDC specifically, use `wallet_usdc_optin` (one-step convenience)

### 3. Transaction Fees
- Every transaction costs 1000 microAlgos (0.001 ALGO)
- Add fee per transaction to total required funds
- For atomic groups: multiply fee by number of transactions in the group

### 4. Balance Check
- Always fetch current balance before signing/sending
- Verify: balance >= amount + fees + MBR

### 5. Insufficient Funds Recovery
- If ALGO or asset balance is insufficient, generate a top-up QR code using `generate_algorand_qrcode` with the wallet address and required amount
- Instruct user to scan with Pera Wallet to top up
- Always handle ALGO funding first, then asset transactions

---

## Transaction Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `Asset hasn't been opted in` | Missing opt-in | Opt in to asset first |
| `Overspend` | Fee + amount > balance | **STOP** — check balance, inform user (see below) |
| `Insufficient balance` | Not enough ALGO or ASA | **STOP** — check balance, inform user (see below) |
| `Spending limit exceeded` | Transaction exceeds wallet allowance | Inform user, adjust spending limits |
| `No active agent wallet configured` | Missing wallet | Inform user, retry wallet check |

> **CRITICAL — Overspend / Insufficient Balance**: If a transaction or swap fails due to overspending, insufficient balance, or negative balance errors, **DO NOT continue or retry**. Immediately call `wallet_get_info` to check the current balance, then inform the user of the shortfall (required amount vs. available balance including MBR and fees). Do not attempt alternative amounts or re-submit — wait for the user to fund the account or confirm next steps.

---

## Amounts and Decimals

All amounts in tool parameters are in **base units** (smallest denomination):

| Asset | ASA ID | Decimals | 1 Whole Token = | Example |
|-------|--------|----------|-----------------|---------|
| ALGO | native (0) | 6 | 1,000,000 microAlgos | 1 ALGO = `1000000` |
| USDC | 31566704 | 6 | 1,000,000 micro-units | 5 USDC = `5000000` |
| USDT | 312769 | 6 | 1,000,000 micro-units | 1 USDT = `1000000` |
| goETH | 386192725 | 8 | 100,000,000 base units | — |
| goBTC | 386195940 | 8 | 100,000,000 base units | — |
| Custom ASAs | varies | varies | Depends on `decimals` field | Check with `algod_get_asset_info` |

Always check an asset's `decimals` field with `algod_get_asset_info` before computing amounts for unfamiliar assets.

**Always verify asset IDs before transactions — scam tokens may use similar names.** Use `pera_verified_asset_query` to check verification tier.

---

## Common Workflows

### Send ALGO Payment
```
1. wallet_get_info → get sender address and balance
2. sdk_txn_payment_transaction → create payment transaction
3. wallet_sign_transaction → sign with wallet
4. sdk_submit_transaction → submit to network
5. indexer_lookup_transaction_by_id → verify result (optional)
```

### Asset Opt-In
```
Quick USDC opt-in:
1. wallet_get_info → verify wallet
2. wallet_usdc_optin → one-step (builds, signs, submits)

General asset opt-in:
1. wallet_get_info → verify wallet
2. sdk_txn_asset_optin → create opt-in transaction
3. wallet_sign_transaction → sign
4. sdk_submit_transaction → submit
```

### Asset Transfer
```
1. wallet_get_info → get sender address
2. pera_verified_asset_query → verify asset legitimacy (warn if suspicious)
3. algod_get_account_asset_info → check sender balance
4. algod_get_account_asset_info → verify recipient opted in
5. sdk_txn_asset_transfer → create transfer transaction
6. wallet_sign_transaction → sign with wallet
7. sdk_submit_transaction → submit to network
```

### Asset Opt-Out
```
1. Get asset info to find creator address
2. sdk_txn_asset_transfer with amount=0, receiver=creator, closeRemainderTo=creator
3. wallet_sign_transaction → sign
4. sdk_submit_transaction → submit
```

### Atomic Transaction Group
```
1. Create multiple transactions with sdk_txn_* tools
2. sdk_create_atomic_group → group them atomically (or sdk_assign_group_id)
3. wallet_sign_atomic_group → sign the group
4. sdk_submit_atomic_group → submit the group
```

### Create an ASA (Algorand Standard Asset)
```
1. wallet_get_info → verify wallet and balance
2. sdk_txn_asset_create → create asset with parameters
3. wallet_sign_transaction → sign
4. sdk_submit_transaction → submit
5. algod_get_pending_txn_info → get the new ASA ID from "asset-index" field
```

### Query Account Information
```
- Live state: algod_get_account_info
- Historical data: indexer_search_for_accounts or indexer_search
- Asset holdings: indexer_lookup_account_assets or wallet_get_assets
- Transaction history: indexer_lookup_account_transactions
```

### NFD Resolution for Transactions
```
1. api_nfd_get_nfd → look up the .algo name
2. Extract depositAccount from response
3. Use depositAccount as transaction recipient
```

### Top-Up QR Code (Insufficient Funds)
```
generate_algorand_qrcode {
  address: "[wallet_address]",
  amount: 5000000,          // Required amount including MBR and fees
  asset: 31566704,          // Optional: ASA ID for token top-ups
  note: "Fund account"
}
→ Returns URI string + UTF-8 QR code — user scans with Pera Wallet
```

---

## Swap Direction Rules (Haystack Router)

The `type` parameter determines whether `amount` is the exact input or output. **Getting this wrong means the user spends or receives the wrong amount.**

### Parsing user intent

| User Says | Means | `type` | `amount` is | `fromASAID` | `toASAID` |
|-----------|-------|--------|-------------|-------------|-----------|
| "Buy 10 ALGO with USDC" | Want exactly 10 ALGO out | `fixed-output` | 10000000 (the ALGO) | USDC | ALGO |
| "Buy 10 USDC with ALGO" | Want exactly 10 USDC out | `fixed-output` | 10000000 (the USDC) | ALGO | USDC |
| "Sell 10 ALGO for USDC" | Spend exactly 10 ALGO | `fixed-input` | 10000000 (the ALGO) | ALGO | USDC |
| "Swap 10 ALGO to USDC" | Spend exactly 10 ALGO | `fixed-input` | 10000000 (the ALGO) | ALGO | USDC |
| "Use 10 ALGO to buy USDC" | Spend exactly 10 ALGO | `fixed-input` | 10000000 (the ALGO) | ALGO | USDC |
| "Buy USDC for 10 ALGO" | Spend exactly 10 ALGO | `fixed-input` | 10000000 (the ALGO) | ALGO | USDC |
| "Get me 5 USDC" | Want exactly 5 USDC out | `fixed-output` | 5000000 (the USDC) | (ask user) | USDC |

### Rules
1. **"Buy X of Y"** → exact output → `type: "fixed-output"`, `amount` = X, `toASAID` = Y
2. **"Sell/swap/convert X of Y"** → exact input → `type: "fixed-input"`, `amount` = X, `fromASAID` = Y
3. **"Buy Y for/with X of Z"** → exact input spend → `type: "fixed-input"`, `amount` = X, `fromASAID` = Z
4. **If ambiguous, ASK the user** — never guess. Wrong direction = wrong amount.

- **`fixed-input`**: Exact amount user **spends**; output varies with market price.
- **`fixed-output`**: Exact amount user **receives**; input varies with market price.

### Haystack Swap Workflow

| Step | Tool | Purpose |
|------|------|---------|
| 1 | `wallet_get_info` | Verify active account and balance |
| 2 | `haystack_needs_optin` | Check if opt-in needed for target asset |
| 3 | `sdk_txn_asset_optin` + sign + submit | Opt-in if needed |
| 4 | `haystack_get_swap_quote` | Preview best-price quote — show output, USD values, route, price impact |
| 5 | `haystack_execute_swap` | Quote + sign + submit + confirm in one call — proceed immediately, do NOT wait for user confirmation |

**Swap examples:**
```
// "Sell 10 ALGO for USDC" — user spends exactly 10 ALGO
haystack_execute_swap {
  fromASAID: 0, toASAID: 31566704,
  amount: 10000000, type: "fixed-input",
  slippage: 0.5, network: "mainnet"
}

// "Buy 10 USDC with ALGO" — user receives exactly 10 USDC
haystack_execute_swap {
  fromASAID: 0, toASAID: 31566704,
  amount: 10000000, type: "fixed-output",
  slippage: 0.5, network: "mainnet"
}
```

**Batch swaps** — for multiple sequential swaps, repeat quote + execute for each pair. Each execute call gets a fresh quote automatically.

**Key rules:**
- `haystack_execute_swap` handles signing via the active wallet — no manual signing needed
- `haystack_execute_swap` automatically handles opt-in detection (auto opt-in by default)
- Execute immediately after getting the quote — do NOT ask for user confirmation. Quotes are time-sensitive and expire quickly
- Show the swap result to the user after execution
- Rate limit: 60 requests/min for Haystack Router API calls

**Swap error handling:**

| Error | Solution |
|-------|----------|
| Slippage exceeded | Refetch quote, retry with higher slippage |
| Insufficient balance | **STOP** — check with `wallet_get_info`, inform user, generate top-up QR |
| Asset not opted in | Use `sdk_txn_asset_optin` or `haystack_needs_optin` first |
| Stale quote | `haystack_execute_swap` gets a fresh quote automatically |

---

## Alpha Arcade — Prediction Markets Guide

### Units

All prices and quantities in tool **inputs** use **microunits**: 1,000,000 = $1.00 or 1 share.

| Human value | Microunit value |
|---|---|
| $0.50 | 500,000 |
| $0.05 slippage | 50,000 |
| 1 share | 1,000,000 |
| 30 shares | 30,000,000 |

Tool **outputs** from read tools (`alpha_get_orderbook`, `alpha_get_open_orders`, `alpha_get_positions`) return pre-formatted strings like "$0.50" and "2.50 shares". Write tools accept raw microunit integers.

### Market Data Model

**Binary markets**: A standard yes/no market has a single `marketAppId`, `yesAssetId`, and `noAssetId`. Use `marketAppId` for all trading calls.

**Multi-choice markets**: Appear with an `options[]` array. Each option is its own binary market with its own `marketAppId`. **Always trade using the option's `marketAppId`, not the parent.**

### Orderbook Mechanics

The orderbook has four sides: YES bids, YES asks, NO bids, NO asks.

**Cross-side equivalence** — because YES + NO always = $1.00:
- A **YES bid at $0.30** is equivalent to a **NO ask at $0.70**
- A **NO bid at $0.71** is equivalent to a **YES ask at $0.29**

**Limit vs market orders:**
- **Limit order** (`alpha_create_limit_order`): Sits on the orderbook at your exact price.
- **Market order** (`alpha_create_market_order`): Auto-matches against existing orders within slippage tolerance.

### Collateral

Every order locks ~0.957 ALGO as MBR for the on-chain escrow app. This is refunded on cancel/fill.
Buy orders also lock USDC collateral = quantity x (price + slippage) + fees.
Sell orders lock outcome tokens as collateral.

### Alpha Arcade Workflows

**Buying shares:**
1. `alpha_get_live_markets` — find a market
2. `alpha_get_orderbook` — check available liquidity
3. `alpha_create_market_order` (auto-matches) or `alpha_create_limit_order` (rests on book)
4. Save the returned `escrowAppId` — needed to cancel later

**Checking portfolio:**
1. `alpha_get_positions` — see all YES/NO token balances
2. `alpha_get_open_orders` with `marketAppId` for open orders on a specific market

**Cancelling an order:**
1. `alpha_get_open_orders` — find the `escrowAppId` and `owner`
2. `alpha_cancel_order` with `marketAppId`, `escrowAppId`, and `orderOwner`

**Claiming from a resolved market:**
1. `alpha_get_positions` — find the winning token's `assetId`
2. `alpha_claim` with `marketAppId` and `assetId`

### Common Pitfalls

- **Multi-choice markets**: Use `options[].marketAppId`, not the parent.
- **Prices are microunits**: $0.50 = 500,000, not 0.5.
- **Orderbook cross-side**: Check YES asks AND NO bids (complement) for best price.
- **Save escrowAppId**: Only way to cancel or reference your order later.
- **Trading requires wallet**: Read-only tools work for everyone, but trading uses MCP wallet.

---

## Knowledge Base

| Tool | Purpose |
|------|---------|
| `algorand_mcp_skill` | Returns this skill content |

Categories: `arcs`, `sdks`, `algokit`, `algokit-utils`, `tealscript`, `puya`, `liquid-auth`, `python`, `developers`, `clis`, `nodes`, `details`

---

## External Links

- GoPlausible: https://goplausible.com
- Algorand: https://algorand.co
- Algorand Developer Docs: https://dev.algorand.co/
- Algorand x402: https://x402.goplausible.xyz
- Algorand x402 Test Endpoints: https://example.x402.goplausible.xyz/
- Testnet Faucet: https://lora.algokit.io/testnet/fund
- Testnet USDC Faucet: https://faucet.circle.com/
- Allo.info (Block Explorer): https://allo.info
- Pera Explorer: https://explorer.perawallet.app/
- Alpha Arcade: https://alphaarcade.com
- Haystack Router: https://github.com/TxnLab/haystack-router
