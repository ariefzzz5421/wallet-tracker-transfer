import './style.css';
import { convert, formatWallets, getDownloadMeta, makePortablePack } from './converter.js';
import { starterPacks } from './starterpacks.js';

const $ = id => document.getElementById(id);
let source = 'basedbot';
let target = 'gmgn';
let lastResult = { output: '', count: 0, wallets: [], groups: [], warnings: [] };
const names = { basedbot: 'BasedBot', gmgn: 'GMGN', notion: 'Notion', fomo: 'Fomo' };
const platformOrder = ['basedbot', 'gmgn', 'notion', 'fomo'];
const examples = [
  { address:'0xa8bc99324c7d69533ae5fd2c4a9bb8a58be9e02a', emoji:'👀', name:'nhk06.eth', groups:['CABAL'] },
  { address:'0x56398aeeb0e7741ecc56e1404f6a3b429c4f0e8b', emoji:'🐋', name:'Cabal 1', groups:['CABAL'] },
  { address:'0x3b6db380305e57076a25621d8de6b6a51a148976', emoji:'🔎', name:'Whale Scout', groups:['WHALE'] },
];

function platformIcon(id) {
  const ext = id === 'fomo' || id === 'notion' ? 'svg' : 'png';
  return `/logos/${id}.${ext}`;
}

function chooseOther(id) {
  if (id === 'gmgn') return 'basedbot';
  if (id === 'basedbot') return 'gmgn';
  if (id === 'notion') return 'gmgn';
  return 'gmgn';
}

function tabs() {
  for (const side of ['source','target']) {
    const current = side === 'source' ? source : target;
    $(side+'-tabs').replaceChildren(...platformOrder.map(id => {
      const b = document.createElement('button');
      b.className = 'platform' + (current === id ? ' active' : '');
      b.disabled = id === 'fomo';
      b.setAttribute('aria-pressed', String(current === id));
      const img = document.createElement('img');
      img.src = platformIcon(id); img.alt = ''; img.width = 22; img.height = 22;
      b.append(img, document.createTextNode(names[id]));
      if (id === 'fomo') { const badge = document.createElement('small'); badge.textContent = 'Soon'; b.append(badge); }
      b.addEventListener('click', () => {
        if (side === 'source') { source = id; if (target === id || target === 'fomo') target = chooseOther(id); }
        else { target = id; if (source === id || source === 'fomo') source = chooseOther(id); }
        tabs(); render();
      });
      return b;
    }));
  }

  if (source === 'basedbot') $('input').placeholder = 'Paste BasedBot wallets…\n\n0x…  👀  wallet name';
  else if (source === 'gmgn') $('input').placeholder = 'Paste GMGN JSON…\n\n[{ "address": "0x…", "name": "wallet name" }]';
  else $('input').placeholder = 'Paste rows copied from Notion…\n\nAddress\tName\tEmoji\tGroup';
}

function status(message, error = false) {
  $('status').textContent = message;
  $('status').className = error ? 'error' : '';
}

function safeSlug(value) {
  return String(value || 'wallets').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'wallets';
}

function downloadText(text, filename, mime) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function renderGroups() {
  const wrap = $('group-summary');
  const list = $('group-list');
  list.replaceChildren();
  const groups = lastResult.groups || [];
  wrap.hidden = !groups.length;
  if (!groups.length) return;
  $('group-count').textContent = `${groups.length} group${groups.length === 1 ? '' : 's'} preserved`;
  const preserveGroups = $('group-prefix').checked;
  for (const group of groups) {
    const item = document.createElement('button');
    item.className = 'group-chip';
    item.type = 'button';
    const name = document.createElement('span'); name.textContent = group.name;
    const count = document.createElement('small'); count.textContent = String(group.count);
    const arrow = document.createElement('b'); arrow.textContent = '↓';
    item.append(name, count, arrow);
    item.title = `Download only ${group.name}`;
    item.addEventListener('click', () => {
      const wallets = lastResult.wallets.filter(w => w.groups.includes(group.name));
      const meta = getDownloadMeta(target);
      const output = formatWallets(wallets, target, { preserveGroups });
      downloadText(output, `${safeSlug(target)}-${safeSlug(group.name)}.${meta.extension}`, meta.mime);
      status(`Downloaded ${group.count} wallet${group.count === 1 ? '' : 's'} from ${group.name}.`);
    });
    list.append(item);
  }
}

function render() {
  const text = $('input').value;
  $('input-empty').hidden = !!text;
  $('clear').hidden = !text;
  $('copy').textContent = 'Copy result ▢';
  $('input').removeAttribute('aria-invalid');
  const preserveGroups = $('group-prefix').checked;
  try {
    lastResult = convert(text, source, target, { preserveGroups });
    $('output').value = lastResult.output;
    $('input-count').textContent = `${lastResult.count.toLocaleString()} wallets`;
    $('output-count').textContent = lastResult.count ? `${lastResult.count.toLocaleString()} wallets translated` : 'Ready when you are';
    $('copy').disabled = !lastResult.output;
    $('download').disabled = !lastResult.output;
    $('download-pack').disabled = !lastResult.output;
    $('output-empty').hidden = !!lastResult.output;
    status(lastResult.warnings.join(' '));
    renderGroups();
  } catch(e) {
    lastResult = { output: '', count: 0, wallets: [], groups: [], warnings: [] };
    $('output').value = '';
    $('copy').disabled = true;
    $('download').disabled = true;
    $('download-pack').disabled = true;
    $('output-empty').hidden = true;
    $('group-summary').hidden = true;
    $('input-count').textContent = 'Check input';
    $('output-count').textContent = 'Waiting for valid input';
    $('input').setAttribute('aria-invalid','true');
    status(e.message, true);
  }
}

function exampleForSource() {
  if (source === 'gmgn') return JSON.stringify(examples.map(({address,name,emoji}) => ({address,name,emoji})), null, 2);
  if (source === 'notion') return ['Address\tName\tEmoji\tGroup', ...examples.map(w => `${w.address}\t${w.name}\t${w.emoji}\t${w.groups.join(' | ')}`)].join('\n');
  return examples.map(w => `${w.address}  ${w.emoji}  ${w.name}`).join('\n');
}

function renderStarterPacks() {
  const grid = $('starter-grid');
  grid.replaceChildren(...starterPacks.map((pack, index) => {
    const card = document.createElement('article');
    card.className = 'starter-card';
    const icon = document.createElement('img'); icon.src = '/logos/notion.svg'; icon.alt = ''; icon.width = 30; icon.height = 30;
    const body = document.createElement('div');
    const title = document.createElement('h3'); title.textContent = pack.title;
    const meta = document.createElement('p'); meta.textContent = `Source ${String(index + 1).padStart(2, '0')} · Notion database`;
    body.append(title, meta);
    const actions = document.createElement('div'); actions.className = 'starter-actions';
    const open = document.createElement('a'); open.href = pack.url; open.target = '_blank'; open.rel = 'noreferrer'; open.textContent = 'Open ↗';
    const use = document.createElement('button'); use.type = 'button'; use.textContent = 'Use pack';
    use.addEventListener('click', () => {
      source = 'notion'; if (target === 'notion') target = 'gmgn'; tabs();
      window.open(pack.url, '_blank', 'noopener,noreferrer');
      status('Notion source selected. Copy the table rows in Notion, come back, then paste here — Group/Folder/Category columns are detected automatically.');
      $('input').focus();
    });
    actions.append(open, use); card.append(icon, body, actions); return card;
  }));
}

$('input').addEventListener('input', render);
$('group-prefix').addEventListener('change', render);
$('clear').addEventListener('click', () => { $('input').value=''; render(); $('input').focus(); });
$('example').addEventListener('click', () => { $('input').value = exampleForSource(); render(); });
$('paste').addEventListener('click', async () => {
  try { $('input').value = await navigator.clipboard.readText(); render(); }
  catch { status('Clipboard access is unavailable. Click the input and paste with Ctrl / ⌘ + V.', true); $('input').focus(); }
});
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('output').value); $('copy').textContent = 'Copied ✓'; status(`Copied. Paste into ${names[target]}’s import.`); }
  catch { $('output').focus(); $('output').select(); status('Select and copy the result with Ctrl / ⌘ + C.', true); }
});
$('download').addEventListener('click', () => {
  if (!lastResult.output) return;
  const meta = getDownloadMeta(target);
  downloadText(lastResult.output, `${safeSlug(target)}-wallets.${meta.extension}`, meta.mime);
  status(`Downloaded ${lastResult.count} translated wallet${lastResult.count === 1 ? '' : 's'}.`);
});
$('download-pack').addEventListener('click', () => {
  if (!lastResult.wallets.length) return;
  const pack = makePortablePack(lastResult.wallets, { source, target });
  downloadText(pack, 'wallettranslate-grouped-pack.json', 'application/json');
  status('Downloaded portable grouped pack. This keeps original names, emojis, and group metadata.');
});
$('swap').addEventListener('click', () => {
  const result = $('output').value;
  if ($('input').value.trim() && !result) { status('Fix the input before swapping platforms.', true); return; }
  [source,target] = [target,source];
  $('input').value = result;
  tabs(); render();
});

tabs();
renderStarterPacks();
render();
