# Algorand Remote MCP Lite (Wallet Edition)


Algorand Remote MCP Lite is a wallet-first Model Context Protocol server for Algorand. It is a trimmed version of the full remote MCP, focused on agentic wallet workflows with 59 tools covering wallet management, transactions, blockchain queries, DEX-aggregated swaps, prediction markets, and more. It runs on Algorand Mainnet by default and signs transactions server-side using HashiCorp Vault.

<img width="1005" height="554" alt="1_heKuf7jrjc3-aAAbGVdgLw copy" src="https://github.com/user-attachments/assets/cbf58093-8450-4769-88e3-98b6130ee740" />

## Architecture

- MCP server on Cloudflare Workers (Durable Object) that registers wallet, transaction, and API tools.
- OAuth 2.0 with PKCE and OIDC-compatible social login (Google, GitHub, Twitter/X, LinkedIn) for user identity.
- HashiCorp Vault transit signing via the `HCV_WORKER` service; private keys never leave the vault.
- Algod + Indexer APIs for on-chain state and transaction submission.
- KV namespaces for OAuth sessions, vault entity mapping, verified assets, ARC-90 QR/receipt caching, and AP2 storage.

## Design

- Wallet edition: minimal, curated tool set that behaves like an agentic wallet.
- Server-side signing: the LLM never receives mnemonics or private keys.
- Mainnet-first: examples and defaults target mainnet assets and apps.
- Modular tooling: wallet, transactions, indexer, NFD, Pera verified assets, Haystack Router DEX swaps, Alpha Arcade prediction markets, and more are separate tool groups.

## OAuth + OIDC and Agentic Wallets

- Users authenticate via OAuth/OIDC providers; approval and PKCE flows are handled in `src/oauth-handler.ts` and `src/oauth-provider.ts`.
- After login, `ensureUserAccount` binds the social identity (provider + email) to a Vault entity and transit key.
- The wallet address is derived from the Vault public key and used as the agent wallet.
- Signing tools (`wallet_sign_transaction`, `wallet_sign_atomic_group`) use Vault transit so signatures are produced inside Vault.

## Features

- Agentic wallet operations: balance, assets, signing, and submission without exposing secrets.
- On-demand topup using Algorand ARC-90 payment QR codes (`generate_algorand_qrcode`).
- AP2 mandate generation for intent, cart, and payment flows (`generate_ap2_mandate`).
- Receipt generation with QR codes for payments and asset transfers (`generate_algorand_receipt`).
- Atomic transaction groups and asset workflows (opt-in, transfer, USDC opt-in).
- Verified asset discovery via Pera Wallet and NFD lookups.
- Best-price DEX swaps via Haystack Router (aggregates Tinyman, Pact, Folks, LST protocols).
- Alpha Arcade prediction market trading (browse, order, cancel, claim).
- Algorand chain weather/stats.

## Available Tools (59)

### Wallet (4)
- `wallet_get_info`: Get the account information for the configured wallet (address, publicKey, balance, assets)
- `wallet_get_assets`: Get all asset holdings for the configured wallet
- `wallet_get_role`: Get wallet user role UUID (sensitive — warn users to protect it)
- `wallet_reset_account`: Reset/recreate wallet account with new keys (DESTRUCTIVE — transfer funds first!)

### Account (1)
- `sdk_check_account_balance`: Check the ALGO balance of an Algorand account

### Utility (5)
- `sdk_validate_address`: Check if an Algorand address is valid
- `sdk_encode_address`: Encode a public key to an Algorand address
- `sdk_decode_address`: Decode an Algorand address to a public key
- `sdk_app_address_by_id`: Get the escrow address for a given application ID
- `algorand_mcp_skill`: Access comprehensive skill/guide for using Algorand Remote MCP Lite, including workflows, examples, and best practices
- `algorand_demo_skill`: Access a demo skill showcasing various tools and features of the Algorand Remote MCP Lite (for demonstration purposes)

### Transactions (4)
- `sdk_txn_payment_transaction`: Create an ALGO payment transaction
- `wallet_sign_transaction`: Sign an Algorand transaction with the agent wallet (via Vault)
- `sdk_submit_transaction`: Submit a signed transaction to the Algorand network
- `sdk_send_raw_transaction`: Submit raw signed transaction bytes to the network

### Asset Transactions (4)
- `sdk_txn_asset_create`: Create a new Algorand Standard Asset (ASA)
- `sdk_txn_asset_optin`: Opt-in to an Algorand Standard Asset (ASA)
- `sdk_txn_asset_transfer`: Transfer an Algorand Standard Asset (ASA)
- `wallet_usdc_optin`: One-step USDC opt-in for the agent wallet (builds, signs, submits)

### Atomic Groups (5)
- `sdk_assign_group_id`: Assign a group ID to transactions for atomic execution
- `sdk_create_atomic_group`: Create an atomic transaction group from multiple transactions
- `sdk_sign_atomic_group`: Sign an atomic transaction group (SDK-level)
- `wallet_sign_atomic_group`: Sign an atomic transaction group (via wallet/Vault)
- `sdk_submit_atomic_group`: Submit a signed atomic transaction group to the network

### Algod API (4)
- `algod_get_account_info`: Get current account balance, assets, and auth address from algod
- `algod_get_account_asset_info`: Get account-specific asset information from algod
- `algod_get_asset_info`: Get asset details (name, decimals, supply, creator) from algod
- `algod_get_pending_txn_info`: Get pending transaction details by transaction ID

### Pera Asset Verification (2)
- `pera_verified_asset_query`: Get detailed information about an Algorand asset from Pera (includes verification tier)
- `pera_verified_assets_search`: Search Pera verified assets by asset name, unit name, or creator address

### Indexer API (7)
- `indexer_search`: General search across accounts, transactions, assets, or applications
- `indexer_search_for_accounts`: Search for accounts with various criteria
- `indexer_search_for_assets`: Search for assets with various criteria
- `indexer_lookup_account_assets`: Get assets held by an account
- `indexer_lookup_account_transactions`: Get transaction history for an account
- `indexer_lookup_asset_balances`: Get accounts that hold a specific asset
- `indexer_lookup_transaction_by_id`: Get transaction details by ID

### NFD API (2)
- `api_nfd_get_nfd`: Get NFD (.algo) domain information by name
- `api_nfd_get_nfds_for_address`: Get all NFD names owned by an Algorand address

### Haystack Router — DEX Aggregator (3)
- `haystack_get_swap_quote`: Get best-price swap quote across multiple DEXes (Tinyman, Pact, Folks, LST protocols)
- `haystack_execute_swap`: All-in-one swap: quote + sign via wallet + submit + confirm
- `haystack_needs_optin`: Check if an address needs to opt into an asset before swapping

### Alpha Arcade — Prediction Markets (14)
- `alpha_get_live_markets`: Fetch all live prediction markets
- `alpha_get_reward_markets`: Fetch markets with liquidity rewards
- `alpha_get_market`: Get full details for a single market
- `alpha_get_orderbook`: Get on-chain orderbook for a market
- `alpha_get_open_orders`: Get open orders for the wallet on a market
- `alpha_get_positions`: Get YES/NO token positions across all markets
- `alpha_create_limit_order`: Place a limit order at an exact price
- `alpha_create_market_order`: Place a market order with auto-matching
- `alpha_amend_order`: Modify an existing unfilled order
- `alpha_cancel_order`: Cancel an open order
- `alpha_split_shares`: Split USDC into YES + NO tokens
- `alpha_merge_shares`: Merge YES + NO tokens back into USDC
- `alpha_propose_match`: Propose a match between compatible orders
- `alpha_claim`: Claim USDC from a resolved market

### Blockchain Stats (1)
- `api_get_algorand_weather`: Get Algorand chain weather/stats (TPS, block time, health)

### ARC-90 (1)
- `generate_algorand_qrcode`: Generate an ARC-90 payment URI (ARC-90 supersedes ARC-26) and a page with its QR code for payment or asset transfer requests (link valid for 1 day)

### Receipts (1)
- `generate_algorand_receipt`: Generate a transaction receipt with QR code for payments or asset transfers

### AP2 (1)
- `generate_ap2_mandate`: Create an AP2 intent, cart, or payment mandate

## Resources (45)

### Data Resource (1)
- Algorand MCP Skill (`algorand://remote-mcp-skill`): Comprehensive skill definition for using Algorand Remote MCP tools.

### UI Widget Resources (44)

Rich interactive widgets rendered inline by supported MCP clients (e.g., Claude Desktop). Each widget is an HTML micro-app served via `ui://` URIs.

#### Wallet (4)
- `wallet-card-widget` (`ui://wallet/wallet-card.html`): Interactive wallet card
- `wallet-reset-card-widget` (`ui://wallet/wallet-reset-card.html`): Wallet reset confirmation card with new address and copy button
- `wallet-role-card-widget` (`ui://wallet/wallet-role-card.html`): Vault Role ID with masked display, reveal toggle, copy button, and security warnings
- `asset-portfolio-widget` (`ui://wallet/asset-portfolio.html`): Interactive asset portfolio grid

#### Account (3)
- `balance-card-widget` (`ui://account/balance-card.html`): Account balance card showing address, balance, and MBR
- `account-card-widget` (`ui://account/account-card.html`): Interactive account dashboard
- `account-asset-holding-widget` (`ui://algod/account-asset-holding.html`): Asset holding card with amount, frozen status, and explorer links

#### Transaction (8)
- `txn-confirm-widget` (`ui://txn/txn-confirm.html`): Transaction confirmation
- `txn-receipt-widget` (`ui://txn/txn-receipt.html`): Transaction receipt with confirmed round, ID, date and transfer details
- `txn-sign-wallet-widget` (`ui://txn/txn-sign-wallet.html`): Vault wallet signing with animation and success checkmark
- `txn-sign-sdk-widget` (`ui://txn/txn-sign-sdk.html`): SDK signing with animation and success checkmark
- `txn-submit-widget` (`ui://txn/txn-submit.html`): Transaction submit with blockchain animation and confirmation details
- `raw-txn-submit-widget` (`ui://algod/raw-txn-submit.html`): Raw transaction submission result with Tx ID
- `group-receipt-widget` (`ui://txn/group-receipt.html`): Atomic group receipt showing all txn IDs, types, accounts and fees
- `pending-txn-widget` (`ui://algod/pending-txn.html`): Pending transaction card with status, type, addresses, and amount

#### Atomic Groups (2)
- `group-id-card-widget` (`ui://txn/group-id-card.html`): Group ID assignment result with copy button and atomic group info
- `atomic-group-card-widget` (`ui://txn/atomic-group-card.html`): Atomic group creation result with success check and copy group ID

#### Asset (2)
- `asset-card-widget` (`ui://asset/asset-card.html`): Interactive asset detail card
- `asset-search-widget` (`ui://asset/asset-search.html`): Interactive asset search results

#### Utility (2)
- `address-validate-card-widget` (`ui://utility/address-validate-card.html`): Address validation result with check/cross icon and copy button
- `app-address-card-widget` (`ui://utility/app-address-card.html`): Application address card with app ID badge, address copy and explorer link

#### Indexer (5)
- `indexer-search-widget` (`ui://indexer/indexer-search.html`): Generic indexer search results table
- `account-assets-widget` (`ui://indexer/account-assets.html`): Account asset holdings table
- `account-search-widget` (`ui://indexer/account-search.html`): Account search results table
- `asset-search-indexer-widget` (`ui://indexer/asset-search-indexer.html`): Asset search results table
- `asset-holders-widget` (`ui://indexer/asset-holders.html`): Asset holders table

#### Transaction History (2)
- `txn-history-widget` (`ui://txn/txn-history.html`): Interactive transaction history
- `txn-detail-widget` (`ui://txn/txn-detail.html`): LORA-style transaction flow diagram

#### NFD (2)
- `nfd-card-widget` (`ui://nfd/nfd-card.html`): Interactive NFD account card
- `nfd-list-widget` (`ui://nfd/nfd-list.html`): NFD names list for an address

#### Haystack Router (2)
- `swap-quote-card-widget` (`ui://swap/swap-quote-card.html`): Interactive swap quote card
- `swap-result-card-widget` (`ui://swap/swap-result-card.html`): Swap execution result card

#### Alpha Arcade (8)
- `alpha-markets-widget` (`ui://alpha/markets.html`): Markets list
- `alpha-market-detail-widget` (`ui://alpha/market-detail.html`): Single market detail
- `alpha-orderbook-widget` (`ui://alpha/orderbook.html`): Orderbook
- `alpha-orders-widget` (`ui://alpha/orders.html`): Open orders
- `alpha-positions-widget` (`ui://alpha/positions.html`): Positions
- `alpha-trade-result-widget` (`ui://alpha/trade-result.html`): Trade order result
- `alpha-order-manage-widget` (`ui://alpha/order-manage.html`): Order management result
- `alpha-shares-action-widget` (`ui://alpha/shares-action.html`): Shares action result

#### Other (4)
- `qr-code-widget` (`ui://arc90/qr-code.html`): Interactive QR code display
- `receipt-card-widget` (`ui://receipt/receipt-card.html`): Interactive transaction receipt
- `mandate-card-widget` (`ui://ap2/mandate-card.html`): Interactive AP2 mandate card
- `chain-weather-widget` (`ui://stats/chain-weather.html`): Animated chain weather dashboard showing Algorand network conditions

## Usage

### Local development
1. Install dependencies: `npm install`
2. Configure `wrangler.jsonc` vars and secrets (Algod/Indexer URLs, OAuth client IDs/secrets, Vault worker URL/token).
3. Start the worker: `npm run dev`

### OAuth flow (high level)
1. A client requests `/authorize` and chooses a social provider.
2. The user authenticates, then `/callback` exchanges the code for tokens.
3. The server binds the identity to a Vault keypair and exposes wallet tools.

## Notes

- This server is configured for Algorand Mainnet by default; update `ALGORAND_NETWORK`, `ALGORAND_ALGOD`, and `ALGORAND_INDEXER` if you need to point elsewhere.
- ARC-90 QR codes are intended for on-demand topups and user-friendly funding flows.
