/**
 * Skill content for Algorand Remote MCP Wallet Edition
 * This file contains the comprehensive skill definition used by AI agents
 * to interact with Algorand blockchain via the Remote MCP Wallet Edition server
 */

export const skill = `# Algorand Remote MCP Lite (Wallet Edition) Skill

Read and learn these skills and instructions to define your capabilities, workflows, and best practices for interacting with the Algorand blockchain using Algorand Remote MCP Lite (aka Wallet Edition).

## Algorand Remote MCP Lite Instructions

### **CRITICAL** Algorand MCP Response Handling Rules

This server uses the MCP Apps SDK (\`@modelcontextprotocol/ext-apps\`). 55 tools are registered as App tools via \`registerAppTool()\` with \`_meta.ui.resourceUri\` linking each to an HTML widget. 4 plain utility tools have no UI.

1. **UI-capable hosts**: The widget renders inline as the complete response. Do NOT repeat, reformat, or summarize the \`content\` text — the widget IS the response. Simply confirm the action succeeded.
2. **Text-only clients**: The \`content\` text fallback is shown automatically — no special handling needed.
3. If the user explicitly asks for raw data, display the \`content\` text.

### Security Rules

1. **Mainnet Warning**: All operations use real assets with real value. Exercise extreme caution.
2. **Transaction Verification**: Always verify parameters before submission. Mainnet transactions are irreversible.
3. **Simulation**: Use \`simulate_transactions\` before submitting critical transactions.
4. **Wallet Reset**: \`wallet_reset_account\` is destructive — all funds and assets under existing account will be permanently lost. Always transfer funds first and warn the user.
5. **Signing**: Server-side signing via HashiCorp Vault — never request private keys or mnemonics unless the user explicitly asks
6. **Wallet Role UUID**: Retrieved only via \`wallet_get_role\` — this is sensitive information. Always warn users to protect it and never share it

### Pagination

API responses are paginated. All API tools accept optional \`itemsPerPage\` (default 10) and \`pageToken\` parameters. Pass \`pageToken\` from a previous response to fetch the next page.

### Best Practices

1. **Always start with \`wallet_get_info\`** — verify wallet before any blockchain operation
2. **Check balances before transactions** — include MBR and fees in calculations
3. **Verify asset opt-in** before any asset transfer
4. **Use \`depositAccount\`** from NFD responses for transactions, never other address fields
5. **Handle ALGO funding first** when both ALGO and asset top-ups are needed

### Using Knowledge Base
| Tool | Purpose |
|------|---------|
| \`get_knowledge_doc\` | Access Algorand developer documentation |

Categories: \`arcs\`, \`sdks\`, \`algokit\`, \`algokit-utils\`, \`tealscript\`, \`puya\`, \`liquid-auth\`, \`python\`, \`developers\`, \`clis\`, \`nodes\`, \`details\`

## Transactions Instructions

### Transaction Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| \`Asset hasn't been opted in\` | Missing opt-in | Opt in to asset first |
| \`Overspend\` | Fee + amount > balance | **STOP** — check balance with \`wallet_get_info\`, inform user (see below) |
| \`Insufficient balance\` | Not enough ALGO or ASA | **STOP** — check balance with \`wallet_get_info\`, inform user (see below) |
| \`Spending limit exceeded\` | Transaction exceeds wallet allowance or daily limit | Inform user, adjust spending limits |


> **CRITICAL — Overspend / Insufficient Balance**: If a transaction or swap fails due to overspending, insufficient balance, or negative balance errors, **DO NOT continue or retry**. Immediately call \`wallet_get_info\` to check the current balance, then inform the user of the shortfall (required amount vs. available balance including MBR and fees). Do not attempt alternative amounts or re-submit — wait for the user to fund the account or confirm next steps.

### Pre-Transaction Validation Checklist

Before ANY transaction, validate these requirements:

1. Minimum Balance Requirement (MBR)
- Base MBR: 0.1 ALGO to keep account active
- Each asset opt-in: +0.1 ALGO
- Each app opt-in: +0.1 ALGO
- Always include MBR in required funds calculation

2. Asset Opt-In Verification
- For asset transactions, check opt-in with \`api_algod_get_account_asset_info\`
- If not opted in, use \`wallet_optin_asset\` (one-step opt-in) before proceeding

3. Transaction Fees
- Every transaction costs 1000 microAlgos (0.001 ALGO)
- Add fee per transaction to total required funds
- For groups: multiply fee by number of transactions in the group

4. Balance Check
- Always fetch current balance before signing/sending
- Verify: balance >= amount + fees + MBR

5. Insufficient Funds Recovery
- If ALGO or asset balance is insufficient, generate a top-up QR code using \`generate_algorand_qrcode\` with the wallet address and required amount
- Instruct user to scan with Pera Wallet to top up
- Always handle ALGO funding first, then asset transactions

### Transaction Types

| Type | Description | Tool |
|------|-------------|------|
| \`pay\` | ALGO payment transfer | \`make_payment_txn\` |
| \`axfer\` | Asset transfer, opt-in, clawback | \`make_asset_transfer_txn\` |
| \`acfg\` | Asset create/configure/destroy | \`make_asset_create_txn\`, \`make_asset_config_txn\`, \`make_asset_destroy_txn\` |
| \`afrz\` | Asset freeze/unfreeze | \`make_asset_freeze_txn\` |
| \`appl\` | Smart contract calls | \`make_app_create_txn\`, \`make_app_call_txn\`, \`make_app_update_txn\`, \`make_app_delete_txn\`, \`make_app_optin_txn\`, \`make_app_closeout_txn\`, \`make_app_clear_txn\` |
| \`keyreg\` | Consensus key registration | \`make_keyreg_txn\` |

### Transaction Simulation

Before submitting critical or high-value transactions, use simulation to verify they will succeed:
\`\`\`
simulate_transactions {
  txnGroups: [ ...transaction group... ],
  allowEmptySignatures: true,
  allowMoreLogging: true,
  network: "mainnet"
}
\`\`\`
This catches errors (insufficient balance, wrong parameters, logic failures) without spending real funds.

### Amounts and Decimals

All amounts in tool parameters are in **base units** (smallest denomination):

| Asset | Decimals | 1 Whole Token = | Example |
|-------|----------|-----------------|---------|
| ALGO (ASA 0) | 6 | 1,000,000 microAlgos | 1 ALGO = \`1000000\` |
| USDC (ASA 31566704) | 6 | 1,000,000 micro-units | 5 USDC = \`5000000\` |
| USDT (ASA 312769) | 6 | 1,000,000 micro-units | 1 USDT = \`1000000\` |
| Custom ASAs | varies | Depends on \`decimals\` field | Check with \`api_algod_get_asset_by_id\` |

Always check an asset's \`decimals\` field with \`api_algod_get_asset_by_id\` before computing amounts for unfamiliar assets.

## Verified Assets, NFDs and Swaps Instructions

### Pera Asset Verification
\`\`\`
// Check if an asset is verified (mainnet only)
pera_asset_verification_status
→ Returns: { asset_id, verification_tier, explorer_url }
→ Tiers: verified (highest), trusted, suspicious (warn user!), unverified

// Get detailed asset info (name, USD value, logo, supply)
pera_verified_asset_details 

// Search verified assets by name
pera_verified_asset_search
→ Set verifiedOnly: true to filter out suspicious/unverified assets
\`\`\`

### NFD Lookup
**CRITICAL**: When transacting with NFD addresses, always use the \`depositAccount\` field from the NFD response, never any other address field.
\`\`\`
// Look up an NFD name
api_nfd_get_nfd { nameOrID: "example.algo", view: "full", network: "mainnet" }
→ CRITICAL: Use depositAccount field for transactions, NOT other address fields!

// Get NFDs owned by an address
api_nfd_get_nfds_for_addresses {
  address: ["ALGO_ADDRESS"],
  view: "brief",
  limit: 10,
  network: "mainnet"
}
\`\`\`

### NFD Resolution
\`\`\`
1. api_nfd_get_nfd → look up the .algo name
2. Extract depositAccount from response
3. Use depositAccount as transaction recipient
\`\`\`

### Swaps by Haystack Router (DEX Aggregator)

Haystack Router aggregates quotes across Tinyman, Pact, Folks, and LST protocols to find the optimal route. Supports multi-hop and combo swaps.

**Workflow:**

| Step | Tool | Purpose |
|------|------|---------|
| 1 | \`wallet_get_info\` | Verify active account and balance |
| 2 | \`api_haystack_needs_optin\` | Check if opt-in needed for target asset |
| 3 | \`wallet_optin_asset\` | Opt-in if needed |
| 4 | \`api_haystack_get_swap_quote\` | Preview best-price quote — show output, USD values, route, price impact |
| 5 | User confirms | Always confirm — quotes are time-sensitive |
| 6 | \`api_haystack_execute_swap\` | Quote + sign + submit + confirm in one call |

**Parameters:**
\`\`\`
api_haystack_get_swap_quote / api_haystack_execute_swap:
  fromASAID: 0,          // Input asset (0 = ALGO)
  toASAID: 31566704,     // Output asset (USDC)
  amount: 1000000,       // Base units
  type: "fixed-input",   // or "fixed-output"
  slippage: 1,           // Execute only: % slippage tolerance
  network: "mainnet"

api_haystack_needs_optin:
  address, assetId, network → Returns: { needsOptIn: true/false }
\`\`\`

**Slippage guidance:**

| Pair Type | Slippage |
|-----------|----------|
| Stable (ALGO/USDC) | 0.1–0.5% |
| Major ASA pairs | 0.5–1% |
| Volatile pairs | 1–3% |
| Low liquidity | 3–5% |

**Swap direction — parsing user intent:**

| User Says | \`type\` | \`amount\` is | \`from\` → \`to\` |
|-----------|--------|-------------|----------------|
| "Sell 10 ALGO for USDC" / "Swap 10 ALGO to USDC" | \`fixed-input\` | 10 ALGO | ALGO → USDC |
| "Buy 10 USDC with ALGO" / "Get me 10 USDC" | \`fixed-output\` | 10 USDC | ALGO → USDC |
| "Buy 10 ALGO with USDC" | \`fixed-output\` | 10 ALGO | USDC → ALGO |

- **\`fixed-input\`**: exact amount user **spends**; output varies with market
- **\`fixed-output\`**: exact amount user **receives**; input varies with market
- **If ambiguous, ASK the user** — wrong direction = wrong amount spent/received

**Key rules:**
- \`api_haystack_execute_swap\` handles opt-in detection and signing automatically
- Always show quote to user and confirm before executing
- Execute promptly after confirmation — quotes are time-sensitive

**Error handling:**

| Error | Solution |
|-------|----------|
| Slippage exceeded | Refetch quote, retry with higher slippage |
| Insufficient balance | **STOP** — check with \`wallet_get_info\`, inform user, generate top-up QR |
| Asset not opted in | Use \`wallet_optin_asset\` or \`api_haystack_needs_optin\` first |
| Stale quote | \`api_haystack_execute_swap\` gets a fresh quote automatically |

## Alpha Arcade — Agent Guide

### Units

All prices and quantities in tool **inputs** use **microunits**: 1,000,000 = $1.00 or 1 share.

| Human value | Microunit value |
|---|---|
| $0.50 | 500,000 |
| $0.05 slippage | 50,000 |
| 1 share | 1,000,000 |
| 30 shares | 30,000,000 |

Tool **outputs** from read tools (get_orderbook, get_open_orders, get_positions) return pre-formatted strings like "$0.50" and "2.50 shares". Write tools accept raw microunit integers.

### Market Data Model

#### Binary markets
A standard yes/no market has a single \`marketAppId\`, \`yesAssetId\`, and \`noAssetId\`. Use \`marketAppId\` for all trading calls.

#### Multi-choice markets
Multi-choice markets (e.g., "Who wins the election?") appear with an \`options[]\` array. Each option is its own binary market with its own \`marketAppId\`.

**Always trade using the option's \`marketAppId\`, not the parent.**

### Orderbook Mechanics

#### Four-sided book
The orderbook has four sides: YES bids, YES asks, NO bids, NO asks.

#### Cross-side equivalence
Because YES + NO always = $1.00:
- A **YES bid at $0.30** is equivalent to a **NO ask at $0.70**
- A **NO bid at $0.71** is equivalent to a **YES ask at $0.29**

#### Limit vs market orders
- **Limit order** (\`alpha_create_limit_order\`): Sits on the orderbook at your exact price.
- **Market order** (\`alpha_create_market_order\`): Auto-matches against existing orders within your slippage tolerance.

### Collateral

Every order locks ~0.957 ALGO as MBR for the on-chain escrow app. This is refunded on cancel/fill.
Buy orders also lock USDC collateral = quantity × (price + slippage) + fees.
Sell orders lock outcome tokens as collateral.

### Key Workflows

#### Buying shares
1. \`alpha_get_live_markets\` — find a market
2. \`alpha_get_orderbook\` — check available liquidity
3. \`alpha_create_market_order\` (auto-matches) or \`alpha_create_limit_order\` (rests on book)
4. Save the returned \`escrowAppId\` — you need it to cancel

#### Checking your portfolio
1. \`alpha_get_positions\` — see all YES/NO token balances
2. \`alpha_get_open_orders\` with \`marketAppId\` for open orders on a specific market

#### Cancelling an order
1. \`alpha_get_open_orders\` — find the \`escrowAppId\` and \`owner\`
2. \`alpha_cancel_order\` with \`marketAppId\`, \`escrowAppId\`, and \`orderOwner\`

#### Claiming from a resolved market
1. \`alpha_get_positions\` — find the winning token's \`assetId\`
2. \`alpha_claim\` with \`marketAppId\` and \`assetId\`

### Common Pitfalls

- **Multi-choice markets**: Use \`options[].marketAppId\`, not the parent.
- **Prices are microunits**: $0.50 = 500,000, not 0.5.
- **Orderbook cross-side**: Check YES asks AND NO bids (complement) for best price.
- **Save escrowAppId**: It's the only way to cancel or reference your order later.
- **Trading requires wallet**: Read-only tools work for everyone, but trading uses your MCP wallet.

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
`;
