import './style.css';
import { convert } from './converter.js';
const $ = id => document.getElementById(id);
let source = 'basedbot', target = 'gmgn';
const names = { basedbot: 'BasedBot', gmgn: 'GMGN', fomo: 'Fomo' };
const examples = [{ address:'0xa8bc99324c7d69533ae5fd2c4a9bb8a58be9e02a', emoji:'👀', name:'nhk06.eth Cabal', groups:[] },{ address:'0x56398aeeb0e7741ecc56e1404f6a3b429c4f0e8b', emoji:'🐋', name:'Cabal 1', groups:[] },{ address:'0x3b6db380305e57076a25621d8de6b6a51a148976', emoji:'🔎', name:'Cabal 2', groups:[] }];
function tabs() {
  for (const side of ['source','target']) {
    $(side+'-tabs').replaceChildren(...['basedbot','gmgn','fomo'].map(id => {
      const b = document.createElement('button');
      b.className = 'platform' + ((side === 'source' ? source : target) === id ? ' active' : '');
      b.disabled = id === 'fomo';
      b.setAttribute('aria-pressed', String((side === 'source' ? source : target) === id));
      const img = document.createElement('img'); img.src = `/logos/${id}.${id === 'fomo' ? 'svg' : 'png'}`; img.alt = ''; img.width = 22; img.height = 22;
      b.append(img, document.createTextNode(names[id]));
      if (id === 'fomo') { const badge = document.createElement('small'); badge.textContent = 'Coming soon'; b.append(badge); }
      b.addEventListener('click', () => {
        if (side === 'source') { source = id; target = id === 'gmgn' ? 'basedbot' : 'gmgn'; }
        else { target = id; source = id === 'gmgn' ? 'basedbot' : 'gmgn'; }
        tabs(); render();
      }); return b;
    }));
  }
  $('input').placeholder = source === 'basedbot' ? 'Paste your BasedBot wallets here…\n\n0x…  👀  wallet name' : 'Paste your GMGN export here…\n\n[{ "address": "0x…", "name": "wallet name" }]';
}
function status(message, error = false) { $('status').textContent = message; $('status').className = error ? 'error' : ''; }
function render() {
  const text = $('input').value;
  $('input-empty').hidden = !!text;
  $('clear').hidden = !text;
  $('copy').textContent = 'Copy result ▢';
  $('input').removeAttribute('aria-invalid');
  try {
    const result = convert(text,source,target);
    $('output').value = result.output;
    $('input-count').textContent = `${result.count.toLocaleString()} wallets`;
    $('output-count').textContent = result.count ? `${result.count.toLocaleString()} wallets translated` : 'Ready when you are';
    $('copy').disabled = !result.output;
    $('output-empty').hidden = !!result.output;
    status(result.warnings.join(' '));
  } catch(e) {
    $('output').value = ''; $('copy').disabled = true; $('output-empty').hidden = true;
    $('input-count').textContent = 'Check input'; $('output-count').textContent = 'Waiting for valid input';
    $('input').setAttribute('aria-invalid','true'); status(e.message,true);
  }
}
$('input').addEventListener('input',render);
$('clear').addEventListener('click',() => { $('input').value=''; render(); $('input').focus(); });
$('example').addEventListener('click',() => { $('input').value = source === 'gmgn' ? JSON.stringify(examples,null,2) : examples.map(w => `${w.address}  ${w.emoji}  ${w.name}`).join('\n'); render(); });
$('paste').addEventListener('click',async () => { try { $('input').value = await navigator.clipboard.readText(); render(); } catch { status('Clipboard access is unavailable. Click the input and paste with Ctrl / ⌘ + V.',true); $('input').focus(); } });
$('copy').addEventListener('click',async () => { try { await navigator.clipboard.writeText($('output').value); $('copy').textContent = 'Copied ✓'; status(`Copied! Paste into ${names[target]}’s wallet import.`); } catch { $('output').focus(); $('output').select(); status('Select and copy the result with Ctrl / ⌘ + C.',true); } });
$('swap').addEventListener('click',() => { const result = $('output').value; if ($('input').value.trim() && !result) { status('Fix the input before swapping platforms.',true); return; } [source,target] = [target,source]; $('input').value = result; tabs(); render(); });
tabs(); render();
