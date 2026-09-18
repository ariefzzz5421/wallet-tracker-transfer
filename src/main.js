import './style.css';
import { convert, formatWallets, getDownloadMeta, makePortablePack } from './converter.js';
import { creators } from './starterpacks.js';

const $ = id => document.getElementById(id);
let source = 'basedbot';
let target = 'gmgn';
let lastResult = { output: '', count: 0, wallets: [], groups: [], warnings: [] };
let activePack = null;
let activePackData = null;
const packCache = new Map();

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
    $('input').placeholder = 'Paste Notion rows…\n\nRank\tWallet\tExplorer\tOpenSea\tTag';
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

function closeAllDropdowns(except = null) {
  document.querySelectorAll('.dropdown-menu').forEach(menu => {
    if (menu !== except) menu.hidden = true;
  });
}

function toggleDropdown(menu) {
  const willOpen = menu.hidden;
  closeAllDropdowns(menu);
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
  if (disabled) closeAllDropdowns();
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
      'Rank\tWallet\tExplorer\tOpenSea\tTag',
      ...examples.map((wallet, index) =>
        `${index + 1}\t${wallet.address}\thttps://explorer.example/address/${wallet.address}\t\t${wallet.groups.join(' | ')}`
      ),
    ].join('\n');
  }

  return examples
    .map(wallet => `${wallet.address}  ${wallet.emoji}  ${wallet.name}`)
    .join('\n');
}

function rowsToTsv(rows) {
  const headers = [];
  for (const row of rows) {
    for (const key of Object.keys(row || {})) {
      if (!headers.includes(key)) headers.push(key);
    }
  }
  const cell = value => String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim();
  return [headers, ...rows.map(row => headers.map(header => row?.[header] ?? ''))]
    .map(row => row.map(cell).join('\t'))
    .join('\n');
}

async function fetchPackData(pack) {
  if (packCache.has(pack.id)) return packCache.get(pack.id);

  const response = await fetch(`/api/notion?pack=${encodeURIComponent(pack.id)}`, {
    headers: { accept: 'application/json' },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.detail || payload.error || 'Could not load public Notion data.');
  }

  if (!Array.isArray(payload.rows) || !payload.rows.length) {
    throw new Error('This public Notion view returned no wallet rows.');
  }

  const tsv = rowsToTsv(payload.rows);
  const parsed = convert(tsv, 'notion', 'gmgn', { preserveGroups: true });
  const data = {
    ...payload,
    tsv,
    wallets: parsed.wallets,
    groups: parsed.groups,
  };

  packCache.set(pack.id, data);
  return data;
}

function renderPackTable(query = '') {
  if (!activePackData) return;

  const table = $('pack-data-table');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  thead.replaceChildren();
  tbody.replaceChildren();

  const normalizedQuery = query.trim().toLowerCase();
  const rows = activePackData.rows.filter(row =>
    !normalizedQuery || Object.values(row).some(value =>
      String(value ?? '').toLowerCase().includes(normalizedQuery)
    )
  );

  const allHeaders = [];
  for (const row of activePackData.rows) {
    for (const key of Object.keys(row)) if (!allHeaders.includes(key)) allHeaders.push(key);
  }

  const priority = ['Rank', 'Wallet', 'Address', 'Explorer', 'OpenSea', 'Tag', 'Tags'];
  const headers = [
    ...priority.filter(header => allHeaders.includes(header)),
    ...allHeaders.filter(header => !priority.includes(header)),
  ];

  const headRow = document.createElement('tr');
  for (const header of headers) {
    const th = document.createElement('th');
    th.textContent = header;
    headRow.append(th);
  }
  thead.append(headRow);

  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const header of headers) {
      const td = document.createElement('td');
      const value = String(row[header] ?? '');

      if (/^https?:\/\//i.test(value)) {
        const link = document.createElement('a');
        link.href = value;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.textContent = value;
        td.append(link);
      } else {
        td.textContent = value;
      }

      if (/wallet|address/i.test(header)) td.classList.add('wallet-cell');
      if (/tag/i.test(header)) td.classList.add('tag-cell');
      tr.append(td);
    }
    tbody.append(tr);
  }

  $('pack-data-count').textContent = `${rows.length.toLocaleString()} / ${activePackData.rows.length.toLocaleString()} rows`;
}

async function revealPack(pack, card) {
  activePack = pack;
  const panel = $('pack-data-panel');
  panel.hidden = false;
  $('pack-data-title').textContent = pack.title;
  $('pack-data-meta').textContent = 'Loading public Notion database…';
  $('pack-data-state').textContent = '';
  $('pack-data-search').value = '';
  $('pack-data-table').querySelector('thead').replaceChildren();
  $('pack-data-table').querySelector('tbody').replaceChildren();
  $('pack-data-count').textContent = '';

  card.classList.add('loading');
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    activePackData = await fetchPackData(pack);
    $('pack-data-meta').textContent = `${activePackData.rows.length.toLocaleString()} public rows · ${activePackData.wallets.length.toLocaleString()} valid wallet addresses`;
    $('pack-data-state').textContent = activePackData.title && activePackData.title !== pack.title
      ? `Notion page title: ${activePackData.title}`
      : 'Live public data loaded.';
    renderPackTable();
    card.querySelector('.pack-load-state').textContent = `${activePackData.wallets.length.toLocaleString()} wallets loaded`;
  } catch (error) {
    activePackData = null;
    $('pack-data-meta').textContent = 'Live fetch unavailable';
    $('pack-data-state').textContent = `${error.message} Open the source and paste its table into the Notion translator above as fallback.`;
    card.querySelector('.pack-load-state').textContent = 'Open + paste fallback';
  } finally {
    card.classList.remove('loading');
  }
}

async function exportPack(pack, card, format, mode) {
  card.querySelector('.pack-load-state').textContent = 'Loading public data…';

  try {
    const data = await fetchPackData(pack);
    const output = formatWallets(data.wallets, format, { preserveGroups: true });

    if (mode === 'copy') {
      await navigator.clipboard.writeText(output);
      status(`Copied ${data.wallets.length.toLocaleString()} wallets from ${pack.title} as ${names[format]}.`);
    } else {
      const meta = getDownloadMeta(format);
      downloadText(
        output,
        `${safeSlug(pack.title)}-${safeSlug(format)}.${meta.extension}`,
        meta.mime,
      );
      status(`Downloaded ${data.wallets.length.toLocaleString()} wallets from ${pack.title} as ${names[format]}.`);
    }

    card.querySelector('.pack-load-state').textContent = `${data.wallets.length.toLocaleString()} wallets ready`;
  } catch (error) {
    card.querySelector('.pack-load-state').textContent = 'Open + paste fallback';
    status(`${pack.title}: ${error.message}`, true);
  } finally {
    closeAllDropdowns();
  }
}

function buildPackDropdown(label, kind, pack, card) {
  const wrap = document.createElement('div');
  wrap.className = 'action-dropdown pack-action-dropdown';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = kind === 'download' ? 'primary compact' : 'secondary compact';
  trigger.textContent = `${label} ▾`;

  const menu = document.createElement('div');
  menu.className = 'dropdown-menu pack-dropdown-menu';
  menu.hidden = true;

  for (const format of ['gmgn', 'basedbot']) {
    const option = document.createElement('button');
    option.type = 'button';

    const icon = document.createElement('img');
    icon.src = platformIcon(format);
    icon.alt = '';

    option.append(icon, document.createTextNode(
      format === 'gmgn'
        ? `GMGN ${kind === 'download' ? '(.json)' : 'JSON'}`
        : `BasedBot ${kind === 'download' ? '(.txt)' : 'text'}`
    ));

    option.addEventListener('click', event => {
      event.stopPropagation();
      exportPack(pack, card, format, kind);
    });

    menu.append(option);
  }

  trigger.addEventListener('click', event => {
    event.stopPropagation();
    toggleDropdown(menu);
  });

  wrap.append(trigger, menu);
  return wrap;
}

function renderCreatorHub() {
  const grid = $('creator-grid');
  grid.replaceChildren();

  for (const creator of creators) {
    const shell = document.createElement('section');
    shell.className = 'creator-shell';

    const card = document.createElement('div');
    card.className = 'creator-card';

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'creator-main';
    main.setAttribute('aria-expanded', 'false');

    const avatar = document.createElement('img');
    avatar.src = creator.avatar;
    avatar.alt = `${creator.name} profile`;
    avatar.className = 'creator-avatar';

    const identity = document.createElement('div');
    identity.className = 'creator-identity';

    const nameRow = document.createElement('div');
    nameRow.className = 'creator-name-row';

    const name = document.createElement('strong');
    name.textContent = creator.name;

    const count = document.createElement('span');
    count.textContent = `${creator.packs.length} lists`;

    nameRow.append(name, count);

    const handle = document.createElement('span');
    handle.textContent = creator.handle;

    const bio = document.createElement('p');
    bio.textContent = creator.bio;

    identity.append(nameRow, handle, bio);

    const chevron = document.createElement('b');
    chevron.className = 'creator-chevron';
    chevron.textContent = '⌄';

    main.append(avatar, identity, chevron);

    const xLink = document.createElement('a');
    xLink.href = creator.profileUrl;
    xLink.target = '_blank';
    xLink.rel = 'noreferrer';
    xLink.className = 'creator-x';
    xLink.textContent = '𝕏 View profile ↗';

    card.append(main, xLink);

    const panel = document.createElement('div');
    panel.className = 'creator-panel';
    panel.hidden = true;

    const toolbar = document.createElement('div');
    toolbar.className = 'creator-toolbar';

    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = `Search ${creator.name} lists…`;
    search.setAttribute('aria-label', `Search ${creator.name} starter packs`);

    const resultCount = document.createElement('span');
    resultCount.textContent = `${creator.packs.length} lists`;

    toolbar.append(search, resultCount);

    const packGrid = document.createElement('div');
    packGrid.className = 'creator-pack-grid';

    const renderPacks = query => {
      const q = query.trim().toLowerCase();
      const filtered = creator.packs.filter(pack =>
        !q || [pack.title, pack.preview, ...pack.tags].join(' ').toLowerCase().includes(q)
      );

      resultCount.textContent = `${filtered.length} / ${creator.packs.length} lists`;
      packGrid.replaceChildren(...filtered.map(pack => {
        const packCard = document.createElement('article');
        packCard.className = 'starter-card creator-pack-card';
        packCard.tabIndex = 0;
        packCard.setAttribute('role', 'button');
        packCard.setAttribute('aria-label', `Reveal ${pack.title} data`);

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

        const tags = document.createElement('div');
        tags.className = 'pack-tags';
        for (const tag of pack.tags) {
          const chip = document.createElement('span');
          chip.textContent = tag;
          tags.append(chip);
        }

        const loadState = document.createElement('small');
        loadState.className = 'pack-load-state';
        loadState.textContent = 'Click card to reveal public data';

        body.append(title, preview, tags, loadState);

        const actions = document.createElement('div');
        actions.className = 'starter-actions pack-actions';

        const open = document.createElement('a');
        open.href = pack.url;
        open.target = '_blank';
        open.rel = 'noreferrer';
        open.textContent = 'Open ↗';
        open.addEventListener('click', event => event.stopPropagation());

        const copy = buildPackDropdown('Copy', 'copy', pack, packCard);
        const download = buildPackDropdown('Download', 'download', pack, packCard);

        actions.append(open, copy, download);
        packCard.append(icon, body, actions);

        const reveal = () => revealPack(pack, packCard);
        packCard.addEventListener('click', event => {
          if (!event.target.closest('.starter-actions')) reveal();
        });
        packCard.addEventListener('keydown', event => {
          if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('.starter-actions')) {
            event.preventDefault();
            reveal();
          }
        });

        return packCard;
      }));
    };

    search.addEventListener('input', () => renderPacks(search.value));
    renderPacks('');

    main.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      main.setAttribute('aria-expanded', String(!panel.hidden));
      chevron.textContent = panel.hidden ? '⌄' : '⌃';
      if (!panel.hidden) search.focus();
    });

    panel.append(toolbar, packGrid);
    shell.append(card, panel);
    grid.append(shell);
  }
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
  if (!$('copy-menu').disabled) toggleDropdown($('copy-options'));
});

$('download-menu').addEventListener('click', event => {
  event.stopPropagation();
  if (!$('download-menu').disabled) toggleDropdown($('download-options'));
});

document.querySelectorAll('[data-copy-format]').forEach(button => {
  button.addEventListener('click', async () => {
    const format = button.dataset.copyFormat;
    const output = exportText(format);
    if (!output) return;

    try {
      await navigator.clipboard.writeText(output);
      closeAllDropdowns();
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

    closeAllDropdowns();
    status(`Downloaded ${lastResult.count} wallet${lastResult.count === 1 ? '' : 's'} as ${names[format]}.`);
  });
});

$('pack-data-search').addEventListener('input', () => renderPackTable($('pack-data-search').value));
$('pack-data-close').addEventListener('click', () => {
  $('pack-data-panel').hidden = true;
  activePack = null;
  activePackData = null;
});

document.addEventListener('click', event => {
  if (!event.target.closest('.action-dropdown')) closeAllDropdowns();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeAllDropdowns();
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
renderCreatorHub();
render();
