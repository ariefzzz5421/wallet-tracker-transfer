# Wallet Translate

Browser-only translator for tracked wallet lists across BasedBot, GMGN, and Notion, with Fomo marked Coming soon.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
npm test
npm run build
```

Paste an export or copied Notion table, choose the destination, then copy or download the converted result. All conversion stays in the browser; there is no backend, wallet connection, or upload of wallet data.

## Supported formats

- **BasedBot:** plain text (one full address per line, optional emoji + label) and JSON wallet arrays. `# Group: NAME` / `[Group: NAME]` headers are understood by Wallet Translate for structured paste.
- **GMGN:** JSON arrays with `address`, optional `name`, and optional `emoji`. Legacy/input-only `groups` fields are accepted for migration, but GMGN output intentionally follows the documented bulk-import fields instead of inventing an unsupported group field.
- **Notion:** rows copied from a database/table as TSV or CSV. Common columns such as Address/Wallet, Name/Label, Emoji/Icon, and Group/Folder/Category/Tags are detected automatically. JSON wallet arrays and Wallet Translate portable packs are also accepted.
- **Addresses:** complete EVM addresses and base58-encoded 32-byte Solana addresses.
- **Limits:** maximum 2,000 records and 2 MB of text. Invalid records block conversion; duplicates are retained and reported.

## Group preservation

Some destination import formats do not expose group/folder creation. To avoid silently losing that information, Wallet Translate keeps groups in normalized in-browser data and provides:

- `[GROUP]` name-prefix fallback for destinations without a documented wallet-group import field (enabled by default and optional).
- Per-group downloads in the currently selected destination format.
- Direct **Copy ▾** and **Download ▾** menus that export the currently parsed wallet set as either GMGN JSON or BasedBot text without changing the preview destination.
- A portable `wallettranslate/v1` JSON pack that preserves original names, emojis, and `groups` metadata without flattening.
- Dedicated Notion `Groups` output column.

GMGN's public bulk-import tutorial documents `address`, `name`, and `emoji`; therefore the app does **not** claim that a JSON `groups` property will create GMGN wallet folders automatically.

## Notion starter packs

The UI includes the five supplied Notion database links as starter-pack cards with short preview titles. The first supplied reference is labelled `Project Mars Land — Top 60 Wallets`; the remaining cards use collection-level labels rather than pretending an unverified page title is known. Open one, copy the table rows, return to Wallet Translate, select Notion as the source, and paste. Then use Copy/Download menus to export directly as GMGN or BasedBot. The browser app does not fetch private Notion content or require a Notion API token.

## Assets

Platform marks belong to their respective owners. The Notion mark is the Simple Icons Notion glyph (CC0). The site is independent and unaffiliated. DM Sans is loaded from Google Fonts; wallet data remains on-device.

## Deployment

Vite static output is built into `dist`. `vercel.json` configures the build and security headers. Deploy with `npx vercel deploy`. No environment variables required.
