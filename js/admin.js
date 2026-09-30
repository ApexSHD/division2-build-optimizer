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
function esc(v) { return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function adminToast(msg, type) { if (typeof showToast === 'function') showToast(msg, type || 'success'); }

function openAdminModal(title) {
    document.getElementById('adminModalTitle').textContent = title;
    document.getElementById('adminModal').classList.remove('hidden');
}
function closeAdminModal() {
    document.getElementById('adminModal').classList.add('hidden');
    document.getElementById('adminModalBody').innerHTML = '';
}

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
            <td class="py-2 px-3">${actionBtns(`openModForm('${slot}', ${i})`, `deleteModEntry('${slot}', ${i})`, 'Bearbeiten', 'Löschen')}</td>
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

function parseFixedAttr(strVal) {
    const out = [];
    const re = /([a-z]+)\s*[:=]\s*(-?\d+(?:[.,]\d+)?)/gi;
    let m;
    while ((m = re.exec(strVal))) {
        out.push([m[1].toLowerCase(), parseFloat(m[2].replace(',', '.'))]);
    }
    return out;
}
function fixedAttrToStr(fixed) {
    return (fixed || []).map(p => `${p[0]}:${p[1]}`).join(', ');
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
        ${modalInput('agFixed', 'Fixe Attribute (Format: chc:6, chd:12 – leer = keine)', fixedAttrToStr(g.fixed), { placeholder: 'z.B. chc:6, chd:12' })}
        ${modalInput('agPerk', 'Perk / Talent (Beschreibung)', g.perk, { type: 'textarea', rows: 3 })}
        <div class="flex justify-end gap-2 pt-2 border-t border-gray-800">
            <button onclick="closeAdminModal()" class="btn-secondary px-4 py-2 rounded-lg text-sm font-semibold">Abbrechen</button>
            <button onclick="saveGearForm(${idx})" class="btn-primary px-4 py-2 rounded-lg text-sm font-bold">Speichern</button>
        </div>`;
}

function saveGearForm(idx) {
    const name = getVal('agName').trim();
    if (!name) { adminToast('Bitte einen Namen angeben.', 'error'); return; }
    const fixedStr = getVal('agFixed');
    const entry = {
        slot: getVal('agSlot'),
        brand: getVal('agBrand') || '',
        cls: getVal('agCls'),
        proto: getVal('agProto') === 'true',
        core: getVal('agCore'),
        fixed: fixedStr.trim() ? parseFixedAttr(fixedStr) : [],
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
const ADMIN_BRAND_GROUPS = { dps: 'DPS', utility: 'Utility & Defense' };

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
        fillSelectOptions('adminBrandGroupFilter', [['', 'Alle Gruppen'], ...groups.map(g => [g, ADMIN_BRAND_GROUPS[g] || g])], true);
    }
    document.getElementById('adminBrandCount').textContent = Object.keys(BRAND_SET_INFO).length;
    const rows = entries.map(([key, b]) => `<tr class="border-t border-gray-800">
        <td class="py-2 px-3 text-sm font-semibold">${esc(key)}</td>
        <td class="py-2 px-3 text-sm text-gray-400">${esc(b.name)}</td>
        <td class="py-2 px-3 text-sm">${esc(ADMIN_BRAND_GROUPS[b.group] || b.group || '—')}</td>
        <td class="py-2 px-3 text-sm text-gray-400">${esc(b.weapon_hint || '—')}</td>
        <td class="py-2 px-3 text-sm text-gray-500 max-w-xs truncate" title="${esc(b.wd_bonus || '')}">${esc(b.wd_bonus || '—')}</td>
        <td class="py-2 px-3">${actionBtns(`openBrandForm('${esc(key).replace(/'/g, "\\'")}')`, `deleteBrandEntry('${esc(key).replace(/'/g, "\\'")}')`, 'Bearbeiten', 'L\u00f6schen')}</td>
    </tr>`).join('');
    el.innerHTML = `<table class="w-full text-left">
        <thead><tr class="text-xs uppercase text-gray-500">
            <th class="py-2 px-3">Schl\u00fcssel</th><th class="py-2 px-3">Name</th><th class="py-2 px-3">Gruppe</th><th class="py-2 px-3">Waffen-Hint</th><th class="py-2 px-3">Waffenbonus</th><th class="py-2 px-3">Aktionen</th>
        </tr></thead><tbody>${rows || '<tr><td colspan="6" class="py-4 text-center text-gray-500">Keine Treffer</td></tr>'}</tbody></table>`;
}

function openBrandForm(key) {
    const isNew = key == null || key === 'null';
    const b = isNew ? {} : (BRAND_SET_INFO[key] || {});
    openAdminModal(isNew ? 'Neues Brand-Set anlegen' : 'Brand-Set bearbeiten: ' + key);
    document.getElementById('adminModalBody').innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${modalInput('abKey', 'Schl\u00fcssel (wie im Tool verwendet)', isNew ? '' : key, { required: true, placeholder: 'z.B. fenris' })}
            ${modalInput('abName', 'Vollst\u00e4ndiger Name', b.name || '', { required: true, placeholder: 'z.B. Fenris Group AB' })}
            ${modalInput('abGroup', 'Gruppe', b.group || 'dps', { type: 'select', options: [['dps', 'DPS'], ['utility', 'Utility & Defense']] })}
            ${modalInput('abWeaponHint', 'Waffen-Hint (optional)', b.weapon_hint || '', { placeholder: 'z.B. AR' })}
        </div>
        ${modalInput('abWdBonus', 'Waffenbonus (Beschreibung, optional)', b.wd_bonus || '', { placeholder: 'z.B. 1p: +12% AR-Schaden' })}
        ${modalInput('abFragments', 'Match-Fragmente (Komma-getrennt, optional)', (b.fragments || []).join(', '), { placeholder: 'z.B. fenris, ferocious calm' })}
        <div class="flex justify-end gap-2 pt-2 border-t border-gray-800">
            <button onclick="closeAdminModal()" class="btn-secondary px-4 py-2 rounded-lg text-sm font-semibold">Abbrechen</button>
            <button onclick="saveBrandForm(${isNew ? 'null' : `'${esc(key).replace(/'/g, "\\'")}'`})" class="btn-primary px-4 py-2 rounded-lg text-sm font-bold">Speichern</button>
        </div>`;
}

function saveBrandForm(key) {
    const newKey = getVal('abKey').trim();
    const name = getVal('abName').trim();
    if (!newKey || !name) { adminToast('Bitte Schl\u00fcssel und Namen angeben.', 'error'); return; }
    const entry = { name, group: getVal('abGroup') };
    const wh = getVal('abWeaponHint').trim(); if (wh) entry.weapon_hint = wh;
    const wb = getVal('abWdBonus').trim(); if (wb) entry.wd_bonus = wb;
    const fr = getVal('abFragments').split(',').map(x => x.trim()).filter(Boolean);
    if (fr.length) entry.fragments = fr;
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
    if (!BRAND_SET_INFO[key] || !confirm(`Brand-Set "${key}" wirklich l\u00f6schen?`)) return;
    delete BRAND_SET_INFO[key];
    refreshAfterDbChange('Brand-Set gel\u00f6scht.');
}

function renderGreensAdmin() {
    const el = document.getElementById('adminGreenTable');
    if (!el) return;
    const filter = (getVal('adminGreenFilter') || '').toLowerCase();
    const entries = Object.entries(GREEN_SET_INFO)
        .filter(([k, g]) => !filter || k.toLowerCase().includes(filter) || (g.name || '').toLowerCase().includes(filter));
    document.getElementById('adminGreenCount').textContent = Object.keys(GREEN_SET_INFO).length;
    const rows = entries.map(([key, g]) => `<tr class="border-t border-gray-800">
        <td class="py-2 px-3 text-sm font-semibold">${esc(key)}</td>
        <td class="py-2 px-3 text-sm text-gray-400">${esc(g.name)}</td>
        <td class="py-2 px-3 text-sm text-gray-500 max-w-xs truncate" title="${esc(g.n2 || '')}">${esc(g.n2 || '—')}</td>
        <td class="py-2 px-3 text-sm text-gray-500 max-w-xs truncate" title="${esc(g.n3 || '')}">${esc(g.n3 || '—')}</td>
        <td class="py-2 px-3 text-sm text-gray-500 max-w-xs truncate" title="${esc(g.n4 || '')}">${esc(g.n4 || '—')}</td>
        <td class="py-2 px-3">${actionBtns(`openGreenForm('${esc(key).replace(/'/g, "\\'")}')`, `deleteGreenEntry('${esc(key).replace(/'/g, "\\'")}')`, 'Bearbeiten', 'L\u00f6schen')}</td>
    </tr>`).join('');
    el.innerHTML = `<table class="w-full text-left">
        <thead><tr class="text-xs uppercase text-gray-500">
            <th class="py-2 px-3">Schl\u00fcssel</th><th class="py-2 px-3">Name</th><th class="py-2 px-3">2p</th><th class="py-2 px-3">3p</th><th class="py-2 px-3">4p</th><th class="py-2 px-3">Aktionen</th>
        </tr></thead><tbody>${rows || '<tr><td colspan="6" class="py-4 text-center text-gray-500">Keine Treffer</td></tr>'}</tbody></table>`;
}

function openGreenForm(key) {
    const isNew = key == null || key === 'null';
    const g = isNew ? {} : (GREEN_SET_INFO[key] || {});
    openAdminModal(isNew ? 'Neues Gear-Set anlegen' : 'Gear-Set bearbeiten: ' + key);
    document.getElementById('adminModalBody').innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${modalInput('ag2Key', 'Schl\u00fcssel (wie im Tool verwendet)', isNew ? '' : key, { required: true, placeholder: 'z.B. striker' })}
            ${modalInput('ag2Name', 'Vollst\u00e4ndiger Name', g.name || '', { required: true, placeholder: "z.B. Striker's Battlegear" })}
        </div>
        ${modalInput('ag2N2', '2p-Bonus', g.n2 || '')}
        ${modalInput('ag2N3', '3p-Bonus', g.n3 || '')}
        ${modalInput('ag2N4', '4p-Bonus (Chest/Backpack-Talent)', g.n4 || '', { type: 'textarea', rows: 2 })}
        ${modalInput('ag2Modeled', 'Modellierung-Hinweis (optional)', g.modeled || '', { placeholder: 'z.B. 3p numerisch (Feuerrate)' })}
        <div class="flex justify-end gap-2 pt-2 border-t border-gray-800">
            <button onclick="closeAdminModal()" class="btn-secondary px-4 py-2 rounded-lg text-sm font-semibold">Abbrechen</button>
            <button onclick="saveGreenForm(${isNew ? 'null' : `'${esc(key).replace(/'/g, "\\'")}'`})" class="btn-primary px-4 py-2 rounded-lg text-sm font-bold">Speichern</button>
        </div>`;
}

function saveGreenForm(key) {
    const newKey = getVal('ag2Key').trim();
    const name = getVal('ag2Name').trim();
    if (!newKey || !name) { adminToast('Bitte Schl\u00fcssel und Namen angeben.', 'error'); return; }
    const entry = { name, n2: getVal('ag2N2') || '', n3: getVal('ag2N3') || '', n4: getVal('ag2N4') || '' };
    const md = getVal('ag2Modeled').trim(); if (md) entry.modeled = md;
    const oldKey = (key && key !== 'null') ? key : null;
    if (oldKey && oldKey !== newKey) {
        const newObj = {};
        for (const k of Object.keys(GREEN_SET_INFO)) newObj[k === oldKey ? newKey : k] = (k === oldKey) ? entry : GREEN_SET_INFO[k];
        GREEN_SET_INFO = newObj;
    } else {
        GREEN_SET_INFO[newKey] = entry;
    }
    closeAdminModal();
    refreshAfterDbChange(oldKey ? 'Gear-Set aktualisiert.' : 'Gear-Set hinzugef\u00fcgt.');
}

function deleteGreenEntry(key) {
    if (!GREEN_SET_INFO[key] || !confirm(`Gear-Set "${key}" wirklich l\u00f6schen?`)) return;
    delete GREEN_SET_INFO[key];
    refreshAfterDbChange('Gear-Set gel\u00f6scht.');
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
