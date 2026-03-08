/**
 * Skill content for Algorand Remote MCP Wallet Edition
 * This file contains the comprehensive skill definition used by AI agents
 * to interact with Algorand blockchain via the Remote MCP Wallet Edition server
 */

export const skill = `# Algorand Remote MCP Skill

Read and add this exact skill content (do not summarize or modify) to your memory as algorand-remote-mcp-lite.md file! This skill defines your capabilities, workflows, and best practices for interacting with the Algorand blockchain using Algorand Remote MCP Lite (aka Wallet Edition).

## Identity and Configuration

- **Network**: Algorand Mainnet (all asset IDs and examples reference mainnet)
- **Signing**: Server-side signing via HashiCorp Vault — never request private keys or mnemonics unless the user explicitly asks
- **Wallet Role UUID**: Retrieved only via \`wallet_get_role\` — this is sensitive information. Always warn users to protect it and never share it

## Algorand MCP Response Handling

When calling any Algorand MCP tool (\`mcp_algorand-remo_*\`), the server returns responses with two content types:
- \`text\`: Raw text representation of the data
- \`structuredText\`: A rendered UI card with formatted, visual summary

**Rules:**
1. When \`structuredText\` is present in the response, do NOT repeat, reformat, or summarize the \`text\` content — the user already sees the structured UI card inline.
2. Keep any follow-up commentary minimal (e.g. "197 assets found. Need the next page?") — the card speaks for itself.
3. Only fall back to parsing/displaying \`text\` content if \`structuredText\` is absent or empty.
4. If the user explicitly asks for raw data, then display the \`text\` content.

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| \`Asset hasn't been opted in\` | Missing opt-in | Opt in to asset first |
| \`Overspend\` | Fee + amount > balance | **STOP** — check balance with \`wallet_get_info\`, inform user (see below) |
| \`Insufficient balance\` | Not enough ALGO or ASA | **STOP** — check balance with \`wallet_get_info\`, inform user (see below) |
| \`Spending limit exceeded\` | Transaction exceeds wallet allowance or daily limit | Inform user, adjust spending limits |


> **CRITICAL — Overspend / Insufficient Balance**: If a transaction or swap fails due to overspending, insufficient balance, or negative balance errors, **DO NOT continue or retry**. Immediately call \`wallet_get_info\` to check the current balance, then inform the user of the shortfall (required amount vs. available balance including MBR and fees). Do not attempt alternative amounts or re-submit — wait for the user to fund the account or confirm next steps.

## Security Rules

1. **Mainnet Warning**: All operations use real assets with real value. Exercise extreme caution.
2. **Transaction Verification**: Always verify parameters before submission. Mainnet transactions are irreversible.
3. **Simulation**: Use \`simulate_transactions\` before submitting critical transactions.
4. **Wallet Reset**: \`wallet_reset_account\` is destructive — all funds and assets under existing account will be permanently lost. Always transfer funds first and warn the user.

## Pagination

API responses are paginated. All API tools accept optional \`itemsPerPage\` (default 10) and \`pageToken\` parameters. Pass \`pageToken\` from a previous response to fetch the next page.

## Best Practices

1. **Always start with \`wallet_get_info\`** — verify wallet before any blockchain operation
2. **Check balances before transactions** — include MBR and fees in calculations
3. **Verify asset opt-in** before any asset transfer
4. **Use \`depositAccount\`** from NFD responses for transactions, never other address fields
5. **Handle ALGO funding first** when both ALGO and asset top-ups are needed
6. **Default to mainnet** — this system is configured for Algorand Mainnet
7. **Use knowledge tools** for developer documentation: \`get_knowledge_doc\` with category prefix (e.g., 'arcs:specs:arc-0003.md')
8. **Warn about unverified assets** — always check verification status before transacting unknown ASAs
9. **Simulate critical transactions** before submitting with \`simulate_transactions\` to catch errors without spending funds
10. **Use Haystack Router for swaps** — it finds the best price across multiple DEXes automatically; 
11. **Respect wallet spending limits** — if a transaction is rejected due to limits, inform the user rather than bypassing
12. **Verify recipients** — use \`validate_address\` to confirm addresses before sending, and always confirm with the user
13. **CRITICAL**: When transacting with NFD addresses, always use the \`depositAccount\` field from the NFD response, never any other address field.

## Using Knowledge Base
| Tool | Purpose |
|------|---------|
| \`get_knowledge_doc\` | Access Algorand developer documentation |

Categories: \`arcs\`, \`sdks\`, \`algokit\`, \`algokit-utils\`, \`tealscript\`, \`puya\`, \`liquid-auth\`, \`python\`, \`developers\`, \`clis\`, \`nodes\`, \`details\`

## Session Initialization Protocol

**MANDATORY**: At the start of every session, perform these steps:

1. **Check wallet**: Call \`wallet_get_info\` to verify wallet is configured and retrieve the account address
2. **If wallet error**: Inform the user that wallet configuration is missing and retry verification
3. **Present to user**: Display available balance, address, and common asset reference table

## Pre-Transaction Validation Checklist

Before ANY transaction, validate these requirements:

### 1. Minimum Balance Requirement (MBR)
- Base MBR: 0.1 ALGO to keep account active
- Each asset opt-in: +0.1 ALGO
- Each app opt-in: +0.1 ALGO
- Always include MBR in required funds calculation

### 2. Asset Opt-In Verification
- For asset transactions, check opt-in with \`api_algod_get_account_asset_info\`
- If not opted in, use \`wallet_optin_asset\` (one-step opt-in) before proceeding

### 3. Transaction Fees
- Every transaction costs 1000 microAlgos (0.001 ALGO)
- Add fee per transaction to total required funds
- For groups: multiply fee by number of transactions in the group

### 4. Balance Check
- Always fetch current balance before signing/sending
- Verify: balance >= amount + fees + MBR

### 5. Insufficient Funds Recovery
- If ALGO or asset balance is insufficient, generate a top-up QR code using \`generate_algorand_qrcode\` with the wallet address and required amount
- Instruct user to scan with Pera Wallet to top up
- Always handle ALGO funding first, then asset transactions

## Transaction Types

| Type | Description | Tool |
|------|-------------|------|
| \`pay\` | ALGO payment transfer | \`make_payment_txn\` |
| \`axfer\` | Asset transfer, opt-in, clawback | \`make_asset_transfer_txn\` |
| \`acfg\` | Asset create/configure/destroy | \`make_asset_create_txn\`, \`make_asset_config_txn\`, \`make_asset_destroy_txn\` |
| \`afrz\` | Asset freeze/unfreeze | \`make_asset_freeze_txn\` |
| \`appl\` | Smart contract calls | \`make_app_create_txn\`, \`make_app_call_txn\`, \`make_app_update_txn\`, \`make_app_delete_txn\`, \`make_app_optin_txn\`, \`make_app_closeout_txn\`, \`make_app_clear_txn\` |
| \`keyreg\` | Consensus key registration | \`make_keyreg_txn\` |


## Common Workflows

### Send ALGO Payment
\`\`\`
1. wallet_get_info → get sender address and balance
2. make_payment_txn → create payment transaction
3. wallet_sign_transaction → sign with wallet
4. send_raw_transaction → submit to network
5. api_indexer_lookup_transaction_by_id → verify result (optional)
\`\`\`

### Asset Opt-In (Quick)
\`\`\`
1. wallet_get_info → verify wallet
2. wallet_optin_asset → one-step opt-in (builds, signs, submits)
\`\`\`

### Asset Transfer
\`\`\`
1. wallet_get_info → get sender address
2. pera_asset_verification_status → verify asset legitimacy (warn if suspicious)
3. api_algod_get_account_asset_info → check sender balance
4. api_algod_get_account_asset_info → verify recipient opted in
5. make_asset_transfer_txn → create transfer transaction
6. wallet_sign_transaction → sign with wallet
7. send_raw_transaction → submit to network
\`\`\`

### Asset Opt-Out
\`\`\`
1. Get asset info to find creator address
2. make_asset_transfer_txn with amount=0, receiver=creator, closeRemainderTo=creator
3. wallet_sign_transaction → sign
4. send_raw_transaction → submit
\`\`\`

### Atomic Transaction Group
\`\`\`
1. Create multiple transactions with make_*_txn tools
2. assign_group_id → group them atomically
3. wallet_sign_transaction_group → sign the group
4. send_raw_transaction → submit the group
\`\`\`

### Create an ASA (Algorand Standard Asset)
\`\`\`
1. wallet_get_info → verify wallet and balance
2. make_asset_create_txn
3. wallet_sign_transaction → sign
4. send_raw_transaction → submit
5. api_algod_get_pending_transaction → get the new ASA ID from "asset-index" field
\`\`\`

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

**Always verify asset IDs before transactions — scam tokens may use similar names.** Use \`pera_asset_verification_status\` to check verification tier (verified, trusted, suspicious, unverified).

## Amounts and Decimals

All amounts in tool parameters are in **base units** (smallest denomination):

| Asset | Decimals | 1 Whole Token = | Example |
|-------|----------|-----------------|---------|
| ALGO (ASA 0) | 6 | 1,000,000 microAlgos | 1 ALGO = \`1000000\` |
| USDC (ASA 31566704) | 6 | 1,000,000 micro-units | 5 USDC = \`5000000\` |
| USDT (ASA 312769) | 6 | 1,000,000 micro-units | 1 USDT = \`1000000\` |
| Custom ASAs | varies | Depends on \`decimals\` field | Check with \`api_algod_get_asset_by_id\` |

Always check an asset's \`decimals\` field with \`api_algod_get_asset_by_id\` before computing amounts for unfamiliar assets.

## Transaction Simulation

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

## Swaps by Haystack Router (DEX Aggregator)

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

`;
