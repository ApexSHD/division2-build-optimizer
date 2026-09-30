// Waffen-Daten aus der JSON-Datei

// Talente-Daten

// ========== HIGH-END-GATTUNGS-TALENTE (talents_full_v1.json) ==========
// Normale High-End-Talente aus der ausgelagerten Talent-DB:
// - fehlende Eintraege in WEAPON_TALENTS ergaenzen (Schadensberechnung)
// - Talente in die Gattungs-Gruppen von talentsData einsortieren (Drop-down)
// Perfect-/Named-Varianten kommen weiterhin aus der Named-Waffen-DB.
(function mergeTalentDbIntoCatalog() {
    const catToType = { wd: 'wd', amp: 'amp', chd: 'chd', chcchd: 'chcchd', rof: 'rof', wdrof: 'wdrof', utility: null, dyn: null };
    const typeToGroup = {
        AR: 'Sturmgewehre', LMG: 'Leichte Maschinengewehre', MP: 'Maschinenpistolen',
        Rifle: 'Gewehre', Shotgun: 'Schrotflinten', MMR: 'Präzisionsgewehre',
        Pistol: 'Pistolen', ALL: 'Allgemeine Waffen'
    };
    (TALENTS_DB.talents || []).forEach(t => {
        // Der Drop-down uebergibt talentKeyFromName(Anzeigename) als Wert,
        // daher muss die Definition unter JEDEM moeglichen Key auffindbar sein:
        // unter t.key (DB-Key) UND dem aus dem deutschen Label abgeleiteten Key.
        const labelKey = typeof talentKeyFromName === 'function' ? talentKeyFromName(t.label) : t.key;
        if (!WEAPON_TALENTS[t.key] || !WEAPON_TALENTS[labelKey]) {
            const entry = {
                label: t.label + ' (' + t.group + ')',
                type: catToType[t.category] !== undefined ? catToType[t.category] : null,
                valueNormal: (t.value === null || t.value === undefined) ? 0 : t.value,
                valueNamed: (t.value === null || t.value === undefined) ? 0 : t.value,
                conditional: !!t.conditional,
                condition: t.condition || '',
                note: (t.estimated ? '⚠ Wert geschätzt – bitte im Spiel prüfen. ' : '') + t.description
            };
            // v36: Vorhandene Einträge NIE überschreiben – vorher wurde
            // z.B. 'Raserei' (type 'wdrof') durch die DB-Kopie mit
            // category 'dyn' → type null ersetzt und wirkte nicht mehr.
            WEAPON_TALENTS[t.key] = WEAPON_TALENTS[t.key] || entry;
            WEAPON_TALENTS[labelKey] = WEAPON_TALENTS[labelKey] || entry;
        }
        (t.weapon_types || []).forEach(wt => {
            const g = typeToGroup[wt];
            if (!g || !talentsData[g]) return;
            if (talentsData[g].some(x => x.name === t.label)) return;
            talentsData[g].push({ name: t.label, description: t.description, group: t.group });
        });
    });
})();


// Fülle die Drop-down-Liste für Waffentypen
function populateWeaponTypeDropdown() {
    const weaponTypeSelect = document.getElementById('weaponDbTypeSelect');
    
    // Leere die Drop-down-Liste
    weaponTypeSelect.innerHTML = '<option value="">— Waffentyp auswählen —</option>';
    
    // Sammle alle einzigartigen Waffentypen
    const uniqueTypes = [...new Set(weaponsData.weapons.map(weapon => weapon.type))];
    
    // Sortiere die Waffentypen alphabetisch
    uniqueTypes.sort();
    
    // Füge jeden Waffentyp als Option hinzu
    uniqueTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        weaponTypeSelect.appendChild(option);
    });
}

// Fülle die Drop-down-Liste für Waffen basierend auf dem ausgewählten Waffentyp
function populateWeaponDropdownByType(selectedType) {
    const weaponSelect = document.getElementById('weaponDbSelect');
    
    // Leere die Drop-down-Liste
    weaponSelect.innerHTML = '<option value="">— Waffe auswählen —</option>';
    
    // Filtere Waffen nach dem ausgewählten Typ
    const filteredWeapons = weaponsData.weapons.filter(weapon => weapon.type === selectedType);
    
    // Sortiere die Waffen alphabetisch nach Namen
    filteredWeapons.sort((a, b) => a.name.localeCompare(b.name));
    
    // Füge jede Waffe als Option hinzu
    filteredWeapons.forEach(weapon => {
        const option = document.createElement('option');
        option.value = weapon.name;
        const badge = weapon.rarity === 'exotic' ? '🟠 ' : (weapon.rarity === 'named' ? '🟡 ' : '');
        option.textContent = badge + weapon.name;
        option.dataset.type = weapon.type;
        option.dataset.baseDmg = weapon.stats['Level 40 Damage'];
        option.dataset.rarity = weapon.rarity || 'standard';
        weaponSelect.appendChild(option);
    });
}

// Trägerwaffen der Perfekt-/Named-Talente (High-End-Named-Waffen).
// Wird im Talent-Drop-down als Hinweis angezeigt ("nur: Waffe X & Y").
// ========== WAFFEN-MOD-KATALOG (feste Werte je Mod) ==========
// Quelle: komplette Mod-Liste des Nutzers (aktueller als alle Web-Quellen).
// slotTypes: kompatible Slot-Typen; bonus/penalty: {type, val} mit
// Calc-Typ (chc/chd/hsd/wd/rof/reloadSpeed/handling/accuracy/stability/
// range/capacity) oder null bei reinem Utility-Effekt.
const MOD_ATTR_LABELS = {
    chc: 'CHC', chd: 'CHD', hsd: 'Kopfschussschaden', wd: 'Waffen-Schaden',
    rof: 'Feuerrate', reloadSpeed: 'Nachladetempo', handling: 'Handhabung',
    accuracy: 'Genauigkeit', stability: 'Stabilität', range: 'Opt. Reichweite',
    capacity: 'Runden'
};

// ========== SLOT-SPEZIFISCHE ATTRIBUTLISTEN ==========
// Zuvor hatte jeder der 4 Mod-Slots dieselben 15 Attribut-Optionen im
// Drop-down – unabhängig davon, ob dieser Bonus laut Spiel auf diesem
// Slot-Typ überhaupt vorkommt (z.B. CHD auf einem Magazin-Mod, aber
// Stabilität auf einer Mündung). Die "typischen" Listen unten werden aus
// den tatsächlich in MOD_CATALOG hinterlegten Bonus-Typen je Slot
// abgeleitet und zuerst angezeigt; alle übrigen Attribute bleiben in einer
// zweiten Gruppe weiterhin wählbar (z.B. für Sonderfälle/neue Mods, die
// noch nicht im Katalog stehen), damit nichts blockiert wird.
const SLOT_TYPICAL_ATTRS = {
    optic:       ['chc', 'chd', 'hsd', 'accuracy', 'stability', 'range', 'reloadSpeed', 'handling'],
    muzzle:      ['chc', 'chd', 'hsd', 'stability', 'accuracy', 'range'],
    underbarrel: ['chc', 'chd', 'hsd', 'stability', 'accuracy', 'reloadSpeed'],
    magazine:    ['capacity', 'reloadSpeed', 'rof', 'wd', 'chd', 'hsd', 'stability', 'range']
};
// Vollständige Liste aller im Formular unterstützten Attribute (unverändert
// gegenüber der alten, statischen Options-Liste).
const ALL_MOD_ATTRS = ['chc', 'chd', 'hsd', 'wd', 'dta', 'dttooc', 'dth', 'rof', 'reloadSpeed', 'handling', 'accuracy', 'stability', 'range', 'swapSpeed', 'capacity'];
// Lange Anzeige-Labels (mit Einheit) fürs Attribut-Drop-down – getrennt von
// MOD_ATTR_LABELS (kurze Labels, werden an anderer Stelle für Hinweistexte
// verwendet und sollen dort unverändert bleiben).
const MOD_ATTR_FULL_LABELS = {
    chc: 'CHC %', chd: 'CHD %', hsd: 'Kopfschussschaden %', wd: 'WD %',
    dta: 'DTA %', dttooc: 'DTToOC %', dth: 'DTH %', rof: 'Feuerrate %',
    reloadSpeed: 'Nachladetempo %', handling: 'Handhabung %', accuracy: 'Genauigkeit %',
    stability: 'Stabilität %', range: 'Opt. Reichweite %', swapSpeed: 'Waffenwechsel %',
    capacity: 'Magazingröße'
};

// Baut die Attribut-Optionen für einen Mod-Slot: zuerst die für diesen
// Slot-Typ typischen Attribute (aus MOD_CATALOG abgeleitet), danach alle
// übrigen als "Weitere Attribute". Leere Standard-Option, damit ein Slot
// ohne bewussten Attribut-Wahl auch wirklich "kein Bonus" bedeutet (vorher
// war "chc" fest als erste Option gesetzt, was versehentlich CHC statt des
// gewünschten Attributs auswählen konnte).
function buildAttrTypeOptionsHtml(cat) {
    const typical = SLOT_TYPICAL_ATTRS[cat] || [];
    const rest = ALL_MOD_ATTRS.filter(a => !typical.includes(a));
    let html = '<option value="">— Attribut —</option>';
    html += '<optgroup label="Typisch für diesen Slot">';
    typical.forEach(a => { html += `<option value="${a}">${MOD_ATTR_FULL_LABELS[a]}</option>`; });
    html += '</optgroup>';
    if (rest.length) {
        html += '<optgroup label="Weitere Attribute">';
        rest.forEach(a => { html += `<option value="${a}">${MOD_ATTR_FULL_LABELS[a]}</option>`; });
        html += '</optgroup>';
    }
    return html;
}

// Befüllt alle 4 Attribut-Drop-downs slot-spezifisch. Wird einmalig beim
// Laden der Seite aufgerufen (die Optionen selbst hängen nicht von der
// gewählten Waffe ab, nur die Mod-Katalog-Liste tut das über
// populateModSelects/onModTypeChange).
function populateAttrTypeDropdowns() {
    for (const cat of Object.keys(MOD_SLOT_FORM)) {
        const typeSel = document.getElementById(MOD_SLOT_FORM[cat].type);
        if (!typeSel) continue;
        const prev = typeSel.value;
        typeSel.innerHTML = buildAttrTypeOptionsHtml(cat);
        typeSel.value = prev && typeSel.querySelector('option[value="' + prev + '"]') ? prev : '';
    }
}

// Slot-Kategorie -> Formular-Elemente (Mod-Select, Typ-Select, Wert, Hinweis)
const MOD_SLOT_FORM = {
    optic:       { mod: 'modOpticMod',       type: 'modOpticType',       val: 'modOpticVal',       hint: 'modOpticHint' },
    muzzle:      { mod: 'modMuzzleMod',      type: 'modMuzzleType',      val: 'modMuzzleVal',      hint: 'modMuzzleHint' },
    underbarrel: { mod: 'modUnderbarrelMod', type: 'modUnderbarrelType', val: 'modUnderbarrelVal', hint: 'modUnderbarrelHint' },
    magazine:    { mod: 'modMagazineMod',    type: 'modMagazineType',    val: 'modMagazineVal',    hint: 'modMagazineHint' }
};

// Schätzt die Slot-Typen einer Waffe (Kaliber/Rail). null = unbekannt,
// dann zeigt das Mod-Drop-down alle Gruppen (Typ zuerst, dann Rest).
function inferWeaponSlotTypes(weaponName, weaponType) {
    const n = String(weaponName || '');
    const t = String(weaponType || '');
    const isRevolver = /D50|Magnum|M44|Rex|DI COY|Devil/.test(n);
    let magType = null, muzzleType = null;
    // Fix: Waffen werden mit Kurzcodes gespeichert ("Shotgun", "Rifle", "MMR", ...),
    // nicht mit deutschen Volltexten. Beide Schreibweisen müssen erkannt werden,
    // sonst fallen Schrotflinten & Gewehre in den AR-Fallback und bekommen
    // falsche Magazin-/Mündungs-Slot-Vorschläge.
    if (t.includes('Schrotflinte') || t === 'Shotgun') {
        magType = 'Tubular Magazine Slot';
    } else if (t.includes('Präzisionsgewehr') || t.includes('MMR')) {
        magType = 'Marksman 7.62 Magazine Slot';
    } else if (t.includes('Pistole') || t.includes('Pistol')) {
        magType = isRevolver ? 'Revolver Drum Slot' : 'Pistol Magazine Slot';
    } else if (t.includes('Maschinengewehr') || t.includes('LMG')) {
        magType = 'Ammunition Belt Slot';
    } else if (t.includes('Maschinenpistole') || t.includes('MP') || t.includes('SMG')) {
        const is45 = /Vector|UMP|Kard|45|CSMG|Socom/.test(n);
        magType = is45 ? '.45 ACP Magazine Slot' : '9mm Magazine Slot';
        muzzleType = is45 ? '.45 Muzzle Slot' : '9mm Muzzle Slot';
    } else if ((t.includes('Gewehr') && !t.includes('Sturmgewehr')) || t === 'Rifle') {
        // Rifle (halbautomatisch): überwiegend 7.62
        magType = '7.62 Magazine Slot';
        muzzleType = '7.62 Muzzle Slot';
    } else {
        // Sturmgewehr (AR): AK/FAL-Familie 7.62, Rest 5.56
        const is762 = /AK-M|FAL|SA-58|Carbine 7|MDR/.test(n);
        magType = is762 ? '7.62 Magazine Slot' : '5.56 Magazine Slot';
        muzzleType = is762 ? '7.62 Muzzle Slot' : '5.56 Muzzle Slot';
    }
    return { magazine: magType, muzzle: muzzleType, optic: null, underbarrel: null };
}

// Füllt die vier Mod-Drop-downs anhand der gewählten Waffe.
// Baut die Optionen des Mod-Drop-downs für eine Slot-Kategorie.
// preferred: vermuteter Slot-Typ der Waffe (Gruppe " (vermutlich)").
// typeFilter: gewähltes Attribut – es werden nur Mods mit diesem Bonus-Typ
// gezeigt (leerer String = alle Mods; 'none' = nur Utility-Mods ohne Bonus).
function buildModOptionsHtml(cat, preferred, typeFilter) {
    const mods = MOD_CATALOG[cat] || [];
    // Erlaubte Slot-Typen der gewaehlten Waffe (null = keine Einschraenkung)
    const allowed = (typeof currentWeaponSlotGroups !== 'undefined' && currentWeaponSlotGroups && currentWeaponSlotGroups[cat]) ? currentWeaponSlotGroups[cat] : null;
    const match = (m) => {
        if (!typeFilter) return true;
        if (typeFilter === 'none') return !m.bonus;
        return !!(m.bonus && m.bonus.type === typeFilter);
    };
    const slotOk = (st) => (allowed === null) || allowed.includes(st);
    const groups = [];
    if (preferred && slotOk(preferred)) groups.push(preferred);
    for (const m of mods) { if (!match(m)) continue; for (const st of (m.slotTypes || [])) if (slotOk(st) && !groups.includes(st)) groups.push(st); }
    let html = '<option value="">— Mod auswählen —</option>';
    if (allowed !== null && groups.length === 0) {
        html += '<option value="" disabled>— kein Slot verfügbar —</option>';
        return html;
    }
    for (const g of groups) {
        html += '<optgroup label="' + g + (g === preferred ? ' (vermutlich)' : '') + '">';
        for (const m of mods) {
            if (!(m.slotTypes || []).includes(g) || !match(m)) continue;
            let label = m.name;
            if (m.bonus) label += ' (+' + m.bonus.val + (m.bonus.type === 'capacity' ? ' Rd.' : '%') + ')';
            if (m.penalty) label += ' (' + m.penalty.val + (m.penalty.type === 'capacity' ? ' Rd.' : '%') + ')';
            html += '<option value="' + m.name + '">' + label + '</option>';
        }
        html += '</optgroup>';
    }
    return html;
}

// ========== AUTO-MODS: beste Mod-Belegung automatisch kalkulieren ==========
// Der Anwender kann pro Waffe wählen: "Mods automatisch optimieren" (Standard)
// oder manuell erfassen. Bei Automatik wird für jeden vorhandenen Mod-Slot der
// beste kompatible Mod aus dem Katalog gewählt (nur Slot-Typen, die die Waffe
// laut Datenbank besitzt). Exotics haben feste Mods — dort greift die
// Automatik nicht, die fixen Werte fließen unverändert ein.

// Schalter im Waffen-Formular: Mod-Erfassung ein-/ausblenden.
function toggleAutoMods() {
    const chk = document.getElementById('autoModsToggle');
    const grid = document.getElementById('modSlotsGrid');
    if (!chk || !grid) return;
    const auto = chk.checked;
    // Exoten: fixe Mods – hier darf die Sperre der Mod-Felder nicht
    // aufgehoben werden (toggleAutoMods läuft dort mit auto=false).
    const exoticActive = (typeof isExoticFormActive === 'function') && isExoticFormActive();
    if (!exoticActive) {
        grid.classList.toggle('hidden', auto);
        grid.classList.toggle('opacity-40', auto);
        // Interaktive Elemente deaktivieren, damit keine versteckten Werte gespeichert werden
        grid.querySelectorAll('select, input').forEach(el => { el.disabled = auto; });
    }
    const hint = document.getElementById('modSlotsHint');
    if (hint) {
        hint.textContent = auto
            ? '🔧 Automatik aktiv: Die beste Mod-Belegung wird bei der Berechnung automatisch bestimmt. Manuelle Erfassung ist deaktiviert.'
            : 'Manueller Modus: Erfasse Optik/Mündung/Unterlauf/Magazin selbst — die Werte werden 1:1 übernommen.';
    }
    updateModLiveSummary();
}

// Bewerte einen Katalog-Mod: erwarteter Ø-Schaden-Beitrag given aktueller
// CHC/CHD-Basis der Waffe. Utility-Mods (Stabilität etc.) zählen 0.
function modDamageGain(mod, chc, chd, p) {
    const b = mod.bonus || { type: '', val: 0 };
    const pen = mod.penalty || { type: '', val: 0 };
    let gain = 0;
    const contrib = (t, v) => {
        if (t === 'chc') {
            const pOld = Math.min(chc, 60) / 100;
            const pNew = Math.min(chc + v, 60) / 100;
            return (pNew - pOld) * (1 + chd / 100);
        }
        if (t === 'chd') return (v / 100) * p;
        return 0; // hsd/stability/accuracy/... → kein Ø-Beitrag im Bodyshot-Modell
    };
    gain += contrib(b.type, Math.abs(b.val || 0));
    gain += contrib(pen.type, -Math.abs(pen.val || 0));
    // Utility-Tiebreak: bei gleichem Schadens-Beitrag den stärksten Utility-Bonus bevorzugen
    const util = ['stability','accuracy','handling','reloadSpeed','range'].includes(b.type) ? Math.abs(b.val || 0) : 0;
    return gain + util * 0.001;
}

// Beste Mod-Belegung für eine Waffe kalkulieren (nicht-Exotic, autoMods aktiv).
function computeAutoMods(weapon) {
    const cats = ['optic', 'muzzle', 'underbarrel', 'magazine'];
    const mods = {};
    cats.forEach(c => { mods[c] = { type: '', val: 0, name: '', auto: true }; });

    const groups = (typeof getWeaponSlotGroups === 'function') ? getWeaponSlotGroups(weapon.name) : null;
    const slotTypes = inferWeaponSlotTypes(weapon.name, weapon.type);

    // Laufende Krit-Basis der Waffe (ohne Mods)
    let chc = (weapon.core2Type === 'chc' ? weapon.core2Val : 0) + (weapon.minorType === 'chc' ? weapon.minorVal : 0);
    let chd = (weapon.core2Type === 'chd' ? weapon.core2Val : 0) + (weapon.minorType === 'chd' ? weapon.minorVal : 0);
    // Krit-Chance-Annahme aus den Gear-Einstellungen (Standard 60%)
    const p = Math.min((typeof gearCritChanceAssumption === 'function' ? gearCritChanceAssumption() : 0.6) * 100 + chc, 60) / 100;

    // Reihenfolge: erst Slots mit Krit-Bezug (optic/muzzle), dann der Rest
    ['optic', 'muzzle', 'underbarrel', 'magazine'].forEach(cat => {
        const allowed = (groups && groups[cat] && groups[cat].length) ? groups[cat] : (slotTypes[cat] ? [slotTypes[cat]] : []);
        if (!allowed.length) return; // Slot existiert bei dieser Waffe nicht
        const catalog = (MOD_CATALOG[cat] || []).filter(m => m.slotTypes.some(t => allowed.includes(t)));
        if (!catalog.length) return;
        let best = null, bestGain = -1;
        catalog.forEach(m => {
            const g = modDamageGain(m, chc, chd, p);
            if (g > bestGain) { bestGain = g; best = m; }
        });
        if (best && best.bonus && best.bonus.val) {
            mods[cat] = { type: best.bonus.type, val: Math.abs(best.bonus.val), name: best.name, auto: true };
            if (best.bonus.type === 'chc') chc += Math.abs(best.bonus.val);
            if (best.bonus.type === 'chd') chd += Math.abs(best.bonus.val);
        }
    });
    return mods;
}

// Effektive Mods einer Waffe für die Berechnung/Darstellung:
// - Exotic: fixe Mods (unverändert)
// - autoMods aktiv: automatisch kalkulierte beste Belegung
// - sonst: die manuell erfassten Werte
function getEffectiveMods(weapon) {
    if (!weapon) return {};
    if (weapon.isExotic || !weapon.autoMods) return weapon.mods || {};
    return computeAutoMods(weapon);
}

function populateModSelects(weaponName, weaponType) {
    const slotTypes = inferWeaponSlotTypes(weaponName, weaponType);
    // Slot-Typen aus der Waffen-Tabelle (wenn bekannt): NUR kompatible Mods zeigen
    currentWeaponSlotGroups = (typeof getWeaponSlotGroups === 'function') ? getWeaponSlotGroups(weaponName) : null;
    for (const cat of Object.keys(MOD_SLOT_FORM)) {
        const els = MOD_SLOT_FORM[cat];
        const modSel = document.getElementById(els.mod);
        if (!modSel) continue;
        const typeSel = document.getElementById(els.type);
        const typeFilter = typeSel ? typeSel.value : '';
        const prev = modSel.value;
        const preferred = (currentWeaponSlotGroups && currentWeaponSlotGroups[cat] && currentWeaponSlotGroups[cat].length) ? currentWeaponSlotGroups[cat][0] : slotTypes[cat];
        modSel.innerHTML = buildModOptionsHtml(cat, preferred, typeFilter);
        // Nur behalten, wenn der Mod nach dem Filter noch gerendert ist
        modSel.value = prev && modSel.innerHTML.includes('value="' + prev + '"') ? prev : '';
        const hintEl = document.getElementById(els.hint);
        if (hintEl && !modSel.value) hintEl.textContent = '';
        // Sperr-Zustand der Typ/Wert-Felder konsistent halten:
        // Katalog-Mod gewählt = fixe Werte, sonst freie Eingabe.
        syncModLockState(cat);
    }
    // Auto-Mods-Zustand konsistent halten: Bei aktiver Automatik dürfen die
    // Mod-Felder weder sichtbar noch editierbar sein (auch nicht nach dem
    // Neuaufbau der Drop-downs durch diese Funktion).
    if (typeof toggleAutoMods === 'function') toggleAutoMods();
    updateModLiveSummary();
}

// Attribut-Auswahl: Mod-Drop-down auf passende Mods einschränken
// (und zurück auf alle, wenn "—" gewählt ist).
function onModTypeChange(cat) {
    const els = MOD_SLOT_FORM[cat];
    const modSel = document.getElementById(els.mod);
    const typeSel = document.getElementById(els.type);
    if (!modSel || !typeSel) return;
    const weaponName = document.getElementById('weaponName') ? document.getElementById('weaponName').value : '';
    const weaponType = document.getElementById('weaponType') ? document.getElementById('weaponType').value : '';
    const slotTypes = inferWeaponSlotTypes(weaponName, weaponType);
    // Erlaubte Slot-Gruppen der aktuell gewaehlten Waffe beruecksichtigen
    const groupsNow = (typeof getWeaponSlotGroups === 'function') ? getWeaponSlotGroups(weaponName) : null;
    const prev = modSel.value;
    const preferred = (groupsNow && groupsNow[cat] && groupsNow[cat].length) ? groupsNow[cat][0] : slotTypes[cat];
    modSel.innerHTML = buildModOptionsHtml(cat, preferred, typeSel.value);
    // Nur behalten, wenn der Mod nach dem Filter noch gerendert ist
    modSel.value = prev && modSel.innerHTML.includes('value="' + prev + '"') ? prev : '';
    // Hinweis räumen, wenn der gewählte Mod nicht mehr zum Filter passt
    if (!modSel.value) {
        const hintEl = document.getElementById(els.hint);
        if (hintEl) hintEl.textContent = '';
        const valEl = document.getElementById(els.val);
        if (valEl) valEl.value = '';
    }
}

// Mod-Auswahl: Typ + Wert automatisch füllen, Malus als Hinweis zeigen.
function onModSelectChange(cat) {
    const els = MOD_SLOT_FORM[cat];
    const modSel = document.getElementById(els.mod);
    const typeSel = document.getElementById(els.type);
    const valEl = document.getElementById(els.val);
    const hintEl = document.getElementById(els.hint);
    if (!modSel || !typeSel || !valEl) return;
    const m = (MOD_CATALOG[cat] || []).find(x => x.name === modSel.value);
    if (!m) {
        if (hintEl) hintEl.textContent = '';
        // Kein Katalog-Mod gewaehlt -> Typ/Wert wieder freigeben
        typeSel.disabled = false;
        valEl.disabled = false;
        return;
    }
    if (m.bonus) {
        // Nur setzen, wenn der Calc-Typ im Typ-Drop-down existiert
        const hasOpt = Array.from(typeSel.options).some(o => o.value === m.bonus.type);
        if (hasOpt) { typeSel.value = m.bonus.type; valEl.value = String(Math.abs(m.bonus.val)); }
        else { typeSel.value = ''; valEl.value = ''; }
    } else {
        typeSel.value = '';
        valEl.value = '';
    }
    // Fixe In-Game-Mod-Werte sperren (keine manuellen Fehleingaben moeglich)
    typeSel.disabled = true;
    valEl.disabled = true;
    if (hintEl) {
        let txt = 'Fixer In-Game-Mod-Wert (gesperrt)';
        if (m.penalty) txt += ' | Malus: ' + m.penalty.val + '% ' + (MOD_ATTR_LABELS[m.penalty.type] || m.penalty.type);
        if (m.note) txt += ' | ' + m.note;
        if (m.bonus && (m.bonus.type === 'stability' || m.bonus.type === 'accuracy' || m.bonus.type === 'range' || m.bonus.type === 'handling' || m.bonus.type === 'reloadSpeed')) {
            txt += ' | kein direkter DPS-Effekt';
        }
        hintEl.textContent = txt;
    }
}

// Setzt einen einzelnen Mod-Slot zurück (Katalog-Mod, Attribut, Wert,
// Hinweis) und gibt gesperrte Felder wieder frei. Praktisch, wenn man nur
// einen von vier Slots neu bestücken will, ohne das ganze Formular zu
// leeren.
function resetModSlot(cat) {
    const els = MOD_SLOT_FORM[cat];
    if (!els) return;
    const modSel = document.getElementById(els.mod);
    const typeSel = document.getElementById(els.type);
    const valEl = document.getElementById(els.val);
    const hintEl = document.getElementById(els.hint);
    if (modSel) { modSel.disabled = false; modSel.value = ''; }
    if (typeSel) { typeSel.disabled = false; typeSel.value = ''; }
    if (valEl) { valEl.disabled = false; valEl.value = ''; }
    if (hintEl) hintEl.textContent = '';
    updateModLiveSummary();
}

// Live-Summary: fasst die aktuell im Formular stehenden Mod-Boni aller
// sichtbaren Slots je Attribut zusammen (z.B. "CHC +12% · CHD +22%") und
// zeigt sie direkt unter den 4 Mod-Slots an – ohne dass man erst eine
// Waffe speichern oder zur Empfehlungsspalte scrollen muss. Ausgeblendete
// Slots (Mod-Platz-Limit der Waffe) zählen nicht mit.
function updateModLiveSummary() {
    const el = document.getElementById('modLiveSummary');
    if (!el) return;
    const totals = {};
    for (const cat of Object.keys(MOD_SLOT_FORM)) {
        const els = MOD_SLOT_FORM[cat];
        const wrap = document.getElementById('modSlot' + cat.charAt(0).toUpperCase() + cat.slice(1) + 'Wrap');
        if (wrap && wrap.style.display === 'none') continue;
        const typeEl = document.getElementById(els.type);
        const valEl = document.getElementById(els.val);
        if (!typeEl || !valEl) continue;
        const t = typeEl.value;
        if (!t || String(valEl.value).trim() === '') continue;
        const v = parseLocalizedFloat(valEl.value);
        if (isNaN(v) || v === 0) continue;
        totals[t] = (totals[t] || 0) + v;
    }
    const keys = Object.keys(totals);
    if (!keys.length) {
        el.textContent = 'Noch keine Mod-Boni eingetragen.';
        return;
    }
    el.innerHTML = '<span class="text-gray-500">Mods gesamt:</span> ' + keys.map(t => {
        const label = MOD_ATTR_LABELS[t] || t;
        const unit = t === 'capacity' ? ' Schuss' : '%';
        return '<span class="text-gray-200 font-semibold">' + label + ' +' + formatGermanNumber(totals[t]) + unit + '</span>';
    }).join(' <span class="text-gray-600">·</span> ');
}

// Stellt den Sperr-Zustand der Typ/Wert-Felder anhand der Mod-Auswahl her
// (nach Formular-Reset oder Slot-Neubefuellung). Katalog-Mod gewaehlt = fix.
function syncModLockState(cat) {
    const els = MOD_SLOT_FORM[cat];
    const modSel = document.getElementById(els.mod);
    const typeSel = document.getElementById(els.type);
    const valEl = document.getElementById(els.val);
    if (!modSel || !typeSel || !valEl) return;
    const hasCatalogMod = (MOD_CATALOG[cat] || []).some(x => x.name === modSel.value);
    typeSel.disabled = hasCatalogMod;
    valEl.disabled = hasCatalogMod;
}

const NAMED_TALENT_CARRIERS = {
    'Perfekter Optimist':      'Shield Splinterer & Diceros Special',
    'Perfekt angespannt':       'Dark Winter & Cold Relations',
    'Perfekt synchronisiert':  'Test Subject & Harmony',
    'Perfekter Killer':        'The Apartment & Caretaker',
    'Perfekte Flachlage':      'Kingbreaker & Dare',
    'Perfekter Sadist':        'Carnage & Survivalist D50',
    'Perfekt entzündet':       'Pyromaniac',
    'Perfekt blind':           'The Darkness',
    'Perfekter Druckpunkt':    'Goalie & Rusty',
    'Perfekt entschlossen':    'Prophet & Relic',
    'Perfekter Schütze':       'The Archivist & Ekim\'s Long Stick',
    'Perfektes Erstblut':      'Pinprick',
    'Perfekt von hinten':      'Whisper & Brutus',
    'Perfekte schnelle Hände': 'Good Times',
    'Perfekte Bewahrung':      'Emeline\'s Guard & P320 XCompact',
    'Perfekt stabil':          'Tabula Rasa'
};

// Mappt den Waffentyp des Formulars auf die Kategorie der Talent-Datenbank.
const WEAPON_TYPE_TALENT_CATEGORY = {
    'AR':      'Sturmgewehre',
    'LMG':     'Leichte Maschinengewehre',
    'MP':      'Maschinenpistolen',
    'Rifle':   'Gewehre',
    'Shotgun': 'Schrotflinten',
    'MMR':     'Präzisionsgewehre',
    'Pistol':  'Pistolen'
};

// Umkehrung: Trägerwaffe -> erlaubte Perfekt-Talente (für die Auswahl-Sperre)
const NAMED_CARRIER_TO_TALENTS = {};
Object.keys(NAMED_TALENT_CARRIERS).forEach(tName => {
    NAMED_TALENT_CARRIERS[tName].split('&').forEach(w => {
        const wn = w.trim();
        if (!wn) return;
        (NAMED_CARRIER_TO_TALENTS[wn] = NAMED_CARRIER_TO_TALENTS[wn] || []).push(tName);
    });
});

// Fülle die Drop-down-Liste für Talente: Allgemeine Waffen-Talente plus
// die Talente der gewählten Waffengattung (als Optgroups). Perfekt-Versionen
// (Named-Waffen-Talente) tragen einen Stern und ihre Trägerwaffen als Hinweis.
function populateTalentDropdown() {
    const talentSelect = document.getElementById('weaponTalentSelectSelect');
    if (!talentSelect) return;

    // Gewählte Waffengattung ermitteln (nur Talente zeigen, die darauf passen)
    const typeSel = document.getElementById('weaponType');
    const typeVal = typeSel ? typeSel.value : '';
    const catKey = WEAPON_TYPE_TALENT_CATEGORY[typeVal] || null;
    const prevValue = talentSelect.value;

    // Leere die Drop-down-Liste
    talentSelect.innerHTML = '<option value="">— Talent auswählen —</option>';

    // Gewählte Waffe ermitteln: Perfekt-Talente (★) sind nur auf der
    // passenden Named-Waffe auswählbar, sonst werden sie gesperrt.
    const nameEl = document.getElementById('weaponName');
    const selWeaponName = nameEl ? nameEl.value.trim() : '';
    const dbEntry2 = (typeof weaponsData !== 'undefined' && selWeaponName)
        ? weaponsData.weapons.find(x => x.name === selWeaponName) : null;
    const isNamedWeapon = dbEntry2 ? dbEntry2.rarity === 'named' : false;
    const allowedPerfect = (isNamedWeapon && NAMED_CARRIER_TO_TALENTS[selWeaponName]) || null;

    const addGroup = (label, talents) => {
        if (!talents || !talents.length) return;
        const group = document.createElement('optgroup');
        group.label = label;
        talents.forEach(talent => {
            const isNamed = talent.name.startsWith('Perfekt');
            // Perfekt-Talente (★) haben einen 1:1-Bezug zu ihrer Named-Waffe:
            // auf jeder anderen Waffe werden sie komplett ausgeblendet.
            if (isNamed && !(allowedPerfect && allowedPerfect.includes(talent.name))) return;
            const option = document.createElement('option');
            const carriers = NAMED_TALENT_CARRIERS[talent.name];
            // Value = normalisierter Key, damit die Schadensberechnung das
            // Talent in WEAPON_TALENTS findet (Anzeige bleibt der Name).
            option.value = talentKeyFromName(talent.name);
            option.textContent = `${isNamed ? '★ ' : ''}${talent.name} (${talent.group})`;
            option.dataset.description = talent.description +
                (carriers ? `\n\nNur auf Named-Waffen: ${carriers}` : '');
            group.appendChild(option);
        });
        talentSelect.appendChild(group);
    };

    addGroup('Allgemeine Waffen', talentsData['Allgemeine Waffen']);
    if (catKey) addGroup(catKey + ' (Gattungs-Talente)', talentsData[catKey]);

    // Auswahl merken, falls das Talent nach dem Neu-Aufbau noch vorhanden UND
    // nicht durch die Waffen-Zuordnung gesperrt ist
    const stillValid = prevValue && [...talentSelect.options].some(o => o.value === prevValue && !o.disabled);
    if (stillValid) {
        talentSelect.value = prevValue;
    } else if (prevValue) {
        // Gewähltes Talent passt nicht mehr zur Gattung -> Auswahl zurücksetzen
        talentSelect.value = '';
        const hint = document.getElementById('talentDescription');
        if (hint) hint.textContent = '';
    }
}

// Manueller Gattungswechsel im Waffen-Formular: hebt alle DB-Vorbelegungen
// auf, die sonst haengen bleiben wuerden – sonst "aendern sich die Talente
// nicht", weil das Drop-down gesperrt/versteckt bleibt:
//  - Named-Talent-Sperre (currentNamedTalent/currentNamedAttr + disabled)
//  - Exoten-Sperren (fixe Mods, verstecktes Talent-Feld, Prototyp-Sperre)
// Nach dem Reset folgt das Talent-Drop-down wieder der Gattung.
function onManualWeaponTypeChange() {
    // Named-Talent-Vorbelegung loesen (sonst fließt das alte Talent
    // in addWeapon() weiter ein, obwohl der Nutzer die Gattung wechselt)
    currentNamedTalent = null;
    currentNamedAttr = null;
    const tWrap = document.getElementById('weaponTalentSelectWrap');
    if (tWrap) tWrap.style.display = '';
    const tSel = document.getElementById('weaponTalentSelectSelect');
    if (tSel) tSel.disabled = false;
    const tDesc = document.getElementById('talentDescription');
    if (tDesc) tDesc.textContent = '';

    // Exoten-Status aufheben: fixe Mods freigeben, Talent-Feld zeigen
    if (currentExoticMods) {
        clearExoticFixedMods();
        const msHint = document.getElementById('modSlotsHint');
        if (msHint) { msHint.textContent = ''; msHint.className = 'text-[11px] text-gray-500'; }
    }
    currentExoticTalent = null;
    const exoEl = document.getElementById('weaponIsExotic');
    if (exoEl) exoEl.value = 'false';

    // Prototyp-Checkbox: Exoten-Sperre aufheben (High-End/Named-Standard: an)
    const protoChk = document.getElementById('weaponIsPrototype');
    const protoHint = document.getElementById('protoDisabledHint');
    if (protoChk && protoChk.disabled) {
        protoChk.disabled = false;
        protoChk.checked = true;
        if (protoHint) protoHint.style.display = 'none';
    }

    if (typeof updateWeaponCoreLabels === 'function') updateWeaponCoreLabels();
    if (typeof updateCore1Hint === 'function') updateCore1Hint();
    if (typeof updateCore2Hint === 'function') updateCore2Hint();
    if (typeof updateMinorHint === 'function') updateMinorHint();
    if (typeof populateTalentDropdown === 'function') populateTalentDropdown();
}

// Funktion, um die Waffen-Drop-down-Liste basierend auf dem ausgewählten Waffentyp zu aktualisieren
function onWeaponTypeChange() {
    const weaponTypeSelect = document.getElementById('weaponDbTypeSelect');
    const selectedType = weaponTypeSelect.value;
    
    if (selectedType) {
        populateWeaponDropdownByType(selectedType);
    } else {
        // Wenn kein Typ ausgewählt ist, leere die Waffen-Drop-down-Liste
        document.getElementById('weaponDbSelect').innerHTML = '<option value="">— Waffe auswählen —</option>';
    }
}

// Funktion, um die Felder für Name, Typ und Basis-Schaden automatisch auszufüllen
function selectWeaponFromDatabase() {
    const weaponSelect = document.getElementById('weaponDbSelect');
    const selectedOption = weaponSelect.options[weaponSelect.selectedIndex];
    
    if (selectedOption && selectedOption.value) {
        // Setze den Waffen-Namen
        // Namen aus dem Select-Wert extrahieren ("Typ::Name [Rarity]" -> sauberer Name)
        const rawSelected = selectedOption.value.split('::')[1] || selectedOption.value;
        // Rarity-/PTS-Suffix aus dem Select-Wert entfernen: aeltere DB-Optionen
        // tragen ihn im value ("Typ::Name [Exotic]"), was die Namens-Suche in der
        // Waffen-DB sonst fehlschlaegt -> Exoten-Mod-Slots blieben unbelegt.
        const cleanName = rawSelected.replace(/\s*\[(Exotic|Named|PTS)\]/g, '');
        document.getElementById('weaponName').value = cleanName;
        
        // Setze den Waffen-Typ: DB-Optionen tragen den Typ in dataset.type,
        // aeltere "Typ::Name"-Optionen haben ein "::"-Praefix im value.
        const hasTypePrefix = selectedOption.value.includes('::');
        const weaponType = hasTypePrefix ? selectedOption.value.split('::')[0] : (selectedOption.dataset.type || '');
        const weaponTypeSelect = document.getElementById('weaponType');
        // Finde die passende Option im Typ-Drop-down
        for (let i = 0; i < weaponTypeSelect.options.length; i++) {
            if (weaponTypeSelect.options[i].value === weaponType || weaponTypeSelect.options[i].textContent.includes(weaponType)) {
                weaponTypeSelect.selectedIndex = i;
                break;
            }
        }
        // Fruehzeitiger Exoten-Status: Der spaetere DB-basierte Block setzt
        // weaponIsExotic final; hier reicht ein Vorab-Wert aus dem Select-Label,
        // damit der fruehe updateWeaponCoreLabels()-Aufruf die fixen Kern-2-
        // Attribute der Exoten NICHT auf den Gattungsstandard zwingt.
        const earlyExoticEl = document.getElementById('weaponIsExotic');
        if (earlyExoticEl) earlyExoticEl.value = /\[Exotic\]/.test(selectedOption.value) ? 'true' : 'false';
        // Kernattribut-Beschriftungen an die neue Gattung anpassen
        if (typeof updateWeaponCoreLabels === 'function') updateWeaponCoreLabels();
        if (typeof updateCore2Hint === 'function') updateCore2Hint();
        // Talent-Drop-down an die neue Gattung anpassen (Gattungs-Talente)
        if (typeof populateTalentDropdown === 'function') populateTalentDropdown();
        
        // Exotic-/Prototyp-Flags automatisch aus der Datenbank setzen
        // (rarity: "exotic" bzw. "named" aus der Waffen-JSON)
        const dbEntry = weaponsData.weapons.find(x => x.name === cleanName)
            || weaponsData.weapons.find(x => x.name === rawSelected);
        // Fallback: Rarity auch aus dem Option-Dataset nehmen (falls dbEntry fehlt)
        const rarity = dbEntry ? (dbEntry.rarity || 'standard') : (selectedOption.dataset.rarity || 'standard');
        const isExoticWeapon = rarity === 'exotic' || /\[Exotic\]/.test(selectedOption.value);
        const exoticEl = document.getElementById('weaponIsExotic');
        if (exoticEl) exoticEl.value = isExoticWeapon ? 'true' : 'false';
        const protoChk = document.getElementById('weaponIsPrototype');
        // Exoten: Prototyp-Checkbox sperren (Werte sind fix, +50% greift nicht)
        const protoHint = document.getElementById('protoDisabledHint');
        const isNamed = rarity === 'named' || (!isExoticWeapon && /\[Named\]/.test(selectedOption.value));
        if (protoChk) {
            if (isExoticWeapon) {
                // Exoten: fixe Werte – Checkbox deaktivieren, +50% greift nicht
                protoChk.disabled = true;
                protoChk.checked = false;
                if (protoHint) protoHint.style.display = '';
            } else {
                // High-End & Named: Prototyp-Maxwerte (+50%) aktiv und standardmäßig an
                protoChk.disabled = false;
                protoChk.checked = true;
                if (protoHint) protoHint.style.display = 'none';
                if (isNamed && !protoChk.dataset.namedToastShown) {
                    showToast('Named-Waffe erkannt – Prototyp-Maxwerte (+50%) aktiviert.', 'info');
                    protoChk.dataset.namedToastShown = '1';
                }
                if (!isNamed) delete protoChk.dataset.namedToastShown;
            }
        }
        // God-Roll-Hinweise (Kern 1, Kern 2 & Attribut 3) an neue Flags anpassen
        if (typeof updateCore1Hint === 'function') updateCore1Hint();
        if (typeof updateCore2Hint === 'function') updateCore2Hint();
        if (typeof updateMinorHint === 'function') updateMinorHint();

        // Mod-Slot-Anzahl aus der Datenbank übernehmen (Exoten: fixe Mods)
        // Auch ohne dbEntry (Legacy-Select-Werte) über dataset.rarity erkennen.
        const modInfo = parseModSlots(dbEntry || (rarity === 'exotic' ? { rarity: 'exotic' } : null));
        // Exote: fixe Mods aus dem hinterlegten Datensatz laden, falls vorhanden
        if (modInfo.fixed) {
            // Exoten-Daten: vorrangig aus dem JSON-Datensatz ("exotic"-Feld),
            // sonst aus den eingebauten EXOTIC_WEAPONS.
            const exoData = (dbEntry && (dbEntry.exotic || EXOTIC_WEAPONS[dbEntry.name]))
                || EXOTIC_WEAPONS[cleanName] || null;
            currentExoticMods = exoData && exoData.fixedMods ? exoData.fixedMods : null;
            // Talent-Beschreibung der Exotin anzeigen
            const descEl = document.getElementById('talentDescription');
            // Bei Exoten ist ausschließlich das exotische Talent gültig:
            // das allgemeine Talent-Drop-down wird versteckt.
            const talentWrap = document.getElementById('weaponTalentSelectWrap');
            if (talentWrap) talentWrap.style.display = 'none';
            currentExoticTalent = (exoData && exoData.talent && exoData.talent.name) ? exoData.talent.name : '';
            if (exoData && exoData.talent && descEl) {
                // Beschreibungen aus der JSON beginnen oft mit dem Talentnamen
                // ("Big Game Hunter\nWhen scoped...") - führenden Namen entfernen,
                // damit die Anzeige "Name: Beschreibung" ihn nicht doppelt zeigt.
                const tName = exoData.talent.name || '';
                let desc = String(exoData.talent.description || '');
                if (tName && desc.startsWith(tName)) {
                    desc = desc.slice(tName.length).replace(/^[\s\-–—:]+/, '');
                }
                descEl.textContent = (tName ? tName + ': ' : '') + desc;
            } else if (descEl) {
                // Exote ohne hinterlegte Talent-Daten (z.B. Underboss, Fafnir)
                descEl.textContent = 'Exotisches Talent – für diese Waffe sind noch keine Daten hinterlegt.';
            }
        } else {
            // Wechsel von einer Exote auf eine normale Waffe:
            // fix vorbelegte Mod-Werte entfernen, sonst fließen sie weiter in Builds ein.
            if (currentExoticMods) {
                WEAPON_MOD_SLOTS.forEach(slot => {
                    const typeEl = document.getElementById(slot.type);
                    const valEl = document.getElementById(slot.val);
                    if (typeEl) { typeEl.value = ''; typeEl.disabled = false; }
                    if (valEl) { valEl.value = ''; valEl.disabled = false; }
                });
                // Exoten-Sperre der Katalog-Mod-Drop-downs aufheben
                for (const cat of Object.keys(MOD_SLOT_FORM)) {
                    const ms = document.getElementById(MOD_SLOT_FORM[cat].mod);
                    if (ms) ms.disabled = false;
                    const hintEl = document.getElementById(MOD_SLOT_FORM[cat].hint);
                    if (hintEl) hintEl.textContent = '';
                }
            }
            currentExoticMods = null;
            currentExoticTalent = null;
            // Auto-Mods-Schalter wieder freigeben (Exoten sperren ihn)
            const autoChkDbNormal = document.getElementById('autoModsToggle');
            if (autoChkDbNormal) autoChkDbNormal.disabled = false;
            // Talent-Drop-down für normale Waffen wieder einblenden
            const talentWrap2 = document.getElementById('weaponTalentSelectWrap');
            if (talentWrap2) talentWrap2.style.display = '';
            // Exoten-Talentbeschreibung entfernen (gilt nicht fuer normale Waffen)
            const descEl2 = document.getElementById('talentDescription');
            if (descEl2) descEl2.textContent = '';
        }
        updateModSlotUI(modInfo.fixed ? 'fixed' : modInfo.count);
        // Mod-Drop-downs mit passenden Mods füllen (Kaliber/Rail je Waffe).
        // Bei Exoten greifen die fixen Mods aus der Waffen-DB – der Katalog
        // bleibt dort leer/gesperrt, das Typ-Feld liefert die Werte.
        if (!modInfo.fixed) populateModSelects(cleanName, weaponType);

        // Exoten-Status steht jetzt final fest (weaponIsExotic/currentExoticMods):
        // Kern-2-Labels & Attr.-3-Validierung mit dem korrekten Zustand erneut
        // anwenden – der frühere Aufruf lief noch vor dem Exoten-Flag.
        if (typeof updateWeaponCoreLabels === 'function') updateWeaponCoreLabels();
        if (typeof updateCore2Hint === 'function') updateCore2Hint();
        if (typeof updateMinorHint === 'function') updateMinorHint();

        // Maximalwerte vorbelegen: Exoten -> normale God Rolls (15% WD),
        // High-End/Named -> Prototyp-Maxwerte (+50%, 22,5% WD)
        if (typeof prefillMaxAttributeValues === 'function') prefillMaxAttributeValues();

        // ===== Named-Waffen-Validierung =====
        // Named-Waffe mit festem Talent (named.talent): das Talent-Drop-down
        // wird mit dem Named-Talent vorbelegt und gesperrt (analog zur
        // Exoten-Logik, aber sichtbar im Feld „Waffen-Talent").
        // Named-Waffe mit Attribut/Gimmick (z.B. Lexington: +1.782 Basis-
        // Schaden): Talent bleibt frei wählbar, das Named-Attribut wird als
        // Hinweis angezeigt (Basis-Schaden wird automatisch angepasst).
        currentNamedTalent = null;
        currentNamedAttr = null;
        if (!modInfo.fixed && !isExoticWeapon && dbEntry && dbEntry.named) {
            const nd = dbEntry.named;
            const nWrap = document.getElementById('weaponTalentSelectWrap');
            const nDesc = document.getElementById('talentDescription');
            if (nd.talent && nd.talent.name && !nd.talent.todo) {
                // Festes Named-Talent: Drop-down mit dem Talent vorbelegen und
                // sperren (statt verstecken) – so steht es sichtbar im Feld
                // „Waffen-Talent" und wird beim Hinzufügen übernommen.
                currentNamedTalent = nd.talent.label || nd.talent.name;
                if (nWrap) nWrap.style.display = '';
                const nSel = document.getElementById('weaponTalentSelectSelect');
                if (nSel) {
                    let opt = Array.from(nSel.options).find(o => o.value === currentNamedTalent);
                    if (!opt) {
                        opt = document.createElement('option');
                        opt.value = currentNamedTalent;
                        opt.textContent = currentNamedTalent + ' (Named)';
                        opt.dataset.description = (nd.talent.description || '') + (nd.talent.condition ? ' Bedingung: ' + nd.talent.condition : '');
                        nSel.appendChild(opt);
                    }
                    nSel.value = currentNamedTalent;
                    nSel.disabled = true;
                }
                if (nDesc) {
                    let nTxt = currentNamedTalent + ': ' + (nd.talent.description || '');
                    if (nd.talent.value !== null && nd.talent.value !== undefined) {
                        nTxt += '  [+' + nd.talent.value + (nd.talent.unit || '%') + ']';
                    }
                    if (nd.talent.condition) nTxt += '  (Bedingung: ' + nd.talent.condition + ')';
                    if (nd.talent.estimated) nTxt += '  ⚠ Wert geschätzt – bitte im Spiel prüfen.';
                    nDesc.textContent = nTxt;
                }
            } else {
                // Talent frei wählbar, aber Named-Besonderheit als Hinweis zeigen
                if (nWrap) nWrap.style.display = '';
                const nSel2 = document.getElementById('weaponTalentSelectSelect');
                if (nSel2) {
                    // Vorbelegung einer vorherigen Named-Waffe entfernen
                    Array.from(nSel2.options).filter(o => o.textContent.includes(' (Named)')).forEach(o => o.remove());
                    nSel2.disabled = false;
                    nSel2.value = '';
                }
                if (nd.talent && nd.talent.todo) {
                    if (nDesc) nDesc.textContent = 'Named-Waffe: Talent dieser Waffe ist noch nicht hinterlegt – Talent frei wählbar (bitte später ergänzen).';
                } else if (nd.attribute) {
                    currentNamedAttr = {
                        type: nd.attribute.type,
                        value: nd.attribute.value,
                        isPercent: String(nd.attribute.text || '').includes('%'),
                        text: nd.attribute.text || ''
                    };
                    if (nDesc) nDesc.textContent = 'Named-Attribut: ' + (nd.attribute.text || '') + ' – Talent frei wählbar.';
                } else if (nd.gimmick) {
                    if (nDesc) nDesc.textContent = 'Named-Gimmick: ' + (nd.gimmick.text || '') + ' – Talent frei wählbar.';
                } else {
                    if (nDesc) nDesc.textContent = '';
                }
            }
        } else {
            // Keine Named-Waffe (oder Exote/ohne DB-Eintrag): Named-Vorbelegung
            // im Talent-Drop-down entfernen und Auswahl wieder freigeben.
            const nSelCleanup = document.getElementById('weaponTalentSelectSelect');
            if (nSelCleanup) {
                Array.from(nSelCleanup.options).filter(o => o.textContent.includes(' (Named)')).forEach(o => o.remove());
                nSelCleanup.disabled = false;
                nSelCleanup.value = '';
            }
        }

        // Setze den Basis-Schaden (formatiert mit Tausender-Punkten)
        // Wichtig: dataset.baseDmg enthaelt einen Roh-Zahlenwert (z.B. "58897"),
        // KEIN deutsch formatiertes "58.897". parseLocalizedFloat wuerde den
        // Dezimalpunkt als Tausender-Trennzeichen entfernen (58896.5 -> 588965!).
        const baseDmg = selectedOption.dataset.baseDmg || lookupWeaponBaseDmg(cleanName);
        if (baseDmg !== undefined && baseDmg !== null && String(baseDmg) !== '') {
            const rawBase = String(baseDmg);
            const num = rawBase.includes(',') ? parseLocalizedFloat(rawBase) : parseFloat(rawBase);
            if (!isNaN(num)) {
                let finalNum = num;
                // Named-Attribut "baseDmg" automatisch einrechnen
                // (z.B. Lexington: +1.782 Basis-Schaden, The Harvest: +10% Basis-Schaden)
                if (currentNamedAttr && currentNamedAttr.type === 'baseDmg' && currentNamedAttr.value) {
                    if (currentNamedAttr.isPercent) {
                        finalNum = num * (1 + (currentNamedAttr.value / 100));
                        showToast('Named-Attribut: +' + currentNamedAttr.value + '% Basis-Schaden eingerechnet (' + currentNamedAttr.text + ').', 'info');
                    } else {
                        finalNum = num + currentNamedAttr.value;
                        showToast('Named-Attribut: +' + currentNamedAttr.value.toLocaleString('de-DE') + ' Basis-Schaden eingerechnet (' + currentNamedAttr.text + ').', 'info');
                    }
                }
                document.getElementById('weaponBaseDmg').value = finalNum.toLocaleString('de-DE');
            }
        }
    }
}

// ========== MOD-SLOTS JE WAFFE (aus der Waffen-DB) ==========
// Slot-Reihenfolge im Formular (Optik bleibt am längsten sichtbar).
const WEAPON_MOD_SLOTS = [
    { wrap: 'modSlotOpticWrap',       type: 'modOpticType',       val: 'modOpticVal',       label: 'Visier' },
    { wrap: 'modSlotMuzzleWrap',      type: 'modMuzzleType',      val: 'modMuzzleVal',      label: 'Mündung' },
    { wrap: 'modSlotUnderbarrelWrap', type: 'modUnderbarrelType', val: 'modUnderbarrelVal', label: 'Unterlauf' },
    { wrap: 'modSlotMagazineWrap',    type: 'modMagazineType',    val: 'modMagazineVal',    label: 'Magazin' }
];

// ========== EXOTISCHE WAFFEN: TALENT & FIXE MODS ==========
// Datenstruktur pro Exote (Name = Schlüssel, exakt wie in der Waffen-DB):
//   talent:   { name, description }
//   fixedMods: [ { slot: 'optic'|'muzzle'|'underbarrel'|'magazine',
//                  attr: Attribut-Key (siehe EXOTIC_MOD_ATTRS),
//                  value: Zahl, unit: '%' | 'rounds' } ]
const EXOTIC_MOD_ATTRS = {
    chc:        'Kritische Trefferchance',
    chd:        'Kritischer Trefferschaden',
    hsd:        'Kopfschussschaden',
    wd:         'Waffenschaden',
    dta:        'Rüstungsschaden',
    dttooc:     'Schaden gg. ungedeckte Ziele',
    dth:        'Lebenspunktschaden',
    rof:        'Feuerrate',
    reloadSpeed:'Nachladetempo',
    handling:   'Waffenhandhabung',
    accuracy:   'Genauigkeit',
    stability:  'Stabilität',
    range:      'Optimale Reichweite',
    swapSpeed:  'Waffengeschwindigkeit',
    capacity:   'Magazingröße',
    meleeDamage:'Nahkampfschaden',
    magOfHolding: 'Mag of Holding'
};

const EXOTIC_WEAPONS = {
    "Chameleon": {
        talent: { name: "Adaptive Instincts", description: "Adaptive Instincts \nHitting 30 headshots grants 20% critical hit chance and 50% critical hit damage for 45 seconds.\n\nHitting 65 body shots grants 90% weapon damage for 45 seconds.\n\nHitting 20 leg shots grants 150% reload speed for 45 seconds.\n\nBuffs refresh when out of combat." },
        fixedMods: [
            { slot: "optic", attr: "chc", value: 15, unit: "%" },
            { slot: "muzzle", attr: "accuracy", value: 20, unit: "%" },
            { slot: "underbarrel", attr: "stability", value: 10, unit: "%" },
            { slot: "magazine", attr: "capacity", value: 20, unit: "rounds" }
        ]
    },
    "Caduceus": {
        talent: { name: null, description: "Critical Hits repair you and your allies for 1.5% of the hit's dealt damage." },
        fixedMods: [
            { slot: "optic", attr: "chc", value: 10, unit: "%" },
            { slot: "muzzle", attr: "chc", value: 5, unit: "%" },
            { slot: "underbarrel", attr: "chd", value: 5, unit: "%" },
            { slot: "magazine", attr: "capacity", value: 20, unit: "rounds" }
        ]
    },
    "Eagle Bearer": {
        talent: { name: "Eagle Strike", description: "Accuracy increases as you continuously fire, up to 30%.\n\nHeadshot kills grant the Tenacity buff for 15 seconds.\n\nThe strength of Tenacity is increased by 1% for body shots and 5% for headshots. \n\nTenacity\n40-80% of damage taken is delayed until the buff expires." },
        fixedMods: [
            { slot: "optic", attr: "chc", value: 15, unit: "%" },
            { slot: "muzzle", attr: "chd", value: 20, unit: "%" },
            { slot: "underbarrel", attr: "handling", value: 10, unit: "%" },
            { slot: "magazine", attr: "capacity", value: 30, unit: "rounds" }
        ]
    },
    "St. Elmo's Engine": {
        talent: { name: "Actum Est", description: "Actum Est\nShooting an enemy with this weapon will give 1 stack. \n\nAt 100 stacks the next magazine will be 100% filled with shock ammo." },
        fixedMods: [
            { slot: "optic", attr: "chd", value: 15, unit: "%" },
            { slot: "muzzle", attr: "chc", value: 15, unit: "%" },
            { slot: "underbarrel", attr: "handling", value: 10, unit: "%" },
            { slot: "magazine", attr: "capacity", value: 30, unit: "rounds" }
        ]
    },
    "The Bighorn": {
        talent: { name: "Big Game Hunter", description: "Big Game Hunter\nWhen scoped, switches to semi-automatic fire mode, dealing 450% weapon damage with each shot.\n\nHeadshots grant +6% headshot damage. Stacks up to 25 times. Once at full stacks, 10 stacks decay every 4 seconds until all stacks have been removed. Headshots delay decaying of stacks." },
        fixedMods: [
            { slot: "optic", attr: "hsd", value: 40, unit: "%" },
            { slot: "muzzle", attr: "accuracy", value: 20, unit: "%" },
            { slot: "underbarrel", attr: "stability", value: 20, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 20, unit: "%" }
        ]
    },
    "Strega": {
        talent: { name: "Talent Unnerve", description: "Talent Unnerve\nKilling an enemy will apply a mark on every enemy within 20m of it. Multiple marks can be applied to the same enemy. Max number of marks that can be applied to an enemy is 5. all marks on an enemy will disappear 10s after the last one has been applied. Deal +15% Amplified Damage per mark to marked enemies." },
        fixedMods: [
            { slot: "optic", attr: "chc", value: 5, unit: "%" },
            { slot: "muzzle", attr: "chd", value: 5, unit: "%" },
            { slot: "underbarrel", attr: "handling", value: 10, unit: "%" },
            { slot: "magazine", attr: "capacity", value: 20, unit: "rounds" }
        ]
    },
    "Capacitor": {
        talent: { name: "Capacitance", description: "Capacitance\nShooting enemies builds stacks to a cap of 40. Each stack grants 1.5% Skill Damage. After 5 seconds, stacks decay 1 per second.\n\nFor each skill tier gain 7.5% Weapon Damage." },
        fixedMods: [
            { slot: "optic", attr: "chc", value: 10, unit: "%" },
            { slot: "muzzle", attr: "chd", value: 30, unit: "%" },
            { slot: "underbarrel", attr: "handling", value: 10, unit: "%" },
            { slot: "magazine", attr: "capacity", value: 11, unit: "rounds" }
        ],
        notes: "Main attributes:  12% Damage to Armour"
    },
    "Agitator": {
        talent: { name: "Perturb", description: "Perturb\nWhile this weapon is holstered, generate 50% less Threat when shooting. Keeping this weapon holstered for 10s will Prime it.\n\nWhile primed, swapping to this weapon grants +25% Rate of Fire, +30% Weapon Damage and you generate 100% more Threat when Shooting for 20s.\n\nSwapping from this weapon before the timer ends removes the bonuses." },
        fixedMods: [
            { slot: "optic", attr: "chc", value: 10, unit: "%" },
            { slot: "muzzle", attr: "swapSpeed", value: 50, unit: "%" },
            { slot: "magazine", attr: "capacity", value: 20, unit: "rounds" }
        ]
    },
    "Bullet King": {
        talent: { name: "Bullet Hell", description: "Bullet Hell\nThis weapon never needs to be reloaded.\n\nFor every 100 bullets that hit an enemy, replenish some ammo to you and all your allies' reserves." },
        fixedMods: [
            { slot: "muzzle", attr: "chc", value: 15, unit: "%" },
            { slot: "underbarrel", attr: "stability", value: 20, unit: "%" },
            { slot: "magazine", attr: "magOfHolding", value: 0, unit: "special" }
        ]
    },
    "Big Alejandro": {
        talent: { name: "Cover Shooter", description: "Cover Shooter\nEvery bullet fired while in cover increases weapon damage by 1% up to 100%. The bonus lasts for 15 seconds.\n\nGetting a kill with this weapon while in cover resets the duration.\n\nThe bonus damage is canceled by reloading, swapping weapons, or exiting combat." },
        fixedMods: [

        ]
    },
    "Bluescreen": {
        talent: { name: "Disruptor Rounds", description: "Disruptor Rounds\nShooting an enemy marks that enemy and adds a stack to the agent up to a count of 50. Shooting a marked enemy refreshes the mark and adds stacks to the agent. When you deploy a non-shield skill, remove all stacks on agent and all marked targets trigger an effect. \n\n1 - 10 Stacks - Pulse marked targets for 5 seconds \n11 - 25 Stacks - Pulse and Disrupt marked targets for 5 seconds. \n26 - 49 Stacks - Pulse, Disrupt, and Disorient marked targets for 5 seconds. \n50 Stacks - Pulse, Disrupt, and Disorient marked targets and all hostiles within 10 meters of the marked targets for 5 seconds. This effect will trigger immediately if any marked enemy is killed." },
        fixedMods: [
            { slot: "optic", attr: "reloadSpeed", value: 20, unit: "%" },
            { slot: "muzzle", attr: "rof", value: 20, unit: "%" },
            { slot: "underbarrel", attr: "stability", value: 10, unit: "%" },
            { slot: "magazine", attr: "handling", value: 15, unit: "%" }
        ]
    },
    "Iron Lung": {
        talent: { name: "Ardent", description: "Ardent\nShooting heats up the weapon, filling up heat meter. The meter is equivalent to 50% of the weapon's standard Magazine Size.\n\nWhen the meter is full, rounds shot by the weapon will ignite enemies.\n\nWhen not shooting, the meter depletes over time. Reloading or swapping the weapon fully depletes the meter." },
        fixedMods: [
            { slot: "optic", attr: "chd", value: 10, unit: "%" },
            { slot: "underbarrel", attr: "chd", value: 10, unit: "%" },
            { slot: "magazine", attr: "capacity", value: 35, unit: "rounds" }
        ]
    },
    "Pakhan": {
        talent: { name: "Pakhan", description: "Pakhan\nEach kill with this weapon gains a stack of 75% Base Magazine Size increase to the next magazine, up to 4 stacks." },
        fixedMods: [
            { slot: "optic", attr: "wd", value: 15, unit: "%" },
            { slot: "muzzle", attr: "chc", value: 15, unit: "%" },
            { slot: "underbarrel", attr: "reloadSpeed", value: 10, unit: "%" },
            { slot: "magazine", attr: "capacity", value: 20, unit: "rounds" }
        ]
    },
    "Pestilence": {
        talent: { name: "Plague of the Outcasts", description: "Plague of the Outcasts \nHits apply a debuff dealing 100% weapon damage over 10s. This stacks up to 50 times.\n\nWhenever an enemy dies with this debuff, the stacks are transferred to a nearby enemy within 25m." },
        fixedMods: [
            { slot: "muzzle", attr: "accuracy", value: 10, unit: "%" },
            { slot: "underbarrel", attr: "stability", value: 10, unit: "%" },
            { slot: "magazine", attr: "rof", value: 10, unit: "%" }
        ]
    },
    "Backfire": {
        talent: { name: "Payment in kind", description: "Payment in kind\nDealing damage to enemies adds a stack of 2% Critical Hit Damage, up to 100 stacks, lasting 10s.\n\nOn reload apply a 10s bleed to yourself, which deals 0.5% armor damage per stack." },
        fixedMods: [
            { slot: "optic", attr: "chc", value: 15, unit: "%" },
            { slot: "muzzle", attr: "chd", value: 15, unit: "%" },
            { slot: "underbarrel", attr: "stability", value: 10, unit: "%" },
            { slot: "magazine", attr: "capacity", value: 20, unit: "rounds" }
        ]
    },
    "The Chatterbox": {
        talent: { name: "Incessant Chatter", description: "Incessant Chatter\nWhen you reload, rate of fire is increased by 25% for each enemy within 15m for the duration of that magazine.\n\nMax stacks: 5\n\nKills refill 50% of your magazine." },
        fixedMods: [
            { slot: "optic", attr: "chc", value: 15, unit: "%" },
            { slot: "muzzle", attr: "chd", value: 15, unit: "%" },
            { slot: "underbarrel", attr: "handling", value: 10, unit: "%" },
            { slot: "magazine", attr: "capacity", value: 10, unit: "rounds" }
        ]
    },
    "Lady Death": {
        talent: { name: "Breathe Free", description: "Breathe Free \nWhen moving, gain 4 stacks per second, or 8 stacks if sprinting. Max stack is equal to the weapon's Magazine Size.\n\nEach round fired consumes a stack, amplifying damage by 75%.\n\nKills grant +20% movement speed for 10s." },
        fixedMods: [
            { slot: "optic", attr: "chc", value: 15, unit: "%" },
            { slot: "muzzle", attr: "chd", value: 10, unit: "%" },
            { slot: "underbarrel", attr: "meleeDamage", value: 500, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 10, unit: "%" }
        ]
    },
    "Ouroboros": {
        talent: { name: "Rule them all", description: "Rule them all\nWhen the agent has a Status Effect applied to them, 50% of the ammo in their next magazine will apply the same Status Effect to their targets.\n\nThis effect will only occur during combat." },
        fixedMods: [
            { slot: "optic", attr: "chd", value: 10, unit: "%" },
            { slot: "muzzle", attr: "rof", value: 10, unit: "%" },
            { slot: "underbarrel", attr: "chc", value: 10, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 25, unit: "%" }
        ]
    },
    "Oxpecker": {
        talent: { name: "Symbiosis", description: "Symbiosis\nWhile having a Shield deployed, lose Shield Health at a rate of 10% per second.\nYour Shield recieves repairs of 25% of the damage dealt by this weapon." },
        fixedMods: [
            { slot: "optic", attr: "range", value: 50, unit: "%" },
            { slot: "muzzle", attr: "capacity", value: 10, unit: "rounds" },
            { slot: "underbarrel", attr: "chc", value: 15, unit: "%" }
        ]
    },
    "Lullaby": {
        talent: { name: "Sandman", description: "Sandman\nMelee attacks instantly kill non-elite enemies.\n\nCooldown: 15s." },
        fixedMods: [
            { slot: "optic", attr: "accuracy", value: 15, unit: "%" },
            { slot: "underbarrel", attr: "range", value: 25, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 15, unit: "%" }
        ]
    },
    "Sweet Dreams": {
        talent: { name: "Sandman", description: "Sandman\nMelee attacks instantly kill non-elite enemies.\n\nCooldown: 15s." },
        fixedMods: [
            { slot: "optic", attr: "accuracy", value: 15, unit: "%" },
            { slot: "muzzle", attr: "reloadSpeed", value: 15, unit: "%" },
            { slot: "underbarrel", attr: "range", value: 25, unit: "%" }
        ]
    },
    "Overlord": {
        talent: { name: "Capitulate", description: "Capitulate\nHitting an enemy applies -4% Movement Speed for each pellet hit for 5 seconds. Shooting the enemy again will reapply the stacks." },
        fixedMods: [
            { slot: "optic", attr: "chd", value: 15, unit: "%" },
            { slot: "underbarrel", attr: "stability", value: 20, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 15, unit: "%" }
        ]
    },
    "The Sheriff": {
        talent: { name: "Autentico", description: "Autentico +35 Weapon Damage. +100% accuracy. No Damage Drop Off. These bonus are built into the weapons base stats" },
        fixedMods: [

        ]
    },
    "Scorpio": {
        talent: { name: "Septic Shock", description: "Septic Shock\nShooting a target applies stacks of venom, which last for 10s. Increasing stacks adds more severe debuffs to the target.\n\n2 - Poison\n4 - Disorient \n6 - Shock \n9 - Target takes additional 20% damage (from all sources). Stacks no longer increase.\n\nDuration of Status Effects is based on percentage of pellets hit on applying shot." },
        fixedMods: [
            { slot: "optic", attr: "chc", value: 10, unit: "%" },
            { slot: "muzzle", attr: "stability", value: 10, unit: "%" },
            { slot: "underbarrel", attr: "handling", value: 10, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 10, unit: "%" }
        ]
    },
    "Ruthless": {
        talent: { name: "Binary Trigger", description: "Binary Trigger\nThis weapon fires on trigger pull and release.\n\nIf both bullets hit the same enemy, gain a stack.\n\nAt 7 stacks, shooting an enemy deals 500% amplified damage and creates a 7m explosion dealing 500% weapon damage, consuming the stacks." },
        fixedMods: [
            { slot: "optic", attr: "accuracy", value: 15, unit: "%" },
            { slot: "muzzle", attr: "stability", value: 15, unit: "%" },
            { slot: "underbarrel", attr: "handling", value: 15, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 10, unit: "%" }
        ]
    },
    "Merciless": {
        talent: { name: "Binary Trigger", description: "Binary Trigger\nThis weapon fires on trigger pull and release.\n\nIf both bullets hit the same enemy, gain a stack.\n\nAt 7 stacks, shooting an enemy deals 500% amplified damage and creates a 7m explosion dealing 500% weapon damage, consuming the stacks." },
        fixedMods: [
            { slot: "optic", attr: "accuracy", value: 15, unit: "%" },
            { slot: "muzzle", attr: "stability", value: 15, unit: "%" },
            { slot: "underbarrel", attr: "handling", value: 15, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 10, unit: "%" }
        ]
    },
    "Diamondback": {
        talent: { name: "Agonizing Bite", description: "Agonizing Bite\nDiamondback randomly marks an enemy within 20m. If no enemies are within 20m, it marks the enemy closest to you.\n\nHitting that enemy consumes the mark, guaranteeing a critical hit with damage amplified by 20%. \n\nAfter hitting a mark, all shots fired are guaranteed critical hits for 5 seconds. \n\nA new random enemy is marked afterwards and whenever you reload." },
        fixedMods: [
            { slot: "optic", attr: "accuracy", value: 10, unit: "%" },
            { slot: "muzzle", attr: "chd", value: 15, unit: "%" },
            { slot: "underbarrel", attr: "stability", value: 10, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 10, unit: "%" }
        ]
    },
    "Doctor Home": {
        talent: { name: "Doctor Home", description: "Doctor Home\nShooting an enemy with this weapon will apply a mark for 5 seconds.\nIf a marked target is killed it will give a 10% armor repair kit which applies to the whole party.\nThe kit will not give bonus armor." },
        fixedMods: [
            { slot: "optic", attr: "accuracy", value: 10, unit: "%" },
            { slot: "muzzle", attr: "stability", value: 10, unit: "%" },
            { slot: "underbarrel", attr: "handling", value: 10, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 10, unit: "%" }
        ]
    },
    "Bittersweet": {
        talent: { name: "Transfusion", description: "Transfusion\nHitting headshots builds stacks up to a max of 8. When shooting an Ally or Skill, repair them for 50% of the shot damage for each stack.\n\nHealed Allies receive 200% of your Repair Skills bonus as Bonus Armor for each stack for 10 seconds.\n\nAll hits become guaranteed headshots for 8 seconds after healing an Ally or Skill while at maximum stacks." },
        fixedMods: [
            { slot: "optic", attr: "hsd", value: 5, unit: "%" },
            { slot: "underbarrel", attr: "hsd", value: 5, unit: "%" },
            { slot: "magazine", attr: "capacity", value: 10, unit: "rounds" }
        ]
    },
    "The Ravenous": {
        talent: { name: "Geri and Freki", description: "Geri and Freki\nOn trigger pull, fire both barrels at once.\n\nWhen fired from the right shoulder, hits add offensive primers, and defensive primers when fired drom the left shoulder.\n\nHits from one shoulder will detonate all of the opposite shoulder's primers when present.\n\nWhen detonated, each offensive primer deals 100% weapon damage, while each defensive primer grants +4% bonus armor and +10% amplified damage to armor plates for 5s.\n\nPrimer effectiveness is doubled at 10 stacks." },
        fixedMods: [
            { slot: "optic", attr: "chc", value: 5, unit: "%" },
            { slot: "muzzle", attr: "stability", value: 10, unit: "%" },
            { slot: "underbarrel", attr: "chd", value: 5, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 10, unit: "%" }
        ]
    },
    "Vindicator": {
        talent: { name: "Ortiz Assault Interface", description: "Ortiz Assault Interface\nWhile scoped, the weapon will highlight a random body section of each enemy.\nThe weapon amplifies damage by +60% Weapon Damage to highlighted body sections." },
        fixedMods: [
            { slot: "optic", attr: "accuracy", value: 15, unit: "%" },
            { slot: "muzzle", attr: "range", value: 10, unit: "%" },
            { slot: "underbarrel", attr: "stability", value: 15, unit: "%" },
            { slot: "magazine", attr: "capacity", value: 5, unit: "rounds" }
        ]
    },
    "Sacrum Imperium": {
        talent: { name: "The Trap", description: "The Trap\nTags enemies when in scope (maximum 10) If Agent kills any marked target with a headshot, all other targets will have 50% (20% PVP) movement speed and receive burn for 10 seconds. \n\nCooldown 30 seconds. \n\nKilling another enemy with a headshot will shorten the cooldown for 10 seconds. \n\nTargets are marked after 1 seconds in crosshair." },
        fixedMods: [
            { slot: "optic", attr: "hsd", value: 20, unit: "%" },
            { slot: "muzzle", attr: "range", value: 20, unit: "%" },
            { slot: "underbarrel", attr: "stability", value: 20, unit: "%" },
            { slot: "magazine", attr: "hsd", value: 10, unit: "%" }
        ]
    },
    "Dread Edict": {
        talent: { name: "Full Stop", description: "Full Stop\nShooting enemies builds stacks to a cap of 20. Headshots grant 2 stacks. Each stack grants 2% Weapon Damage and 5% Headshot Damage. On reload, clear all stacks and gain 5% of your max armor as temp armor for 10 seconds for each stack removed. \n\nHeadshot kills with Dread Edict restore all bullets in the magazine. This does not count as a reload." },
        fixedMods: [
            { slot: "optic", attr: "hsd", value: 40, unit: "%" },
            { slot: "muzzle", attr: "chc", value: 10, unit: "%" },
            { slot: "underbarrel", attr: "stability", value: 10, unit: "%" },
            { slot: "magazine", attr: "handling", value: 15, unit: "%" }
        ]
    },
    "Nemesis": {
        talent: { name: "Electromagnetic Accelerator", description: "Electromagnetic Accelerator\nShots fired deal 0-100% weapon damage based on how long the trigger is held before releasing." },
        fixedMods: [
            { slot: "optic", attr: "hsd", value: 45, unit: "%" },
            { slot: "muzzle", attr: "chd", value: 5, unit: "%" },
            { slot: "underbarrel", attr: "handling", value: 5, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 10, unit: "%" }
        ]
    },
    "Shroud": {
        talent: { name: "High Priority Target", description: "High Priority Target\nAmplifies Weapon Damage by 125% to the highest ranking enemies currently in combat, as per the Tier hierarchy.\n\nTier 1: Hunter, Rogue, Leader, Tank, Shield, Heavy Weapons, RPG, Medic, Controller, Warhound, Marauder.\nTier 2: Support, Engineer, Bodyguard, Immobilizer, Bomber, Mini Tank, Drone Operator.\nTier 3: Any other enemy or skill proxy.\n\nEditor's note: 2.25x amplifier includes Headhunter bonus, for more details read Headhunter Synergy Guide." },
        fixedMods: [
            { slot: "optic", attr: "hsd", value: 25, unit: "%" },
            { slot: "muzzle", attr: "hsd", value: 20, unit: "%" },
            { slot: "underbarrel", attr: "chc", value: 5, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 25, unit: "%" }
        ]
    },
    "Mantis": {
        talent: { name: "In Plain Sight", description: "In Plain Sight\nYour scoped view displays additional information about enemies not targetting you. \n\nHeadshot and weakpoint damage against enemies not targetting you is amplified by 50%.\n\nHeadshot kills reset the cooldown of your Decoy Skill. This bonus will wait until the Decoy goes on cooldown if currently active.\n\nEditor's note: 1.5x amplifier excludes Headhunter bonus, for more details read Headhunter Synergy Guide." },
        fixedMods: [
            { slot: "optic", attr: "hsd", value: 40, unit: "%" },
            { slot: "muzzle", attr: "chc", value: 5, unit: "%" },
            { slot: "underbarrel", attr: "stability", value: 10, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 10, unit: "%" }
        ]
    },
    "Liberty": {
        talent: { name: "Faster than Reloading", description: "Faster than Reloading\n\nHaving this weapon holstered for 5s reloads and primes it. While primed, swapping to this weapon reloads you Primary and Secondary weapons and grants +20% Rate of Fire and +50% Weapon Damage until its magazine is emptied. Reloading or swapping from this weapon before its magazine is emptied will remove its stat bonuses." },
        fixedMods: [
            { slot: "optic", attr: "chd", value: 10, unit: "%" },
            { slot: "underbarrel", attr: "swapSpeed", value: 50, unit: "%" },
            { slot: "magazine", attr: "chc", value: 10, unit: "%" }
        ]
    },
    "Whiplash": {
        talent: { name: "Faster than Reloading", description: "Faster than Reloading\n\nHaving this weapon holstered for 5s reloads and primes it. While primed, swapping to this weapon reloads you Primary and Secondary weapons and grants +20% Rate of Fire and +50% Weapon Damage until its magazine is emptied. Reloading or swapping from this weapon before its magazine is emptied will remove its stat bonuses." },
        fixedMods: [
            { slot: "optic", attr: "chd", value: 10, unit: "%" },
            { slot: "underbarrel", attr: "swapSpeed", value: 50, unit: "%" },
            { slot: "magazine", attr: "chc", value: 10, unit: "%" }
        ]
    },
    "Busy Little Bee": {
        talent: { name: "Busy Little Bee", description: "Busy Little Bee\n\nEach shot to a different target will give 1 stack, up to 10, each stack will give 20% weapon damage increase. \n\nStacks will activate once the agent switches weapon and will last for 10 seconds.\n\nEditor's note: each stack adds to an amplifier, (1 + 0.2 * n) where n is number of stacks, n from 1 to 10." },
        fixedMods: [
            { slot: "optic", attr: "range", value: 25, unit: "%" },
            { slot: "muzzle", attr: "stability", value: 10, unit: "%" },
            { slot: "underbarrel", attr: "chc", value: 5, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 10, unit: "%" }
        ]
    },
    "Regulus": {
        talent: { name: "Regicide", description: "Regicide\nHeadshot Kills create a 5m explosion, dealing 400% weapon damage and applying bleed to all enemies hit." },
        fixedMods: [
            { slot: "muzzle", attr: "accuracy", value: 20, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 10, unit: "%" }
        ]
    },
    "Tempest": {
        talent: { name: "Restrained", description: "Restrained:\nThe pistol is fully automatic and deals +25% Amplified Damage for 20s after your Shield gets broken." },
        fixedMods: [
            { slot: "muzzle", attr: "chc", value: 15, unit: "%" },
            { slot: "magazine", attr: "stability", value: 50, unit: "%" }
        ]
    },
    "Mosquito": {
        talent: { name: "Mosquito Song", description: "Mosquito Song\nHitting an enemy applies a stack. Stacks are shared between players. \n\nAt 5 stacks, the enemy will forcefully target the last player to apply a stack for 5s and take 25% more damage to armor. \n\nStacks deplete every 5s. Activating the effect on an enemy will remove all stacks from other enemies.\n\nEditor's note: the \"damage to armor\" taken debuff works similarly to Sledgehammer, in that it is an amplifier that applies to both armor and armor plating." },
        fixedMods: [
            { slot: "muzzle", attr: "accuracy", value: 15, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 15, unit: "%" }
        ]
    }
};
EXOTIC_WEAPONS['Caduceus (MK16) (PTS)'] = EXOTIC_WEAPONS['Caduceus'];

// ========== WAFFEN-SLOT-TYPEN (aus Davids Waffen-/Mod-Tabelle) ==========
// Je Waffe: welche Mod-Slot-Typen tatsaechlich verfuegbar sind.
// Format: "optics|magazin|unterlauf|muedung" (leer = Slot existiert nicht).
// Codes siehe Decoder-Maps unten. Wird eine Waffe hier gefunden, zeigt das
// Formular NUR die passenden Mods an; sonst gilt die alte Typ-Heuristik.
const _OST = {
    ILS: ['Iron Sights Slot', 'Long/Short Optics Rail'],
    LS:  ['Long/Short Optics Rail'],
    MLS: ['Micro Optics Rail', 'Neutral Optics Rail', 'Long/Short Optics Rail'],
    MS:  ['Short Optics Rail', 'Micro Optics Rail', 'Short/Micro Optics Rail', 'Neutral Optics Rail'],
    M:   ['Micro Optics Rail', 'Neutral Optics Rail']
};
const _UBT = {
    SLS: ['Side Slot', 'Long Underbarrel Rail', 'Long/Short Underbarrel Rail'],
    SS:  ['Side Slot', 'Long/Short Underbarrel Rail'],
    S:   ['Side Slot'],
    LS:  ['Long Underbarrel Rail', 'Long/Short Underbarrel Rail'],
    G:   ['Gadget Slot']
};
const _MAGT = {
    '556': ['5.56 Magazine Slot'], '762': ['7.62 Magazine Slot'], '9': ['9mm Magazine Slot'],
    '45': ['.45 ACP Magazine Slot'], 'belt': ['Ammunition Belt Slot'], 'mm762': ['Marksman 7.62 Magazine Slot'],
    'int': ['Integrated Magazine Slot'], 'pist': ['Pistol Magazine Slot'], 'rev': ['Revolver Drum Slot'],
    'tub': ['Tubular Magazine Slot']
};
const _MUZT = {
    '556': ['5.56 Muzzle Slot'], '762': ['7.62 Muzzle Slot'], '9': ['9mm Muzzle Slot'], '45': ['.45 Muzzle Slot']
};
const WEAPON_SLOT_TYPES_RAW = {
    // --- Sturmgewehre (AR) ---
    "ACR": "ILS|556|SLS|556", "ACR-E": "ILS|556|SLS|556", "Steel & Sons ACR": "ILS|556|SLS|556",
    "F2000": "ILS|556||556", "F2000 Replica": "ILS|556||556", "Shield Splinterer": "ILS|556||556",
    "AUG A3-CQC": "ILS|556|SS|556", "Invisible Hand": "ILS|556|SS|556",
    "AK-M": "LS|762|SS|", "First Sight (AK-M)": "LS|762|SS|",
    "Military AK-M": "LS|762|SLS|762", "Black Market AK-M": "LS|762|SLS|762", "Black Market AK-M Replica": "LS|762|SLS|762",
    "FAL": "LS|762|SLS|762", "FAL SA-58": "LS|762|SLS|762", "FAL SA-58 Para": "LS|762|SLS|762", "FAL SA-58 Para Replica": "LS|762|SLS|762",
    "FAMAS 2010": "LS|556|SS|556", "FAMAS 2010 Replica": "LS|556|SS|556", "Huntsman": "LS|556|SS|556", "Burn Out": "LS|556|SS|556",
    "Military G36": "LS|556|SLS|556", "G36 C": "LS|556|SS|556", "G36 Enhanced": "LS|556|SLS|556", "G36 Enhanced Replica": "LS|556|SLS|556",
    "Police M4": "LS|556|SLS|556", "Police M4 Replica": "LS|556|SLS|556", "Pyromaniac": "LS|556|SLS|556", "Lexington": "LS|556|SLS|556",
    "Carbine 7": "LS|556|SLS|556", "The Drill": "LS|556|SLS|556",
    "Honey Badger": "LS|556|SLS|", "Savage Wolverine": "LS|556|SLS|",
    "Military P416": "ILS|556|SLS|556", "Custom P416 G3": "ILS|556|SLS|556",
    "Mk16": "ILS|556|SLS|556", "SOCOM Mk16": "ILS|556|SLS|556", "Tactical Mk 16": "ILS|556|SLS|556", "Tactical Mk 16 Replica": "ILS|556|SLS|556",
    "CTAR-21": "MS|556|S|556", "The Railsplitter": "MS|556|S|556",
    "Sig Sauer 556": "LS|556|SS|556", "Mechanical Animal": "LS|556|SS|556",
    "PDR": "MS|556||556", "Test Subject": "MS|556||556", "First Bloom": "MS|556||556",
    "TKB-408": "LS|762|SLS|762", "Kingbreaker": "LS|762|SLS|762",
    // --- LMGs ---
    "MG5": "LS|belt|SS|", "Infantry MG5": "LS|belt|SS|762", "Infantry MG5 Replica": "LS|belt|SS|762",
    "Stoner LAMG": "LS|belt|SS|556", "Quiet Roar": "LS|belt|SS|556",
    "M249 B": "LS|belt|SLS|556", "Tactical M249 Para": "LS|belt|SLS|556",
    "Military MK46": "LS|belt|SLS|556", "Military MK46 Replica": "LS|belt|SLS|556",
    "Classic M60": "LS|belt|SLS|", "Classic M60 Replica": "LS|belt|SLS|",
    "Military M60 E4": "LS|belt|SLS|762", "Black Market M60 E6": "LS|belt|SLS|762", "Black Market M60 E6 Replica": "LS|belt|SLS|762",
    "Classic RPK-74": "LS|762|SLS|762", "Military RPK-74": "LS|762|SLS|762",
    "Black Market RPK-74": "MLS|762|SLS|762", "Black Market RPK-74 Replica": "LS|762|SLS|762",
    "New Reliable (Black Market RPK-74)": "LS|762|SLS|762",
    "Military L86 LSW": "LS|556|SS|556", "Custom L86 A2": "LS|556|SLS|556", "Custom L86 A2 Replica": "LS|556|SLS|556",
    "IWI NEGEV": "MS|belt|SLS|762", "Carnage": "MS|belt|SLS|762",
    "HK GR9": "|belt|SS|762", "Dare": "|belt|SS|762",
    // --- Schrotflinten ---
    "ACS-12": "MS||SLS|", "Rock n' Roll": "MS||SLS|",
    "Black Market SASG-12 S": "LS||SLS|", "Black Market SASG-12 S Replica": "LS||SLS|",
    "SASG-12": "MS||SLS|", "Tactical SASG-12 K": "MS||SLS|",
    "Marine Super 90": "LS|tub|SLS|", "Super 90": "LS|tub|SLS|", "Super 90 Replica": "LS|tub|SLS|",
    "Tactical Super 90 SBS": "LS|tub|SLS|", "Tactical Super 90 SBS Replica": "LS|tub|SLS|",
    "Enforcer (Super 90)": "MS|tub|SLS|",
    "Double Barrel Shotgun": "|||", "Double Barrel Shotgun Replica": "|||",
    "Sawed-Off Double Barrel": "|||", "Backup Boomstick": "|||", "Firestarter": "|||", "Boomstick": "|||",
    "KSG Shotgun": "MS|tub|SLS|", "The Send-Off": "MS|tub|SLS|",
    "Custom M870 MCS": "LS|tub|SLS|", "Custom M870 MCS Replica": "LS|tub|SLS|",
    "M870 Express": "LS|tub|SLS|", "M870 Express Replica": "LS|tub|SLS|",
    "Military M870": "MS|tub|SLS|", "Police M870": "MS|tub|SLS|",
    "SPAS-12": "|tub||", "SPAS-12 Replica": "|tub||",
    "Six12": "MS|tub|SLS|", "The Mop": "MS|tub|SLS|",
    // --- MPs (SMG) ---
    "Converted SMG-9": "MS|9||9", "Converted SMG-9 Replica": "MS|9||9",
    "Converted SMG-9 A2": "MS|9|SS|9",
    "MP5A2": "LS|9|SS|9", "MP5-N": "LS|9|SLS|9", "MP5 ST": "ILS|9|SLS|9", "MP5 ST Replica": "ILS|9|SLS|9",
    "PP-19": "LS|||9", "Enhanced PP-19": "LS|||9",
    "AUG A3 Para XS": "ILS|9|SLS|9", "Enhanced AUG A3P": "ILS|9|SLS|9", "Tactical AUG A3P": "ILS|9|SS|9", "Tactical AUG A3P Replica": "ILS|9|SS|9",
    "Tactical Vector SBR 9mm": "ILS|9|SS|9", "Vector SBR 9mm": "ILS|9|SS|9",
    "Vector SBR .45 ACP": "ILS|45|SLS|45", "Vector SBR .45 ACP Replica": "ILS|45|SLS|45",
    "MP7": "LS||SS|556", "Swap Chain": "LS||SS|",
    "Black Market T821": "MS|9|SS|9", "Black Market T821 Replica": "MS|9|SS|9", "Police T821": "MS|9|SS|9",
    "Police UMP-45": "LS|45|SLS|45", "Tactical UMP-45": "LS|45|SLS|45", "Tactical UMP-45 Replica": "LS|45|SLS|45",
    "M1928": "|45||", "Tommy Gun": "|||",
    "P90": "MS|||556", "P90 Replica": "MS|||556", "Emeline's Guard": "MS|||556",
    "MPX": "LS|9|SS|9", "Safety Distance": "LS|9|SS|9", "The Apartment": "LS|9|SS|9",
    "CMMG Banshee": "MS|9|SS|9", "The Grudge": "MS|9|SS|9",
    // --- Gewehre (Rifle) ---
    "ACR SS": "LS|762|SLS|762", "UIC15 MOD2": "LS|556|SLS|556",
    "M16A2": "MS|556||556", "M16A2 Replica": "MS|556||556",
    "Classic M1A": "LS|mm762|SLS|", "Socom M1A": "LS|mm762|SLS|762", "M1A CQB": "LS|mm762|SLS|762", "M1A CQB Replica": "LS|mm762|SLS|762",
    "Lightweight M4": "ILS|556|SLS|556",
    "LVOA-C": "ILS|556|SLS|556", "LVOA-C Replica": "ILS|556|SLS|556",
    "Urban MDR": "LS|762|SLS|762", "Urban MDR Replica": "LS|762|SLS|762",
    "Military MK17": "LS|762|SLS|762", "Police MK17": "LS|762|SLS|762", "Police MK17 Replica": "LS|762|SLS|762",
    "SIG 716 CQB": "LS|762|SS|", "SIG 716": "LS|762|SLS|762", "SIG 716 Replica": "LS|762|SLS|762",
    "USC .45 ACP": "LS|45|SLS|", "USC .45 ACP Replica": "LS|45|SLS|",
    "The Virginian": "|tub||",
    "Resolute Mk47": "ILS|762|SLS|762", "Harmony": "ILS|762|SLS|762",
    // --- MMRs ---
    "G28": "LS|762|SLS|762",
    "SOCOM MK20 SSR": "ILS|762|SLS|762", "SOCOM MK20 SSR Replica": "ILS|762|SLS|762", "The Darkness": "ILS|762|SLS|762",
    "M700 Carbon": "LS|mm762|SLS|762", "M700 Carbon Replica": "LS|mm762|SLS|762",
    "M700 Tactical": "LS|mm762|S|762",
    "Model 700": "LS|int||762", "Model 700 Replica": "LS|int||762",
    "Paratrooper SVD": "LS|mm762|SS|762", "Surplus SVD": "LS|mm762|SS|762",
    "Covert SRS": "ILS|mm762|SS|762", "SRS A1": "ILS|mm762|SLS|762", "SRS A1 Replica": "ILS|mm762|SLS|762",
    "Classic M44 Carbine": "LS|int|SS|", "Classic M44 Carbine Replica": "LS|int|SS|",
    "Hunting M44": "LS|int|SLS|762",
    "Custom M44": "LS|mm762|SLS|762", "Custom M44 Replica": "LS|mm762|SLS|762",
    "SR-1": "ILS|mm762|SS|762", "SR-1 Replica": "ILS|mm762|SS|762", "Adrestia": "ILS|mm762|SS|762",
    "Tactical .308": "LS|mm762|SLS|762", "Scalpel": "LS|mm762|SLS|762",
    // --- Pistolen ---
    "Px4 Storm Type F": "|pist|G|9",
    "Px4 Storm Type T": "|pist|G|45", "Px4 Storm Type T Replica": "|pist|G|45",
    "X-45": "|pist|G|45", "X-45 Tactical": "|pist|G|45", "X-45 Tactical Replica": "|pist|G|45",
    "Military M9": "|pist||9", "Military M9 Replica": "|pist||9",
    "Officer's M9 A1": "M|pist|G|9",
    "D50": "MS|||", "Survivalist D50": "MS|||", "Rabid D50": "MS|||",
    "M1911": "|pist||", "M45A1": "M|pist|G|45", "Tactical M1911": "M|pist|G|45", "Tactical M1911 Replica": "M|pist|G|45",
    "Maxim 9": "|pist||", "First Wave PF45": "|pist|G|", "Custom PF45": "M|pist|G|45",
    "93R": "|pist||9", "Sharpshooter's 93R": "|pist||9",
    "Diceros": "|rev|G|", "Diceros Replica": "|rev|G|",
    "Snubnosed Diceros": "|rev||", "Diceros Special (Diceros)": "MS|rev|G|",
    "586 Magnum": "MS|rev||", "Police 686 Magnum": "MS|rev||", "Police 686 Magnum Replica": "MS|rev||",
    "P320 X Compact": "M|pist|G|9", "Kard-45": "M|pist|G|9"
};
const WEAPON_SLOT_TYPES = {};
for (const [k, v] of Object.entries(WEAPON_SLOT_TYPES_RAW)) {
    const [o, m, u, z] = v.split('|');
    WEAPON_SLOT_TYPES[k] = {
        optic: _OST[o] || [],
        magazine: _MAGT[m] || [],
        underbarrel: _UBT[u] || [],
        muzzle: _MUZT[z] || []
    };
}
// Global: aktuell erlaubte Mod-Gruppen der gewaehlten Waffe (null = unbekannt -> keine Einschraenkung)
let currentWeaponSlotGroups = null;

function lookupWeaponSlotEntry(name) {
    if (!name) return null;
    const n = String(name).trim();
    if (WEAPON_SLOT_TYPES[n]) return WEAPON_SLOT_TYPES[n];
    // Named-Variante mit Basis in Klammern: "Lud (SOCOM Mk16)" -> "SOCOM Mk16"
    const m = n.match(/\(([^)]+)\)/);
    if (m && WEAPON_SLOT_TYPES[m[1]]) return WEAPON_SLOT_TYPES[m[1]];
    // Replikas: "Tactical Mk 16 Replica" -> "Tactical Mk 16"
    if (/ Replica$/.test(n) && WEAPON_SLOT_TYPES[n.replace(/ Replica$/, '')]) return WEAPON_SLOT_TYPES[n.replace(/ Replica$/, '')];
    return null;
}
function getWeaponSlotGroups(name) {
    const e = lookupWeaponSlotEntry(name);
    return e ? { optic: e.optic, magazine: e.magazine, underbarrel: e.underbarrel, muzzle: e.muzzle } : null;
}

// ========== MOD-DB UPDATE v1 (Davids Mod-Tabelle) ==========
// 1) Korrigierte Fixed-Mods (Werte aus der neuen Mod-Tabelle):
const EXOTIC_FIXED_MODS_PATCH = {
    "Eagle Bearer": [
        { slot: "optic", attr: "chc", value: 10, unit: "%" },
        { slot: "magazine", attr: "capacity", value: 30, unit: "rounds" },
        { slot: "underbarrel", attr: "handling", value: 10, unit: "%" },
        { slot: "muzzle", attr: "chd", value: 15, unit: "%" }
    ],
    "The Bighorn": [
        { slot: "optic", attr: "hsd", value: 30, unit: "%" },
        { slot: "magazine", attr: "reloadSpeed", value: 10, unit: "%" },
        { slot: "underbarrel", attr: "stability", value: 10, unit: "%" },
        { slot: "muzzle", attr: "accuracy", value: 10, unit: "%" }
    ]
};
for (const [name, mods] of Object.entries(EXOTIC_FIXED_MODS_PATCH)) {
    if (EXOTIC_WEAPONS[name]) EXOTIC_WEAPONS[name].fixedMods = mods;
    if (typeof weaponsData !== 'undefined' && weaponsData.weapons) {
        for (const w of weaponsData.weapons) {
            if (w.name === name && w.exotic) w.exotic.fixedMods = mods;
        }
    }
}

// 2) Fehlende Exotics aus der Mod-Tabelle ergaenzen (Fixed-Mods + Kurz-Talent):
Object.assign(EXOTIC_WEAPONS, {
    "Pestilence": {
        talent: { name: "Plague of the Outcasts", description: "Plague of the Outcasts\nHits apply a stack of Pestilence. When an enemy with 7 stacks dies, a toxic cloud is created, dealing damage over time to all enemies in it." },
        fixedMods: [
            { slot: "magazine", attr: "rof", value: 10, unit: "%" },
            { slot: "underbarrel", attr: "stability", value: 10, unit: "%" },
            { slot: "muzzle", attr: "accuracy", value: 10, unit: "%" }
        ]
    },
    "Scorpio": {
        talent: { name: "Septic Shock", description: "Septic Shock\nEach pellet applies a stack of Scorpio. At 6 stacks, the target is shocked for 5 seconds, then stacks are consumed." },
        fixedMods: [
            { slot: "optic", attr: "chc", value: 10, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 10, unit: "%" },
            { slot: "underbarrel", attr: "handling", value: 10, unit: "%" },
            { slot: "muzzle", attr: "stability", value: 10, unit: "%" }
        ]
    },
    "The Chatterbox": {
        talent: { name: "Incessant Chatter", description: "Incessant Chatter\nKills grant +4% rate of fire and +20% weapon damage per stack for 11s (max 5 stacks). Mag and reload speed buff on holstered kills." },
        fixedMods: [
            { slot: "optic", attr: "chc", value: 15, unit: "%" },
            { slot: "magazine", attr: "capacity", value: 10, unit: "rounds" },
            { slot: "underbarrel", attr: "handling", value: 10, unit: "%" },
            { slot: "muzzle", attr: "chd", value: 5, unit: "%" }
        ]
    },
    "Lady Death": {
        talent: { name: "Breathe Free", description: "Breathe Free\nWhile holstered, reloads grant stacks. When drawn, each stack gives +10% damage for 5s per enemy." },
        fixedMods: [
            { slot: "optic", attr: "chc", value: 10, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 10, unit: "%" },
            { slot: "underbarrel", attr: "meleeDamage", value: 500, unit: "%" },
            { slot: "muzzle", attr: "chd", value: 5, unit: "%" }
        ]
    },
    "Backfire": {
        talent: { name: "Payment in Kind", description: "Payment in Kind\nGrants skill damage for every 2 rounds in the magazine." },
        fixedMods: [
            { slot: "optic", attr: "chc", value: 5, unit: "%" },
            { slot: "magazine", attr: "capacity", value: 20, unit: "rounds" },
            { slot: "underbarrel", attr: "stability", value: 10, unit: "%" },
            { slot: "muzzle", attr: "chd", value: 5, unit: "%" }
        ]
    },
    "Merciless": {
        talent: { name: "Binary Trigger", description: "Binary Trigger\nFirst shot on target detonates a bomb, second shot detonates all bombs for amplified damage." },
        fixedMods: [
            { slot: "optic", attr: "accuracy", value: 10, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 15, unit: "%" },
            { slot: "underbarrel", attr: "handling", value: 10, unit: "%" },
            { slot: "muzzle", attr: "stability", value: 20, unit: "%" }
        ]
    },
    "Ruthless": {
        talent: { name: "Binary Trigger", description: "Binary Trigger\nFirst shot on target detonates a bomb, second shot detonates all bombs for amplified damage." },
        fixedMods: [
            { slot: "optic", attr: "accuracy", value: 10, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 15, unit: "%" },
            { slot: "underbarrel", attr: "handling", value: 10, unit: "%" },
            { slot: "muzzle", attr: "stability", value: 20, unit: "%" }
        ]
    },
    "Diamondback": {
        talent: { name: "Agonizing Bite", description: "Agonizing Bite\nRandomly marks an enemy; shooting the marked enemy guarantees a critical hit with +20% total damage." },
        fixedMods: [
            { slot: "optic", attr: "accuracy", value: 10, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 10, unit: "%" },
            { slot: "underbarrel", attr: "stability", value: 10, unit: "%" },
            { slot: "muzzle", attr: "chd", value: 15, unit: "%" }
        ]
    },
    "The Ravenous": {
        talent: { name: "Geri and Freki", description: "Geri and Freki\nFirst shot applies a mark, second shot detonates marks for amplified damage." },
        fixedMods: [
            { slot: "optic", attr: "chc", value: 5, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 10, unit: "%" },
            { slot: "underbarrel", attr: "chd", value: 5, unit: "%" },
            { slot: "muzzle", attr: "stability", value: 10, unit: "%" }
        ]
    },
    "Nemesis": {
        talent: { name: "Electromagnetic Accelerator", description: "Electromagnetic Accelerator\nShots build up charge; next shot deals amplified damage based on charge time. Headshot kills grant bonus damage for 15s." },
        fixedMods: [
            { slot: "optic", attr: "hsd", value: 45, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 10, unit: "%" },
            { slot: "underbarrel", attr: "handling", value: 5, unit: "%" },
            { slot: "muzzle", attr: "chd", value: 5, unit: "%" }
        ]
    },
    "Mantis": {
        talent: { name: "In Plain Sight", description: "In Plain Sight\nHeadshot kills mark nearby enemies and grant +10% damage to marked enemies." },
        fixedMods: [
            { slot: "optic", attr: "hsd", value: 40, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 10, unit: "%" },
            { slot: "underbarrel", attr: "stability", value: 10, unit: "%" },
            { slot: "muzzle", attr: "chc", value: 5, unit: "%" }
        ]
    },
    "Dread Edict": {
        talent: { name: "Full Stop", description: "Full Stop\nHeadshots grant 10% weapon damage for 10s (max 5 stacks). First shot to an enemy's armor deals amplified damage." },
        fixedMods: [
            { slot: "optic", attr: "hsd", value: 40, unit: "%" },
            { slot: "magazine", attr: "handling", value: 15, unit: "%" },
            { slot: "underbarrel", attr: "stability", value: 10, unit: "%" },
            { slot: "muzzle", attr: "chc", value: 10, unit: "%" }
        ]
    },
    "Sweet Dreams": {
        talent: { name: "Sandman", description: "Sandman\nMelee kills instantly load a full magazine. Holstered kills apply sleep gas." },
        fixedMods: [
            { slot: "optic", attr: "accuracy", value: 15, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 15, unit: "%" },
            { slot: "underbarrel", attr: "range", value: 25, unit: "%" }
        ]
    },
    "Lullaby": {
        talent: { name: "Sandman", description: "Sandman\nMelee kills instantly load a full magazine. Holstered kills apply sleep gas." },
        fixedMods: [
            { slot: "optic", attr: "accuracy", value: 15, unit: "%" },
            { slot: "magazine", attr: "reloadSpeed", value: 15, unit: "%" },
            { slot: "underbarrel", attr: "range", value: 25, unit: "%" }
        ]
    },
    "Liberty": {
        talent: { name: "Ricochet Gambit", description: "Ricochet Gambit\nBlind-fire hits ricochet to nearby enemies. Headshot kills give bonus armor." },
        fixedMods: [
            { slot: "optic", attr: "hsd", value: 5, unit: "%" },
            { slot: "magazine", attr: "handling", value: 15, unit: "%" },
            { slot: "underbarrel", attr: "rof", value: 15, unit: "%" }
        ]
    },
    "Regulus": {
        talent: { name: "Jigsaw", description: "Jigsaw\nHeadshots grant 10% bonus armor for 20s. Headshot kills add 2 rounds and apply bleed." },
        fixedMods: [
            { slot: "magazine", attr: "reloadSpeed", value: 10, unit: "%" }
        ]
    }
});

// Aktuell gewählte Exoten-Mod-Daten (wird bei DB-Auswahl gesetzt, beim Reset geleert)
let currentExoticMods = null;
// Exoten-Talent der aktuell gewählten Waffe (null = keine Exote gewählt)
let currentExoticTalent = null;
// Named-Talent der aktuell gewählten Waffe (null = keines gesetzt)
let currentNamedTalent = null;
// Named-Attribut der aktuell gewählten Waffe (null = keines) – z.B. Lexington +1.782 Basis-Schaden
let currentNamedAttr = null;

// Cache: Named-Talent-Definitionen aus der Waffen-DB, indexiert über key/Name/Label
let _namedTalentCache = null;
function _buildNamedTalentCache() {
    const cache = {};
    for (const w of (weaponsData.weapons || [])) {
        const t = w.named && w.named.talent;
        if (!t || !t.name || t.todo) continue;
        const entries = [t.key, t.name, t.label, t.label && t.label.toLowerCase().replace(/ä/g,'a').replace(/ö/g,'o').replace(/ü/g,'u').replace(/ß/g,'ss').replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')];
        for (const e of entries) if (e) cache[e] = t;
    }
    return cache;
}
function getNamedTalentDef(nameOrKey) {
    if (!_namedTalentCache) _namedTalentCache = _buildNamedTalentCache();
    if (!nameOrKey) return null;
    const k = String(nameOrKey);
    return _namedTalentCache[k] || _namedTalentCache[talentKeyFromName(k)] || null;
}

// Löst einen Talent-Namen/-Key zu einer Talent-Definition auf, mit Fallback
// auf die Named-Talente aus der Waffen-DB (Kategorien werden auf Berechnungs-
// typen abgebildet; Utility/situative Talente erhalten type: null).
function resolveTalentDef(nameOrKey) {
    // v36: Alias-Keys (Englische DB-Keys / CSV-Bezeichner) auf die
    // deutschen Definitionen in WEAPON_TALENTS mappen.
    const TALENT_KEY_ALIAS = {
        strained: 'angespannt', perfekt_strained: 'perfekt_angespannt',
        frenzy: 'raserei', perfekt_frenzy: 'perfekt_raserei',
        measured: 'abgemessen', perfekt_measured: 'perfekt_abgemessen',
        closepersonal: 'nahkampf', close_and_personal: 'nahkampf',
        perfekt_closepersonal: 'perfekt_nahkampf',
        optimist: 'optimist'
    };
    let tKey = WEAPON_TALENTS[nameOrKey] ? nameOrKey : talentKeyFromName(nameOrKey);
    if (!WEAPON_TALENTS[tKey] && TALENT_KEY_ALIAS[tKey]) tKey = TALENT_KEY_ALIAS[tKey];
    let t = WEAPON_TALENTS[tKey] || null;
    if (!t) {
        const nd = getNamedTalentDef(nameOrKey);
        if (nd) {
            tKey = nd.key || tKey;
            const catMap = { wd: 'wd', chd: 'chd', chc: 'chcchd', chcchd: 'chcchd', amp: 'amp', rof: 'rof' };
            const type = catMap[nd.category] || null;
            t = {
                label: nd.label || nd.name,
                type: type,
                conditional: !!nd.conditional,
                condition: nd.condition || '',
                valueNamed: nd.value,
                valueNormal: nd.value,
                note: nd.estimated ? 'Wert geschätzt – bitte im Spiel prüfen' : (nd.description || '')
            };
        }
    }
    return { key: tKey, t: t };
}

// Schreibt die fixen Mods einer exotischen Waffe in die Mod-Felder:
// belegte Slots werden gefüllt & gesperrt, unbelegte versteckt.
// EXOTEN-SPERRE: Bei exotischen Waffen sind Basis-Schaden, Kernattribute und
// Attribut 3 fix (keine freien Rollen) – die Felder werden gesperrt, damit sie
// nicht versehentlich manipuliert werden. on='true' sperren, on='false' freigeben.
function lockExoticAttributes(on) {
    const ids = ['weaponBaseDmg', 'weaponCore1', 'weaponCore2Type', 'weaponCore2Val', 'weaponMinorType', 'weaponMinorVal'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !!on;
    });
    // Prototyp-Bonus (+50%) ist bei Exoten nicht anwendbar
    const protoChk = document.getElementById('weaponIsPrototype');
    const protoHint = document.getElementById('protoDisabledHint');
    if (protoChk) { protoChk.disabled = !!on; if (on) protoChk.checked = false; }
    if (protoHint) protoHint.style.display = on ? '' : 'none';
}

function applyExoticFixedMods() {
    const keyMap = { modSlotOpticWrap: 'optic', modSlotMuzzleWrap: 'muzzle', modSlotUnderbarrelWrap: 'underbarrel', modSlotMagazineWrap: 'magazine' };
    WEAPON_MOD_SLOTS.forEach(slot => {
        const wrap = document.getElementById(slot.wrap);
        const typeEl = document.getElementById(slot.type);
        const valEl = document.getElementById(slot.val);
        if (!wrap || !typeEl || !valEl) return;
        const mod = currentExoticMods && currentExoticMods.find(m => m.slot === keyMap[slot.wrap]);
        if (mod && mod.attr === 'magOfHolding') {
            // Sondermod (Bullet King): nicht als Standard-Attribut wählbar -> Feld leer & gesperrt
            typeEl.value = '';
            valEl.value = '';
            typeEl.disabled = true;
            valEl.disabled = true;
            wrap.style.display = '';
        } else if (mod) {
            typeEl.value = mod.attr;
            valEl.value = String(mod.value).replace('.', ',');
            typeEl.disabled = true;
            valEl.disabled = true;
            wrap.style.display = '';
        } else {
            typeEl.disabled = true;
            valEl.disabled = true;
            wrap.style.display = 'none';
        }
        // Exoten haben fixe Mods aus der Waffen-DB: das neue Mod-Drop-down
        // (Katalog) ist bei ihnen bedeutungslos und wird geleert & gesperrt.
        const modSelEl = document.getElementById(MOD_SLOT_FORM[keyMap[slot.wrap]].mod);
        if (modSelEl) { modSelEl.value = ''; modSelEl.disabled = true; modSelEl.innerHTML = '<option value="">— Mod auswählen —</option>'; }
    });
    // Exoten haben auch fixe Attribute: Kern-/Nebenfelder & Prototyp sperren
    lockExoticAttributes(true);
    // Exoten: Auto-Mods-Automatik aus (fixe Mods), Schalter sperren
    const autoChkExo = document.getElementById('autoModsToggle');
    if (autoChkExo) { autoChkExo.checked = false; autoChkExo.disabled = true; }
    if (typeof toggleAutoMods === 'function') toggleAutoMods();
    updateModLiveSummary();
}

// Hebt die Exoten-Sperrung der Mod-Felder wieder auf (Formular-Reset).
function clearExoticFixedMods() {
    currentExoticMods = null;
    WEAPON_MOD_SLOTS.forEach(slot => {
        const wrap = document.getElementById(slot.wrap);
        const typeEl = document.getElementById(slot.type);
        const valEl = document.getElementById(slot.val);
        if (typeEl) typeEl.disabled = false;
        if (valEl) valEl.disabled = false;
    });
    // Katalog-Mod-Drop-downs wieder freigeben (Exoten-Sperre aufheben)
    for (const cat of Object.keys(MOD_SLOT_FORM)) {
        const ms = document.getElementById(MOD_SLOT_FORM[cat].mod);
        if (ms) ms.disabled = false;
        const hintEl = document.getElementById(MOD_SLOT_FORM[cat].hint);
        if (hintEl) hintEl.textContent = '';
    }
    // Attribut-Sperre der Exoten aufheben (Basis-Schaden, Kern 1/2, Attribut 3)
    lockExoticAttributes(false);
    // Sperr-Zustand der Typ/Wert-Felder anhand evtl. noch gewählter
    // Katalog-Mods wiederherstellen (Fix-Mod gesperrt, Freifeld offen)
    for (const cat of Object.keys(MOD_SLOT_FORM)) syncModLockState(cat);
    updateModLiveSummary();
}

// Liest die Mod-Slot-Anzahl aus den Waffen-Stats ("Mod Slots", z.B. "4\", "3!", "2$#").
// Die Fußnoten-Symbole aus dem Wiki werden ignoriert - es zählt die führende Zahl.
// Rückgabe: { count: 0-4 | null, fixed: boolean }
//   fixed = true  -> Exotische Waffe (fixe Mods, Unterstützung folgt später)
//   count = null  -> keine Angabe in der Datenbank
function parseModSlots(dbEntry) {
    if (!dbEntry) return { count: null, fixed: false };
    // Exoten haben fixe Mods - egal was im Stat-Feld steht
    if (dbEntry.rarity === 'exotic' || dbEntry.is_exotic) return { count: null, fixed: true };
    const raw = dbEntry.stats ? dbEntry.stats['Mod Slots'] : null;
    if (raw == null) return { count: null, fixed: false };
    const m = String(raw).match(/\d+/);
    if (!m) return { count: null, fixed: false }; // "N/A" o.ä.
    return { count: Math.max(0, Math.min(4, parseInt(m[0], 10))), fixed: false };
}

// Blendet die Mod-Felder je nach verfügbarer Slot-Anzahl ein bzw. aus.
// count: 0-4 = verfügbare Slots | null = unbekannt (alle 4 anzeigen)
// 'fixed': fixe Mods (Exotiker) - alle Felder aus, Hinweis statt dessen.
// Beim Ausblenden wird Magazin zuerst versteckt (Optik bleibt am längsten);
// da der konkret fehlende Slot modellabhängig ist, bietet der Hinweis einen
// "Alle 4 anzeigen"-Knopf als manuelle Überschreibung an.
function updateModSlotUI(count) {
    const fixed = count === 'fixed';
    if (fixed && currentExoticMods) {
        // Exote mit bekannten fixen Mods: Felder automatisch füllen & sperren
        applyExoticFixedMods();
        const hint = document.getElementById('modSlotsHint');
        if (hint) {
            const slotNames = { optic: 'Visier', muzzle: 'Mündung', underbarrel: 'Unterlauf', magazine: 'Magazin' };
            const summary = currentExoticMods.map(m => {
                if (m.unit === 'special') return `${slotNames[m.slot]}: ${EXOTIC_MOD_ATTRS[m.attr] || m.attr} (Sondermod)`;
                const unit = m.unit === 'rounds' ? ' Schuss' : '%';
                const attr = (m.unit === 'rounds' && m.attr === 'capacity') ? '' : ' ' + (EXOTIC_MOD_ATTRS[m.attr] || m.attr.toUpperCase());
                return `${slotNames[m.slot]}: +${formatGermanNumber(m.value)}${unit}${attr}`;
            }).join(' · ');
            const exoData = Object.keys(EXOTIC_WEAPONS).length ? EXOTIC_WEAPONS : {};
            const currentExoticEntry = Object.values(exoData).find(v => v.fixedMods === currentExoticMods);
            hint.className = 'text-[11px] text-amber-400';
            hint.textContent = `Exotische Waffe – fixe Mods: ${summary}`;
        }
        updateModLiveSummary();
        return;
    }
    // Kein Exoten-Modus: vorherige Exoten-Sperrung der Felder aufheben,
    // sonst bleiben Mod-Felder nach einem Exoten-Wechsel dauerhaft gesperrt.
    // Unbekannte Exote (fixe, aber nicht in der DB): Attribute ebenfalls sperren.
    if (fixed) lockExoticAttributes(true);
    else lockExoticAttributes(false);
    WEAPON_MOD_SLOTS.forEach(slot => {
        const typeEl = document.getElementById(slot.type);
        const valEl = document.getElementById(slot.val);
        if (typeEl) typeEl.disabled = false;
        if (valEl) valEl.disabled = false;
    });
    WEAPON_MOD_SLOTS.forEach((slot, idx) => {
        const wrap = document.getElementById(slot.wrap);
        if (!wrap) return;
        const visible = fixed ? false : (count == null || idx < count);
        wrap.style.display = visible ? '' : 'none';
        if (!visible) {
            // Wert hidden slots leeren, damit sie nicht in Builds einfließen
            const valEl = document.getElementById(slot.val);
            if (valEl && valEl.value !== '') valEl.value = '';
        }
    });
    // Auto-Mods: Sichtbarkeit/Sperrung der Felder an den Schalter anpassen
    // (diese Funktion setzt sonst display:'' und disabled=false zurück).
    if (typeof toggleAutoMods === 'function') toggleAutoMods();
    updateModLiveSummary();
    const hint = document.getElementById('modSlotsHint');
    if (!hint) return;
    if (fixed) {
        hint.className = 'text-[11px] text-amber-400';
        hint.textContent = 'Exotische Waffe – fixe Mods (noch keine Daten zu dieser Waffe hinterlegt).';
    } else if (count == null) {
        hint.className = 'text-[11px] text-gray-500';
        hint.textContent = 'Keine Mod-Slot-Angabe in der Datenbank – alle 4 Slots verfügbar.';
    } else if (count === 0) {
        hint.className = 'text-[11px] text-gray-500';
        hint.innerHTML = 'Diese Waffe hat laut Datenbank keine Mod-Slots. <button type="button" onclick="updateModSlotUI(null)" class="underline hover:text-gray-300">Alle 4 anzeigen</button>';
    } else {
        const active = WEAPON_MOD_SLOTS.slice(0, count).map(s => s.label).join(', ');
        hint.className = 'text-[11px] text-gray-500';
        hint.innerHTML = `Diese Waffe hat laut Datenbank ${count} Mod-Platz${count > 1 ? 'e' : ''}: aktiv sind ${active}. ` +
            '<button type="button" onclick="updateModSlotUI(null)" class="underline hover:text-gray-300">Alle 4 anzeigen</button>';
    }
}

// Funktion, um die Beschreibung des ausgewählten Talents anzuzeigen
function onTalentChange() {
    const talentSelect = document.getElementById('weaponTalentSelectSelect');
    const selectedOption = talentSelect.options[talentSelect.selectedIndex];
    
    if (selectedOption && selectedOption.value) {
        const description = selectedOption.dataset.description;
        document.getElementById('talentDescription').textContent = description;
    } else {
        document.getElementById('talentDescription').textContent = '';
    }
}

// ========== WAFFEN-DATENBANK-UPDATE (JSON-Import) ==========
// Normalisiert die Typ-Bezeichner einer importierten JSON
// (z.B. "Gewehr" -> "Gewehr / DMR", "Scharfschützengewehr" -> "Scharfschützengewehr (MMR)")
function normalizeWeaponType(type) {
    const t = String(type || '').trim();
    if (t === 'Gewehr') return 'Gewehr / DMR';
    if (t.startsWith('Scharfsch')) return t.includes('(MMR)') ? t : t + ' (MMR)';
    if (t.startsWith('Leichtes Maschinengewehr')) return t.includes('(LMG)') ? t : t + ' (LMG)';
    if (t.startsWith('Sturmgewehr')) return t.includes('(AR)') ? t : t + ' (AR)';
    if (t.startsWith('Maschinenpistole')) return t.includes('(MP)') ? t : t + ' (MP)';
    return t;
}

// Erwartet das Format der weapons_full_vX.json: { "weapons": [ ... ] }
// (alternativ auch ein nacktes Array). Behalten werden name, type, stats und
// optional ein "exotic"-Objekt pro Waffe:
//   "exotic": {
//     "talent": { "name": "...", "description": "..." },
//     "fixedMods": [ { "slot": "optic", "attr": "chc", "value": 15, "unit": "%" }, ... ]
//   }
// Slots: optic | muzzle | underbarrel | magazine
// Attrs: chc, chd, hsd, wd, dta, dttooc, dth, rof, reloadSpeed, handling,
//        accuracy, stability, range, swapSpeed, capacity (Schuss), meleeDamage, magOfHolding
// Units: "%" | "rounds" | "special"
function normalizeExoticField(w) {
    const ex = w.exotic || w.exotic_data || null;
    if (!ex || typeof ex !== 'object') return null;
    const talent = (ex.talent && typeof ex.talent === 'object')
        ? { name: ex.talent.name || null, description: String(ex.talent.description || '') }
        : null;
    const fixedMods = Array.isArray(ex.fixedMods)
        ? ex.fixedMods.filter(m => m && m.slot && m.attr != null).map(m => ({
            slot: String(m.slot),
            attr: String(m.attr),
            value: Number(m.value) || 0,
            unit: m.unit || '%'
        }))
        : null;
    if (!talent && (!fixedMods || !fixedMods.length)) return null;
    const out = {};
    if (talent) out.talent = talent;
    if (fixedMods && fixedMods.length) out.fixedMods = fixedMods;
    return out;
}

function normalizeWeaponDbJson(parsed) {
    const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.weapons) ? parsed.weapons : null);
    if (!list) throw new Error('Ungültiges Format: Erwartet wird ein Objekt mit "weapons"-Array (wie weapons_full_v2.json).');
    const weapons = list.map(w => {
        const entry = {
            name: String(w.name || '').trim(),
            type: normalizeWeaponType(w.type),
            rarity: w.rarity || (w.is_exotic ? 'exotic' : (w.is_named ? 'named' : 'standard')),
            stats: w.stats || {}
        };
        const exo = normalizeExoticField(w);
        if (exo) entry.exotic = exo;
        return entry;
    }).filter(w => w.name && w.type);
    if (!weapons.length) throw new Error('Die Datei enthält keine verwertbaren Waffen (name/type fehlen).');
    return { weapons };
}

// Handler für den Datei-Upload im Header ("Waffen-Datenbank aktualisieren")
function handleWeaponDbUpdate(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            const db = normalizeWeaponDbJson(parsed);
            // Datenbestand austauschen und persistent im Browser speichern
            weaponsData.weapons = db.weapons;
            try {
                localStorage.setItem('div2_weapons_db_v2', JSON.stringify(db));
            } catch (storageErr) {
                console.warn('Waffen-Datenbank konnte nicht im Browser gespeichert werden:', storageErr);
            }
            // Drop-downs neu aufbauen (aktuelle Auswahl zurücksetzen)
            populateWeaponTypeDropdown();
            document.getElementById('weaponDbSelect').innerHTML = '<option value="">— Waffe auswählen —</option>';
            showToast(`Waffen-Datenbank aktualisiert: ${db.weapons.length} Waffen geladen ✅`, 'success');
        } catch (err) {
            showToast('Fehler beim Laden der Waffen-Datenbank: ' + err.message, 'error');
        } finally {
            input.value = '';
        }
    };
    reader.onerror = function() {
        showToast('Die JSON-Datei konnte nicht gelesen werden.', 'error');
        input.value = '';
    };
    reader.readAsText(file, 'utf-8');
}

// Beim Start: gespeicherte Waffen-Datenbank aus dem Browser laden (falls vorhanden)
function loadSavedWeaponDb() {
    // Alter Speicher-Schlüssel (v1): enthielt DB-Versionen ohne Named-Blöcke
    // (z.B. v2-5). Wird entfernt, damit die neu eingebettete DB (mit named-
    // Talenten/Attributen) greift.
    try { localStorage.removeItem('div2_weapons_db_v1'); } catch (e) {}
    try {
        const saved = localStorage.getItem('div2_weapons_db_v2');
        if (!saved) return;
        const db = JSON.parse(saved);
        // Sicherheitscheck: Nur DBs mit Named-Blöcken übernehmen (Versions-
        // Schutz, damit ein aelterer Import die eingebettete v2-6 nicht
        // ueberschreibt).
        const hasNamed = db && Array.isArray(db.weapons) && db.weapons.some(w => w && w.named);
        if (hasNamed && db.weapons.length) {
            weaponsData.weapons = db.weapons;
            console.log('Gespeicherte Waffen-Datenbank geladen (' + db.weapons.length + ' Waffen).');
        } else if (db && Array.isArray(db.weapons) && db.weapons.length) {
            console.log('Gespeicherte Waffen-Datenbank ignoriert (keine Named-Blöcke) – eingebettete DB in Verwendung.');
        }
    } catch (err) {
        console.warn('Gespeicherte Waffen-Datenbank konnte nicht geladen werden:', err);
    }
}

// Lade die Waffen-Daten, fülle die Drop-down-Listen und die Talente, sobald die Seite geladen ist
window.onload = function() {
    loadSavedWeaponDb();
    populateWeaponTypeDropdown();
    populateTalentDropdown();
    if (typeof populateAttrTypeDropdowns === 'function') populateAttrTypeDropdowns();
    if (typeof updateModLiveSummary === 'function') updateModLiveSummary();
    // Kernattribut-UI auf den voreingestellten Waffentyp (AR) setzen
    if (typeof updateWeaponCoreLabels === 'function') updateWeaponCoreLabels();
    if (typeof updateCore2Hint === 'function') updateCore2Hint();
    // Kern-1- und Nebenattribut-Hinweise (God-Roll-Max) initialisieren
    if (typeof updateCore1Hint === 'function') updateCore1Hint();
    if (typeof updateMinorHint === 'function') updateMinorHint();
    // App-Initialisierung aus dem ersten Skript-Block
    // (Inventare, Einstellungen, Tabs) - nicht mehr durch ein zweites
    // window.onload ueberschreiben, sondern gezielt aufrufen.
    if (typeof initApp === 'function') initApp();
    // Named-Gear-Liste passend zum voreingestellten Slot filtern
    if (typeof initGearAttrSelects === 'function') initGearAttrSelects();
    if (typeof applyGearSlotFilter === 'function') applyGearSlotFilter();
    if (typeof onGearSetSelectionChange === 'function') onGearSetSelectionChange();
    // Gear-Datenbank-Auswahlliste initial befüllen
    if (typeof updateGearDbOptions === 'function') updateGearDbOptions();
    // Auto-Mods-Schalter initial anwenden (Standard: aktiv -> Erfassung ausblenden)
    if (typeof toggleAutoMods === 'function') toggleAutoMods();
    // Manuellen Spiel-Build (Einstellungen) initial mit Inventar füllen
    if (typeof populateManualBuildSelects === 'function') populateManualBuildSelects();
};
