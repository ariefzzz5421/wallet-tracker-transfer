# Wallet Translate

A small, browser-only translator for tracked wallet exports. BasedBot ↔ GMGN, with Fomo marked Coming soon.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
npm test
npm run build
```

Paste an export, choose the source and destination, then copy the automatically converted result. Swap transfers the result into the source panel. No account, backend, wallet connection, storage, or wallet-data network requests.

## Supported formats

- BasedBot: one full address per line, optionally followed by an emoji and label. Spaced names and trailing group text are kept as labels because plain text cannot reliably distinguish group names.
- GMGN: JSON array containing `address`, optional `name`, `emoji`, and `groups`. Export alert fields are accepted but cannot transfer to BasedBot. GMGN import output uses the fields shown in the supplied import screenshot. Groups are appended to labels when converting to BasedBot.
- Complete EVM addresses and base58-encoded 32-byte Solana addresses. The destination tracker must use the matching chain; this tool does not infer a chain from an EVM address.
- Maximum 2,000 records and 2 MB of text. Invalid records block conversion; duplicates are retained and reported.

Formats are based on user-supplied September 9, 2026 screenshots. Automated tests verify format transformation, not authenticated import acceptance inside the third-party platforms. No private keys or trading functions.

## Assets

Platform marks belong to their respective owners. BasedBot mark: https://basedbot.tech/icon.png. GMGN mark: https://basedbot.tech/Images/Terminals/logomarks/card-gmgn.png. Fomo mark: https://fomo.family/favicon.svg. The site is independent and unaffiliated. DM Sans is loaded from Google Fonts; wallet data remains on-device.

## Deployment

Vite static output is built into `dist`. `vercel.json` configures the build and security headers. Deploy with `npx vercel deploy`. No environment variables required.
