# Wallet Translate

Wallet-list translator and public starter-pack viewer for BasedBot, GMGN, and Notion, with Fomo marked Coming soon.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
npm test
npm run build
```

Pasted wallet conversion stays in the browser. The GuarEmperor starter-pack hub can additionally request rows from the five allowlisted **public** Notion databases through `/api/notion`; user-pasted wallet data is not sent to that endpoint.

## Supported formats

- **BasedBot:** plain text (one full address per line, optional emoji + label) and JSON wallet arrays. `# Group: NAME` / `[Group: NAME]` headers are understood for structured paste.
- **GMGN:** JSON arrays with `address`, optional `name`, and optional `emoji`. Legacy/input-only `groups` fields are accepted for migration, but GMGN output intentionally follows the documented bulk-import fields instead of inventing an unsupported group field.
- **Notion:** copied TSV/CSV rows. Common Address/Wallet, Name/Label, Emoji/Icon, and Group/Folder/Category/Tag columns are detected automatically. The GuarEmperor format `Rank / Wallet / Explorer / OpenSea / Tag` is supported directly: `Wallet` becomes the address and `Tag` becomes group metadata.
- **Addresses:** complete EVM addresses and base58-encoded 32-byte Solana addresses.
- **Limits:** maximum 2,000 pasted records and 2 MB of text. Invalid records block conversion; duplicates are retained and reported.

## Group preservation

Some destination import formats do not expose group/folder creation. Wallet Translate therefore provides:

- `[GROUP]` name-prefix fallback for destinations without a documented wallet-group import field.
- Per-group downloads.
- Direct **Copy ▾** and **Download ▾** menus for GMGN JSON or BasedBot text.
- A portable `wallettranslate/v1` JSON pack preserving names, emojis, and group metadata.
- A dedicated Notion `Groups` output column.

GMGN's public bulk-import tutorial documents `address`, `name`, and `emoji`; the app does not claim that a JSON `groups` property creates GMGN folders automatically.

## GuarEmperor starter-pack hub

The five supplied Notion sources are grouped under **GuarEmperor** with the supplied profile picture and a link to `https://x.com/GuarEmperor`.

Current public labels:

- **Project Mars Land — Top 60 Wallets**
- **Multichain High-ROI NFT Wallets**
- **NFT Wallet Trackers**
- **Stable Meme Wallets**
- **Arc Smart Money Wallets**

Open the creator card to reveal all lists and search them by title/tag. Clicking a list requests its public Notion rows and reveals a searchable table. Each list has **Open**, **Copy ▾**, and **Download ▾** actions; Copy/Download export the list directly as GMGN or BasedBot when the public Notion endpoint is available. If Notion changes or blocks the undocumented public endpoint, the original Open + paste workflow remains the fallback.

## Public Notion endpoint

`api/notion.js` is intentionally allowlisted to only the five supplied public page/view IDs. It does not accept arbitrary URLs, private Notion credentials, or user-auth tokens. It uses Notion's public web endpoints and may need adjustment if Notion changes those internal endpoints.

## Assets

Platform marks belong to their respective owners. The Notion mark is the Simple Icons Notion glyph (CC0). The GuarEmperor avatar is the user-supplied image for this project. The site is independent and unaffiliated.

## Deployment

Vite static output is built into `dist`; Vercel also serves the `/api/notion` function. No environment variables are required.
