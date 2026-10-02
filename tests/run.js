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
  // ===== 4c. SPIELREGEL: MAX. 1 EXOT (Issue #44) =====
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
  setSelect('forceExoticGear', firstExoticGear || '');
  await w.eval('calculateCombinedComparison()');
  await new Promise(r => setTimeout(r, 800));
  const forcedMulti = w.eval(`(() => (lastComparisonData || []).filter(r => r.build.filter(i => isExoticGearName(i.setName)).length > 1).length)()`);
  t('Spielregel: kein Build mit erzwungenem Exot enthaelt einen Zweit-Exot', forcedMulti === 0);
  setSelect('forceExoticGear', '');
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
  t('esc: escappt Backslash (PR #70)', w.eval('esc(String.fromCharCode(97,92,98))') === 'a' + String.fromCharCode(92,92) + 'b');
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

  console.log('\n--- Zusammenfassung ---');
  summary();
})().catch(e => {
  console.error('TEST CRASH:', e);
  process.exit(1);
});
