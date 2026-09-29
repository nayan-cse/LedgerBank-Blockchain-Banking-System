# LedgerBank - Assignment 3

A local blockchain banking DApp: customer registration, account creation, actual test-ETH deposits/withdrawals, internal transfers, balances, immutable event history, verifiable JSON/printable receipts, and administrator controls.

## Run locally (Windows, macOS or Linux)

1. Install **Node.js 24 LTS** from <https://nodejs.org/>. Node 22+ is supported; evaluation used Node 24.19.0.
2. Extract the entire ZIP. Open `LedgerBank_Assignment_3`, the folder containing `package.json`.
3. On Windows, click the File Explorer address bar, type `cmd`, press Enter. On other systems, open a terminal in the project folder.
4. Run, one command at a time:

   ```sh
   npm ci
   npm start
   ```

5. Wait for `LedgerBank ready at http://localhost:3000` and open <http://localhost:3000> in your browser. Keep the terminal open.

No Docker, XAMPP, database installation or browser-wallet extension is required. Startup compiles the contract, starts Ganache on loopback port 8545, deploys or reuses the bank, and serves the interface on port 3000. Installation requires internet; normal local use can be offline. If Assignment 1 or 2 is still running, stop that project's terminal with Ctrl+C first because the default ports are shared.

Stop with **Ctrl+C**. Restart later with `npm start`. Keep the full `data/` directory: it contains the persistent blockchain and deployment metadata. Histories and receipts are reconstructed from that blockchain. The ZIP excludes `data/` and `node_modules`.

## Understand the two balances

| Value | Meaning |
|---|---|
| External wallet | Ganache gives each demo wallet 1,000 synthetic ETH. The wallet pays blockchain gas fees and funds deposits. |
| Bank account balance | Starts at zero. The contract credits only ETH successfully deposited through `deposit()`. |
| Deposit | Wallet sends ETH to the bank vault; its bank balance rises by that exact amount. |
| Withdrawal | Bank balance decreases; the vault pays the same ETH amount back to the customer wallet. |
| Transfer | Moves bank balance between two active registered accounts; vault assets and total liabilities remain unchanged. |

All monetary values use integer **wei** (1 ETH = 10^18 wei). The app parses decimal input directly to BigInt. Gas is paid separately from the external wallet; it is not deducted from the bank ledger balance. This is a synthetic cryptocurrency banking model, not a connection to fiat accounts or real banks.

## Fast live demo

With the application running, open a second terminal in the same project folder:

```sh
npm run demo
```

It registers and opens Customer A and B accounts if needed, then performs:

1. Customer A deposits 1 test ETH.
2. Customer A transfers 0.25 bank ETH to Customer B.
3. Customer A withdraws 0.10 ETH back to its external wallet.

On fresh accounts, bank balances become **A = 0.65 ETH, B = 0.25 ETH**, and the vault holds **0.90 ETH**. External balances also include gas costs. Each rerun makes these payments again with new request IDs; it does not reset existing balances.

Receipts are written to `data/demo/receipt-deposit.json`, `receipt-transfer.json`, `receipt-withdrawal.json` and `receipt-tampered.json`. Upload the transfer receipt under **Verify a receipt**: VERIFIED. Upload the altered receipt: ALTERED. If an administrator paused the bank or froze a demo account, restore its status before running the demo.

## Manual walkthrough of every requirement

| Step | Account | Action |
|---|---|---|
| 1 | Customer A | Customer registration: use a fictional name and reference, then register. Keep the downloaded registration receipt if desired. |
| 2 | Customer A | Click Create account. It begins at zero bank balance. |
| 3 | Customer B | Register and create the second account. |
| 4 | Customer A | Overview > Deposit: enter 1 ETH, a reference if desired, and confirm. |
| 5 | Customer A | Transfer: enter 0.25 ETH and Customer B's wallet address; confirm. |
| 6 | Customer A | Withdraw: enter 0.10 ETH and confirm. |
| 7 | A / B | Refresh balances and open Transaction history. Transfers show outgoing/incoming directions. |
| 8 | Either account | Open Receipt, download JSON or Print / save as PDF. |
| 9 | Either account | Verify the original JSON and an edited copy. |
| 10 | Administrator | Review account/vault totals, freeze or unfreeze a customer, pause or resume operations, and inspect events. |

Freezing blocks deposits, withdrawals and transfers in both directions for that account. Pausing blocks all value operations and new customer/account creation. Read-only balances, history and receipts stay available. Only the administrator can change these controls; it cannot directly edit, withdraw or seize customer balances.

## Interrupted and duplicate requests

Before sending a payment the browser saves a random request ID and exact parameters in localStorage, scoped to the wallet, chain and bank. The contract stores the sequence of each successful request. The same wallet cannot execute the same ID twice, even as a different operation.

If a response is interrupted, the pending banner can check the original request or retry its exact ID. A duplicate cannot debit twice, although a submitted reverting duplicate may still consume gas. Dismissing the reminder does **not** cancel an already submitted transaction. Check its status/history before making a new request. Clearing browser storage loses this local reminder but not the on-chain transaction.

This protection covers retries of the same ID. Two deliberately new IDs are two separate payments. The demo script also intentionally creates new payments each run.

## Independently verify a receipt

The CLI reads the trusted RPC directly; it does not use the application's receipt HTTP endpoint:

```sh
npm run verify-receipt -- data/demo/receipt-transfer.json
```

Defaults: contract from your own `data/deployment.json`, chain 31337, RPC `http://127.0.0.1:8545`. To choose another trusted configuration:

```sh
npm run verify-receipt -- receipt.json --rpc http://127.0.0.1:8545 --bank 0xYOUR_BANK_ADDRESS --chain 31337
```

Replace the address placeholder with a real deployed bank address obtained from a trusted source. Do not trust only the address written in an untrusted receipt. Exit 0 means verified; 2 means a non-valid receipt; input/network errors exit nonzero.

Receipt fields include the operation, bank, chain, transaction/block hashes, block/time, amount, parties, bank balances after the operation, gas used, effective price, fee, request ID and memo hash. Every field must match. A receipt is reconstructed from the bank's event and mined transaction, not signed by an off-chain PDF issuer. A copy of the printout must be compared with its verified source.

## Tests and reproducible evaluation

These commands use fresh isolated chains and do not change your application's `data/` directory. Your app need not be running:

```sh
npm test
npm run benchmark
```

To execute syntax checks, all tests, the live demo/CLI integration, and the benchmark with saved logs:

```sh
npm run evaluate
```

The full evaluation takes several minutes. Workload settings:

- 20 measured deposits, withdrawals and transfers each, following 2 warmups per operation.
- Transaction loads of 30, 60 and 120 at 4 concurrent customers, 3 runs per load.
- 120 transactions at concurrency 1 and 8, 3 runs each; the concurrency-4 runs are reused for comparison.
- Exactly 15 load runs and 1,350 attempted load transactions, equally divided among the 3 operations.
- Every run uses a fresh Node process and fresh local chain. Enrollment/prefunding are outside the timed load. Load calls use explicit nonces and a 300,000 gas limit; workflow calls perform normal gas estimation. Fees always use actual receipt gas, not the gas limit.
- CPU is process user+system time / wall time; both one-core percentage and logical-CPU-normalized percentage are recorded.
- Memory is process RSS sampled every 50 ms. If current RSS is unavailable, a clearly labeled process-lifetime peak fallback is used.
- Resource scope is the worker containing EVM, RPC client and load driver, plus the HTTP server in workflow mode. Browser and parent orchestrator are excluded.

Raw files under `evidence/`: benchmark-results.json, transactions.csv, scalability.csv, test logs, test summary, CLI results and receipt samples. The results include exact fee arithmetic, post-run sum-of-balances reconciliation, CPU samples and RSS samples. Re-running overwrites evidence, not the supplied PDF. Regenerate the report separately using `tools/build_report.py` if you want it to reflect a new run.

Historical receipt samples in `evidence/` belong to the evaluation chains, not a fresh `npm start` instance. Use `npm run demo` to create live receipts on your own local bank.

## Project structure

| Path | Responsibility |
|---|---|
| `contracts/LedgerBank.sol` | Account state, actual ETH custody, internal transfers, admin controls, idempotency and events. |
| `contracts/TestActors.sol` | Test-only reentrant/rejecting customer and forced-ETH helper; never deployed by normal startup. |
| `lib/money.mjs` | Exact amount parsing, random request IDs and salted customer commitments. |
| `lib/receipts.mjs` | Reconstruct and verify immutable transaction receipts. |
| `lib/runtime.mjs` | Persistent Ganache chain and deployment lifecycle. |
| `lib/server.mjs` | Local HTTP/RPC interface, balances, history, receipts and dashboard. |
| `lib/resources.mjs` | CPU/RSS snapshots and resource monitoring. |
| `public/` | Responsive banking interface and printable receipt. |
| `scripts/` | Startup, live demo, tests/evaluation, direct receipt verifier and optional external deployment. |
| `tests/system.test.mjs` | 33 functional, accounting, security, API and restart checks. |
| `artifacts/LedgerBank.json` | Compiled ABI/bytecode, compiler settings and source fingerprint. |
| `docs/` | Report, requirement mapping, architecture and viva guide. |
| `evidence/` | Actual historical evaluation results. |

## Security and scope limits

- Use **synthetic local ETH only**. Demo wallets are deterministic and unlocked; the selector intentionally lets one demonstrator act as different customers. Do not expose this RPC or app to the internet or use these keys with real assets.
- Solidity uses `msg.sender`, checked uint256 arithmetic, positive-amount/available-balance checks, unique request IDs, checks-effects-interactions and a shared reentrancy guard. The withdrawal test includes a malicious receiver; failed payments roll back balances and request state.
- The accounting invariant is `sum(customer bank balances) == totalLiabilities <= vault ETH`. A forced ETH transfer can create surplus; it is not credited to any customer, and this contract has no admin surplus-withdrawal function.
- Customer commitments are salted; they are not real KYC, account recovery or identity verification. Wallet keys control balances. Lost keys are not recoverable through an administrator.
- The administrator can freeze or pause service, including withdrawals. This trusted governance power requires stronger controls in a real deployment.
- Blockchain addresses, amounts and transaction relationships are public. Plain references are hashed, not encrypted, and short predictable references can still be guessed. There is no banking privacy/compliance claim.
- The local EVM, RPC and interface operate on one computer. The experiment does not demonstrate independently operated consensus nodes, public-chain finality, reorg resilience or disaster recovery. Keep stopped-data backups.
- Browser-wallet support is optional. Configure local chain 31337 and RPC `http://127.0.0.1:8545`; new wallet addresses need local test ETH for gas and deposits, then registration/account creation. No automatic faucet is exposed.
- One receipt represents one BankTransaction event in one transaction, including a forwarding smart-account transaction. Multi-operation aggregator transactions are outside the receipt format.
- History scans contract logs and displays 25 at a time; admin audit displays the latest 100. A production indexer and long-history pagination strategy are future work.
- Automated validation covers live contracts, APIs, ledger reconciliation, adversarial receivers, receipt integrity, CLI workflows and restart. Browser clicks, external wallet integration and print layout need manual checks on your computer; no browser automation was performed.

## Troubleshooting

**Node/npm not recognized:** install Node.js 24 LTS, reopen the terminal, then check `node --version` and `npm --version`.

**PowerShell rejects npm.ps1:** use Command Prompt or `npm.cmd ci` and `npm.cmd start`; do not change execution policy just for this project.

**EPERM / EBUSY / partially installed Ganache on Windows:** stop this project's running Node terminal and close programs holding its dependency files. If still locked, restart Windows. In the project folder, use Command Prompt to remove only dependencies and reinstall:

```bat
rmdir /s /q node_modules
npm ci
```

Preserve `data/` and `package-lock.json`. A short writable folder such as `C:\Projects\LedgerBank` can avoid path-length issues. Never run simultaneous installs in the same folder.

**EBADPLATFORM / fsevents:** the delivered lock avoids a mandatory macOS-only watcher. If you regenerate a lock that contains this issue, run `node scripts/fix-lock.mjs`, then `npm ci`.

**µWS compatibility warning:** Ganache falls back to JavaScript on this Node build. This warning is expected and the benchmark used that fallback. Continue until the ready message appears.

**Port in use:** stop the previous assignment or LedgerBank process. Advanced overrides are `PORT` and `RPC_PORT`; update CLI/browser settings accordingly.

**Bank balance is zero:** opening an account does not fund it. Deposit from the separate external wallet first. Gas also needs external wallet ETH.

**Frozen/paused message:** select Administrator and restore the appropriate control. A failed payment does not debit the ledger; a mined failed transaction can still cost gas.

**Source mismatch after editing Solidity:** preserve old data; choose a new `DATA_DIR` for a fresh deployment or restore the matching source. The optional `npm run deploy` script deploys only the contract to an explicitly configured external RPC; it does not migrate this local application automatically.