// ===== VERWALTUNG: CRUD für Waffen-, Gear- und Mod-Datenbanken =====
// Alle Änderungen werden in localStorage gespeichert (div2_admin_db) und beim
// Start von boot.js auf die per fetch() geladenen Original-Daten angewendet.

const ADMIN_LS_KEY = 'div2_admin_db';

function getAdminOverrides() {
    try { return JSON.parse(localStorage.getItem(ADMIN_LS_KEY)) || {}; } catch (e) { return {}; }
}
function saveAdminOverrides(o) {
    try { localStorage.setItem(ADMIN_LS_KEY, JSON.stringify(o)); } catch (e) {}
}
function adminHasOverrides() {
    return Object.keys(getAdminOverrides()).length > 0;
}

// Wendet gespeicherte Overrides auf die globalen Datenobjekte an.
// Aufgerufen aus boot.js nach dem Laden der Original-JSONs.
function applyAdminOverrides() {
    const o = getAdminOverrides();
    if (o.weapons && Array.isArray(o.weapons)) weaponsData.weapons = o.weapons;
    if (o.gear) {
        if (o.gear.named_item_configs) NAMED_ITEM_CONFIGS = o.gear.named_item_configs;
        if (o.gear.gear_db) GEAR_DB = o.gear.gear_db;
        if (o.gear.green_set_info) GREEN_SET_INFO = o.gear.green_set_info;
    }
    if (o.mods && o.mods.slots) MOD_CATALOG = o.mods.slots;
}

// ---------- Helpers ----------
function escAttrJs(v) { return String(v == null ? '' : v).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function esc(v) { return String(v == null ? '' : v).replace(/\\/g,'\\\\').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function adminToast(msg, type) { if (typeof showToast === 'function') showToast(msg, type || 'success'); }

function openAdminModal(title) {
    document.getElementById('adminModalTitle').textContent = title;
    document.getElementById('adminModal').classList.remove('hidden');
}
function closeAdminModal() {
    document.getElementById('adminModal').classList.add('hidden');
    document.getElementById('adminModalBody').innerHTML = '';
}
document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !document.getElementById('adminModal').classList.contains('hidden')) {
        ev.preventDefault();
        closeAdminModal();
    }
});

function modalInput(id, label, value, opts) {
    opts = opts || {};
    const val = esc(value == null ? '' : value);
    const type = opts.type || 'text';
    const step = opts.step ? ` step="${opts.step}"` : '';
    const ph = opts.placeholder ? ` placeholder="${esc(opts.placeholder)}"` : '';
    const req = opts.required ? ' required' : '';
    const hint = opts.hint ? `<p class="text-xs text-gray-500">${esc(opts.hint)}</p>` : '';
    const min = opts.min != null ? ` min="${opts.min}"` : '';
    const max = opts.max != null ? ` max="${opts.max}"` : '';
    if (opts.type === 'number') {
        return `<div><label class="block text-xs font-semibold uppercase text-gray-400 mb-1">${esc(label)}</label>
        <input type="number" id="${id}" value="${val}"${step}${ph}${req}${min}${max} class="w-full p-2.5 rounded-lg text-sm">${hint}</div>`;
    }
    if (opts.type === 'textarea') {
        return `<div><label class="block text-xs font-semibold uppercase text-gray-400 mb-1">${esc(label)}</label>
        <textarea id="${id}" rows="${opts.rows||2}" class="w-full p-2.5 rounded-lg text-sm">${val}</textarea>${hint}</div>`;
    }
    if (opts.type === 'select') {
        const optsHtml = opts.options.map(o => {
            const [v, l] = Array.isArray(o) ? o : [o, o];
            const sel = String(v) === String(value) ? ' selected' : '';
            return `<option value="${esc(v)}"${sel}>${esc(l)}</option>`;
        }).join('');
        return `<div><label class="block text-xs font-semibold uppercase text-gray-400 mb-1">${esc(label)}</label>
        <select id="${id}" class="w-full p-2.5 rounded-lg text-sm">${optsHtml}</select>${hint}</div>`;
    }
    return `<div><label class="block text-xs font-semibold uppercase text-gray-400 mb-1">${esc(label)}</label>
    <input type="text" id="${id}" value="${val}"${ph}${req} class="w-full p-2.5 rounded-lg text-sm">${hint}</div>`;
}

function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}
function getNum(id) {
    const el = document.getElementById(id);
    return el && el.value !== '' ? parseFloat(el.value) : null;
}
function getChk(id) {
    const el = document.getElementById(id);
    return !!(el && el.checked);
}

// ---------- Persistenz ----------
function persistAdminDb() {
    // Nie leere Datenbestaende persistieren (Schutz vor kaputtem Zustand)
    if (!Array.isArray(weaponsData.weapons) || weaponsData.weapons.length === 0) return;
    if (!GEAR_DB || typeof GEAR_DB !== 'object' || Object.keys(GEAR_DB).length === 0) return;
    const o = getAdminOverrides();
    o.weapons = weaponsData.weapons;
    o.gear = { named_item_configs: NAMED_ITEM_CONFIGS, gear_db: GEAR_DB, green_set_info: GREEN_SET_INFO, brand_set_info: BRAND_SET_INFO };
    o.mods = { slots: MOD_CATALOG };
    saveAdminOverrides(o);
}

function refreshAfterDbChange(msg) {
    persistAdminDb();
    // App-Drop-downs aktualisieren (wenn bereits initialisiert)
    try { if (typeof populateWeaponTypeDropdown === 'function') populateWeaponTypeDropdown(); } catch (e) {}
    try { if (typeof updateGearDbOptions === 'function') updateGearDbOptions(); } catch (e) {}
    try { if (typeof populateModSelects === 'function') populateModSelects(getVal('weaponName'), getVal('weaponType')); } catch (e) {}
    renderAdminTables();
    adminToast(msg);
}

// ---------- Tabellen-Rendering ----------
function renderAdminTables() {
    populateWeaponTypeFilter();
    populateGearSlotFilter();
    renderWeaponsAdmin();
    renderGearAdmin();
    renderBrandsAdmin();
    renderGreensAdmin();
    renderModsAdmin();
}

function actionBtns(onEdit, onDel, editTitle, delTitle) {
    return `<div class="flex gap-1">
        <button onclick="${onEdit}" title="${editTitle}" class="btn-secondary px-2 py-1 rounded text-xs">✏️</button>
        <button onclick="${onDel}" title="${delTitle}" class="btn-secondary px-2 py-1 rounded text-xs text-red-400 hover:text-red-300">🗑️</button>
    </div>`;
}

function adminWeaponRarity(w) {
    return w.is_exotic ? 'exotic' : (w.is_named ? 'named' : 'highend');
}

function fillSelectOptions(id, options, keepValue) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = keepValue ? sel.value : null;
    sel.innerHTML = options.map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('');
    if (keepValue && cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
}

const ADMIN_RARITY_LABELS = { highend: 'High-End', named: 'Named', exotic: 'Exotisch' };
const ADMIN_GEAR_CLASS_LABELS = { named: 'Named', exotic: 'Exotisch', brand: 'Brand-Set', gearset: 'Gear-Set' };

function populateWeaponTypeFilter() {
    const types = [...new Set(weaponsData.weapons.map(w => w.type).filter(Boolean))].sort();
    fillSelectOptions('adminWeaponTypeFilter', [['', 'Alle Gattungen'], ...types.map(t => [t, t])], true);
    populateWeaponRarityFilter();
}

function populateWeaponRarityFilter() {
    const tf = getVal('adminWeaponTypeFilter') || '';
    const pool = weaponsData.weapons.filter(w => !tf || w.type === tf);
    const rars = [...new Set(pool.map(adminWeaponRarity))].sort();
    fillSelectOptions('adminWeaponRarityFilter', [['', 'Alle Arten'], ...rars.map(r => [r, ADMIN_RARITY_LABELS[r] || r])], true);
}

function populateGearSlotFilter() {
    const slots = [...new Set(Object.values(GEAR_DB).map(g => g.slot).filter(Boolean))].sort();
    fillSelectOptions('adminGearSlotFilter', [['', 'Alle Slots'], ...slots.map(s => [s, s])], true);
    populateGearClassFilter();
}

function gearClassOf(g) {
    if (g.cls && ADMIN_GEAR_CLASS_LABELS[g.cls]) return g.cls;
    if (g.cls) return g.cls;
    if (g.brand) return 'brand';
    if (g.set || g.gearset) return 'gearset';
    return g.cls || 'named';
}

function populateGearClassFilter() {
    const sf = getVal('adminGearSlotFilter') || '';
    const pool = Object.values(GEAR_DB).filter(g => !sf || g.slot === sf);
    const cls = [...new Set(pool.map(gearClassOf))].sort();
    fillSelectOptions('adminGearClassFilter', [['', 'Alle Klassen'], ...cls.map(c => [c, ADMIN_GEAR_CLASS_LABELS[c] || c])], true);
    populateGearBrandFilter();
}

function populateGearBrandFilter() {
    const sf = getVal('adminGearSlotFilter') || '';
    const cf = getVal('adminGearClassFilter') || '';
    const pool = Object.values(GEAR_DB).filter(g => (!sf || g.slot === sf) && (!cf || gearClassOf(g) === cf));
    const brands = [...new Set(pool.map(g => g.brand || '').filter(b => b !== undefined))].sort();
    const opts = [['', 'Alle Marken/Sets'], ...brands.map(b => [b, b || '— (keine Marke)'])];
    fillSelectOptions('adminGearBrandFilter', opts, true);
}

function renderWeaponsAdmin() {
    const el = document.getElementById('adminWeaponTable');
    if (!el) return;
    const filter = (getVal('adminWeaponFilter') || '').toLowerCase();
    const tf = getVal('adminWeaponTypeFilter') || '';
    const rf = getVal('adminWeaponRarityFilter') || '';
    const list = weaponsData.weapons
        .map((w, i) => ({ w, i }))
        .filter(x => (!tf || x.w.type === tf) && (!rf || adminWeaponRarity(x.w) === rf))
        .filter(x => !filter || (x.w.name || '').toLowerCase().includes(filter) || (x.w.type || '').toLowerCase().includes(filter));
    document.getElementById('adminWeaponCount').textContent = weaponsData.weapons.length;
    if (!tf) {
        el.innerHTML = '<p class="py-6 text-center text-gray-500 text-sm">Bitte zuerst eine Waffengattung auswählen.</p>';
        return;
    }
    const rows = list.slice(0, 200).map(x => {
        const w = x.w;
        const rarity = w.is_exotic ? 'exotic' : (w.is_named ? 'named' : (w.rarity || 'standard'));
        const dmg = w.stats && w.stats['Level 40 Damage'] != null ? w.stats['Level 40 Damage'] : '—';
        return `<tr class="border-t border-gray-800">
            <td class="py-2 px-3 text-sm">${esc(w.name)}</td>
            <td class="py-2 px-3 text-sm text-gray-400">${esc(w.type)}</td>
            <td class="py-2 px-3 text-sm">${esc(rarity)}</td>
            <td class="py-2 px-3 text-sm text-gray-400">${esc(dmg)}</td>
            <td class="py-2 px-3">${actionBtns(`openWeaponForm(${x.i})`, `deleteWeaponEntry(${x.i})`, 'Bearbeiten', 'Löschen')}</td>
        </tr>`;
    }).join('');
    el.innerHTML = `<table class="w-full text-left">
        <thead><tr class="text-xs uppercase text-gray-500">
            <th class="py-2 px-3">Name</th><th class="py-2 px-3">Typ</th><th class="py-2 px-3">Rarity</th><th class="py-2 px-3">L40-Schaden</th><th class="py-2 px-3">Aktionen</th>
        </tr></thead><tbody>${rows || '<tr><td colspan="5" class="py-4 text-center text-gray-500">Keine Treffer</td></tr>'}</tbody></table>
        ${list.length > 200 ? `<p class="text-xs text-gray-500 mt-2">Zeige 200 von ${list.length} – bitte Suche benutzen.</p>` : ''}`;
}

function renderGearAdmin() {
    const el = document.getElementById('adminGearTable');
    if (!el) return;
    const filter = (getVal('adminGearFilter') || '').toLowerCase();
    const sf = getVal('adminGearSlotFilter') || '';
    const cf = getVal('adminGearClassFilter') || '';
    const bf = getVal('adminGearBrandFilter') || '';
    const entries = Object.entries(GEAR_DB)
        .map(([name, g], i) => ({ name, g, i }))
        .filter(x => (!sf || x.g.slot === sf) && (!cf || gearClassOf(x.g) === cf) && (!bf || (x.g.brand || '') === bf))
        .filter(x => !filter || x.name.toLowerCase().includes(filter) || (x.g.slot || '').toLowerCase().includes(filter));
    document.getElementById('adminGearCount').textContent = Object.keys(GEAR_DB).length;
    if (!sf) {
        el.innerHTML = '<p class="py-6 text-center text-gray-500 text-sm">Bitte zuerst einen Slot auswählen.</p>';
        return;
    }
    const rows = entries.map(x => `<tr class="border-t border-gray-800">
        <td class="py-2 px-3 text-sm">${esc(x.name)}</td>
        <td class="py-2 px-3 text-sm text-gray-400">${esc(x.g.slot)}</td>
        <td class="py-2 px-3 text-sm">${x.g.cls === 'exotic' ? 'Exotic' : 'Named'}</td>
        <td class="py-2 px-3 text-sm text-gray-500 max-w-xs truncate" title="${esc(x.g.perk)}">${esc(x.g.perk)}</td>
        <td class="py-2 px-3">${actionBtns(`openGearForm(${x.i})`, `deleteGearEntry(${x.i})`, 'Bearbeiten', 'Löschen')}</td>
    </tr>`).join('');
    el.innerHTML = `<table class="w-full text-left">
        <thead><tr class="text-xs uppercase text-gray-500">
            <th class="py-2 px-3">Name</th><th class="py-2 px-3">Slot</th><th class="py-2 px-3">Klasse</th><th class="py-2 px-3">Perk</th><th class="py-2 px-3">Aktionen</th>
        </tr></thead><tbody>${rows || '<tr><td colspan="5" class="py-4 text-center text-gray-500">Keine Treffer</td></tr>'}</tbody></table>`;
}

const ADMIN_MOD_SLOTS = [
    ['optic', 'Optik'], ['muzzle', 'Mündung'], ['underbarrel', 'Unterlauf'], ['magazine', 'Magazin']
];

function renderModsAdmin() {
    const el = document.getElementById('adminModTable');
    if (!el) return;
    const slot = getVal('adminModSlot') || 'optic';
    const mods = MOD_CATALOG[slot] || [];
    document.getElementById('adminModCount').textContent = mods.length;
    const rows = mods.map((m, i) => {
        const b = m.bonus ? `+${m.bonus.val} ${m.bonus.type}` : '—';
        const p = m.penalty ? `${m.penalty.val} ${m.penalty.type}` : '—';
        return `<tr class="border-t border-gray-800">
            <td class="py-2 px-3 text-sm">${esc(m.name)}</td>
            <td class="py-2 px-3 text-sm text-gray-400">${esc((m.slotTypes || []).join(', '))}</td>
            <td class="py-2 px-3 text-sm text-emerald-400">${esc(b)}</td>
            <td class="py-2 px-3 text-sm text-red-400">${esc(p)}</td>
            <td class="py-2 px-3">${actionBtns(`openModForm('${escAttrJs(slot)}', ${i})`, `deleteModEntry('${escAttrJs(slot)}', ${i})`, 'Bearbeiten', 'Löschen')}</td>
        </tr>`;
    }).join('');
    el.innerHTML = `<table class="w-full text-left">
        <thead><tr class="text-xs uppercase text-gray-500">
            <th class="py-2 px-3">Mod</th><th class="py-2 px-3">Slot-Typen</th><th class="py-2 px-3">Bonus</th><th class="py-2 px-3">Malus</th><th class="py-2 px-3">Aktionen</th>
        </tr></thead><tbody>${rows || '<tr><td colspan="5" class="py-4 text-center text-gray-500">Keine Mods</td></tr>'}</tbody></table>`;
}

// ---------- Waffen-Formular ----------
const ADMIN_WEAPON_TYPES = ['AR', 'LMG', 'MP', 'Rifle', 'Shotgun', 'MMR', 'Pistol'];

function openWeaponForm(idx) {
    const w = idx != null ? weaponsData.weapons[idx] : {};
    openAdminModal(idx != null ? 'Waffe bearbeiten: ' + (w.name || '') : 'Neue Waffe anlegen');
    const body = document.getElementById('adminModalBody');
    body.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${modalInput('afName', 'Name', w.name, { required: true, placeholder: 'z.B. St. Elmo\'s Engine' })}
            ${modalInput('afType', 'Typ', w.type || 'AR', { type: 'select', options: ADMIN_WEAPON_TYPES })}
            ${modalInput('afRarity', 'Seltenheit', w.rarity || 'standard', { type: 'select', options: [['standard','Standard'], ['named','Named'], ['exotic','Exotic']] })}
        </div>
        <p class="text-xs font-bold uppercase text-gray-400">Werte (Level 40)</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            ${modalInput('afDmg', 'Basis-Schaden', w.stats && w.stats['Level 40 Damage'], { type: 'number' })}
            ${modalInput('afRpm', 'RPM', w.stats && w.stats['RPM'], { type: 'number' })}
            ${modalInput('afMag', 'Magazingröße', w.stats && w.stats['Base Mag Size'], { type: 'number' })}
            ${modalInput('afReload', 'Leer-Nachladen (s)', w.stats && w.stats['Empty Reload (secs)'], { type: 'number', step: '0.01' })}
        </div>
        ${modalInput('afNote', 'Notiz', w.note)}
        <div class="flex justify-end gap-2 pt-2 border-t border-gray-800">
            <button onclick="closeAdminModal()" class="btn-secondary px-4 py-2 rounded-lg text-sm font-semibold">Abbrechen</button>
            <button onclick="saveWeaponForm(${idx})" class="btn-primary px-4 py-2 rounded-lg text-sm font-bold">Speichern</button>
        </div>`;
}

function saveWeaponForm(idx) {
    const name = getVal('afName').trim();
    if (!name) { adminToast('Bitte einen Namen angeben.', 'error'); return; }
    const entry = {
        name,
        type: getVal('afType'),
        rarity: getVal('afRarity'),
        is_exotic: getVal('afRarity') === 'exotic',
        is_named: getVal('afRarity') === 'named',
        replica: false,
        source: 'user',
        table_name: name,
        note: getVal('afNote') || '',
        stats: {}
    };
    if (idx != null) {
        const old = weaponsData.weapons[idx];
        Object.assign(entry.stats, old.stats || {});
        if (old.exotic) entry.exotic = old.exotic;
        if (old.named) entry.named = old.named;
    }
    const dmg = getNum('afDmg'), rpm = getNum('afRpm'), mag = getNum('afMag'), rel = getNum('afReload');
    if (dmg != null) entry.stats['Level 40 Damage'] = dmg;
    if (rpm != null) entry.stats['RPM'] = rpm;
    if (mag != null) entry.stats['Base Mag Size'] = mag;
    if (rel != null) entry.stats['Empty Reload (secs)'] = rel;

    if (idx != null) weaponsData.weapons[idx] = entry;
    else weaponsData.weapons.push(entry);
    closeAdminModal();
    refreshAfterDbChange(idx != null ? 'Waffe aktualisiert.' : 'Waffe hinzugefügt.');
}

function deleteWeaponEntry(idx) {
    const w = weaponsData.weapons[idx];
    if (!w || !confirm(`Waffe "${w.name}" wirklich löschen?`)) return;
    weaponsData.weapons.splice(idx, 1);
    refreshAfterDbChange('Waffe gelöscht.');
}

// ---------- Gear-Formular ----------
const ADMIN_GEAR_SLOTS = ['Maske', 'Weste', 'Rucksack', 'Handschuhe', 'Holster', 'Knieschoner'];
const ADMIN_GEAR_CORES = [['wd', 'Waffen-Schaden'], ['armour', 'Rüstung'], ['skill', 'Fertigkeit'], ['any', 'Beliebig']];

const ADMIN_FIXED_ATTRS = [
    ['', '— keins —'], ['chc', 'Kritische Trefferchance'], ['chd', 'Kritischer Trefferschaden'],
    ['hsd', 'Kopfschussschaden'], ['wh', 'Waffenhandhabung'], ['rof', 'Feuerrate'], ['accuracy', 'Präzision'],
    ['range', 'Reichweite'], ['ammocap', 'Munitionskapazität'], ['status', 'Statuseffekte'],
    ['hazard', 'Gefahrenschutz'], ['explres', 'Explosionsresistenz'], ['incomrepair', 'Erhaltene Reparaturen'],
    ['armorregen', 'Rüstungs-Regeneration'], ['health', 'Leben'], ['skilldmg', 'Skill-Schaden'],
    ['skillhaste', 'Skill-Haste'], ['skillhealth', 'Skill-Health'], ['repair', 'Reparatur-Skills'],
    ['pulsehaste', 'Puls-Tempo'], ['shieldhealth', 'Schild-HP'], ['aok', 'Rüstung bei Kill'],
    ['meleedmg', 'Nahkampfschaden'], ['pistoldmg', 'Pistolen-Schaden'], ['reducedthreat', 'Reduzierte Bedrohung']
];
const ADMIN_FIXED_ROWS = 2;
function fixedAttrRow(idx, pair) {
    const [attr, val] = pair || ['', ''];
    return `<div class="grid grid-cols-2 gap-2">
        ${modalInput('agFixedAttr' + idx, 'Attribut ' + (idx + 1), attr, { type: 'select', options: ADMIN_FIXED_ATTRS })}
        ${modalInput('agFixedVal' + idx, 'Wert', val === '' ? '' : val, { type: 'number', step: 'any', placeholder: 'z.B. 6' })}
    </div>`;
}

function openGearForm(idx) {
    const names = Object.keys(GEAR_DB);
    const name = idx != null ? names[idx] : '';
    const g = idx != null ? GEAR_DB[name] : {};
    openAdminModal(idx != null ? 'Gear bearbeiten: ' + name : 'Neues Gear anlegen');
    const body = document.getElementById('adminModalBody');
    body.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${modalInput('agName', 'Name', name, { required: true, placeholder: 'z.B. Coyote\'s Mask' })}
            ${modalInput('agSlot', 'Slot', g.slot || 'Maske', { type: 'select', options: ADMIN_GEAR_SLOTS })}
            ${modalInput('agBrand', 'Brand (bei Named)', g.brand || '')}
            ${modalInput('agCls', 'Klasse', g.cls || 'named', { type: 'select', options: [['named', 'Named'], ['exotic', 'Exotic']] })}
            ${modalInput('agCore', 'Kern-Attribut', g.core || 'wd', { type: 'select', options: ADMIN_GEAR_CORES })}
            ${modalInput('agProto', 'Prototyp (x1,5 God-Roll)', !!g.proto, { type: 'select', options: [['false', 'Nein'], ['true', 'Ja']] })}
            ${modalInput('agFree', 'Freie Minor-Attribute', g.free != null ? g.free : 1, { type: 'number', min: 0, max: 2 })}
            ${modalInput('agMods', 'Mod-Slots', g.mods != null ? g.mods : 0, { type: 'number', min: 0, max: 2 })}
        </div>
        <p class="text-xs font-semibold uppercase text-gray-400">Fixe Attribute (max. 2, leer = keins)</p>
        <div class="space-y-2">${Array.from({ length: ADMIN_FIXED_ROWS }, (_, i) => fixedAttrRow(i, (g.fixed || [])[i])).join('')}</div>
        ${modalInput('agPerk', 'Perk / Talent (Beschreibung)', g.perk, { type: 'textarea', rows: 3 })}
        <div class="flex justify-end gap-2 pt-2 border-t border-gray-800">
            <button onclick="closeAdminModal()" class="btn-secondary px-4 py-2 rounded-lg text-sm font-semibold">Abbrechen</button>
            <button onclick="saveGearForm(${idx})" class="btn-primary px-4 py-2 rounded-lg text-sm font-bold">Speichern</button>
        </div>`;
}

function saveGearForm(idx) {
    const name = getVal('agName').trim();
    if (!name) { adminToast('Bitte einen Namen angeben.', 'error'); return; }
    const fixed = [];
    for (let i = 0; i < ADMIN_FIXED_ROWS; i++) {
        const attr = getVal('agFixedAttr' + i) || '';
        const valRaw = getVal('agFixedVal' + i);
        if (!attr || (valRaw || '').trim() === '') continue;
        fixed.push([attr, parseFloat(valRaw) || 0]);
    }
    const entry = {
        slot: getVal('agSlot'),
        brand: getVal('agBrand') || '',
        cls: getVal('agCls'),
        proto: getVal('agProto') === 'true',
        core: getVal('agCore'),
        fixed,
        free: getNum('agFree') || 0,
        mods: getNum('agMods') || 0,
        perk: getVal('agPerk') || ''
    };
    const names = Object.keys(GEAR_DB);
    const oldKey = idx != null ? names[idx] : null;
    if (oldKey && oldKey !== name) {
        // Umbenennung: Reihenfolge erhalten
        const newObj = {};
        for (const k of names) newObj[k === oldKey ? name : k] = (k === oldKey) ? entry : GEAR_DB[k];
        GEAR_DB = newObj;
    } else if (oldKey) {
        GEAR_DB[oldKey] = entry;
    } else {
        GEAR_DB[name] = entry;
    }
    closeAdminModal();
    refreshAfterDbChange(idx != null ? 'Gear aktualisiert.' : 'Gear hinzugefügt.');
}

function deleteGearEntry(idx) {
    const names = Object.keys(GEAR_DB);
    const name = names[idx];
    if (!name || !confirm(`Gear "${name}" wirklich löschen?`)) return;
    delete GEAR_DB[name];
    refreshAfterDbChange('Gear gelöscht.');
}

// ---------- Brand-Sets & Gear-Sets (gruen) ----------
const ADMIN_BRAND_GROUPS = { dps: 'DPS', skill: 'Skill', armour: 'Defense' };

// Zusammenfassung der Set-Boni fuer die Admin-Tabelle (1p/2p/3p, PvE)
const BRAND_BONUS_ATTR_LABELS = { wd: 'WD', chc: 'CHC', chd: 'CHD', hsd: 'HSD', dta: 'DTA', dth: 'DTH', rof: 'RoF', wh: 'WH',
    magSize: 'Magazingr\u00f6\u00dfe', stability: 'Stabilit\u00e4t', accuracy: 'Pr\u00e4zision', reloadSpeed: 'Nachladetempo',
    optRange: 'opt. Reichweite', ammoCap: 'Munitionskapazit\u00e4t', threat: 'Bedrohung', hazard: 'Gefahrenschutz',
    explRes: 'Explosionsresistenz', pulseRes: 'Pulse-Resistenz', pfe: 'Schutz vor Eliten', armorOnKill: 'R\u00fcstung bei Kill',
    totalArmor: 'Gesamtr\u00fcstung', armorRegen: 'R\u00fcstungs-Reg.', explosiveDmg: 'Explosionsschaden',
    skillHaste: 'Skill-Haste', skillDmg: 'Skill-Schaden', skillHealth: 'Skill-Health', skillDuration: 'Skill-Dauer',
    skillEff: 'Skill-Effizienz', statusEffects: 'Statuseffekte', repairSkills: 'Reparatur-Skills', skillTier: 'Fertigkeitsstufe' };
function brandBonusesSummary(b) {
    const bonuses = b.bonuses_pve;
    if (!bonuses) return b.wd_bonus || '';
    const parts = [];
    ['1', '2', '3'].forEach(tier => {
        const x = bonuses[tier];
        if (!x) return;
        const seg = [];
        Object.keys(x).forEach(k => {
            if (k === 'text') seg.push(x[k]);
            else if (k === 'wd_by_weapon') Object.entries(x[k]).forEach(([wt, v]) => seg.push(`+${v}% ${wt}`));
            else if (k === 'skillTier') seg.push(`+${x[k]} ${BRAND_BONUS_ATTR_LABELS[k]}`);
            else if (BRAND_BONUS_ATTR_LABELS[k]) seg.push(`+${x[k]}% ${BRAND_BONUS_ATTR_LABELS[k]}`);
        });
        if (seg.length) parts.push(`${tier}p: ${seg.join(', ')}`);
    });
    return parts.join(' \u00b7 ');
}
function renderBrandsAdmin() {
    const el = document.getElementById('adminBrandTable');
    if (!el) return;
    const filter = (getVal('adminBrandFilter') || '').toLowerCase();
    const gf = getVal('adminBrandGroupFilter') || '';
    const entries = Object.entries(BRAND_SET_INFO)
        .filter(([k, b]) => (!gf || b.group === gf) && (!filter || k.toLowerCase().includes(filter) || (b.name || '').toLowerCase().includes(filter)));
    const groupSel = document.getElementById('adminBrandGroupFilter');
    if (groupSel && groupSel.options.length <= 1) {
        const groups = [...new Set(Object.values(BRAND_SET_INFO).map(b => b.group).filter(Boolean))];
        fillSelectOptions('adminBrandGroupFilter', [['', 'Gruppe wählen…'], ...groups.map(g => [g, ADMIN_BRAND_GROUPS[g] || g])], true);
    }
    document.getElementById('adminBrandCount').textContent = Object.keys(BRAND_SET_INFO).length;
    if (!gf) {
        el.innerHTML = '<p class="py-6 text-center text-gray-500 text-sm">Bitte zuerst eine Gruppe auswählen.</p>';
        return;
    }
    const rows = entries.map(([key, b]) => `<tr class="border-t border-gray-800">
        <td class="py-2 px-3 text-sm font-semibold">${esc(key)}</td>
        <td class="py-2 px-3 text-sm text-gray-400">${esc(b.name)}</td>
        <td class="py-2 px-3 text-sm">${esc(ADMIN_BRAND_GROUPS[b.group] || b.group || '—')}</td>
        <td class="py-2 px-3 text-sm text-gray-400">${esc(b.weapon_hint || '—')}</td>
        <td class="py-2 px-3 text-sm text-gray-500 max-w-xs truncate" title="${esc(brandBonusesSummary(b) || '')}">${esc(brandBonusesSummary(b) || '—')}</td>
        <td class="py-2 px-3">${actionBtns(`openBrandForm('${escAttrJs(key)}')`, `deleteBrandEntry('${escAttrJs(key)}')`, 'Bearbeiten', 'Löschen')}</td>
    </tr>`).join('');
    el.innerHTML = `<table class="w-full text-left">
        <thead><tr class="text-xs uppercase text-gray-500">
            <th class="py-2 px-3">Schlüssel</th><th class="py-2 px-3">Name</th><th class="py-2 px-3">Gruppe</th><th class="py-2 px-3">Waffen-Hint</th><th class="py-2 px-3">Set-Boni</th><th class="py-2 px-3">Aktionen</th>
        </tr></thead><tbody>${rows || '<tr><td colspan="6" class="py-4 text-center text-gray-500">Keine Treffer</td></tr>'}</tbody></table>`;
}

// Typisierte Bonus-Attribute (Score-Keys) + waffentypbezogener Schaden
// fuer den Boni-Editor je Stufe (1p/2p/3p). Reihenfolge = Dropdown-Reihenfolge.
const BRAND_BONUS_ATTRS = [
    ['', '\u2014 kein Bonus (nur Text) \u2014'],
    ['wd', 'Waffenschaden (WD)'], ['chc', 'Kritische Trefferchance (CHC)'], ['chd', 'Kritischer Trefferschaden (CHD)'],
    ['hsd', 'Kopfschussschaden (HSD)'], ['dta', 'Schaden gegen R\u00fcstung (DTA)'], ['dth', 'Schaden gegen Leben (DTH)'],
    ['rof', 'Feuerrate (RoF)'], ['wh', 'Waffenhandhabung (WH)'],
    ['wdw:AR', 'Waffenschaden: AR'], ['wdw:LMG', 'Waffenschaden: LMG'], ['wdw:MP', 'Waffenschaden: MP'],
    ['wdw:Rifle', 'Waffenschaden: Gewehr (Rifle)'], ['wdw:Shotgun', 'Waffenschaden: Schrotflinte'], ['wdw:MMR', 'Waffenschaden: MMR'],
    ['wdw:Pistol', 'Waffenschaden: Pistole'],
    ['magSize', 'Magazingr\u00f6\u00dfe'], ['stability', 'Stabilit\u00e4t'], ['accuracy', 'Pr\u00e4zision'], ['reloadSpeed', 'Nachladetempo'],
    ['optRange', 'Optimale Reichweite'], ['ammoCap', 'Munitionskapazit\u00e4t'], ['threat', 'Erh\u00f6hte Bedrohung'],
    ['hazard', 'Gefahrenschutz'], ['explRes', 'Explosionsresistenz'], ['pulseRes', 'Pulse-Resistenz'],
    ['pfe', 'Schutz vor Eliten'], ['armorOnKill', 'R\u00fcstung bei Kill'], ['totalArmor', 'Gesamtr\u00fcstung'],
    ['armorRegen', 'R\u00fcstungs-Regeneration'], ['explosiveDmg', 'Explosionsschaden'],
    ['skillHaste', 'Skill-Haste'], ['skillDmg', 'Skill-Schaden'], ['skillHealth', 'Skill-Health'],
    ['skillDuration', 'Skill-Dauer'], ['skillEff', 'Skill-Effizienz'], ['statusEffects', 'Statuseffekte'],
    ['repairSkills', 'Reparatur-Fertigkeiten'], ['skillTier', 'Fertigkeitsstufe(n)']
];
// Liest den Bonus einer Stufe fuer das Formular: [attrSelectValue, numericVal, textVal]
function brandTierFormState(bonuses, tier) {
    const b = (bonuses || {})[tier] || {};
    const typedKeys = ['wd', 'chc', 'chd', 'hsd', 'dta', 'dth', 'rof', 'wh',
        'magSize', 'stability', 'accuracy', 'reloadSpeed', 'optRange', 'ammoCap', 'threat',
        'hazard', 'explRes', 'pulseRes', 'pfe', 'armorOnKill', 'totalArmor', 'armorRegen', 'explosiveDmg',
        'skillHaste', 'skillDmg', 'skillHealth', 'skillDuration', 'skillEff', 'statusEffects', 'repairSkills', 'skillTier'];
    let attr = '';
    for (const k of typedKeys) {
        if (b[k] !== undefined && b[k] !== null) { attr = k; break; }
    }
    let numVal = 0;
    if (attr) numVal = b[attr] || 0;
    else if (b.wd_by_weapon) {
        const wt = Object.keys(b.wd_by_weapon)[0];
        attr = 'wdw:' + wt;
        numVal = b.wd_by_weapon[wt] || 0;
    }
    return [attr, numVal, b.text || ''];
}
function brandBonusRow(tier, label, state) {
    const [attr, numVal, text] = state;
    return `<div class="p-3 rounded-lg bg-zinc-900/80 border border-gray-800 space-y-2">
        <p class="text-xs font-bold uppercase text-div-accent">${label}</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            ${modalInput('abBonusAttr' + tier, 'Attribut', attr, { type: 'select', options: BRAND_BONUS_ATTRS })}
            ${modalInput('abBonusVal' + tier, 'Wert (%)', numVal || '', { type: 'number', step: 'any', placeholder: 'z.B. 12' })}
        </div>
        ${modalInput('abBonusText' + tier, 'Text-Bonus (Skill/Defense/Utility, ohne Score)', text, { placeholder: 'z.B. 30% Gefahrenschutz' })}
    </div>`;
}
function openBrandForm(key) {
    const isNew = key == null || key === 'null';
    const b = isNew ? {} : (BRAND_SET_INFO[key] || {});
    openAdminModal(isNew ? 'Neues Brand-Set anlegen' : 'Brand-Set bearbeiten: ' + key);
    const bonuses = b.bonuses_pve || {};
    document.getElementById('adminModalBody').innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${modalInput('abKey', 'Schl\u00fcssel (wie im Tool verwendet)', isNew ? '' : key, { required: true, placeholder: 'z.B. fenris' })}
            ${modalInput('abName', 'Vollst\u00e4ndiger Name', b.name || '', { required: true, placeholder: 'z.B. Fenris Group AB' })}
            ${modalInput('abGroup', 'Gruppe', b.group || 'dps', { type: 'select', options: [['dps', 'DPS'], ['skill', 'Skill'], ['armour', 'Defense']] })}
            ${modalInput('abWeaponHint', 'Waffen-Hint (optional)', b.weapon_hint || '', { placeholder: 'z.B. AR' })}
        </div>
        ${modalInput('abFragments', 'Match-Fragmente (Komma-getrennt, optional)', (b.fragments || []).join(', '), { placeholder: 'z.B. fenris, ferocious calm' })}
        <p class="text-xs font-semibold uppercase text-gray-400 pt-1">Set-Boni (PvE) — pro Stufe ein numerischer Bonus und/oder Text</p>
        ${brandBonusRow(1, '1 St\u00fcck (1p)', brandTierFormState(bonuses, '1'))}
        ${brandBonusRow(2, '2 St\u00fccke (2p)', brandTierFormState(bonuses, '2'))}
        ${brandBonusRow(3, '3 St\u00fccke (3p)', brandTierFormState(bonuses, '3'))}
        <div class="flex justify-end gap-2 pt-2 border-t border-gray-800">
            <button onclick="closeAdminModal()" class="btn-secondary px-4 py-2 rounded-lg text-sm font-semibold">Abbrechen</button>
            <button onclick="saveBrandForm(${isNew ? 'null' : `'${escAttrJs(key)}'`})" class="btn-primary px-4 py-2 rounded-lg text-sm font-bold">Speichern</button>
        </div>`;
}


function saveBrandForm(key) {
    const newKey = getVal('abKey').trim();
    const name = getVal('abName').trim();
    if (!newKey || !name) { adminToast('Bitte Schl\u00fcssel und Namen angeben.', 'error'); return; }
    const entry = { name, group: getVal('abGroup') };
    const wh = getVal('abWeaponHint').trim(); if (wh) entry.weapon_hint = wh;
    const fr = getVal('abFragments').split(',').map(x => x.trim()).filter(Boolean);
    if (fr.length) entry.fragments = fr;
    // Set-Boni je Stufe aus dem Formular lesen
    const bonuses = {};
    [1, 2, 3].forEach(tier => {
        const attrSel = getVal('abBonusAttr' + tier) || '';
        const numVal = parseFloat(getVal('abBonusVal' + tier)) || 0;
        const text = (getVal('abBonusText' + tier) || '').trim();
        const b = {};
        if (attrSel && (numVal > 0 || (attrSel === 'skillTier' && numVal > 0))) {
            if (attrSel.startsWith('wdw:')) b.wd_by_weapon = { [attrSel.slice(4)]: numVal };
            else b[attrSel] = attrSel === 'skillTier' ? Math.round(numVal) : numVal;
        }
        if (text) b.text = text;
        if (Object.keys(b).length > 0) bonuses[tier] = b;
    });
    if (Object.keys(bonuses).length > 0) entry.bonuses_pve = bonuses;
    const oldKey = (key && key !== 'null') ? key : null;
    if (oldKey && oldKey !== newKey) {
        const newObj = {};
        for (const k of Object.keys(BRAND_SET_INFO)) newObj[k === oldKey ? newKey : k] = (k === oldKey) ? entry : BRAND_SET_INFO[k];
        BRAND_SET_INFO = newObj;
    } else {
        BRAND_SET_INFO[newKey] = entry;
    }
    closeAdminModal();
    refreshAfterDbChange(oldKey ? 'Brand-Set aktualisiert.' : 'Brand-Set hinzugef\u00fcgt.');
}


function deleteBrandEntry(key) {
    if (!BRAND_SET_INFO[key] || !confirm(`Brand-Set "${key}" wirklich löschen?`)) return;
    delete BRAND_SET_INFO[key];
    refreshAfterDbChange('Brand-Set gelöscht.');
}

const ADMIN_GREEN_GROUPS = { dps: 'DPS-Sets', armour: 'Rüstungs-Sets', skill: 'Fertigkeits-Sets' };
// Typisierte Bonus-Attribute fuer Gear-Sets (inkl. Gear-Set-only Keys)
const GREEN_BONUS_ATTRS = BRAND_BONUS_ATTRS.filter(x => !x[0].startsWith('wdw:')).concat([
    ['healthOnKill', 'Leben bei Kill'], ['health', 'Leben'], ['shieldHp', 'Schild-HP'],
    ['burnDuration', 'Brand-Dauer'], ['burnDmg', 'Brand-Schaden'], ['disruptRes', 'Disrupt-Resistenz'],
    ['signatureDmg', 'Signatur-Schaden']
]);
const GREEN_BONUS_WEAPONS = [['', '— alle Waffen —'], ['AR', 'AR'], ['LMG', 'LMG'], ['MP', 'MP'],
    ['Rifle', 'Gewehr (Rifle)'], ['Shotgun', 'Schrotflinte'], ['MMR', 'MMR'], ['Pistol', 'Pistole']];
const GREEN_BONUS_ROWS_PER_TIER = 3;
// Liest die Bonus-Liste einer Stufe fuer das Formular: Array von [attr, numVal, weapon]
function greenTierFormState(bonuses, tier) {
    const list = (bonuses || {})[tier] || [];
    const rows = [];
    for (let i = 0; i < GREEN_BONUS_ROWS_PER_TIER; i++) {
        const b = list[i] || {};
        rows.push([b.attr || '', b.val || '', b.weapon || '']);
    }
    return rows;
}
function greenBonusRow(tier, idx, state) {
    const [attr, numVal, weapon] = state;
    return `<div class="grid grid-cols-1 md:grid-cols-3 gap-2 p-2 rounded-lg bg-zinc-900/80 border border-gray-800">
        ${modalInput('agBonusAttr' + tier + '_' + idx, 'Attribut', attr, { type: 'select', options: GREEN_BONUS_ATTRS })}
        ${modalInput('agBonusVal' + tier + '_' + idx, 'Wert (%)', numVal === '' ? '' : numVal, { type: 'number', step: 'any', placeholder: 'z.B. 30' })}
        ${modalInput('agBonusWeapon' + tier + '_' + idx, 'Waffe (optional)', weapon, { type: 'select', options: GREEN_BONUS_WEAPONS })}
    </div>`;
}
function greenBonusSection(tier, label, bonuses) {
    const rows = greenTierFormState(bonuses, tier);
    return `<div class="space-y-2">
        <p class="text-xs font-bold uppercase text-div-accent">${label}</p>
        ${rows.map((r, i) => greenBonusRow(tier, i, r)).join('')}
    </div>`;
}
// Zusammenfassung der typisierten Boni fuer die Admin-Tabelle
function greenBonusesSummary(g) {
    const bonuses = g.bonuses;
    if (!bonuses) return '';
    const parts = [];
    ['2', '3'].forEach(tier => {
        const list = bonuses[tier];
        if (!list || !list.length) return;
        const seg = list.map(b => `+${b.val}${b.weapon ? ' (' + b.weapon + ')' : ''}% ${BRAND_BONUS_ATTR_LABELS[b.attr] || (GREEN_BONUS_ATTRS.find(x => x[0] === b.attr) || [])[1] || b.attr}`);
        parts.push(`${tier}p: ${seg.join(', ')}`);
    });
    return parts.join(' · ');
}

function populateGreenGroupFilter() {
    const groups = [...new Set(Object.values(GREEN_SET_INFO).map(g => g.group).filter(Boolean))].sort();
    fillSelectOptions('adminGreenGroupFilter', [['', 'Gruppe wählen…'], ...groups.map(g => [g, ADMIN_GREEN_GROUPS[g] || g])], true);
}

function renderGreensAdmin() {
    const el = document.getElementById('adminGreenTable');
    if (!el) return;
    const filter = (getVal('adminGreenFilter') || '').toLowerCase();
    const gf = getVal('adminGreenGroupFilter') || '';
    const entries = Object.entries(GREEN_SET_INFO)
        .filter(([k, g]) => (!gf || g.group === gf) && (!filter || k.toLowerCase().includes(filter) || (g.name || '').toLowerCase().includes(filter)));
    populateGreenGroupFilter();
    document.getElementById('adminGreenCount').textContent = Object.keys(GREEN_SET_INFO).length;
    if (!gf) {
        el.innerHTML = '<p class="py-6 text-center text-gray-500 text-sm">Bitte zuerst eine Gruppe auswählen.</p>';
        return;
    }
    const cards = entries.map(([key, g]) => {
        const summary = greenBonusesSummary(g);
        return `<div class="border border-gray-800 rounded-lg p-3 space-y-2 bg-zinc-900/40">
            <div class="flex justify-between items-start gap-2">
                <div class="min-w-0">
                    <p class="text-sm font-semibold break-words">${esc(key)} <span class="text-gray-400 font-normal">· ${esc(g.name)}</span></p>
                    <p class="text-xs text-gray-500">${esc(ADMIN_GREEN_GROUPS[g.group] || g.group || '')}${g.modeled ? ' · ' + esc(g.modeled) : ''}</p>
                </div>
                <div class="shrink-0">${actionBtns(`openGreenForm('${escAttrJs(key)}')`, `deleteGreenEntry('${escAttrJs(key)}')`, 'Bearbeiten', 'Löschen')}</div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <p class="text-gray-500"><span class="text-gray-400 font-semibold">2p:</span> ${esc(g.n2 || '—')}</p>
                <p class="text-gray-500"><span class="text-gray-400 font-semibold">3p:</span> ${esc(g.n3 || '—')}</p>
                <p class="text-gray-500 md:col-span-2"><span class="text-gray-400 font-semibold">4p:</span> ${esc(g.n4 || '—')}</p>
                ${summary ? `<p class="text-gray-500 md:col-span-2"><span class="text-div-accent font-semibold">Typisiert:</span> ${esc(summary)}</p>` : ''}
            </div>
        </div>`;
    }).join('');
    el.innerHTML = `<div class="space-y-2">${cards || '<p class="py-4 text-center text-gray-500">Keine Treffer</p>'}</div>`;
}

function openGreenForm(key) {
    const isNew = key == null || key === 'null';
    const g = isNew ? {} : (GREEN_SET_INFO[key] || {});
    openAdminModal(isNew ? 'Neues Gear-Set anlegen' : 'Gear-Set bearbeiten: ' + key);
    document.getElementById('adminModalBody').innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${modalInput('ag2Key', 'Schlüssel (wie im Tool verwendet)', isNew ? '' : key, { required: true, placeholder: 'z.B. striker' })}
            ${modalInput('ag2Name', 'Vollständiger Name', g.name || '', { required: true, placeholder: "z.B. Striker's Battlegear" })}
            ${modalInput('ag2Group', 'Gruppe', g.group || 'dps', { type: 'select', options: [['dps', 'DPS-Sets'], ['armour', 'Rüstungs-Sets'], ['skill', 'Fertigkeits-Sets']] })}
        </div>
        ${modalInput('ag2N2', '2p-Bonus', g.n2 || '')}
        ${modalInput('ag2N3', '3p-Bonus', g.n3 || '')}
        ${modalInput('ag2N4', '4p-Bonus (Chest/Backpack-Talent)', g.n4 || '', { type: 'textarea', rows: 2 })}
        ${modalInput('ag2Modeled', 'Modellierung-Hinweis (optional)', g.modeled || '', { placeholder: 'z.B. 3p numerisch (Feuerrate)' })}
        <p class="text-xs font-semibold uppercase text-gray-400 pt-1">Typisierte Set-Boni (2p/3p) — je Stufe bis zu 3 Boni, Waffenbindung optional</p>
        ${greenBonusSection('2', '2 Stücke (2p)', g.bonuses || {})}
        ${greenBonusSection('3', '3 Stücke (3p)', g.bonuses || {})}
        <div class="flex justify-end gap-2 pt-2 border-t border-gray-800">
            <button onclick="closeAdminModal()" class="btn-secondary px-4 py-2 rounded-lg text-sm font-semibold">Abbrechen</button>
            <button onclick="saveGreenForm(${isNew ? 'null' : `'${escAttrJs(key)}'`})" class="btn-primary px-4 py-2 rounded-lg text-sm font-bold">Speichern</button>
        </div>`;
}

function saveGreenForm(key) {
    const newKey = getVal('ag2Key').trim();
    const name = getVal('ag2Name').trim();
    if (!newKey || !name) { adminToast('Bitte Schlüssel und Namen angeben.', 'error'); return; }
    const entry = { name, group: getVal('ag2Group') || 'dps', n2: getVal('ag2N2') || '', n3: getVal('ag2N3') || '', n4: getVal('ag2N4') || '' };
    const md = getVal('ag2Modeled').trim(); if (md) entry.modeled = md;
    const bonuses = {};
    [2, 3].forEach(tier => {
        const list = [];
        for (let i = 0; i < GREEN_BONUS_ROWS_PER_TIER; i++) {
            const attr = getVal('agBonusAttr' + tier + '_' + i) || '';
            const valRaw = getVal('agBonusVal' + tier + '_' + i);
            const weapon = getVal('agBonusWeapon' + tier + '_' + i) || '';
            if (!attr || (valRaw || '').trim() === '') continue;
            const numVal = attr === 'skillTier' ? Math.round(parseFloat(valRaw) || 0) : (parseFloat(valRaw) || 0);
            if (!numVal) continue;
            const b = { attr, val: numVal };
            if (weapon) b.weapon = weapon;
            list.push(b);
        }
        if (list.length) bonuses[tier] = list;
    });
    if (Object.keys(bonuses).length > 0) entry.bonuses = bonuses;
    const oldKey = (key && key !== 'null') ? key : null;
    if (oldKey && oldKey !== newKey) {
        const newObj = {};
        for (const k of Object.keys(GREEN_SET_INFO)) newObj[k === oldKey ? newKey : k] = (k === oldKey) ? entry : GREEN_SET_INFO[k];
        GREEN_SET_INFO = newObj;
    } else {
        GREEN_SET_INFO[newKey] = entry;
    }
    closeAdminModal();
    refreshAfterDbChange(oldKey ? 'Gear-Set aktualisiert.' : 'Gear-Set hinzugefügt.');
}

function deleteGreenEntry(key) {
    if (!GREEN_SET_INFO[key] || !confirm(`Gear-Set "${key}" wirklich löschen?`)) return;
    delete GREEN_SET_INFO[key];
    refreshAfterDbChange('Gear-Set gelöscht.');
}

// ---------- Mod-Formular ----------
const ADMIN_MOD_ATTRS = ['chc', 'chd', 'hsd', 'wd', 'rof', 'reloadSpeed', 'handling', 'accuracy', 'stability', 'range', 'swapSpeed', 'capacity'];

function openModForm(slot, idx) {
    const mods = MOD_CATALOG[slot] || [];
    const m = idx != null ? mods[idx] : {};
    openAdminModal(idx != null ? 'Mod bearbeiten: ' + (m.name || '') : 'Neuen Mod anlegen (' + slot + ')');
    const body = document.getElementById('adminModalBody');
    body.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${modalInput('amName', 'Name', m.name, { required: true, placeholder: 'z.B. Streamlined Iron Sights' })}
            ${modalInput('amSlotTypes', 'Slot-Typen (Komma-getrennt)', (m.slotTypes || []).join(', '), { placeholder: 'z.B. Iron Sights Slot' })}
        </div>
        <p class="text-xs font-bold uppercase text-gray-400">Bonus</p>
        <div class="grid grid-cols-2 gap-3">
            ${modalInput('amBonusType', 'Attribut', m.bonus && m.bonus.type, { type: 'select', options: [['', '— keiner —']].concat(ADMIN_MOD_ATTRS.map(a => [a, a])) })}
            ${modalInput('amBonusVal', 'Wert', m.bonus && m.bonus.val, { type: 'number', step: '0.1' })}
        </div>
        <p class="text-xs font-bold uppercase text-gray-400">Malus (optional)</p>
        <div class="grid grid-cols-2 gap-3">
            ${modalInput('amPenaltyType', 'Attribut', m.penalty && m.penalty.type, { type: 'select', options: [['', '— keiner —']].concat(ADMIN_MOD_ATTRS.map(a => [a, a])) })}
            ${modalInput('amPenaltyVal', 'Wert', m.penalty && m.penalty.val, { type: 'number', step: '0.1' })}
        </div>
        <div class="flex justify-end gap-2 pt-2 border-t border-gray-800">
            <button onclick="closeAdminModal()" class="btn-secondary px-4 py-2 rounded-lg text-sm font-semibold">Abbrechen</button>
            <button onclick="saveModForm('${slot}', ${idx})" class="btn-primary px-4 py-2 rounded-lg text-sm font-bold">Speichern</button>
        </div>`;
}

function saveModForm(slot, idx) {
    const name = getVal('amName').trim();
    if (!name) { adminToast('Bitte einen Namen angeben.', 'error'); return; }
    const bType = getVal('amBonusType'), bVal = getNum('amBonusVal');
    const pType = getVal('amPenaltyType'), pVal = getNum('amPenaltyVal');
    const entry = {
        name,
        slotTypes: getVal('amSlotTypes').split(',').map(s => s.trim()).filter(Boolean),
        bonus: bType ? { type: bType, val: bVal || 0 } : null,
        penalty: pType ? { type: pType, val: pVal || 0 } : null
    };
    if (!MOD_CATALOG[slot]) MOD_CATALOG[slot] = [];
    if (idx != null) MOD_CATALOG[slot][idx] = entry;
    else MOD_CATALOG[slot].push(entry);
    closeAdminModal();
    refreshAfterDbChange(idx != null ? 'Mod aktualisiert.' : 'Mod hinzugefügt.');
}

function deleteModEntry(slot, idx) {
    const m = (MOD_CATALOG[slot] || [])[idx];
    if (!m || !confirm(`Mod "${m.name}" wirklich löschen?`)) return;
    MOD_CATALOG[slot].splice(idx, 1);
    refreshAfterDbChange('Mod gelöscht.');
}

// ---------- Export / Import / Reset ----------
function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportDb(which) {
    if (which === 'weapons') downloadJson('weapons.json', { weapons: weaponsData.weapons, _meta: { version: 'user-export', source: 'Build-Optimizer Verwaltung' } });
    else if (which === 'gear') downloadJson('gear.json', { version: 'gear_v1-user', source: 'Build-Optimizer Verwaltung', named_item_configs: NAMED_ITEM_CONFIGS, gear_db: GEAR_DB, green_set_info: GREEN_SET_INFO, brand_set_info: BRAND_SET_INFO });
    else if (which === 'mods') downloadJson('mod.json', { version: 'mods_v1-user', source: 'Build-Optimizer Verwaltung', slots: MOD_CATALOG });
    adminToast('Export gestartet.');
}

function importDb(event, which) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if (which === 'weapons') {
                const list = Array.isArray(parsed) ? parsed : parsed.weapons;
                if (!Array.isArray(list) || !list.length) throw new Error('Kein "weapons"-Array gefunden.');
                weaponsData.weapons = list;
            } else if (which === 'gear') {
                if (parsed.gear_db) GEAR_DB = parsed.gear_db;
                if (parsed.named_item_configs) NAMED_ITEM_CONFIGS = parsed.named_item_configs;
                if (parsed.green_set_info) GREEN_SET_INFO = parsed.green_set_info;
                if (!parsed.gear_db) throw new Error('Kein "gear_db"-Objekt gefunden.');
            } else if (which === 'mods') {
                if (!parsed.slots) throw new Error('Kein "slots"-Objekt gefunden.');
                MOD_CATALOG = parsed.slots;
            }
            refreshAfterDbChange('Import erfolgreich.');
        } catch (err) {
            adminToast('Import fehlgeschlagen: ' + err.message, 'error');
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

function resetDb() {
    if (!confirm('Alle lokalen Änderungen an Waffen/Gear/Mods verwerfen und auf die Original-Datenbanken zurücksetzen?')) return;
    try { localStorage.removeItem(ADMIN_LS_KEY); } catch (e) {}
    location.reload();
}

// Tabellen neu rendern, sobald der Verwaltungs-Tab geöffnet wird
const _origSwitchTab = switchTab;
switchTab = function(name) {
    _origSwitchTab(name);
    if (name === 'admin') renderAdminTables();
};
