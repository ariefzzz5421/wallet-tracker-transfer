export const LIMIT = 2000;
const MAX_TEXT = 2_000_000;
const evm = /^0x[0-9a-fA-F]{40}$/;
const base58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const platforms = new Set(['basedbot', 'gmgn', 'notion']);
const addressHeaders = new Set(['address', 'wallet', 'walletaddress', 'walletaddresssol', 'publickey', 'pubkey', 'ca']);
const nameHeaders = new Set(['name', 'label', 'nickname', 'remark', 'note', 'walletname', 'walletlabel']);
const emojiHeaders = new Set(['emoji', 'icon', 'symbol']);
const groupHeaders = new Set(['group', 'groups', 'folder', 'category', 'tag', 'tags', 'cluster', 'list', 'walletgroup']);

export function validAddress(value) {
  if (evm.test(value)) return true;
  if (!base58.test(value)) return false;
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n = 0n;
  for (const char of value) n = n * 58n + BigInt(alphabet.indexOf(char));
  let bytes = 0;
  while (n > 0n) { bytes++; n >>= 8n; }
  return bytes + (value.match(/^1*/)?.[0].length || 0) === 32;
}

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
function splitLabel(label = '') {
  const clean = String(label).trim();
  const first = [...segmenter.segment(clean)][0]?.segment || '';
  if (/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(first)) {
    return { emoji: first, name: clean.slice(first.length).trim() };
  }
  return { emoji: '', name: clean };
}

function normalizeHeader(value = '') {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cleanOneLine(value = '') {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim();
}

function splitGroups(value) {
  const values = Array.isArray(value) ? value : String(value ?? '').split(/[|;,]+/);
  return [...new Set(values.map(cleanOneLine).filter(Boolean))];
}

function normalizeWallet(raw, index) {
  if (!raw || typeof raw !== 'object') throw new Error(`Wallet ${index + 1}: invalid record.`);
  const address = cleanOneLine(raw.address ?? raw.wallet ?? raw.walletAddress ?? raw.publicKey ?? raw.pubkey ?? '');
  if (!address) throw new Error(`Wallet ${index + 1}: missing address.`);
  if (!validAddress(address)) throw new Error(`Wallet ${index + 1}: invalid or incomplete address.`);

  const rawName = raw.name ?? raw.label ?? raw.nickname ?? raw.remark ?? raw.note ?? '';
  const rawEmoji = raw.emoji ?? raw.icon ?? raw.symbol ?? '';
  const rawGroups = raw.groups ?? raw.group ?? raw.folder ?? raw.category ?? raw.tags ?? raw.tag ?? raw.cluster ?? '';
  if (rawName != null && typeof rawName !== 'string') throw new Error(`Wallet ${index + 1}: name must be text.`);
  if (rawEmoji != null && typeof rawEmoji !== 'string') throw new Error(`Wallet ${index + 1}: emoji/icon must be text.`);
  if (rawGroups != null && !Array.isArray(rawGroups) && typeof rawGroups !== 'string') throw new Error(`Wallet ${index + 1}: groups must be text or a list of names.`);
  if (Array.isArray(rawGroups) && rawGroups.some(v => typeof v !== 'string')) throw new Error(`Wallet ${index + 1}: groups must contain text names.`);
  if ([rawName, rawEmoji, ...(Array.isArray(rawGroups) ? rawGroups : [rawGroups])].some(v => /[\r\n\t]/.test(v || ''))) throw new Error(`Wallet ${index + 1}: labels must be on one line.`);

  const parsedName = splitLabel(rawName);
  const emoji = cleanOneLine(rawEmoji) || parsedName.emoji;
  const name = parsedName.name;
  const groups = splitGroups(rawGroups);
  return { address, name, emoji, groups };
}

function parseJson(text, label) {
  try { return JSON.parse(text); }
  catch { throw new Error(`Invalid ${label} JSON. Copy the complete export.`); }
}

function unwrapPortablePack(parsed) {
  if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.wallets)) return parsed.wallets;
  return parsed;
}

function parseGmgn(text) {
  const parsed = unwrapPortablePack(parseJson(text, 'GMGN'));
  if (!Array.isArray(parsed)) throw new Error('GMGN export must be a JSON array.');
  return parsed.map(normalizeWallet);
}

function parseBasedBot(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = unwrapPortablePack(parseJson(trimmed, 'BasedBot'));
    if (!Array.isArray(parsed)) throw new Error('BasedBot JSON export must contain a wallet array.');
    return parsed.map(normalizeWallet);
  }

  const wallets = [];
  let activeGroup = '';
  text.split(/\r?\n/).forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line) return;
    const groupHeader = line.match(/^#\s*group\s*:\s*(.+)$/i) || line.match(/^\[group\s*:\s*(.+)\]$/i);
    if (groupHeader) { activeGroup = cleanOneLine(groupHeader[1]); return; }
    const [address, ...rest] = line.split(/\s+/u);
    if (!validAddress(address)) throw new Error(`Line ${i + 1}: invalid wallet address. Use one complete address per line.`);
    wallets.push({ address, ...splitLabel(rest.join(' ')), groups: activeGroup ? [activeGroup] : [] });
  });
  return wallets;
}

function parseDelimitedLine(line, delimiter) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(cell.trim()); cell = '';
    } else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

function parseNotion(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = unwrapPortablePack(parseJson(trimmed, 'Notion'));
    if (!Array.isArray(parsed)) throw new Error('Notion JSON must contain a wallet array.');
    return parsed.map(normalizeWallet);
  }

  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) return [];
  const delimiter = lines.some(line => line.includes('\t')) ? '\t' : ',';
  const rows = lines.map(line => parseDelimitedLine(line, delimiter));
  const headers = rows[0].map(normalizeHeader);
  const addressIndex = headers.findIndex(h => addressHeaders.has(h));
  const hasHeader = addressIndex !== -1;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const indexFor = set => headers.findIndex(h => set.has(h));
  const indexes = hasHeader ? {
    address: addressIndex,
    name: indexFor(nameHeaders),
    emoji: indexFor(emojiHeaders),
    group: indexFor(groupHeaders),
  } : { address: 0, name: 1, emoji: 2, group: 3 };

  if (!hasHeader && !validAddress(cleanOneLine(dataRows[0]?.[0] || ''))) {
    throw new Error('Notion paste needs an Address/Wallet column, or the wallet address in the first column.');
  }

  return dataRows.filter(row => row.some(cell => String(cell).trim())).map((row, i) => normalizeWallet({
    address: row[indexes.address] ?? '',
    name: indexes.name >= 0 ? row[indexes.name] : '',
    emoji: indexes.emoji >= 0 ? row[indexes.emoji] : '',
    groups: indexes.group >= 0 ? row[indexes.group] : '',
  }, i));
}

export function parseWallets(text, source) {
  if (!platforms.has(source)) throw new Error('This source platform is not supported yet.');
  if (!text.trim()) return [];
  if (text.length > MAX_TEXT) throw new Error('This export is too large. Paste up to 2,000 wallets.');
  let wallets;
  if (source === 'gmgn') wallets = parseGmgn(text);
  else if (source === 'notion') wallets = parseNotion(text);
  else wallets = parseBasedBot(text);
  if (wallets.length > LIMIT) throw new Error('Too many wallets. Split your export into batches of 2,000.');
  return wallets;
}

function groupPrefix(groups) {
  return groups?.length ? `[${groups.join(' / ')}]` : '';
}

function displayName(wallet, preserveGroups) {
  const prefix = preserveGroups ? groupPrefix(wallet.groups) : '';
  return [prefix, wallet.name].filter(Boolean).join(' ').trim();
}

function tsvCell(value) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim();
}

export function formatWallets(wallets, target, options = {}) {
  if (!platforms.has(target)) throw new Error('This destination platform is not supported yet.');
  const preserveGroups = options.preserveGroups !== false;
  if (target === 'gmgn') {
    return JSON.stringify(wallets.map(w => ({
      address: w.address,
      ...(displayName(w, preserveGroups) ? { name: displayName(w, preserveGroups) } : {}),
      ...(w.emoji ? { emoji: w.emoji } : {}),
    })), null, 2);
  }
  if (target === 'notion') {
    const header = ['Address', 'Name', 'Emoji', 'Groups'];
    const rows = wallets.map(w => [w.address, w.name, w.emoji, w.groups.join(' | ')]);
    return [header, ...rows].map(row => row.map(tsvCell).join('\t')).join('\n');
  }
  return wallets.map(w => [w.address, w.emoji, displayName(w, preserveGroups)].filter(Boolean).join('  ')).join('\n');
}

export function summarizeGroups(wallets) {
  const counts = new Map();
  for (const wallet of wallets) for (const group of wallet.groups) counts.set(group, (counts.get(group) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }));
}

export function makePortablePack(wallets, meta = {}) {
  return JSON.stringify({ schema: 'wallettranslate/v1', ...meta, wallets }, null, 2);
}

export function getDownloadMeta(target) {
  if (target === 'gmgn') return { extension: 'json', mime: 'application/json' };
  if (target === 'notion') return { extension: 'tsv', mime: 'text/tab-separated-values' };
  return { extension: 'txt', mime: 'text/plain' };
}

export function convert(text, source, target, options = {}) {
  if (source === 'fomo' || target === 'fomo') throw new Error('Fomo support is coming soon.');
  const wallets = parseWallets(text, source);
  if (!wallets.length) return { output: '', count: 0, warnings: [], wallets: [], groups: [] };

  const unique = new Set(wallets.map(w => evm.test(w.address) ? w.address.toLowerCase() : w.address));
  const warnings = [];
  if (unique.size < wallets.length) warnings.push(`${wallets.length - unique.size} duplicate address(es) kept. Review before importing.`);
  const groups = summarizeGroups(wallets);
  if (groups.length && target === 'gmgn') warnings.push('GMGN bulk import does not document wallet-group fields. Groups are preserved as [GROUP] name prefixes and in grouped downloads.');
  if (groups.length && target === 'basedbot') warnings.push('Groups are preserved in the wallet label and grouped downloads.');
  if (source === 'gmgn' && target === 'basedbot') warnings.push('GMGN alert settings do not transfer to BasedBot.');

  return {
    output: formatWallets(wallets, target, options),
    count: wallets.length,
    warnings,
    wallets,
    groups,
  };
}
