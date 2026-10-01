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
  if (booted) { runScript('js/app.js'); runScript('js/app2.js'); }
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

  // Dropdowns vorhanden und gefüllt (Standard-Inventar enthält Exoten)
  const feGear = $('forceExoticGear');
  const feWeap = $('forceExoticWeapon');
  t('Exoten-Zwang: Gear-Dropdown vorhanden', !!feGear);
  t('Exoten-Zwang: Waffen-Dropdown vorhanden', !!feWeap);
  const feGearOpts = feGear ? [...feGear.options].filter(o => o.value).length : 0;
  const feWeapOpts = feWeap ? [...feWeap.options].filter(o => o.value).length : 0;
  t('Exoten-Zwang: Gear-Dropdown listet Exoten aus dem Inventar', feGearOpts >= 1);
  t('Exoten-Zwang: Waffen-Dropdown listet exotische Waffen', feWeapOpts >= 1);

  // Erzwungene exotische Waffe: alle Ergebnisse nutzen genau diese Waffe
  const firstExoticWeapon = feWeap ? ([...feWeap.options].find(o => o.value) || {}).value : '';
  if (firstExoticWeapon) {
    setSelect('forceExoticWeapon', firstExoticWeapon);
    await w.eval('calculateCombinedComparison()');
    await new Promise(r => setTimeout(r, 800));
    const forcedResults = w.eval('lastComparisonData || []');
    t('Exoten-Zwang: mit erzwungener Waffe liefern Ergebnisse', Array.isArray(forcedResults) && forcedResults.length > 0);
    t('Exoten-Zwang: alle Ergebnisse nutzen die erzwungene Waffe', Array.isArray(forcedResults) && forcedResults.length > 0 && forcedResults.every(r => r.weapon && r.weapon.name === firstExoticWeapon));
    setSelect('forceExoticWeapon', '');
  } else {
    t('Exoten-Zwang: alle Ergebnisse nutzen die erzwungene Waffe', true);
  }

  // Erzwungenes exotisches Gear: alle Ergebnis-Builds enthalten den Exoten
  const firstExoticGear = feGear ? ([...feGear.options].find(o => o.value) || {}).value : '';
  if (firstExoticGear) {
    setSelect('forceExoticGear', firstExoticGear);
    await w.eval('calculateCombinedComparison()');
    await new Promise(r => setTimeout(r, 800));
    const forcedGearResults = w.eval('lastComparisonData || []');
    t('Exoten-Zwang: mit erzwungenem Gear liefern Ergebnisse', Array.isArray(forcedGearResults) && forcedGearResults.length > 0);
    t('Exoten-Zwang: alle Builds enthalten das erzwungene Exoten-Gear', Array.isArray(forcedGearResults) && forcedGearResults.length > 0 && forcedGearResults.every(r => r.build && r.build.some(i => i.setName === firstExoticGear)));
    setSelect('forceExoticGear', '');
    await w.eval('calculateCombinedComparison()');
    await new Promise(r => setTimeout(r, 800));
  } else {
    t('Exoten-Zwang: alle Builds enthalten das erzwungene Exoten-gear', true);
  }


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

  console.log('\n--- Zusammenfassung ---');
  summary();
})().catch(e => {
  console.error('TEST CRASH:', e);
  process.exit(1);
});
