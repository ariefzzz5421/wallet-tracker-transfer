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
  return 'gmgn';
}

function tabs() {
  for (const side of ['source', 'target']) {
    const current = side === 'source' ? source : target;
    $(side + '-tabs').replaceChildren(...platformOrder.map(id => {
      const button = document.createElement('button');
      button.className = 'platform' + (current === id ? ' active' : '');
      button.disabled = id === 'fomo';
      button.setAttribute('aria-pressed', String(current === id));

      const img = document.createElement('img');
      img.src = platformIcon(id);
      img.alt = '';
      img.width = 22;
      img.height = 22;

      button.append(img, document.createTextNode(names[id]));
      if (id === 'fomo') {
        const badge = document.createElement('small');
        badge.textContent = 'Soon';
        button.append(badge);
      }

      button.addEventListener('click', () => {
        if (side === 'source') {
          source = id;
          if (target === id || target === 'fomo') target = chooseOther(id);
        } else {
          target = id;
          if (source === id || source === 'fomo') source = chooseOther(id);
        }
        tabs();
        render();
      });

      return button;
    }));
  }

  if (source === 'basedbot') {
    $('input').placeholder = 'Paste BasedBot wallets…\n\n0x…  👀  wallet name';
  } else if (source === 'gmgn') {
    $('input').placeholder = 'Paste GMGN JSON…\n\n[{ "address": "0x…", "name": "wallet name" }]';
  } else {
    $('input').placeholder = 'Paste rows copied from Notion…\n\nAddress\tName\tEmoji\tGroup';
  }
}

function status(message, error = false) {
  $('status').textContent = message;
  $('status').className = error ? 'error' : '';
}

function safeSlug(value) {
  return String(value || 'wallets')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'wallets';
}

function downloadText(text, filename, mime) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportText(format) {
  if (!lastResult.wallets.length) return '';
  return formatWallets(lastResult.wallets, format, {
    preserveGroups: $('group-prefix').checked,
  });
}

function closeExportMenus(except = '') {
  for (const id of ['copy-options', 'download-options']) {
    if (id !== except) $(id).hidden = true;
  }
}

function toggleExportMenu(id) {
  const menu = $(id);
  const willOpen = menu.hidden;
  closeExportMenus(id);
  menu.hidden = !willOpen;
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

    const name = document.createElement('span');
    name.textContent = group.name;

    const count = document.createElement('small');
    count.textContent = String(group.count);

    const arrow = document.createElement('b');
    arrow.textContent = '↓';

    item.append(name, count, arrow);
    item.title = `Download only ${group.name} in the currently selected destination format`;

    item.addEventListener('click', () => {
      const wallets = lastResult.wallets.filter(wallet => wallet.groups.includes(group.name));
      const meta = getDownloadMeta(target);
      const output = formatWallets(wallets, target, { preserveGroups });
      downloadText(
        output,
        `${safeSlug(target)}-${safeSlug(group.name)}.${meta.extension}`,
        meta.mime,
      );
      status(`Downloaded ${group.count} wallet${group.count === 1 ? '' : 's'} from ${group.name} as ${names[target]}.`);
    });

    list.append(item);
  }
}

function setExportActionsDisabled(disabled) {
  $('copy-menu').disabled = disabled;
  $('download-menu').disabled = disabled;
  $('download-pack').disabled = disabled;
  if (disabled) closeExportMenus();
}

function render() {
  const text = $('input').value;

  $('input-empty').hidden = !!text;
  $('clear').hidden = !text;
  $('input').removeAttribute('aria-invalid');

  const preserveGroups = $('group-prefix').checked;

  try {
    lastResult = convert(text, source, target, { preserveGroups });

    $('output').value = lastResult.output;
    $('input-count').textContent = `${lastResult.count.toLocaleString()} wallets`;
    $('output-count').textContent = lastResult.count
      ? `${lastResult.count.toLocaleString()} wallets translated`
      : 'Ready when you are';

    setExportActionsDisabled(!lastResult.output);
    $('output-empty').hidden = !!lastResult.output;

    status(lastResult.warnings.join(' '));
    renderGroups();
  } catch (error) {
    lastResult = { output: '', count: 0, wallets: [], groups: [], warnings: [] };

    $('output').value = '';
    setExportActionsDisabled(true);
    $('output-empty').hidden = true;
    $('group-summary').hidden = true;
    $('input-count').textContent = 'Check input';
    $('output-count').textContent = 'Waiting for valid input';
    $('input').setAttribute('aria-invalid', 'true');

    status(error.message, true);
  }
}

function exampleForSource() {
  if (source === 'gmgn') {
    return JSON.stringify(
      examples.map(({ address, name, emoji }) => ({ address, name, emoji })),
      null,
      2,
    );
  }

  if (source === 'notion') {
    return [
      'Address\tName\tEmoji\tGroup',
      ...examples.map(wallet =>
        `${wallet.address}\t${wallet.name}\t${wallet.emoji}\t${wallet.groups.join(' | ')}`
      ),
    ].join('\n');
  }

  return examples
    .map(wallet => `${wallet.address}  ${wallet.emoji}  ${wallet.name}`)
    .join('\n');
}

function renderStarterPacks() {
  const grid = $('starter-grid');

  grid.replaceChildren(...starterPacks.map((pack, index) => {
    const card = document.createElement('article');
    card.className = 'starter-card';

    const icon = document.createElement('img');
    icon.src = '/logos/notion.svg';
    icon.alt = '';
    icon.width = 30;
    icon.height = 30;

    const body = document.createElement('div');
    body.className = 'starter-card-body';

    const title = document.createElement('h3');
    title.textContent = pack.title;

    const preview = document.createElement('p');
    preview.textContent = pack.preview;

    const titleNote = document.createElement('small');
    titleNote.className = 'starter-title-note';
    titleNote.textContent = pack.titleStatus === 'verified'
      ? 'Official page title from supplied reference'
      : `Source ${String(index + 1).padStart(2, '0')} · collection label`;

    body.append(title, preview, titleNote);

    const actions = document.createElement('div');
    actions.className = 'starter-actions';

    const open = document.createElement('a');
    open.href = pack.url;
    open.target = '_blank';
    open.rel = 'noreferrer';
    open.textContent = 'Open ↗';

    const use = document.createElement('button');
    use.type = 'button';
    use.textContent = 'Use pack';
    use.addEventListener('click', () => {
      source = 'notion';
      if (target === 'notion') target = 'gmgn';
      tabs();

      window.open(pack.url, '_blank', 'noopener,noreferrer');
      status(
        `${pack.title} selected. Copy its Notion table rows, come back, and paste them above. Then use Copy ▾ or Download ▾ to export as GMGN or BasedBot.`
      );
      $('input').focus();
    });

    actions.append(open, use);
    card.append(icon, body, actions);
    return card;
  }));
}

$('input').addEventListener('input', render);
$('group-prefix').addEventListener('change', render);

$('clear').addEventListener('click', () => {
  $('input').value = '';
  render();
  $('input').focus();
});

$('example').addEventListener('click', () => {
  $('input').value = exampleForSource();
  render();
});

$('paste').addEventListener('click', async () => {
  try {
    $('input').value = await navigator.clipboard.readText();
    render();
  } catch {
    status(
      'Clipboard access is unavailable. Click the input and paste with Ctrl / ⌘ + V.',
      true,
    );
    $('input').focus();
  }
});

$('copy-menu').addEventListener('click', event => {
  event.stopPropagation();
  if (!$('copy-menu').disabled) toggleExportMenu('copy-options');
});

$('download-menu').addEventListener('click', event => {
  event.stopPropagation();
  if (!$('download-menu').disabled) toggleExportMenu('download-options');
});

document.querySelectorAll('[data-copy-format]').forEach(button => {
  button.addEventListener('click', async () => {
    const format = button.dataset.copyFormat;
    const output = exportText(format);
    if (!output) return;

    try {
      await navigator.clipboard.writeText(output);
      closeExportMenus();
      status(`Copied ${lastResult.count} wallet${lastResult.count === 1 ? '' : 's'} in ${names[format]} format.`);
    } catch {
      $('output').value = output;
      $('output').focus();
      $('output').select();
      status(`Clipboard access failed. The ${names[format]} result is selected — copy it with Ctrl / ⌘ + C.`, true);
    }
  });
});

document.querySelectorAll('[data-download-format]').forEach(button => {
  button.addEventListener('click', () => {
    const format = button.dataset.downloadFormat;
    const output = exportText(format);
    if (!output) return;

    const meta = getDownloadMeta(format);
    downloadText(
      output,
      `wallets-${safeSlug(format)}.${meta.extension}`,
      meta.mime,
    );

    closeExportMenus();
    status(`Downloaded ${lastResult.count} wallet${lastResult.count === 1 ? '' : 's'} as ${names[format]}.`);
  });
});

document.addEventListener('click', event => {
  if (!event.target.closest('.action-dropdown')) closeExportMenus();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeExportMenus();
});

$('download-pack').addEventListener('click', () => {
  if (!lastResult.wallets.length) return;

  const pack = makePortablePack(lastResult.wallets, { source, target });
  downloadText(
    pack,
    'wallettranslate-grouped-pack.json',
    'application/json',
  );

  status('Downloaded portable grouped pack. This keeps original names, emojis, and group metadata.');
});

$('swap').addEventListener('click', () => {
  const result = $('output').value;

  if ($('input').value.trim() && !result) {
    status('Fix the input before swapping platforms.', true);
    return;
  }

  [source, target] = [target, source];
  $('input').value = result;
  tabs();
  render();
});

tabs();
renderStarterPacks();
render();
