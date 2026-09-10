export const LIMIT = 2000;
const evm = /^0x[0-9a-fA-F]{40}$/;
const base58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export function validAddress(value) {
  if (evm.test(value)) return true;
  if (!base58.test(value)) return false;
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n = 0n;
  for (const char of value) n = n * 58n + BigInt(alphabet.indexOf(char));
  let bytes = 0; while (n > 0n) { bytes++; n >>= 8n; }
  return bytes + (value.match(/^1*/)?.[0].length || 0) === 32;
}
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
function splitLabel(label) {
  const first = [...segmenter.segment(label)][0]?.segment || '';
  if (/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(first)) return { emoji: first, name: label.slice(first.length).trim() };
  return { emoji: '', name: label };
}
export function convert(text, source, target) {
  if (!['basedbot','gmgn'].includes(source) || !['basedbot','gmgn'].includes(target)) throw new Error('Fomo support is coming soon.');
  if (!text.trim()) return { output: '', count: 0, warnings: [] };
  if (text.length > 2000000) throw new Error('This export is too large. Paste up to 2,000 wallets.');
  let wallets;
  if (source === 'gmgn') {
    try { wallets = JSON.parse(text); } catch { throw new Error('Invalid GMGN JSON. Copy the complete export, including [ and ].'); }
    if (!Array.isArray(wallets)) throw new Error('GMGN export must be a JSON array: [{ "address": "…", "name": "…" }].');
    wallets = wallets.map((w, i) => {
      if (!w || typeof w !== 'object' || typeof w.address !== 'string') throw new Error(`Wallet ${i + 1}: missing address.`);
      for (const key of ['name','emoji']) if (w[key] != null && typeof w[key] !== 'string') throw new Error(`Wallet ${i + 1}: ${key} must be text.`);
      if (w.groups != null && (!Array.isArray(w.groups) || w.groups.some(g => typeof g !== 'string'))) throw new Error(`Wallet ${i + 1}: groups must be a list of names.`);
      if ([w.name,w.emoji,...(w.groups || [])].some(v => /[\r\n\t]/.test(v || ''))) throw new Error(`Wallet ${i + 1}: labels must be on one line.`);
      return { address: w.address.trim(), name: w.name || '', emoji: w.emoji || '', groups: w.groups || [] };
    });
  } else {
    wallets = text.split(/\r?\n/).map((line, i) => ({ line: line.trim(), i })).filter(x => x.line).map(({line,i}) => {
      const [address, ...rest] = line.split(/\s+/u);
      if (!validAddress(address)) throw new Error(`Line ${i + 1}: invalid wallet address. Use one complete address per line.`);
      return { address, ...splitLabel(rest.join(' ')), groups: [] };
    });
  }
  if (wallets.length > LIMIT) throw new Error('Too many wallets. Split your export into batches of 2,000.');
  wallets.forEach((w,i) => { if (!validAddress(w.address)) throw new Error(`Wallet ${i + 1}: invalid or incomplete address.`); });
  const unique = new Set(wallets.map(w => evm.test(w.address) ? w.address.toLowerCase() : w.address));
  const warnings = [];
  if (unique.size < wallets.length) warnings.push(`${wallets.length - unique.size} duplicate address(es) kept. Review before importing.`);
  if (source === 'gmgn' && target === 'basedbot') warnings.push('Alert settings do not transfer. Groups, if present, are included in the label.');
  const output = target === 'gmgn' ? JSON.stringify(wallets, null, 2) : wallets.map(w => [w.address, w.emoji, w.name, ...w.groups].filter(Boolean).join('  ')).join('\n');
  return { output, count: wallets.length, warnings };
}
