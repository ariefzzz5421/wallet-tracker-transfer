import test from 'node:test';
import assert from 'node:assert/strict';
import { convert, formatWallets, makePortablePack, parseWallets, validAddress } from '../src/converter.js';
const a='0xa8bc99324c7d69533ae5fd2c4a9bb8a58be9e02a';
const b='0x56398aeeb0e7741ecc56e1404f6a3b429c4f0e8b';

test('BasedBot plain text preserves emoji and spaced label',()=>{
  const r=convert(`${a}  👀  nhk06.eth Cabal`,'basedbot','gmgn');
  assert.deepEqual(JSON.parse(r.output),[{address:a,name:'nhk06.eth Cabal',emoji:'👀'}]);
});

test('BasedBot group header becomes structured group metadata',()=>{
  const r=convert(`# Group: CABAL\n${a}  👀  Alpha`,'basedbot','notion');
  assert.deepEqual(r.groups,[{name:'CABAL',count:1}]);
  assert.match(r.output,/CABAL/);
});

test('GMGN input accepts legacy group metadata but output uses documented import fields',()=>{
  const r=convert(JSON.stringify([{address:a,name:'Alpha Whale',emoji:'👨‍💻',groups:['CABAL'],alertsOnToast:true}]),'gmgn','gmgn');
  assert.deepEqual(JSON.parse(r.output),[{address:a,name:'[CABAL] Alpha Whale',emoji:'👨‍💻'}]);
  assert.equal(r.groups[0].name,'CABAL');
});

test('Notion TSV detects columns and preserves groups',()=>{
  const input=`Wallet Address\tLabel\tIcon\tFolder\n${a}\tAlpha Whale\t🐋\tCABAL\n${b}\tScout\t🔎\tWHALE`;
  const r=convert(input,'notion','gmgn');
  assert.equal(r.count,2);
  assert.deepEqual(r.groups,[{name:'CABAL',count:1},{name:'WHALE',count:1}]);
  assert.deepEqual(JSON.parse(r.output)[0],{address:a,name:'[CABAL] Alpha Whale',emoji:'🐋'});
});


test('GuarEmperor Notion format Rank Wallet Explorer OpenSea Tag translates automatically',()=>{
  const input=`Rank\tWallet\tExplorer\tOpenSea\tTag\n1\t${a}\thttps://explorer.example/${a}\thttps://opensea.io/${a}\tProject Mars Land\n2\t${b}\thttps://explorer.example/${b}\t\tProject Mars Land`;
  const r=convert(input,'notion','gmgn');
  assert.equal(r.count,2);
  assert.deepEqual(r.groups,[{name:'Project Mars Land',count:2}]);
  assert.deepEqual(JSON.parse(r.output)[0],{address:a,name:'[Project Mars Land]'});
  assert.match(formatWallets(r.wallets,'basedbot'),/\[Project Mars Land\]/);
});

test('Notion output is tabular and keeps raw group in dedicated column',()=>{
  const out=formatWallets([{address:a,name:'Alpha, Whale',emoji:'👀',groups:['CABAL','SMART']}],'notion');
  assert.equal(out,`Address\tName\tEmoji\tGroups\n${a}\tAlpha, Whale\t👀\tCABAL | SMART`);
});

test('group prefix can be disabled without losing portable metadata',()=>{
  const r=convert(`Address\tName\tGroup\n${a}\tAlpha\tCABAL`,'notion','gmgn',{preserveGroups:false});
  assert.deepEqual(JSON.parse(r.output),[{address:a,name:'Alpha'}]);
  assert.equal(r.wallets[0].groups[0],'CABAL');
});

test('portable pack roundtrips group metadata through Notion parser',()=>{
  const pack=makePortablePack([{address:a,name:'Alpha',emoji:'👀',groups:['CABAL']}]);
  const wallets=parseWallets(pack,'notion');
  assert.deepEqual(wallets,[{address:a,name:'Alpha',emoji:'👀',groups:['CABAL']}]);
});

test('empty input, CRLF and empty labels',()=>{
  assert.equal(convert('','basedbot','gmgn').count,0);
  assert.equal(convert(`\r\n${a}\r\n`,'basedbot','gmgn').count,1);
  assert.equal(convert(JSON.stringify([{address:a}]),'gmgn','basedbot').output,a);
});

test('invalid addresses and malformed records block entire export',()=>{
  for(const input of ['[','{}','[null]',JSON.stringify([{address:a},{address:'0x123'}]),JSON.stringify([{address:a,name:22,groups:'foo\nbar'}])]) assert.throws(()=>convert(input,'gmgn','basedbot'));
  assert.throws(()=>convert(`${a}\n0x123 bad`,'basedbot','gmgn'));
  assert.throws(()=>convert('Name\tGroup\nAlpha\tCABAL','notion','gmgn'));
});

test('duplicates retained and flagged without modifying addresses',()=>{
  const r=convert(`${a}\n${a.toUpperCase().replace('0X','0x')}`,'basedbot','gmgn');
  assert.equal(r.count,2); assert.equal(r.warnings.length,1);
});

test('2000 wallet boundary enforced',()=>{
  assert.equal(convert(Array(2000).fill(a).join('\n'),'basedbot','gmgn').count,2000);
  assert.throws(()=>convert(Array(2001).fill(a).join('\n'),'basedbot','gmgn'));
});

test('EVM and 32 byte Solana address validation',()=>{
  assert.ok(validAddress(a));
  assert.ok(validAddress('11111111111111111111111111111111'));
  assert.ok(validAddress('So11111111111111111111111111111111111111112'));
  assert.ok(!validAddress('111111111111111111111111111111111'));
  assert.ok(!validAddress('0xdeadbeef'));
});

test('Fomo explicitly unavailable',()=>assert.throws(()=>convert(a,'fomo','gmgn')));
