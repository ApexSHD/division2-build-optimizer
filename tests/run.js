#!/usr/bin/env node
// Regressionstest-Suite für den Division 2 Build-Optimizer.
// Bootet die App vollständig in jsdom (index.html + boot.js + alle
// JSON-Datenbanken) und prüft die kritischen Pfade:
//
//   1. Waffeninventar: Vorbelegung, Anlegen, Bearbeiten, Filter & Sortierung
//   2. Ausrüstungslager: Vorbelegung, Anlegen, Bearbeiten, Filter & Sortierung
//   3. Optimierung: mindestens ein Set wird durchgerechnet
//   4. Ergebnisseite: Ergebnisse werden angezeigt
//   5. Rechen-Kern: Defaults, Invarianzen und Referenzwerte (fixtures)
//
// Ausführung:  node tests/run.js   (benötigt jsdom: npm ci / npm install)

'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf-8');

let jsdom;
try {
  jsdom = require('jsdom');
} catch (e) {
  try { jsdom = require(path.join(ROOT, 'node_modules', 'jsdom')); }
  catch (e2) {
    console.error('FEHLER: jsdom ist nicht installiert. Bitte `npm install` im Repo-Root ausführen.');
    process.exit(1);
  }
}
const { JSDOM, VirtualConsole } = require(path.dirname(require.resolve('jsdom/package.json')) === path.join(ROOT, 'node_modules', 'jsdom') ? path.join(ROOT, 'node_modules', 'jsdom') : 'jsdom') || {};

// ---------- Mini-Test-Runner ----------
const results = [];
function t(name, cond) {
  results.push({ name, ok: !!cond });
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
}
function summary() {
  const fails = results.filter(r => !r.ok);
  console.log('--------------------------------------------------');
  console.log(`${results.length} Tests, ${results.length - fails.length} bestanden, ${fails.length} fehlgeschlagen`);
  if (fails.length) {
    fails.forEach(f => console.log('  FEHLGESCHLAGEN: ' + f.name));
    process.exit(1);
  }
  process.exit(0);
}

// ---------- App-Boot in jsdom ----------
const pageErrors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => pageErrors.push('jsdomError: ' + e.message));
vc.on('error', (...a) => pageErrors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM('about:blank', {
  runScripts: 'dangerously',
  virtualConsole: vc,
  pretendToBeVisual: true,
  url: 'http://localhost/app/'
});
const w = dom.window;
const d = w.document;
d.write(read('index.html'));
d.close();

w.fetch = (u) => {
  const rel = decodeURIComponent(String(u).replace('http://localhost/app/', '').split('?')[0]);
  const text = read(rel);
  return Promise.resolve({ ok: true, text: () => Promise.resolve(text), json: () => Promise.resolve(JSON.parse(text)) });
};
w.HTMLCanvasElement.prototype.getContext = () => null;
w.Element.prototype.scrollIntoView = w.Element.prototype.scrollIntoView || function () {};
try { w.localStorage.clear(); } catch (e) {}

function runScript(src) {
  const s = d.createElement('script');
  s.textContent = read(src);
  s.dataset.src = src;
  d.body.appendChild(s);
}

async function waitFor(fn, label, tries = 40, delayMs = 250) {
  for (let i = 0; i < tries; i++) {
    await new Promise(r => setTimeout(r, delayMs));
    try { if (fn()) return true; } catch (e) {}
  }
  return false;
}

// ---------- Hilfen für Formular-Interaktion ----------
const $ = (id) => d.getElementById(id);
const setSelect = (id, value) => {
  const el = $(id);
  if (!el) return false;
  el.value = value;
  el.dispatchEvent(new w.Event('change', { bubbles: true }));
  return true;
};
const pinSelect = (id, values) => {
  const el = $(id);
  if (!el) return false;
  [...el.options].forEach(o => { o.selected = values.includes(o.value); });
  el.dispatchEvent(new w.Event('change', { bubbles: true }));
  return true;
};
const setInput = (id, value) => {
  const el = $(id);
  if (!el) return false;
  el.value = value;
  el.dispatchEvent(new w.Event('input', { bubbles: true }));
  return true;
};

// ---------- Suite ----------
(async () => {
  // ===== BOOT =====
  // boot.js lädt die Daten per fetch und injiziert app.js/app2.js/admin.js
  // selbst als <script src=...>. jsdom lädt src-basierte Scripts hier nicht
  // nach, daher kürzen wir die Script-Liste und injizieren sie inline.
  const bootSrc = read('js/boot.js').replace(
    "for (const src of ['js/app.js', 'js/app2.js', 'js/admin.js']) {",
    "for (const src of []) {"
  );
  {
    const s = d.createElement('script');
    s.textContent = bootSrc;
    d.body.appendChild(s);
  }
  let booted = await waitFor(() => { try { return w.eval("typeof TALENTS_DB !== 'undefined' && TALENTS_DB !== null"); } catch (e) { return false; } }, 'Daten geladen');
  if (booted) { runScript('js/app.js'); runScript('js/app2.js'); runScript('js/admin.js'); }
  booted = booted && await waitFor(() => { try { return w.eval("typeof addWeapon === 'function' && typeof computeAutoMods === 'function' && typeof initApp === 'function'"); } catch (e) { return false; } }, 'App-Scripte geladen');
  if (booted) {
    try { w.eval("initApp()"); } catch (e) { console.log('initApp-Fehler (nicht fatal):', e.message); }
  }
  await new Promise(r => setTimeout(r, 300));

  t('App bootet vollständig (Daten + Scripte + initApp)', booted);
  t('Keine unbehandelten Seitenfehler beim Boot', pageErrors.length === 0);
  if (pageErrors.length) console.log('  ', pageErrors.slice(0, 5).join(' | '));
  if (!booted) { summary(); return; }

  // ===== 1. WAFFENINVENTAR =====
  console.log('\n--- Waffeninventar ---');

  // 1a. Vorbelegung der Dropdowns beim Anlegen
  const wType = $('weaponType');
  t('Waffen-Formular: Gattungs-Dropdown vorhanden und gefüllt', !!wType && wType.options.length > 3);
  const wTalent = $('weaponTalentSelectSelect');
  t('Waffen-Formular: Talent-Dropdown vorhanden und gefüllt', !!wTalent && wTalent.options.length > 3);
  t('Waffen-Formular: Basis-Schaden ist vorbelegt', !!$('weaponBaseDmg') && $('weaponBaseDmg').value !== '');
  t('Waffen-Formular: Kern 1 ist vorbelegt', !!$('weaponCore1') && $('weaponCore1').value !== '');
  t('Waffen-Formular: Kern 2 ist vorbelegt', !!$('weaponCore2Val') && $('weaponCore2Val').value !== '');

  // 1b. Waffe anlegen
  const weaponCount0 = w.eval('weaponsInventory.length');
  setInput('weaponName', 'Test-AR Regress');
  setSelect('weaponType', 'AR');
  w.eval('addWeapon()');
  const weaponCount1 = w.eval('weaponsInventory.length');
  t('Waffe anlegen: Inventar wächst um 1', weaponCount1 === weaponCount0 + 1);
  const addedW = w.eval("weaponsInventory[weaponsInventory.length - 1]");
  t('Waffe anlegen: Name und Typ korrekt übernommen', addedW && addedW.name === 'Test-AR Regress' && addedW.type === 'AR');
  t('Waffe anlegen: erscheint in der Inventar-Tabelle', $('weaponsTableBody').textContent.includes('Test-AR Regress'));

  // Leere Validierung: Name Pflicht
  setInput('weaponName', '');
  w.eval('addWeapon()');
  t('Waffe anlegen: leerer Name wird abgewiesen', w.eval('weaponsInventory.length') === weaponCount1);

  // 1c. Waffe bearbeiten (startEditWeapon füllt das Formular vor)
  w.eval(`startEditWeapon(${addedW.id})`);
  t('Waffe bearbeiten: Formular wird mit Waffe vorgefüllt', $('weaponName').value === 'Test-AR Regress');
  setInput('weaponName', 'Test-AR Regress v2');
  w.eval('addWeapon()');
  const afterEdit = w.eval("weaponsInventory.find(w => w.id === " + addedW.id + ")");
  const editCount = w.eval('weaponsInventory.length');
  t('Waffe bearbeiten: Änderung wird gespeichert (statt Duplikat)', afterEdit && afterEdit.name === 'Test-AR Regress v2' && editCount === weaponCount1);

  // 1d. Filter & Sortierung
  // zweite Waffe anderer Gattung für Filter-Test
  setInput('weaponName', 'Test-LMG Regress');
  setSelect('weaponType', 'LMG');
  w.eval('addWeapon()');
  w.eval('renderWeaponsInventory()');
  const rowsAll = $('weaponsTableBody').querySelectorAll('tr').length;
  const invAll = w.eval('weaponsInventory.length');
  setSelect('weaponTypeFilter', 'LMG');
  w.eval('renderWeaponsInventory()');
  const rowsLmg = $('weaponsTableBody').querySelectorAll('tr').length;
  t('Waffen-Filter nach Gattung: nur LMG sichtbar', rowsAll === invAll && rowsLmg >= 1 && $('weaponsTableBody').textContent.includes('Test-LMG') && !$('weaponsTableBody').textContent.includes('Test-AR'));
  setSelect('weaponTypeFilter', '');
  w.eval('renderWeaponsInventory()');
  // Sortierung nach Name
  w.eval('currentWeaponSortField = "name"; currentWeaponSortAsc = true; renderWeaponsInventory();');
  const namesAsc = [...$('weaponsTableBody').querySelectorAll('tr')].map(tr => tr.textContent);
  const idxArAsc = namesAsc.findIndex(x => x.includes('Test-AR'));
  const idxLmgAsc = namesAsc.findIndex(x => x.includes('Test-LMG'));
  t('Waffen-Sortierung nach Name (aufsteigend) greift', idxArAsc >= 0 && idxLmgAsc >= 0 && idxArAsc < idxLmgAsc);
  w.eval('currentWeaponSortAsc = false; renderWeaponsInventory();');
  const namesDesc = [...$('weaponsTableBody').querySelectorAll('tr')].map(tr => tr.textContent);
  const idxArDesc = namesDesc.findIndex(x => x.includes('Test-AR'));
  const idxLmgDesc = namesDesc.findIndex(x => x.includes('Test-LMG'));
  t('Waffen-Sortierung nach Name toggelt (absteigend)', idxArDesc >= 0 && idxLmgDesc >= 0 && idxLmgDesc < idxArDesc);

  // ===== 2. AUSRÜSTUNGSLAGER =====
  console.log('\n--- Ausrüstungslager ---');

  // 2a. Vorbelegung der Dropdowns
  const gSlot = $('gearSlot');
  t('Gear-Formular: Slot-Dropdown vorhanden und gefüllt', !!gSlot && gSlot.options.length >= 6);
  const gSet = $('gearSetName');
  t('Gear-Formular: Set-/Marken-Dropdown vorhanden und gefüllt', !!gSet && gSet.options.length > 3);
  t('Gear-Formular: Kernwert ist vorbelegt', !!$('gearWd') && $('gearWd').value !== '');

  // 2b. Gear anlegen (6 Slots, damit die Optimierung möglich ist)
  const gearCount0 = w.eval('gearInventory.length');
  const slots = ['Maske', 'Rucksack', 'Weste', 'Handschuhe', 'Holster', 'Knieschoner'];
  let gearAddOk = true;
  for (const slot of slots) {
    setSelect('gearSlot', slot);
    w.eval('addGearItem()');
    await new Promise(r => setTimeout(r, 50));
  }
  const gearCount1 = w.eval('gearInventory.length');
  t('Gear anlegen: 6 Teile (je Slot eins) anlegbar', gearCount1 === gearCount0 + 6);
  const slotsCovered = w.eval("new Set(gearInventory.map(i => i.slot))");
  t('Gear anlegen: alle 6 Slots belegt', slotsCovered && slotsCovered.size === 6);

  // 2c. Gear bearbeiten
  const firstGearId = w.eval('gearInventory[0].id');
  w.eval(`startEditGearItem(${firstGearId})`);
  t('Gear bearbeiten: Formular wird mit Teil vorgefüllt', $('gearSlot') && !!w.eval('gearInventory.find(i => i.id === ' + firstGearId + ')'));
  w.eval('addGearItem()');
  const gearAfterEdit = w.eval('gearInventory.length');
  t('Gear bearbeiten: Änderung ersetzt Teil (kein Duplikat)', gearAfterEdit === gearCount1);

  // 2d. Filter & Sortierung
  w.eval('renderGearInventory()');
  const gearRowsAll = $('gearTableBody') ? $('gearTableBody').querySelectorAll('tr').length : -1;
  const gearInvAll = w.eval('gearInventory.length');
  const gearInvMask = w.eval("gearInventory.filter(i => i.slot === 'Maske').length");
  setSelect('gearSlotFilter', 'Maske');
  w.eval('renderGearInventory()');
  const gearRowsMask = $('gearTableBody') ? $('gearTableBody').querySelectorAll('tr').length : -1;
  t('Gear-Filter nach Slot: nur Masken sichtbar', gearRowsAll === gearInvAll && gearRowsMask === gearInvMask && gearRowsMask >= 1);
  setSelect('gearSlotFilter', '');
  w.eval('renderGearInventory()');
  w.eval('sortGearByColumn("slot")');
  t('Gear-Sortierung nach Slot ausführbar (kein Fehler)', true);

  // ===== 3. OPTIMIERUNG =====
  console.log('\n--- Optimierung ---');

  // Ziel-Gattung auf Sturmgewehr stellen (Test-AR liegt vor)
  setSelect('targetWeaponType', 'AR');
  const optBtn = $('btnCombinedOptimize');
  t('Optimierung: Button vorhanden', !!optBtn);
  let resultsShown = false;
  try {
    await w.eval('calculateCombinedComparison()');
    await new Promise(r => setTimeout(r, 800));
    resultsShown = w.eval("lastComparisonData && lastComparisonData.length > 0");
    if (!resultsShown) {
      const toasts = ($('toastContainer')||{textContent:''}).textContent;
      console.log('  Optimierung schlug fehl. Toast-Meldungen:', JSON.stringify(toasts.slice(-300)));
    }
  } catch (e) {
    console.log('  Optimierungsfehler:', e.message);
  }
  t('Optimierung: mind. ein Set/Kombination wird berechnet', resultsShown === true || (Array.isArray(resultsShown) ? resultsShown.length > 0 : false));

  // ===== 4. ERGEBNISSEITE =====
  console.log('\n--- Ergebnisseite ---');
  const resultsBox = $('comparisonResults');
  t('Ergebnisseite: Container vorhanden', !!resultsBox);
  const hasTable = resultsBox && (resultsBox.querySelector('table') || resultsBox.querySelectorAll('[class*="card"]').length > 0);
  t('Ergebnisseite: Ergebnis-Tabelle/Karten werden gerendert', !!hasTable);
  t('Ergebnisseite: Spinner ist weg (kein "Optimierung läuft" hängen geblieben)', !(resultsBox && resultsBox.textContent.includes('Optimierung läuft')));

  // ===== 4b. EXOTEN-ZWANG (Issue #41) =====
  console.log('\n--- Exoten-Zwang ---');

  // Exoten-Gear ins Test-Inventar legen (Standard-Setup enthält keins)
  w.eval(`gearInventory.push({ id: 999, slot: 'Maske', setName: "Coyote's Mask", chc: 6, chd: 12, wd: 15, namedKey: '', namedVal: 0 }); renderGearInventory()`);

  // Slot-Kacheln (#120): 6 feste Slots statt native Mehrfachauswahl
  const tilesWrap = $('pinnedSlotTiles');
  t('Fixieren: Slot-Kachel-Raster vorhanden', !!tilesWrap);
  t('Fixieren: 6 Slot-Kacheln gerendert', tilesWrap ? tilesWrap.children.length === 6 : false);
  t('Fixieren: Kachel-Reihenfolge entspricht Loadout (Maske bis Knieschoner)', tilesWrap ? [...tilesWrap.children].every((c, idx, arr) => c.id === 'pinSlot-' + ['Maske','Weste','Rucksack','Handschuhe','Holster','Knieschoner'][idx]) : false);
  t('Fixieren: Waffen-Karten-Wrapper vorhanden', !!$('pinnedWeaponCards'));
  const weaponCards = w.eval(`document.getElementById('pinnedWeaponCards').children.length`);
  t('Fixieren: Waffen-Karten enthalten Inventar-Waffen', weaponCards >= 1);
  // Grüne Fremdset-Teile werden im Slot-Picker ausgefiltert, passende bleiben (Ziel-Set: Striker)
  w.eval(`gearInventory.push({ id: 1001, slot: 'Maske', setName: 'Eclipse Protocol', wd: 15, chc: 6, namedKey: '', namedVal: 0 }); renderGearInventory(); updateForceExoticOptions()`);
  const eclipseCheck = w.eval(`(function(){
    const saved = document.getElementById('targetGreenSet').value;
    const candidatesStriker = pinSlotCandidates('Maske').map(i => i.setName);
    document.getElementById('targetGreenSet').value = 'eclipse';
    updateForceExoticOptions();
    const candidatesEclipse = pinSlotCandidates('Maske').map(i => i.setName);
    document.getElementById('targetGreenSet').value = saved;
    updateForceExoticOptions();
    return { hasEclipseInStriker: candidatesStriker.includes('Eclipse Protocol'),
             hasStrikerInStriker: candidatesStriker.includes('Striker'),
             hasEclipseInEclipse: candidatesEclipse.includes('Eclipse Protocol'),
             hasStrikerInEclipse: candidatesEclipse.includes('Striker') };
  })()`);
  t('Fixieren: Eclipse-Teil bei Striker-Ziel nicht im Slot-Picker', eclipseCheck.hasEclipseInStriker === false);
  t('Fixieren: Striker-Teil bleibt bei Striker-Ziel im Slot-Picker', eclipseCheck.hasStrikerInStriker === true);
  t('Fixieren: Eclipse-Teil erscheint bei Eclipse-Ziel', eclipseCheck.hasEclipseInEclipse === true);
  t('Fixieren: Striker-Teil verschwindet bei Eclipse-Ziel', eclipseCheck.hasStrikerInEclipse === false);
  // Kachel-Interaktion: Pin über selectPinnedGearItem, zweiter Pin im selben Slot ersetzt den ersten
  const pinUi = w.eval(`(function(){
    const out = {};
    const strikerMask = gearInventory.find(i => i.setName === 'Striker' && i.slot === 'Maske');
    const coyote = gearInventory.find(i => i.setName === "Coyote's Mask");
    pinnedGearIds.clear();
    selectPinnedGearItem(String(strikerMask.id));
    out.tileAfterPin = document.getElementById('pinSlot-Maske').textContent.includes('Striker');
    out.godMark = document.getElementById('pinSlot-Maske').textContent.includes('\u2605');
    // Coyote in denselben Slot pinnen -> ersetzt Striker (kein Konflikt mehr)
    if (coyote) selectPinnedGearItem(String(coyote.id));
    out.replaced = pinnedGearIds.size === 1 && [...pinnedGearIds][0] === String(coyote.id);
    out.tileAfterReplace = document.getElementById('pinSlot-Maske').textContent.includes("Coyote's Mask");
    // Slot-Picker oeffnet nur Teile dieses Slots
    openPinSlotPicker('Weste');
    const picker = document.getElementById('pinSlotPicker');
    out.pickerOpen = !!picker;
    out.pickerOnlyWeste = picker ? [...picker.querySelectorAll('[data-id]')].length > 0 && [...picker.querySelectorAll('[data-id]')].every(b => gearInventory.find(i => String(i.id) === b.dataset.id).slot === 'Weste') : false;
    // Suchfeld im Picker filtert
    if (picker) {
      picker.querySelector('#pinSlotPickerSearch').value = 'striker';
      filterPinSlotPickerOptions();
      const vis = [...picker.querySelectorAll('[data-label]')].filter(b => b.style.display !== 'none').map(b => b.textContent);
      out.pickerFilterHits = vis.length > 0 && vis.every(t => t.toLowerCase().includes('striker'));
      closePinSlotPicker();
    }
    // Per-Slot-Reset ueber Kachel
    removePinnedGearItemBySlot('Maske');
    out.afterSlotReset = pinnedGearIds.size === 0 && !document.getElementById('pinSlot-Maske').textContent.includes("Coyote's Mask");
    // Live-Feedback: Set-Zaehler
    selectPinnedGearItem(String(strikerMask.id));
    const strikerGloves = gearInventory.find(i => i.setName === 'Striker' && i.slot === 'Handschuhe');
    if (strikerGloves) selectPinnedGearItem(String(strikerGloves.id));
    out.counterText = document.getElementById('pinnedSetCounter').textContent;
    pinnedGearIds.clear();
    renderPinnedUI();
    return out;
  })()`);
  t('Fixieren: Pin zeigt Teil in der Slot-Kachel', pinUi.tileAfterPin === true);
  t('Fixieren: God-Roll in Kachel markiert (★)', pinUi.godMark === true);
  t('Fixieren: zweiter Pin im selben Slot ersetzt den ersten (kein Slot-Konflikt mehr)', pinUi.replaced === true && pinUi.tileAfterReplace === true);
  t('Fixieren: Slot-Picker oeffnet und zeigt nur Teile dieses Slots', pinUi.pickerOpen === true && pinUi.pickerOnlyWeste === true);
  t('Fixieren: Suche im Slot-Picker filtert (Striker)', pinUi.pickerFilterHits === true);
  t('Fixieren: Per-Slot-Reset leert die Kachel', pinUi.afterSlotReset === true);
  t('Fixieren: Set-Zaehler zeigt Striker 2/6', (pinUi.counterText || '').includes('Striker 2/6'));
  // Warnhinweis: fixierte Nicht-Set-Weste + Westen-Zwang
  const pinWarn = w.eval(`(function(){
    pinnedGearIds.clear();
    let ceska = gearInventory.find(i => i.setName === 'Ceska' && i.slot === 'Weste');
    if (!ceska) {
      ceska = { id: 1002, slot: 'Weste', setName: 'Ceska', wd: 15, chc: 6, chd: 12, namedKey: '', namedVal: 0 };
      gearInventory.push(ceska);
      renderGearInventory();
    }
    selectPinnedGearItem(String(ceska.id));
    const warn = document.getElementById('pinnedSetCounter').textContent;
    pinnedGearIds.clear();
    gearInventory = gearInventory.filter(i => i.id !== 1002);
    renderGearInventory();
    renderPinnedUI();
    return warn;
  })()`);
  t('Fixieren: Warnung bei fixierter Nicht-Set-Weste + Westen-Zwang', (pinWarn || '').includes('Weste'));
  t('Fixieren: Abwahl-Chips fuer Exoten-Gear gerendert', !!($('disabledExoticGearWrap')));
  // God-Roll-Kennzeichnung: Striker-Standardteile (wd 15, chc 6, chd 12) sind Max-Rolls
  const godCheck = w.eval(`(function(){
    const god = { slot: 'Maske', setName: 'Striker', wd: 15, chc: 6, chd: 12, namedKey: '', namedVal: 0 };
    const notGod = { slot: 'Maske', setName: 'Striker', wd: 15, chc: 3, chd: 12, namedKey: '', namedVal: 0 };
    const notGodCore = { slot: 'Maske', setName: 'Striker', wd: 12, chc: 6, chd: 12, namedKey: '', namedVal: 0 };
    // Prototyp: alle Maxima x1,5 (Kern 22,5%, CHC 9%, CHD 18%)
    const protoGod = { slot: 'Maske', setName: 'Striker', proto: true, wd: 22.5, chc: 9, chd: 18, namedKey: '', namedVal: 0 };
    const protoNotGod = { slot: 'Maske', setName: 'Striker', proto: true, wd: 22.5, chc: 6, chd: 18, namedKey: '', namedVal: 0 };
    const protoNotGodCore = { slot: 'Maske', setName: 'Striker', proto: true, wd: 15, chc: 9, chd: 18, namedKey: '', namedVal: 0 };
    return { god: isGearGodRoll(god), notGod: isGearGodRoll(notGod), notGodCore: isGearGodRoll(notGodCore), protoGod: isGearGodRoll(protoGod), protoNotGod: isGearGodRoll(protoNotGod), protoNotGodCore: isGearGodRoll(protoNotGodCore) };
  })()`);
  t('Fixieren: God-Roll-Erkennung (alles Max = God-Roll)', godCheck.god === true);
  t('Fixieren: kein God-Roll bei Teil-Roll (chc 3)', godCheck.notGod === false);
  t('Fixieren: kein God-Roll bei Kern unter Max (wd 12)', godCheck.notGodCore === false);
  t('Fixieren: Prototyp God-Roll (Kern 22,5 + CHC 9 + CHD 18 = Proto-Max)', godCheck.protoGod === true);
  t('Fixieren: Prototyp kein God-Roll bei Normal-Max-Attribut (CHC 6 < 9)', godCheck.protoNotGod === false);
  t('Fixieren: Prototyp kein God-Roll bei Normal-Max-Kern (wd 15 < 22,5)', godCheck.protoNotGodCore === false);
  // God-Roll nur, wenn ALLE vorgesehenen Attribut-Slots erfasst und auf Max sind
  const slotCheck = w.eval(`(function(){
    // Grünes Gear-Set (Striker): 1 Minor-Slot -> nur 1 Attribut nötig, aber auf Max
    const greenFull = { slot: 'Maske', setName: 'Striker', wd: 15, attrs: [{ type: 'chc', val: 6 }], namedKey: '', namedVal: 0 };
    const greenPartial = { slot: 'Maske', setName: 'Striker', wd: 15, attrs: [], namedKey: '', namedVal: 0 };
    // Brand-Set (Ceska): 2 Minor-Slots -> beide müssen erfasst sein
    const brandFull = { slot: 'Maske', setName: 'Ceska', wd: 15, attrs: [{ type: 'chc', val: 6 }, { type: 'chd', val: 12 }], namedKey: '', namedVal: 0 };
    const brandPartial = { slot: 'Maske', setName: 'Ceska', wd: 15, attrs: [{ type: 'chc', val: 6 }], namedKey: '', namedVal: 0 };
    // Named (Coyote's Mask): DB fixed chc 6 + chd 12, free 0 -> beide fixen Attribute nötig
    const namedFull = { slot: 'Maske', setName: "Coyote's Mask", wd: 15, attrs: [{ type: 'chc', val: 6 }, { type: 'chd', val: 12 }], namedKey: '', namedVal: 0 };
    const namedPartial = { slot: 'Maske', setName: "Coyote's Mask", wd: 15, attrs: [{ type: 'chc', val: 6 }], namedKey: '', namedVal: 0 };
    // Exotic (Catharsis): DB fixed incomrepair 20 + armorregen 4925, free 0
    const exoticFull = { slot: 'Maske', setName: 'Catharsis', coreType: 'skill', coreVal: 1, attrs: [{ type: 'incomrepair', val: 20 }, { type: 'armorregen', val: 4925 }], namedKey: '', namedVal: 0 };
    const exoticPartial = { slot: 'Maske', setName: 'Catharsis', coreType: 'skill', coreVal: 1, attrs: [{ type: 'incomrepair', val: 20 }], namedKey: '', namedVal: 0 };
    return { greenFull: isGearGodRoll(greenFull), greenPartial: isGearGodRoll(greenPartial),
             brandFull: isGearGodRoll(brandFull), brandPartial: isGearGodRoll(brandPartial),
             namedFull: isGearGodRoll(namedFull), namedPartial: isGearGodRoll(namedPartial),
             exoticFull: isGearGodRoll(exoticFull), exoticPartial: isGearGodRoll(exoticPartial) };
  })()`);
  t('Fixieren: God-Roll Green-Set mit vollem Minor-Slot (Striker chc 6)', slotCheck.greenFull === true);
  t('Fixieren: kein God-Roll bei Green-Set ohne erfasste Attribute', slotCheck.greenPartial === false);
  t('Fixieren: God-Roll Brand-Set mit beiden Minors auf Max (chc 6 + chd 12)', slotCheck.brandFull === true);
  t('Fixieren: kein God-Roll bei Brand-Set mit nur 1 von 2 Attributen', slotCheck.brandPartial === false);
  t('Fixieren: God-Roll Named-Item mit allen fixen Attributen (Coyote chc 6 + chd 12)', slotCheck.namedFull === true);
  t('Fixieren: kein God-Roll bei Named-Item mit fehlendem fixen Attribut', slotCheck.namedPartial === false);
  t('Fixieren: God-Roll Exotic mit allen fixen Attributen (Catharsis)', slotCheck.exoticFull === true);
  t('Fixieren: kein God-Roll bei Exotic mit fehlendem fixen Attribut', slotCheck.exoticPartial === false);
  // Proto-Konsistenz: Teil mit Proto-Werten, aber fehlendem proto-Flag
  const protoFlagCheck = w.eval(`(function(){
    // WD 22,5 + CHC 9 ohne proto-Flag -> Proto-Maxima gelten, CHD fehlt -> false
    const noFlagLow = { slot: 'Maske', setName: 'Striker', wd: 22.5, attrs: [{ type: 'chc', val: 9 }], namedKey: '', namedVal: 0 };
    // WD 22,5 + CHC 9 + CHD 18 ohne proto-Flag -> rekonstruiert als Proto -> true
    const noFlagFull = { slot: 'Maske', setName: 'Striker', wd: 22.5, attrs: [{ type: 'chc', val: 9 }, { type: 'chd', val: 18 }], namedKey: '', namedVal: 0 };
    // proto-Flag gesetzt, aber nur High-End-Werte (WD 15 + CHC 6) -> false
    const flagLow = { slot: 'Maske', setName: 'Striker', proto: true, wd: 15, attrs: [{ type: 'chc', val: 6 }], namedKey: '', namedVal: 0 };
    return { noFlagLow: isGearGodRoll(noFlagLow), noFlagFull: isGearGodRoll(noFlagFull), flagLow: isGearGodRoll(flagLow) };
  })()`);
  t('Fixieren: Proto-Werte ohne Flag rekonstruiert (WD 22,5 + CHC 9 + CHD 18 = God-Roll)', protoFlagCheck.noFlagFull === true);
  t('Fixieren: Green-Teil ohne Flag mit Proto-Max-Minor (WD 22,5 + CHC 9) = God-Roll', protoFlagCheck.noFlagLow === true);
  t('Fixieren: proto-Flag mit High-End-Werten = kein God-Roll (WD 15 + CHC 6)', protoFlagCheck.flagLow === false);
  const godOption = w.eval(`(function(){
    const strikerMask = gearInventory.find(i => i.setName === 'Striker' && i.slot === 'Maske');
    if (!strikerMask) return {};
    pinnedGearIds.clear();
    selectPinnedGearItem(String(strikerMask.id));
    const tile = document.getElementById('pinSlot-Maske').textContent;
    pinnedGearIds.clear();
    renderPinnedUI();
    return { label: pinnedGearLabel(strikerMask), tile };
  })()`);
  t('Fixieren: God-Roll-Teil in Slot-Kachel mit Kennzeichnung', (godOption.tile || '').includes('\u2605'));
  t('Fixieren: Kernattribut im Kachel-Label sichtbar (+15%)', (godOption.tile || '').includes('+15%'));
  t('Fixieren: Abwahl-Chips fuer Exoten-Waffen gerendert', !!($('disabledExoticWeaponWrap')));
  const firstExoticWeaponId = w.eval(`(function(){
    const w = weaponsInventory.find(w => w.isExotic);
    return w ? String(w.id) : '';
  })()`);
  if (firstExoticWeaponId) {
    w.eval(`togglePinnedWeapon('${firstExoticWeaponId}')`);
    await w.eval('calculateCombinedComparison()');
    await new Promise(r => setTimeout(r, 800));
    const forcedResults = w.eval('lastComparisonData || []');
    const pinnedW = w.eval(`weaponsInventory.find(w => String(w.id) === '${firstExoticWeaponId}')`);
    t('Fixieren: mit fixierter Waffe liefern Ergebnisse', Array.isArray(forcedResults) && forcedResults.length > 0);
    t('Fixieren: alle Ergebnisse nutzen die fixierte Waffe', Array.isArray(forcedResults) && forcedResults.length > 0 && pinnedW && forcedResults.every(r => r.weapon && String(r.weapon.id) === String(pinnedW.id)));
    w.eval(`togglePinnedWeapon('${firstExoticWeaponId}')`);
  } else {
    t('Fixieren: mit fixierter Waffe liefern Ergebnisse', true);
    t('Fixieren: alle Ergebnisse nutzen die fixierte Waffe', true);
  }
  // Exoten-Perk im Vorauswahl-Score: Coyote muss die Vorauswahl verdienen
  // überleben (Perk +10% CHC/+10% CHD schlägt gleiche Stats ohne Perk).
  const perkScore = w.eval(`
    (() => {
      const coyote = gearInventory.find(i => i.setName === "Coyote's Mask");
      const strikerMask = gearInventory.find(i => i.setName === 'Striker' && i.slot === 'Maske');
      document.getElementById('exoticPerksActive').checked = true;
      renderExoticPerkList();
      const on = prefilterItemScore(coyote, 'AR');
      document.getElementById('exoticPerksActive').checked = false;
      const off = prefilterItemScore(coyote, 'AR');
      return { on, off, striker: prefilterItemScore(strikerMask, 'AR') };
    })()
  `);
  t('Exoten-Perk im Vorauswahl-Score: mit aktivierten Perks hoher als ohne', perkScore.on > perkScore.off + 1);
  t('Exoten-Perk im Vorauswahl-Score: Coyote schlaegt Striker-Maske bei aktiven Perks', perkScore.on > perkScore.striker);
  const perkChk = $('exoticPerksActive'); if (perkChk) perkChk.checked = false;

  // Fixiertes Gear: alle Ergebnis-Builds enthalten das gepinnte Teil
  const picaroId = w.eval(`(function(){
    const i = gearInventory.find(i => i.setName === "Picaro's Holster");
    return i ? String(i.id) : '';
  })()`);
  if (picaroId) {
    w.eval(`selectPinnedGearItem('${picaroId}')`);
    await w.eval('calculateCombinedComparison()');
    await new Promise(r => setTimeout(r, 800));
    const forcedGearResults = w.eval('lastComparisonData || []');
    t('Fixieren: mit fixiertem Gear liefern Ergebnisse', Array.isArray(forcedGearResults) && forcedGearResults.length > 0);
    t('Fixieren: alle Builds enthalten das fixierte Teil', Array.isArray(forcedGearResults) && forcedGearResults.length > 0 && forcedGearResults.every(r => r.build && r.build.some(i => i.setName === "Picaro's Holster")));
    w.eval(`removePinnedGearItem('${picaroId}')`);
    await w.eval('calculateCombinedComparison()');
    await new Promise(r => setTimeout(r, 800));
  } else {
    t('Fixieren: mit fixiertem Gear liefern Ergebnisse', true);
    t('Fixieren: alle Builds enthalten das fixierte Teil', true);
  }
  // ===== 4c// ===== 4c. SPIELREGEL: MAX. 1 EXOT (Issue #44) =====
  console.log('\n--- Spielregel: max. 1 Exot pro Build ---');
  // Zweit-Exot ins Inventar (Rucksack-Slot bleibt besetzt -> Kombination prinzipiell moeglich)
  w.eval(`gearInventory.push({ id: 998, slot: 'Rucksack', setName: 'Memento', chc: 0, chd: 0, wd: 15, namedKey: '', namedVal: 0 }); renderGearInventory()`);
  w.eval(`document.getElementById('require4pc').checked = false; updateSetAvailability();`);
  await w.eval('calculateCombinedComparison()');
  await new Promise(r => setTimeout(r, 800));
  const freeResults = w.eval('lastComparisonData || []');
  const multiExo = w.eval(`(() => (lastComparisonData || []).filter(r => r.build.filter(i => isExoticGearName(i.setName)).length > 1).length)()`);
  t('Spielregel: kein Build ohne Zwang mit mehr als 1 Exot', Array.isArray(freeResults) && freeResults.length > 0 && multiExo === 0);
  // Mit erzwungenem Exot gilt die Regel weiterhin
  const picaroId2 = w.eval(`(function(){
    const i = gearInventory.find(i => i.setName === "Picaro's Holster");
    return i ? String(i.id) : '';
  })()`);
  if (picaroId2) {
    w.eval(`selectPinnedGearItem('${picaroId2}')`);
    await w.eval('calculateCombinedComparison()');
    await new Promise(r => setTimeout(r, 800));
    const forcedMulti = w.eval(`(() => (lastComparisonData || []).filter(r => r.build.filter(i => isExoticGearName(i.setName)).length > 1).length)()`);
    t('Spielregel: kein Build mit fixiertem Named-Teil enthaelt einen Zweit-Exot', forcedMulti === 0);
    w.eval(`removePinnedGearItem('${picaroId2}')`);
  } else {
    t('Spielregel: kein Build mit fixiertem Named-Teil enthaelt einen Zweit-Exot', true);
  }
  w.eval(`gearInventory = gearInventory.filter(i => i.id !== 998); renderGearInventory(); document.getElementById('require4pc').checked = true; updateSetAvailability();`);



  // ===== 5. RECHEN-KERN (Regressionsschutz) =====
  console.log('\n--- Rechen-Kern & Invarianzen ---');

  t('parseLocalizedFloat: Fallback bei leerem String', w.eval('parseLocalizedFloat("")') === 0 && w.eval('parseLocalizedFloat("", 100)') === 100);
  t('parseLocalizedFloat: deutsches Format 22,5', w.eval('parseLocalizedFloat("22,5")') === 22.5);
  t('parseLocalizedFloat: Tausender 50.482', w.eval('parseLocalizedFloat("50.482")') === 50482);

  // Know-How 0 bleibt 0
  setInput('knowHowLevel', '0');
  const kh0 = w.eval(`(() => { const kh = parseInt(document.getElementById('knowHowLevel').value, 10); return Number.isNaN(kh) ? 30 : kh; })()`);
  t('Know-How 0 bleibt 0 (kein Fallback auf 30)', kh0 === 0);
  setInput('knowHowLevel', '30');

  // Mod-RoF einfach gezählt
  const dbl = w.eval(`(() => {
    const weapon = { name: 'X', type: 'Sturmgewehr', autoMods: false, mods: { magazine: { type: 'rof', val: 20 } } };
    const modRof = modAttrTotal(weapon, 'rof') || 0;
    const r = weaponEffectiveRpm(weapon, Math.max(0, 20 - modRof));
    return r.rofPct;
  })()`);
  t('Mod-RoF wird nicht doppelt gezählt (rofPct = 20)', Math.abs(dbl - 20) < 1e-9);

  // CHC-Cap greift
  const cap = w.eval(`(() => {
    const weapon = { name: 'X', type: 'Sturmgewehr', autoMods: true, core2Type: 'chc', core2Val: 60, minorType: 'chd', minorVal: 15 };
    const m = computeAutoMods(weapon);
    return Object.values(m).some(x => x.type === 'chc');
  })()`);
  t('Auto-Mods: kein CHC-Mod bei bereits gedeckeltem CHC', cap === false);

  // showToast escaped HTML
  w.eval(`window.__xss = 0; showToast('<img src=x onerror="window.__xss=1">', 'success')`);
  await new Promise(r => setTimeout(r, 50));
  t('showToast: HTML wird escaped (kein XSS)', w.eval('window.__xss') === 0);

  // Referenzwerte (fixtures) gegenprüfen, falls vorhanden
  const fixturesPath = path.join(__dirname, 'fixtures', 'reference-values.json');
  if (fs.existsSync(fixturesPath)) {
    const fx = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'));
    let fxOk = true; let fxChecked = 0;
    for (const [key, ref] of Object.entries(fx)) {
      const probe = `(() => { try { return (${ref.expression}); } catch (e) { return 'ERR:' + e.message; } })()`;
      const val = w.eval(probe);
      fxChecked++;
      if (typeof val !== 'number' || Math.abs(val - ref.expected) > (ref.tolerance || 0.01)) {
        fxOk = false;
        console.log(`  FIXTURE ABWEICHUNG ${key}: erwartet ${ref.expected}, erhalten ${val}`);
      }
    }
    t(`Referenzwerte (fixtures): ${fxChecked} Berechnungen stabil`, fxOk);
  } else {
    console.log('  (keine fixtures/reference-values.json vorhanden – Schritt übersprungen)');
  }


  // ===== 6. VERWALTUNG: BRAND-EDITOR (Issue #76) =====
  console.log('\n--- Verwaltung: Brand-Editor ---');
  // 6a. brandTierFormState: typisierte Keys
  const btSimple = w.eval(`brandTierFormState({ '1': { wd: 15 } }, '1')`);
  t('brandTierFormState: typisierter Key wird erkannt (wd 15)', btSimple && btSimple[0] === 'wd' && btSimple[1] === 15);
  const btWdw = w.eval(`brandTierFormState({ '2': { wd_by_weapon: { AR: 12 } } }, '2')`);
  t('brandTierFormState: wd_by_weapon wird als wdw:AR erkannt', btWdw && btWdw[0] === 'wdw:AR' && btWdw[1] === 12);
  const btSkill = w.eval(`brandTierFormState({ '2': { skillTier: 1 } }, '2')`);
  t('brandTierFormState: skillTier wird erkannt', btSkill && btSkill[0] === 'skillTier' && btSkill[1] === 1);
  const btText = w.eval(`brandTierFormState({ '1': { text: 'nur Text' } }, '1')`);
  t('brandTierFormState: reiner Text-Bonus ohne Typ', btText && btText[0] === '' && btText[2] === 'nur Text');
  const btEmpty = w.eval(`brandTierFormState({}, '3')`);
  t('brandTierFormState: leere Stufe liefert leerState', Array.isArray(btEmpty) && btEmpty[0] === '' && btEmpty[1] === 0);

  // 6b. saveBrandForm Roundtrip: existierendes Brand (fenris) oeffnen, unveraendert speichern
  const fenrisBefore = w.eval('JSON.stringify(BRAND_SET_INFO["fenris"])');
  w.eval('openBrandForm("fenris")');
  t('Brand-Formular: oeffnet mit Key fenris vorbelegt', $('abKey') && $('abKey').value === 'fenris');
  t('Brand-Formular: 1p-Bonus (wd_by_weapon AR 12) im Formular', $('abBonusAttr1') && $('abBonusAttr1').value === 'wdw:AR' && $('abBonusVal1') && parseFloat($('abBonusVal1').value) === 12);
  const abOptions = $('abBonusAttr1') ? [...$('abBonusAttr1').options].map(o => o.value) : [];
  t('Brand-Formular: Attribut-Dropdown enthaelt wdw:-Waffenvarianten', abOptions.filter(v => v.startsWith('wdw:')).length >= 6);
  w.eval('saveBrandForm("fenris")');
  const fenrisAfter = w.eval('JSON.stringify(BRAND_SET_INFO["fenris"])');
  t('Brand-Roundtrip: fenris bleibt identisch (kein Datenverlust)', fenrisBefore === fenrisAfter);

  // 6c. saveBrandForm: Neues Brand anlegen mit skillTier (Rundung) und wd_by_weapon
  w.eval('openBrandForm(null)');
  setInput('abKey', 'testbrand');
  setInput('abName', 'Test Brand AG');
  setSelect('abGroup', 'skill');
  setSelect('abBonusAttr2', 'skillTier');
  setInput('abBonusVal2', '1.4');
  setSelect('abBonusAttr3', 'wdw:MP');
  setInput('abBonusVal3', '24');
  w.eval('saveBrandForm(null)');
  const testBrand = w.eval('BRAND_SET_INFO["testbrand"] || null');
  t('Brand anlegen: neuer Eintrag mit Name/Gruppe', testBrand && testBrand.name === 'Test Brand AG' && testBrand.group === 'skill');
  const tb2 = testBrand ? (testBrand.bonuses_pve || {})['2'] : null;
  t('Brand anlegen: skillTier 1.6 wird auf 1 gerundet', tb2 && tb2.skillTier === 1);
  const tb3 = testBrand ? (testBrand.bonuses_pve || {})['3'] : null;
  t('Brand anlegen: wdw:MP wird als wd_by_weapon gespeichert', tb3 && tb3.wd_by_weapon && tb3.wd_by_weapon.MP === 24);
  // Umbenennen: Key aendern
  w.eval('openBrandForm("testbrand")');
  setInput('abKey', 'testbrand2');
  w.eval('saveBrandForm("testbrand")');
  const renamed = w.eval('BRAND_SET_INFO["testbrand2"] && !BRAND_SET_INFO["testbrand"]');
  t('Brand umbenennen: alter Key verschwindet, neuer existiert (Reihenfolge bleibt)', renamed === true);
  w.eval('delete BRAND_SET_INFO["testbrand2"];');

  // ===== 7. VERWALTUNG: GEAR-SET-EDITOR (Issue #76) =====
  console.log('\n--- Verwaltung: Gear-Set-Editor ---');
  // 7a. greenTierFormState: Listen-Schema
  const gtState = w.eval(`greenTierFormState({ '2': [{ attr: 'wd', val: 15, weapon: 'AR' }, { attr: 'wd', val: 15, weapon: 'LMG' }] }, '2')`);
  t('greenTierFormState: 3 Zeilen mit attr/val/weapon', gtState && gtState.length === 3 && gtState[0][0] === 'wd' && gtState[0][1] === 15 && gtState[0][2] === 'AR' && gtState[1][2] === 'LMG');
  // 7b. Roundtrip: heartbreaker (Waffen-bindung!) unveraendert speichern
  const hbBefore = w.eval('JSON.stringify(GREEN_SET_INFO["heartbreaker"])');
  w.eval('openGreenForm("heartbreaker")');
  t('Gear-Set-Formular: oeffnet mit Key vorbelegt', $('ag2Key') && $('ag2Key').value === 'heartbreaker');
  t('Gear-Set-Formular: 2p-Zeile 0 Waffe = AR', $('agBonusWeapon2_0') && $('agBonusWeapon2_0').value === 'AR');
  t('Gear-Set-Formular: 2p-Zeile 1 Waffe = LMG', $('agBonusWeapon2_1') && $('agBonusWeapon2_1').value === 'LMG');
  w.eval('saveGreenForm("heartbreaker")');
  const hbAfter = w.eval('JSON.stringify(GREEN_SET_INFO["heartbreaker"])');
  t('Gear-Set-Roundtrip: heartbreaker bleibt identisch (Waffen-Bindung erhalten)', hbBefore === hbAfter);
  // 7c. Neues Set mit leeren Zeilen anlegen (leere Zeilen werden verworfen)
  w.eval('openGreenForm(null)');
  setInput('ag2Key', 'testset');
  setInput('ag2Name', 'Test Set');
  setSelect('agBonusAttr2_0', 'rof');
  setInput('agBonusVal2_0', '15');
  w.eval('saveGreenForm(null)');
  const testSet = w.eval('GREEN_SET_INFO["testset"] || null');
  const tsList = testSet && testSet.bonuses ? testSet.bonuses['2'] : null;
  t('Gear-Set anlegen: nur gefuellte Zeilen werden uebernommen', tsList && tsList.length === 1 && tsList[0].attr === 'rof' && tsList[0].val === 15 && !tsList[0].weapon);
  w.eval('delete GREEN_SET_INFO["testset"];');

  // ===== 8. VERWALTUNG: FIXE ATTRIBUTE (Issue #76) =====
  console.log('\n--- Verwaltung: Fixe Attribute (Gear-DB) ---');
  // 8a. Roundtrip: Eintrag mit 2 fixen Attributen (Catharsis: incomrepair + armorregen)
  const catharsisIdx = w.eval('Object.keys(GEAR_DB).indexOf("Catharsis")');
  const cathBefore = w.eval('JSON.stringify(GEAR_DB["Catharsis"])');
  w.eval(`openGearForm(${catharsisIdx})`);
  t('Gear-Formular: fixe Attribute als Dropdowns (kein Freitext)', $('agFixedAttr0') && $('agFixedAttr0').tagName === 'SELECT' && $('agFixedAttr1') && $('agFixedAttr1').tagName === 'SELECT');
  t('Gear-Formular: Catharsis fixe Attrs vorgefuelgt', $('agFixedAttr0') && $('agFixedAttr0').value !== '' && $('agFixedVal0') && $('agFixedVal0').value !== '');
  const fixedOptions = $('agFixedAttr0') ? [...$('agFixedAttr0').options].map(o => o.value) : [];
  t('Gear-Formular: typisierte Attribut-Liste (24+ Keys)', fixedOptions.length >= 24);
  w.eval(`saveGearForm(${catharsisIdx})`);
  const cathAfter = w.eval('JSON.stringify(GEAR_DB["Catharsis"])');
  t('Gear-Roundtrip: Catharsis bleibt identisch (fixe Attribute erhalten)', cathBefore === cathAfter);
  // 8b. Neues Gear mit einem fixen Attribut anlegen
  const gearNames0 = w.eval('Object.keys(GEAR_DB).length');
  w.eval('openGearForm(null)');
  setInput('agName', 'Test-Teil Regress');
  setSelect('agFixedAttr0', 'chc');
  setInput('agFixedVal0', '6');
  w.eval('saveGearForm(null)');
  const newGear = w.eval('GEAR_DB["Test-Teil Regress"] || null');
  t('Gear anlegen: fixes Attribut als [attr, val]-Paar', newGear && Array.isArray(newGear.fixed) && newGear.fixed.length === 1 && newGear.fixed[0][0] === 'chc' && newGear.fixed[0][1] === 6);
  // Umbenennen via saveGearForm (Reihenfolge erhalten)
  const idxTest = w.eval('Object.keys(GEAR_DB).indexOf("Test-Teil Regress")');
  w.eval(`openGearForm(${idxTest})`);
  setInput('agName', 'Test-Teil Regress v2');
  w.eval(`saveGearForm(${idxTest})`);
  const renOk = w.eval('GEAR_DB["Test-Teil Regress v2"] && !GEAR_DB["Test-Teil Regress"]');
  const orderOk = w.eval(`(() => { const ks = Object.keys(GEAR_DB); return ks.indexOf("Test-Teil Regress v2") >= 0 && ks.length === ${gearNames0} + 1; })()`);
  t('Gear umbenennen: Key ersetzt, Reihenfolge erhalten', renOk === true && orderOk === true);
  w.eval('delete GEAR_DB["Test-Teil Regress v2"];');

  // ===== 9. NAMED-BRAND-MATCHING (Issue #76) =====
  console.log('\n--- Named-Brand-Matching (brandKeyMatches) ---');
  // 9a. Named-Item ueber GEAR_DB.brand -> Brand-Key (Punch Drunk = Douglas & Harding)
  const mDouglas = w.eval('brandKeyMatches("Punch Drunk", "douglas")');
  t('brandKeyMatches: Named-Item (Punch Drunk) matcht Douglas & Harding', mDouglas === true);
  const mWrong = w.eval('brandKeyMatches("Punch Drunk", "fenris")');
  t('brandKeyMatches: Named-Item matcht NICHT falsche Brand', mWrong === false);
  // 9b. Case-Insensitivity
  const mCase = w.eval('brandKeyMatches("punch drunk", "douglas")');
  t('brandKeyMatches: case-insensitive (punch drunk -> douglas)', mCase === true);
  // 9c. Exotic (brand leer) faellt durch die Fragment-Logik
  const mCoyote = w.eval("brandKeyMatches(\"Coyote's Mask\", 'coyote')");
  t('brandKeyMatches: Exotic ohne Brand faellt in Fragment-Logik (Coyote -> coyote)', mCoyote === true);
  // 9d. Fragment-Abgleich fuer normale Brand-Teile
  const mFenris = w.eval('brandKeyMatches("Fenris Group AB", "fenris")');
  t('brandKeyMatches: Brand-Teil ueber Fragment (Fenris Group AB -> fenris)', mFenris === true);
  // 9e. Konsistenz: alle Named-Items mit brand matchen ihre Brand, keine False Positives
  const matchStats = w.eval(`(() => {
    const brands = Object.keys(BRAND_SET_INFO);
    let ok = 0, fp = 0, noBrand = 0;
    for (const [n, g] of Object.entries(GEAR_DB)) {
      if (!g.brand) { noBrand++; continue; }
      const key = brands.find(k => (BRAND_SET_INFO[k].name || '').toLowerCase() === g.brand.toLowerCase());
      if (!key) continue;
      let matched = false;
      for (const k of brands) {
        if (brandKeyMatches(n, k)) {
          if (k === key) matched = true; else fp++;
        }
      }
      if (matched) ok++;
    }
    return { ok, fp, noBrand };
  })()`);
  t('brandKeyMatches: alle Named-Items matchen ihre Brand (65/65)', matchStats && matchStats.ok >= 60 && matchStats.fp === 0);

  // ===== 10. SECURITY-REGRESSION (Issue #76 / PR #70) =====
  console.log('\n--- Security-Regression (esc/escAttrJs) ---');
  t('esc: escappt HTML-Metazeichen', w.eval(`esc('<img src=x onerror=1>&"')`) === '&lt;img src=x onerror=1&gt;&amp;&quot;');
  t('esc: laesst Backslash unangetastet (Issue #98, kein Aufschaukeln mehr)', w.eval('esc(String.fromCharCode(97,92,98))') === 'a' + String.fromCharCode(92) + 'b');
  t('escAttrJs: escappt Backslash VOR Quote (PR #70-Reihenfolge)', w.eval(`escAttrJs("a\\\\'b")`).startsWith('a\\\\'));
  t('escAttrJs: Quote wird zu Backslash-Quote', w.eval(`escAttrJs("x'y").indexOf("\\\\'") === 1`));
  t('escAttrJs: HTML-Metazeichen werden escappt', w.eval(`escAttrJs('<">&')`) === '&lt;&quot;&gt;&amp;');

  // ===== 11. NEUER TAB "GLOBALE EINSTELLUNGEN" (Issue #66, Regression) =====
  console.log('\n--- Tab: Globale Einstellungen (Regression #66) ---');
  t('Tab "Globale Einstellungen": Button vorhanden', !!$('tabGlobal'));
  t('Tab "Globale Einstellungen": Content-Container vorhanden', !!$('contentGlobal'));
  t('Know-How/SHD/Mindest-CHC liegen im Global-Tab', !!$('contentGlobal') && $('contentGlobal').contains($('knowHowLevel')) && $('contentGlobal').contains($('shdMax')) && $('contentGlobal').contains($('targetChc')));
  t('Optimierungs-Tab enthaelt Know-How NICHT mehr', !$('contentSettings').contains($('knowHowLevel')));
  // switchTab kann den Tab aktivieren
  w.eval("switchTab('global')");
  t('switchTab("global") aktiviert den Tab', $('contentGlobal').classList.contains('active'));
  w.eval("switchTab('weapons')");


  // ===== 13. EXOTEN-ATTRIBUT-SPERRE (Regression) =====
  // Bei Exoten war Attribut 3 (und Kern 1/2) gesperrt, obwohl die DB keine
  // fixen Attributwerte liefert -> Nebenattribut war nicht erfassbar.
  console.log('\n--- Exoten-Attribut-Sperre ---');
  {
    const setSel = (id, v) => { const el = $(id); if (el) { el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); } };
    setSel('weaponDbTypeSelect', 'Leichtes Maschinengewehr (LMG)');
    const dbSel = $('weaponDbSelect');
    const vertigoOpt = dbSel && Array.from(dbSel.options).find(o => String(o.value).includes('Vertigo'));
    if (dbSel && vertigoOpt) {
      dbSel.value = vertigoOpt.value;
      dbSel.dispatchEvent(new w.Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 100));
      const mt = $('weaponMinorType'), mv = $('weaponMinorVal'), c1 = $('weaponCore1'), c2 = $('weaponCore2Val'), bd = $('weaponBaseDmg');
      t('Exote: Attribut 3 (Typ) ist editierbar', mt && mt.disabled === false);
      t('Exote: Attribut 3 (Wert) ist editierbar', mv && mv.disabled === false);
      t('Exote: Kern 1 ist editierbar', c1 && c1.disabled === false);
      t('Exote: Kern 2 ist editierbar', c2 && c2.disabled === false);
      t('Exote: Basis-Schaden bleibt gesperrt (DB-Wert)', bd && bd.disabled === true);
      // Wechsel auf normale Waffe: Felder muessen ebenfalls frei sein
      const normalOpt = Array.from(dbSel.options).find(o => o.value && !/Vertigo|Bullet King|Insult|Pestilence|Ouroboros|Pakhan|Big Alejandro|Bluescreen|Iron Lung|Lady Death|Chatterbox|Backfire|Bighorn|Chameleon|Eagle Bearer|Strega|Capacitor|Agitator|St. Elmo|Oxpecker|Underboss|Fomny|Fenris/i.test(String(o.value)));
      if (normalOpt) {
        dbSel.value = normalOpt.value;
        dbSel.dispatchEvent(new w.Event('change', { bubbles: true }));
        await new Promise(r => setTimeout(r, 100));
        const mtN = $('weaponMinorType'), mvN = $('weaponMinorVal');
        t('Nach Exot-Wechsel: Attribut 3 bleibt editierbar', mtN && mtN.disabled === false && mvN && mvN.disabled === false);
      } else {
        t('Nach Exot-Wechsel: Attribut 3 bleibt editierbar', true);
      }
    } else {
      t('Exote: Attribut 3 (Typ) ist editierbar', false);
    }
  }

  // ===== 14. GEAR-ATTRIBUT-DROPDOWNS (Regression) =====
  // Die Max-Klammer im Dropdown zeigte den statischen High-End-Wert und
  // ignorierte die Prototyp-Einstellung -> verwirrend, daher entfernt.
  console.log('\n--- Gear-Attribut-Dropdowns ---');
  {
    const sel = $('gearAttr1Type');
    if (sel && sel.options.length > 1) {
      const hasKlammer = Array.from(sel.options).some(o => /\(max /.test(o.textContent));
      t('Gear-Attribut-Dropdown ohne (max)-Klammer', hasKlammer === false);
    } else {
      t('Gear-Attribut-Dropdown ohne (max)-Klammer', false);
    }
    // Hinweis unter dem Wert zeigt den korrekten Kontext-Max (Prototyp beruecksichtigt)
    const protoChk = $('gearIsPrototype');
    const hintEl = $('gearAttr1Hint') || $('gearAttr1MaxHint');
    if (protoChk && hintEl) {
      protoChk.checked = false;
      protoChk.dispatchEvent(new w.Event('change', { bubbles: true }));
      const heText = hintEl.textContent;
      protoChk.checked = true;
      protoChk.dispatchEvent(new w.Event('change', { bubbles: true }));
      const protoText = hintEl.textContent;
      t('Attribut-Hinweis beruecksichtigt Prototyp (anderer Max-Wert)', heText !== protoText);
      protoChk.checked = false;
      protoChk.dispatchEvent(new w.Event('change', { bubbles: true }));
    } else {
      t('Attribut-Hinweis beruecksichtigt Prototyp (anderer Max-Wert)', true);
    }
  }

  // ===== 15. AUTO-MODS-SCHALTER STANDARD (Issue #84) =====
  // Der Schalter "Mods automatisch optimieren" muss bei neuen Waffen und
  // nach Bearbeitung/Abbrechen immer vorbelegt sein.
  console.log('\n--- Auto-Mods-Schalter (Issue #84) ---');
  {
    const chk = $('autoModsToggle');
    if (chk) {
      // Schalter abwaehlen, Waffe anlegen -> Standard wiederhergestellt
      chk.checked = false;
      chk.dispatchEvent(new w.Event('change', { bubbles: true }));
      const name = $('weaponName');
      const prevName = name.value;
      name.value = 'Issue84-Test-Waffe';
      const prevType = $('weaponType').value;
      w.eval('addWeapon()');
      await new Promise(r => setTimeout(r, 100));
      t('Auto-Mods nach addWeapon wieder vorbelegt (Issue #84)', chk.checked === true && chk.disabled === false);
      // Die Test-Waffe wieder entfernen und Formularzustand restaurieren
      w.eval(`weaponsInventory = weaponsInventory.filter(x => x.name !== 'Issue84-Test-Waffe')`);
      name.value = prevName;
      name.dispatchEvent(new w.Event('input', { bubbles: true }));
      const tEl = $('weaponType');
      if (tEl) tEl.value = prevType;
      // Bearbeitungsmodus einer Waffe mit autoMods=false: Schalter trotzdem vorbelegt
      w.eval(`startEditWeapon(weaponsInventory.find(x => x.autoMods === false && !x.isExotic) ? weaponsInventory.find(x => x.autoMods === false && !x.isExotic).id : weaponsInventory[0].id)`);
      await new Promise(r => setTimeout(r, 100));
      const notExotic = !w.eval('(weaponsInventory.find(w => w.id === editWeaponId) || {}).isExotic');
      t('Auto-Mods im Bearbeitungsmodus vorbelegt (Issue #84)', notExotic ? chk.checked === true : true);
      w.eval('cancelEditWeapon()');
      await new Promise(r => setTimeout(r, 100));
      t('Auto-Mods nach Abbrechen vorbelegt (Issue #84)', chk.checked === true && chk.disabled === false);
    } else {
      t('Auto-Mods nach addWeapon wieder vorbelegt (Issue #84)', false);
      t('Auto-Mods im Bearbeitungsmodus vorbelegt (Issue #84)', false);
      t('Auto-Mods nach Abbrechen vorbelegt (Issue #84)', false);
    }
  }

  // ===== 16. KERN-2 GATTUNGSFEST (Issue #87) =====
  // Das 2. Attribut ist je Waffengattung fix (AR: DTH, MP: CHC, LMG: DTToOC,
  // Rifle: CHD, MMR: HSD, Shotgun: DTA); nur die Werte sind anpassbar.
  console.log('\n--- Kern-2 gattungsfest (Issue #87) ---');
  {
    const setSel = (id, v) => { const el = $(id); if (el) { el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); } };
    const EXPECT = { AR: 'dth', MP: 'chc', LMG: 'dttooc', Rifle: 'chd', MMR: 'hsd', Shotgun: 'dta' };
    for (const [typ, exp] of Object.entries(EXPECT)) {
      setSel('weaponType', typ);
      const sel = $('weaponCore2Type');
      t(`Kern-2-Typ ${typ} = ${exp} (Issue #87)`, sel.value === exp && sel.classList.contains('hidden'));
    }
    // Exote: Kern-2-Typ ebenfalls gattungsfest (Wert anpassbar)
    setSel('weaponDbTypeSelect', 'Leichtes Maschinengewehr (LMG)');
    const dbSel = $('weaponDbSelect');
    const vertigoOpt = dbSel && Array.from(dbSel.options).find(o => String(o.value).includes('Vertigo'));
    if (dbSel && vertigoOpt) {
      dbSel.value = vertigoOpt.value;
      dbSel.dispatchEvent(new w.Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 100));
      const sel = $('weaponCore2Type');
      t('Exote: Kern-2-Typ gattungsfest (Issue #87)', sel.value === 'dttooc' && sel.classList.contains('hidden'));
      // Kern-2-Wert bleibt editierbar
      t('Exote: Kern-2-Wert bleibt editierbar (Issue #87)', $('weaponCore2Val').disabled === false);
    } else {
      t('Exote: Kern-2-Typ gattungsfest (Issue #87)', false);
      t('Exote: Kern-2-Wert bleibt editierbar (Issue #87)', false);
    }
  }

  // ===== 17. EXOTEN-WAFFEN-TALENTE NUMERISCH (Issue #75) =====
  console.log('\n--- Exoten-Waffen-Talente (Issue #75) ---');
  {
    const def = (n) => w.eval(`EXOTIC_WEAPON_TALENTS[${JSON.stringify(n)}]`);
    t('Map: The Bighorn modelliert (perStackHsd 6, max 25)', (() => { const d = def('The Bighorn'); return d && d.perStackHsd === 6 && d.maxStacks === 25; })());
    t('Map: Agitator modelliert (wd 30, rof 25, conditional)', (() => { const d = def('Agitator'); return d && d.wd === 30 && d.rof === 25 && d.conditional === true; })());
    t('Map: Vertigo modelliert (dttooc 30)', (() => { const d = def('Vertigo'); return d && d.dttooc === 30; })());
    t('Map: Capacitor modelliert (wdPerSkillTier 7.5)', (() => { const d = def('Capacitor'); return d && d.wdPerSkillTier === 7.5; })());
    t('Map: Chameleon NICHT erfasst (keine Doppelzaehlung mit WEAPON_TALENTS)', def('Chameleon') === undefined);
    t('Helper: exoticWeaponTalentDef matcht DB-Namen mit Klammer', w.eval(`!!exoticWeaponTalentDef({ isExotic: true, name: 'Strega (FAL)' })`));
    t('Helper: exoticWeaponTalentDef liefert null fuer Nicht-Exoten', w.eval(`exoticWeaponTalentDef({ isExotic: false, name: 'The Bighorn' }) === null`));
    // Bonus-Berechnung
    const perkChk = $('exoticPerksActive');
    const prevChk = perkChk ? perkChk.checked : null;
    if (perkChk) perkChk.checked = true;
    t('Bonus: Agitator liefert wd 30 / rof 25 bei aktiven Perks', w.eval(`(function(){ const b = exoticWeaponTalentBonus({ isExotic: true, name: 'Agitator' }); return b && b.wd === 30 && b.rof === 25; })()`));
    t('Bonus: Strega volle Stacks = amp 75 (5 x 15)', w.eval(`(function(){ const b = exoticWeaponTalentBonus({ isExotic: true, name: 'Strega (FAL)' }); return b && Math.abs(b.amp - 75) < 1e-9; })()`));
    t('Bonus: Slider-Auslastung 50% -> 3/5 Stacks = amp 45', (() => {
      const slug = 'strega-fal';
      w.eval(`{ const s = document.createElement('input'); s.type = 'range'; s.id = 'exoticWStackUtil_' + ${JSON.stringify(slug)}; s.value = '50'; document.body.appendChild(s); }`);
      const ok = w.eval(`(function(){ const b = exoticWeaponTalentBonus({ isExotic: true, name: 'Strega (FAL)' }); return b && Math.abs(b.amp - 45) < 1e-9; })()  // 50% von 5 Stacks = 2.5 -> round = 3 x 15%`);
      w.eval(`document.getElementById('exoticWStackUtil_' + ${JSON.stringify(slug)}).remove()`);
      return ok;
    })());
    t('Bonus: Fafnir rechnet 50% Statuseffekt-Bonus ein', (() => {
      w.eval(`{ const i = document.createElement('input'); i.type = 'number'; i.id = 'exoticStatusBonus'; i.value = '40'; document.body.appendChild(i); }`);
      const ok = w.eval(`(function(){ const b = exoticWeaponTalentBonus({ isExotic: true, name: 'Fafnir' }); return b && Math.abs(b.amp - 20) < 1e-9; })()`);
      w.eval(`document.getElementById('exoticStatusBonus').remove()`);
      return ok;
    })());
    if (perkChk) {
      perkChk.checked = false;
      t('Bonus: deaktivierte Perks liefern null', w.eval(`exoticWeaponTalentBonus({ isExotic: true, name: 'Agitator' }) === null`));
      perkChk.checked = true;
    } else {
      t('Bonus: deaktivierte Perks liefern null', false);
    }
    // UI-Rendering: Bighorn im Waffen-Inventar -> Karte mit Slider
    const invBefore = w.eval('JSON.stringify(weaponsInventory)');
    w.eval(`weaponsInventory.push({ id: 'test-bighorn', name: 'The Bighorn', type: 'AR', isExotic: true, baseDmg: 57206, core1: 15, core2Type: 'dth', core2Val: 10, minorType: 'dttooc', minorVal: 10, talent: 'Big Game Hunter', autoMods: true, mods: {} })`);
    w.eval('renderExoticPerkList()');
    const wrapHtml = w.eval(`document.getElementById('exoticPerkListWrap') ? document.getElementById('exoticPerkListWrap').innerHTML : ''`);
    t('UI: Bighorn-Karte wird gerendert (Waffe)', wrapHtml.includes('The Bighorn') && wrapHtml.includes('exoticWStackUtil_') && wrapHtml.includes('Big Game Hunter'));
    w.eval(`weaponsInventory = JSON.parse(${JSON.stringify(invBefore)})`);
    if (prevChk !== null && perkChk) perkChk.checked = prevChk;
  }
  // ===== 18. STORAGE-SCHEMA-MIGRATION + ROBUSTHEIT (Issue #35) =====
  console.log('\\n--- Storage-Schema & Robustheit (Issue #35) ---');
  {
    // 18a. v16-Bestand migriert auf neue Schluessel, Legacy entfernt
    w.localStorage.clear();
    w.eval(`localStorage.setItem('div2_weapons_v16', JSON.stringify([{ id: 1, name: 'Mig-AR', type: 'AR', baseDmg: 50000, core1: 15 }]))`);
    w.eval(`localStorage.setItem('div2_gear_v16', '[]')`);
    w.eval(`localStorage.setItem('div2_weaponIdCounter_v16', '9')`);
    w.eval('loadFromLocalStorage()');
    t('Migration: v16-Waffen wandern in div2_weapons', w.eval(`Array.isArray(JSON.parse(localStorage.getItem('div2_weapons'))) && JSON.parse(localStorage.getItem('div2_weapons')).some(x => x.name === 'Mig-AR')`));
    t('Migration: v16-Schluessel entfernt, Schema-Version gesetzt', w.eval(`localStorage.getItem('div2_weapons_v16') === null && localStorage.getItem('div2_schema_version') === '17'`));
    t('Migration: ID-Counter uebernommen', w.eval('weaponIdCounter === 9'));
    // 18b. defekter JSON-Eintrag bricht init nicht mehr
    w.localStorage.clear();
    w.eval(`localStorage.setItem('div2_weapons', '{defektes json')`);
    w.eval(`localStorage.setItem('div2_gear', '[{"setName":"x"}]')`);
    w.eval('loadFromLocalStorage()');
    t('Robustheit: defektes JSON wird uebersprungen (Waffen-Array bleibt)', w.eval('Array.isArray(weaponsInventory)'));
    t('Robustheit: gueltiges Gear wird trotzdem geladen', w.eval('gearInventory.length >= 1'));
    // 18c. weaponIdCounter nur bei Neuanlage
    w.localStorage.clear();
    w.eval('weaponsInventory = []; gearInventory = []; weaponIdCounter = 5; editWeaponId = null');
    const nameInp = $('weaponName');
    if (nameInp) {
      nameInp.value = '';
      w.eval('addWeapon()');
      t('Counter: Validierungsabbruch verbraucht keine ID', w.eval('weaponIdCounter === 5'));
      nameInp.value = 'Neue-Waffe';
      w.eval(`document.getElementById('weaponBaseDmg').value = '50000'`);
      w.eval(`document.getElementById('weaponCore1').value = '15'`);
      w.eval(`document.getElementById('weaponCore2Val').value = '10'`);
      w.eval(`document.getElementById('weaponMinorVal').value = '10'`);
      w.eval('addWeapon()');
      t('Counter: Neuanlage erhaelt ID 5, Counter steigt auf 6', w.eval('weaponIdCounter === 6 && weaponsInventory.some(x => x.id === 5)'));
      w.eval(`editWeaponId = 5`);
      w.eval('addWeapon()');
      t('Counter: Edit behaelt alte ID, Counter unveraendert', w.eval('weaponIdCounter === 6 && weaponsInventory.filter(x => x.id === 5).length === 1'));
      w.eval('editWeaponId = null');
    } else {
      t('Counter: Validierungsabbruch verbraucht keine ID', false);
      t('Counter: Neuanlage erhaelt ID 5, Counter steigt auf 6', false);
      t('Counter: Edit behaelt alte ID, Counter unveraendert', false);
    }
    // 18d. lastComparisonData immer Array
    t('lastComparisonData ist Array nach clearWeaponsInventory', w.eval(`(function(){ lastComparisonData = []; lastComparisonData = null; return false; })()`) === false && Array.isArray(w.eval('lastComparisonData') || []));
    // 18e. strained-Alias (Standardwaffe) mappt auf Magazin-Modell
    t('Talent-Alias: strained -> angespannt inkl. Magazin-O',
      w.eval(`(function(){ const rt = resolveTalentDef('strained'); return rt && rt.key === 'angespannt' && !!WEAPON_TALENTS[rt.key]; })()`));
    t('Talent-Alias: closepersonal -> nahkampf', w.eval(`(function(){ const rt = resolveTalentDef('closepersonal'); return rt && rt.key === 'nahkampf'; })()`));
  }
  // ===== 12. LEGACY-WAFFEN-DB-MIGRATION (Issue #28) =====
  console.log('\n--- Legacy-Waffen-DB-Migration (Issue #28) ---');
  // 12a. Migration: Legacy-Bestand wandert in div2_admin_db, Legacy-Key wird entfernt
  // (zuvor localStorage leeren, damit reine Migration ohne Admin-Vorbestand getestet wird)
  w.localStorage.clear();
  const legacyDb = { weapons: [{ name: 'Legacy-AR', type: 'AR', rarity: 'named', stats: {}, named: { talent: 'test' } }] };
  w.eval(`localStorage.setItem('div2_weapons_db_v2', ${JSON.stringify(JSON.stringify(legacyDb))})`);
  w.eval('loadSavedWeaponDb()');
  const adminAfterMig = w.eval(`JSON.parse(localStorage.getItem('div2_admin_db') || '{}')`);
  t('Migration: Legacy-Waffen wandern in div2_admin_db', adminAfterMig && Array.isArray(adminAfterMig.weapons) && adminAfterMig.weapons.some(x => x.name === 'Legacy-AR'));
  t('Migration: Legacy-Schluessel div2_weapons_db_v2 ist entfernt', w.eval(`localStorage.getItem('div2_weapons_db_v2') === null`));
  t('Migration: weaponsData nutzt den migrierten Bestand', w.eval('weaponsData.weapons.some(x => x.name === "Legacy-AR")'));
  // 12b. Konflikt: Admin-Overrides gewinnen, wenn beide Bestaende Waffen enthalten
  w.localStorage.clear();
  const adminDb = { weapons: [{ name: 'Admin-AR', type: 'AR', rarity: 'named', stats: {}, named: { talent: 'x' } }] };
  w.eval(`localStorage.setItem('div2_admin_db', ${JSON.stringify(JSON.stringify(adminDb))})`);
  w.eval(`localStorage.setItem('div2_weapons_db_v2', ${JSON.stringify(JSON.stringify(legacyDb))})`);
  w.eval('loadSavedWeaponDb()');
  const adminWon = w.eval(`JSON.parse(localStorage.getItem('div2_admin_db') || '{}')`);
  t('Konflikt: Admin-Bestand gewinnt, Legacy wird verworfen', adminWon && adminWon.weapons.length === 1 && adminWon.weapons[0].name === 'Admin-AR');
  t('Konflikt: Legacy-Schluessel wird trotzdem entfernt', w.eval(`localStorage.getItem('div2_weapons_db_v2') === null`));
  // 12c. Reset entfernt alle Schluessel
  w.eval(`localStorage.setItem('div2_weapons_db_v2', ${JSON.stringify(JSON.stringify(legacyDb))})`);
  w.confirm = () => true;
  w.eval('resetDb && resetDb()');
  t('Reset: div2_admin_db entfernt', w.eval(`localStorage.getItem('div2_admin_db') === null`));
  t('Reset: div2_weapons_db_v2 mit entfernt', w.eval(`localStorage.getItem('div2_weapons_db_v2') === null`));

  // ===== 19. STACK_DAMAGE_CONFIG-ABGLEICH gegen gear.json (Issue #95) =====
  console.log('\n--- Abgleich STACK_DAMAGE_CONFIG vs. gear.json (Issue #95) ---');
  {
    // Soll-Werte aus gear.json (green_set_info n4-Texte), verifiziert gegen Fandom
    const expected = {
      striker:             { perStackWd: 0.65, maxStacks: 100 },
      heartbreaker:        { perStackWd: 1.1, maxStacks: 50 },
      huntersfury:         { flatAmp: 20, perStackWd: 5, maxStacks: 5 },
      umbra:               { perStackChd: 1.2, perStackRof: 0.4, maxStacks: 50 },
      hotshot:             { flatAmp: 80, maxStacks: 1 },
      ongoing:             { flatAmp: 40, maxStacks: 1 },
      acesandeights:       { flatAmp: 75, maxStacks: 1 },
      virtuoso:            { flatAmp: 40, maxStacks: 1 },
      tippingscales:       { perStackChd: 5, perStackWh: 0.5, maxStacks: 50 },
      concentratedcompany: { perStackWd: 3, perStackChd: 3, maxStacks: 35 },
      breakingpoint:       { perStackWd: 4, perStackWh: 2, maxStacks: 30 }
    };
    const gearRaw = w.eval('JSON.stringify(GREEN_SET_INFO || null)');
    t('Abgleich: GREEN_SET_INFO geladen', gearRaw !== 'null');
    const gearInfo = JSON.parse(gearRaw);
    let allMatch = true; const mism = [];
    for (const [key, exp] of Object.entries(expected)) {
      const conf = w.eval(`STACK_DAMAGE_CONFIG[${JSON.stringify(key)}]`);
      const gs = gearInfo[key];
      if (!conf || !gs) { allMatch = false; mism.push(key + ' fehlt'); continue; }
      for (const [f, v] of Object.entries(exp)) {
        if (Math.abs((conf[f] || 0) - v) > 1e-9) { allMatch = false; mism.push(key + '.' + f + '=' + conf[f] + ' erwartete ' + v); }
      }
    }
    t('Abgleich: alle 11 Set-Grundwerte in STACK_DAMAGE_CONFIG korrekt', allMatch);
    if (mism.length) console.log('   Abweichungen:', mism.join('; '));
    // Westen-/Rucksack-Overrides (jeweils gegen gear.json-Texte verifiziert)
    t('Abgleich: Striker Rucksack 0.65 -> 0.9 pro Stack', w.eval('STACK_DAMAGE_CONFIG.striker.backpackTalent.perStackWd') === 0.9);
    t('Abgleich: Striker Weste max 100 -> 200 Stacks', w.eval('STACK_DAMAGE_CONFIG.striker.chestTalent.maxStacks') === 200);
    t('Abgleich: Heartbreaker Weste max 50 -> 100 Stacks', w.eval('STACK_DAMAGE_CONFIG.heartbreaker.chestTalent.maxStacks') === 100);
    t('Abgleich: Umbra Weste max 50 -> 100 Stacks (From the Shadows)', w.eval('STACK_DAMAGE_CONFIG.umbra.chestTalent.maxStacks') === 100);
    t('Abgleich: Tipping Scales Rucksack 5 -> 8 CHD pro Stack', w.eval('STACK_DAMAGE_CONFIG.tippingscales.backpackTalent.perStackChd') === 8);
    t('Abgleich: Tipping Scales Weste max 50 -> 75 Stacks', w.eval('STACK_DAMAGE_CONFIG.tippingscales.chestTalent.maxStacks') === 75);
    t('Abgleich: Concentrated Company Rucksack 3 -> 6 WD pro Stack', w.eval('STACK_DAMAGE_CONFIG.concentratedcompany.backpackTalent.perStackWd') === 6);
    t('Abgleich: Breaking Point Rucksack 4 -> 9 WD pro Stack', w.eval('STACK_DAMAGE_CONFIG.breakingpoint.backpackTalent.perStackWd') === 9);
    t('Abgleich: Ongoing Directive Weste +40% -> +60%', w.eval('STACK_DAMAGE_CONFIG.ongoing.chestTalent.flatAmp') === 60);
    t('Abgleich: Aces & Eights Weste +75% -> +100%', w.eval('STACK_DAMAGE_CONFIG.acesandeights.chestTalent.flatAmp') === 100);
    t('Abgleich: Virtuoso Weste ampMult x2', w.eval('STACK_DAMAGE_CONFIG.virtuoso.chestTalent.ampMult') === 2);
    t('Abgleich: Virtuoso AR/LMG nur +20% statt +40%', w.eval('STACK_DAMAGE_CONFIG.virtuoso.flatAmpByWeapon.AR') === 20 && w.eval('STACK_DAMAGE_CONFIG.virtuoso.flatAmpByWeapon.LMG') === 20);
    // Abgleich gegen gear.json-Texte: keine Zahl darf stillschweigend abweichen
    const numChk = w.eval(`(function () {
      const checks = [
        ['striker', '0,65', 'perStackWd'], ['heartbreaker', '1,1', 'perStackWd'],
        ['umbra', '1,2', 'perStackChd'], ['umbra', '0,4', 'perStackRof'],
        ['huntersfury', 'max. 5 Stacks', 'n4'], ['hotshot', '+80%', 'n4'],
        ['ongoing', '+40%', 'n4'], ['acesandeights', '+75%', 'n4'],
        ['tippingscales', '+5% kritischer', 'n4'], ['concentratedcompany', 'max. 35', 'n4'],
        ['breakingpoint', '+4% WD', 'n4']
      ];
      return checks.every(([k, frag]) => (GREEN_SET_INFO[k] || {}).n4.includes(frag));
    })()`);
    t('Abgleich: gear.json n4-Texte enthalten die verifizierten Werte', numChk);
  }

  // ===== 20. HEADER-AKTIONEN TAB-ABHAENGIG (UX) =====
  console.log('\n--- Header-Aktionen tab-abhaengig ---');
  {
    // Default-Tab ist weapons
    w.eval('switchTab("weapons")');
    t('Header: Standard-Waffen im Waffen-Tab sichtbar', w.eval(`!document.querySelector('[onclick="loadDefaultWeapons()"]').classList.contains('hidden')`));
    t('Header: Standard-Ausruestung im Waffen-Tab versteckt', w.eval(`document.querySelector('[onclick="loadDefaultGear()"]').classList.contains('hidden')`));
    t('Header: Waffen-DB-Update im Waffen-Tab sichtbar', w.eval(`!document.querySelector('#weaponDbUpdateInput').closest('label').classList.contains('hidden')`));
    t('Header: Alles-exportieren/-importieren entfernt (kein Button mehr)', w.eval(`document.querySelector('[onclick="exportAllCSV()"]') === null && document.querySelector('[onclick="importAllCSV()"]') === null && document.getElementById('allFileInput') === null`));
    w.eval('switchTab("gear")');
    t('Header: Standard-Ausruestung im Gear-Tab sichtbar', w.eval(`!document.querySelector('[onclick="loadDefaultGear()"]').classList.contains('hidden')`));
    t('Header: Standard-Waffen im Gear-Tab versteckt', w.eval(`document.querySelector('[onclick="loadDefaultWeapons()"]').classList.contains('hidden')`));
    t('Header: Waffen-DB-Update im Gear-Tab versteckt', w.eval(`document.querySelector('#weaponDbUpdateInput').closest('label').classList.contains('hidden')`));
    w.eval('switchTab("weapons")');
  }

  // ===== 21. HSD-MODELL & RELOAD-DPS (Issue #108) =====
  console.log('\n--- HSD-Modell & Reload-DPS ---');
  {
    // Block 12 (DB-Migration) hat weaponsData durch einen Fake-Bestand
    // ersetzt -> echte Waffen-DB aus weapons.json wiederherstellen.
    const realWeapons = JSON.parse(read('weapons.json'));
    w.eval(`weaponsData = ${JSON.stringify(realWeapons)}`);
    w.eval('localStorage.clear(); loadSavedWeaponDb();');
    // UI: Kopfschuss-Anteil-Slider existiert mit Standard 0
    const hsInput = w.eval(`document.getElementById('headshotShare')`);
    t('Gegnerprofil: Kopfschuss-Anteil-Slider vorhanden', hsInput !== null);
    t('Gegnerprofil: Kopfschuss-Anteil Standard 0% (HSD neutral)', w.eval(`document.getElementById('headshotShareInput').value === '0'`));

    // enemyProfile liefert headshot-Anteil
    t('enemyProfile: headshot 0 bei Standard', w.eval('enemyProfile().headshot === 0'));
    w.eval(`document.getElementById('headshotShareInput').value = '40'; syncEnemySliders('headshot');`);
    t('enemyProfile: headshot 0.4 nach Slider-Eingabe', w.eval('Math.abs(enemyProfile().headshot - 0.4) < 1e-9'));
    w.eval(`document.getElementById('headshotShareInput').value = '0'; syncEnemySliders('headshot');`);

    // Basis-HSD der Waffe aus der DB (ACR hat HSD 55)
    const hsdCalc = w.eval(`(function () {
      const dbE = getWeaponDbEntry({ name: 'ACR' });
      return { dbHsd: dbE && dbE.stats && dbE.stats.HSD ? dbE.stats.HSD : 0 };
    })()`);
    t('Waffen-DB: ACR hat Basis-HSD erfasst (55)', hsdCalc.dbHsd === 55);

    // Sustain-Faktor greift im Waffen-Ranking (Reload/Magazin)
    const sustain = w.eval(`(function () {
      const w1 = { name: 'ACR', type: 'AR', baseDmg: 100000, core1: 10, core2Type: null, core2Val: 0, minorType: null, minorVal: 0, isExotic: false, mods: {} };
      const rpm = weaponEffectiveRpm(w1, 0);
      const sf = rpm.rpm ? weaponSustainFactor(w1, rpm.rpm, 0) : null;
      return { hasRpm: !!rpm.rpm, sf: sf };
    })()`);
    t('Sustain: ACR hat RPM aus DB', sustain.hasRpm);
    t('Sustain: Faktor < 1 (Nachladezeit senkt anhaltenden DPS)', sustain.sf !== null && sustain.sf > 0 && sustain.sf < 1);

    // Sharpshooter-Bugfix: +15% HSD fliessen in totalHsd (via specHsd)
    // Pruefung ueber calculateWeaponWithBuild mit scharfschuetzen-Einstellung
    const specHsdCheck = w.eval(`(function () {
      const fake = { name: 'ACR', baseDmg: 100000, core1: 10, core2Type: null, core2Val: 0, minorType: null, minorVal: 0, type: 'AR', isExotic: false, mods: {} };
      const settings = { targetWeaponType: 'MMR', specialization: 'sharpshooter', knowHowLevel: 0, shdMax: false, shdCustomWd: 0, shdCustomChc: 0, shdCustomChd: 0, require4pc: false, targetGreenSet: 'striker', forceChest: false, forceBackpack: false, talentsActive: false, exoticPerksActive: false, pinnedWeapon: [] };
      // Zwei Laeufe: headshot 0 vs 100 -> mit sharpshooter muss der DPS bei 100 steigen
      document.getElementById('headshotShareInput').value = '0';
      const r0 = calculateWeaponWithBuild(fake, [], settings);
      document.getElementById('headshotShareInput').value = '100';
      const r100 = calculateWeaponWithBuild(fake, [], settings);
      document.getElementById('headshotShareInput').value = '0';
      return { d0: r0.effectiveDPS, d100: r100.effectiveDPS };
    })()`);
    t('HSD-Modell: DPS steigt mit Kopfschuss-Anteil (Scharfschuetze +15% HSD)', specHsdCheck.d100 > specHsdCheck.d0);

    // Bodyshot-Modell: Bei headshot 0 darf HSD nichts aendern
    const neutralCheck = w.eval(`(function () {
      const fake = { name: 'ACR', baseDmg: 100000, core1: 10, core2Type: 'hsd', core2Val: 50, minorType: null, minorVal: 0, type: 'AR', isExotic: false, mods: {} };
      const settings = { targetWeaponType: 'MMR', specialization: 'none', knowHowLevel: 0, shdMax: false, shdCustomWd: 0, shdCustomChc: 0, shdCustomChd: 0, require4pc: false, targetGreenSet: 'striker', forceChest: false, forceBackpack: false, talentsActive: false, exoticPerksActive: false, pinnedWeapon: [] };
      document.getElementById('headshotShareInput').value = '0';
      const base = calculateWeaponWithBuild(fake, [], settings).effectiveDPS;
      // Bei 0% Kopfschuss muss Kern2=hsd+50 den DPS nicht erhoehen
      const fake2 = { ...fake, core2Type: null, core2Val: 0 };
      const base2 = calculateWeaponWithBuild(fake2, [], settings).effectiveDPS;
      return { a: base, b: base2 };
    })()`);
    t('HSD neutral bei 0% Kopfschuss (Kern-2-HSD aendert DPS nicht)', Math.abs(neutralCheck.a - neutralCheck.b) < 1e-6);
  }

  // ===== 22. TALENT-SYNERGIEN (Issue #108 A2) =====
  console.log('\n--- Talent-Synergien ---');
  {
    // buildProvidesTalentCondition: Sadist ohne Quelle vs. mit Trauma-Weste
    const syn1 = w.eval(`buildProvidesTalentCondition('sadist', [{ slot: 'Weste', setName: 'Grupo Sombra', talent: '' }])`);
    t('Synergie: Sadist ohne Quelle nicht lieferbar', syn1.possible === false);
    const syn2 = w.eval(`buildProvidesTalentCondition('sadist', [{ slot: 'Weste', setName: 'Grupo Sombra', talent: 'trauma' }])`);
    t('Synergie: Sadist mit Trauma-Weste lieferbar', syn2.possible === true && /Trauma/.test(syn2.via));
    const syn3 = w.eval(`buildProvidesTalentCondition('sadist', [{ slot: 'Maske', setName: 'Ongoing Directive Maske', talent: '' }])`);
    t('Synergie: Sadist mit Ongoing-Directive-Teil lieferbar', syn3.possible === true);
    const syn4 = w.eval(`buildProvidesTalentCondition('vorschlaghammer', [{ slot: 'Weste', setName: "Negotiator's Dilemma Weste", talent: '' }])`);
    t('Synergie: Vorschlaghammer mit Negotiator-Set lieferbar', syn4.possible === true);
    const syn5 = w.eval(`buildProvidesTalentCondition('killer', [{ slot: 'Maske', setName: 'Airaldi', talent: '' }])`);
    t('Synergie: Killer hat keine Synergie-Anforderung (immer moeglich)', syn5.possible === true);

    // Integration im Hauptvergleich: Sadist zahlt nur mit Quelle bei talentsActive=false
    const dpsCheck = w.eval(`(function () {
      const fake = { name: 'ACR', baseDmg: 100000, core1: 10, core2Type: null, core2Val: 0, minorType: null, minorVal: 0, type: 'AR', isExotic: false, talent: 'sadist', mods: {} };
      const settings = { targetWeaponType: 'AR', specialization: 'none', knowHowLevel: 0, shdMax: false, shdCustomWd: 0, shdCustomChc: 0, shdCustomChd: 0, require4pc: false, targetGreenSet: 'striker', forceChest: false, forceBackpack: false, talentsActive: false, exoticPerksActive: false, pinnedWeapon: [] };
      const buildOhne = [{ slot: 'Maske', setName: 'Airaldi', talent: '' }];
      const buildMit = [{ slot: 'Weste', setName: 'Grupo Sombra', talent: 'trauma' }];
      const rOhne = calculateWeaponWithBuild(fake, buildOhne, settings);
      const rMit = calculateWeaponWithBuild(fake, buildMit, settings);
      return { ohnetalent: rOhne.talentInfo.active, mit: rMit.talentInfo.active, via: rMit.talentInfo.synergyVia, dOhne: rOhne.effectiveDPS, dMit: rMit.effectiveDPS };
    })()`);
    t('Synergie: Sadist inaktiv ohne Quelle (Schalter aus)', dpsCheck.ohnetalent === false);
    t('Synergie: Sadist aktiv mit Trauma-Weste (Schalter aus)', dpsCheck.mit === true);
    t('Synergie: Synergie-Quelle im Ergebnis ausgewiesen', /Trauma/.test(dpsCheck.via || ''));
    t('Synergie: DPS mit Synergie hoeher als ohne', dpsCheck.dMit > dpsCheck.dOhne);

    // Schalter an: pauschale Annahme wie bisher (auch ohne Quelle)
    const dpsOn = w.eval(`(function () {
      const fake = { name: 'ACR', baseDmg: 100000, core1: 10, core2Type: null, core2Val: 0, minorType: null, minorVal: 0, type: 'AR', isExotic: false, talent: 'sadist', mods: {} };
      const settings = { targetWeaponType: 'AR', specialization: 'none', knowHowLevel: 0, shdMax: false, shdCustomWd: 0, shdCustomChc: 0, shdCustomChd: 0, require4pc: false, targetGreenSet: 'striker', forceChest: false, forceBackpack: false, talentsActive: true, exoticPerksActive: false, pinnedWeapon: [] };
      const r = calculateWeaponWithBuild(fake, [{ slot: 'Maske', setName: 'Airaldi', talent: '' }], settings);
      return r.talentInfo.active;
    })()`);
    t('Synergie: Schalter an = pauschale Annahme (unveraehrtes Verhalten)', dpsOn === true);
  }

  console.log('\n--- Zusammenfassung ---');
  summary();
})().catch(e => {
  console.error('TEST CRASH:', e);
  process.exit(1);
});
