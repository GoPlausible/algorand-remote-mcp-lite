# Algorand Remote MCP Lite (Wallet Edition)


Algorand Remote MCP Lite is a wallet-first Model Context Protocol server for Algorand. It is a trimmed version of the full remote MCP, intentionally limited to 40 tools to keep the surface area focused on agentic wallet workflows. It runs on Algorand Mainnet by default and signs transactions server-side using HashiCorp Vault.

<img width="1005" height="554" alt="1_heKuf7jrjc3-aAAbGVdgLw copy" src="https://github.com/user-attachments/assets/cbf58093-8450-4769-88e3-98b6130ee740" />

## Architecture

- MCP server on Cloudflare Workers (Durable Object) that registers wallet, transaction, and API tools.
- OAuth 2.0 with PKCE and OIDC-compatible social login (Google, GitHub, Twitter/X, LinkedIn) for user identity.
- HashiCorp Vault transit signing via the `HCV_WORKER` service; private keys never leave the vault.
- Algod + Indexer APIs for on-chain state and transaction submission.
- KV namespaces for OAuth sessions, vault entity mapping, verified assets, ARC-26 QR/receipt caching, and AP2 storage.

## Design

- Wallet edition: minimal, curated tool set that behaves like an agentic wallet.
- Server-side signing: the LLM never receives mnemonics or private keys.
- Mainnet-first: examples and defaults target mainnet assets and apps.
- Modular tooling: wallet, transactions, indexer, NFD, Pera verified assets, and Tinyman swaps are separate tool groups.

## OAuth + OIDC and Agentic Wallets

- Users authenticate via OAuth/OIDC providers; approval and PKCE flows are handled in `src/oauth-handler.ts` and `src/oauth-provider.ts`.
- After login, `ensureUserAccount` binds the social identity (provider + email) to a Vault entity and transit key.
- The wallet address is derived from the Vault public key and used as the agent wallet.
- Signing tools (`wallet_sign_transaction`, `wallet_sign_atomic_group`) use Vault transit so signatures are produced inside Vault.

## Features

- Agentic wallet operations: balance, assets, signing, and submission without exposing secrets.
- On-demand topup using Algorand ARC-26 QR codes (`generate_algorand_qrcode`).
- AP2 mandate generation for intent, cart, and payment flows (`generate_ap2_mandate`).
- Receipt generation with QR codes for payments and asset transfers (`generate_algorand_receipt`).
- Atomic transaction groups and asset workflows (opt-in, transfer, USDC opt-in).
- Verified asset discovery via Pera Wallet and NFD lookups.
- Tinyman swaps for fixed input and fixed output trades.

## Available Tools (40)

### Wallet
- `wallet_get_info`: Get the account information for the configured wallet
- `wallet_get_assets`: Get the assets for the configured wallet

### Account
- `sdk_check_account_balance`: Check the balance of an Algorand account

### Utility
- `sdk_validate_address`: Check if an Algorand address is valid
- `sdk_encode_address`: Encode a public key to an Algorand address
- `sdk_decode_address`: Decode an Algorand address to a public key
- `sdk_app_address_by_id`: Get the address for a given application ID
- `algorand_mcp_lite_guide`: Access comprehensive guide for using Algorand Remote MCP Lite, including step-by-step workflows, examples, and best practices.

### Algod Core
- `sdk_send_raw_transaction`: Submit signed transactions to the Algorand network

### Transactions
- `sdk_txn_payment_transaction`: Create a payment transaction on Algorand
- `wallet_sign_transaction`: Sign an Algorand transaction with your agent account
- `sdk_submit_transaction`: Submit a signed transaction to the Algorand network

### Asset Transactions
- `sdk_txn_asset_create`: Create a new Algorand Standard Asset (ASA)
- `sdk_txn_asset_optin`: Opt-in to an Algorand Standard Asset (ASA)
- `wallet_usdc_optin`: Opt-in agent wallet to USDC
- `sdk_txn_asset_transfer`: Transfer an Algorand Standard Asset (ASA)

### Atomic Groups
- `sdk_assign_group_id`: To group transactions in atomic way (one fails all fail), assign a group ID to a set of transactions for atomic execution
- `sdk_create_atomic_group`: Create an atomic transaction group from multiple transactions of types pay, axfer, acfg, appl, afrz or keyreg
- `wallet_sign_atomic_group`: Sign an atomic transaction group
- `sdk_submit_atomic_group`: Submit a signed atomic transaction group to the Algorand network

### Algod API
- `algod_get_account_info`: Get current account balance, assets, and auth address from algod
- `algod_get_account_asset_info`: Get account-specific asset information from algod
- `algod_get_asset_info`: Get asset details from algod
- `pera_verified_asset_query`: Get detailed information about an Algorand asset from Pera Wallet
- `pera_verified_assets_search`: Search PeraWallet verified Algorand asset(s) by asset name, unit name, or creator address
- `algod_get_pending_txn_info`: Get transaction details from algod by transaction ID

### Indexer API
- `indexer_lookup_account_assets`: Get account assets
- `indexer_search_for_accounts`: Search for accounts with various criteria
- `indexer_lookup_asset_balances`: Get accounts that hold a specific asset
- `indexer_search_for_assets`: Search for assets with various criteria
- `indexer_lookup_transaction_by_id`: Get transaction details from indexer
- `indexer_lookup_account_transactions`: Get transactions related to an account
- `indexer_search`: Search the Algorand indexer for accounts, transactions, assets, or applications

### NFD API
- `api_nfd_get_nfd`: Get NFD domain information by name
- `api_nfd_get_nfds_for_address`: Get all NFD names owned by an Algorand address

### ARC-26
- `generate_algorand_qrcode`: Generate a URI and QRCode of it,  following the Algorand ARC-26 specification to send account address or request payment or asset transfer

### Receipts
- `generate_algorand_receipt`: Generate a Receipt and QRCode of it, for an Algorand payment or asset transfer

### AP2
- `generate_ap2_mandate`: Create an AP2 intent, cart or payment mandate for AP2 process and flow using fields: id, type (mandate type), items, total, currency, merchant_public_key, payment_requirements, merchant_agent (id) and cart_request_id then returns an stringified object containing verifiableCredential and verifiableCredentialLink.

<!-- ### Tinyman
- `tinyman_fixed_input_swap`: Execute a swap with a fixed input amount
- `tinyman_fixed_output_swap`: Execute a swap with a fixed output amount -->

## Resources (5)

- Wallet Account Public Key (`algorand://wallet/publickey`): Returns the vault public key (base64) and role for the configured wallet.
- Wallet Account Address (`algorand://wallet/address`): Returns the wallet address derived from the vault public key.
- Wallet Account Information (`algorand://wallet/account`): Returns account balance and asset holdings for the configured wallet.
- Wallet Account Assets (`algorand://wallet/assets`): Returns the asset list for the configured wallet.
- Algorand MCP Guide (`algorand://remote-mcp-guide`): Returns the full agent guide markdown.

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
- ARC-26 QR codes are intended for on-demand topups and user-friendly funding flows.
