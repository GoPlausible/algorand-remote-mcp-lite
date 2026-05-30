---
name: algorand-remote-mcp-lite-demo
version: 1.0.0
description: >
  Demonstrates Algorand Remote MCP Lite (Wallet Edition) tool groups in Demo mode:
  showcase all tools quickly with minimal narration.
mode_arguments:
  network:
    type: enum
    values: [mainnet]
    default: mainnet
  dryRun:
    type: boolean
    default: true
---

# 🚀 Algorand Remote MCP Lite: The Payoff Matrix Quest

**Welcome to an interactive game-theoretic exploration of Algorand's strategic landscape.**

This skill gamifies your journey through Algorand Remote MCP Lite by framing blockchain interactions as **strategic decisions with cascading payoffs**. Each tool unlocks new capabilities, revealing incentive structures and competitive advantages across wallets, assets, markets, and DeFi.

You'll progress through 6 strategic phases, each teaching you how to identify and exploit market opportunities, manage risk, and coordinate transactions. Think of it as mastering the **Algorand game board** — understanding your position (wallet), your assets (resources), the playing field (markets), and the strategies available to you.

## 📚 Pre-Game Setup: Context & Connection Check

**Before the demo begins, take these two essential steps:**

### Step 1: Load the Full Algorand MCP Lite Knowledge Base
Read the [algorand-mcp-lite skill](file:///Users/mg/.agents/skills/algorand-mcp-lite/SKILL.md) to understand the complete Algorand Remote MCP Lite ecosystem. This comprehensive guide covers:
- All 59 available tools across 10 tool groups
- Tool parameters, required fields, and expected outputs
- Best practices for wallet operations, ASA transactions, swaps, and prediction markets
- Risk management and safety guidelines

**You don't need to execute anything yet — just read and absorb.** This grounds your understanding of what tools are *available* before the demo shows you which ones we'll use and *why*.

### Step 2: Verify MCP Server Connection & Metadata
Run `mcp_algorand-remo_algorand_mcp_skill` (or `mcp_algorand-remo_algorand_demo_skill` for the guided demo) to fetch the MCP server metadata and confirm:
- ✅ Algorand Remote MCP Lite server is connected and running
- ✅ All tool groups are registered and available
- ✅ Network configuration (mainnet) is active
- ✅ Wallet session is initialized

**This is metadata acquisition, not a transaction.** It tells us the server is ready and which tools we can invoke.

---

## How the Game Works: Conversational Strategic Discovery

**THE RULES OF PLAY**:

1. **One Strategic Move Per Turn** — No rushing ahead. Unlock one capability at a time.
2. **Pre-Game Briefing** — Before each move, understand:
   - What strategic advantage you're unlocking.
   - What information you're gathering or what transaction you're executing.
   - What payoff you can expect (data, position, opportunity).
3. **Execute the Strategy** — Run the tool and see the results unfold.
4. **Analyze Your Position** — Interpret findings in the context of your Algorand strategy.
5. **Decide to Advance** — After results, choose to move to the next phase:
   ```
   🎮 Proceed to [NEXT PHASE: TOOL NAME]? (yes/no)
   ```
6. **Wait for Your Command** — I won't move forward until you're ready.

**Your goal**: Understand Algorand's entire strategic toolkit — from basic position assessment to prediction market warfare — and learn how to compose these tools into winning strategies.

## Mission

1. Discover and activate all Algorand tool groups.
2. Showcase all currently available tools in one orchestrated run.
3. Keep users safe from irreversible or destructive mistakes.

## Safety Rules (Always Apply)

1. Treat operations as real mainnet value operations.
2. Call `mcp_algorand-remo_wallet_get_info` first.
3. Never request private keys or mnemonics.
4. Warn before any destructive action, especially `mcp_algorand-remo_wallet_reset_account`.
5. Never execute write actions automatically when `dryRun=true`.
6. For state-changing operations in live mode, verify balances, fees, and opt-in requirements first.
7. If funds are insufficient, stop and explain shortfall before any retry.

## Tool Activation Strategy

**STARTUP SEQUENCE** (Execute in this exact order):

### 0️⃣ Connection Verification (Metadata Only)
1. `mcp_algorand-remo_algorand_mcp_skill` (or `mcp_algorand-remo_algorand_demo_skill`) — Fetch MCP server metadata and confirm connection

### 1️⃣ Tool Group Activation (One Per Message)
Run each activation tool separately to unlock tool categories:

1. `activate_account_management_tools`
2. `activate_asset_management_tools`
3. `activate_alpha_arcade_order_management`
4. `activate_outcome_token_management_tools`
5. `activate_limit_order_management_tools`
6. `activate_qr_code_and_receipt_tools`
7. `activate_token_swap_tools`
8. `activate_asset_opt_in_tools`
9. `activate_transaction_lookup_tools`
10. `activate_atomic_transaction_management_tools`

### 2️⃣ Baseline Discovery (Gateway to Demo Phases)
After activations complete, run baseline context tools:

1. `mcp_algorand-remo_wallet_get_info` — Your identity and position
2. `mcp_algorand-remo_wallet_get_assets` — Your resource inventory
3. `mcp_algorand-remo_api_get_algorand_weather` — Network health snapshot

Then proceed to Phase 1.

## Core Tool Catalog To Showcase

### Wallet and Identity

- `mcp_algorand-remo_wallet_get_info`
- `mcp_algorand-remo_wallet_get_assets`
- `mcp_algorand-remo_wallet_get_role` (sensitive)
- `mcp_algorand-remo_wallet_reset_account` (destructive)
- `mcp_algorand-remo_api_nfd_get_nfds_for_address`

### Account and Asset Data

- `mcp_algorand-remo_algod_get_account_info`
- `mcp_algorand-remo_algod_get_account_asset_info`
- `mcp_algorand-remo_indexer_lookup_account_assets`
- `mcp_algorand-remo_algod_get_asset_info`
- `mcp_algorand-remo_pera_verified_asset_query`

### Network and Utility

- `mcp_algorand-remo_api_get_algorand_weather`
- `mcp_algorand-remo_sdk_app_address_by_id`
- `mcp_algorand-remo_generate_ap2_mandate`

### Alpha Arcade Markets and Trading

- `mcp_algorand-remo_alpha_get_live_markets`
- `mcp_algorand-remo_alpha_get_orderbook`
- `mcp_algorand-remo_alpha_get_positions`
- `mcp_algorand-remo_alpha_get_open_orders`

## Full Wallet Edition Matrix (Canonical Names)

Use this matrix to ensure the orchestrator showcases the complete server capability set.

### Wallet

- `wallet_get_info`
- `wallet_get_assets`
- `wallet_get_role`
- `wallet_reset_account`

### Account/Address Utils

- `sdk_check_account_balance`
- `sdk_validate_address`
- `sdk_encode_address`
- `sdk_decode_address`
- `sdk_app_address_by_id`

### Payments and Signing

- `sdk_txn_payment_transaction`
- `wallet_sign_transaction`
- `sdk_submit_transaction`
- `sdk_send_raw_transaction`

### ASA Lifecycle and Transfers

- `sdk_txn_asset_create`
- `sdk_txn_asset_optin`
- `sdk_txn_asset_transfer`
- `wallet_usdc_optin`

### Atomic Groups

- `sdk_assign_group_id`
- `sdk_create_atomic_group`
- `sdk_sign_atomic_group`
- `wallet_sign_atomic_group`
- `sdk_submit_atomic_group`

### Algod Queries

- `algod_get_account_info`
- `algod_get_account_asset_info`
- `algod_get_asset_info`
- `algod_get_pending_txn_info`

### Pera Verification

- `pera_verified_asset_query`
- `pera_verified_assets_search`

### Indexer

- `indexer_search`
- `indexer_search_for_accounts`
- `indexer_search_for_assets`
- `indexer_lookup_account_assets`
- `indexer_lookup_account_transactions`
- `indexer_lookup_asset_balances`
- `indexer_lookup_transaction_by_id`

### NFD

- `api_nfd_get_nfd`
- `api_nfd_get_nfds_for_address`

### Haystack Router

- `haystack_get_swap_quote`
- `haystack_execute_swap`
- `haystack_needs_optin`

### Alpha Arcade Read

- `alpha_get_live_markets`
- `alpha_get_reward_markets`
- `alpha_get_market`
- `alpha_get_orderbook`
- `alpha_get_open_orders`
- `alpha_get_positions`

### Alpha Arcade Trade and Position Ops

- `alpha_create_limit_order`
- `alpha_create_market_order`
- `alpha_amend_order`
- `alpha_cancel_order`
- `alpha_split_shares`
- `alpha_merge_shares`
- `alpha_claim`
- `alpha_propose_match`

### QR, Receipt, AP2, Stats, Skill

- `generate_algorand_qrcode`
- `generate_algorand_receipt`
- `generate_ap2_mandate`
- `api_get_algorand_weather`
- `algorand_mcp_skill`
- `algorand_demo_skill`

## 🎯 Demo Scenarios: Simple, Practical, Sequential

Use short scenario blocks instead of long phases. Keep each block to 2-4 tools, one tool per message.

### Scenario 1: Wallet Snapshot (Fast Start)
Goal: Know your identity and current holdings.

1. `mcp_algorand-remo_wallet_get_info`
2. `mcp_algorand-remo_wallet_get_assets`
3. `mcp_algorand-remo_api_get_algorand_weather`

### Scenario 2: Asset Discovery -> Trust -> Position
Goal: Look up an ASA, verify trust, then confirm account-level exposure.

1. `mcp_algorand-remo_algod_get_asset_info`
2. `mcp_algorand-remo_pera_verified_asset_query`
3. `mcp_algorand-remo_algod_get_account_asset_info`
4. `mcp_algorand-remo_indexer_lookup_account_assets`

### Scenario 3: NFD Identity Checks
Goal: Show name-service identity and reputation context.

> Note: Agent wallet accounts do not have NFDs yet, so do NOT use the agent wallet address to showcase NFD lookups. For this demo use `goplausible.algo` as the example NFD — look it up directly with `api_nfd_get_nfd`, or for `api_nfd_get_nfds_for_address` use the address `UTI7PAASILRDA3ISHY5M7J7LNRX2AIVQJWI7ZKCCGKVLMFD3VPR5PWSZ4I` (which returns `goplausible.algo`).

1. `mcp_algorand-remo_api_nfd_get_nfds_for_address`
2. Optional: `api_nfd_get_nfd` for full record drill-down

### Scenario 4: Asset Opt-In and Transfer
Goal: Demonstrate the common user journey: discover asset -> opt in -> transfer.

1. Use Scenario 2 to choose a real ASA ID
2. `sdk_txn_asset_optin` (or wallet helper when applicable)
3. `sdk_txn_asset_transfer`
4. `indexer_lookup_transaction_by_id` to verify settlement

### Scenario 5: Payments and Receipts
Goal: Send ALGO payment flow and generate proof artifacts.

1. `sdk_txn_payment_transaction`
2. `wallet_sign_transaction`
3. `sdk_submit_transaction`
4. `generate_algorand_receipt`
5. Optional: `generate_algorand_qrcode`

### Scenario 6: Haystack Swap Flow (Aggregator, Not TinyMan-Only)
Goal: Quote and execute a routed swap using Haystack.

1. `haystack_needs_optin`
2. `haystack_get_swap_quote`
3. `haystack_execute_swap`

Important framing:
- Haystack is a route/aggregation layer across multiple liquidity sources.
- Do not describe this as a TinyMan-direct integration.
- TinyMan can be one possible route, but the demo should stay Haystack-centric.

### Scenario 7: Alpha Arcade Trading (Keep This Strong)
Goal: Preserve the best part of the demo with actionable market context.

1. `mcp_algorand-remo_alpha_get_live_markets`
2. `mcp_algorand-remo_alpha_get_orderbook`
3. `mcp_algorand-remo_alpha_get_positions`
4. `mcp_algorand-remo_alpha_get_open_orders`

### Scenario 8: Advanced Contract and AP2 Credentials
Goal: Show app-address mechanics and payment mandate primitives.

1. `mcp_algorand-remo_sdk_app_address_by_id`
2. `mcp_algorand-remo_generate_ap2_mandate`

### 🎮 Interaction Pattern (Compact)

For each tool message:

1. One-line objective
2. One-line why it matters
3. Execute one tool
4. One-line result summary
5. Ask: `🎮 Proceed to next step? (yes/no)`

Keep explanations short and concrete. Prefer real user-like cases over abstract theory.

## Write-Operation Handling

For tools that can move funds, place orders, or alter state:

- In `dryRun=true`: do not execute; explain parameters, safety checks, and expected outcome.
- In `dryRun=false`: execute only after confirming preconditions:
  1. Sufficient balance
  2. Asset opt-in readiness
  3. Exact recipient/asset/market IDs
  4. Slippage and fee bounds

## Orchestration Template Prompt

Use this exact structure when invoking the skill:

```
Run algorand-remote-mcp-lite-demo in conversational sequential mode, network=mainnet, dryRun=<true|false>.

**Execution rules:**
1. Read algorand-mcp-lite skill for context.
2. Verify Algorand Remote MCP Lite is connected using MCP server metadata acquisition first.
3. Activate all Algorand tool groups, one tool per message.
4. Run Scenario 1 through Scenario 8 in order.
5. For each step, keep copy brief:
  - 1 line objective
  - 1 line why it matters
  - Execute 1 tool
  - 1 line result summary
  - Ask: "🎮 Proceed to next step? (yes/no)"
6. Do NOT batch tools.
7. If dryRun=true, explain write operations without executing them.
8. End with a compact final summary report.

This is a CONVERSATIONAL demo, not an automated runbook.
```

## Final Report Contract (End of Demo)

After all sequential tools are executed, return:

1. **Demo Summary**: Total tools executed vs. explained-only.
2. **Wallet Snapshot**: Final state of wallet, assets, and markets.
3. **Key Findings**: Notable discoveries during demo.
4. **Tool Execution Timeline**: Chronological list of tools run.
5. **Risks and Safety Notes**: Any warnings or precautions observed.
6. **Suggested Next Actions**: What user can do with the tools learned.

## 🏆 Design Principles: Why This Works

### Game Design Mechanics

1. **Progressive Disclosure** — Each scenario unlocks **new capabilities** (wallet → assets → swaps/payments → markets).
2. **Strategic Narrative** — Every tool has a **purpose in a larger strategy** (know yourself, scout markets, analyze assets, position yourself, execute). No tool feels isolated.
3. **Information Asymmetry** — Early phases teach *defensive moves* (know what you hold, verify trust). Later phases teach *offensive moves* (orderbook reading, market timing, credential creation).
4. **Incentive Alignment** — The demo respects the player's **time and agency**. Conversational pacing (one move per message) = no overwhelming batches.
5. **Payoff Visualization** — Each tool explicitly states **what you gain** — not just "this tool exists" but "here's your competitive advantage".

### Anti-Patterns to Avoid

- **DO NOT batch tools.** One move per message. This breaks immersion and prevents learning.
- **DO NOT skip the confirmation prompt.** Waiting for user input respects agency.
- **DO NOT use sterile language.** Frame tools as **strategic moves**, not API calls.
- **DO NOT rush to dryRun=false.** Only execute real transactions if user explicitly requests live mode.
- **DO NOT over-explain.** Keep context to 1 concise line of why it matters.

### Educational Wins

By journey's end, players can:
- Inspect wallet and network state fast
- Evaluate assets before interacting
- Run real-world user flows (opt-in, transfer, payment, receipt)
- Execute routed Haystack swaps with correct framing
- Analyze Alpha Arcade market structure and positions
