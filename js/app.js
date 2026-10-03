// ========== DATENSTRUKTUREN ==========
        let weaponsInventory = [];
        let gearInventory = [];
        let weaponIdCounter = 1;
        let gearIdCounter = 1;
        let currentWeaponSortField = 'name';
        let currentWeaponSortAsc = true;
        let currentGearSortField = 'slot';
        let currentGearSortAsc = true;
        let lastComparisonData = []; // Issue #35: immer Array, nie null
        // Ergebnis des optionalen manuellen Spiel-Builds (Einstellungen)
        let manualBuildResult = null;
        // true = Inventar hat sich seit der letzten Berechnung geändert ->
        // das angezeigte Vergleichsergebnis ist veraltet.
        let comparisonStale = false;

        function markComparisonStale() {
            if (lastComparisonData && lastComparisonData.length) {
                comparisonStale = true;
                updateTabUI();
            }
        }

        // Named Item Configs
        


        // ========== GEAR-DATENBANK (Named & Exotics, komplette Liste) ==========
        // proto: Prototyp (+50% Max-Werte) möglich · core: 'wd' | 'armour' | 'skill' | 'any'
        // fixed: fixe Minor-Attribute [typ, wert] · free: Anzahl frei rollbarer Minors
        // mods: Mod-Slots · perk: Named-Perk / Talent-Kurzbeschreibung
        


        // Exotische Ausrüstung: fixe Werte – KEIN Prototyp-Bonus möglich. Erkenntnis aus GEAR_DB.
        // ===== Exotische Gear-Perks (Klasse 1+2): numerisch modellierbar =====
        // Annahmen wie bei bedingten Talenten: volle Stacks / Bedingung erfüllt,
        // wenn "Exoten-Perks aktiv" angeschaltet ist. Stack-Auslastung nutzt das
        // gleiche Feld wie die Set-Stacks (stackUtilization). Utility-Perks
        // (Heilung, Team-Support, Granaten etc.) sind bewusst nicht enthalten.
        const EXOTIC_GEAR_PERKS = {
            "Coyote's Mask": {
                label: "Coyote's Mask", perk: 'Distanz-Bonus',
                byDistance: {
                    near:   { wd: 0, chc: 0, chd: 25, note: '0–15m: +25% CHD' },
                    mid:    { wd: 0, chc: 10, chd: 10, note: '15–25m: +10% CHC & +10% CHD' },
                    far:    { wd: 0, chc: 25, chd: 0, note: '25m+: +25% CHC' }
                }
            },
            'Catharsis': {
                label: 'Catharsis', perk: '30 Stacks à +1,5% WD durch erlittenen Schaden',
                perStackWd: 1.5, maxStacks: 30,
                note: 'Annahme: volle Stacks (Stack-Auslastung gilt)'
            },
            'Memento': {
                label: 'Memento', perk: 'Kill Confirmed: 30 Stacks à +1% WD',
                perStackWd: 1, maxStacks: 30,
                note: 'Annahme: volle Trophäen-Stacks (Stack-Auslastung gilt)'
            },
            'Catalyst': {
                label: 'Catalyst', perk: 'Catalysis: max. 12 Stacks à +2% WD & +2% Status',
                perStackWd: 2, maxStacks: 12,
                note: 'Annahme: volle Stacks (Stack-Auslastung gilt)'
            },
            "Sawyer's Kneepads": {
                label: "Sawyer's Kneepads", perk: 'Stand Your Ground: +3% WD je Sekunde Stillstand, max. 10',
                perStackWd: 3, maxStacks: 10,
                note: 'Annahme: 10s Stillstand = volle Stacks (Stack-Auslastung gilt)'
            },
            'Harrier Pride': {
                label: 'Harrier Pride', perk: 'Red/Blue Stacks à 0,5% WD',
                perStackWd: 0.5, maxStacks: 100,
                note: 'Annahme: 100 Gesamt-Stacks (Red+Blue, Stack-Auslastung gilt)'
            },
            'Bloody Knuckles': {
                label: 'Bloody Knuckles', perk: 'Over the Top: +25% WD für 20s nach Granaten-/Nahkampf-Treffer',
                wd: 25, conditional: true, note: 'Annahme: Buff aktiv'
            },
            'Beacon': {
                label: 'Beacon', perk: 'Bond: +30% CHD mit Verbündeten in 10m',
                chd: 30, conditional: true, note: 'Annahme: Verbündeter in 10m'
            },
            'Investor': {
                label: 'Investor', perk: 'Bonus je rotem Nicht-Kern-Attribut: +10% CHD',
                chdPerRedAttr: 10, note: '+10% CHD je rotem Nicht-Kern-Attribut des Builds'
            },
            'Blacklisters': {
                label: 'Blacklisters', perk: 'Ostracize: markierter Gegner erhält +20% Verstärker von dir',
                amp: 20, conditional: true, note: 'Annahme: Ziel markiert'
            },
            'Overdogs': {
                label: 'Overdogs', perk: 'Weakest Link: +30% Verstärker gegen niederrangige Gegner',
                amp: 30, conditional: true, note: 'Annahme: niederrangiges Ziel'
            },
            'Centurion Scabbard': {
                label: 'Centurion Scabbard', perk: 'Counter: Waffenwechsel-Boni (+20% RoF/WD-Gruppe, 12s)',
                wd: 20, rof: 20, conditional: true, note: 'Annahme: Buff-Gruppe aktiv'
            }
        };
        // Issue #75: Numerisch modellierte Exoten-Waffen-Talente.
        // Analog zu EXOTIC_GEAR_PERKS: konstante Boni (conditional = Bedingung
        // als erfuellt angenommen), Stack-Talente mit Auslastungs-Slider,
        // Sonderfaelle ueber eigene Felder (wdPerSkillTier, ampFromStatusFactor).
        // Chameleon (Adaptive Instincts) ist bereits ueber WEAPON_TALENTS
        // modelliert und hier bewusst nicht doppelt erfasst.
        const EXOTIC_WEAPON_TALENTS = {
            'The Bighorn': { label: 'The Bighorn', perk: 'Big Game Hunter',
                perStackHsd: 6, maxStacks: 25,
                note: 'Kopfschuesse: +6% HSD je Stack, max. 25 (Decay nach vollen Stacks). HSD fliesst bis zum Kopfschuss-Modell noch nicht in den Score ein.' },
            'Agitator': { label: 'Agitator', perk: 'Perturb',
                wd: 30, rof: 25, conditional: true,
                note: 'Annahme: geprimt (10s geholstert) — +30% WD & +25% RoF fuer 20s' },
            'Strega (FAL)': { label: 'Strega', perk: 'Unnerve',
                perStackAmp: 15, maxStacks: 5,
                note: 'Je Marke +15% verstaerkter Schaden, max. 5 Marken (Slider = Markenauslastung)' },
            'Capacitor': { label: 'Capacitor', perk: 'Capacitance',
                wdPerSkillTier: 7.5,
                note: '+7,5% WD je Skill-Tier des Builds (Skill-Schaden-Bonus separat, siehe Issue #54)' },
            'Big Alejandro': { label: 'Big Alejandro', perk: 'Cover Shooter',
                perStackWd: 1, maxStacks: 100,
                note: 'Je Schuss in Deckung +1% WD, max. 100 (Slider = Auslastung); Bonus entfaellt bei Nachladen/Waffenwechsel' },
            'Lady Death': { label: 'Lady Death', perk: 'Breathe Free',
                amp: 75, conditional: true,
                note: 'Annahme: Stacks durch Bewegung vorhanden — +75% verstaerkt pro Schuss' },
            'Underboss (Tommy Gun)': { label: 'Underboss', perk: 'Gangland Hit',
                amp: 20, perStackAmp: 5, maxStacks: 3,
                note: '+20% verstaerkt gegen markierte Ziele, +5% je zusaetzlicher Marke (max. 4 Marken = +35%)' },
            'The Chatterbox': { label: 'The Chatterbox', perk: 'Incessant Chatter',
                perStackRof: 25, maxStacks: 5,
                note: 'Je Nachladen +25% RoF je Gegner in 15m, max. 5 Stacks (Slider = Auslastung)' },
            'Backfire': { label: 'Backfire', perk: 'Payment in kind',
                perStackChd: 2, maxStacks: 100,
                note: 'Je Schadens-Treffer +2% CHD, max. 100 Stacks (Slider = Auslastung)' },
            'Busy Little Bee (Custom PF45)': { label: 'Busy Little Bee', perk: 'Busy Little Bee',
                perStackWd: 20, maxStacks: 10,
                note: 'Je Schuss auf ein anderes Ziel +20% WD, max. 10 — aktiviert erst nach Waffenwechsel (10s)' },
            'Shroud (M700 Carbon)': { label: 'Shroud', perk: 'High Priority Target',
                amp: 125, conditional: true,
                note: 'Annahme: hoechstrangiger Gegner im Gefecht — +125% verstaerkter WD' },
            'Dread Edict': { label: 'Dread Edict', perk: 'Full Stop',
                perStackWd: 2, perStackHsd: 5, maxStacks: 20,
                note: 'Je Stack +2% WD & +5% HSD, max. 20 (Kopfschuss 2 Stacks). HSD fliesst bis zum Kopfschuss-Modell noch nicht in den Score ein.' },
            'Mantis (Covert SRS)': { label: 'Mantis', perk: 'In Plain Sight',
                amp: 50, conditional: true,
                note: 'Annahme: Ziel zielt nicht auf dich — +50% verstaerkt auf Kopfschuss-/Schwachpunkt-Schaden' },
            'Tempest': { label: 'Tempest', perk: 'Restrained',
                amp: 25, conditional: true,
                note: 'Annahme: Schild zerbrochen — +25% verstaerkt fuer 20s' },
            'Liberty': { label: 'Liberty', perk: 'Liberty or Death',
                perStackWd: 2, maxStacks: 30,
                note: 'Je Treffer +2% WD, max. 30 Stacks (Slider = Auslastung); Kopfschuss verbraucht Stacks fuer Schild-Reparatur' },
            'Mosquito (Military M9)': { label: 'Mosquito', perk: 'Mosquito Song',
                dta: 25, conditional: true,
                note: 'Annahme: 5 Stacks erreicht — Ziel erleidet +25% Schaden an Ruestung' },
            'Whiplash (Diceros)': { label: 'Whiplash', perk: 'Faster than Reloading',
                wd: 50, rof: 20, conditional: true,
                note: 'Annahme: geprimt — +50% WD & +20% RoF bis das Magazin geleert ist' },
            'Fafnir': { label: 'Fafnir', perk: "Dragon's Breath",
                ampFromStatusFactor: 50,
                note: "Verstaerkt um 50% deines Statuseffekt-Bonus (Eingabefeld) — 40% Brenn-Chance pro Schuss" },
            'Prima Donna': { label: 'Prima Donna', perk: "You can look... but you can't touch.",
                perStackAmp: 12.5, maxStacks: 10,
                note: 'Ausserhalb des Kampfs 10 Stacks — je Stack +12,5% verstaerkt (Slider = Auslastung)' },
            'Vertigo': { label: 'Vertigo', perk: 'Startling',
                dttooc: 30, conditional: true,
                note: 'Annahme: Unterdrueckung ausgeloest — +30% DTToOC fuer dich und Verbundete (15s)' }
        };
        // Liefert die Modell-Definition fuer eine Exoten-Waffe aus dem Inventar.
        // Match per exaktem Namen (DB-Name inkl. Klammerzusatz) mit Fallback
        // ueber den Basis-Namen ohne Klammer und ohne "The"-Praefix.
        function exoticWeaponTalentDef(weapon) {
            if (!weapon || !weapon.isExotic || typeof EXOTIC_WEAPON_TALENTS === 'undefined') return null;
            const name = String(weapon.name || '');
            let def = EXOTIC_WEAPON_TALENTS[name];
            if (!def) {
                const base = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
                def = EXOTIC_WEAPON_TALENTS[base]
                    || EXOTIC_WEAPON_TALENTS[base.replace(/^The\s+/i, '')]
                    || EXOTIC_WEAPON_TALENTS['The ' + base]
                    || null;
            }
            return def;
        }
        // Bonus eines modellierten Exoten-Waffen-Talents. Null, wenn die Waffe
        // kein Modell hat oder die Exoten-Perks global deaktiviert sind. Stack-
        // Talente nutzen den Slider-Auslastungswert (Standard 100% = volle Stacks),
        // Capacitor liefert zusaetzlich skillTierWd je Skill-Tier des Builds.
        function exoticWeaponTalentBonus(weapon) {
            const def = exoticWeaponTalentDef(weapon);
            if (!def) return null;
            // #108 D: Abgewaehlte Exoten-Waffe: Talent-Modell ruht
            if (weapon && weapon.isExotic && disabledExoticWeapons.has(String(weapon.id))) return null;
            const activeEl = (typeof document !== 'undefined') && document.getElementById('exoticPerksActive');
            if (activeEl && !activeEl.checked) return null;
            const b = { wd: 0, chc: 0, chd: 0, amp: 0, rof: 0, hsd: 0, dttooc: 0, dta: 0, skillTierWd: 0 };
            const hasStacks = !!(def.perStackWd || def.perStackChd || def.perStackAmp || def.perStackRof || def.perStackHsd);
            let utilization = 100;
            if (hasStacks && typeof document !== 'undefined') {
                const slider = document.getElementById('exoticWStackUtil_' + slugify(String(weapon.name || '')));
                if (slider && slider.value !== '' && !isNaN(parseLocalizedFloat(slider.value))) {
                    utilization = parseLocalizedFloat(slider.value);
                } else {
                    utilization = parseLocalizedFloat(document.getElementById('stackUtilization')?.value, 100);
                }
                if (utilization < 0) utilization = 100;
                if (utilization > 100) utilization = 100;
            }
            const stacks = Math.round((def.maxStacks || 0) * (utilization / 100));
            b.wd += def.wd || 0; b.chc += def.chc || 0; b.chd += def.chd || 0;
            b.amp += def.amp || 0; b.rof += def.rof || 0;
            b.dttooc += def.dttooc || 0; b.dta += def.dta || 0;
            if (hasStacks) {
                b.wd += (def.perStackWd || 0) * stacks;
                b.chd += (def.perStackChd || 0) * stacks;
                b.amp += (def.perStackAmp || 0) * stacks;
                b.rof += (def.perStackRof || 0) * stacks;
                b.hsd += (def.perStackHsd || 0) * stacks;
            }
            if (def.ampFromStatusFactor && typeof document !== 'undefined') {
                const inp = document.getElementById('exoticStatusBonus');
                const statusBonus = inp ? (parseLocalizedFloat(inp.value) || 0) : 0;
                b.amp += statusBonus * def.ampFromStatusFactor / 100;
            }
            b.skillTierWd = def.wdPerSkillTier || 0;
            return b;
        }
        // Rendert die dynamische Exoten-Perk-Liste im Optimierungs-Tab:
        // nur Exoten, die (a) modelliert sind und (b) im Inventar liegen.
        // Coyote's Mask bekommt die Distanz-Zone, Stack-Perks einen eigenen
        // Auslastungs-Slider (Standard: wie Set-Stacks), bedingte Perks
        // zeigen ihre Annahme.
        function renderExoticPerkList() {
            const wrap = document.getElementById('exoticPerkListWrap');
            if (!wrap) return;
            const active = !!(document.getElementById('exoticPerksActive')?.checked);
            wrap.style.display = active ? '' : 'none';
            if (!active) return;
            const present = new Set(gearInventory.filter(i => !isExoticGearDisabled(i)).map(i => i.setName).filter(n => EXOTIC_GEAR_PERKS[n]));
            // Issue #75: modellierte Exoten-Waffen-Talente zusätzlich anzeigen
            const presentWeapons = [];
            (weaponsInventory || []).forEach(w => {
                const def = (typeof exoticWeaponTalentDef === 'function') ? exoticWeaponTalentDef(w) : null;
                if (def) presentWeapons.push({ w: w, def: def });
            });
            if (present.size === 0 && presentWeapons.length === 0) {
                wrap.innerHTML = '<p class="text-xs text-gray-400">Keine unterstützten Exoten im Gear- oder Waffen-Inventar — lege z.B. Coyote\'s Mask, Memento oder eine modellierte Exoten-Waffe an, um deren Perks einzurechnen.</p>';
                return;
            }
            let html = '<p class="text-[11px] font-semibold uppercase text-gray-400">Unterstützte Exoten im Inventar (' + (present.size + presentWeapons.length) + ')</p>';
            present.forEach(name => {
                const def = EXOTIC_GEAR_PERKS[name];
                html += '<div class="p-2 rounded-lg bg-zinc-900/80 border border-gray-800 space-y-1">';
                html += '<div class="flex items-center justify-between"><span class="text-sm font-semibold text-gray-200">' + escapeHtml(name) + '</span><span class="text-[10px] text-div-accent">' + escapeHtml(def.perk.split('(')[0].trim()) + '</span></div>';
                if (def.byDistance) {
                    const cur = document.getElementById('coyoteDistance')?.value || 'mid';
                    html += '<select id="coyoteDistance" onchange="if (lastComparisonData && lastComparisonData.length) calculateCombinedComparison();" class="w-full p-2 rounded-lg text-xs bg-zinc-800 border border-gray-700">';
                    html += '<option value="near"' + (cur === 'near' ? ' selected' : '') + '>0–15m: +25% CHD</option>';
                    html += '<option value="mid"' + (cur === 'mid' ? ' selected' : '') + '>15–25m: +10% CHC &amp; +10% CHD</option>';
                    html += '<option value="far"' + (cur === 'far' ? ' selected' : '') + '>25m+: +25% CHC</option>';
                    html += '</select>';
                } else if (def.perStackWd) {
                    const inp = document.getElementById('exoticStackUtil_' + slugify(name))?.value;
                    const val = (inp !== undefined && inp !== '') ? escapeHtml(inp) : '100';
                    html += '<div class="flex items-center gap-2 text-xs text-gray-300">';
                    html += '<input type="range" min="0" max="100" step="5" value="' + val + '" id="exoticStackUtil_' + slugify(name) + '" oninput="document.getElementById(\'exoticStackUtilVal_' + slugify(name) + '\').textContent = this.value + \'%\';" onchange="if (lastComparisonData && lastComparisonData.length) calculateCombinedComparison();" class="flex-1 accent-orange-500">';
                    html += '<span id="exoticStackUtilVal_' + slugify(name) + '" class="font-mono text-amber-400 w-10 text-right">' + val + '%</span>';
                    html += '</div>';
                    html += '<p class="text-[10px] text-gray-500">Stacks: max. ' + def.maxStacks + ' × +' + formatGermanNumber(def.perStackWd) + '% WD — ' + escapeHtml(def.note) + '</p>';
                } else {
                    html += '<p class="text-[10px] text-gray-500">' + escapeHtml(def.note) + '</p>';
                }
                html += '</div>';
            });
            // Issue #75: Waffen-Exoten mit eigenen Stack-Slidern rendern
            presentWeapons.forEach(({ w, def }) => {
                const slug = slugify(String(w.name || ''));
                const parts = [];
                if (def.wd) parts.push('+' + formatGermanNumber(def.wd) + '% WD');
                if (def.chc) parts.push('+' + formatGermanNumber(def.chc) + '% CHC');
                if (def.chd) parts.push('+' + formatGermanNumber(def.chd) + '% CHD');
                if (def.amp) parts.push('+' + formatGermanNumber(def.amp) + '% verstärkt');
                if (def.rof) parts.push('+' + formatGermanNumber(def.rof) + '% RoF');
                if (def.dttooc) parts.push('+' + formatGermanNumber(def.dttooc) + '% DTToOC');
                if (def.dta) parts.push('+' + formatGermanNumber(def.dta) + '% DTA');
                if (def.wdPerSkillTier) parts.push('+' + formatGermanNumber(def.wdPerSkillTier) + '% WD je Skill-Tier');
                html += '<div class="p-2 rounded-lg bg-zinc-900/80 border border-gray-800 space-y-1">';
                html += '<div class="flex items-center justify-between"><span class="text-sm font-semibold text-gray-200">' + escapeHtml(w.name) + ' <span class="text-[10px] text-gray-400">(Waffe)</span></span><span class="text-[10px] text-div-accent">' + escapeHtml(def.perk) + '</span></div>';
                const hasStacks = !!(def.perStackWd || def.perStackChd || def.perStackAmp || def.perStackRof || def.perStackHsd);
                if (hasStacks) {
                    const perParts = [];
                    if (def.perStackWd) perParts.push('+' + formatGermanNumber(def.perStackWd) + '% WD');
                    if (def.perStackChd) perParts.push('+' + formatGermanNumber(def.perStackChd) + '% CHD');
                    if (def.perStackAmp) perParts.push('+' + formatGermanNumber(def.perStackAmp) + '% verstärkt');
                    if (def.perStackRof) perParts.push('+' + formatGermanNumber(def.perStackRof) + '% RoF');
                    if (def.perStackHsd) perParts.push('+' + formatGermanNumber(def.perStackHsd) + '% HSD');
                    const inp = document.getElementById('exoticWStackUtil_' + slug)?.value;
                    const val = (inp !== undefined && inp !== '') ? escapeHtml(inp) : '100';
                    html += '<div class="flex items-center gap-2 text-xs text-gray-300">';
                    html += '<input type="range" min="0" max="100" step="5" value="' + val + '" id="exoticWStackUtil_' + slug + '" oninput="document.getElementById(\'exoticWStackUtilVal_' + slug + '\').textContent = this.value + \'%\';" onchange="if (lastComparisonData && lastComparisonData.length) calculateCombinedComparison();" class="flex-1 accent-orange-500">';
                    html += '<span id="exoticWStackUtilVal_' + slug + '" class="font-mono text-amber-400 w-10 text-right">' + val + '%</span>';
                    html += '</div>';
                    html += '<p class="text-[10px] text-gray-500">Stacks: max. ' + def.maxStacks + ' × ' + perParts.join(' & ') + ' — ' + escapeHtml(def.note) + '</p>';
                } else if (def.ampFromStatusFactor) {
                    const inp = document.getElementById('exoticStatusBonus')?.value;
                    const val = (inp !== undefined && inp !== '') ? escapeHtml(inp) : '0';
                    html += '<div class="flex items-center gap-2 text-xs text-gray-300">';
                    html += '<label class="whitespace-nowrap">Statuseffekt-Bonus (%):</label>';
                    html += '<input type="number" min="0" step="0.5" value="' + val + '" id="exoticStatusBonus" onchange="if (lastComparisonData && lastComparisonData.length) calculateCombinedComparison();" class="w-20 p-1 rounded-lg bg-zinc-800 border border-gray-700">';
                    html += '</div>';
                    html += '<p class="text-[10px] text-gray-500">' + escapeHtml(def.note) + '</p>';
                } else {
                    html += '<p class="text-[10px] text-gray-500">' + (parts.length ? parts.join(' · ') + ' — ' : '') + escapeHtml(def.note) + '</p>';
                }
                html += '</div>';
            });
            wrap.innerHTML = html;
        }
        // Issue #41-Follow-up: Perk-Schadensbeitrag eines Exoten-Teils für
        // die Vorauswahl (gearItemScore/prefilterItemScore). Nutzt dieselben
        // Annahmen wie computeBuildCache: Coyote-Distanz-Zone aus dem
        // Dropdown, Stack-Perks aus dem Auslastungs-Slider, bedingte Perks
        // gelten als aktiv (wie „Bedingte Talente aktiv“). Liefert null,
        // wenn die Perks global deaktiviert sind.
        function exoticPerkScoreBonus(item) {
            if (typeof EXOTIC_GEAR_PERKS === 'undefined' || !item || !item.setName) return null;
            const def = EXOTIC_GEAR_PERKS[item.setName];
            if (!def) return null;
            if (isExoticGearDisabled(item)) return null;
            const activeEl = (typeof document !== 'undefined') && document.getElementById('exoticPerksActive');
            if (activeEl && !activeEl.checked) return null;
            let bonus = { wd: 0, chc: 0, chd: 0, amp: 0, rof: 0 };
            if (def.byDistance) {
                const zone = (typeof document !== 'undefined' && document.getElementById('coyoteDistance')?.value) || 'mid';
                const z = def.byDistance[zone] || def.byDistance.mid;
                bonus.chc += z.chc || 0; bonus.chd += z.chd || 0;
            } else if (def.perStackWd) {
                let utilization = 100;
                if (typeof document !== 'undefined') {
                    const slider = document.getElementById('exoticStackUtil_' + slugify(item.setName));
                    if (slider && slider.value !== '' && !isNaN(parseLocalizedFloat(slider.value))) {
                        utilization = parseLocalizedFloat(slider.value);
                    } else {
                        utilization = parseLocalizedFloat(document.getElementById('stackUtilization')?.value, 100);
                    }
                    if (utilization < 0) utilization = 100;
                    if (utilization > 100) utilization = 100;
                }
                bonus.wd += Math.round(def.maxStacks * (utilization / 100)) * def.perStackWd;
            } else if (def.chdPerRedAttr) {
                bonus.chd += def.chdPerRedAttr;
            } else {
                bonus.wd += def.wd || 0; bonus.chd += def.chd || 0; bonus.amp += def.amp || 0; bonus.rof += def.rof || 0;
            }
            return bonus;
        }
        function slugify(s) {
            return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        }
        // ===== Issue #41: Exoten-Zwang für den Vergleich =====
        // Füllt die beiden Dropdowns „Exotisches Gear erzwingen“ und
        // „Exotische Waffe erzwingen“ aus den Inventaren. Nur Exoten
        // (GEAR_DB cls==='exotic' bzw. weapon.isExotic) erscheinen zur
        // Auswahl; die aktuelle Auswahl bleibt erhalten, wenn das Item
        // noch existiert.
        // ===== FIXIEREN / EXOTEN ABWAEHLEN (#108 D) =====
        const pinnedWeaponIds = new Set();
        const pinnedGearIds = new Set();
        const disabledExoticGear = new Set();
        const disabledExoticWeapons = new Set();

        function pinnedGearItems() {
            return gearInventory.filter(i => pinnedGearIds.has(String(i.id)));
        }
        function markPinnedStale() {
            if (typeof markComparisonStale === 'function') markComparisonStale();
            if (typeof updateSetAvailability === 'function') updateSetAvailability();
        }
        function pinnedGearLabel(item) {
            const base = `${item.setName} (${item.slot})`;
            const attrs = [];
            // Kernattribut zuerst (z.B. "Waffenschaden 15"), damit der Anwender
            // auf einen Blick sieht, ob Kern + alle Attribute auf Max sind.
            const coreType = (typeof gearCoreTypeOf === 'function') ? gearCoreTypeOf(item) : (item.coreType || 'wd');
            const coreVal = item.coreVal != null ? item.coreVal : (coreType === 'wd' ? (item.wd || 0) : 0);
            if (coreVal > 0) attrs.push(`${gearCoreLabel(coreType)} ${formatGermanNumber(coreVal)}`);
            if (item.namedKey) attrs.push(`${item.namedKey} ${formatGermanNumber(item.namedVal || 0)}%`);
            const sig = (typeof gearAttrSig === 'function') ? gearAttrSig(item) : '';
            const last = sig ? sig.split('|').pop() : '';
            if (last) attrs.push(last);
            const god = (typeof isGearGodRoll === 'function') && isGearGodRoll(item);
            const suffix = god ? ' — ★ God-Roll' : '';
            return attrs.length ? `${base} — ${attrs.join(', ')}${suffix}` : `${base}${suffix}`;
        }
        // #108 D: God-Roll-Erkennung für Inventar-Teile (ohne Formular-Kontext).
        // Kern auf Max (WD 15 / Rüstung 170k / Skill 1; Prototyp ×1,5) und
        // ALLE vorgesehenen Attribut-Slots auf ihrem Max (GEAR_ATTR_TYPES bzw.
        // fixer DB-Wert bei Named/Exoten). God-Roll nur, wenn die Anzahl der
        // erfassten Attribute der Soll-Anzahl der Klasse entspricht:
        // Named/Exotic = fixed + free (DB), grüne Gear-Sets = 1 Minor,
        // Brand-/Standard-Teile = 2 Minors. Unbekannte Maxima (null) disqualifizieren nicht.
        function gearExpectedAttrCount(item) {
            if (!item || !item.setName) return null;
            const name = (item.setName + '').toLowerCase().replace(/’/g, "'");
            const dbKey = (typeof GEAR_DB !== 'undefined') && Object.keys(GEAR_DB).find(n => n.toLowerCase() === name);
            if (dbKey) {
                const e = GEAR_DB[dbKey];
                return (e.fixed || []).length + (e.free || 0);
            }
            if (isGreenGearName(name)) return 1;
            return 2;
        }
        // Prototyp-Flag fuer die God-Roll-Pruefung: explizites item.proto hat
        // Vorrang; fehlt es, wird es aus ueber-High-End-Max liegenden Werten
        // rekonstruiert (Kern WD > 15 bzw. Minor > GEAR_ATTR_TYPES.max).
        function gearProtoRollFlag(item) {
            if (!item) return false;
            if (item.proto != null) return !!item.proto;
            const coreType = (typeof gearCoreTypeOf === 'function') ? gearCoreTypeOf(item) : (item.coreType || 'wd');
            const coreVal = item.coreVal != null ? item.coreVal : (coreType === 'wd' ? (item.wd || 0) : 0);
            if (coreType === 'wd' && coreVal > GEAR_CORE_WD_MAX + 1e-9) return true;
            const attrs = (typeof gearItemAttrs === 'function') ? gearItemAttrs(item) : [];
            return attrs.some(a => {
                const cfg = (typeof GEAR_ATTR_TYPES !== 'undefined') ? GEAR_ATTR_TYPES[a.type] : null;
                return cfg && cfg.max != null && a.val > cfg.max + 1e-9;
            });
        }
        // True, wenn der setName zu einem grünen Gear-Set gehört (Named/Exotic
        // aus der DB werden vorher separat behandelt).
        function isGreenGearName(name) {
            const n = (name || '').toLowerCase().replace(/’/g, "'");
            if (!n) return false;
            return (typeof GREEN_SET_MATCH !== 'undefined') && Object.keys(GREEN_SET_MATCH).some(key => (GREEN_SET_MATCH[key] || []).some(f => n.includes(f)));
        }
        function isGearGodRoll(item) {
            if (!item) return false;
            // Konsistenz-Check wie beim CSV-Import: Liegt ein Wert über dem
            // High-End-Maximum, ist es ein Prototyp-Roll (x1,5). Ein Teil mit
            // Proto-Werten, aber fehlendem proto-Flag (z.B. alter Import oder
            // nachtraeglich entfernter Haken), wird wie ein Prototyp geprueft -
            // gegen die Proto-Maxima. Umgekehrt ist ein als Prototyp markiertes
            // Teil mit reinen High-End-Werten kein God-Roll.
            const proto = gearProtoRollFlag(item);
            const coreType = (typeof gearCoreTypeOf === 'function') ? gearCoreTypeOf(item) : (item.coreType || 'wd');
            const coreVal = item.coreVal != null ? item.coreVal : (coreType === 'wd' ? (item.wd || 0) : 0);
            let coreOk = false;
            if (coreType === 'wd') coreOk = coreVal >= (proto ? 22.5 : 15) - 1e-9;
            else if (coreType === 'armour') coreOk = coreVal >= (proto ? 255000 : 170000) - 1e-9;
            else if (coreType === 'skill') coreOk = coreVal >= (proto ? 1.5 : 1) - 1e-9;
            else coreOk = true;
            if (!coreOk) return false;
            const dbE = (typeof GEAR_DB !== 'undefined') ? GEAR_DB[item.setName] : null;
            const fixedMap = {};
            (dbE && dbE.fixed || []).forEach(f => { fixedMap[f[0]] = f[1]; });
            const attrs = (typeof gearItemAttrs === 'function') ? gearItemAttrs(item) : [];
            const expected = (typeof gearExpectedAttrCount === 'function') ? gearExpectedAttrCount(item) : null;
            if (expected !== null && attrs.length < expected) return false;
            const protoFactor = proto ? GEAR_PROTO_FACTOR : 1;
            return attrs.every(a => {
                let max = null;
                if (fixedMap[a.type] != null) max = fixedMap[a.type] * protoFactor;
                else {
                    const cfg = (typeof GEAR_ATTR_TYPES !== 'undefined') ? GEAR_ATTR_TYPES[a.type] : null;
                    if (cfg && cfg.max !== null) max = cfg.max * protoFactor;
                }
                if (max === null) return true;
                return a.val >= max - 1e-9;
            });
        }
        function syncPinnedFromSelect(kind) {
            // Kompatibilitaet: uebernimmt die Auswahl in die internen Sets.
            const sel = document.getElementById(kind === 'gear' ? 'pinnedGearIds' : 'pinnedWeaponIds');
            if (!sel) return;
            const ids = [...sel.selectedOptions].map(o => o.value);
            const target = (kind === 'gear') ? pinnedGearIds : pinnedWeaponIds;
            target.clear();
            ids.forEach(id => target.add(id));
            renderPinnedUI();
        }
        function clearPinned() {
            pinnedGearIds.clear();
            pinnedWeaponIds.clear();
            renderPinnedUI();
            markPinnedStale();
        }
        // ===== FIXIEREN: SLOT-KACHELN (#120) =====
        const PIN_SLOT_ORDER = ['Maske', 'Weste', 'Rucksack', 'Handschuhe', 'Holster', 'Knieschoner'];
        const PIN_SLOT_ICONS = { 'Maske': '🎭', 'Weste': '🦺', 'Rucksack': '🎒', 'Handschuhe': '🧤', 'Holster': '🔫', 'Knieschoner': '🦵' };
        // Auswählbare Teile für einen Slot (glebe Filter-Logik wie bisher:
        // Fremd-Set-Teile des Ziel-Sets werden ausgeblendet).
        function pinSlotCandidates(slot) {
            const targetKey = (document.getElementById('targetGreenSet') || {}).value || '';
            const seen = new Set();
            return gearInventory.filter(i => {
                if (i.slot !== slot) return false;
                const k = String(i.id);
                if (seen.has(k)) return false;
                seen.add(k);
                if (GEAR_DB[i.setName]) return true;
                if (isGreenGearName(i.setName)) {
                    return !targetKey || brandKeyMatches((i.setName || '').toLowerCase(), targetKey);
                }
                return true;
            });
        }
        function pinSlotTileId(slot) { return 'pinSlot-' + slot; }
        function pinnedItemForSlot(slot) {
            return gearInventory.find(i => pinnedGearIds.has(String(i.id)) && i.slot === slot) || null;
        }
        function pinTileCoreLabel(item) {
            const coreType = (typeof gearCoreTypeOf === 'function') ? gearCoreTypeOf(item) : (item.coreType || 'wd');
            if (gearIsTriCoreItem && gearIsTriCoreItem(item)) return 'WD+Rüst+Skill';
            const ct = (typeof GEAR_CORE_TYPES !== 'undefined') ? (GEAR_CORE_TYPES[coreType] || {}) : {};
            const icon = ct.icon || '';
            if (coreType === 'wd') return `${icon} +${formatGermanNumber(item.wd || 0)}%`;
            if (coreType === 'armour') return `${icon} ${formatGermanNumber(item.coreVal || 0)}`;
            if (coreType === 'skill') return `${icon} +${formatGermanNumber(gearSkillTiersOf ? gearSkillTiersOf(item) : (item.coreVal != null ? item.coreVal : 1))}${item.proto ? ' (P)' : ''}`;
            return '';
        }
        function pinTileAttrLabel(item) {
            return gearItemAttrs(item).slice(0, 2).map(a => {
                const cfg = (typeof GEAR_ATTR_TYPES !== 'undefined') ? GEAR_ATTR_TYPES[a.type] : null;
                const label = cfg ? cfg.label : a.type;
                return `${label} ${formatGermanNumber(a.val)}`;
            }).join(' · ');
        }
        function renderPinnedSlotTiles() {
            const wrap = document.getElementById('pinnedSlotTiles');
            if (!wrap) return;
            wrap.innerHTML = PIN_SLOT_ORDER.map(slot => {
                const item = pinnedItemForSlot(slot);
                if (item) {
                    const god = isGearGodRoll(item);
                    return `<div id="${pinSlotTileId(slot)}" onclick="openPinSlotPicker('${escapeHtml(slot)}')" title="${escapeHtml(pinnedGearLabel(item))}" class="pinned-tile">
                        <button type="button" onclick="event.stopPropagation(); removePinnedGearItemBySlot('${escapeHtml(slot)}')" aria-label="${escapeHtml(slot)}-Fixierung aufheben" class="pin-tile-remove">×</button>
                        <div class="text-[10px] uppercase text-gray-400">${PIN_SLOT_ICONS[slot] || ''} ${escapeHtml(slot)}${god ? ' <span class="text-amber-400">★</span>' : ''}</div>
                        <div class="text-xs font-semibold text-white truncate">${escapeHtml(item.setName)}</div>
                        <div class="text-[10px] text-gray-300 truncate">${escapeHtml(pinTileCoreLabel(item))}</div>
                        <div class="text-[10px] text-gray-400 truncate">${escapeHtml(pinTileAttrLabel(item))}</div>
                    </div>`;
                }
                return `<button type="button" id="${pinSlotTileId(slot)}" onclick="openPinSlotPicker('${escapeHtml(slot)}')" class="pinned-tile-empty">
                    <div class="text-[10px] uppercase text-gray-400">${PIN_SLOT_ICONS[slot] || ''} ${escapeHtml(slot)}</div>
                    <div class="text-sm text-gray-500">＋</div>
                </button>`;
            }).join('');
        }
        function removePinnedGearItemBySlot(slot) {
            const item = pinnedItemForSlot(slot);
            if (!item) return;
            pinnedGearIds.delete(String(item.id));
            renderPinnedUI();
            markPinnedStale();
        }
        // Slot-Auswahl (Popover): zeigt nur Teile dieses Slots, Suche inklusive.
        function openPinSlotPicker(slot) {
            closePinSlotPicker();
            const anchor = document.getElementById(pinSlotTileId(slot));
            if (!anchor) return;
            const pop = document.createElement('div');
            pop.id = 'pinSlotPicker';
            pop.className = 'fixed z-50 bg-zinc-900 border border-gray-700 rounded-xl shadow-xl p-2 w-72 max-h-72 overflow-auto';
            const candidates = pinSlotCandidates(slot);
            const god = candidates.filter(isGearGodRoll).length;
            const search = `<input type="text" id="pinSlotPickerSearch" oninput="filterPinSlotPickerOptions()" placeholder="${escapeHtml(slot)} durchsuchen…" class="w-full p-1.5 mb-1 rounded-lg text-xs bg-zinc-800 border border-gray-700" aria-label="${escapeHtml(slot)} durchsuchen">`;
            const list = candidates.length
                ? `<div id="pinSlotPickerList">` + candidates.map(i =>
                    `<button type="button" data-id="${escapeHtml(String(i.id))}" data-label="${escapeHtml(pinnedGearLabel(i).toLowerCase() + ' ' + slot.toLowerCase())}" onclick="selectPinnedGearItem('${escapeHtml(String(i.id))}');" class="w-full text-left px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-[11px] ${isGearGodRoll(i) ? 'text-amber-400 font-semibold' : 'text-gray-200'}">${escapeHtml(pinnedGearLabel(i))}</button>`
                ).join('') + `</div>`
                : `<p class="text-[11px] text-gray-500 p-2">Keine ${escapeHtml(slot)}-Teile im Inventar.</p>`;
            pop.innerHTML = `<div class="pin-picker-head"><span class="text-xs font-bold uppercase text-gray-400">${escapeHtml(slot)} fixieren ${god ? `<span class="text-amber-400 normal-case font-normal">★ ${god} God-Roll${god > 1 ? 's' : ''}</span>` : ''}</span><button type="button" onclick="closePinSlotPicker()" aria-label="Schließen" class="text-gray-400 hover:text-white">×</button></div>${search}${list}`;
            document.body.appendChild(pop);
            const rect = anchor.getBoundingClientRect();
            const popW = pop.offsetWidth;
            let left = rect.left;
            if (left + popW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - popW - 8);
            pop.style.left = left + 'px';
            let top = rect.bottom + 6;
            if (top + pop.offsetHeight > window.innerHeight - 8) top = Math.max(8, rect.top - pop.offsetHeight - 6);
            pop.style.top = top + 'px';
            if (candidates.length) {
                const inp = pop.querySelector('#pinSlotPickerSearch');
                if (inp) inp.focus();
            }
        }
        function filterPinSlotPickerOptions() {
            const pop = document.getElementById('pinSlotPicker');
            const inp = pop && pop.querySelector('#pinSlotPickerSearch');
            if (!pop || !inp) return;
            const q = inp.value.trim().toLowerCase();
            [...pop.querySelectorAll('#pinSlotPickerList [data-label]')].forEach(b => {
                const match = !q || b.dataset.label.includes(q);
                b.style.display = match ? '' : 'none';
            });
        }
        function selectPinnedGearItem(id) {
            const item = gearInventory.find(i => String(i.id) === String(id));
            if (!item) return;
            // Slot-Kachel: vorheriges Teil im selben Slot ersetzen -> Konflikte praeventiv vermeiden
            const prev = pinnedItemForSlot(item.slot);
            if (prev) pinnedGearIds.delete(String(prev.id));
            pinnedGearIds.add(String(item.id));
            closePinSlotPicker();
            renderPinnedUI();
            markPinnedStale();
        }
        function closePinSlotPicker() {
            const pop = document.getElementById('pinSlotPicker');
            if (pop) pop.remove();
        }
        document.addEventListener('click', (e) => {
            const pop = document.getElementById('pinSlotPicker');
            if (pop && !pop.contains(e.target) && !e.target.closest('#pinnedSlotTiles')) pop.remove();
        });
        // ===== FIXIEREN: WAFFEN-KARTEN (#120) =====
        function renderPinnedWeaponCards() {
            const wrap = document.getElementById('pinnedWeaponCards');
            if (!wrap) return;
            const seen = new Set();
            const weapons = weaponsInventory.filter(w => {
                const k = String(w.id);
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
            });
            if (!weapons.length) { wrap.innerHTML = '<p class="text-[11px] text-gray-500">Keine Waffen im Inventar.</p>'; return; }
            wrap.innerHTML = weapons.map(w => {
                const sel = pinnedWeaponIds.has(String(w.id));
                return `<button type="button" onclick="togglePinnedWeapon('${escapeHtml(String(w.id))}');" aria-pressed="${sel}" class="pinned-weapon-card${sel ? ' active' : ''}">${escapeHtml(w.name)}${w.isExotic ? ' <span class="text-amber-400">★</span>' : ''}${sel ? ' <span class="div-accent">✓</span>' : ''}</button>`;
            }).join('');
        }
        function togglePinnedWeapon(id) {
            const k = String(id);
            if (pinnedWeaponIds.has(k)) pinnedWeaponIds.delete(k);
            else pinnedWeaponIds.add(k);
            renderPinnedUI();
            markPinnedStale();
        }
        function isExoticGearDisabled(item) {
            return !!(item && item.setName && disabledExoticGear.has(item.setName));
        }
        function updateForceExoticOptions() {
            renderPinnedUI();
            renderDisabledExoticToggles();
            markPinnedStale();
        }
        // Fixierte Gear-Teile als Chips darstellen (Sichtbarkeit + 1-Klick-Entfernung).
        // Slot-Konflikte (mehrere fixierte Teile im selben Slot) werden rot markiert.
        function renderPinnedGearChips() {
            const wrap = document.getElementById('pinnedGearChips');
            if (!wrap) return;
            const items = pinnedGearItems();
            if (!items.length) { wrap.innerHTML = ''; return; }
            const slotCount = {};
            items.forEach(i => { slotCount[i.slot] = (slotCount[i.slot] || 0) + 1; });
            wrap.innerHTML = items.map(i => {
                const conflict = slotCount[i.slot] > 1;
                const tip = conflict ? ` title="Slot ${escapeHtml(i.slot)} ist mehrfach fixiert — im Build passt nur ein Teil pro Slot"` : '';
                return `<span${tip} class="inline-flex items-center gap-1 text-[11px] pl-2 pr-1 py-0.5 rounded-full border ${conflict ? 'bg-red-500/10 border-red-500/50 text-red-300' : 'bg-zinc-800 border-gray-700 text-gray-200'}">${isGearGodRoll(i) ? '<span class="text-amber-400">★</span> ' : ''}${escapeHtml(i.setName)} (${escapeHtml(i.slot)})<button type="button" onclick="removePinnedGearItem('${String(i.id)}')" aria-label="Fixierung aufheben" class="w-4 h-4 leading-none rounded-full bg-zinc-700 hover:bg-red-600 text-gray-300 hover:text-white">×</button></span>`;
            }).join('');
        }
        function removePinnedGearItem(id) {
            const k = String(id);
            pinnedGearIds.delete(k);
            const sel = document.getElementById('pinnedGearIds');
            if (sel) [...sel.options].forEach(o => { if (o.value === k) o.selected = false; });
            renderPinnedUI();
            markPinnedStale();
        }
        // Suchfeld: Optionen im Pin-Dropdown nach Name/Slot/Attribut filtern.
        function filterPinnedGearOptions() {
            const sel = document.getElementById('pinnedGearIds');
            const searchEl = document.getElementById('pinnedGearSearch');
            if (!sel || !searchEl) return;
            const q = searchEl.value.trim().toLowerCase();
            [...sel.querySelectorAll('option')].forEach(o => {
                const t = o.textContent.toLowerCase();
                const slot = (o.closest('optgroup') || {}).label || '';
                const match = !q || t.includes(q) || slot.toLowerCase().includes(q);
                o.hidden = !match;
                o.disabled = !match;
            });
        }
        // ===== FIXIEREN: LIVE-FEEDBACK (#120) =====
        // Set-Zaehler (z.B. "Striker 2/6 fixiert") + Warnhinweise, wenn die
        // Fixierung mit require4pc / forceChest / forceBackpack kollidiert.
        function renderPinnedSetCounter() {
            const wrap = document.getElementById('pinnedSetCounter');
            if (!wrap) return;
            const items = pinnedGearItems();
            if (!items.length) { wrap.innerHTML = ''; return; }
            const setCount = {};
            items.forEach(i => { setCount[i.setName] = (setCount[i.setName] || 0) + 1; });
            const sel = document.getElementById('targetGreenSet');
            const key = sel ? sel.value : '';
            const info = (typeof GREEN_SET_INFO !== 'undefined') ? GREEN_SET_INFO[key] : null;
            const warnings = [];
            if (key && info) {
                const setKey = (i) => brandKeyMatches((i.setName || '').toLowerCase(), key);
                const pinnedSetCount = items.filter(setKey).length;
                if (pinnedSetCount) {
                    const need4 = document.getElementById('require4pc')?.checked;
                    if (need4 && pinnedSetCount > 4) warnings.push(`mehr als 4 ${escapeHtml(info.name)}-Teile fixiert — „4 Set-Teile erzwingen“ erlaubt nur 4`);
                    const setPiecesTotal = gearInventory.filter(i => setKey(i)).length;
                    if (need4 && setPiecesTotal < 4) warnings.push(`4 Set-Teile erzwungen, aber nur ${setPiecesTotal} ${escapeHtml(info.name)}-Teile im Inventar`);
                } else {
                    if (document.getElementById('require4pc')?.checked) warnings.push(`fixierte Teile sind kein ${escapeHtml(info.name)} — „4 Set-Teile erzwingen“ benötigt 4 weitere Set-Teile in den übrigen Slots`);
                }
                if (document.getElementById('forceChest')?.checked) {
                    const pinnedChest = items.find(i => i.slot === 'Weste');
                    if (pinnedChest && !setKey(pinnedChest)) warnings.push(`fixierte Weste (${escapeHtml(pinnedChest.setName)}) ist keine ${escapeHtml(info.name)}-Weste — kollidiert mit „Weste aus diesem Set erzwingen“`);
                }
                if (document.getElementById('forceBackpack')?.checked) {
                    const pinnedBp = items.find(i => i.slot === 'Rucksack');
                    if (pinnedBp && !setKey(pinnedBp)) warnings.push(`fixierter Rucksack (${escapeHtml(pinnedBp.setName)}) ist kein ${escapeHtml(info.name)}-Rucksack — kollidiert mit „Rucksack aus diesem Set erzwingen“`);
                }
            }
            const chips = Object.entries(setCount).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de')).map(([n, c]) => `${escapeHtml(n)} ${c}/6`);
            const warnHtml = warnings.length ? `<div class="pin-set-warn">⚠️ ${warnings.join(' · ')}</div>` : '';
            wrap.innerHTML = `<div class="flex flex-wrap gap-1">${chips.map(c => `<span class="text-[11px] px-2 py-0.5 rounded-full border bg-zinc-800 border-gray-700 text-gray-200">${c}</span>`).join('')}</div>${warnHtml}`;
        }
        function renderPinnedUI() {
            renderPinnedSlotTiles();
            renderPinnedGearChips();
            renderPinnedWeaponCards();
            renderPinnedSetCounter();
        }
        function renderDisabledExoticToggles() {
            const gearWrap = document.getElementById('disabledExoticGearWrap');
            const weapWrap = document.getElementById('disabledExoticWeaponWrap');
            if (gearWrap) {
                const names = [...new Set(gearInventory.map(i => i.setName).filter(isExoticGearName))].sort((a, b) => a.localeCompare(b, 'de'));
                gearWrap.innerHTML = names.map(n =>
                    `<button type="button" data-ex="${escapeHtml(n)}" onclick="toggleExoticGearDisabled(this)" class="text-[11px] px-2 py-1 rounded-full border ${disabledExoticGear.has(n) ? 'bg-zinc-700 border-gray-500 text-gray-400 line-through' : 'bg-zinc-800 border-gray-700 text-gray-200'}">${escapeHtml(n)}</button>`
                ).join('') || '<span class="text-[11px] text-gray-500">Keine Exoten im Gear-Inventar</span>';
            }
            if (weapWrap) {
                const seen = new Set();
                const weapons = weaponsInventory.filter(w => {
                    if (!w.isExotic || seen.has(w.name)) return false;
                    seen.add(w.name);
                    return true;
                });
                weapWrap.innerHTML = weapons.map(w =>
                    `<button type="button" data-ex="${escapeHtml(String(w.id))}" onclick="toggleExoticWeaponDisabled(this)" class="text-[11px] px-2 py-1 rounded-full border ${disabledExoticWeapons.has(String(w.id)) ? 'bg-zinc-700 border-gray-500 text-gray-400 line-through' : 'bg-zinc-800 border-gray-700 text-gray-200'}">${escapeHtml(w.name)}</button>`
                ).join('') || '<span class="text-[11px] text-gray-500">Keine Exoten im Waffen-Inventar</span>';
            }
        }
        function toggleExoticGearDisabled(btn) {
            const n = btn.dataset.ex;
            if (disabledExoticGear.has(n)) disabledExoticGear.delete(n);
            else disabledExoticGear.add(n);
            renderDisabledExoticToggles();
            markPinnedStale();
        }
        function toggleExoticWeaponDisabled(btn) {
            const id = String(btn.dataset.ex);
            if (disabledExoticWeapons.has(id)) disabledExoticWeapons.delete(id);
            else disabledExoticWeapons.add(id);
            renderDisabledExoticToggles();
            markPinnedStale();
        }
        function isExoticGearName(name) {
            const e = GEAR_DB[name];
            return !!e && e.cls === 'exotic';
        }

        // Waffen-Talente
        const WEAPON_TALENTS = {
    'perfekter_brotkorb': { label: 'Perfekter Brotkorb (Kopfschuss-Schaden)', type: null, valueNormal: 0, valueNamed: 0, note: 'Treffer am Körper fügen einen Stack von +55% (70%) Kopfschuss-Schaden zum nächsten Kopfschuss für 10s hinzu. Maximal 3 (2) Stacks.' },
    'perfekter_killer': { label: 'Perfekter Killer (Kritischer Trefferschaden)', type: 'chd', valueNormal: 90, valueNamed: 90, conditional: true, condition: 'nach Kill per Krit-Treffer (10s aktiv)', note: 'Das Töten eines Gegners mit einem kritischen Treffer gewährt +70% (90%) kritischen Trefferschaden für 10s.' },
    'perfekte_bewahrung': { label: 'Perfekte Bewahrung (Nutzen)', type: null, valueNormal: 0, valueNamed: 0, note: 'Das Töten eines Gegners repariert 10% (15%) Rüstung über 5s. Kopfschuss-Tötungen verbessern die Reparatur um zusätzliche 10% (15%).' },
    'perfekter_optimist': { label: 'Perfekter Optimist (Waffen-Schaden)', type: 'wd', valueNormal: 45, valueNamed: 45, conditional: true, condition: 'leeres Magazin (+4,5% je 10% fehlende Munition)', note: 'Schadensausgabe der Waffe wird um +3,5% (4,5%) für jede 10% Munition, die im Magazin fehlt, erhöht.' },
    'perfekt_angespannt': { label: 'Perfekt angespannt (Kritischer Trefferschaden)', type: 'chd', valueNormal: 80, valueNamed: 80, conditional: true, condition: 'während des Feuerns (max. 8 Stacks)', note: 'Erhalte +10% kritischen Trefferschaden für jede 0,5s, die du schießt. Stackt bis zu 5 (8) Mal.' },
    'perfekt_nahkampf': { label: 'Perfekt Nahkampf (Waffen-Schaden)', type: 'wd', valueNormal: 38, valueNamed: 38, conditional: true, condition: 'nach Kill im Nahbereich 7m (10s aktiv)', note: 'Das Töten eines Ziels im Nahbereich (7m) gewährt +30% (38%) Waffen-Schaden für 10s.' },
    'perfekte_schnelle_hande': { label: 'Perfekte schnelle Hände (Nutzen)', type: null, valueNormal: 0, valueNamed: 0, note: 'Kritische Treffer fügen einen Stack von +3% (5%) Nachlade-Geschwindigkeit hinzu. Maximal 40 Stacks.' },
    'perfekter_sadist': { label: 'Perfekter Sadist (Verstärker)', type: 'amp', valueNormal: 35, valueNamed: 35, conditional: true, condition: 'nur gegen blutende Ziele', note: 'Verstärkt den Waffen-Schaden um +30% (35%) gegen blutende Gegner. Nach 4 (3) Tötungen wird Blutung auf den nächsten Gegner angewendet, den du triffst.' },
    'perfekt_blind': { label: 'Perfekt blind (Verstärker)', type: 'amp', valueNormal: 35, valueNamed: 35, conditional: true, condition: 'nur gegen geblendete Ziele', note: 'Verstärkt den Waffen-Schaden um +30% (35%) gegen geblendete Gegner. Nach 4 (3) Tötungen wird Blindheit auf den nächsten Gegner angewendet, den du triffst.' },
    'perfekt_entzundet': { label: 'Perfekt entzündet (Verstärker)', type: 'amp', valueNormal: 30, valueNamed: 30, conditional: true, condition: 'nur gegen brennende Ziele', note: 'Verstärkt den Waffen-Schaden um +25% (30%) gegen brennende Gegner. Nach 4 (3) Tötungen wird Brennen auf den nächsten Gegner angewendet, den du triffst.' },
    'perfekt_rachsuchtig': { label: 'Perfekt rachsüchtig (Kritische Trefferchance / Schaden)', type: 'chcchd', valueNormal: 21, valueNamed: 21, conditional: true, condition: 'nach Kill mit Status-Effekt (20s aktiv)', note: 'Das Töten eines Gegners mit einem Status-Effekt gewährt dir und allen Verbündeten im Umkreis von 15m (20m) +16% (21%) kritische Trefferchance und +16% (21%) kritischen Trefferschaden für 20s.' },
    'perfekter_schutze': { label: 'Perfekter Schütze (Verstärker)', type: 'amp', valueNormal: 13, valueNamed: 13, conditional: true, condition: 'distanzabhängig: 2% je 3m Entfernung (hier: 20m)', note: 'Verstärkt den Waffen-Schaden um 2% für jede 4m (3m), die du von deinem Ziel entfernt bist.' },
    'perfekt_stabil': { label: 'Perfekt stabil (Nutzen)', type: null, valueNormal: 0, valueNamed: 0, note: 'Treffer gewähren einen Stack von +1% Genauigkeit und Stabilität. Bei 100 (75) Stacks werden die Stacks verbraucht, um das Magazin nachzufüllen.' },
    'perfekter_spike': { label: 'Perfekter Spike (Fähigkeiten-Schaden)', type: null, valueNormal: 0, valueNamed: 0, note: 'Kopfschüsse gewähren +20% (25%) Fähigkeiten-Schaden für 15s.' },
    'perfekte_verlangerung': { label: 'Perfekte Verlängerung (Status-Effekt)', type: null, valueNormal: 0, valueNamed: 0, note: 'Kopfschüsse gewähren +75% Status-Effekt-Schaden und -Dauer für den nächsten Status-Effekt, den du anwendest. Abklingzeit: 20s (16s).' },
    'perfekte_reformation': { label: 'Perfekte Reformation (Fähigkeiten-Reparatur)', type: null, valueNormal: 0, valueNamed: 0, note: 'Kopfschüsse gewähren +60% (80%) Fähigkeiten-Reparatur für 15s.' },
    'perfekte_zukunft': { label: 'Perfekte Zukunft (Nutzen)', type: null, valueNormal: 0, valueNamed: 0, note: 'Waffen-Tötungen gewähren +1 Fähigkeiten-Stufe für 15s (19s). Stackt bis zu 3 (4) Mal. Waffen-Tötungen bei Fähigkeiten-Stufe 6 gewähren Überladung für 15s. Überladungs-Abklingzeit: 90s.' },
    'perfekte_flachlage': { label: 'Perfekte Flachlage (Verstärker)', type: 'amp', valueNormal: 20, valueNamed: 20, conditional: true, condition: 'nur gegen gepulste Ziele', note: 'Verstärkt den Waffen-Schaden um 15% (20%) gegen gepulste Gegner. Nach 4 (3) Tötungen wird Puls auf den nächsten Gegner angewendet, den du triffst.' },
    'perfekter_vorschlaghammer': { label: 'Perfekter Vorschlaghammer (Verstärker (nur gegen Rüstung))', type: 'amp', valueNormal: 20, valueNamed: 20, conditional: true, condition: 'nur gegen markierte Ziele (Rüstungsschaden)', note: 'Schadensverursachung mit einer Granate wendet eine Markierung auf das Ziel an. Markierte Ziele erhalten 15% (20%) mehr Schaden an der Rüstung und haben -20% (30%) Bewegungsgeschwindigkeit.' },
    'perfekter_donnerkeil': { label: 'Perfekter Donnerkeil (Verstärker)', type: 'amp', valueNormal: 35, valueNamed: 35, conditional: true, condition: 'nur gegen schockierte Ziele', note: 'Verstärkt den Schaden um 30% (35%) gegen schockierte Ziele. Nach 4 (3) Tötungen wird Schock auf den nächsten Gegner angewendet, den du triffst.' },
    'perfekt_synchronisiert': { label: 'Perfekt synchronisiert (Waffen-Schaden / Fähigkeiten-Schaden)', type: 'wd', valueNormal: 20, valueNamed: 20, conditional: true, condition: 'Fertigkeit kürzlich genutzt oder getroffen (5s aktiv)', note: 'Das Treffen eines Gegners gewährt +15% (20%) Fähigkeiten-Schaden für 5s. Das Verwenden einer Fähigkeit oder das Schädigen eines Gegners mit einer Fähigkeit gewährt +15% (20%) Waffen-Schaden für 5s.' },
    'perfekter_druckpunkt': { label: 'Perfekter Druckpunkt (Verstärker)', type: 'amp', valueNormal: 20, valueNamed: 20, conditional: true, condition: 'nur gegen Ziele unter Status-Effekten', note: 'Verstärkt den Waffen-Schaden um 15% (20%) gegen Gegner unter Status-Effekten.' },
    'perfekte_stromlinie': { label: 'Perfekte Stromlinie (Waffen-Schaden)', type: 'wd', valueNormal: 47, valueNamed: 47, conditional: true, condition: 'solange keine Fertigkeit aktiv oder im Cooldown', note: 'Erhöht den Waffen-Schaden um 42% (47%) (32%/37%), wenn keine Fähigkeiten eingesetzt oder im Cooldown sind.' },
    'perfekt_immobilisieren': { label: 'Perfekt immobilisieren (Verstärker)', type: 'amp', valueNormal: 25, valueNamed: 25, conditional: true, condition: 'nur gegen gefesselte Ziele', note: 'Verstärkt den Waffen-Schaden um 20% (25%) gegen gefesselte Gegner. Nach 4 (3) Tötungen wird Fesseln auf den nächsten Gegner angewendet, den du triffst.' },
    'perfekter_schwachpunkt': { label: 'Perfekter Schwachpunkt (Waffen-Schaden)', type: 'wd', valueNormal: 24, valueNamed: 24, conditional: true, condition: 'nach Zerstören eines Schwachpunkts (15s aktiv)', note: 'Das Zerstören eines Schwachpunkts gewährt 19% (24%) Waffen-Schaden für 15s.' },
    'perfekter_kopfkratzer': { label: 'Perfekter Kopfkratzer (Verstärker)', type: 'amp', valueNormal: 35, valueNamed: 35, conditional: true, condition: 'nur gegen verwirrte Ziele', note: 'Fügt 30% (35%) verstärkten Schaden gegen verwirrte Gegner zu. Nach 4 Tötungen wird Verwirrung auf den nächsten Gegner angewendet, den du triffst.' },
    'brotkorb': { label: 'Brotkorb (Kopfschuss-Schaden)', type: null, valueNormal: 0, valueNamed: 0, note: 'Treffer am Körper fügen einen Stack von +55% Kopfschuss-Schaden zum nächsten Kopfschuss für 10s hinzu. Maximal 3 Stacks.' },
    'killer': { label: 'Killer (Kritischer Trefferschaden)', type: 'chd', valueNormal: 70, valueNamed: 70, conditional: true, condition: 'nach Kill per Krit-Treffer (10s aktiv)', note: 'Das Töten eines Gegners mit einem kritischen Treffer gewährt +70% kritischen Trefferschaden für 10s.' },
    'bewahrung': { label: 'Bewahrung (Nutzen)', type: null, valueNormal: 0, valueNamed: 0, note: 'Das Töten eines Gegners repariert 10% Rüstung über 5s. Kopfschuss-Tötungen verbessern die Reparatur um zusätzliche 10%.' },
    'optimist': { label: 'Optimist (Waffen-Schaden)', type: 'wd', valueNormal: 35, valueNamed: 35, conditional: true, condition: 'leeres Magazin (+3,5% je 10% fehlende Munition)', note: 'Schadensausgabe der Waffe wird um +3,5% für jede 10% Munition, die im Magazin fehlt, erhöht.' },
    'angespannt': { label: 'Angespannt (Kritischer Trefferschaden)', type: 'chd', valueNormal: 50, valueNamed: 50, conditional: true, condition: 'während des Feuerns (max. 5 Stacks)', note: 'Erhalte +10% kritischen Trefferschaden für jede 0,5s, die du schießt. Stackt bis zu 5 Mal.' },
    'raserei': { label: 'Raserei (Waffen-Schaden & Feuerrate)', type: 'wdrof', valueNormal: 3, valueNamed: 3, conditional: true, condition: 'nach leerem Nachladen: je 8 Kugeln Magazin +3% WD & +3% RoF (9s aktiv)', note: 'Je 8 Kugeln Magazinkapazität: +3% Feuerrate und +3% Waffen-Schaden für 9s nach leerem Nachladen. Magazin-abhängig: wird als Ø über den Nachladezyklus berechnet.' },
    'abgemessen': { label: 'Abgemessen (Waffen-Schaden)', type: 'wd', valueNormal: 30, valueNamed: 30, conditional: true, condition: 'Magazin-Ø: obere Hälfte +25% RoF / −25% WD, untere Hälfte −18% RoF / +30% WD', note: 'Die obere Hälfte des Magazins hat +25% Feuerrate und −25% Waffen-Schaden, die untere −18% Feuerrate und +30% Gesamt-Waffen-Schaden. Magazin-abhängig: wird als Ø über das volle Magazin berechnet (Issue #34).' },
    'perfekt_abgemessen': { label: 'Perfekt abgemessen (Waffen-Schaden)', type: 'wd', valueNormal: 40, valueNamed: 40, conditional: true, condition: 'Magazin-Ø: obere Hälfte +30% RoF / −30% WD, untere Hälfte −18% RoF / +40% WD', note: 'Perfect Measured: obere Magazinhälfte +30% RoF / −30% WD, untere −18% RoF / +40% Gesamt-WD. Magazin-abhängig: wird als Ø über das volle Magazin berechnet (Issue #34).' },
    'adaptive_instincts': { label: 'Adaptive Instincts (Kritische Trefferchance / Schaden)', type: 'chcchd', valueNormal: 20, valueNamed: 20, valueChc: 20, valueChd: 50, conditional: true, condition: 'nach 30 Kopfschüssen (45s aktiv)', note: '30 Kopfschüsse gewähren +20% CHC und +50% CHD für 45s. (Alternative Boni: 65 Körpertreffer → +90% WD, 20 Beintreffer → +150% Nachladetempo. Hier modelliert: Kopfschuss-Bonus.)' },
    'nahkampf': { label: 'Nahkampf (Waffen-Schaden)', type: 'wd', valueNormal: 30, valueNamed: 30, conditional: true, condition: 'nach Kill im Nahbereich 7m (10s aktiv)', note: 'Das Töten eines Ziels im Nahbereich (7m) gewährt +30% Waffen-Schaden für 10s.' },
    'schnelle_hande': { label: 'Schnelle Hände (Nutzen)', type: null, valueNormal: 0, valueNamed: 0, note: 'Kritische Treffer fügen einen Stack von +3% Nachlade-Geschwindigkeit hinzu. Maximal 40 Stacks.' },
    'sadist': { label: 'Sadist (Verstärker)', type: 'amp', valueNormal: 30, valueNamed: 30, conditional: true, condition: 'nur gegen blutende Ziele', note: 'Verstärkt den Waffen-Schaden um +30% gegen blutende Gegner. Nach 4 Tötungen wird Blutung auf den nächsten Gegner angewendet, den du triffst.' },
    'blind': { label: 'Blind (Verstärker)', type: 'amp', valueNormal: 30, valueNamed: 30, conditional: true, condition: 'nur gegen geblendete Ziele', note: 'Verstärkt den Waffen-Schaden um +30% gegen geblendete Gegner. Nach 4 Tötungen wird Blindheit auf den nächsten Gegner angewendet, den du triffst.' },
    'entzundet': { label: 'Entzündet (Verstärker)', type: 'amp', valueNormal: 25, valueNamed: 25, conditional: true, condition: 'nur gegen brennende Ziele', note: 'Verstärkt den Waffen-Schaden um +25% gegen brennende Gegner. Nach 4 Tötungen wird Brennen auf den nächsten Gegner angewendet, den du triffst.' },
    'rachsuchtig': { label: 'Rachsüchtig (Kritische Trefferchance / Schaden)', type: 'chcchd', valueNormal: 16, valueNamed: 16, conditional: true, condition: 'nach Kill mit Status-Effekt (20s aktiv)', note: 'Das Töten eines Gegners mit einem Status-Effekt gewährt dir und allen Verbündeten im Umkreis von 15m +16% kritische Trefferchance und +16% kritischen Trefferschaden für 20s.' },
    'schutze': { label: 'Schütze (Verstärker)', type: 'amp', valueNormal: 10, valueNamed: 10, conditional: true, condition: 'distanzabhängig: 2% je 4m Entfernung (hier: 20m)', note: 'Verstärkt den Waffen-Schaden um 2% für jede 4m, die du von deinem Ziel entfernt bist.' },
    'stabil': { label: 'Stabil (Nutzen)', type: null, valueNormal: 0, valueNamed: 0, note: 'Treffer gewähren einen Stack von +1% Genauigkeit und Stabilität. Bei 100 Stacks werden die Stacks verbraucht, um das Magazin nachzufüllen.' },
    'spike': { label: 'Spike (Fähigkeiten-Schaden)', type: null, valueNormal: 0, valueNamed: 0, note: 'Kopfschüsse gewähren +20% Fähigkeiten-Schaden für 15s.' },
    'verlangerung': { label: 'Verlängerung (Status-Effekt)', type: null, valueNormal: 0, valueNamed: 0, note: 'Kopfschüsse gewähren +75% Status-Effekt-Schaden und -Dauer für den nächsten Status-Effekt, den du anwendest. Abklingzeit: 20s.' },
    'reformation': { label: 'Reformation (Fähigkeiten-Reparatur)', type: null, valueNormal: 0, valueNamed: 0, note: 'Kopfschüsse gewähren +60% Fähigkeiten-Reparatur für 15s.' },
    'zukunft': { label: 'Zukunft (Nutzen)', type: null, valueNormal: 0, valueNamed: 0, note: 'Waffen-Tötungen gewähren +1 Fähigkeiten-Stufe für 15s. Stackt bis zu 3 Mal. Waffen-Tötungen bei Fähigkeiten-Stufe 6 gewähren Überladung für 15s. Überladungs-Abklingzeit: 90s.' },
    'flachlage': { label: 'Flachlage (Verstärker)', type: 'amp', valueNormal: 15, valueNamed: 15, conditional: true, condition: 'nur gegen gepulste Ziele', note: 'Verstärkt den Waffen-Schaden um 15% gegen gepulste Gegner. Nach 4 Tötungen wird Puls auf den nächsten Gegner angewendet, den du triffst.' },
    'vorschlaghammer': { label: 'Vorschlaghammer (Verstärker (nur gegen Rüstung))', type: 'amp', valueNormal: 15, valueNamed: 15, conditional: true, condition: 'nur gegen markierte Ziele (Rüstungsschaden)', note: 'Schadensverursachung mit einer Granate wendet eine Markierung auf das Ziel an. Markierte Ziele erhalten 15% mehr Schaden an der Rüstung und haben -20% Bewegungsgeschwindigkeit.' },
    'donnerkeil': { label: 'Donnerkeil (Verstärker)', type: 'amp', valueNormal: 30, valueNamed: 30, conditional: true, condition: 'nur gegen schockierte Ziele', note: 'Verstärkt den Schaden um 30% gegen schockierte Ziele. Nach 4 Tötungen wird Schock auf den nächsten Gegner angewendet, den du triffst.' },
    'synchronisiert': { label: 'Synchronisiert (Waffen-Schaden / Fähigkeiten-Schaden)', type: 'wd', valueNormal: 15, valueNamed: 15, conditional: true, condition: 'Fertigkeit kürzlich genutzt oder getroffen (5s aktiv)', note: 'Das Treffen eines Gegners gewährt +15% Fähigkeiten-Schaden für 5s. Das Verwenden einer Fähigkeit oder das Schädigen eines Gegners mit einer Fähigkeit gewährt +15% Waffen-Schaden für 5s.' },
    'druckpunkt': { label: 'Druckpunkt (Verstärker)', type: 'amp', valueNormal: 15, valueNamed: 15, conditional: true, condition: 'nur gegen Ziele unter Status-Effekten', note: 'Verstärkt den Waffen-Schaden um 15% gegen Gegner unter Status-Effekten.' },
    'stromlinie': { label: 'Stromlinie (Waffen-Schaden)', type: 'wd', valueNormal: 42, valueNamed: 42, conditional: true, condition: 'solange keine Fertigkeit aktiv oder im Cooldown', note: 'Erhöht den Waffen-Schaden um 42%, wenn keine Fähigkeiten eingesetzt oder im Cooldown sind.' },
    'immobilisieren': { label: 'Immobilisieren (Verstärker)', type: 'amp', valueNormal: 20, valueNamed: 20, conditional: true, condition: 'nur gegen gefesselte Ziele', note: 'Verstärkt den Waffen-Schaden um 20% gegen gefesselte Gegner. Nach 4 Tötungen wird Fesseln auf den nächsten Gegner angewendet, den du triffst.' },
    'schwachpunkt': { label: 'Schwachpunkt (Waffen-Schaden)', type: 'wd', valueNormal: 19, valueNamed: 19, conditional: true, condition: 'nach Zerstören eines Schwachpunkts (15s aktiv)', note: 'Das Zerstören eines Schwachpunkts gewährt 19% Waffen-Schaden für 15s.' },
    'kopfkratzer': { label: 'Kopfkratzer (Verstärker)', type: 'amp', valueNormal: 30, valueNamed: 30, conditional: true, condition: 'nur gegen verwirrte Ziele', note: 'Fügt 30% verstärkten Schaden gegen verwirrte Gegner zu. Nach 4 Tötungen wird Verwirrung auf den nächsten Gegner angewendet, den du triffst.' },
    'entschlossen': { label: 'Entschlossen (Kopfschuss)', type: null, valueNormal: 0, valueNamed: 0, note: 'Nach einem Kopfschuss-Kill ist der nächste Treffer auf einen beliebigen Gegner ein garantierter kritischer Kopfschuss. (Situativ – nicht numerisch modelliert.)' },
    'von_hinten': { label: 'Von hinten (Verstärker)', type: 'amp', valueNormal: 20, valueNamed: 20, conditional: true, condition: 'nur gegen Gegner, die dich nicht im Visier haben', note: 'Verstärkt den Waffen-Schaden um +20% bei Gegnern, die dich nicht anvisieren.' },
    'erstblut': { label: 'Erstblut (Kopfschuss)', type: null, valueNormal: 0, valueNamed: 0, note: 'Beim Zielen durch ein Visier (8x oder höher) verursacht der erste Schuss aus dem Kampf heraus Kopfschussschaden, egal wo er trifft. (Situativ – nicht numerisch modelliert.)' },
};


        // Green Set Infos
        


        // Stack Damage Config
        const STACK_DAMAGE_CONFIG = {
            striker: {
                name: "Striker's Gamble",
                shortName: "Striker",
                perStackWd: 0.65,
                maxStacks: 100,
                condition: "Waffentreffer erhöhen den Gesamtwaffenschaden; max. 100 Stacks. Verlust: 1 Stack/s (0–50 Stacks), 2 Stacks/s (51–100)",
                sourceNote: "Grundtalent ohne Rucksack-/Weste-Talent",
                chestTalent: { label: "Press the Advantage (Weste)", maxStacks: 200, note: "Verlust 3 Stacks/s (101–200)" },
                backpackTalent: { label: "Risk Management (Rucksack)", perStackWd: 0.90 }
            },
            heartbreaker: {
                name: "Heartstopper",
                shortName: "Heartbreaker",
                perStackWd: 1.1,
                maxStacks: 50,
                condition: "Kopfschüsse pulsen 5s; Treffer auf gepulste Gegner: +1 Stack (+1% Bonus-Rüstung & +1,1% WD auf gepulste Gegner). Max. 50 Stacks, Verlust 2 Stacks/s. WD-Anteil wirkt nur auf gepulste Ziele",
                sourceNote: "Grundtalent ohne Westen-Talent (50 Max-Stacks)",
                chestTalent: { label: "Max BPM (Weste)", maxStacks: 100 },
                backpackTalent: { label: "Cold (Rucksack)", note: "nur Bonus-Rüstung 1% → 2% pro Stack — keine Auswirkung auf den Waffenschaden" }
            },
            concentratedcompany: {
                name: "Camaraderie",
                shortName: "Concentrated Company",
                perStackWd: 3.00,
                perStackChd: 3.00,
                maxStacks: 35,
                condition: "Beschossene Gegner werden markiert (10s, max. 4 Markierungen); stirbt ein markierter Gegner: +1 Stack (3% WD & 3% CHD) je beigetragenem Verbündeten/Skill. Max. 35 Stacks, Verfall alle 10s",
                sourceNote: "Grundtalent ohne Weste-/Rucksack-Talent",
                killBased: true,
                backpackTalent: { label: "One for All (Rucksack)", perStackWd: 6.00 },
                chestTalent: { label: "All for One (Weste)", marks: 8, note: "erhöht nur die Markierungen (4 → 8), keinen numerischen Stack-Bonus" }
            },
            tippingscales: {
                name: "Throttle Control",
                shortName: "Tipping Scales",
                perStackChd: 5,
                perStackWh: 0.5,
                maxStacks: 50,
                condition: "Schießen baut Stacks auf (max. 50); +0,5% Waffenhandhabung & +5% CHD pro Stack; ohne Schießen -6 Stacks/s (kein Verlust bei Suppression)",
                sourceNote: "Grundtalent ohne Weste-/Rucksack-Talent",
                chestTalent: { label: "Sustainability (Weste)", maxStacks: 75 },
                backpackTalent: { label: "Snowball (Rucksack)", perStackChd: 8 }
            },
            umbra: {
                name: "From the Shadows",
                shortName: "Umbra Initiative",
                perStackChd: 1.2,
                perStackRof: 0.4,
                maxStacks: 50,
                condition: "In Deckung: +10 Stacks/s (max. 50, kein Aufbau beim Schießen aus Deckung); jeder Stack +1,2% CHD & +0,4% RPM. Außerhalb: -2 Stacks/s (-1 beim Sprinten). Into the Light (Rucksack-Talent-Baum) = Rüstungsregeneration, kein Schadenseffekt",
                sourceNote: "Grundtalent ohne Westen-Talent (50 Max-Stacks)",
                chestTalent: { label: "From the Shadows (Weste)", maxStacks: 100, note: "auch Stack-Gewinn 10 → 20/s" },
                backpackTalent: { label: "Into the Light (Rucksack)", note: "nur Rüstungsregeneration (Stacks 50→100, Verbrauch 10→20/s) — keine Auswirkung auf den Waffenschaden" },
                stackGainPerSec: 10
            },
            huntersfury: {
                name: "Apex Predator",
                shortName: "Hunter's Fury",
                flatAmp: 20,
                perStackWd: 5,
                maxStacks: 5,
                condition: "Gegner im 15m-Radius erhalten Debuff: +20% verstärkter Schaden gegen sie. Kill eines debufften Gegners: +5% WD für 10s (max. 5 Stacks = +25%). Weste: Dauer 10s → 30s · Rucksack: Desorient-Radius 5m → 10m — beides ohne numerischen Schadenseffekt",
                sourceNote: "Grundtalent: +20% Basis-Verstärkung (multiplikative Gruppe), Kill-Stacks kommen situativ dazu",
                killBased: true,
                chestTalent: { label: "Endless Hunger (Weste)", note: "nur Stack-Dauer 10s → 30s — keine Auswirkung auf die Schadenshöhe" },
                backpackTalent: { label: "Overwhelming Force (Rucksack)", note: "nur Desorient-Radius 5m → 10m — keine Auswirkung auf den Waffenschaden" }
            },
            ongoing: {
                name: "Rules of Engagement",
                shortName: "Ongoing Directive",
                flatAmp: 40,
                maxStacks: 1,
                killBased: true,
                condition: "Treffer auf statusbetroffene Gegner markieren sie (10s). Kill eines markierten Gegners: volles Magazin Hohlspitz-Munition (+40% verstärkter Schaden + Blutung) für die aktive Waffe, halbes Magazin fürs Team",
                sourceNote: "Grundtalent: +40% verstärkter Schaden (multiplikative Gruppe), solange Hohlspitz-Munition aktiv (kill-abhängig)",
                chestTalent: { label: "Parabellum Rounds (Weste)", flatAmp: 60, note: "+60% statt +40% (nicht für Team-Mitglieder)" },
                backpackTalent: { label: "Trauma Specialist (Rucksack)", note: "Blutungs-Dauer +50% & Blutungs-Schaden +100% — keine Auswirkung auf den Waffenschaden" }
            },
            acesandeights: {
                name: "Dead Man's Hand",
                shortName: "Aces & Eights",
                flatAmp: 75,
                maxStacks: 1,
                condition: "Karten umdrehen mit Rifle/MMR; nach 5 Karten: nächster Schuss +75% verstärkter Schaden — Four of a Kind 4 Schüsse, Full House 3, Aces & Eights 2; Kopfschuss dreht zusätzliche Karte",
                sourceNote: "Grundtalent: +75% verstärkter Schaden auf die verstärkten Schüsse",
                chestTalent: { label: "No Limit (Weste)", flatAmp: 100, note: "+75% → +100% verstärkter Schaden" },
                backpackTalent: { label: "Ace in the Sleeve (Rucksack)", note: "1 zusätzlicher verstärkter Schuss — keine Auswirkung auf die Schadenshöhe" }
            },
            hotshot: {
                name: "Headache",
                shortName: "Hotshot",
                flatAmp: 80,
                maxStacks: 1,
                condition: "1. Kopfschuss (MMR): nächster +80%; 2.: +10% Rüstung (voll: Bonus-Rüstung max +50%); 3.: Magazin füllt sich; ab 4.: alle Boni je Folge-Kopfschuss. Fehlschuss setzt Zyklus zurück",
                sourceNote: "Grundtalent: +80% verstärkter Schaden auf den Folge-Kopfschuss",
                chestTalent: { label: "Stand Tall (Weste)", note: "Bonus-Rüstung 50% → 100% — keine Auswirkung auf den Schaden" },
                backpackTalent: { label: "Lucky (Rucksack)", note: "1 Fehlschuss erlaubt — keine Auswirkung auf die Schadenshöhe" }
            },
            virtuoso: {
                name: "Symphony",
                shortName: "Virtuoso",
                flatAmp: 40,
                flatAmpByWeapon: { AR: 20, LMG: 20 },
                maxStacks: 1,
                killBased: true,
                condition: "Kill >25m: +40% WD (Shotguns/SMGs/Pistolen) bzw. Kill <25m: +40% WD (MMR/Rifles); ARs/LMGs +20%; 4 Stacks (wechselnde Distanz): alle Boni verdoppelt & gleichzeitig",
                sourceNote: "Grundtalent: +40% verstärkter Schaden (AR/LMG +20%) nach Distanz-Kill",
                chestTalent: { label: "Fortissimo (Weste)", ampMult: 2, note: "verdoppelt die Waffenschaden-Boni (+40% → +80%, AR/LMG +20% → +40%)" },
                backpackTalent: { label: "Accelerando (Rucksack)", note: "4 → 3 Stacks für Doppel-Boni — keine Auswirkung auf den Grund-Bonus" }
            },
            breakingpoint: {
                name: "On Point",
                shortName: "Breaking Point",
                perStackWd: 4,
                perStackWh: 2,
                maxStacks: 30,
                magBasedStacks: true,
                condition: "Treffer mit Rifle/MMR: +1 Stack (max. = Magazingröße, hier angenommen: 30); leer nachladen: +2% WH & +4% WD pro Stack für 20s",
                sourceNote: "Grundtalent: +4% WD pro Stack (Stacks = Magazingröße der Waffe)",
                chestTalent: { label: "Point of No Return (Weste)", note: "Dauer 20s → 40s — keine Auswirkung auf die Bonushöhe" },
                backpackTalent: { label: "Point of Honor (Rucksack)", perStackWd: 9, note: "+4% → +9% WD pro Stack" }
            }
        };

        // ========== HILFSFUNKTIONEN ==========
        function formatGermanNumber(val) {
            if (isNaN(val)) return '0';
            return Number(val).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        }

        function parseLocalizedFloat(str, fallback = 0) {
            if (typeof str !== 'string') str = String(str ?? '');
            str = str.trim();
            if (!str) return fallback;
            // Robust gegen beide Formate:
            //  - deutsch:  "50.482" (Tausender) / "22,5" (Dezimal) / "22,50"
            //  - roh/englisch: "50482" / "22.5"
            // Regel: Komma ist immer Dezimaltrenner. Punkte sind Tausender-
            // trenner, AUSSER wenn kein Komma vorkommt und der Punkt nicht
            // in 3er-Gruppen liegt (dann ist er Dezimalpunkt, z.B. "22.5").
            if (str.includes(',')) {
                str = str.replace(/\./g, '').replace(',', '.');
            } else {
                // "50.482" -> Tausender (3er-Gruppe), "22.5" -> Dezimal
                str = /^-?\d{1,3}(\.\d{3})+$/.test(str) ? str.replace(/\./g, '') : str;
            }
            const num = parseFloat(str);
            return isNaN(num) ? fallback : num;
        }

        // Formatiert den Basis-Schaden während der Eingabe mit Tausender-Punkten (z.B. 93.000)
        function formatBaseDmgInput(input) {
            const raw = input.value.replace(/[^\d]/g, '');
            if (!raw) { input.value = ''; return; }
            input.value = Number(raw).toLocaleString('de-DE');
        }

        function showToast(message, type = 'success') {
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            let borderColor = type === 'success' ? 'border-emerald-500 text-emerald-200 bg-emerald-950/90' :
                            (type === 'error' ? 'border-red-500 text-red-200 bg-red-950/90' : 'border-sky-500 text-sky-200 bg-sky-950/90');
            toast.className = `p-4 rounded-xl border shadow-xl backdrop-blur-md text-sm font-semibold flex items-center justify-between gap-3 transition-all duration-300 transform translate-y-2 opacity-0 ${borderColor}`;
            toast.innerHTML = `
                <span>${escapeHtml(message)}</span>
                <button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-white">&times;</button>
            `;
            container.appendChild(toast);
            setTimeout(() => { toast.classList.remove('translate-y-2', 'opacity-0'); }, 10);
            setTimeout(() => {
                toast.classList.add('translate-y-2', 'opacity-0');
                setTimeout(() => toast.remove(), 300);
            }, 4000);
        }

        function weaponTypeLabel(type) {
            const labels = {
                'AR': 'Sturmgewehr (AR)',
                'LMG': 'LMG',
                'MP': 'Maschinenpistole (MP)',
                'Rifle': 'Gewehr / DMR',
                'Shotgun': 'Schrotflinte',
                'MMR': 'Scharfschützengewehr (MMR)',
                'Pistol': 'Pistole (Sidearm)'
            };
            return labels[type] || type;
        }

        // ========== NEBENATTRIBUT (ATTRIBUT 3) MIT GOD-ROLL-MAXWERTEN ==========
        // Max-Werte gelten fuer High-End-Waffen auf Level 40 (God Roll).
        // Prototypen / Named-Waffen: Maximalwert +50%.
        const WEAPON_MINOR_ATTRIBUTES = {
            'dttooc':      { label: 'Schaden gg. ungedeckte Ziele (DTToOC)', max: 10,   note: 'Der Meta-Stat – multipliziert fast jeden Schaden.' },
            'dta':         { label: 'Rüstungsschaden (DTA)',                max: 6,    note: 'Sehr stark gegen Bosse und Rüstungs-Gegner.' },
            'dth':         { label: 'Lebenspunktschaden (DTH)',            max: 10,   note: 'Effektiv gegen rote Gegner, Hunde, Drohnen, Chungas.' },
            'chc':         { label: 'Kritische Trefferchance (CHC)',        max: 9.5,  note: 'Hilft beim Erreichen des 60%-CHC-Hard-Caps.' },
            'chd':         { label: 'Kritischer Trefferschaden (CHD)',      max: 10,   note: 'Erhöht den Schaden kritischer Treffer (DPS).' },
            'hsd':         { label: 'Kopfschussschaden (HSD)',              max: 10,   note: 'Pflicht für MMR-/Scharfschützen-Builds.' },
            'magSize':     { label: 'Magazingröße',                        max: 12.5, note: 'Mehr Munition im Magazin (LMGs, langsame ARs).' },
            'handling':    { label: 'Waffenhandling',                      max: 14,   note: 'All-in-One: Nachladetempo, Stabilität, Präzision.' },
            'range':       { label: 'Optimale Reichweite',                 max: 24,   note: 'Erhöht die Distanz bis zum Schadensabfall.' },
            'rof':         { label: 'Feuerrate (RoF)',                     max: 5,    note: 'Schneller schießen – mehr Burst-Schaden.' },
            'reloadSpeed': { label: 'Nachladetempo',                       max: 15,   note: 'Verkürzt lange Nachladeanimationen.' },
            'armorOnKill': { label: 'Gegner bei Tötung reparieren (AoK)',  max: 10,   note: 'Rüstung pro Kill – defensiver Utility-Stat.' }
        };

        function minorAttributeMax(typeKey, isPrototype) {
            const cfg = WEAPON_MINOR_ATTRIBUTES[typeKey];
            if (!cfg) return null;
            return isPrototype ? cfg.max * 1.5 : cfg.max;
        }

        // Zeigt den God-Roll-Maxwert (ggf. +50% fuer Prototypen) und warnt,
        // wenn der eingegebene Wert darueber liegt.
        function updateMinorHint() {
            const typeSel = document.getElementById('weaponMinorType');
            const valInput = document.getElementById('weaponMinorVal');
            const protoChk = document.getElementById('weaponIsPrototype');
            const hint = document.getElementById('minorHint');
            if (!typeSel || !valInput || !hint) return;
            const cfg = WEAPON_MINOR_ATTRIBUTES[typeSel.value];
            if (!cfg) { hint.textContent = ''; return; }
            // EXOTEN: Die drei Waffenattribute (Kern 1, Kern 2, Attribut 3)
            // sind fix – KEIN Prototyp-Bonus (+50%). Nur die Mods sind besonders.
            const isExotic = (typeof isExoticFormActive === 'function') && isExoticFormActive();
            const isProto = !isExotic && protoChk && protoChk.checked;
            const max = minorAttributeMax(typeSel.value, isProto);
            const val = parseLocalizedFloat(valInput.value);
            let text = `Max (God Roll${isProto ? ', Prototyp +50%' : ''}): ${formatGermanNumber(max)}% — ${cfg.note}`;
            if (isExotic) text += ' — Exote: Werte fix, kein Prototyp-Bonus (+50%); nur die Mods sind besonders.';
            if (val > max) {
                hint.className = 'text-[11px] text-red-400 font-semibold';
                text = `⚠ Wert über Max (${formatGermanNumber(max)}%): ${text}`;
            } else {
                hint.className = 'text-[11px] text-gray-500';
            }
            hint.textContent = text;
        }

        // ========== KERNATTRIBUTE JE WAFFENGATTUNG ==========
        // Kern 1 ist immer der Gattungs-Waffenschaden (WD), God Roll = +15%.
        // Bei Prototypen / Named-Waffen gelten alle Max-Werte +50% (Kern 1: 22,5%).
        const WEAPON_CORE1_MAX = 15;

        function core1Max(isPrototype) {
            return isPrototype ? WEAPON_CORE1_MAX * 1.5 : WEAPON_CORE1_MAX;
        }

        // Zeigt den Kern-1-Maxwert an und warnt bei Ueberschreitung.
        function updateCore1Hint() {
            const valInput = document.getElementById('weaponCore1');
            const protoChk = document.getElementById('weaponIsPrototype');
            const hint = document.getElementById('core1Hint');
            if (!valInput || !hint) return;
            // EXOTEN: Kern 1 ist fix – KEIN Prototyp-Bonus (+50%).
            const isExotic1 = (typeof isExoticFormActive === 'function') && isExoticFormActive();
            const isProto = !isExotic1 && protoChk && protoChk.checked;
            const max = core1Max(isProto);
            const val = parseLocalizedFloat(valInput.value);
            let text = `Max (God Roll${isProto ? ', Prototyp +50%' : ''}): ${formatGermanNumber(max)}% Waffenschaden`;
            if (isExotic1) text += ' — Exote: Werte fix, kein Prototyp-Bonus (+50%); nur die Mods sind besonders.';
            if (val > max) {
                hint.className = 'text-[11px] text-red-400 font-semibold';
                text = `⚠ Wert über Max (${formatGermanNumber(max)}%): ${text}`;
            } else {
                hint.className = 'text-[11px] text-gray-500';
            }
            hint.textContent = text;
        }

        // Kern-2-God-Roll-Maxwerte je Waffengattung (High End, Level 40).
        // Prototypen / Named-Waffen: Maximalwert +50%.
        const WEAPON_CORE2_MAX = {
            'AR':      21.0,  // Lebenspunktschaden (DTH)
            'MP':      21.0,  // Kritische Trefferchance (CHC)
            'Rifle':   17.0,  // Kritischer Trefferschaden (CHD)
            'MMR':     111.0, // Kopfschussschaden (HSD)
            'Shotgun': 12.0,  // Rüstungsschaden (DTA)
            'LMG':     12.0   // Schaden gg. ungedeckte Ziele (DTToOC)
        };

        function core2Max(isPrototype, weaponType, core2TypeKey) {
            let base;
            if (weaponType === 'Pistol') {
                // Pistolen haben kein festes Kern-2-Attribut: der Maxwert
                // entspricht dem God Roll des frei gewaehlten Attributs.
                const cfg = WEAPON_MINOR_ATTRIBUTES[core2TypeKey];
                base = cfg ? cfg.max : null;
            } else {
                base = WEAPON_CORE2_MAX[weaponType];
            }
            if (base == null) return null;
            return isPrototype ? base * 1.5 : base;
        }

        // Zeigt den Kern-2-Maxwert an und warnt bei Ueberschreitung.
        function updateCore2Hint() {
            const valInput = document.getElementById('weaponCore2Val');
            const protoChk = document.getElementById('weaponIsPrototype');
            const typeSel = document.getElementById('weaponType');
            const core2Sel = document.getElementById('weaponCore2Type');
            const label = document.getElementById('weaponCore2Label');
            const hint = document.getElementById('core2Hint');
            if (!valInput || !hint) return;
            // EXOTEN: Kern 2 ist fix – KEIN Prototyp-Bonus (+50%). Da Exoten
            // die Kern-2-Attributsart frei wählen dürfen (kein Gattungs-Zwang),
            // wird der Maxwert aus der gewählten Art abgeleitet, nicht aus der Gattung.
            const isExotic2 = (typeof isExoticFormActive === 'function') && isExoticFormActive();
            const isProto = !isExotic2 && protoChk && protoChk.checked;
            const weaponType = typeSel ? typeSel.value : 'AR';
            const core2Key = core2Sel ? core2Sel.value : null;
            let effType = weaponType;
            if (isExotic2 && core2Key) {
                // Umkehrung: Attributsart -> Gattung mit dem passenden Kern-2-Maxwert
                const typeByCore2 = { 'dth': 'AR', 'chc': 'MP', 'chd': 'Rifle', 'hsd': 'MMR', 'dta': 'Shotgun', 'dttooc': 'LMG' };
                if (typeByCore2[core2Key]) effType = typeByCore2[core2Key];
            }
            const max = core2Max(isProto, effType, core2Key);
            const val = parseLocalizedFloat(valInput.value);
            // Attributnamen aus dem Kern-2-Label ableiten (z.B. "Lebenspunktschaden (DTH)")
            const attrName = (label && label.textContent ? label.textContent.replace(/^Kern 2: \+%/, '').replace(/\s*\(variabel\):/, '').trim() : '') || 'Kern-Attribut';
            let text;
            if (max == null) {
                hint.className = 'text-[11px] text-gray-500';
                text = 'Für diese Kombination ist kein Max-Wert hinterlegt.';
            } else {
                text = `Max (God Roll${isProto ? ', Prototyp +50%' : ''}): ${formatGermanNumber(max)}% ${attrName}`;
                if (isExotic2) text += ' — Exote: Werte fix, kein Prototyp-Bonus (+50%); nur die Mods sind besonders.';
                if (val > max) {
                    hint.className = 'text-[11px] text-red-400 font-semibold';
                    text = `⚠ Wert über Max (${formatGermanNumber(max)}%): ${text}`;
                } else {
                    hint.className = 'text-[11px] text-gray-500';
                }
            }
            hint.textContent = text;
        }

        // Belegt die drei Attribut-Wertfelder (Kern 1, Kern 2, Attribut 3)
        // mit den jeweiligen Maximalwerten vor (God Roll):
        //  - Exoten: normale Max-Werte (Kern 1: 15%) – Werte sind fix, KEIN
        //    Prototyp-Bonus (+50%); nur die Mods sind besonders.
        //  - High-End/Named mit Prototyp-Checkbox an: Max-Werte +50%
        //    (Kern 1: 22,5%).
        // Wird beim Wählen einer Waffe aus der DB und beim Umschalten der
        // Prototyp-Checkbox aufgerufen; der Nutzer kann danach beliebig
        // korrigieren (die Felder bleiben editierbar).
        function prefillMaxAttributeValues() {
            const core1Input = document.getElementById('weaponCore1');
            const core2ValInput = document.getElementById('weaponCore2Val');
            const minorTypeSel = document.getElementById('weaponMinorType');
            const minorValInput = document.getElementById('weaponMinorVal');
            const typeSel = document.getElementById('weaponType');
            const core2Sel = document.getElementById('weaponCore2Type');
            const protoChk = document.getElementById('weaponIsPrototype');
            if (!core1Input || !core2ValInput || !minorValInput) return;
            const isExotic = (typeof isExoticFormActive === 'function') && isExoticFormActive();
            const isProto = !isExotic && protoChk && protoChk.checked;
            // Kern 1: God Roll (Exote 15%, Prototyp 22,5%)
            core1Input.value = formatGermanNumber(core1Max(isProto));
            // Kern 2: Maxwert der Gattung bzw. (Exote) der gewählten Attributsart
            const weaponType = typeSel ? typeSel.value : 'AR';
            const core2Key = core2Sel ? core2Sel.value : null;
            let effType = weaponType;
            if (isExotic && core2Key) {
                const typeByCore2 = { 'dth': 'AR', 'chc': 'MP', 'chd': 'Rifle', 'hsd': 'MMR', 'dta': 'Shotgun', 'dttooc': 'LMG' };
                if (typeByCore2[core2Key]) effType = typeByCore2[core2Key];
            }
            const c2max = core2Max(isProto, effType, core2Key);
            if (c2max != null) core2ValInput.value = formatGermanNumber(c2max);
            // Attribut 3: God Roll des gewählten Typs
            if (minorTypeSel && minorTypeSel.value) {
                const mMax = minorAttributeMax(minorTypeSel.value, isProto);
                if (mMax != null) minorValInput.value = formatGermanNumber(mMax);
            }
            if (typeof updateCore1Hint === 'function') updateCore1Hint();
            if (typeof updateCore2Hint === 'function') updateCore2Hint();
            if (typeof updateMinorHint === 'function') updateMinorHint();
        }
        // Kern 1 ist immer der Gattungs-Waffenschaden (WD).
        // Kern 2 ist pro Gattung fest & einzigartig - nur Pistolen haben kein
        // festes zweites Kernattribut (dort frei waehlbar).
        const WEAPON_CORE_ATTRIBUTES = {
            'AR':      { core1Label: 'Kern 1: +% Sturmgewehr-Schaden (WD)',       core2: 'dth',    core2Label: 'Kern 2: +% Lebenspunktschaden (DTH)' },
            'LMG':     { core1Label: 'Kern 1: +% LMG-Schaden (WD)',               core2: 'dttooc', core2Label: 'Kern 2: +% Schaden gg. ungedeckte Ziele (DTToOC)' },
            'MP':      { core1Label: 'Kern 1: +% MP-Schaden (WD)',                core2: 'chc',    core2Label: 'Kern 2: +% Kritische Trefferchance (CHC)' },
            'Rifle':   { core1Label: 'Kern 1: +% Gewehr-Schaden (WD)',            core2: 'chd',    core2Label: 'Kern 2: +% Kritischer Trefferschaden (CHD)' },
            'MMR':     { core1Label: 'Kern 1: +% Präzisionsgewehr-Schaden (WD)',   core2: 'hsd',    core2Label: 'Kern 2: +% Kopfschussschaden (HSD)' },
            'Shotgun': { core1Label: 'Kern 1: +% Schrotflinten-Schaden (WD)',     core2: 'dta',    core2Label: 'Kern 2: +% Rüstungsschaden (DTA)' },
            'Pistol':  { core1Label: 'Kern 1: +% Pistolen-Schaden (WD)',          core2: null,    core2Label: 'Kern 2 (variabel):' }
        };

        // Passt die Kernattribut-Beschriftungen an die gewaehlte Waffengattung an.
        // Ob aktuell eine exotische Waffe im Formular aktiv ist. Exoten haben
        // fixe Attribute aus der DB – Kern 2 & Attribut 3 sind "besonders"
        // und unterliegen NICHT der Gattungs-Validierung.
        function isExoticFormActive() {
            const exoEl = document.getElementById('weaponIsExotic');
            return (exoEl && exoEl.value === 'true') || currentExoticMods !== null;
        }

        // Sperrt das gattungsfeste Kern-2-Attribut im Nebenattribut (Attribut 3):
        // Jede Waffengattung hat ein festes Kern 2 (AR: DTH, LMG: DTToOC, MP: CHC,
        // Rifle: CHD, MMR: HSD, Shotgun: DTA) – derselbe Attributstyp kann nicht
        // noch einmal als Attribut 3 gewaehlt werden. Pistolen: das im (freien)
        // Kern-2-Feld gewaehlte Attribut wird entsprechend gesperrt.
        // AUSNAHME: Exotische Waffen – deren Attribute sind fix/besonders und
        // werden nicht validiert (alle Optionen freiwaehlbar).
        function updateMinorTypeOptions() {
            const minorSel = document.getElementById('weaponMinorType');
            const core2Sel = document.getElementById('weaponCore2Type');
            if (!minorSel || !core2Sel) return;
            // Gesperrt wird das tatsaechlich gesetzte Kern-2-Attribut:
            //  - Normale/Named-Waffen: der Gattungsstandard (updateWeaponCoreLabels
            //    legt Kern 2 darauf fest) -> klassische Gattungs-Sperre
            //  - Exoten: das fixe zweite Attribut der Waffe. Der Gattungs-Zwang
            //    entfaellt zwar (siehe updateWeaponCoreLabels), aber Kern 2 darf
            //    trotzdem NICHT mit Attribut 3 identisch sein (keine Dopplung).
            const core2Type = core2Sel.value;
            Array.from(minorSel.options).forEach(opt => {
                opt.disabled = !!core2Type && opt.value === core2Type;
            });
            // Ungueltige Auswahl (identisch mit Kern 2) zuruecksetzen
            if (core2Type && minorSel.value === core2Type) {
                minorSel.value = '';
                if (typeof updateMinorHint === 'function') updateMinorHint();
                showToast('Attribut 3 darf nicht dem Kern-2-Attribut entsprechen – bitte neu wählen.', 'error');
            }
        }

        // Bei festem Kern 2 wird der Typ automatisch gesetzt und die Auswahl
        // versteckt; bei Pistolen bleibt das Attribut frei waehlbar.
        // AUSNAHME: Exoten – Kern 2 wird NICHT auf den Gattungsstandard
        // umgesetzt (fixe/besondere Attribute), das Feld bleibt frei.
        function updateWeaponCoreLabels() {
            const typeSel = document.getElementById('weaponType');
            const core2Sel = document.getElementById('weaponCore2Type');
            if (!typeSel || !core2Sel) return;
            const cfg = WEAPON_CORE_ATTRIBUTES[typeSel.value] || WEAPON_CORE_ATTRIBUTES['AR'];
            document.getElementById('weaponCore1Label').textContent = cfg.core1Label;
            document.getElementById('weaponCore2Label').textContent = cfg.core2Label;
            const hint = document.getElementById('weaponCoreHint');
            if (isExoticFormActive() && !cfg.core2) {
                // Exote ohne gattungsfestes Kern 2 (Pistole): frei waehlbar
                core2Sel.classList.remove('hidden');
                if (hint) hint.textContent = 'Exotische Waffe – hier ist Kern 2 frei waehlbar. Attribut 3 darf dennoch nicht Kern 2 duplizieren.';
            } else if (cfg.core2) {
                core2Sel.value = cfg.core2;
                core2Sel.classList.add('hidden');
                if (hint) hint.textContent = isExoticFormActive()
                    ? 'Exotische Waffe – Kern 2 ist gattungsfest (Wert anpassbar). Attribut 3 darf nicht Kern 2 duplizieren.'
                    : 'Kern 2 wird durch die Waffengattung automatisch festgelegt.';
            } else {
                core2Sel.classList.remove('hidden');
                if (hint) hint.textContent = 'Pistolen haben kein festes zweites Kernattribut – Attribut frei wählbar.';
            }
            // Kern-2-Typ hat sich geaendert -> Nebenattribut-Optionen anpassen
            updateMinorTypeOptions();
        }

        function talentKeyFromName(name) {
            if (!name) return '';
            return String(name)
                .toLowerCase()
                .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
                .replace(/\s+/g, '_')
                .replace(/[^a-z0-9_]/g, '');
        }

        function getTalentLabel(key) {
            const entry = WEAPON_TALENTS[key] || WEAPON_TALENTS[talentKeyFromName(key)];
            if (entry?.label) return entry.label;
            const nd = getNamedTalentDef(key);
            return nd ? (nd.label || nd.name) : key;
        }

        function talentValueFor(key, isExotic) {
            let t = WEAPON_TALENTS[key] || WEAPON_TALENTS[talentKeyFromName(key)];
            if (!t) {
                const nd = getNamedTalentDef(key);
                if (nd && nd.value !== null && nd.value !== undefined) return nd.value;
                return 0;
            }
            return isExotic ? t.valueNamed : t.valueNormal;
        }

        // Status-Zeile für bedingte Waffen-Talente (z.B. Sadist) im Endergebnis.
        // info = talentInfo aus dem Vergleichsergebnis (optional); ohne info
        // wird der Zustand aus der Einstellung "Bedingte Waffen-Talente" gelesen.
        function talentStatusLine(talentName, info) {
            const rt = resolveTalentDef(talentName);
            const tKey = rt.key;
            const t = rt.t;
            if (!t) return '';
            if (!t.type) return '<p class="text-gray-500">Talent aktiv: situativ / ohne direkten DPS-Effekt (' + (t.label || talentName) + (t.condition ? ' – Bedingung: ' + t.condition : '') + ')</p>';
            const active = info
                ? info.active
                : (!t.conditional || (document.getElementById('talentsActive')?.checked || false));
            const val = info ? info.val : talentValueFor(tKey, false);
            const typeLabel = t.type === 'amp' ? 'Verstärker' :
                t.type === 'wd' ? 'Waffen-Schaden' :
                t.type === 'chd' ? 'Krit-Trefferschaden' : 'CHC/CHD';
            const condTxt = t.condition ? ` – Bedingung: ${t.condition}` : '';
            const synergyTxt = (info && info.synergyVia) ? ` — Bedingung vom Build geliefert (${info.synergyVia})` : '';
            if (active) {
                return `<p class="${info && info.active ? 'text-emerald-400' : 'text-emerald-500'}">✔ Talent aktiv: ja (+${val}% ${typeLabel} eingerechnet)${condTxt}${synergyTxt}</p>`;
            }
            const synergyHint = (info && info.conditional && !info.synergyVia)
                ? ' – Bedingung vom Build nicht lieferbar: passendes Gear-Talent/Set ergänzen (z.B. Sadist: Trauma-Weste) oder Haken bei „Bedingte Waffen-Talente“ setzen'
                : ' – Haken bei „Bedingte Waffen-Talente“ setzen';
            return `<p class="text-gray-500">✖ Talent aktiv: nein (+${val}% ${typeLabel} NICHT eingerechnet)${condTxt}${synergyHint}</p>`;
        }

        // ========== TAB-NAVIGATION ==========
        let activeTab = 'weapons';
        function switchTab(tabName) {
            activeTab = tabName;
            // Tabs verstecken
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
                content.classList.add('hidden');
            });
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            // Aktiven Tab anzeigen
            const tabContent = document.getElementById(`content${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
            const tabBtn = document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
            if (tabContent) {
                tabContent.classList.add('active');
                tabContent.classList.remove('hidden');
            }
            if (tabBtn) {
                tabBtn.classList.add('active');
            }

            if (tabName === 'settings' && typeof populateManualBuildSelects === 'function') populateManualBuildSelects();

            // Vergleich neu laden, falls Tab gewechselt wird
            if (tabName === 'compare' && lastComparisonData) {
                renderComparison();
            }
            updateTabUI();
        }

        function updateTabUI() {
            // UX: Header-Aktionen passend zum aktiven Tab zeigen (data-tabs);
            // Buttons ohne data-tabs (Alles exportieren/importieren/leeren) bleiben global.
            document.querySelectorAll('header [data-tabs]').forEach(btn => {
                const tabs = (btn.getAttribute('data-tabs') || '').split(',').map(s => s.trim());
                btn.classList.toggle('hidden', !tabs.includes(activeTab));
            });
            document.getElementById('weaponCount').textContent = weaponsInventory.length;
            document.getElementById('gearCount').textContent = gearInventory.length;
            document.getElementById('comparisonCount').textContent = lastComparisonData ? lastComparisonData.length : '0';
            // Veraltet-Marker im Tab-Titel, wenn Inventar nach letzter Berechnung geändert wurde
            const cmpBtn = document.getElementById('tabCompare');
            if (cmpBtn) {
                if (comparisonStale && lastComparisonData && lastComparisonData.length) cmpBtn.classList.add('text-amber-400');
                else cmpBtn.classList.remove('text-amber-400');
            }
        }

        // ========== WAFFEN-DATENBANK (The Division 2) ==========

        // Level-40-Basis-Schaden aus Waffen-Datenbank (weapons_full_v2.json)
        const WEAPON_BASE_DAMAGE = {
            'acr': 58897,
            'acre': 58897,
            'akm': 67175,
            'militaryakm': 64717,
            'blackmarketakm': 64717,
            'blackmarketakmreplica': 64717,
            'firstsightakm': 67175,
            'manicblackmarketakm': 64717,
            'auga3cqc': 57218,
            'invisiblehand': 57218,
            'thebighorn': 57206,
            'carbine7': 49790,
            'thedrill': 49790,
            'f2000': 49104,
            'f2000replica': 49104,
            'shieldsplinterer': 49104,
            'agitator': 49104,
            'fal': 57646,
            'falsa58': 57646,
            'falsa58para': 57646,
            'falsa58parareplica': 57646,
            'goaliefal': 57646,
            'stregafal': 57634,
            'famas2010': 45273,
            'famas2010replica': 45273,
            'huntsman': 45273,
            'burnout': 45273,
            'militaryg36': 52564,
            'g36c': 52564,
            'g36enhanced': 52564,
            'g36enhancedreplica': 52564,
            'caretakerg36enhanced': 52564,
            'borngreatmilitaryg36': 52564,
            'honeybadger': 51271,
            'savagewolverine': 51271,
            'policem4': 46918,
            'policem4replica': 46918,
            'pyromaniac': 46918,
            'lexington': 48700,
            'stelmosengine': 46908,
            'mk16': 59221,
            'socommk16': 59221,
            'tacticalmk16': 59221,
            'tacticalmk16replica': 59221,
            'ludsocommk16': 59221,
            'militaryp416': 47365,
            'customp416g3': 47365,
            'glorydazecustomp416g3': 47365,
            'eaglebearer': 47356,
            'pdr': 57618,
            'testsubject': 57618,
            'firstbloom': 57618,
            'capacitor': 57606,
            'sigsauer556': 55935,
            'mechanicalanimal': 55925,
            'tkb408': 63509,
            'kingbreaker': 63509,
            'ctar21': 44802,
            'therailsplitter': 44802,
            'chameleon': 44660,
            'stonerlamg': 62361,
            'quietroar': 62361,
            'bluescreen': 62361,
            'militaryl86lsw': 61097,
            'customl86a2': 61097,
            'customl86a2replica': 61097,
            'tabularasamilitaryl86lsw': 61097,
            'hkgr9': 49480,
            'dare': 49480,
            'cricket': 49480,
            'm249b': 48300,
            'tacticalm249para': 48300,
            'militarymk46': 48300,
            'militarymk46replica': 48300,
            'blackfridaym249b': 48300,
            'thestingerm249b': 48300,
            'gearshiftmilitarymk46': 48300,
            'pestilencem249b': 48300,
            'classicm60': 67711,
            'militarym60e4': 65234,
            'blackmarketm60e6': 65234,
            'classicm60replica': 67711,
            'blackmarketm60e6replica': 65234,
            'theheadlinegrabbermilitarym60e4': 65234,
            'goodtimesblackmarketm60e6': 65234,
            'mg5': 54322,
            'infantrymg5': 52334,
            'infantrymg5replica': 52334,
            'bellringerinfantrymg5': 52334,
            'bigshowmg5': 54322,
            'sleipnermg5': 54322,
            'ironlungmg5': 54322,
            'iwinegev': 54604,
            'carnage': 54604,
            'bulletking': 54604,
            'classicrpk74': 71538,
            'militaryrpk74': 71538,
            'blackmarketrpk74': 71538,
            'blackmarketrpk74replica': 71538,
            'rustyclassicrpk74': 71538,
            'newreliableblackmarketrpk74': 71538,
            'pakhanclassicrpk': 71538,
            'bigalejandro': 39279,
            'convertedsmg9a2': 46735,
            'convertedsmg9': 48512,
            'convertedsmg9replica': 48512,
            'puristconvertedsmg9a2': 46735,
            'mp5st': 53904,
            'mp5streplica': 53904,
            'mp5a2': 53904,
            'mp5n': 53904,
            'cabaretmp5st': 53904,
            'cmmgbanshee': 47849,
            'thegrudge': 47849,
            'ladydeath': 35409,
            'pp19': 63593,
            'enhancedpp19': 63593,
            'coldrelationsenhancedpp19': 63593,
            'auga3paraxs': 58662,
            'enhancedauga3p': 58662,
            'tacticalauga3p': 58662,
            'tacticalauga3preplica': 58662,
            'interchangeenhancedauga3p': 58662,
            'vectorsbr45acp': 38301,
            'vectorsbr45acpreplica': 38301,
            'vectorsbr9mm': 39307,
            'tacticalvectorsbr9mm': 40506,
            'frothtacticalvectorsbr9mm': 40506,
            'darkwintervectorsbr45acp': 38301,
            'ouroborosvectorsbr45acp': 38301,
            'mp7': 46406,
            'swapchain': 46406,
            'oxpecker': 46406,
            'policet821': 76916,
            'blackmarkett821': 76916,
            'blackmarkett821replica': 76916,
            'policeump45': 63692,
            'tacticalump45': 63692,
            'tacticalump45replica': 63692,
            'slingshottacticalump45': 63692,
            'm1928': 78416,
            'tommygun': 50627,
            'thesleighertommygun': 92990,
            'growngreattommygun': 50627,
            'p90': 39457,
            'p90replica': 39457,
            'emelinesguard': 39457,
            'thechatterbox': 39457,
            'mpx': 50999,
            'safetydistance': 50999,
            'theapartment': 50999,
            'backfire': 50999,
            'acs12': 180752,
            'stackbroker': 150626,
            'lefty': 180752,
            'rocknroll': 180752,
            'doublebarrelshotgun': 678139,
            'doublebarrelshotgunreplica': 678139,
            'boomstick': 678139,
            'sawedoffdoublebarrel': 635715,
            'firestarter': 635715,
            'backupboomstick': 635715,
            'ksgshotgun': 678929,
            'thesendoff': 678929,
            'overlord': 678929,
            'customm870mcs': 703676,
            'customm870mcsreplica': 703676,
            'm870express': 703676,
            'm870expressreplica': 703676,
            'militarym870': 703676,
            'lockdownm870express': 703676,
            'culebremilitarym870': 703676,
            'blackmarketsasg12s': 349807,
            'blackmarketsasg12sreplica': 349807,
            'sasg12': 349807,
            'tacticalsasg12k': 349807,
            'tsunamitacticalsasg12k': 349807,
            'spas12': 716012,
            'spas12replica': 716012,
            'thorn': 716012,
            'lullaby': 716012,
            'sweetdreams': 716012,
            'marinesuper90': 389936,
            'super90': 389936,
            'super90replica': 389936,
            'tacticalsuper90sbs': 389936,
            'tacticalsuper90sbsreplica': 389936,
            'likegluesuper90': 389936,
            'thesheriffsuper90': 526414,
            'enforcersuper90': 389936,
            'six12': 409569,
            'themop': 409569,
            'scorpio': 409569,
            'acrss': 92364,
            'trader': 92364,
            'ruthless': 102270,
            'merciless': 102270,
            'uic15mod2': 150316,
            'm16a2': 106971,
            'm16a2replica': 106971,
            'whisper': 106971,
            'classicm1a': 231346,
            'socomm1a': 129180,
            'm1acqb': 129180,
            'm1acqbreplica': 129180,
            'bakersdozenclassicm1a': 231346,
            'stageleftsocomm1a': 129180,
            'coolerm1acqb': 129180,
            'bittersweetclassicm1a': 231346,
            'doctorhomem1acqb': 129180,
            'lightweightm4': 107258,
            'lvoac': 100615,
            'lvoacreplica': 100615,
            'surgelvoac': 100615,
            'urbanmdr': 102970,
            'urbanmdrreplica': 102970,
            'vindicator': 102970,
            'militarymk17': 145850,
            'policemk17': 145850,
            'policemk17replica': 145850,
            'everlastinggazepolicemk17': 145850,
            'sig716': 121258,
            'sig716replica': 121258,
            'sig716cqb': 125865,
            'artiststoolsig716cqb': 125865,
            'theravenous': 134360,
            'usc45acp': 97743,
            'usc45acpreplica': 97743,
            'achilles': 97743,
            'resolutemk47': 124901,
            'harmony': 124901,
            '1886': 386989,
            'thevirginian': 386989,
            'diamondback': 386989,
            'socommk20ssr': 145850,
            'socommk20ssrreplica': 145850,
            'thedarkness': 145850,
            'g28': 206425,
            'relic': 206425,
            'sacrumimperium': 206425,
            'm700carbon': 412516,
            'm700carbonreplica': 412516,
            'm700tactical': 412516,
            'model700': 441570,
            'model700replica': 441570,
            'brutusm700carbon': 412516,
            'ekimslongstickmodel700': 441570,
            'shroudm700carbon': 412516,
            'paratroopersvd': 156663,
            'surplussvd': 156663,
            'commandoparatroopersvd': 156663,
            'handbasketsurplussvd': 386989,
            'dreadedict': 156663,
            'covertsrs': 409357,
            'srsa1': 409357,
            'srsa1replica': 409357,
            'pinprickcovertsrs': 409357,
            'mantiscovertsrs': 409357,
            'classicm44carbine': 433563,
            'classicm44carbinereplica': 433563,
            'huntingm44': 417692,
            'customm44': 417692,
            'customm44replica': 417692,
            'instigatorcustomm44': 417692,
            'ohcarolclassicm44carbine': 433563,
            'thewhitedeathclassicm44carbine': 433563,
            'sr1': 409357,
            'sr1replica': 409357,
            'adrestia': 409357,
            'designatedhitter': 409357,
            'tactical308': 403810,
            'scalpel': 403810,
            'nemesis': 940240,
            '93r': 52978,
            'sharpshooters93r': 52978,
            'tempest': 62714,
            'd50': 189172,
            'survivalistd50': 189172,
            'liberty': 189172,
            'm1911': 129885,
            'm45a1': 117436,
            'tacticalm1911': 117436,
            'tacticalm1911replica': 117436,
            'quickstepm45a1': 117436,
            'mozambiquespecialm45a1': 117436,
            'maxim9': 125414,
            'militarym9': 102585,
            'militarym9replica': 102585,
            'officersm9a1': 95698,
            'mosquitomilitarym9': 102585,
            'p320xcompact': 87541,
            'custompf45': 93963,
            'firstwavepf45': 100728,
            'lightningrodcustompf45': 93963,
            'busylittlebeecustompf45': 93963,
            'px4stormtypef': 91692,
            'px4stormtypet': 91692,
            'px4stormtypetreplica': 91692,
            'diceros': 204803,
            'dicerosreplica': 204803,
            'snubnoseddiceros': 211295,
            'dicerosspecialdiceros': 198306,
            'whiplashdiceros': 198306,
            '586magnum': 233278,
            'police686magnum': 233278,
            'police686magnumreplica': 233278,
            'orbit586magnum': 233278,
            'prophetpolice686magnum': 233278,
            'theharvestpolice686magnum': 256610,
            'regulus': 282072,
            'x45': 88321,
            'x45tactical': 88321,
            'x45tacticalreplica': 88321,
            'kard45': 114267,
            'tdikardcustom': 114267,
            'fafnir': 703676,
            'policem870': 695778,
            'primadonna': 417692,
            'incendia': 409357,
            'rabidd50': 189172,
            'theclaw': 150316,
            'teapot': 107258,
            'brainbreak': 102970,
            'steelsonsacr': 92364,
            'oldglory': 76916,
            'ump45': 65817,
            'insulttoinjury': 61097,
            'steamer': 59221,
            'thearchivist': 58897
        };

        function lookupWeaponBaseDmg(name) {
            const key = String(name || '').toLowerCase().replace(/\[exotic\]|\[named\]/g,'').replace(/[^a-z0-9]/g, '');
            if (WEAPON_BASE_DAMAGE[key] != null) return WEAPON_BASE_DAMAGE[key];
            // Fallback für leicht abweichende Namen (z.B. "GR9" vs. "HK GR9", "P416" vs. "Military P416").
            // Nur eindeutige Treffer mit Mindestlaenge, um Fehlmatches wie 'm4' -> 'policem4' zu vermeiden.
            if (key.length >= 3) {
                let match = null;
                for (const mapKey in WEAPON_BASE_DAMAGE) {
                    const isSuffix = mapKey.endsWith(key) || key.endsWith(mapKey);
                    if (!isSuffix) continue;
                    if (match) return null; // mehrdeutig -> kein Fallback
                    match = mapKey;
                }
                if (match && WEAPON_BASE_DAMAGE[match] > 0) return WEAPON_BASE_DAMAGE[match];
            }
            return null;
        }

        // ========== WAFFEN-INVENTAR ==========
        
        // ========== BEARBEITUNGSMODUS WAFFEN-INVENTAR ==========
        // editWeaponId !== null -> das Formular bearbeitet diese Waffe,
        // addWeapon() aktualisiert dann statt neu anzulegen.
        let editWeaponId = null;

        function setEditUi(active, weaponName) {
            const label = document.getElementById('weaponSubmitLabel');
            const cancelBtn = document.getElementById('cancelEditWeaponBtn');
            if (label) label.textContent = active
                ? `💾 „${weaponName || 'Waffe'}“ aktualisieren`
                : '🔫 Waffe zum Inventar hinzufügen';
            if (cancelBtn) cancelBtn.classList.toggle('hidden', !active);
        }

        function cancelEditWeapon() {
            editWeaponId = null;
            setEditUi(false);
            document.getElementById('weaponForm').reset();
            const exoticReset = document.getElementById('weaponIsExotic'); if (exoticReset) exoticReset.value = 'false';
            // Prototyp-Checkbox nach Exoten-Bearbeitung wieder freigeben (Standard: an)
            const protoReset = document.getElementById('weaponIsPrototype');
            if (protoReset) { protoReset.disabled = false; protoReset.checked = true; }
            const protoHintReset = document.getElementById('protoDisabledHint');
            if (protoHintReset) protoHintReset.style.display = 'none';
            // Auto-Mods-Schalter: Standard = Automatik aktiv (Exotic-Hack zurücksetzen)
            const autoChkReset = document.getElementById('autoModsToggle');
            if (autoChkReset) { autoChkReset.checked = true; autoChkReset.disabled = false; }
            if (typeof toggleAutoMods === 'function') toggleAutoMods();
            if (typeof clearExoticFixedMods === 'function') clearExoticFixedMods();
            if (typeof updateModSlotUI === 'function') updateModSlotUI(null);
            // Geister-Mods verhindern: Mod- Typ/Wert nach dem Reset leeren
            // (sonst stehen die HTML-Defaults chc + 10 wieder in den Feldern)
            for (const cat of Object.keys(MOD_SLOT_FORM)) {
                const e = MOD_SLOT_FORM[cat];
                const ms = document.getElementById(e.mod);
                if (ms) ms.value = '';
                const ts = document.getElementById(e.type);
                if (ts) ts.value = '';
                const vs = document.getElementById(e.val);
                if (vs) vs.value = '';
                const h = document.getElementById(e.hint);
                if (h) h.textContent = '';
            }
            updateModLiveSummary();
            if (typeof populateTalentDropdown === 'function') populateTalentDropdown();
            currentNamedTalent = null;
            currentNamedAttr = null;
            currentExoticTalent = null;
            const nWrap = document.getElementById('weaponTalentSelectWrap');
            if (nWrap) nWrap.style.display = '';
            const nSel = document.getElementById('weaponTalentSelectSelect');
            if (nSel) { nSel.disabled = false; nSel.value = ''; }
            const nDesc = document.getElementById('talentDescription');
            if (nDesc) nDesc.textContent = '';
            showToast('Bearbeitung abgebrochen – Formular zurückgesetzt.', 'info');
        }

        // Vorbelegen der DB-Drop-downs (Waffentyp + Waffe) im Bearbeitungsmodus.
        // Das Inventar speichert Kurz-Keys ('AR', 'LMG', ...), die Waffen-DB
        // dagegen Voll-Labels ('Sturmgewehr (AR)', ...). Beide werden hier
        // aufeinander abgebildet; ist die Waffe (nach Umbenennung) nicht in
        // der DB, bleibt nur der Typ vorbelegt, das Waffen-Feld leer.
        function prefillWeaponDbSelects(weapon) {
            const shortToDb = {
                'AR': 'Sturmgewehr (AR)',
                'LMG': 'Leichtes Maschinengewehr (LMG)',
                'MP': 'Maschinenpistole (MP)',
                'Rifle': 'Gewehr',
                'MMR': 'Scharfschützengewehr',
                'Shotgun': 'Schrotflinte',
                'Pistol': 'Pistole'
            };
            const typeSelect = document.getElementById('weaponDbTypeSelect');
            const weaponSelect = document.getElementById('weaponDbSelect');
            const dbType = shortToDb[weapon.type] || null;

            if (!typeSelect || !weaponSelect) return;

            if (dbType && Array.from(typeSelect.options).some(o => o.value === dbType)) {
                typeSelect.value = dbType;
                // Waffen-Liste fuer diesen Typ aufbauen (ohne Auswahl-Event,
                // sonst wuerde selectWeaponFromDatabase die Formularwerte
                // ueberschreiben)
                populateWeaponDropdownByType(dbType);
                // Waffe nur vorbelegen, wenn sie in der DB existiert
                // (umbenannte/manuell angelegte Waffen: Feld bleibt leer)
                const inDb = Array.from(weaponSelect.options).some(o => o.value === weapon.name);
                weaponSelect.value = inDb ? weapon.name : '';
            } else {
                // Unbekannter Typ: DB-Auswahl zuruecksetzen
                typeSelect.value = '';
                weaponSelect.innerHTML = '<option value="">— Waffe auswählen —</option>';
                weaponSelect.value = '';
            }
        }

        // Lädt eine Waffe aus dem Inventar zurück ins Formular (Bearbeitungsmodus).
        function startEditWeapon(id) {
            const weapon = weaponsInventory.find(w => w.id === id);
            if (!weapon) return;

            // Alte Vorbelegungen (DB-Auswahl/Exote/Named) erst aufräumen
            currentNamedTalent = null;
            currentNamedAttr = null;
            currentExoticTalent = null;
            currentExoticMods = null;
            if (typeof clearExoticFixedMods === 'function') clearExoticFixedMods();
            const tWrap = document.getElementById('weaponTalentSelectWrap');
            if (tWrap) tWrap.style.display = '';
            const tSel = document.getElementById('weaponTalentSelectSelect');
            if (tSel) { tSel.disabled = false; }

            // Grunddaten
            document.getElementById('weaponName').value = weapon.name;
            document.getElementById('weaponType').value = weapon.type;
            document.getElementById('weaponBaseDmg').value = formatGermanNumber(weapon.baseDmg);
            document.getElementById('weaponCore1').value = formatGermanNumber(weapon.core1);
            document.getElementById('weaponCore2Type').value = weapon.core2Type || 'dth';
            document.getElementById('weaponCore2Val').value = formatGermanNumber(weapon.core2Val);
            document.getElementById('weaponMinorType').value = weapon.minorType || 'dttooc';
            document.getElementById('weaponMinorVal').value = formatGermanNumber(weapon.minorVal);
            document.getElementById('weaponIsExotic').value = weapon.isExotic ? 'true' : 'false';
            const protoChk = document.getElementById('weaponIsPrototype');
            if (protoChk) {
                // EXOTEN: Die drei Waffenattribute sind fix – Prototyp-Bonus
                // (+50%) darf im Bearbeitungsmodus nicht aktivierbar sein.
                protoChk.disabled = !!weapon.isExotic;
                protoChk.checked = weapon.isExotic ? false : !!weapon.isPrototype;
            }
            const protoHintEdit = document.getElementById('protoDisabledHint');
            if (protoHintEdit) protoHintEdit.style.display = weapon.isExotic ? '' : 'none';

            // Mods zurückschreiben (Felder freigeben, Werte setzen)
            const slotMap = {
                optic:      { wrap: 'modSlotOpticWrap',      type: 'modOpticType',      val: 'modOpticVal' },
                muzzle:     { wrap: 'modSlotMuzzleWrap',     type: 'modMuzzleType',     val: 'modMuzzleVal' },
                underbarrel:{ wrap: 'modSlotUnderbarrelWrap',type: 'modUnderbarrelType',val: 'modUnderbarrelVal' },
                magazine:   { wrap: 'modSlotMagazineWrap',   type: 'modMagazineType',   val: 'modMagazineVal' }
            };
            Object.keys(slotMap).forEach(cat => {
                const m = weapon.mods && weapon.mods[cat] ? weapon.mods[cat] : { type: '', val: 0 };
                const s = slotMap[cat];
                const wrap = document.getElementById(s.wrap);
                if (wrap) wrap.style.display = '';
                const typeEl = document.getElementById(s.type);
                const valEl = document.getElementById(s.val);
                if (typeEl) { typeEl.disabled = false; typeEl.value = m.type || ''; }
                if (valEl) { valEl.disabled = false; valEl.value = m.type ? formatGermanNumber(m.val) : ''; }
                // Katalog-Drop-downs leeren (Werte stehen im Typ/Wert-Feld)
                const modSelEl = document.getElementById(MOD_SLOT_FORM[cat].mod);
                if (modSelEl) { modSelEl.disabled = false; modSelEl.value = ''; }
                const hintEl = document.getElementById(MOD_SLOT_FORM[cat].hint);
                if (hintEl) hintEl.textContent = '';
            });
            const msHint = document.getElementById('modSlotsHint');
            if (msHint) { msHint.textContent = ''; msHint.className = 'text-[11px] text-gray-500'; }
            // Auto-Mods-Schalter aus dem Datensatz übernehmen (Exotic: fix)
            const autoChkEdit = document.getElementById('autoModsToggle');
            if (autoChkEdit) {
                if (weapon.isExotic) {
                    autoChkEdit.checked = false;
                    autoChkEdit.disabled = true;
                } else {
                    autoChkEdit.checked = true;
                    autoChkEdit.disabled = false;
                    // BUGFIX: Nach dem Bearbeiten einer Exotic bleiben die
                    // Attribut-Felder sonst dauerhaft gesperrt – hier explizit
                    // freigeben, wenn KEINE Exotic bearbeitet wird.
                    if (typeof lockExoticAttributes === 'function') lockExoticAttributes(false);
                }
            }
            if (typeof toggleAutoMods === 'function') toggleAutoMods();
            updateModLiveSummary();

            // Talent: Exote -> Talent-Feld verstecken, Named -> sperren, sonst Drop-down
            const talentDesc = document.getElementById('talentDescription');
            if (weapon.isExotic) {
                currentExoticTalent = weapon.talent || '';
                if (tWrap) tWrap.style.display = 'none';
                if (tSel) tSel.value = '';
                if (talentDesc) talentDesc.textContent = 'Exotisches Talent: ' + (weapon.talent || '');
                // Fixe Exoten-Mods bleiben als normale Werte im Typ/Wert-Feld
                // stehen (aus dem Inventar-Datensatz) und werden so mitgespeichert.
            } else if (tSel && weapon.talent) {
                if (typeof populateTalentDropdown === 'function') populateTalentDropdown();
                const opt = Array.from(tSel.options).find(o => o.value === weapon.talent || o.textContent.startsWith(weapon.talent));
                if (opt) {
                    tSel.value = opt.value;
                    if (talentDesc) talentDesc.textContent = opt.dataset.description || '';
                } else {
                    // Named-/DB-fremdes Talent: als gesperrte Option anzeigen
                    currentNamedTalent = weapon.talent;
                    const o = document.createElement('option');
                    o.value = weapon.talent;
                    o.textContent = getTalentLabel(weapon.talent) + ' (Named)';
                    tSel.appendChild(o);
                    tSel.value = weapon.talent;
                    tSel.disabled = true;
                }
            } else if (tSel) {
                if (typeof populateTalentDropdown === 'function') populateTalentDropdown();
                tSel.value = '';
            }

            if (typeof updateWeaponCoreLabels === 'function') updateWeaponCoreLabels();
            if (typeof updateCore1Hint === 'function') updateCore1Hint();
            if (typeof updateCore2Hint === 'function') updateCore2Hint();
            if (typeof updateMinorHint === 'function') updateMinorHint();
            // EXOTEN (Bearbeitungsmodus): fixe Mods wie bei der initialen
            // Erfassung vorbelegen – Felder füllen & sperren, Katalog-Drop-downs
            // leeren, "fixe Mods"-Hinweis anzeigen. Die Mod-Werte stammen
            // vorrangig aus der Waffen-DB (aktuelle Daten), sonst aus dem
            // Inventar-Datensatz.
            if (weapon.isExotic) {
                const dbEntryEdit = (typeof weaponsData !== 'undefined' && weaponsData && weaponsData.weapons)
                    ? weaponsData.weapons.find(x => x.name === weapon.name) : null;
                const exoEdit = (dbEntryEdit && dbEntryEdit.exotic)
                    || (typeof EXOTIC_WEAPONS !== 'undefined' ? EXOTIC_WEAPONS[weapon.name] : null);
                let fixedMods = (exoEdit && exoEdit.fixedMods) ? exoEdit.fixedMods : null;
                if (!fixedMods) {
                    // Fallback: fixe Mods aus dem Inventar-Datensatz ableiten
                    const cats = ['optic', 'muzzle', 'underbarrel', 'magazine'];
                    fixedMods = cats
                        .filter(cat => weapon.mods && weapon.mods[cat] && weapon.mods[cat].type)
                        .map(cat => ({ slot: cat, attr: weapon.mods[cat].type, value: weapon.mods[cat].val, unit: '%' }));
                }
                currentExoticMods = (fixedMods && fixedMods.length) ? fixedMods : null;
                if (typeof updateModSlotUI === 'function') updateModSlotUI('fixed');
            } else if (typeof populateModSelects === 'function') {
                populateModSelects(weapon.name, weapon.type);
            }

            // DB-Auswahl (Waffentyp + Waffe) mit der bearbeiteten Waffe vorbelegen
            prefillWeaponDbSelects(weapon);

            editWeaponId = id;
            setEditUi(true, weapon.name);
            document.getElementById('weaponName').scrollIntoView({ behavior: 'smooth', block: 'center' });
            showToast(`✏️ „${weapon.name}“ wird bearbeitet – Änderungen speichern zum Aktualisieren.`, 'info');
        }

        function addWeapon() {
            // Überprüfe, ob die benötigten Elemente existieren
            const weaponName = document.getElementById('weaponName');
            const weaponType = document.getElementById('weaponType');
            const weaponBaseDmg = document.getElementById('weaponBaseDmg');
            const weaponTalentSelect = document.getElementById('weaponTalentSelectSelect');
            
            if (!weaponName || !weaponType || !weaponBaseDmg || !weaponTalentSelect) {
                console.error("Ein oder mehrere benötigte Elemente wurden nicht gefunden.");
                return;
            }

            const weapon = {
                name: document.getElementById('weaponName').value.trim(),
                type: document.getElementById('weaponType').value,
                baseDmg: parseLocalizedFloat(document.getElementById('weaponBaseDmg').value),
                core1: parseLocalizedFloat(document.getElementById('weaponCore1').value),
                core2Type: (WEAPON_CORE_ATTRIBUTES[document.getElementById('weaponType').value] || WEAPON_CORE_ATTRIBUTES['AR']).core2 || document.getElementById('weaponCore2Type').value,
                core2Val: parseLocalizedFloat(document.getElementById('weaponCore2Val').value),
                minorType: document.getElementById('weaponMinorType').value,
                minorVal: parseLocalizedFloat(document.getElementById('weaponMinorVal').value),
                talent: currentExoticTalent !== null ? (currentExoticTalent || 'Exotisches Talent') : (currentNamedTalent || document.getElementById('weaponTalentSelectSelect').value),
                isExotic: (document.getElementById('weaponIsExotic')?.value || 'false') === 'true',
                isPrototype: document.getElementById('weaponIsPrototype')?.checked || false
            };
            // EXOTEN: Prototyp-Flag abschalten – die drei Waffenattribute
            // sind fix und dürfen nie um +50% erhöht werden. Nur die Mods sind besonders.
            if (weapon.isExotic) weapon.isPrototype = false;

            // Mods: Nur sichtbare & gefüllte Slots übernehmen. Versteckte Slots
            // (Mod-Platz-Limit aus der Waffen-DB) oder leere Felder zählen als 0.
            // Der Name der gewählten Katalog-Mod wird mitgespeichert (Anzeige
            // in der Vergleichs-Detailansicht).
            const getModInput = (wrapId, typeId, valId, modId) => {
                const wrap = document.getElementById(wrapId);
                const typeEl = document.getElementById(typeId);
                const valEl = document.getElementById(valId);
                const modEl = modId ? document.getElementById(modId) : null;
                const active = wrap && wrap.style.display !== 'none' &&
                               typeEl && typeEl.value !== '' &&
                               valEl && String(valEl.value).trim() !== '';
                if (!active) return { type: '', val: 0, name: '' };
                const parsed = parseLocalizedFloat(valEl.value);
                return { type: typeEl.value, val: isNaN(parsed) ? 0 : parsed, name: (modEl && modEl.value) || '' };
            };
            weapon.mods = {
                optic: getModInput('modSlotOpticWrap', 'modOpticType', 'modOpticVal', 'modOpticMod'),
                muzzle: getModInput('modSlotMuzzleWrap', 'modMuzzleType', 'modMuzzleVal', 'modMuzzleMod'),
                underbarrel: getModInput('modSlotUnderbarrelWrap', 'modUnderbarrelType', 'modUnderbarrelVal', 'modUnderbarrelMod'),
                magazine: getModInput('modSlotMagazineWrap', 'modMagazineType', 'modMagazineVal', 'modMagazineMod')
            };

            // Auto-Mods-Schalter übernehmen (Exotics: immer fixe Mods)
            const autoChk = document.getElementById('autoModsToggle');
            weapon.autoMods = !weapon.isExotic && autoChk && autoChk.checked;

            // Validierung
            if (!weapon.name) {
                showToast('Bitte gib einen Waffen-Namen ein.', 'error');
                return;
            }
            // Issue #35: ID-Counter nur fuer wirklich NEUE Waffen erhoehen
            // (Edit behaelt die alte ID; Validierungsabbruch liegt davor).
            if (editWeaponId !== null) weapon.id = editWeaponId;
            else weapon.id = weaponIdCounter++;

            if (editWeaponId !== null) {
                // Bearbeitungsmodus: vorhandene Waffe aktualisieren (ID bleibt)
                const idx = weaponsInventory.findIndex(w => w.id === editWeaponId);
                if (idx >= 0) {
                    weapon.id = editWeaponId;
                    weaponsInventory[idx] = weapon;
                } else {
                    weaponsInventory.push(weapon);
                }
                editWeaponId = null;
                setEditUi(false);
                saveToLocalStorage();
                renderWeaponsInventory();
                updateTabUI();
                markComparisonStale();
                showToast(`💾 Waffe "${weapon.name}" aktualisiert!`, 'success');
            } else {
                weaponsInventory.push(weapon);
                saveToLocalStorage();
                renderWeaponsInventory();
                updateTabUI();
                markComparisonStale();
                showToast(`✅ Waffe "${weapon.name}" hinzugefügt!`, 'success');
            }

            // Formular zurücksetzen
            document.getElementById('weaponForm').reset();
            const exoticReset = document.getElementById('weaponIsExotic'); if (exoticReset) exoticReset.value = 'false';
            // Prototyp-Checkbox nach Exoten-Bearbeitung wieder freigeben (Standard: an)
            const protoReset = document.getElementById('weaponIsPrototype');
            if (protoReset) { protoReset.disabled = false; protoReset.checked = true; }
            const protoHintReset = document.getElementById('protoDisabledHint');
            if (protoHintReset) protoHintReset.style.display = 'none';
            // Mod-Slots wieder freigeben (alle 4 sichtbar, Exoten-Sperre aufheben)
            if (typeof clearExoticFixedMods === 'function') clearExoticFixedMods();
            if (typeof updateModSlotUI === 'function') updateModSlotUI(null);
            // Named-Zustand zurücksetzen, Talent-Auswahl wieder freigeben
            currentNamedTalent = null;
            currentNamedAttr = null;
            const nWrapReset = document.getElementById('weaponTalentSelectWrap');
            if (nWrapReset) nWrapReset.style.display = '';
            const nSelReset = document.getElementById('weaponTalentSelectSelect');
            if (nSelReset) {
                Array.from(nSelReset.options).filter(o => o.textContent.includes(' (Named)')).forEach(o => o.remove());
                nSelReset.disabled = false;
                nSelReset.value = '';
            }
            const nDescReset = document.getElementById('talentDescription');
            if (nDescReset) nDescReset.textContent = '';
            for (const cat of Object.keys(MOD_SLOT_FORM)) {
                const e = MOD_SLOT_FORM[cat];
                const ms = document.getElementById(e.mod);
                if (ms) ms.value = '';
                const h = document.getElementById(e.hint);
                if (h) h.textContent = '';
                // Geister-Mods verhindern: Typ & Wert nach dem Reset leeren,
                // sonst greifen die HTML-Defaults (chc + 10) und landen als
                // unbeabsichtigte Mods in der naechsten Waffe.
                const ts = document.getElementById(e.type);
                if (ts) { ts.value = ''; ts.disabled = false; }
                const vs = document.getElementById(e.val);
                if (vs) { vs.value = ''; vs.disabled = false; }
            }
            updateModLiveSummary();
        }

        function deleteWeapon(id) {
            weaponsInventory = weaponsInventory.filter(w => w.id !== id);
            // Wird die gerade bearbeitete Waffe gelöscht -> Edit-Modus beenden
            if (editWeaponId === id) { editWeaponId = null; setEditUi(false); }
            saveToLocalStorage();
            renderWeaponsInventory();
            updateTabUI();
            markComparisonStale();
            showToast('Waffe wurde entfernt.', 'info');
        }

        // Klick auf eine Tabellenspalte (Waffen-Inventar): sortiert danach.
        // Erneuter Klick auf dieselbe Spalte kehrt die Richtung um. Der
        // "Sortieren nach"-Dropdown wird, falls eine passende Option existiert,
        // mitgeführt, damit beide Bedienwege synchron bleiben.
        const weaponColumnSortDefaults = {
            name: true,
            type: true,
            baseDmg: false,
            core1: false,
            core2Val: false,
            minorVal: false,
            recommendation: false
        };
        const weaponColumnToDropdownOption = {
            name: 'name',
            type: 'type',
            baseDmg: 'baseDmgDesc',
            core1: 'core1Desc',
            core2Val: 'core2Desc',
            minorVal: 'minorDesc',
            recommendation: 'recommendationDesc'
        };
        function sortWeaponsByColumn(field) {
            if (currentWeaponSortField === field) {
                currentWeaponSortAsc = !currentWeaponSortAsc;
            } else {
                currentWeaponSortField = field;
                currentWeaponSortAsc = weaponColumnSortDefaults[field] !== false;
            }
            // Dropdown synchron halten, falls eine passende Option existiert
            // (z.B. baseDmgDesc). Für die "falsche" Richtung (z.B. baseDmg
            // aufsteigend) gibt es keine Dropdown-Entsprechung -> Auswahl
            // bleibt dann unverändert.
            const dropdownOption = weaponColumnToDropdownOption[field];
            const sortSelect = document.getElementById('weaponSortCriteria');
            if (sortSelect && dropdownOption) {
                const matchesDefaultDirection = weaponColumnSortDefaults[field] !== false
                    ? currentWeaponSortAsc
                    : !currentWeaponSortAsc;
                if (matchesDefaultDirection) sortSelect.value = dropdownOption;
            }
            renderWeaponsInventory();
        }

        // Aktualisiert die Pfeil-Symbole (▲/▼) in den Tabellenköpfen des
        // Waffen-Inventars, passend zum aktuellen Sortierfeld/-richtung.
        function updateWeaponSortHeaderIcons() {
            const fields = ['name', 'type', 'baseDmg', 'core1', 'core2Val', 'minorVal', 'recommendation'];
            fields.forEach(f => {
                const el = document.getElementById('wSortIcon-' + f);
                if (!el) return;
                el.textContent = (f === currentWeaponSortField) ? (currentWeaponSortAsc ? '▲' : '▼') : '';
            });
        }

        function sortAndRenderWeapons() {
            const criteria = document.getElementById('weaponSortCriteria').value;
            if (criteria === 'name') {
                currentWeaponSortField = 'name';
                currentWeaponSortAsc = true;
            } else if (criteria === 'baseDmgDesc') {
                currentWeaponSortField = 'baseDmg';
                currentWeaponSortAsc = false;
            } else if (criteria === 'core1Desc') {
                currentWeaponSortField = 'core1';
                currentWeaponSortAsc = false;
            } else if (criteria === 'core2Desc') {
                currentWeaponSortField = 'core2Val';
                currentWeaponSortAsc = false;
            } else if (criteria === 'minorDesc') {
                currentWeaponSortField = 'minorVal';
                currentWeaponSortAsc = false;
            } else if (criteria === 'type') {
                currentWeaponSortField = 'type';
                currentWeaponSortAsc = true;
            } else if (criteria === 'recommendationDesc') {
                currentWeaponSortField = 'recommendation';
                currentWeaponSortAsc = false;
            }
            renderWeaponsInventory();
        }

        // Kennzeichnet Waffen derselben "Marke"/Familie (gleiche Gattung +
        // gleiche Feuerrate = dasselbe Basismodell), deren Basis-Schaden
        // unter dem Familien-Maximum liegt (z.B. Military AK-M 64.717 vs.
        // AK-M 67.175). Basisschaden ist je Familie fix – die Werte stammen
        // aus der Waffen-DB, nicht aus dem Inventar-Eintrag.
        // Normalisiert Waffen-Namen auf das Basismodell ("Marke"): Praefixe
        // wie Military/Black Market/Classic/Police/Tactical, Varianten-
        // suffixe (E4, Replica) und Sonderzeichen fallen weg –
        // "Black Market AK-M Replica" und "AK-M" sind dieselbe Familie.
        function normalizeWeaponModel(name) {
            return String(name || '')
                .toLowerCase()
                .replace(/replica/g, '')
                .replace(/^(military|black market|classic|custom|police|tactical|socum|soc|socom)\s+/g, '')
                .replace(/e\d+/g, '')
                .replace(/[^a-z0-9]/g, '');
        }

        function getFamilyDamageInfo(weaponName, weaponType) {
            try {
                if (typeof weaponsData === 'undefined' || !weaponsData || !weaponsData.weapons) return null;
                const entry = weaponsData.weapons.find(x => x.name === weaponName);
                if (!entry || !entry.stats || !entry.stats.RPM || !entry.stats['Level 40 Damage']) return null;
                const rpm = entry.stats.RPM;
                const model = normalizeWeaponModel(entry.name);
                // Familien-Maximum: alle DB-Waffen mit gleicher Gattung + RPM
                // und gleichem normalisiertem Basismodell ("gleiche Marke")
                const family = weaponsData.weapons.filter(x => x.type === entry.type
                    && x.stats && x.stats.RPM === rpm && x.stats['Level 40 Damage']
                    && normalizeWeaponModel(x.name) === model);
                if (family.length < 2) return null;
                let best = null;
                family.forEach(x => { if (!best || x.stats['Level 40 Damage'] > best.stats['Level 40 Damage']) best = x; });
                const myDmg = entry.stats['Level 40 Damage'];
                if (!best || myDmg >= best.stats['Level 40 Damage']) return null;
                const deficitPct = (1 - myDmg / best.stats['Level 40 Damage']) * 100;
                return { familyMax: best.stats['Level 40 Damage'], bestName: best.name, deficitPct: deficitPct, rpm: rpm };
            } catch (e) { return null; }
        }

        // HTML-Badge für schwächere Familien-Modelle (für die Inventar-Tabelle)
        function familyDamageBadge(weaponName, weaponType) {
            const info = getFamilyDamageInfo(weaponName, weaponType);
            if (!info) return '';
            return `<div class="text-[10px] text-amber-400 mt-0.5" title="Gleiches Basismodell (${info.rpm} RPM): ${info.bestName} macht ${formatGermanNumber(info.familyMax)} Basis-Schaden – ${weaponName} liegt ${formatGermanNumber(info.deficitPct)}% darunter.">⚠ Schwächeres Modell: −${formatGermanNumber(info.deficitPct)}% Familienschaden</div>`;
        }

        // Vergleicht Doppel im Inventar: Dieselbe Waffe (gleicher Name) mehrfach
        // angelegt, mit gleichen Attributsarten (Kern 2 / Attribut 3) – ist eine
        // andere Variante in ALLEN drei Werten (Kern 1, Kern 2, Attribut 3)
        // mindestens gleich gut und in mindestens einem besser, ist dieser
        // Eintrag dominiert ("schwachere Roll-Variante"). Die Waffen-Slots
        // bleiben unberuecksichtigt (Mods sind frei tauschbar).
        function rollDominanceBadge(weapon) {
            if (!weapon || !weapon.name) return '';
            const isDominating = (other) =>
                other !== weapon && other.name === weapon.name
                && (other.core2Type || '') === (weapon.core2Type || '')
                && (other.minorType || '') === (weapon.minorType || '')
                && other.core1 >= weapon.core1
                && other.core2Val >= weapon.core2Val
                && other.minorVal >= weapon.minorVal
                && (other.core1 > weapon.core1 || other.core2Val > weapon.core2Val || other.minorVal > weapon.minorVal);
            const better = (weaponsInventory || []).find(isDominating);
            if (!better) return '';
            const diffs = [];
            if (better.core1 > weapon.core1) diffs.push(`Kern 1: ${formatGermanNumber(better.core1)}% statt ${formatGermanNumber(weapon.core1)}%`);
            if (better.core2Val > weapon.core2Val) diffs.push(`Kern 2: ${formatGermanNumber(better.core2Val)}% statt ${formatGermanNumber(weapon.core2Val)}%`);
            if (better.minorVal > weapon.minorVal) diffs.push(`Attribut 3: ${formatGermanNumber(better.minorVal)}% statt ${formatGermanNumber(weapon.minorVal)}%`);
            return `<div class="text-[10px] text-amber-400 mt-0.5" title="Schwächere Roll-Variante dieser Waffe im Inventar – ${diffs.join(' · ')}">⚠ Schwächere Roll-Variante im Inventar</div>`;
        }

        // ===== GEARSET-PROGNOSE (Waffen-Inventar) =====
        // Bewertet jede Waffe mit der Schadens-Mathik des Optimizers, aber
        // OHNE Build-Kontext – nur Basis-Schaden, die drei Waffenattribute
        // (Kern 1, Kern 2, Attribut 3) und das Waffen-Talent:
        //   Score = Basis-Schaden
        //           x (1 + (Kern1 + Talent-WD)/100)          [Waffen-Schaden]
        //           x (1 + DTToOC/100) x (1 + DTA/100) x (1 + DTH/100)
        //           x (1 + min(CHC,60)/100 x CHD/100)        [Krit-Erwartung]
        //           x (1 + Talent-Verstärker/100)
        //           x (1 + Talent-Feuerrate/100)
        // Bedingte Talente gelten als aktiv (Optimist, Druckpunkt etc.),
        // Utility-Talente (kein Schadenswert) tragen 0 bei. HSD fließt nicht
        // ein (kopfschuss-situativ), Mods ebenfalls nicht (frei tauschbar).
        // ===== Helper: DB-Eintrag einer Waffe (RPM, Magazin, Nachladezeit) =====
        function getWeaponDbEntry(weapon) {
            if (typeof weaponsData === 'undefined' || !weaponsData || !weaponsData.weapons) return null;
            const name = String((weapon && weapon.name) || '').toLowerCase();
            if (!name) return null;
            return weaponsData.weapons.find(x => x && x.name && x.name.toLowerCase() === name) || null;
        }

        // ===== Einheitliche Raritäts-/Status-Badges (Waffen & Gear) =====
        // Orange Pill = Exotic · Goldene Pill = Named · Graue Pill = Prototyp
        function rarityBadge(isExotic, isNamed) {
            if (isExotic) return ' <span class="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-orange-950/80 border border-orange-500/40 text-orange-300 font-normal" title="Exotischer Gegenstand – fixe Attribute & Mods">🟠 Exotic</span>';
            if (isNamed) return ' <span class="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-yellow-950/80 border border-yellow-500/40 text-yellow-300 font-normal" title="Named-Gegenstand – spezifisches Talent, ggf. High-End- oder Prototyp-Werte">🟡 Named</span>';
            return '';
        }
        function protoBadge() {
            return ' <span class="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-zinc-800 border border-gray-600 text-gray-300 font-normal" title="Prototyp – alle Max-Werte +50%">Prototyp</span>';
        }
        function weaponIsNamed(w) {
            if (w && w.isNamed != null) return !!w.isNamed;
            const e = getWeaponDbEntry(w);
            return !!(e && e.is_named);
        }
        // Gear: Exotic/Named aus der GEAR_DB (cls:'exotic' / cls:'named')
        function gearRarityBadges(item) {
            const e = GEAR_DB[item.setName];
            if (!e) return '';
            return rarityBadge(e.cls === 'exotic', e.cls === 'named');
        }

        // Summiert alle Mod-Beiträge eines Berechnungstyps (z.B. 'rof',
        // 'capacity', 'reloadSpeed', 'handling', 'stability', 'accuracy').
        function modAttrTotal(weapon, attrType) {
            let total = 0;
            const m = getEffectiveMods(weapon) || {};
            ['optic', 'muzzle', 'underbarrel', 'magazine'].forEach(cat => {
                if (m[cat] && m[cat].type === attrType) total += (m[cat].val || 0);
            });
            return total;
        }

        // Komfort-Skala (1-5 Balken): Handling-/Stabilitäts-/Genauigkeits-/
        // Nachladetempo-Boni aus Mods + Nebenattribut. Rein komfortbezogen,
        // fließt NICHT in den Schadens-Score ein (nur Anzeige).
        function handlingComfort(weapon) {
            let pts = 0;
            pts += modAttrTotal(weapon, 'handling') * 1.0;
            pts += modAttrTotal(weapon, 'stability') * 0.6;
            pts += modAttrTotal(weapon, 'accuracy') * 0.4;
            pts += modAttrTotal(weapon, 'reloadSpeed') * 0.8;
            if (weapon && weapon.minorType === 'handling') pts += (weapon.minorVal || 0) * 1.0;
            if (weapon && weapon.minorType === 'reloadSpeed') pts += (weapon.minorVal || 0) * 0.8;
            const bars = pts <= 0 ? 1 : Math.max(1, Math.min(5, Math.ceil(pts / 15)));
            return { bars: bars, points: pts };
        }

        // Effektive Feuerrate: DB-RPM + RoF-Boni aus Mods (Talent-RoF kommt
        // separat aus der Talent-Definition dazu).
        function weaponEffectiveRpm(weapon, talentRofPct) {
            const dbEntry = getWeaponDbEntry(weapon);
            const baseRpm = dbEntry && dbEntry.stats && dbEntry.stats.RPM ? dbEntry.stats.RPM : null;
            const rofPct = (modAttrTotal(weapon, 'rof') || 0) + (talentRofPct || 0);
            if (!baseRpm) return { rpm: null, rofPct: rofPct };
            return { rpm: baseRpm * (1 + rofPct / 100), rofPct: rofPct };
        }

        // Sustain-Faktor: Anteil der Zeit, der tatsächlich gefeuert wird
        // (Magazingröße inkl. Kapazitäts-Mods vs. Nachladezeit inkl.
        // Nachladetempo-Boni). null = keine DB-Daten, Faktor 1.
        function weaponSustainFactor(weapon, effRpm, extraReloadSpeedPct) {
            const dbEntry = getWeaponDbEntry(weapon);
            if (!dbEntry || !dbEntry.stats) return null;
            const baseMag = dbEntry.stats['Modded Mag Size'] || dbEntry.stats['Base Mag Size'];
            const reloadSec = dbEntry.stats['Empty Reload (secs)'];
            if (!baseMag || !reloadSec || !effRpm) return null;
            const mag = baseMag + modAttrTotal(weapon, 'capacity');
            const reloadSpeedPct = (weapon && weapon.minorType === 'reloadSpeed' ? (weapon.minorVal || 0) : 0)
                + modAttrTotal(weapon, 'reloadSpeed') + (extraReloadSpeedPct || 0);
            const reload = reloadSec / (1 + reloadSpeedPct / 100);
            const fireTime = mag / (effRpm / 60);
            return fireTime / (fireTime + reload);
        }

        // ===== Magazin-abhängige Talente: Ø-Bonus über ein volles Magazin ====
        // Optimist, Angespannt (Strained) und Raserei (Frenzy) hängen vom
        // Munitions-/Feuer-Zyklus ab. Statt des Best-Case-Maximalwerts wird
        // der zu erwartende Durchschnitt über ein volles Magazin berechnet
        // (RPM, Magazingröße, Nachladezeit aus der Waffen-DB, Mod-Boni für
        // Kapazität/Nachladetempo). Ohne DB-Daten: Fallback 50% des Maximums.
        function effectiveMagStats(weapon) {
            const dbEntry = getWeaponDbEntry(weapon);
            if (!dbEntry || !dbEntry.stats) return null;
            const stats = dbEntry.stats;
            const mag = (stats['Modded Mag Size'] || stats['Base Mag Size'] || 0) + modAttrTotal(weapon, 'capacity');
            const rpm = stats.RPM || 0;
            if (!mag || !rpm) return null;
            const reloadRaw = stats['Empty Reload (secs)'] || 0;
            const reloadSpeedPct = modAttrTotal(weapon, 'reloadSpeed')
                + (weapon && weapon.minorType === 'reloadSpeed' ? (weapon.minorVal || 0) : 0);
            const reload = reloadRaw ? reloadRaw / (1 + reloadSpeedPct / 100) : 0;
            return { mag: Math.max(1, Math.round(mag)), rpm: rpm, reload: reload };
        }

        // Liefert für magazin-abhängige Talente den Ø-Beitrag
        // ({ wd, chd, rof, note }) oder null für alle anderen Talente.
        // Liefert fuer magazin-abhaengige Talente den Durchschnitts-Beitrag
        // ({ wd, chd, rof, note }) oder null fuer alle anderen Talente.
        // Issue #34: Einheitliche "Modifikatoren pro Schuss i von n"-Logik
        // statt Spezialfaelle. Alle vier Talente (Abgemessen, Optimist,
        // Angespannt, Raserei) iterieren Schuss fuer Schuss ueber das
        // Magazin und mitteln die Modifikatoren.
        function magazineModifiersPerShot(tKey, weapon) {
            const k = String(tKey || '').toLowerCase();
            const perfekt = k.indexOf('perfekt') === 0;
            const ms = effectiveMagStats(weapon);
            const n = ms && ms.mag > 0 ? ms.mag : 0;
            const fmt = v => formatGermanNumber(Math.round(v * 100) / 100);

            const avg = (mods) => {
                if (!mods) return null;
                if (!n) return mods.fallback;
                let wd = 0, chd = 0, rof = 0;
                for (let i = 0; i < n; i++) { wd += mods.wd(i, n); chd += mods.chd(i, n); rof += mods.rof(i, n); }
                return { wd: wd / n, chd: chd / n, rof: rof / n };
            };

            // Abgemessen (Measured): Schuss i (0-basiert, Magazin wird von
            // oben nach unten geleert) - obere Haelfte: +25% (+30%) RoF,
            // -25% (-30%) WD; untere Haelfte: -18% RoF, +30% (+40%) WD.
            // Frueher: nur +30% WD Best-Case fuer den ganzen Zyklus -> Waffe
            // wurde ueberschaetzt (Issue #34).
            const isMeasured = (k === 'abgemessen' || k === 'gemessen' || k === 'measured'
                || k === 'perfekt_abgemessen' || k === 'perfekt_gemessen' || k === 'perfect_measured');
            if (isMeasured) {
                const wdHi = perfekt ? -30 : -25, rofHi = perfekt ? 30 : 25;
                const wdLo = perfekt ? 40 : 30, rofLo = -18;
                const res = avg({
                    wd: (i, m) => (i < m / 2 ? wdHi : wdLo),
                    chd: () => 0,
                    rof: (i, m) => (i < m / 2 ? rofHi : rofLo),
                    fallback: { wd: (wdHi + wdLo) / 2, chd: 0, rof: (rofHi + rofLo) / 2 }
                });
                if (!res) return null;
                return { ...res, note: `Magazin-Ø (${n ? n + ' Schuss' : 'ohne DB-Daten'}): Ø ${fmt(res.wd)}% WD / ${fmt(res.rof)}% RoF (obere Hälfte ${rofHi > 0 ? '+' : ''}${rofHi}% RoF / ${wdHi}% WD, untere +${wdLo}% WD / ${rofLo}% RoF)` };
            }

            // Optimist: +3,5% (4,5%) WD je 10% fehlender Munition; beim
            // i-ten Schuss fehlen i/mag der Munition.
            const isOptimist = (k === 'optimist' || k === 'perfekter_optimist' || k === 'perfekt_optimist');
            if (isOptimist) {
                const per10 = perfekt ? 4.5 : 3.5;
                const res = avg({
                    wd: (i, m) => per10 * ((i / m) * 10),
                    chd: () => 0,
                    rof: () => 0,
                    fallback: { wd: per10 * 5, chd: 0, rof: 0 }
                });
                if (!res) return null;
                return { ...res, note: `Magazin-Ø (${n ? n + ' Schuss' : 'ohne DB-Daten'}): +${fmt(res.wd)}% WD statt Best-Case +${fmt(per10 * 10)}%` };
            }

            // Angespannt (Strained): +10% CHD je 0,5s Feuern, max. 5 (8)
            // Stacks. Stack-Stand beim i-ten Schuss aus Schussintervall.
            const isStrained = (k === 'angespannt' || k === 'perfekt_angespannt' || k === 'strained');
            if (isStrained) {
                const perStack = 10, maxStacks = perfekt ? 8 : 5;
                const dt = ms ? 60 / ms.rpm : 0;
                const res = avg({
                    wd: () => 0,
                    chd: (i) => Math.min(Math.floor((i * dt) / 0.5), maxStacks) * perStack,
                    rof: () => 0,
                    fallback: { wd: 0, chd: (perStack * maxStacks) / 2, rof: 0 }
                });
                if (!res) return null;
                return { ...res, note: `Magazin-Ø (${n ? n + ' Schuss @ ' + ms.rpm + ' RPM' : 'ohne DB-Daten'}): +${fmt(res.chd)}% CHD statt Best-Case +${fmt(perStack * maxStacks)}%` };
            }

            // Raserei (Frenzy): je 10 Kugeln Magazin +3% WD & +3% RoF fuer
            // 9s nach leerem Nachladen. Ø = Stacks x 3% x Aktivzeitanteil
            // am Zyklus (Feuerzeit + Nachladezeit). Kuratierte Talent-DB:
            // je 10 Kugeln (frueher hier faelschlich 8).
            const isFrenzy = (k === 'raserei' || k === 'perfekt_raserei' || k === 'frenzy');
            if (isFrenzy) {
                if (ms) {
                    const stacks = Math.floor(ms.mag / 10);
                    const fireTime = ms.mag / (ms.rpm / 60);
                    const cycle = fireTime + ms.reload;
                    const duty = Math.min(1, 9 / (cycle || 1));
                    const a = 3 * stacks * duty;
                    return { wd: a, chd: 0, rof: a,
                        note: `Nachladezyklus-Ø (${ms.mag} Schuss → ${stacks} Stacks à +3%/+3%, ${fmt(duty * 100)}% Aktivzeit): +${fmt(a)}% WD & RoF` };
                }
                return { wd: 9, chd: 0, rof: 9, note: 'ohne DB-Daten: geschätzter Ø-Wert (+9% WD/RoF)' };
            }
            return null;
        }
        // Abwaertskompatible Haelfte: alle Aufrufer nutzen weiterhin
        // magazineAverageTalent().
        function magazineAverageTalent(tKey, weapon) {
            return magazineModifiersPerShot(tKey, weapon);
        }

        function weaponGearsetScore(weapon) {
            if (!weapon || !weapon.baseDmg) return null;
            let wd = weapon.core1 || 0;
           const ep = (typeof enemyProfile === "function") ? enemyProfile() : { armor: 0.8, health: 0.2, ooc: 0.7 };
            let chc = 0, chd = 0, dttooc = 0, dta = 0, dth = 0;
            let amp = 0, rof = 0;
            // Drei Waffenattribute einbeziehen (Kern 2 + Attribut 3)
            [[weapon.core2Type, weapon.core2Val], [weapon.minorType, weapon.minorVal]].forEach(([type, val]) => {
                if (!type) return;
                if (type === 'dttooc') dttooc += (val || 0);
                else if (type === 'dta') dta += (val || 0);
                else if (type === 'dth') dth += (val || 0);
                else if (type === 'chc') chc += (val || 0);
                else if (type === 'chd') chd += (val || 0);
                else if (type === 'rof') rof += (val || 0);
            });
            // Mod-RoF (z.B. Allegro-Magazin) in die Feuerrate einbeziehen
            rof += modAttrTotal(weapon, 'rof');
            // CHC/CHD aus Mods einbeziehen – konsistent zum kombinierten
            // Vergleich, der Mod-Krit-Werte bereits zaehlt.
            chc += modAttrTotal(weapon, 'chc');
            chd += modAttrTotal(weapon, 'chd');
            // Talent-Beitrag (bedingte Talente als aktiv angenommen)
            let talentNote = '';
            if (weapon.talent && weapon.talent !== 'none' && typeof resolveTalentDef === 'function') {
                const rt = resolveTalentDef(weapon.talent);
                const t = rt.t;
                if (t && t.type && typeof talentValueFor === 'function') {
                    const v = talentValueFor(rt.key, weapon.isExotic) || 0;
                    const magAvg = (typeof magazineAverageTalent === 'function') ? magazineAverageTalent(rt.key, weapon) : null;
                    if (magAvg) {
                        wd += magAvg.wd; chd += magAvg.chd; rof += magAvg.rof;
                        talentNote = `${getTalentLabel(weapon.talent)}: +${formatGermanNumber(magAvg.wd || magAvg.chd)}% (${t.kategorie || t.type}) — ${magAvg.note}`;
                    } else {
                        if (t.type === 'wd') wd += v;
                        else if (t.type === 'chd') chd += v;
                        else if (t.type === 'chcchd') { chc += v; chd += v; }
                        else if (t.type === 'wdrof') { wd += v; rof += v; }
                        else if (t.type === 'rof') rof += v;
                        else if (t.type === 'amp') amp += v;
                        talentNote = `${getTalentLabel(weapon.talent)}: +${formatGermanNumber(v)}${t.unit || '%'} (${t.kategorie || t.type})`;
                    }
                } else {
                    talentNote = weapon.isExotic
                        ? `${getTalentLabel(weapon.talent)}: exotisches Talent – Schadensanteil nicht modelliert`
                        : `${getTalentLabel(weapon.talent)}: Utility-Talent – kein Schadensbeitrag`;
                }
            }
            // Issue #75: modellierte Exoten-Waffen-Talente im Waffen-Score
            // (nur wenn nicht schon ueber WEAPON_TALENTS erfasst, z.B. Chameleon)
            const exoWDef2 = (typeof exoticWeaponTalentDef === 'function') ? exoticWeaponTalentDef(weapon) : null;
            const exoW2 = (typeof exoticWeaponTalentBonus === 'function') ? exoticWeaponTalentBonus(weapon) : null;
            if (exoWDef2 && exoW2) {
                const wtHas = !!(weapon.talent && weapon.talent !== 'none' && resolveTalentDef(weapon.talent).t);
                if (!wtHas) {
                    wd += exoW2.wd; chc += exoW2.chc; chd += exoW2.chd;
                    dttooc += exoW2.dttooc; dta += exoW2.dta; rof += exoW2.rof; amp += exoW2.amp;
                    talentNote = `${exoWDef2.label} (${exoWDef2.perk}) – modelliert (HSD-Anteil erst mit Kopfschuss-Modell im Score)`;
                }
            }
            const critFactor = 1 + (Math.min(chc, 60) / 100) * (chd / 100);
            // ===== Feuerrate & Magazin/Nachladezeit in den Score einbeziehen =====
            // In Division 2 entscheidet bei Waffen gleicher Gattung oft RPM +
            // Nachladezeit über den echten Schaden pro Sekunde. Der Score wird
            // daher um zwei Faktoren erweitert (nur wenn DB-Daten vorliegen):
            //   rofFactor     = effektive RPM / 600 (typischer AR-RPM = Skala 1)
            //   sustainFactor = Feuerzeit / (Feuerzeit + Nachladezeit)
            const rpmInfo = weaponEffectiveRpm(weapon, rof);
            const sustain = weaponSustainFactor(weapon, rpmInfo.rpm);
            // Schaden pro Schuss (ohne Feuerraten-Effekte)
            const perShot = (weapon.baseDmg || 0)
                * (1 + wd / 100)
                * (1 + (dttooc / 100) * ep.ooc) * (1 + (dta / 100) * ep.armor) * (1 + (dth / 100) * ep.health)
                * critFactor
                * (1 + amp / 100);
            // Score = Schaden pro Schuss × RoF-Faktor (Talent/Mods) ×
            // Grund-Feuerrate der DB (RPM/600 = Skala 1) × Sustain-Faktor
            const dbEntry = getWeaponDbEntry(weapon);
            const baseRpm = (dbEntry && dbEntry.stats && dbEntry.stats.RPM) ? dbEntry.stats.RPM : null;
            let score = perShot * (1 + rof / 100);
            if (baseRpm) score *= (baseRpm / 600);
            if (sustain) score *= sustain;
            // DPS-Schätzung: Schaden pro Schuss × effektive Feuerrate (inkl.
            // RoF-Boni aus Mods/Talent) pro Sekunde
            const dps = rpmInfo.rpm ? perShot * (rpmInfo.rpm / 60) : null;
            return {
                score: score, dps: dps, talentNote: talentNote, wd: wd, dttooc: dttooc,
                dta: dta, dth: dth, chc: chc, chd: chd, amp: amp, rof: rof,
                rpm: rpmInfo.rpm, sustain: sustain
            };
        }

        // ===== Schnellvergleich: Auswahl von bis zu 2 Waffen für die Diff-Ansicht =====
        let compareWeaponIds = [];

        function toggleCompareWeapon(id) {
            const idx = compareWeaponIds.indexOf(id);
            if (idx >= 0) {
                compareWeaponIds.splice(idx, 1);
            } else {
                if (compareWeaponIds.length >= 2) compareWeaponIds.shift();
                compareWeaponIds.push(id);
            }
            renderWeaponsInventory();
        }

        // Diff-Zelle: Wert mit farblicher Markierung (grün = besser, rot = schlechter)
        function compareCell(label, valA, valB, higherIsBetter, fmt) {
            const f = fmt || (v => formatGermanNumber(v));
            const na = valA === null || valA === undefined || valA === '' || (typeof valA === 'number' && isNaN(valA));
            const nb = valB === null || valB === undefined || valB === '' || (typeof valB === 'number' && isNaN(valB));
            let clsB = 'text-gray-300';
            if (!na && !nb && valA !== valB) {
                const aBetter = higherIsBetter ? valA > valB : valA < valB;
                clsB = aBetter ? 'text-red-400' : 'text-emerald-400';
            }
            return `<tr>
                <td class="py-1 pr-3 text-gray-500">${label}</td>
                <td class="py-1 pr-3 font-mono ${na ? 'text-gray-600' : 'text-white'}">${na ? '—' : f(valA)}</td>
                <td class="py-1 font-mono ${clsB}">${nb ? '—' : f(valB)}</td>
            </tr>`;
        }

        // Rendert die Diff-Ansicht (Schnellvergleich) über dem Waffen-Inventar,
        // sobald 1-2 Waffen für den Vergleich markiert wurden.
        function renderWeaponComparePanel() {
            const panel = document.getElementById('weaponComparePanel');
            if (!panel) return;
            const weapons = compareWeaponIds
                .map(id => (weaponsInventory || []).find(w => w.id === id))
                .filter(Boolean);
            if (weapons.length === 0) { panel.innerHTML = ''; panel.classList.add('hidden'); return; }
            panel.classList.remove('hidden');
            const a = weapons[0];
            const b = weapons[1] || null;
            const sa = weaponGearsetScore(a) || {};
            const sb = b ? (weaponGearsetScore(b) || {}) : {};
            const comfortA = handlingComfort(a);
            const comfortB = b ? handlingComfort(b) : null;
            const bars = n => '▮'.repeat(n) + '▯'.repeat(5 - n);
            let rows = '';
            rows += compareCell('Basis-Schaden', a.baseDmg, b ? b.baseDmg : null, true);
            rows += compareCell('Kern 1 (WD %)', a.core1, b ? b.core1 : null, true);
            rows += compareCell('Kern 2', a.core2Val ? `${formatGermanNumber(a.core2Val)}% ${String(a.core2Type || '').toUpperCase()}` : null,
                                        b && b.core2Val ? `${formatGermanNumber(b.core2Val)}% ${String(b.core2Type || '').toUpperCase()}` : null, true, v => v);
            rows += compareCell('Attribut 3', a.minorVal ? `${formatGermanNumber(a.minorVal)}% ${String(a.minorType || '').toUpperCase()}` : null,
                                        b && b.minorVal ? `${formatGermanNumber(b.minorVal)}% ${String(b.minorType || '').toUpperCase()}` : null, true, v => v);
            rows += compareCell('Feuerrate (eff.)', sa.rpm || null, sb.rpm || null, true, v => formatGermanNumber(Math.round(v)) + ' RPM');
            rows += compareCell('Sustain-Faktor', sa.sustain || null, sb.sustain || null, true, v => formatGermanNumber(Math.round(v * 100)) + '%');
            rows += compareCell('Komfort (Handling)', comfortA.bars, comfortB ? comfortB.bars : null, true, v => `${bars(v)} (${v}/5)`);
            rows += compareCell('Empfehlungs-Score', sa.score || null, sb.score || null, true);
            rows += compareCell('DPS-Schätzung', sa.dps || null, sb.dps || null, true);
            const diffPct = (b && sa.score && sb.score) ? ((sb.score - sa.score) / sa.score * 100) : null;
            panel.innerHTML = `
                <div class="p-4 bg-zinc-900/90 rounded-lg border border-div-accent/40">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="text-sm font-bold text-div-accent uppercase">⚖️ Schnellvergleich</h3>
                        <button onclick="compareWeaponIds = []; renderWeaponsInventory();" class="text-xs text-gray-500 hover:text-white underline">zurücksetzen</button>
                    </div>
                    <div class="grid grid-cols-[auto_1fr_1fr] gap-x-4 text-xs">
                        <div class="py-1"></div>
                        <div class="py-1 font-bold text-white">${escapeHtml(a.name)}</div>
                        <div class="py-1 font-bold ${b ? 'text-white' : 'text-gray-600'}">${b ? escapeHtml(b.name) : '— zweite Waffe wählen —'}</div>
                        ${rows}
                    </div>
                    ${diffPct !== null ? `
                        <p class="mt-2 text-xs ${diffPct >= 0 ? 'text-emerald-400' : 'text-red-400'}">
                            ${escapeHtml(b.name)} ${diffPct >= 0 ? 'macht' : 'liegt'} ${formatGermanNumber(Math.abs(diffPct))}% ${diffPct >= 0 ? 'mehr' : 'weniger'} im Score als ${escapeHtml(a.name)}.
                        </p>` : ''}
                    <p class="mt-1 text-[10px] text-gray-500">Grün = besser, Rot = schlechter (jeweils aus Sicht der rechten Waffe · Score enthält Feuerrate &amp; Magazin/Nachladezeit, Komfort nicht).</p>
                </div>`;
        }


        // Farbiges Prognose-Badge: Vergleich mit der besten Waffe derselben
        // Gattung im Inventar. Gibt es nur eine Waffe der Gattung, entfaellt
        // der Vergleich (kein Badge).
        function gearsetPrognosisBadge(weapon) {
            if (!weapon) return '';
            const competitors = (weaponsInventory || []).filter(w => w.type === weapon.type);
            if (competitors.length < 2) return '';
            let best = null;
            competitors.forEach(w => {
                const s = weaponGearsetScore(w);
                if (s && (!best || s.score > best.score)) best = { name: w.name, score: s.score, w: w };
            });
            const my = weaponGearsetScore(weapon);
            if (!my || !best) return '';
            if (my.score >= best.score) {
                return `<div class="text-[10px] text-emerald-400 mt-0.5" title="Gearset-Prognose: stärkste ${weaponTypeLabel(weapon.type)} im Inventar (Score ${formatGermanNumber(my.score)}). ${my.talentNote}">★ Gearset-Empfehlung (beste ${weaponTypeLabel(weapon.type)})</div>`;
            }
            const pct = (1 - my.score / best.score) * 100;
            const parts = [];
            if (my.wd) parts.push(`WD ${formatGermanNumber(my.wd)}%`);
            if (my.dttooc) parts.push(`DTToOC ${formatGermanNumber(my.dttooc)}%`);
            if (my.dta) parts.push(`DTA ${formatGermanNumber(my.dta)}%`);
            if (my.dth) parts.push(`DTH ${formatGermanNumber(my.dth)}%`);
            if (my.chc || my.chd) parts.push(`CHC/CHD ${formatGermanNumber(my.chc)}/${formatGermanNumber(my.chd)}%`);
            const detail = parts.join(' · ') + (my.talentNote ? ' | ' + my.talentNote : '');
            if (pct < 10) {
                return `<div class="text-[10px] text-amber-400 mt-0.5" title="Gearset-Prognose: ${formatGermanNumber(pct)}% unter ${best.name}. ${detail}">◐ Brauchbar, aber ${best.name} ist stärker (−${formatGermanNumber(pct)}%)</div>`;
            }
            return `<div class="text-[10px] text-red-400 mt-0.5" title="Gearset-Prognose: ${formatGermanNumber(pct)}% unter ${best.name}. ${detail}">✕ Für Gearsets schwach – ${best.name} macht ${formatGermanNumber(pct)}% mehr</div>`;
        }

        // Strukturierte Empfehlungs-Daten für die sortier-/filterbare Spalte
        // "Empfehlung" im Waffen-Inventar. Nutzt dieselbe Score-Basis wie
        // gearsetPrognosisBadge(), liefert aber Tier/Score/Detailtext statt HTML.
        function gearsetRecommendation(weapon) {
            const my = weaponGearsetScore(weapon);
            if (!my) {
                return { tier: 'none', label: '—', score: 0, detail: '', colorClass: 'text-gray-500' };
            }
            const competitors = (weaponsInventory || []).filter(w => w.type === weapon.type);
            if (competitors.length < 2) {
                return { tier: 'unique', label: '— einzige', score: my.score, detail: `Einzige ${weaponTypeLabel(weapon.type)} im Inventar – kein Vergleich möglich. ${my.talentNote}`, colorClass: 'text-gray-500' };
            }
            let best = null;
            competitors.forEach(w => {
                const s = weaponGearsetScore(w);
                if (s && (!best || s.score > best.score)) best = { name: w.name, score: s.score };
            });
            if (!best) {
                return { tier: 'none', label: '—', score: my.score, detail: '', colorClass: 'text-gray-500' };
            }
            if (my.score >= best.score) {
                return {
                    tier: 'top', label: '★ Top', score: my.score,
                    detail: `Stärkste ${weaponTypeLabel(weapon.type)} im Inventar (Score ${formatGermanNumber(my.score)}). ${my.talentNote}`,
                    colorClass: 'text-emerald-400'
                };
            }
            const pct = (1 - my.score / best.score) * 100;
            const parts = [];
            if (my.wd) parts.push(`WD ${formatGermanNumber(my.wd)}%`);
            if (my.dttooc) parts.push(`DTToOC ${formatGermanNumber(my.dttooc)}%`);
            if (my.dta) parts.push(`DTA ${formatGermanNumber(my.dta)}%`);
            if (my.dth) parts.push(`DTH ${formatGermanNumber(my.dth)}%`);
            if (my.chc || my.chd) parts.push(`CHC/CHD ${formatGermanNumber(my.chc)}/${formatGermanNumber(my.chd)}%`);
            const detail = `${formatGermanNumber(pct)}% unter ${best.name}. ` + parts.join(' · ') + (my.talentNote ? ' | ' + my.talentNote : '');
            if (pct < 10) {
                return { tier: 'ok', label: `◐ −${formatGermanNumber(pct)}%`, score: my.score, detail: detail, colorClass: 'text-amber-400' };
            }
            return { tier: 'weak', label: `✕ −${formatGermanNumber(pct)}%`, score: my.score, detail: detail, colorClass: 'text-red-400' };
        }

        // Popover-Steuerung für die Spalten-Info-Buttons (aktuell: Empfehlung).
        // Popover wird als position:fixed direkt im Viewport platziert (Koordinaten
        // relativ zum auslösenden Button), damit es NICHT vom overflow-x-auto/
        // max-h-Container der Tabelle abgeschnitten wird. btn ist optional
        // (z.B. beim "schließen"-Button innerhalb des Popovers nicht nötig).
        function toggleInfoPopover(id, btn) {
            const popover = document.getElementById(id);
            if (!popover) return;
            const wasHidden = popover.classList.contains('hidden');
            document.querySelectorAll('[id$="InfoPopover"]').forEach(el => {
                if (el.id !== id) el.classList.add('hidden');
            });
            if (!wasHidden) {
                popover.classList.add('hidden');
                return;
            }
            popover.classList.remove('hidden');
            if (btn) positionInfoPopover(popover, btn);
        }

        function positionInfoPopover(popover, btn) {
            const margin = 8;
            const rect = btn.getBoundingClientRect();
            const popW = popover.offsetWidth || 288;
            const popH = popover.offsetHeight || 160;

            let left = rect.left;
            if (left + popW > window.innerWidth - margin) {
                left = window.innerWidth - popW - margin;
            }
            if (left < margin) left = margin;

            let top = rect.bottom + 6;
            if (top + popH > window.innerHeight - margin) {
                top = rect.top - popH - 6;
            }
            if (top < margin) top = margin;

            popover.style.left = left + 'px';
            popover.style.top = top + 'px';
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.info-btn')) {
                document.querySelectorAll('[id$="InfoPopover"]').forEach(el => el.classList.add('hidden'));
            }
        });
        // Popover schließen, sobald irgendein Scroll-Container scrollt (z.B. die
        // Waffentabelle selbst) – sonst würde die fixed-Position vom Anker abdriften.
        document.addEventListener('scroll', () => {
            document.querySelectorAll('[id$="InfoPopover"]:not(.hidden)').forEach(el => el.classList.add('hidden'));
        }, true);

        // XSS-Schutz: Nutzereingaben (z.B. Waffennamen mit " oder <) dürfen nie
        // ungefiltert via innerHTML eingesetzt werden.
        function escapeHtml(str) {
            return String(str === null || str === undefined ? '' : str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function renderWeaponsInventory() {
            if (typeof updateForceExoticOptions === 'function') updateForceExoticOptions();
            const typeFilter = document.getElementById('weaponTypeFilter').value;
            const attrFilterEl = document.getElementById('weaponAttrFilter');
            const attrFilter = attrFilterEl ? attrFilterEl.value : '';
            // Waffen-Dropdown (Auswahl vorhandener Waffen) aktuell halten
            const nameFilterEl = document.getElementById('weaponNameFilter');
            if (nameFilterEl && nameFilterEl.tagName === 'SELECT') {
                const prevSel = nameFilterEl.value;
                const names = [...new Set(weaponsInventory.map(w => w.name))].sort((a, b) => a.localeCompare(b, 'de'));
                nameFilterEl.innerHTML = '<option value="">Alle Waffen</option>' +
                    names.map(n => `<option value="${n.replace(/"/g, '&quot;')}">${n}</option>`).join('');
                if (prevSel && names.includes(prevSel)) nameFilterEl.value = prevSel;
            }
            const nameFilter = nameFilterEl ? (nameFilterEl.value || '').trim().toLowerCase() : '';
            let filteredWeapons = typeFilter ? weaponsInventory.filter(w => w.type === typeFilter) : [...weaponsInventory];
            if (nameFilter) {
                filteredWeapons = filteredWeapons.filter(w => (w.name || '').toLowerCase().includes(nameFilter));
            }
            // Attribut-Filter: Waffe passt, wenn Kern 2 ODER Attribut 3 den Typ trägt
            if (attrFilter) {
                filteredWeapons = filteredWeapons.filter(w => w.core2Type === attrFilter || w.minorType === attrFilter);
            }
            // Empfehlungs-Filter (★ Top / ◐ brauchbar / ✕ schwach / — einzige)
            const recoFilterEl = document.getElementById('weaponRecoFilter');
            const recoFilter = recoFilterEl ? recoFilterEl.value : '';
            if (recoFilter) {
                filteredWeapons = filteredWeapons.filter(w => gearsetRecommendation(w).tier === recoFilter);
            }

            // Sortieren
            filteredWeapons.sort((a, b) => {
                if (currentWeaponSortField === 'name') {
                    return currentWeaponSortAsc
                        ? a.name.localeCompare(b.name, 'de')
                        : b.name.localeCompare(a.name, 'de');
                } else if (currentWeaponSortField === 'baseDmg') {
                    return currentWeaponSortAsc ? a.baseDmg - b.baseDmg : b.baseDmg - a.baseDmg;
                } else if (currentWeaponSortField === 'core1') {
                    return currentWeaponSortAsc ? a.core1 - b.core1 : b.core1 - a.core1;
                } else if (currentWeaponSortField === 'core2Val') {
                    return currentWeaponSortAsc ? a.core2Val - b.core2Val : b.core2Val - a.core2Val;
                } else if (currentWeaponSortField === 'minorVal') {
                    return currentWeaponSortAsc ? a.minorVal - b.minorVal : b.minorVal - a.minorVal;
                } else if (currentWeaponSortField === 'type') {
                    return currentWeaponSortAsc
                        ? a.type.localeCompare(b.type, 'de')
                        : b.type.localeCompare(a.type, 'de');
                } else if (currentWeaponSortField === 'recommendation') {
                    const scoreA = (weaponGearsetScore(a) || {}).score || 0;
                    const scoreB = (weaponGearsetScore(b) || {}).score || 0;
                    return currentWeaponSortAsc ? scoreA - scoreB : scoreB - scoreA;
                }
                return 0;
            });

            const tbody = document.getElementById('weaponsTableBody');
            tbody.innerHTML = filteredWeapons.map(w => {
                const reco = weaponGearsetScore(w);
                const recoTier = gearsetRecommendation(w);
                return `
                    <tr class="hover:bg-zinc-800/50">
                        <td class="p-3 font-medium text-white">${escapeHtml(w.name)}${rarityBadge(w.isExotic, weaponIsNamed(w))}${w.isPrototype ? protoBadge() : ''}${familyDamageBadge(w.name, w.type)}${rollDominanceBadge(w)}${(!w.isExotic && w.autoMods) ? ' <span class="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-sky-950/80 border border-sky-500/40 text-sky-300 font-normal" title="Mod-Belegung wird automatisch optimiert (beste Mods aus dem Katalog)">🔧 Auto-Mods</span>' : ''}</td>
                        <td class="p-3 text-gray-300">${weaponTypeLabel(w.type)}</td>
                        <td class="p-3 font-mono text-white">${formatGermanNumber(w.baseDmg)}</td>
                        <td class="p-3 font-mono text-gray-300">${formatGermanNumber(w.core1)}% WD</td>
                        <td class="p-3 font-mono text-gray-300">${formatGermanNumber(w.core2Val)}% ${w.core2Type ? w.core2Type.toUpperCase() : ''}</td>
                        <td class="p-3 font-mono text-gray-300">${formatGermanNumber(w.minorVal)}% ${w.minorType ? w.minorType.toUpperCase() : ''}</td>
                        <td class="p-3 text-xs ${w.isExotic ? 'text-orange-400' : 'text-gray-300'}">
                            ${getTalentLabel(w.talent)}
                        </td>
                        <td class="p-3 text-xs" title="${escapeHtml(recoTier.detail)}">
                            <span class="${recoTier.colorClass} font-bold">${recoTier.label}</span>
                            <div class="text-[10px] text-gray-500 font-mono">${formatGermanNumber(recoTier.score)}</div>
                            ${reco && reco.rpm ? `<div class="text-[10px] text-gray-500 font-mono" title="Effektive Feuerrate inkl. RoF-Boni aus Mods/Talent: ${formatGermanNumber(Math.round(reco.rpm))} RPM · Sustain-Faktor (Magazin/Nachladezeit): ${reco.sustain ? formatGermanNumber(Math.round(reco.sustain * 100)) + '%' : 'n/a'}">${formatGermanNumber(Math.round(reco.rpm))} RPM${reco.sustain ? ' · ' + formatGermanNumber(Math.round(reco.sustain * 100)) + '% SF' : ''}</div>` : ''}
                            ${reco && reco.dps ? `<div class="text-[10px] text-div-accent font-mono" title="Geschätzter Schaden pro Sekunde (Score × eff. Feuerrate/60). Nur innerhalb derselben Gattung vergleichbar.">~${formatGermanNumber(Math.round(reco.dps))} DPS</div>` : ''}
                        </td>
                        <td class="p-3 text-right">
                            <div class="flex items-center justify-end gap-1">
                                <button onclick="toggleCompareWeapon(${w.id})" class="p-1 ${compareWeaponIds.includes(w.id) ? 'text-div-accent' : 'text-gray-500 hover:text-div-accent'}" title="Zum Schnellvergleich hinzufügen / entfernen (max. 2 Waffen)">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"></path>
                                    </svg>
                                </button>
                                <button onclick="startEditWeapon(${w.id})" class="text-sky-400 hover:text-sky-300 p-1" title="Bearbeiten">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5h2m-2 0v14H5V5h6zm10 0v14h-7V5h7z"></path>
                                    </svg>
                                </button>
                                <button onclick="deleteWeapon(${w.id})" class="text-red-400 hover:text-red-300 p-1" title="Entfernen">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                    </svg>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            if (filteredWeapons.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-gray-400">Keine Waffen gefunden.</td></tr>`;
            }
            // Schnellvergleich-Panel (Diff-Ansicht) aktualisieren
            renderWeaponComparePanel();
            // Sortier-Pfeile in den Tabellenköpfen aktualisieren
            updateWeaponSortHeaderIcons();
        }

        function exportWeaponsCSV() {
            if (weaponsInventory.length === 0) {
                showToast('Keine Waffen zum Exportieren vorhanden.', 'error');
                return;
            }
            let csv = "Name;Typ;Basis-Schaden;Kern1;Kern2Typ;Kern2Wert;NebenTyp;NebenWert;VisierTyp;VisierWert;MündungTyp;MündungWert;UnterlaufTyp;UnterlaufWert;MagazinTyp;MagazinWert;Talent;Exotisch;Prototyp\n";
            weaponsInventory.forEach(w => {
                // Zahlen im deutschen Format (Komma = Dezimal, Punkt = Tausender),
                // sonst liest parseLocalizedFloat beim Import "22.5" als 225.
                csv += `${w.name};${w.type};${formatGermanNumber(w.baseDmg)};${formatGermanNumber(w.core1)};${w.core2Type};${formatGermanNumber(w.core2Val)};${w.minorType};${formatGermanNumber(w.minorVal)};`;
                csv += `${w.mods.optic.type};${formatGermanNumber(w.mods.optic.val)};${w.mods.muzzle.type};${formatGermanNumber(w.mods.muzzle.val)};`;
                csv += `${w.mods.underbarrel.type};${formatGermanNumber(w.mods.underbarrel.val)};${w.mods.magazine.type};${formatGermanNumber(w.mods.magazine.val)};`;
                csv += `${w.talent};${w.isExotic};${!!w.isPrototype}\n`;
            });

            const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `div2_weapons_${new Date().toISOString().slice(0,10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Waffen-Inventar exportiert!', 'success');
        }

        function importWeaponsCSV(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                const text = e.target.result;
                const lines = text.split(/\r\n|\n/);
                let importedCount = 0;
                let errorCount = 0;

                lines.forEach((line, index) => {
                    if (index === 0 || !line.trim()) return;
                    const parts = line.split(';');
                    if (parts.length >= 17) {
                      try {
                        const weapon = {
                            id: weaponIdCounter++,
                            name: parts[0].trim(),
                            type: parts[1].trim(),
                            baseDmg: parseLocalizedFloat(parts[2]),
                            core1: parseLocalizedFloat(parts[3]),
                            core2Type: parts[4].trim(),
                            core2Val: parseLocalizedFloat(parts[5]),
                            minorType: parts[6].trim(),
                            minorVal: parseLocalizedFloat(parts[7]),
                            mods: {
                                optic: { type: parts[8].trim(), val: parseLocalizedFloat(parts[9]) },
                                muzzle: { type: parts[10].trim(), val: parseLocalizedFloat(parts[11]) },
                                underbarrel: { type: parts[12].trim(), val: parseLocalizedFloat(parts[13]) },
                                magazine: { type: parts[14].trim(), val: parseLocalizedFloat(parts[15]) }
                            },
                            talent: parts[16].trim(),
                            // CSV-Import-Fix: Export schreibt 19 Spalten, ältere/externe
                            // CSVs können aber nur 17–18 Felder haben. Optionale Spalten
                            // (Exotisch / Prototyp) sicher lesen, statt bei undefined
                            // mit einem TypeError den GESAMTEN Import still abbrechen zu lassen.
                            isExotic: (parts[17] !== undefined ? parts[17].trim() : '') === 'true',
                            // Spalte 19 "Prototyp" – alte CSVs ohne die Spalte: false.
                            // EXOTEN: immer false – die drei Waffenattribute sind fix
                            // und dürfen nie um +50% erhöht werden (nur Mods sind besonders).
                            isPrototype: (parts.length > 18 ? parts[18].trim() === 'true' : false) && (parts[17] !== undefined ? parts[17].trim() : '') !== 'true'
                        };
                        weaponsInventory.push(weapon);
                        importedCount++;
                      } catch (rowErr) {
                        console.warn('CSV-Zeile ' + (index + 1) + ' übersprungen:', rowErr);
                        errorCount++;
                      }
                    } else {
                        console.warn('CSV-Zeile ' + (index + 1) + ' übersprungen (zu wenige Spalten).');
                        errorCount++;
                    }
                });

                saveToLocalStorage();
                renderWeaponsInventory();
                updateTabUI();
                markComparisonStale();
                if (errorCount > 0) {
                    showToast(`${importedCount} Waffen importiert, ${errorCount} Zeilen übersprungen!`, 'info');
                } else {
                    showToast(`${importedCount} Waffen importiert!`, 'success');
                }
                event.target.value = '';
            };
            reader.readAsText(file, 'UTF-8');
        }

        function loadDefaultWeapons() {
            // Bugfix: Laufende Bearbeitung abbrechen – das bearbeitete Ziel wird
            // gleich aus dem Inventar entfernt, sonst zeigt das Formular auf
            // eine Waffe, die es nicht mehr gibt.
            if (typeof editWeaponId !== 'undefined' && editWeaponId !== null) {
                editWeaponId = null;
                setEditUi(false);
            }
            weaponsInventory = [
                {
                    id: 1,
                    name: "St. Elmo's Engine",
                    type: "AR",
                    baseDmg: lookupWeaponBaseDmg("St. Elmo's Engine") || 93000,
                    core1: 15,
                    core2Type: "chc",
                    core2Val: 20,
                    minorType: "dttooc",
                    minorVal: 10,
                    mods: {
                        optic: { type: "chc", val: 10 },
                        muzzle: { type: "chd", val: 10 },
                        underbarrel: { type: "chd", val: 10 },
                        magazine: { type: "wd", val: 10 }
                    },
                    talent: "unhinged",
                    isExotic: true
                },
                {
                    id: 2,
                    name: "Chameleon",
                    type: "AR",
                    baseDmg: lookupWeaponBaseDmg("Chameleon") || 85000,
                    core1: 15,
                    core2Type: "chc",
                    core2Val: 20,
                    minorType: "chd",
                    minorVal: 30,
                    mods: {
                        optic: { type: "chc", val: 10 },
                        muzzle: { type: "chd", val: 10 },
                        underbarrel: { type: "chd", val: 10 },
                        magazine: { type: "wd", val: 10 }
                    },
                    talent: "killer",
                    isExotic: true
                },
                {
                    id: 3,
                    name: "Eagle Bearer",
                    type: "AR",
                    baseDmg: lookupWeaponBaseDmg("Eagle Bearer") || 88000,
                    core1: 15,
                    core2Type: "dth",
                    core2Val: 21,
                    minorType: "dttooc",
                    minorVal: 10,
                    mods: {
                        optic: { type: "chc", val: 10 },
                        muzzle: { type: "chd", val: 10 },
                        underbarrel: { type: "dta", val: 10 },
                        magazine: { type: "wd", val: 10 }
                    },
                    talent: "optimist",
                    isExotic: true
                },
                {
                    id: 4,
                    name: "Police M4",
                    type: "AR",
                    baseDmg: lookupWeaponBaseDmg("Police M4") || 92000,
                    core1: 15,
                    core2Type: "dth",
                    core2Val: 21,
                    minorType: "dttooc",
                    minorVal: 10,
                    mods: {
                        optic: { type: "chc", val: 10 },
                        muzzle: { type: "chd", val: 10 },
                        underbarrel: { type: "chd", val: 10 },
                        magazine: { type: "wd", val: 10 }
                    },
                    talent: "strained",
                    isExotic: false
                },
                {
                    id: 5,
                    name: "The Bighorn",
                    type: "AR",
                    baseDmg: lookupWeaponBaseDmg("The Bighorn") || 110000,
                    core1: 15,
                    core2Type: "hsd",
                    core2Val: 15,
                    minorType: "dttooc",
                    minorVal: 10,
                    mods: {
                        optic: { type: "chc", val: 10 },
                        muzzle: { type: "chd", val: 10 },
                        underbarrel: { type: "chd", val: 10 },
                        magazine: { type: "wd", val: 10 }
                    },
                    talent: "closepersonal",
                    isExotic: true
                }
            ];
            weaponIdCounter = 6;
            saveToLocalStorage();
            renderWeaponsInventory();
            updateTabUI();
            markComparisonStale();
            showToast('Standard-Waffen geladen!', 'success');
        }

        // ========== AUSRÜSTUNGS-INVENTAR ==========
        // ========== BEARBEITUNGSMODUS AUSRÜSTUNGS-INVENTAR ==========
        // editGearId !== null -> das Formular bearbeitet dieses Teil,
        // addGearItem() aktualisiert dann statt neu anzulegen.
        let editGearId = null;

        function setGearEditUi(active, itemLabel) {
            const label = document.getElementById('gearSubmitLabel');
            const cancelBtn = document.getElementById('cancelEditGearBtn');
            if (label) label.textContent = active
                ? `💾 „${itemLabel || 'Teil'}“ aktualisieren`
                : '🎒 Teil zum Inventar hinzufügen';
            if (cancelBtn) cancelBtn.classList.toggle('hidden', !active);
        }

        function cancelEditGearItem() {
            editGearId = null;
            setGearEditUi(false);
            document.getElementById('gearForm').reset();
            const talentSel = document.getElementById('gearTalent');
            if (talentSel) delete talentSel.dataset.restore;
            applyGearSlotFilter();
            onGearSetSelectionChange();
            updateGearAttrHints();
        }

        function startEditGearItem(id) {
            const item = gearInventory.find(i => i.id === id);
            if (!item) return;

            document.getElementById('gearSlot').value = item.slot;
            applyGearSlotFilter();
            document.getElementById('gearSetName').value = item.setName;
            onGearSetSelectionChange();
            // v35: Kernattribut des Teils wiederherstellen
            const coreSelEdit = document.getElementById('gearCoreType');
            const coreTypeEdit = gearCoreTypeOf(item);
            if (coreSelEdit) {
                coreSelEdit.disabled = isExoticGearName(item.setName);
                coreSelEdit.value = coreTypeEdit;
            }
            const wdElEdit = document.getElementById('gearWd');
            wdElEdit.disabled = (coreTypeEdit === 'skill');
            wdElEdit.value = formatGermanNumber(coreTypeEdit === 'wd'
                ? (item.wd || 0)
                : (item.coreVal != null ? item.coreVal : gearCoreDefaultVal(coreTypeEdit, !!item.proto)));
            document.getElementById('gearIsPrototype').checked = !!item.proto;
            const dbEdit = GEAR_DB[item.setName];
            const fixedOrder = dbEdit ? (dbEdit.fixed || []).map(x => x[0]) : [];
            const editAttrs = gearItemAttrs(item).slice().sort((x, y) => {
                const ix = fixedOrder.indexOf(x.type), iy = fixedOrder.indexOf(y.type);
                return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy);
            });
            [1, 2].forEach(n => {
                const a = editAttrs[n - 1];
                document.getElementById('gearAttr' + n + 'Type').value = a ? a.type : '';
                document.getElementById('gearAttr' + n + 'Val').value = a ? formatGermanNumber(a.val) : '0';
            });
            // Legacy: grünes Teil mit 2 gespeicherten Attributen -> Attribut 2 sichtbar lassen
            if (editAttrs.length > 1) document.getElementById('gearAttr2Wrap').classList.remove('hidden');
            updateGearAttrHints();
            if (item.namedKey && NAMED_ITEM_CONFIGS[item.setName]) {
                document.getElementById('namedAttrVal').value = formatGermanNumber(item.namedVal);
            }
            // Talent wiederherstellen (updateGearTalentUi läuft in onGearSetSelectionChange)
            const talentSel = document.getElementById('gearTalent');
            if (talentSel && item.talent) talentSel.dataset.restore = item.talent;

            editGearId = id;
            setGearEditUi(true, `${item.setName} (${item.slot})`);
            document.getElementById('gearSlot').scrollIntoView({ behavior: 'smooth', block: 'center' });
            showToast(`✏️ „${item.setName} (${item.slot})“ wird bearbeitet – Änderungen speichern zum Aktualisieren.`, 'info');
        }

        // ========== DB-VALIDIERUNG: fixe Werte bei Named/Exotic-Teilen ==========
        // Prüft beim Speichern, ob Core & Attribute zur GEAR_DB passen:
        // - fixe Minors müssen mit Typ UND Wert exakt übereinstimmen
        // - Anzahl freier Minors darf nicht überschritten werden
        // - Core-Typ muss stimmen (WD nur wenn 'wd', Range 1,5–15%)
        // Liefert Array von Fehlermeldungen (leer = OK).
        function validateGearAgainstDb(setName, wd, attrs, proto) {
            const e = GEAR_DB[setName];
            if (!e) return []; // normale Marken/grüne Sets: keine DB-Prüfung
            const errs = [];
            const fixed = e.fixed || [];
            // Prototyp (nur Named): alle Maximalwerte x1,5
            const f = (proto && e.proto) ? GEAR_PROTO_FACTOR : 1;
            const wdMax = GEAR_CORE_WD_MAX * f;
            const wdInRange = wd >= 1.5 - 1e-9 && wd <= wdMax + 1e-9;
            const wdRangeMsg = `Kern: Waffenschaden muss zwischen 1,5% und ${formatGermanNumber(wdMax)}% liegen (Wert: ${formatGermanNumber(wd)}%)`;

            if (e.core === 'wd') {
                if (!wdInRange) errs.push(wdRangeMsg);
            } else if (e.core === 'any') {
                // frei wählbarer Kern (z.B. Investor): 0 = anderer Kern, sonst WD-Bereich
                if (wd > 1e-9 && !wdInRange) errs.push(wdRangeMsg);
            } else if (wd > 1e-9) {
                errs.push(`Dieses Teil hat keinen Waffenschaden-Kern (Core: ${gearCoreLabel(e.core)}) – WD-Wert ${formatGermanNumber(wd)}% bitte auf 0 setzen`);
            }

            // Fixe Minors: Typ verpflichtend, Wert frei rollbar bis DB-Maximum (bei Prototyp x1,5)
            fixed.forEach(([t, v]) => {
                const a = attrs.find(x => x.type === t);
                const unit = gearAttrUnit(t);
                const label = GEAR_ATTR_TYPES[t] ? GEAR_ATTR_TYPES[t].label : t;
                const mx = v * f;
                if (!a) {
                    errs.push(`Fehlendes Attribut: ${label} (erwartet bis ${formatGermanNumber(mx)}${unit})`);
                } else if (a.val > mx + 0.01) {
                    errs.push(`${label} max. ${formatGermanNumber(mx)}${unit}${f > 1 ? ' (Prototyp)' : ''} (erfasst: ${formatGermanNumber(a.val)}${unit})`);
                }
            });

            const freeAttrs = attrs.filter(a => !fixed.some(([t]) => t === a.type));
            if (freeAttrs.length > e.free) {
                errs.push(`Dieses Teil erlaubt nur ${e.free} frei rollbare Attribute (erfasst: ${freeAttrs.length})`);
            }
            if (e.cls === 'exotic' && freeAttrs.length > 0 && e.free === 0) {
                errs.push('Exotische Teile haben keine frei rollbaren Attribute');
            }
            return errs;
        }

        function addGearItem() {
            const slot = document.getElementById('gearSlot').value;
            const setName = document.getElementById('gearSetName').value;
            // Sicherheitsnetz: Exotisches Gear hat nie Prototyp-Status
            const proto = !isExoticGearName(setName) && document.getElementById('gearIsPrototype').checked;
            // v35: Kernattribut-Typ (WD / Rüstung / Skill-Tier), Wert = Kernwert
            const coreSelEl = document.getElementById('gearCoreType');
            const coreType = (coreSelEl && coreSelEl.value)
                ? coreSelEl.value
                : ((GEAR_DB[setName] && GEAR_DB[setName].core && GEAR_DB[setName].core !== 'any') ? GEAR_DB[setName].core : 'wd');
            let coreVal = parseLocalizedFloat(document.getElementById('gearWd').value) || 0;
            if (coreType === 'skill') coreVal = proto ? 1.5 : 1;
            const wd = coreType === 'wd' ? coreVal : 0;
            const attrs = readGearFormAttrs();
            if (attrs.length === 2 && attrs[0].type === attrs[1].type) {
                showToast('❌ Attribut 1 und Attribut 2 dürfen nicht identisch sein.', 'error');
                return;
            }
            const chc = attrs.filter(a => a.type === 'chc').reduce((sum, a) => sum + a.val, 0);
            const chd = attrs.filter(a => a.type === 'chd').reduce((sum, a) => sum + a.val, 0);
            // Nicht blockierend: Warnung, wenn ein Wert über dem bekannten Maximum liegt
            const overMax = [];
            attrs.forEach(a => {
                const mx = gearAttrMax(a.type, proto);
                if (mx !== null && a.val > mx + 1e-9) overMax.push(`${GEAR_ATTR_TYPES[a.type].label} ${formatGermanNumber(a.val)}${gearAttrUnit(a.type)} > ${formatGermanNumber(mx)}${gearAttrUnit(a.type)}`);
            });
            if (coreType === 'wd' && wd > gearCoreWdMax(proto) + 1e-9) overMax.push(`Waffenschaden ${formatGermanNumber(wd)}% > ${formatGermanNumber(gearCoreWdMax(proto))}%`);
            if (coreType === 'armour' && coreVal > (proto ? GEAR_CORE_ARMOUR_PROTO : GEAR_CORE_ARMOUR_STD) + 1e-9) overMax.push(`Rüstung ${formatGermanNumber(coreVal)} > ${formatGermanNumber(proto ? GEAR_CORE_ARMOUR_PROTO : GEAR_CORE_ARMOUR_STD)}`);
            if (overMax.length) showToast('⚠️ Über dem Maximalwert: ' + overMax.join(' · '), 'info');

            // Validierung: Named/Exotic-Teile sind nur im passenden Slot erlaubt
            const requiredSlot = getNamedItemSlot(setName);
            if (requiredSlot && requiredSlot !== slot) {
                showToast(`❌ „${setName}“ gibt es nur im Slot „${requiredSlot}“ – nicht im Slot „${slot}“.`, 'error');
                return;
            }

            // DB-Validierung VOR dem Speichern (Neuanlegen & Bearbeiten):
            // Abweichungen von fixen Named/Exotic-Werten blockieren
            const dbErrs = validateGearAgainstDb(setName, wd, attrs, proto);
            if (dbErrs.length) {
                showToast('❌ Werte passen nicht zur Datenbank: ' + dbErrs.join(' · '), 'error');
                return;
            }

            let namedKey = '';
            let namedVal = 0;

            if (NAMED_ITEM_CONFIGS[setName]) {
                namedKey = NAMED_ITEM_CONFIGS[setName].attrKey;
                namedVal = parseLocalizedFloat(document.getElementById('namedAttrVal').value);
            }

            // Talent: nur bei High-End Weste/Rucksack erfassbar (Dropdown ist sonst hidden)
            const talentWrap = document.getElementById('gearTalentWrap');
            const talent = (talentWrap && !talentWrap.classList.contains('hidden'))
                ? (document.getElementById('gearTalent').value || '') : '';

            if (editGearId !== null) {
                // Bearbeitungsmodus: vorhandenes Teil aktualisieren (ID bleibt)
                const idx = gearInventory.findIndex(i => i.id === editGearId);
                const updatedItem = {
                    id: editGearId,
                    slot: slot,
                    setName: setName,
                    chc: chc,
                    chd: chd,
                    wd: wd,
                    coreType: coreType,
                    coreVal: coreType === 'wd' ? wd : coreVal,
                    namedKey: namedKey,
                    namedVal: namedVal,
                    attrs: attrs,
                    proto: proto,
                    talent: talent
                };
                if (idx >= 0) {
                    gearInventory[idx] = updatedItem;
                } else {
                    gearInventory.push(updatedItem);
                }
                editGearId = null;
                setGearEditUi(false);
                saveToLocalStorage();
                renderGearInventory();
                updateTabUI();
                markComparisonStale();
                showToast(`💾 "${setName} (${slot})" aktualisiert!`, 'success');
                return;
            }

            const newItem = {
                id: gearIdCounter++,
                slot: slot,
                setName: setName,
                chc: chc,
                chd: chd,
                wd: wd,
                coreType: coreType,
                coreVal: coreType === 'wd' ? wd : coreVal,
                namedKey: namedKey,
                namedVal: namedVal,
                attrs: attrs,
                proto: proto,
                talent: talent
            };

            gearInventory.push(newItem);
            saveToLocalStorage();
            renderGearInventory();
            updateTabUI();
            markComparisonStale();
            showToast(`${setName} (${slot}) wurde hinzugefügt.`, 'success');
        }

        function deleteGearItem(id) {
            gearInventory = gearInventory.filter(i => i.id !== id);
            if (editGearId === id) { editGearId = null; setGearEditUi(false); }
            saveToLocalStorage();
            renderGearInventory();
            updateTabUI();
            markComparisonStale();
            showToast('Ausrüstungsgegenstand entfernt.', 'info');
        }

        // ========== GEAR-ATTRIBUTE (Typ-Auswahl + Prototyp) ==========
        // max = High-End-Maximum eines Minor-Attributs; Prototyp = max × 1,5.
        // max: null = Wert noch nicht hinterlegt (dann keine Max-Prüfung).
        const GEAR_ATTR_TYPES = {
            chc:         { label: 'Kritische Trefferchance',   group: 'Offensiv (Rot)',      max: 6 },
            chd:         { label: 'Kritischer Trefferschaden', group: 'Offensiv (Rot)',      max: 12 },
            hsd:         { label: 'Kopfschussschaden',         group: 'Offensiv (Rot)',      max: 11 },
            wh:          { label: 'Waffenhandhabung',          group: 'Offensiv (Rot)',      max: 8 },
            armorregen:  { label: 'Rüstungsregeneration',      group: 'Defensiv (Blau)',     max: 4925 },
            explres:     { label: 'Explosionswiderstand',      group: 'Defensiv (Blau)',     max: 10 },
            hazard:      { label: 'Gefahrenschutz',            group: 'Defensiv (Blau)',     max: 10 },
            health:      { label: 'Lebenspunkte',              group: 'Defensiv (Blau)',     max: 18935 },
            skilldmg:    { label: 'Fertigkeitenschaden',       group: 'Hilfsmittel (Gelb)',  max: 10 },
            skillhaste:  { label: 'Fertigkeiten-Tempo',        group: 'Hilfsmittel (Gelb)',  max: 12 },
            repair:      { label: 'Reparatur-Fertigkeiten',    group: 'Hilfsmittel (Gelb)',  max: 20 },
            status:      { label: 'Statuseffekte',             group: 'Hilfsmittel (Gelb)',  max: 10 },
            // Erweiterte Typen aus der Named/Exotic-Datenbank
            wd:          { label: 'Waffenschaden (Minor)',     group: 'Offensiv (Rot)',      max: 15 },
            dta:         { label: 'Rüstungsschaden',           group: 'Offensiv (Rot)',      max: 8 },
            dttooc:      { label: 'Schaden gg. ungedeckte Ziele', group: 'Offensiv (Rot)', max: 8 },
            dth:         { label: 'Lebenspunktschaden',        group: 'Offensiv (Rot)',      max: 10 },
            rof:         { label: 'Feuerrate',                  group: 'Offensiv (Rot)',      max: 5 },
            accuracy:    { label: 'Genauigkeit',               group: 'Offensiv (Rot)',      max: null },
            range:       { label: 'Optimale Reichweite',      group: 'Offensiv (Rot)',      max: null },
            aok:         { label: 'Rüstung bei Tötung',        group: 'Defensiv (Blau)',     max: 10 },
            incomrepair: { label: 'Erhaltene Reparatur',       group: 'Defensiv (Blau)',     max: 20 },
            ammocap:     { label: 'Munitionskapazität',        group: 'Defensiv (Blau)',     max: null },
            shieldhealth:{ label: 'Schild-Gesundheit',         group: 'Hilfsmittel (Gelb)',  max: null },
            skillhealth: { label: 'Fähigkeits-Gesundheit',     group: 'Hilfsmittel (Gelb)',  max: null },
            pulsehaste:  { label: 'Scanner-Puls-Tempo',        group: 'Hilfsmittel (Gelb)',  max: null },
            meleedmg:    { label: 'Nahkampfschaden',           group: 'Offensiv (Rot)',      max: null },
            pistoldmg:   { label: 'Pistolenschaden',           group: 'Offensiv (Rot)',      max: null },
            reducedthreat:{ label: 'Bedrohung reduziert',     group: 'Defensiv (Blau)',     max: null }
        };
        // Attribute, die nur auf Named-/Exotic-Teilen vorkommen (kein reguläres Roll-Maximum)
        const GEAR_NAMED_ONLY_ATTRS = new Set(['wd','dta','dttooc','dth','rof','accuracy','range','aok','incomrepair','ammocap','shieldhealth','skillhealth','pulsehaste','meleedmg','pistoldmg','reducedthreat']);
        const GEAR_CORE_WD_MAX = 15;
        const GEAR_PROTO_FACTOR = 1.5;

        // ========== GEAR-TALENTE (High-End: nur Weste & Rucksack) ==========
        // Nur normale High-End-Marken-Teile bekommen ein freies Talent.
        // Named-/Exotic-Perks kommen fix aus der GEAR_DB, grüne Gear-Sets
        // haben Set-Talente -> dort bleibt das Dropdown ausgeblendet.
        // Werte = Normal-Version (Perfekt nur auf Named-Teilen, dort nicht wählbar).
        // type 'wd'    -> additiv zum Waffenschaden (Total Weapon Damage)
        // type 'amp'   -> multiplikativer Verstärker (eigene Schadensgruppe)
        // type null    -> Utility/Defensiv: wird nur gespeichert & angezeigt
        // conditional   -> fließt nur ein, wenn "Bedingte Talente aktiv" an ist
        // onlyWeapons   -> Talent wirkt nur mit diesen Waffengattungen
        // valueByWeapon -> waffengattungsabhängiger Verstärker (Versatile)
        // ===== TALENT-SYNERGIEN (Issue #108 A2) =====
        // Bedingte Waffen-Talente (z.B. Sadist: "nur gegen blutende Ziele")
        // wirken im Spiel nur zuverlaessig, wenn der Build die Bedingung
        // selbst liefern kann - durch ein passendes Gear-Talent oder Set.
        // requirements: 'any' = jedes gelistete Gear-Talent/Set erfuellt die
        // Bedingung; 'selfApply' = Build kann den Status aktiv anwenden.
        const TALENT_SYNERGY = {
            // Blutung
            sadist:        { status: 'blutend', gearTalents: ['trauma'], sets: ['ongoing'] },
            perfekt_sadist:{ status: 'blutend', gearTalents: ['trauma'], sets: ['ongoing'] },
            // Blendung
            blind:         { status: 'geblendet', gearTalents: ['trauma'], sets: [] },
            perfekt_blind: { status: 'geblendet', gearTalents: ['trauma'], sets: [] },
            // Brennen (Feuerfaehigkeiten/Brand-Quellen sind skill-abhaengig;
            // hier genuegt die aktive Annahme, es sei denn Build kann nichts)
            entzundet:     { status: 'brennend', gearTalents: [], sets: [] },
            perfekt_entzundet: { status: 'brennend', gearTalents: [], sets: [] },
            // Puls
            flachlage:     { status: 'gepulst', gearTalents: [], sets: [] },
            perfekte_flachlage: { status: 'gepulst', gearTalents: [], sets: [] },
            // Markierung (Negotiator's Dilemma / Ongoing Directive markieren)
            vorschlaghammer: { status: 'markiert', gearTalents: [], sets: ['negotiator', 'ongoing'] },
            perfekt_vorschlaghammer: { status: 'markiert', gearTalents: [], sets: ['negotiator', 'ongoing'] },
            // Schock
            donnerkeil:    { status: 'geschockt', gearTalents: ['tamperproof'], sets: [] },
            perfekt_donnerkeil: { status: 'geschockt', gearTalents: ['tamperproof'], sets: [] },
            // Beliebiger Statuseffekt
            druckpunkt:    { status: 'statuseffekt', gearTalents: ['trauma', 'tamperproof'], sets: ['ongoing', 'eclipse'] },
            perfekt_druckpunkt: { status: 'statuseffekt', gearTalents: ['trauma', 'tamperproof'], sets: ['ongoing', 'eclipse'] },
            // Verwirrung
            kopfkratzer:   { status: 'verwirrt', gearTalents: [], sets: [] },
            perfekter_kopfkratzer: { status: 'verwirrt', gearTalents: [], sets: [] },
            // Fesseln
            immobilisieren:{ status: 'gefesselt', gearTalents: [], sets: [] },
            perfekt_immobilisieren: { status: 'gefesselt', gearTalents: [], sets: [] }
        };
        // Prueft, ob ein Build die Bedingung eines bedingten Waffen-Talents
        // selbst liefern kann. Liefert { possible, via } zurueck.
        function buildProvidesTalentCondition(talentKey, build) {
            const syn = TALENT_SYNERGY[talentKey];
            if (!syn) return { possible: true, via: 'unbedingtes Talent' };
            // Unbedingte Talente sind immer moeglich
            if (!build || build.length === 0) return { possible: false, via: '' };
            for (const item of build) {
                if (item.talent && syn.gearTalents.includes(item.talent)) {
                    return { possible: true, via: `Gear-Talent ${GEAR_TALENTS[item.talent] ? GEAR_TALENTS[item.talent].label : item.talent}` };
                }
            }
            for (const setKey of syn.sets) {
                if (build.some(i => brandKeyMatches((i.setName || '').toLowerCase(), setKey))) {
                    return { possible: true, via: `Set ${setKey}` };
                }
            }
            // Status ohne bekannte Quelle im Build: nicht selbst lieferbar
            return { possible: false, via: '' };
        }
        const GEAR_TALENTS = {
            // ----- Westen-Talente -----
            gunslinger:        { slot: 'Weste', label: 'Gunslinger', type: 'wd', value: 23, conditional: true, condition: 'Waffenwechsel (5s aktiv)', note: 'Waffenwechsel erhöht den Waffenschaden 5s lang um +23%.' },
            focus:             { slot: 'Weste', label: 'Fokus', type: 'wd', value: 50, conditional: true, condition: 'Zielen mit 8x+ Scope (max. 50%)', note: '+5% Waffenschaden pro Sekunde beim Zielen mit 8x oder stärker, bis max. +50%.' },
            spark:             { slot: 'Weste', label: 'Funke', type: 'wd', value: 15, conditional: true, condition: 'Skill-Treffer (15s aktiv)', note: 'Schaden an einem Gegner durch Fähigkeit: +15% Waffenschaden für 15s.' },
            obliterate:        { slot: 'Weste', label: 'Vernichten', type: 'wd', value: 20, conditional: true, condition: '20 Stacks à +1%', note: 'Kritische Treffer: +1% Waffenschaden für 10s, bis zu 20 Stacks.' },
            intimidate:        { slot: 'Weste', label: 'Einschüchtern', type: 'amp', value: 42, conditional: true, condition: 'mit Bonus-Rüstung (9 Stacks à +4%, exponentiell ≈ 1,04⁹)', note: 'Mit Bonus-Rüstung: 9 Stacks à +4% Schaden gegen Ziele in 10m (multiplikativ, ≈ +42%).' },
            glasscannon:       { slot: 'Weste', label: 'Glaskanone', type: 'amp', value: 25, conditional: false, note: '+25% verstärkter Schaden – ABER du erleidest 50% mehr Schaden.' },
            spotter:           { slot: 'Weste', label: 'Späher', type: 'amp', value: 15, conditional: true, condition: 'gegen gepulste Ziele', note: '+15% verstärkter Schaden gegen gepulste Gegner.' },
            headhunter:        { slot: 'Weste', label: 'Kopfgeldjäger', type: null, note: 'Nach Kopfschuss-Kill: nächster Treffer +125% des Todesstoß-Schadens (situativ, nicht im Ø-DPS).' },
            'empathic resolve': { slot: 'Weste', label: 'Empathische Entschlossenheit', type: null, note: 'Team-Bonus (Waffen-/Skill-Schaden für Verbündete) – fließt nicht in den eigenen DPS ein.' },
            overwatch:         { slot: 'Weste', label: 'Überwachung', type: null, note: 'Team-Bonus – fließt nicht in den eigenen DPS ein.' },
            unbreakable:       { slot: 'Weste', label: 'Unzerstörbar', type: null, note: 'Repariert 95% Rüstung bei Rüstungsverlust (60s CD).' },
            vanguard:          { slot: 'Weste', label: 'Vorhut', type: null, note: 'Schild 5s unverwundbar + 45% Rüstung als Bonus-Rüstung für Verbündete.' },
            protectedreload:   { slot: 'Weste', label: 'Geschütztes Nachladen', type: null, note: '+20% Bonus-Rüstung beim Nachladen.' },
            entrench:          { slot: 'Weste', label: 'Schanzen', type: null, note: 'Kopftreffer aus Deckung reparieren 20% Rüstung.' },
            efficient:         { slot: 'Weste', label: 'Effizient', type: null, note: '50% Chance, Rüstungsset nicht zu verbrauchen.' },
            madbomber:        { slot: 'Weste', label: 'Wahnsinniger Bomber', type: null, note: '+50% Granatenradius, Granaten werden bei Kill erstattet.' },
            braced:            { slot: 'Weste', label: 'Abgestützt', type: null, note: '+45% Waffenhandhabung in Deckung.' },
            skilled:           { slot: 'Weste', label: 'Geübt', type: null, note: '25% Chance auf Cooldown-Reset bei Skill-Kill.' },
            tagteam:           { slot: 'Weste', label: 'Teamwork', type: null, note: 'Waffenschaden am markierten Ziel reduziert aktive Cooldowns um 6s.' },
            trauma:            { slot: 'Weste', label: 'Trauma', type: null, note: 'Kopftreffer blendet, Brusttreffer verursacht Blutung (30s CD).' },
            tamperproof:       { slot: 'Weste', label: 'Manipulationssicher', type: null, note: 'Gegner in 3m der Fähigkeiten werden geschockt.' },
            reassigned:        { slot: 'Weste', label: 'Neu zugewiesen', type: null, note: 'Kill: 1 Spezialmunition für die Seitenwaffe (15s CD).' },
            // ----- Rucksack-Talente -----
            vigilance:         { slot: 'Rucksack', label: 'Wachsamkeit', type: 'wd', value: 25, conditional: true, condition: 'bis du Schaden nimmst (Annahme: konstant aktiv)', note: '+25% Waffenschaden, deaktiviert 4s nach erlittenem Schaden.' },
            versatile:         { slot: 'Rucksack', label: 'Vielseitig', type: 'amp', valueByWeapon: { MP: 35, Shotgun: 35, Rifle: 35, MMR: 35, AR: 10, LMG: 10 }, value: 10, conditional: true, condition: 'nach Waffenwechsel, waffengattungsabhängig', note: 'SMG/Shotgun +35% (unter 15m), Rifle/MMR +35% (über 25m), AR/LMG +10% (15–25m).' },
            unstoppableforce:   { slot: 'Rucksack', label: 'Unaufhaltsame Kraft', type: 'wd', value: 25, conditional: true, condition: '5 Stacks à +5% (Annahme: volle Stacks)', note: 'Kill: +5% Waffenschaden für 15s, bis 5 Stacks (Granaten-Kills zählen doppelt).' },
            companion:         { slot: 'Rucksack', label: 'Gefährte', type: 'wd', value: 15, conditional: true, condition: 'Verbündeter/Fähigkeit in 5m', note: '+15% Waffenschaden, wenn ein Verbündeter oder eine Fähigkeit in 5m Nähe ist.' },
            composure:         { slot: 'Rucksack', label: 'Gelassenheit', type: 'wd', value: 15, conditional: true, condition: 'in Deckung', note: '+15% Waffenschaden in Deckung.' },
            concussion:        { slot: 'Rucksack', label: 'Gehirnerschütterung', type: 'wd', value: 25, conditional: true, condition: 'Kopftreffer-Uptime (beide Buffs aktiv)', note: 'Kopftreffer +10% (1,5s/5s), Kopfschuss-Kill +15% (10s) – zusammen +25%.' },
            wicked:            { slot: 'Rucksack', label: 'Böse', type: 'wd', value: 18, conditional: true, condition: 'Status-Effekt aktiv (20s)', note: 'Status-Effekt anwenden: +18% Waffenschaden für 20s.' },
            opportunistic:     { slot: 'Rucksack', label: 'Opportunistisch', type: 'amp', value: 15, conditional: true, onlyWeapons: ['Shotgun', 'MMR'], condition: 'nur Schrotflinte/MMR, getroffene Gegner', note: 'Schrotflinten-/MMR-Treffer: Gegner erleiden 10% mehr Schaden aus allen Quellen (5s).' },
            clutch:            { slot: 'Rucksack', label: 'Kupplung', type: null, note: 'Kritische Treffer reparieren Rüstung unter 15% Rüstung.' },
            safeguard:         { slot: 'Rucksack', label: 'Sicherung', type: null, note: '+130% Skill-Reparatur bei voller Rüstung.' },
            bloodsucker:       { slot: 'Rucksack', label: 'Blutsauger', type: null, note: 'Kill: +10% Bonus-Rüstung pro Stack (10 Stacks).' },
            leadership:        { slot: 'Rucksack', label: 'Führung', type: null, note: 'Deckungswechsel: Bonus-Rüstung für dich und Verbündete.' },
            protector:         { slot: 'Rucksack', label: 'Beschützer', type: null, note: 'Schild-Schaden gewährt Bonus-Rüstung.' },
            adrenlinerush:     { slot: 'Rucksack', label: 'Adrenalinschub', type: null, note: '20% Bonus-Rüstung in 10m Nähe (3 Stacks).' },
            // Hinweis: interner Schlüssel bewusst "adrenlinerush" (Tippfehler-sicher, keine Auswirkung)
            galvanize:         { slot: 'Rucksack', label: 'Galvanisieren', type: null, note: 'Blind/Fesseln/Verwirren/Schock: 40% Rüstung als Bonus-Rüstung.' },
            energize:          { slot: 'Rucksack', label: 'Energiezufuhr', type: null, note: 'Rüstungsset: +1 Fertigkeiten-Stufe für 15s.' },
            calculated:        { slot: 'Rucksack', label: 'Berechnend', type: null, note: 'Kills aus Deckung: -10% Skill-Cooldowns.' },
            overclock:         { slot: 'Rucksack', label: 'Übertaktung', type: null, note: '+25% Nachladetempo & Cooldown-Reduktion nahe Fähigkeiten.' },
            creepingdeath:     { slot: 'Rucksack', label: 'Kriechender Tod', type: null, note: 'Statuseffekte werden auf Gegner im Umkreis übertragen.' }
        };

        // Talent-Schlüssel für High-End-Weste/Rucksack: sichtbar & wählbar?
        function gearTalentAllowed(slot, setName) {
            if (slot !== 'Weste' && slot !== 'Rucksack') return false;
            if (GEAR_DB[setName]) return false;              // Named/Exotic: Perks fix aus DB
            if (isGearSetName(setName)) return false;         // grüne Sets: Set-Talente
            return true;
        }

        function buildGearTalentOptions(slot) {
            let html = '<option value="">— kein Talent —</option>';
            Object.entries(GEAR_TALENTS).forEach(([key, t]) => {
                if (t.slot !== slot) return;
                const dpsTag = t.type === 'wd' ? ' (+WD)' : t.type === 'amp' ? ' (Verstärker)' : ' (Utility)';
                html += `<option value="${key}">${t.label}${dpsTag}</option>`;
            });
            return html;
        }

        function updateGearTalentUi() {
            const wrap = document.getElementById('gearTalentWrap');
            const sel = document.getElementById('gearTalent');
            if (!wrap || !sel) return;
            const slot = document.getElementById('gearSlot').value;
            const setName = document.getElementById('gearSetName').value;
            const allowed = gearTalentAllowed(slot, setName);
            wrap.classList.toggle('hidden', !allowed);
            if (!allowed) { sel.value = ''; return; }
            // Optionen neu bauen, bisherige Auswahl möglichst behalten
            const prev = sel.value;
            sel.innerHTML = buildGearTalentOptions(slot);
            sel.value = Array.from(sel.options).some(o => o.value === prev) ? prev : '';
            // Bearbeitungsmodus: gespeichertes Talent wiederherstellen, sofern für
            // diesen Slot/Set noch erlaubt (Named/Exotic-Wechsel verwirft es)
            const restore = sel.dataset.restore;
            if (restore && Array.from(sel.options).some(o => o.value === restore)) {
                sel.value = restore;
                delete sel.dataset.restore;
            }
            updateGearTalentHint();
        }

        function updateGearTalentHint() {
            const sel = document.getElementById('gearTalent');
            const hint = document.getElementById('gearTalentHint');
            if (!sel || !hint) return;
            const t = GEAR_TALENTS[sel.value];
            if (!t) { hint.textContent = ''; return; }
            const eff = t.type === 'wd' ? `+${t.value}% Waffenschaden` :
                t.type === 'amp' ? `+${t.value}% verstärkter Schaden` : 'kein DPS-Effekt (Utility)';
            hint.textContent = `${t.note || ''}${t.type ? ` — Rechnung: ${eff}${t.conditional ? ' (nur bei aktiven bedingten Talenten)' : ''}.` : ''}`;
        }


        // Fixer DB-Wert (God-Roll) eines Attributs beim aktuell gewählten Named/Exotic-Teil
        function gearFixedDbValue(type) {
            const el = document.getElementById('gearSetName');
            const e = el ? GEAR_DB[el.value] : null;
            if (!e) return null;
            const f = (e.fixed || []).find(x => x[0] === type);
            return f ? f[1] : null;
        }
        function gearAttrMax(type, proto) {
            const cfg = GEAR_ATTR_TYPES[type];
            let base = (cfg && cfg.max !== null) ? cfg.max : null;
            const fx = gearFixedDbValue(type);
            if (fx !== null) base = fx; // DB-Wert hat Vorrang vor dem allgemeinen Standard-Maximum
            if (base === null) return null;
            return proto ? base * GEAR_PROTO_FACTOR : base;
        }
        function gearCoreWdMax(proto) {
            return proto ? GEAR_CORE_WD_MAX * GEAR_PROTO_FACTOR : GEAR_CORE_WD_MAX;
        }

        // ===== v35: Frei wählbare Gear-Kernattribute (WD / Rüstung / Skill-Tier) =====
        const GEAR_CORE_ARMOUR_STD = 170000;
        const GEAR_CORE_ARMOUR_PROTO = 255000;
        const GEAR_CORE_TYPES = {
            wd: { label: 'Waffenschaden', icon: '🔴' },
            armour: { label: 'Rüstung', icon: '🔵' },
            skill: { label: 'Fertigkeitsrang', icon: '🟡' }
        };
        // Standard-Kern je Set / Marke: wird im Formular vorausgewählt, bleibt aber
        // jederzeit manuell übersteuerbar (Drops können vom Kanon abweichen).
        const GEAR_DEFAULT_CORE = {
            // --- Grüne Gear-Sets (Kerne vom Benutzer bestätigt) ---
            // 🔵 Rüstung
            'True Patriot': 'armour', 'Heartbreaker': 'armour', 'Foundry Bulwark': 'armour',
            'Cavalier': 'armour', 'Aegis': 'armour',
            // 🟡 Fertigkeitsrang
            'Rigger': 'skill', 'Ortiz: Reficere': 'skill', 'Ortiz: Exuro': 'skill',
            'Measured Assembly': 'skill', 'Hard Wired': 'skill', 'Future Initiative': 'skill',
            'Ember Engine': 'skill', 'Eclipse Protocol': 'skill',
            // 🔴 Waffenschaden
            'Aces and Eights': 'wd', 'Breaking Point': 'wd', 'Concentrated Company': 'wd',
            "Hunter's Fury": 'wd', "Negotiator's Dilemma": 'wd', 'Ongoing Directive': 'wd',
            'Striker': 'wd', 'Tip of the Spear': 'wd', 'Tipping Scales': 'wd',
            'Umbra Initiative': 'wd', 'Virtuoso': 'wd', 'Hotshot': 'wd',
            // Offen / Besonderheiten:
            // Core Strength: Kern je Teil zufällig (WD/Rüstung/Skill) – im Formular
            // den tatsächlichen Roll auswählen; nur der Rucksack hat ALLE drei Cores
            'Core Strength': 'any',
            // Refactor & System Corruption: Kern hängt vom Slot ab (siehe GEAR_DEFAULT_CORE_BY_SLOT)
            'Refactor': 'slot', 'System Corruption': 'slot',
            // --- Marken-Sets (Kerne vom Benutzer bestätigt) ---
            // 🔵 Rüstung
            '5.11 Tactical': 'armour', 'Badger Tuff': 'armour', 'Belstone': 'armour',
            'Brazos': 'armour', 'Gila Guard': 'armour', 'Golan Gear': 'armour',
            'Habsburg': 'armour', 'Lengmo': 'armour', 'Palisade': 'armour',
            'Uzina Getica': 'armour', 'Yaahl Gear': 'armour',
            // 🟡 Fertigkeitsrang
            'Alps Summit Armament': 'skill', 'China Light Industries': 'skill',
            'Electrique': 'skill', 'Empress': 'skill', 'Hana-U Corporation': 'skill',
            'Murakami Industries': 'skill', 'Richter & Kaiser': 'skill',
            'Shiny Monkey': 'skill', 'Edelweiss GPz': 'skill', 'Wyvern Wear': 'skill',
            // 🔴 Waffenschaden
            'Airaldi': 'wd', 'Unit Alloys': 'wd', 'Ceska': 'wd', 'Douglas & Harding': 'wd',
            'Fenris': 'wd', 'Grupo Shadow': 'wd', 'Imminence Armaments': 'wd',
            'Legatus S.p.A.': 'wd', 'Overlord': 'wd', 'Petrov': 'wd',
            'Providence Defense': 'wd', 'Royal Works': 'wd', 'Sokolov': 'wd',
            'Urban Lookout': 'wd', 'Walker, Harris & Co.': 'wd', 'Zwiadowka Sp. z o.o.': 'wd'
        };
        // Slot-abhängige Standard-Kerne
        // Refactor & System Corruption (Dark-Zone-exklusiv)
        const GEAR_DEFAULT_CORE_BY_SLOT = {
            'System Corruption': {
                'Maske': 'wd',          // Mask (Weapon Damage)
                'Weste': 'armour',     // Blended Threat Armor (Armor)
                'Rucksack': 'armour',  // Stack Overflow Container (Armor)
                'Handschuhe': 'wd',    // Haptic Bypass Gloves (Weapon Damage)
                'Holster': 'wd',       // Frame Injection Holster (Weapon Damage)
                'Knieschoner': 'armour' // Zero Day Kneepads (Armor)
            },
            'Refactor': {
                'Maske': 'skill',       // Reformed Mask (Skill Tier)
                'Weste': 'skill',      // Reformed Vest (Skill Tier)
                'Rucksack': 'armour',  // Reorganized Backpack (Armor)
                'Handschuhe': 'armour',// Reshuffled Gloves (Armor)
                'Holster': 'skill',    // Revised Holster (Skill Tier)
                'Knieschoner': 'armour' // Remodeled Kneepads (Armor)
            }
        };
        function gearDefaultCoreFor(setName, slot) {
            const bySlot = GEAR_DEFAULT_CORE_BY_SLOT[setName];
            if (bySlot && bySlot[slot]) return bySlot[slot];
            const flat = GEAR_DEFAULT_CORE[setName];
            if (flat === 'any') return 'wd'; // Core Strength: Kern zufällig -> WD als Startwert, Nutzer wählt den echten Roll
            return (flat && flat !== 'slot') ? flat : 'wd';
        }
        function gearCoreDefaultVal(type, proto) {
            if (type === 'armour') return proto ? GEAR_CORE_ARMOUR_PROTO : GEAR_CORE_ARMOUR_STD;
            if (type === 'skill') return proto ? 1.5 : 1;
            return gearCoreWdMax(proto);
        }
        function gearCoreTypeOf(item) {
            return (item && item.coreType) ? item.coreType : 'wd';
        }
        function gearSkillTiersOf(item) {
            // Core-Strength-Rucksack (Gym Backpack): alle drei Cores -> zählt immer +1
            if (gearCoreTypeOf(item) !== 'skill') return gearIsTriCoreItem(item) ? 1 : 0;
            return (item.coreVal != null) ? item.coreVal : (item.proto ? 1.5 : 1);
        }
        // Core Strength Rucksack (Gym Backpack) = Tri-Core (WD + Rüstung + Skill-Tier)
        function gearIsTriCoreItem(item) {
            return item && item.setName === 'Core Strength' && item.slot === 'Rucksack';
        }
        function gearCoreDisplay(item) {
            const t = gearCoreTypeOf(item);
            const ct = GEAR_CORE_TYPES[t] || GEAR_CORE_TYPES.wd;
            // Core-Strength-Rucksack: alle drei Cores anzeigen
            if (gearIsTriCoreItem(item)) {
                const wdAdd = t === 'wd' ? (item.wd || 0) : (item.proto ? 22.5 : 15);
                return `🔴 +${formatGermanNumber(wdAdd)}% 🔵 ${formatGermanNumber(t === 'armour' ? (item.coreVal || GEAR_CORE_ARMOUR_STD) : (item.proto ? GEAR_CORE_ARMOUR_PROTO : GEAR_CORE_ARMOUR_STD))} 🟡 +${formatGermanNumber(gearSkillTiersOf(item))}`;
            }
            if (t === 'armour') return `${ct.icon} ${formatGermanNumber(item.coreVal || GEAR_CORE_ARMOUR_STD)}`;
            if (t === 'skill') return `${ct.icon} +${formatGermanNumber(gearSkillTiersOf(item))}${item.proto ? ' (P)' : ''}`;
            return `${ct.icon} +${formatGermanNumber(item.wd || 0)}%`;
        }
        function onGearCoreTypeChange() {
            syncGearCoreValue(true);
            updateGearAttrHints();
        }
        // Kern-Wert auf den Typ-Standard setzen (skill: Eingabe gesperrt, Wert fix)
        function syncGearCoreValue(force) {
            const sel = document.getElementById('gearCoreType');
            const valEl = document.getElementById('gearWd');
            if (!sel || !valEl) return;
            const t = sel.value || 'wd';
            const def = gearCoreDefaultVal(t, isGearProto());
            valEl.disabled = (t === 'skill');
            if (force || t === 'skill' || Math.abs(parseLocalizedFloat(valEl.value) - def) < 1e-9) {
                valEl.value = formatGermanNumber(def);
            }
        }

        // Attribute eines Teils (Fallback für ältere Items ohne attrs: aus CHC/CHD ableiten)
        function gearItemAttrs(item) {
            if (Array.isArray(item.attrs)) return item.attrs;
            const a = [];
            if (item.chc > 0) a.push({ type: 'chc', val: item.chc });
            if (item.chd > 0) a.push({ type: 'chd', val: item.chd });
            return a;
        }
        function gearAttrSig(item) {
            return gearItemAttrs(item).map(a => `${a.type}=${a.val}`).join(',');
        }
        function gearOtherAttrsText(item) {
            return gearItemAttrs(item)
                .filter(a => a.type !== 'chc' && a.type !== 'chd' && a.val > 0)
                // Bugfix: Einheit je Attribut-Typ – Lebenspunkte & Rüstungsregeneration
                // sind absolute Werte (kein %), alle anderen Prozent.
                .map(a => `${(GEAR_ATTR_TYPES[a.type] || { label: a.type }).label} ${formatGermanNumber(a.val)}${gearAttrUnit(a.type)}`)
                .join(', ');
        }

        // Einheit: Lebenspunkte & Rüstungsregeneration sind absolute Werte, Rest Prozent
        function gearAttrUnit(type) {
            return (type === 'health' || type === 'armorregen') ? '' : '%';
        }

        function buildGearAttrOptions(includeNone, namedAllowed) {
            let html = includeNone ? '<option value="">— kein Attribut —</option>' : '';
            const groups = {};
            Object.entries(GEAR_ATTR_TYPES).forEach(([k, c]) => { (groups[c.group] = groups[c.group] || []).push([k, c]); });
            Object.entries(groups).forEach(([g, list]) => {
                // Standard-Roll-Attribute immer; Named/Exotic-only nur bei passendem Teil
                const std = list.filter(([k]) => !GEAR_NAMED_ONLY_ATTRS.has(k));
                const named = namedAllowed ? list.filter(([k]) => GEAR_NAMED_ONLY_ATTRS.has(k)) : [];
                if (std.length) {
                    html += `<optgroup label="${g}">` + std.map(([k, c]) =>
                        `<option value="${k}">${c.label}</option>`).join('') + '</optgroup>';
                }
                if (named.length) {
                    html += `<optgroup label="${g} – nur Named/Exotic">` + named.map(([k, c]) =>
                        `<option value="${k}">${c.label}</option>`).join('') + '</optgroup>';
                }
            });
            return html;
        }

        // Attribut-Dropdowns je nach gewähltem Teil neu aufbauen:
        // Freie Minors rollen immer nur Standard-Attribute ("Any Basic" aus der Liste);
        // Spezial-Typen (Feuerrate, DTA, ...) erscheinen NUR im jeweiligen Fix-Feld,
        // damit der dort gesperrte Typ gültig bleibt und nicht manipulierbar ist.
        function rebuildGearAttrSelects() {
            const setName = document.getElementById('gearSetName').value;
            const entry = GEAR_DB[setName];
            const fixed = entry ? (entry.fixed || []) : [];
            [1, 2].forEach(n => {
                const sel = document.getElementById('gearAttr' + n + 'Type');
                const valEl = document.getElementById('gearAttr' + n + 'Val');
                if (!sel) return;
                const isFixedSlot = !!fixed[n - 1];
                const prev = sel.value;
                sel.innerHTML = buildGearAttrOptions(true, isFixedSlot);
                if (prev && Array.from(sel.options).some(o => o.value === prev)) {
                    sel.value = prev; // gültige Auswahl behalten
                } else {
                    // Nicht mehr erlaubter Typ -> zurücksetzen
                    sel.value = n === 1 ? 'chd' : '';
                    valEl.value = sel.value ? formatGermanNumber(gearAttrMax(sel.value, false) || 0) : '0';
                }
            });
            onGearAttrTypeChange(1);
        }

        function initGearAttrSelects() {
            const s1 = document.getElementById('gearAttr1Type');
            const s2 = document.getElementById('gearAttr2Type');
            if (!s1 || !s2) return;
            s1.innerHTML = buildGearAttrOptions(true);
            s2.innerHTML = buildGearAttrOptions(true);
            // Standard (auch für form.reset()): Attribut 1 = CHD, Attribut 2 = keins
            s1.querySelector('option[value="chd"]').defaultSelected = true;
            s2.querySelector('option[value=""]').defaultSelected = true;
            s1.value = 'chd';
            s2.value = '';
            updateGearAttrUi();
        }

        function isGearSetName(name) {
            const g = document.querySelector('#gearSetName optgroup[label^="Gear Sets"]');
            return !!g && Array.from(g.querySelectorAll('option')).some(o => o.value === name);
        }

        function isGearProto() { return document.getElementById('gearIsPrototype').checked; }

        // Grüne Gear-Sets: nur 1 Attribut -> Attribut 2 ausblenden/zurücksetzen
        function updateGearAttrUi() {
            const wrap = document.getElementById('gearAttr2Wrap');
            if (!wrap) return;
            const green = isGearSetName(document.getElementById('gearSetName').value);
            wrap.classList.toggle('hidden', green);
            if (green) {
                document.getElementById('gearAttr2Type').value = '';
                document.getElementById('gearAttr2Val').value = '0';
            }
            updateGearAttrHints();
        }

        function onGearAttrTypeChange(n) {
            const t1 = document.getElementById('gearAttr1Type');
            const t2 = document.getElementById('gearAttr2Type');
            if (n === 1 && t1.value && t1.value === t2.value) { t2.value = ''; document.getElementById('gearAttr2Val').value = '0'; }
            if (n === 2 && t2.value && t1.value === t2.value) {
                t2.value = '';
                showToast('Attribut 1 und Attribut 2 dürfen nicht identisch sein.', 'error');
            }
            const sel = document.getElementById('gearAttr' + n + 'Type');
            const valEl = document.getElementById('gearAttr' + n + 'Val');
            const mx = gearAttrMax(sel.value, isGearProto());
            if (!sel.value) valEl.value = '0';
            else if (mx !== null) valEl.value = formatGermanNumber(mx);
            updateGearAttrHints();
        }

        // Prototyp umschalten: Werte, die genau dem bisherigen Maximum entsprachen, mitziehen
        function onGearProtoChange() {
            const now = isGearProto();
            const was = !now;
            const wdEl = document.getElementById('gearWd');
            // v35: kern-abhängig – WD 15/22,5%, Rüstung 170.000/255.000, Skill 1/1,5
            const coreT = (document.getElementById('gearCoreType') || {}).value || 'wd';
            const oldDef = gearCoreDefaultVal(coreT, was);
            const newDef = gearCoreDefaultVal(coreT, now);
            if (coreT === 'skill') wdEl.value = formatGermanNumber(newDef);
            else if (Math.abs(parseLocalizedFloat(wdEl.value) - oldDef) < 1e-9) wdEl.value = formatGermanNumber(newDef);
            [1, 2].forEach(n => {
                const t = document.getElementById('gearAttr' + n + 'Type').value;
                const el = document.getElementById('gearAttr' + n + 'Val');
                const oldMax = gearAttrMax(t, was);
                if (oldMax !== null && Math.abs(parseLocalizedFloat(el.value) - oldMax) < 1e-9) el.value = formatGermanNumber(gearAttrMax(t, now));
            });
            updateGearAttrHints();
        }

        function setGearHint(elId, val, max, proto, type) {
            const el = document.getElementById(elId);
            if (!el) return;
            if (max === null) {
                el.textContent = 'Max-Wert für diesen Typ noch nicht hinterlegt – keine Prüfung.';
                el.className = 'text-[11px] text-gray-500 mt-0.5';
                return;
            }
            const over = val > max + 1e-9;
            el.textContent = `Max (${proto ? 'Prototyp, ' : ''}High-End): ${formatGermanNumber(max)}${gearAttrUnit(type)}` + (over ? ' — Wert liegt darüber!' : '');
            el.className = 'text-[11px] mt-0.5 ' + (over ? 'text-red-400' : 'text-gray-500');
        }

        function updateGearAttrHints() {
            if (!document.getElementById('gearWdHint')) return;
            const proto = isGearProto();
            // v35: Kern-Hinweis abhängig vom Kern-Typ
            const coreT = (document.getElementById('gearCoreType') || {}).value || 'wd';
            const coreValNow = parseLocalizedFloat(document.getElementById('gearWd').value);
            const csName = document.getElementById('gearSetName')?.value || '';
            if (csName === 'Core Strength') {
                const hintElCs = document.getElementById('gearWdHint');
                const isCsBackpack = document.getElementById('gearSlot').value === 'Rucksack';
                hintElCs.textContent = isCsBackpack
                    ? 'Core-Strength-Rucksack (Gym Backpack): ALLE drei Cores (WD + Rüstung + Skill-Tier) – zählt in jeder Kern-Summe.'
                    : 'Core Strength: Kern ist je Teil zufällig (🔴/🔵/🟡) – bitte den tatsächlichen Roll deines Teils auswählen.';
                hintElCs.className = 'text-[11px] mt-0.5 text-amber-400';
                return;
            }
            if (coreT === 'skill') {
                const hintEl = document.getElementById('gearWdHint');
                const tDef = gearCoreDefaultVal('skill', proto);
                hintEl.textContent = `+${formatGermanNumber(tDef)} Fertigkeitsstufe(n)${proto ? ' (Prototyp) — 4 Teile = 6 Stufen ✅' : ' — Prototyp: +1,5 (4 Teile = 6 Stufen)'}`;
                hintEl.className = 'text-[11px] mt-0.5 ' + (proto ? 'text-emerald-400' : 'text-gray-500');
            } else if (coreT === 'armour') {
                // 'health' -> Einheit leer (Rüstungspunkte statt %)
                setGearHint('gearWdHint', coreValNow, proto ? GEAR_CORE_ARMOUR_PROTO : GEAR_CORE_ARMOUR_STD, proto, 'health');
            } else {
                setGearHint('gearWdHint', coreValNow, gearCoreWdMax(proto), proto);
            }
            [1, 2].forEach(n => {
                const t = document.getElementById('gearAttr' + n + 'Type').value;
                const hint = document.getElementById('gearAttr' + n + 'Hint');
                if (!t) { hint.textContent = ''; return; }
                setGearHint('gearAttr' + n + 'Hint', parseLocalizedFloat(document.getElementById('gearAttr' + n + 'Val').value), gearAttrMax(t, proto), proto, t);
            });
        }

        function readGearFormAttrs() {
            const attrs = [];
            [1, 2].forEach(n => {
                if (n === 2 && document.getElementById('gearAttr2Wrap').classList.contains('hidden')) return;
                const t = document.getElementById('gearAttr' + n + 'Type').value;
                if (!t) return;
                const v = parseLocalizedFloat(document.getElementById('gearAttr' + n + 'Val').value);
                if (isFinite(v) && v > 0) attrs.push({ type: t, val: v });
            });
            return attrs;
        }

        // CSV-Zeile -> Gear-Item (neues Format mit Attr-Spalten, sonst aus CHC/CHD ableiten)
        // Bereinigt Named-Felder alter/importierter Teile (Config-Schlüssel, Memento-Doppelzählung)
        function normalizeGearItem(item) {
            if (!item) return item;
            // v35-Migration: Kernattribut-Felder ergänzen (alte Items ohne coreType = WD-Kern;
            // WD-lose DB-Teile bekommen ihren DB-Kern: armour/skill)
            if (!item.coreType) {
                const dbE = GEAR_DB[item.setName];
                if ((item.wd || 0) > 0) { item.coreType = 'wd'; item.coreVal = item.wd; }
                else if (dbE && dbE.core === 'armour') { item.coreType = 'armour'; item.coreVal = GEAR_CORE_ARMOUR_STD; }
                else if (dbE && dbE.core === 'skill') { item.coreType = 'skill'; item.coreVal = 1; }
                else { item.coreType = 'wd'; item.coreVal = item.wd || 0; }
            }
            if (item.coreType !== 'wd' && item.coreType !== 'armour' && item.coreType !== 'skill') {
                item.coreType = 'wd'; item.coreVal = item.wd || 0;
            }
            if (item.coreType !== 'wd') item.wd = 0;
            if (item.namedKey === 'armorRegen') item.namedKey = 'armorregen';
            if (item.setName === 'Memento' && item.namedKey === 'wd') {
                if ((item.wd || 0) < (item.namedVal || 0)) item.wd = item.namedVal;
                item.namedKey = ''; item.namedVal = 0;
            }
            const conf = NAMED_ITEM_CONFIGS[item.setName];
            if (!conf && item.namedKey) { item.namedKey = ''; item.namedVal = 0; }
            else if (conf && item.namedKey && item.namedKey !== conf.attrKey) item.namedKey = conf.attrKey;
            return item;
        }
        var gearCsvSkipped = [];

        function gearItemFromCsvParts(parts) {
            const slot = (parts[0] || '').trim();
            const setName = (parts[1] || '').trim();
            if (!slot || !setName) return null;
            const item = {
                id: gearIdCounter++, slot, setName,
                chc: parseLocalizedFloat(parts[2]),
                chd: parseLocalizedFloat(parts[3]),
                wd: parseLocalizedFloat(parts[4]),
                namedKey: parts[5] ? parts[5].trim() : '',
                namedVal: parts[6] ? parseLocalizedFloat(parts[6]) : 0
            };
            if (parts.length >= 11) {
                const attrs = [];
                [[7, 8], [9, 10]].forEach(([ti, vi]) => {
                    const t = (parts[ti] || '').trim();
                    const v = parseLocalizedFloat(parts[vi]);
                    if (GEAR_ATTR_TYPES[t] && isFinite(v) && v > 0) attrs.push({ type: t, val: v });
                });
                item.attrs = attrs;
                item.proto = !isExoticGearName(setName) && /^(1|true|ja|x)$/i.test((parts[11] || '').trim());
                item.chc = attrs.filter(a => a.type === 'chc').reduce((sum, a) => sum + a.val, 0);
                item.chd = attrs.filter(a => a.type === 'chd').reduce((sum, a) => sum + a.val, 0);
            }
            // Talent (Spalte 13, optional): nur übernehmen, wenn es zum Slot passt
            if (parts.length >= 13) {
                const tKey = (parts[12] || '').trim();
                if (tKey) {
                    const t = GEAR_TALENTS[tKey];
                    if (t && t.slot === slot) item.talent = tKey;
                    else gearCsvSkipped.push(`${setName} (${slot}): unbekanntes/ungültiges Talent „${tKey}“ ignoriert`);
                }
            }
            // v35: Kernattribut-Spalten (14/15, optional – rückwärtskompatibel)
            if (parts.length >= 15) {
                const ctCsv = (parts[13] || '').trim();
                if (ctCsv === 'armour' || ctCsv === 'skill' || ctCsv === 'wd') {
                    item.coreType = ctCsv;
                    item.coreVal = parseLocalizedFloat(parts[14]) || 0;
                    if (ctCsv === 'skill') item.coreVal = item.proto ? 1.5 : 1;
                    if (ctCsv === 'wd') { item.coreVal = item.wd; }
                    else { item.wd = 0; }
                }
            }
            normalizeGearItem(item);
            // Alt-Format (weniger als 11 Spalten = ohne Attribut-/Prototyp-Spalten):
            // Werte ÜBER dem High-End-Maximum sind Prototyp-Rolls (x1,5) – das
            // Prototyp-Flag war im alten CSV-Format nicht speicherbar und wird
            // hier aus den Werten rekonstruiert, statt die Zeile fälschlich
            // als "über Maximalwert" abzulehnen.
            if (parts.length < 11) {
                const dbEntry = GEAR_DB[setName];
                if (!isExoticGearName(setName)) {
                    const overHighEnd = item.wd > GEAR_CORE_WD_MAX + 1e-9 ||
                        gearItemAttrs(item).some(a => {
                            const mx = GEAR_ATTR_TYPES[a.type] ? GEAR_ATTR_TYPES[a.type].max : null;
                            return mx !== null && mx !== undefined && a.val > mx + 1e-9;
                        });
                    if (overHighEnd) item.proto = true;
                }
                // DB-Teil ohne WD-Kern (z.B. The Hollow Man = Rüstungs-Kern):
                // Der alte Export hatte WD als Standard (15%) vorbelegt, obwohl
                // das Teil im Spiel gar keinen Waffenschaden-Kern hat – der
                // Wert würde das Build-Ergebnis verfälschen -> auf 0 korrigieren.
                if (dbEntry && dbEntry.core !== 'wd' && dbEntry.core !== 'any' && item.wd > 0) {
                    item.wd = 0;
                }
            }
            // Prüfungen wie im Formular: Slot und DB-Werte – JETZT auch für alte
            // CSV-Zeilen ohne Attribut-Spalten (Attribute werden dann aus
            // CHC/CHD abgeleitet und mit der GEAR_DB geprüft).
            const reqSlot = getNamedItemSlot(setName);
            if (reqSlot && reqSlot !== slot) {
                gearCsvSkipped.push(`${setName}: Slot „${slot}“ ≠ „${reqSlot}“`);
                return null;
            }
            const errs = validateGearAgainstDb(setName, item.wd, gearItemAttrs(item), item.proto);
            if (errs.length) { gearCsvSkipped.push(`${setName} (${slot}): ${errs.join('; ')}`); return null; }
            return item;
        }

        // Duplikat-Erkennung: identisches Teil = gleicher Slot + Set + WD +
        // Prototyp-Status + Named-Wert + identische Attribut-Signatur.
        function gearDuplicateSig(item) {
            return [item.slot, item.setName, gearCoreTypeOf(item), item.wd, item.proto ? 1 : 0, item.namedKey || '', item.namedVal || 0, item.talent || '', gearAttrSig(item)].join('|');
        }
        function isDuplicateGearItem(item, batch) {
            const sig = gearDuplicateSig(item);
            if (gearInventory.some(g => gearDuplicateSig(g) === sig)) return true;
            if (Array.isArray(batch) && batch.some(g => gearDuplicateSig(g) === sig)) return true;
            return false;
        }

        // ========== SLOT-VALIDIERUNG FÜR NAMED / EXOTIC GEAR ==========
        // Die Zuordnung Named-Item -> Slot steht als data-slot an den <option>-Tags.
        // Beim ersten Aufruf wird sie gecacht; danach wird die Named-Optgroup
        // je nach gewähltem Slot neu aufgebaut (nur passende Teile sichtbar).
        let gearNamedOptionsCache = null;

        // ========== GEAR-DATENBANK: Auswahlliste & Auto-Ausfüllung ==========
        function updateGearDbOptions() {
            const sel = document.getElementById('gearDbSelect');
            if (!sel) return;
            const slot = document.getElementById('gearSlot').value;
            const prev = sel.value;
            const items = Object.entries(GEAR_DB)
                .filter(([, e]) => e.slot === slot)
                .sort((a, b) => (a[1].cls === b[1].cls ? a[0].localeCompare(b[0], 'de') : (a[1].cls === 'exotic' ? 1 : -1)));
            sel.innerHTML = '<option value="">— Teil auswählen —</option>' + items.map(([n, e]) => {
                const tag = e.cls === 'exotic' ? '🟠 ' : '🟡 ';
                return `<option value="${n.replace(/"/g, '&quot;')}">${tag}${n} (${e.brand || 'Exotic'})</option>`;
            }).join('');
            if (prev && GEAR_DB[prev] && GEAR_DB[prev].slot === slot) sel.value = prev;
        }

        function gearCoreLabel(c) {
            return c === 'wd' ? 'Waffenschaden' : c === 'armour' ? 'Rüstung' : c === 'skill' ? '+1 Fertigkeiten-Stufe' : 'beliebig';
        }

        // Option im Set-Dropdown sicherstellen (Named-Optgroup wird je Slot gefiltert)
        function ensureGearSetOption(name, entry) {
            const sel = document.getElementById('gearSetName');
            if (Array.from(sel.options).some(o => o.value === name)) return;
            const group = document.getElementById('gearNamedGroup');
            if (!group) return;
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = `${name} (${entry.brand || 'Exotic'})`;
            opt.setAttribute('data-slot', entry.slot);
            group.appendChild(opt);
        }

        // Bei Named/Exotic-Teilen aus der DB: Attribut-TYP ist fix (Dropdown gesperrt),
        // der WERT bleibt erfassbar (Roll-Range, z.B. CHC 1,2–6 %) – vorbelegt mit
        // God-Roll (Max). Zusätzlich wird Attribut 2 ausgeblendet, wenn das Teil laut
        // DB weniger als 2 erfassbare Minor-Slots hat (z.B. Contractor's Gloves:
        // DTA-Spezial + nur 1 freier Minor). Ohne DB-Teil: alles frei.
        function lockGearFixedAttrs() {
            const setName = document.getElementById('gearSetName').value;
            const entry = GEAR_DB[setName];
            const fixed = entry ? (entry.fixed || []) : [];
            [1, 2].forEach(n => {
                const tEl = document.getElementById('gearAttr' + n + 'Type');
                const vEl = document.getElementById('gearAttr' + n + 'Val');
                const hint = document.getElementById('gearAttr' + n + 'Hint');
                const f = fixed[n - 1];
                const lockType = !!f;
                tEl.disabled = lockType;
                vEl.disabled = false;
                vEl.classList.remove('opacity-60', 'cursor-not-allowed');
                if (lockType && hint) {
                    const unit = gearAttrUnit(f[0]);
                    hint.textContent = `Fixer Attribut-Typ – Wert frei rollbar (God-Roll: ${formatGermanNumber(f[1])}${unit}, bitte deinen Roll eintragen)`;
                    hint.className = 'text-[11px] text-amber-400 mt-0.5';
                }
            });

            // Attribut 2 nur anbieten, wenn das Teil genug erfassbare Minor-Slots hat:
            // Formular-Felder = fixe Minors (gesperrt) + freie Minors. Das Spezial-
            // Attribut (Named-Box, z.B. +8% DTA bei Contractor's Gloves) belegt einen
            // Minor-Slot des Teils und belegt KEIN Formular-Feld – daher fließt es
            // hier nicht in die Feld-Anzahl ein, sondern reduziert die freien Minors
            // (in GEAR_DB als free hinterlegt).
            // Attribut-Felder nur anbieten, wenn das Teil genug erfassbare Minor-Slots
            // hat (nur bei DB-Teilen; normale Marken/Sets bleiben unverändert).
            // Memento & Co. haben GAR KEINE Minor-Attribute (nur Cores + Mod-Slot):
            // dann verschwinden beide Attribut-Felder.
            if (entry) {
                const formSlots = fixed.length + entry.free;
                [1, 2].forEach(n => {
                    const wrap = document.getElementById('gearAttr' + n + 'Wrap');
                    if (!wrap) return;
                    const isFixedSlot = !!fixed[n - 1];
                    const shouldHide = formSlots < n && !isFixedSlot;
                    if (shouldHide && !wrap.classList.contains('hidden')) {
                        wrap.classList.add('hidden');
                        document.getElementById('gearAttr' + n + 'Type').value = '';
                        document.getElementById('gearAttr' + n + 'Val').value = '0';
                    } else if (!shouldHide && wrap.classList.contains('hidden')) {
                        // Wieder einblenden, wenn ein vorheriges Teil (z.B. Memento)
                        // die Felder ausgeblendet hat und das neue Teil sie braucht
                        wrap.classList.remove('hidden');
                        if (n === 2) { /* Werte kommen gleich aus applyGearDbEntry */ }
                    }
                });
            } else {
                // Bugfix: Normales Marken-/Set-Teil (kein DB-Eintrag) – Attribut 1
                // wieder einblenden, falls ein vorheriges DB-Teil ohne Minors
                // (z.B. Memento) beide Felder ausgeblendet hat und nur Feld 2
                // zurückkam. Attribut 2 regelt updateGearAttrUi (grüne Sets = 1 Attribut).
                const w1 = document.getElementById('gearAttr1Wrap');
                if (w1 && w1.classList.contains('hidden')) {
                    w1.classList.remove('hidden');
                    // Feld wurde beim Ausblenden geleert -> Standard CHD 12% wiederherstellen
                    const t1 = document.getElementById('gearAttr1Type');
                    if (t1 && !t1.value) {
                        t1.value = 'chd';
                        document.getElementById('gearAttr1Val').value = formatGermanNumber(12);
                    }
                }
            }
        }

        // Gemeinsames Befüllen aus dem GEAR_DB-Eintrag: Core-Vorbelegung (God-Roll),
        // fixe Attribut-Typen & Werte. Wird von selectGearFromDatabase UND
        // onGearSetSelectionChange genutzt, damit auch der Wechsel über das
        // Set-Dropdown die korrekten Max-Werte übernimmt (keine Alt-Werte).
        function applyGearDbEntry(name) {
            const e = GEAR_DB[name];
            if (!e) {
                // Bugfix: Normales Marken-/Set-Teil – einheitliche Standard-Vorbelegung
                // (CHD 12%), damit nach Teilen ohne freie Minors (z.B. Memento) nicht
                // "kein Attribut / 0" stehen bleibt. Beide Wege (Set-Dropdown UND
                // Teile-Datenbank) verwenden jetzt dieselbe Logik.
                const t1 = document.getElementById('gearAttr1Type');
                const v1 = document.getElementById('gearAttr1Val');
                if (t1 && !t1.value) {
                    t1.value = 'chd';
                    v1.value = formatGermanNumber(12);
                }
                // v35: Standard-Kern der Marke / des Sets vorbelegen (übersteuerbar;
                // System Corruption hängt vom Slot ab)
                const dSel = document.getElementById('gearCoreType');
                if (dSel && !dSel.disabled) {
                    dSel.value = gearDefaultCoreFor(
                        document.getElementById('gearSetName').value,
                        document.getElementById('gearSlot').value
                    );
                    syncGearCoreValue(true);
                }
                return;
            }
            const protoChk = document.getElementById('gearIsPrototype');
            const protoOn = !!(e.proto && protoChk && !protoChk.disabled && protoChk.checked);

            // v35: Kern-Typ aus der DB übernehmen; Exoten haben fixe Kerne -> Dropdown gesperrt
            const coreSel = document.getElementById('gearCoreType');
            const wdEl = document.getElementById('gearWd');
            if (coreSel) {
                coreSel.disabled = (e.cls === 'exotic');
                if (e.core === 'wd' || e.core === 'armour' || e.core === 'skill') coreSel.value = e.core;
                else coreSel.value = 'wd'; // 'any' -> Standard WD
                syncGearCoreValue(true);
            } else {
                wdEl.value = (e.core === 'wd')
                    ? formatGermanNumber(gearCoreWdMax(protoOn))
                    : '0';
            }

            // Fixe Minor-Attribute in Attribut 1/2 eintragen (God-Roll, Wert bleibt editierbar)
            const fixedList = (e.fixed || []).slice(0, 2);
            [1, 2].forEach(n => {
                const tEl = document.getElementById('gearAttr' + n + 'Type');
                const vEl = document.getElementById('gearAttr' + n + 'Val');
                const f = fixedList[n - 1];
                if (f && Array.from(tEl.options).some(o => o.value === f[0])) {
                    tEl.value = f[0];
                    vEl.value = formatGermanNumber(f[1] * (protoOn ? GEAR_PROTO_FACTOR : 1));
                } else if (!f) {
                    // Freier Slot: auf sauberen Standard zurücksetzen statt alte Werte zu übernehmen
                    tEl.value = n === 1 ? 'chd' : '';
                    vEl.value = n === 1 ? formatGermanNumber(gearAttrMax('chd', protoOn) || 12) : '0';
                }
            });
        }

        function selectGearFromDatabase() {
            const name = document.getElementById('gearDbSelect').value;
            const info = document.getElementById('gearDbInfo');
            if (!name || !GEAR_DB[name]) { if (info) info.classList.add('hidden'); return; }
            const e = GEAR_DB[name];

            // Slot + Set übernehmen
            document.getElementById('gearSlot').value = e.slot;
            applyGearSlotFilter();
            ensureGearSetOption(name, e);
            document.getElementById('gearSetName').value = name;
            onGearSetSelectionChange();

            // Prototyp: bei Exoten deaktiviert (onGearSetSelectionChange regelt das), Named: Haken frei
            const protoChk = document.getElementById('gearIsPrototype');

            // Bugfix: Core- & Attribut-Vorbelegung NICHT mehr inline dupliziert –
            // onGearSetSelectionChange() ruft bereits applyGearDbEntry(name), das
            // jetzt für freie Slots dieselbe Vorbelegung (CHD 12%) setzt wie der
            // Weg über das Set-Dropdown. Vorher gab es hier abweichend "kein
            // Attribut / 0" für freie Slots.

            updateGearAttrUi();
            lockGearFixedAttrs();
            updateGearAttrHints();

            const totalAttrs = (e.fixed || []).length + (e.free || 0);
            const extra = (e.fixed || []).length > 2 ? ' · Achtung: 3 fixe Minors – drittes nur im Perk-Text erfasst'
                : (totalAttrs > 2 ? ` · Achtung: Teil hat ${totalAttrs} Attribute, das Formular erfasst max. 2` : '');
            info.innerHTML = `<strong class="text-div-accent">${escapeHtml(name)}</strong> · ${escapeHtml(e.brand || 'Exotic')} · ` +
                `${e.cls === 'exotic' ? '🟠 Exotic (fixe Werte, kein Prototyp)' : (e.proto ? '🟡 Named (Prototyp möglich)' : '🟡 Named (kein Prototyp)')}` +
                `<br>Core: ${escapeHtml(gearCoreLabel(e.core))} · Mod-Slots: ${e.mods} · Frei rollbare Minors: ${e.free}` +
                `<br><span class="text-gray-300">Perk: ${escapeHtml(e.perk)}</span>${escapeHtml(extra)}`;
            info.classList.remove('hidden');
            showToast(`✅ „${name}“ übernommen – Werte prüfen und speichern.`, 'info');
        }

        function getGearNamedOptions() {
            if (!gearNamedOptionsCache) {
                const group = document.getElementById('gearNamedGroup');
                const base = group
                    ? Array.from(group.querySelectorAll('option')).map(o => ({
                        value: o.value, text: o.textContent, slot: o.getAttribute('data-slot')
                    }))
                    : [];
                // DB-Einträge (vollständige Named/Exotic-Liste) vorziehen; statische Duplikate verwerfen
                const db = Object.entries(GEAR_DB).map(([n, e]) => ({
                    value: n, text: `${n} (${e.brand || 'Exotic'})`, slot: e.slot
                }));
                const dbNames = new Set(db.map(o => o.value));
                gearNamedOptionsCache = db.concat(base.filter(o => !dbNames.has(o.value)));
            }
            return gearNamedOptionsCache;
        }

        function getNamedItemSlot(setName) {
            const entry = getGearNamedOptions().find(o => o.value === setName);
            return entry ? entry.slot : null;
        }

        function applyGearSlotFilter() {
            const slot = document.getElementById('gearSlot').value;
            const select = document.getElementById('gearSetName');
            const group = document.getElementById('gearNamedGroup');
            if (!group) return;
            const prev = select.value;
            const allNamed = getGearNamedOptions(); // Cache VOR dem Leeren der Gruppe füllen
            group.innerHTML = '';
            allNamed.filter(o => o.slot === slot).forEach(o => {
                const opt = document.createElement('option');
                opt.value = o.value;
                opt.textContent = o.text;
                opt.setAttribute('data-slot', o.slot);
                group.appendChild(opt);
            });
            group.hidden = group.children.length === 0;
            // Auswahl behalten, sofern noch gültig – sonst auf den ersten Eintrag (Striker) zurück
            const stillValid = Array.from(select.options).some(o => o.value === prev);
            select.value = stillValid ? prev : select.options[0].value;
        }

        function onGearSlotChange() {
            applyGearSlotFilter();
            onGearSetSelectionChange();
            updateGearDbOptions();
        }

        function onGearSetSelectionChange() {
            const setName = document.getElementById('gearSetName').value;
            const box = document.getElementById('namedAttributeBox');
            const titleEl = document.getElementById('namedAttributeTitle');
            const labelEl = document.getElementById('namedAttrLabel');
            const valInput = document.getElementById('namedAttrVal');

            // Exotisches Gear: Prototyp nicht anwendbar -> Haken deaktivieren
            const protoChk = document.getElementById('gearIsPrototype');
            const protoHint = document.getElementById('gearProtoExoticHint');
            const isExotic = isExoticGearName(setName);
            if (protoChk) {
                protoChk.disabled = isExotic;
                if (isExotic) protoChk.checked = false;
            }
            if (protoHint) protoHint.classList.toggle('hidden', !isExotic);

            // v35: Exotisches Gear -> Kern-Dropdown sperren (fixe Kerne)
            const coreSelExotic = document.getElementById('gearCoreType');
            if (coreSelExotic) coreSelExotic.disabled = isExotic;

            // Attribut-Auswahl auf mögliche Werte einschränken (Standard vs. Named/Exotic)
            rebuildGearAttrSelects();

            // Named/Exotic-Teil aus der DB: Core & fixe Attribute frisch übernehmen,
            // damit beim Wechseln die korrekten God-Roll-Werte stehen (keine Alt-Werte)
            applyGearDbEntry(setName);

            if (NAMED_ITEM_CONFIGS[setName]) {
                const conf = NAMED_ITEM_CONFIGS[setName];
                titleEl.textContent = conf.label;
                labelEl.textContent = conf.attrKey === 'chcchd' ? 'Zusatzwert CHC/CHD (%):' : 'Zusatzwert (%):';
                valInput.value = conf.defaultVal;
                box.classList.remove('hidden');
            } else {
                box.classList.add('hidden');
            }
            updateGearAttrUi();
            // Fixe DB-Attribute sperren / freie Attribute freigeben –
            // NACH updateGearAttrUi, da dieses Attribut 2 ggf. wieder einblendet
            lockGearFixedAttrs();
            // Talent-Dropdown: nur bei High-End Weste/Rucksack anbieten
            updateGearTalentUi();
        }

        function updateGearSetFilterOptions() {
            const setFilter = document.getElementById('gearSetFilter');
            if (!setFilter) return;
            const prevValue = setFilter.value;
            const setNames = [...new Set(gearInventory.map(i => i.setName))].sort((a, b) => a.localeCompare(b, 'de'));
            setFilter.innerHTML = '<option value="">Alle Sets</option>' +
                setNames.map(n => `<option value="${n.replace(/"/g, '&quot;')}">${n}</option>`).join('');
            if (prevValue && setNames.includes(prevValue)) {
                setFilter.value = prevValue;
            }
        }

        // ========== GEAR-EMPFEHLUNG (analog Waffen-Empfehlung) ==========
        // Annahme für die Krit-Erwartung (Standard 60%), oben im Kopf einstellbar.
        // ========== GEAR-MOD-EMPFEHLUNG (CHC vs. CHD, automatische Optimierung) ==========
        // Es gibt keine freie Mod-Erfassung für Gear-Mod-Plätze: Das Tool
        // entscheidet automatisch, ob CHC (+6%) oder CHD (+12%) drauf gehört.
        // Logik identisch zur kombinierten Optimierung: alle 4 Aufteilungen
        // (0-3× CHC) durchprobieren und die mit dem höchsten Ø-Schaden wählen.
        // Ø-Schaden = (1 − p) + p × (1 + CHD/100) mit p = min(CHC, 60)/100.
        function updateGearModAdvice() {
            const el = document.getElementById('gearModAdvice');
            if (!el) return;
            if (!gearInventory || gearInventory.length === 0) {
                el.innerHTML = `<p class="text-xs text-gray-500">🔧 <strong>Mod-Empfehlung (automatisch):</strong> Noch keine Ausrüstung erfasst. Sobald Teile im Inventar sind, erscheint hier automatisch, ob du auf die Gear-Mod-Plätze <strong>Kritische Trefferchance (CHC, +6%)</strong> oder <strong>Kritischen Trefferschaden (CHD, +12%)</strong> setzen solltest – abhängig von deinem Inventar, der SHD-Uhr und Coyote's Mask. Eine manuelle Mod-Erfassung ist dafür nicht nötig.</p>`;
                return;
            }
            // Bestes Teil pro Slot gemäß Empfehlungs-Score heranziehen
            const slots = ['Maske', 'Rucksack', 'Weste', 'Handschuhe', 'Holster', 'Knieschoner'];
            let chc = 0, chd = 0, coyote = false, missing = [];
            slots.forEach(s => {
                const cands = gearInventory.filter(g => g.slot === s);
                if (!cands.length) { missing.push(s); return; }
                let best = null;
                cands.forEach(g => { const sc = gearItemScore(g).score; if (!best || sc > best.sc) best = { g, sc }; });
                chc += best.g.chc || 0;
                chd += best.g.chd || 0;
                if ((best.g.setName || '').toLowerCase().includes("coyote")) coyote = true;
            });
            if (coyote) { chc += 10; chd += 10; }
            const shdMaxEl = document.getElementById('shdMax');
            const shdOn = shdMaxEl && shdMaxEl.checked;
            if (shdOn) { chc += 10; chd += 20; }

            // Alle 4 Aufteilungen der 3 Mod-Plätze durchprobieren
            let bestN = 0, bestE = -1, bestCapped = 60;
            for (let n = 0; n <= 3; n++) {
                const c = chc + n * 6;
                const d = chd + (3 - n) * 12;
                const p = Math.min(c, 60) / 100;
                const e = (1 - p) + p * (1 + d / 100);
                if (e > bestE) { bestE = e; bestN = n; bestCapped = Math.min(c, 60); }
            }
            const chdN = 3 - bestN;
            const totalChc = chc + bestN * 6;
            const overCap = totalChc > 60;

            const reason = overCap
                ? `Achtung: Mit ${bestN}× CHC wärst du bei ${formatGermanNumber(totalChc)}% – über dem 60%-Cap. Der Optimierer rechnet mit dem gecappten Wert; überschüssige CHC-Attribute solltest du idealerweise gegen CHD/WD tauschen.`
                : `Marginaler Gewinn pro Mod: +6% CHC → Ø +${formatGermanNumber(0.06 * (chd + chdN * 12))}% (6% × CHD ${formatGermanNumber(chd + chdN * 12)}%), +12% CHD → Ø +${formatGermanNumber(0.12 * Math.min(chc + bestN * 6, 60))}% (12% × CHC ${formatGermanNumber(Math.min(chc + bestN * 6, 60))}%).`;

            el.innerHTML = `
                <p class="text-xs font-bold uppercase text-div-accent">🔧 Automatische Mod-Empfehlung (Gear-Mod-Plätze: CHC vs. CHD)</p>
                <p class="text-sm text-gray-200">
                    Empfohlen: <strong class="text-emerald-400">${bestN}× CHC-Mod (+6%)</strong> und <strong class="text-div-accent">${chdN}× CHD-Mod (+12%)</strong>
                    &nbsp;·&nbsp; resultierend: CHC <strong>${formatGermanNumber(bestCapped)}%</strong>${overCap ? ' <span class="text-amber-400">(gecappt)</span>' : ''} / CHD <strong>${formatGermanNumber(chd + chdN * 12)}%</strong>
                </p>
                <p class="text-xs text-gray-400">${reason}</p>
                <p class="text-[11px] text-gray-500">Basis: bestes Inventar-Teil je Slot${shdOn ? ' + SHD-Uhr (10% CHC / 20% CHD)' : ''}${coyote ? " + Coyote's Mask (+10% CHC/+10% CHD)" : ''}${missing.length ? ` · ohne Daten für: ${missing.join(', ')}` : ''}. In der kombinierten Optimierung wird die Aufteilung zusätzlich pro Build exakt berechnet.</p>
            `;
        }

        function gearCritChanceAssumption() {
            const el = document.getElementById('gearCritChanceAssumption');
            let v = el ? parseLocalizedFloat(el.value) : 60;
            if (isNaN(v) || v < 0 || v > 60) v = 60;
            return v / 100;
        }

        // Attribut-Profil eines Teils: welche zweiten Attribute sind aktiv.
        // Nur Teile mit identischem Profil derselben Marke werden verglichen
        // (Striker Maske CHC vs. Striker Maske CHD wäre unvollständig).
        function gearAttrProfile(item) {
            const parts = gearItemAttrs(item).filter(a => a.val > 0).map(a => a.type.toUpperCase()).sort();
            if (item.namedKey) parts.push(item.namedKey.toUpperCase());
            return parts.join('+') || 'nur WD';
        }

        function gearGroupKey(item) {
            return `${item.setName}|${item.slot}|${gearAttrProfile(item)}|${gearCoreTypeOf(item)}`;
        }

        // Score = (1 + WD) × (1 + KritChance-Annahme × CHD) × Named-Multiplikatoren.
        // Beispiel (60% Annahme): WD 10%/CHD 18% -> 1.10 × 1.108 = 1.219;
        // WD 18.5%/CHD 14% -> 1.185 × 1.084 = 1.285 => Zweiteres ist besser.
        // ===== Gegnerprofil (v32) =====
        // Gewichtet DTA (Ruestung), DTH (Lebensenergie) und DTToOC
        // (ungedeckt) nach den Annahmen aus den Einstellungen.
        function enemyProfile() {
            const readVal = (id) => {
                const el = document.getElementById(id);
                let v = el ? parseLocalizedFloat(el.value) : NaN;
                if (isNaN(v) || v < 0) v = 0;
                if (v > 100) v = 100;
                return v / 100;
            };
            let armor = readVal('enemyArmorShareInput');
            let health = readVal('enemyHealthShareInput');
            const ooc = readVal('enemyOocShareInput');
            // Kopfschuss-Anteil (#108): Anteil der Treffer, die auf den Kopf
            // treffen. 0% = Bodyshots only (HSD wirkungslos), 100% = reiner
            // Scharfschuetzen-Betrieb. Unabhaengig von Armor/Health-Summe.
            let headshot = readVal('headshotShareInput');
            if (isNaN(headshot) || headshot < 0) headshot = 0;
            // Armor + Health sollen zusammen 100% ergeben -> automatisch normieren
            if (armor + health <= 0) { armor = 0.8; health = 0.2; }
            const sum = armor + health;
            armor = armor / sum;
            health = 1 - armor;
            return { armor: armor, health: health, ooc: ooc, headshot: headshot };
        }

        // Slider + Zahlenfelder fuer Gegnerprofil synchron halten.
        // Ruestung und Lebensenergie ergaenzen sich auf 100%.
        function syncEnemySliders(which) {
            const get = (id) => {
                const el = document.getElementById(id);
                let v = el ? parseLocalizedFloat(el.value) : NaN;
                if (isNaN(v) || v < 0) v = 0;
                if (v > 100) v = 100;
                return Math.round(v);
            };
            const set = (id, v) => {
                const slider = document.getElementById(id);
                const field = document.getElementById(id + 'Input');
                if (slider) slider.value = v;
                if (field) field.value = v;
            };
            if (which === 'armor') {
                const a = get('enemyArmorShare');
                set('enemyArmorShare', a);
                set('enemyHealthShare', 100 - a);
            } else if (which === 'health') {
                const h = get('enemyHealthShare');
                set('enemyHealthShare', h);
                set('enemyArmorShare', 100 - h);
            } else if (which === 'headshot') {
                // Quelle ist das Eingabefeld (idInput), wie bei den oninput-
                // Handlern der anderen Anteile; der Slider wird mitgesetzt.
                const h = get('headshotShareInput');
                set('headshotShare', h);
                set('headshotShareInput', h);
            } else {
                set('enemyOocShare', get('enemyOocShare'));
            }
            // Inventar-Empfehlungen neu bewerten, Vergleich als veraltet markieren
            if (typeof renderGearInventory === 'function') renderGearInventory();
            markComparisonStale();
        }

        function gearItemScore(item, weaponTypeOverride) {
            const crit = gearCritChanceAssumption();
            // Named-Zusatzwerte wie im Build-Optimierer: wd -> additiv WD, chcchd -> CHC+CHD
            const namedWd = item.namedKey === 'wd' ? (item.namedVal || 0) : 0;
            const namedChd = item.namedKey === 'chcchd' ? (item.namedVal || 0) : 0;
            // v36: Westen-/Rucksack-Talente im Score berücksichtigen (nur
            // unbedingte, damit der Vorfilter bedingte Boni nicht überbewertet).
            // Glaskanone (+25% Verstärker) zählt damit beim Scoring und in
            // der Vorauswahl statt stillschweigend verloren zu gehen.
            const gt = (item.talent && typeof GEAR_TALENTS !== 'undefined') ? GEAR_TALENTS[item.talent] : null;
            const gtActive = gt && !gt.conditional;
            const gtWd = (gtActive && gt.type === 'wd') ? (gt.value || 0) : 0;
            const gtAmp = (gtActive && gt.type === 'amp') ? (gt.value || 0) : 0;
            // Issue #41-Follow-up: Exoten-Perk im Score berücksichtigen,
            // damit die Vorauswahl Exoten verdient wählt (Perks aktiv =>
            // Boni wie im Build-Cache; sonst neutral). Bedingte Perks gelten
            // analog „Bedingte Talente aktiv“ als aktiv.
            const exo = (typeof exoticPerkScoreBonus === 'function') ? exoticPerkScoreBonus(item) : null;
            const exoWd = exo ? exo.wd : 0;
            const exoChd = exo ? exo.chd : 0;
            const exoChc = exo ? exo.chc : 0;
            const exoAmp = exo ? exo.amp : 0;
            const exoRof = exo ? exo.rof : 0;
            const effWd = (item.wd || 0) + namedWd + gtWd + exoWd;
            const effChd = (item.chd || 0) + namedChd + exoChd;
            const wdMult = 1 + effWd / 100;
            const critMult = 1 + crit * (effChd / 100);
            let namedMult = 1;
            if (item.namedKey === 'dta' || item.namedKey === 'dttooc' || item.namedKey === 'dth') {
                // v32: Gegnerprofil gewichtet DTA/DTH/DTToOC (Ruestungs-, LP- und Ungedeckt-Anteil)
                const ep = enemyProfile();
                if (item.namedKey === 'dta') namedMult *= 1 + ((item.namedVal || 0) / 100) * ep.armor;
                else if (item.namedKey === 'dth') namedMult *= 1 + ((item.namedVal || 0) / 100) * ep.health;
                else if (item.namedKey === 'dttooc') namedMult *= 1 + ((item.namedVal || 0) / 100) * ep.ooc;
            }
            const exoChcMult = 1 + exoChc / 100;
            let score = wdMult * critMult * namedMult * (1 + gtAmp / 100) * (1 + exoAmp / 100) * (1 + exoRof / 100) * exoChcMult * 100;
            const parts = [`${gearCoreDisplay(item)}${namedWd ? ' + Named ' + formatGermanNumber(namedWd) + '%' : ''}`];
            if (item.namedKey === 'hsd' && item.namedVal > 0) parts.push(`HSD +${formatGermanNumber(item.namedVal)}% (kein Schadensbeitrag im Score)`);
            if (effChd > 0) {
                parts.push(`Krit-Erw. +${formatGermanNumber(crit * effChd)}% (CHD ${formatGermanNumber(effChd)}% × ${formatGermanNumber(crit * 100)}%)`);
            }
            if (item.chc > 0) {
                parts.push(`CHC ${formatGermanNumber(item.chc)}% (kein Schadensbeitrag bei fester Krit-Chance-Annahme)`);
            }
            const others = gearOtherAttrsText(item);
            if (others) parts.push(`${others} (kein Schadensbeitrag im Score)`);
            if (namedMult > 1) {
                parts.push(`Named ×${formatGermanNumber(namedMult)}`);
            }
            if (gtWd > 0) parts.push(`Talent ${gt.label}: +${formatGermanNumber(gtWd)}% WD (unbedingt)`);
            if (gtAmp > 0) parts.push(`Talent ${gt.label}: +${formatGermanNumber(gtAmp)}% Verstärker ×${formatGermanNumber(1 + gtAmp / 100)}`);
            if (exo) {
                const exoParts = [];
                if (exoWd) exoParts.push(`+${formatGermanNumber(exoWd)}% WD`);
                if (exoChc) exoParts.push(`+${formatGermanNumber(exoChc)}% CHC`);
                if (exoChd) exoParts.push(`+${formatGermanNumber(exoChd)}% CHD`);
                if (exoAmp) exoParts.push(`+${formatGermanNumber(exoAmp)}% Verstärker`);
                if (exoRof) exoParts.push(`+${formatGermanNumber(exoRof)}% RPM`);
                if (exoParts.length) parts.push(`Exoten-Perk ${item.setName}: ${exoParts.join(' & ')}`);
            }
            if (gt && gt.conditional) parts.push(`Talent ${gt.label}: bedingt (${gt.condition || 'Bedingung'}) – kein Schadensbeitrag im Score`);
            // v32: Marken-Waffenschaden der Ziel-Gattung einrechnen,
            // damit Empfehlung & Vorauswahl markenbewusst vergleichen
            // (z.B. Fenris/Unit Alloys bei AR, Petrov bei LMG, Walker generell).
            // Named-Teile mit multiplikativen Boni (DTA/DTToOC/DTH) bleiben
            // daneben weiter berechtigt - deren namedMult bleibt unangetastet.
            let twt = weaponTypeOverride;
            if (!twt && typeof document !== 'undefined') {
                const twtEl = document.getElementById('targetWeaponType');
                if (twtEl) twt = twtEl.value;
            }
            if (twt) {
                const brandBonus = brandWeaponDamageBonusPct(item, twt);
                if (brandBonus > 0) {
                    score = score * (1 + brandBonus / 100);
                    parts.push(`Markenbonus ${twt}: +${formatGermanNumber(brandBonus)}% Waffenschaden -> Score x${formatGermanNumber(1 + brandBonus / 100)}`);
                }
            }
            return { score: score, detail: parts.join("; ") };
        }

        // Strukturierte Empfehlung analog gearsetRecommendation() bei Waffen.
        function gearRecommendation(item) {
            const my = gearItemScore(item);
            const profile = gearAttrProfile(item);
            const competitors = (gearInventory || []).filter(g => gearGroupKey(g) === gearGroupKey(item));
            if (competitors.length < 2) {
                return {
                    tier: 'unique', label: '— einziges', score: my.score,
                    detail: `Einziges ${item.setName}-Teil (${item.slot}) mit Profil "${profile}" – kein Vergleich möglich. ${my.detail}`,
                    colorClass: 'text-gray-500'
                };
            }
            let best = null;
            competitors.forEach(g => {
                const s = gearItemScore(g).score;
                if (!best || s > best.score) best = { name: `${g.setName} (${g.slot})`, score: s };
            });
            if (my.score >= best.score) {
                return {
                    tier: 'top', label: '★ Top', score: my.score,
                    detail: `Stärkstes ${item.setName}-Teil im Slot ${item.slot} mit Profil "${profile}" (Score ${formatGermanNumber(my.score)}). ${my.detail}`,
                    colorClass: 'text-emerald-400'
                };
            }
            const pct = (1 - my.score / best.score) * 100;
            const detail = `${formatGermanNumber(pct)}% schwächer als ${best.name}. ${my.detail}`;
            if (pct < 5) {
                return { tier: 'ok', label: `◐ −${formatGermanNumber(pct)}%`, score: my.score, detail: detail, colorClass: 'text-amber-400' };
            }
            return { tier: 'weak', label: `✕ −${formatGermanNumber(pct)}%`, score: my.score, detail: detail, colorClass: 'text-red-400' };
        }

        // Standard-Richtung pro Spalte: Textspalten aufsteigend, Zahlen absteigend.
        const gearColumnSortDefaults = {
            slot: true, setName: true,
            chc: false, chd: false, wd: false, recoScore: false
        };
        // Zuordnung Spalte -> Dropdown-Option im Kopfbereich (nur bei Standard-Richtung).
        const gearColumnToDropdownOption = {
            slot: 'slot', setName: 'setName',
            chc: 'chcDesc', chd: 'chdDesc', wd: 'wdDesc', recoScore: 'recoDesc'
        };

        function sortGearByColumn(field) {
            if (currentGearSortField === field) {
                currentGearSortAsc = !currentGearSortAsc;
            } else {
                currentGearSortField = field;
                currentGearSortAsc = gearColumnSortDefaults[field] !== false;
            }
            const dropdownOption = gearColumnToDropdownOption[field];
            const sortSelect = document.getElementById('gearSortCriteria');
            if (sortSelect && dropdownOption) {
                const matchesDefaultDirection = gearColumnSortDefaults[field] !== false
                    ? currentGearSortAsc
                    : !currentGearSortAsc;
                if (matchesDefaultDirection) sortSelect.value = dropdownOption;
            }
            renderGearInventory();
        }

        // Aktualisiert die Pfeil-Symbole (▲/▼) in den Tabellenköpfen des
        // Ausrüstungs-Inventars, passend zum aktuellen Sortierfeld/-richtung.
        function updateGearSortHeaderIcons() {
            const fields = ['slot', 'setName', 'chc', 'chd', 'wd', 'recoScore'];
            fields.forEach(f => {
                const icon = document.getElementById('gSortIcon-' + f);
                if (!icon) return;
                if (currentGearSortField === f) {
                    icon.textContent = currentGearSortAsc ? ' ▲' : ' ▼';
                } else {
                    icon.textContent = '';
                }
            });
        }

        function sortAndRenderGear() {
            const val = document.getElementById('gearSortCriteria').value;
            if (val === 'slot') {
                currentGearSortField = 'slot';
                currentGearSortAsc = true;
            } else if (val === 'setName') {
                currentGearSortField = 'setName';
                currentGearSortAsc = true;
            } else if (val === 'chcDesc') {
                currentGearSortField = 'chc';
                currentGearSortAsc = false;
            } else if (val === 'chdDesc') {
                currentGearSortField = 'chd';
                currentGearSortAsc = false;
            } else if (val === 'wdDesc') {
                currentGearSortField = 'wd';
                currentGearSortAsc = false;
            } else if (val === 'recoDesc') {
                currentGearSortField = 'recoScore';
                currentGearSortAsc = false;
            }
            renderGearInventory();
        }

        function renderGearInventory() {
            if (typeof renderExoticPerkList === 'function') renderExoticPerkList();
            if (typeof updateForceExoticOptions === 'function') updateForceExoticOptions();
            updateGearSetFilterOptions();
            updateGearModAdvice();
            const slotFilter = document.getElementById('gearSlotFilter')?.value || '';
            const setFilter = document.getElementById('gearSetFilter')?.value || '';
            const recoFilter = document.getElementById('gearRecoFilter')?.value || '';
            let filteredInventory = slotFilter ? gearInventory.filter(i => i.slot === slotFilter) : [...gearInventory];
            if (setFilter) filteredInventory = filteredInventory.filter(i => i.setName === setFilter);

            // Empfehlung vorab berechnen (für Filter und Sortierung)
            filteredInventory.forEach(item => {
                item._reco = gearRecommendation(item);
                item._recoScore = item._reco.score;
            });
            if (recoFilter === 'unique') {
                filteredInventory = filteredInventory.filter(i => i._reco.tier === 'unique');
            } else if (recoFilter) {
                filteredInventory = filteredInventory.filter(i => i._reco.tier === recoFilter);
            }

            const sortedInventory = [...filteredInventory];
            sortedInventory.sort((a, b) => {
                const gearSortVal = (it) => currentGearSortField === 'wd' ? (it.coreVal != null ? it.coreVal : it.wd) : it[currentGearSortField];
                let valA = currentGearSortField === 'recoScore' ? a._recoScore : gearSortVal(a);
                let valB = currentGearSortField === 'recoScore' ? b._recoScore : gearSortVal(b);

                if (typeof valA === 'string') {
                    valA = valA.toLowerCase();
                    valB = valB.toLowerCase();
                    if (valA < valB) return currentGearSortAsc ? -1 : 1;
                    if (valA > valB) return currentGearSortAsc ? 1 : -1;
                    return 0;
                } else {
                    return currentGearSortAsc ? valA - valB : valB - valA;
                }
            });

            const tbody = document.getElementById('gearTableBody');
            tbody.innerHTML = '';

            sortedInventory.forEach(item => {
                let namedBadge = '-';
                if (item.namedKey && item.namedVal > 0) {
                    let labelName = item.namedKey.toUpperCase();
                    if (item.namedKey === 'dta') labelName = 'Rüstungsschaden (DTA)';
                    else if (item.namedKey === 'dttooc') labelName = 'Ungedeckt (DTToOC)';
                    else if (item.namedKey === 'dth') labelName = 'Lebensenergie (DTH)';
                    else if (item.namedKey === 'hsd') labelName = 'Kopfschuss (HSD)';
                    else if (item.namedKey === 'chcchd') labelName = 'CHC/CHD';
                    else if (item.namedKey === 'armorregen') labelName = 'Rüstungsreg.';
                    namedBadge = `<span class="px-2 py-0.5 bg-orange-950/80 border border-orange-500/40 text-orange-300 text-[11px] rounded">${labelName}: +${formatGermanNumber(item.namedVal)}%</span>`;
                }

                const reco = item._reco || gearRecommendation(item);
                const recoCell = `<div class="font-bold ${reco.colorClass}" title="${escapeHtml(reco.detail)}">${reco.label}</div>`;

                const tr = document.createElement('tr');
                tr.className = 'hover:bg-zinc-800/50 border-t border-gray-800';
                tr.innerHTML = `
                    <td class="p-3 font-medium text-white">${item.slot}</td>
                    <td class="p-3 font-semibold text-div-accent">${item.setName}${gearRarityBadges(item)}${item.proto ? protoBadge() : ''}${item.talent && GEAR_TALENTS[item.talent] ? ` <span class="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-sky-950/80 border border-sky-500/40 text-sky-300 font-normal" title="${escapeHtml(GEAR_TALENTS[item.talent].note || '')}">${escapeHtml(GEAR_TALENTS[item.talent].label)}</span>` : ''}${gearOtherAttrsText(item) ? `<div class="text-[11px] font-normal text-gray-400">${gearOtherAttrsText(item)}</div>` : ''}</td>
                    <td class="p-3 text-center font-mono">${formatGermanNumber(item.chc)}%</td>
                    <td class="p-3 text-center font-mono">${formatGermanNumber(item.chd)}%</td>
                    <td class="p-3 text-center font-mono">${gearCoreDisplay(item)}</td>
                    <td class="p-3 text-center">${namedBadge}</td>
                    <td class="p-3 text-center">${recoCell}</td>
                    <td class="p-3 text-right">
                        <div class="flex justify-end gap-1">
                            <button onclick="startEditGearItem(${item.id})" class="text-sky-400 hover:text-sky-300 p-1" title="Bearbeiten">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5h2m-2 0v14H5V5h6zm10 0v14h-7V5h7z"></path>
                                </svg>
                            </button>
                            <button onclick="deleteGearItem(${item.id})" class="text-red-400 hover:text-red-300 p-1" title="Entfernen">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            if (sortedInventory.length === 0 && (slotFilter || setFilter)) {
                const tr = document.createElement('tr');
                const parts = [];
                if (slotFilter) parts.push(`Slot "${escapeHtml(slotFilter)}"`);
                if (setFilter) parts.push(`Set "${escapeHtml(setFilter)}"`);
                tr.innerHTML = `<td colspan="8" class="p-6 text-center text-gray-400">Keine Items für ${parts.join(' + ')} vorhanden.</td>`;
                tbody.appendChild(tr);
            }

            const isFiltered = Boolean(slotFilter || setFilter || recoFilter);
            document.getElementById('gearInventoryCount').textContent = isFiltered
                ? `${sortedInventory.length} von ${gearInventory.length} Items`
                : `${gearInventory.length} Items`;

            // v35: Kern-Verteilung des Inventars anzeigen
            const coreCounterEl = document.getElementById('gearCoreCounter');
            if (coreCounterEl) {
                const cc = { wd: 0, armour: 0, skill: 0 };
                let tierSum = 0;
                gearInventory.forEach(i => { cc[gearCoreTypeOf(i)]++; tierSum += gearSkillTiersOf(i); });
                coreCounterEl.textContent = gearInventory.length
                    ? `Kern-Verteilung: 🔴 ${cc.wd}× WD · 🔵 ${cc.armour}× Rüstung · 🟡 ${cc.skill}× Fertigkeitsrang${cc.skill ? ` (Σ ${formatGermanNumber(tierSum)} Stufen${tierSum >= 6 ? ' ✅' : ''})` : ''}`
                    : '';
            }

            const gIcon = document.getElementById('gSortIcon-recoScore');
            if (gIcon) gIcon.textContent = currentGearSortField === 'recoScore' ? (currentGearSortAsc ? ' ▲' : ' ▼') : '';
            updateGearSortHeaderIcons();
            if (typeof updateSetAvailability === 'function') updateSetAvailability();
        }

        function exportGearCSV() {
            if (gearInventory.length === 0) {
                showToast('Keine Ausrüstung zum Exportieren vorhanden.', 'error');
                return;
            }
            let csv = "Slot;Set;CHC;CHD;WD;NamedKey;NamedVal;Attr1;Attr1Val;Attr2;Attr2Val;Prototyp;Talent;Core;CoreVal\n";
            gearInventory.forEach(i => {
                csv += `${i.slot};${i.setName};${formatGermanNumber(i.chc)};${formatGermanNumber(i.chd)};${formatGermanNumber(i.wd)};${i.namedKey || ''};${formatGermanNumber(i.namedVal || 0)};${(gearItemAttrs(i)[0] || {}).type || ''};${formatGermanNumber((gearItemAttrs(i)[0] || {}).val || 0)};${(gearItemAttrs(i)[1] || {}).type || ''};${formatGermanNumber((gearItemAttrs(i)[1] || {}).val || 0)};${i.proto ? 1 : 0};${i.talent || ''};${gearCoreTypeOf(i)};${formatGermanNumber(i.coreVal != null ? i.coreVal : (gearCoreTypeOf(i) === 'wd' ? i.wd : gearCoreDefaultVal(gearCoreTypeOf(i), !!i.proto)))}\n`;
            });

            const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `div2_gear_${new Date().toISOString().slice(0,10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Ausrüstungs-Inventar exportiert!', 'success');
        }

        function importGearCSV(event) {
            gearCsvSkipped = [];
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                const text = e.target.result;
                const lines = text.split(/\r\n|\n/);
                let importedCount = 0;
                let dupCount = 0;
                const batch = [];

                lines.forEach((line, index) => {
                    if (index === 0 || !line.trim()) return;
                    const delimiter = line.includes(';') ? ';' : ',';
                    const parts = line.split(delimiter);
                    if (parts.length >= 5) {
                        const gi = gearItemFromCsvParts(parts);
                        if (!gi) return;
                        // Duplikate überspringen (bereits im Inventar ODER in dieser Datei)
                        if (isDuplicateGearItem(gi, batch)) {
                            dupCount++;
                            gearCsvSkipped.push(`${gi.setName} (${gi.slot}): Duplikat`);
                            return;
                        }
                        batch.push(gi);
                        gearInventory.push(gi);
                        importedCount++;
                    }
                });

                saveToLocalStorage();
                renderGearInventory();
                updateTabUI();
                markComparisonStale();
                showToast(`${importedCount} Ausrüstungsgegenstände importiert!` +
                    (dupCount ? ` ⚠️ ${dupCount} Duplikat(e) übersprungen` : '') +
                    (gearCsvSkipped.length ? ` ⚠️ ${gearCsvSkipped.length} übersprungen: ` + gearCsvSkipped.slice(0, 3).join(' | ') : ''),
                    (gearCsvSkipped.length || dupCount) ? 'error' : 'success');
                event.target.value = '';
            };
            reader.readAsText(file, 'UTF-8');
        }

        function loadDefaultGear() {
            // Bugfix: Laufende Bearbeitung abbrechen, bevor das Inventar ersetzt
            // wird – sonst bleibt die Bearbeitungsmarkierung auf einer Teil-Nummer
            // hängen, die danach einem anderen Teil gehört.
            if (editGearId !== null) {
                editGearId = null;
                setGearEditUi(false);
            }
            gearInventory = [
                { id: 1, slot: 'Maske', setName: 'Striker', chc: 6, chd: 12, wd: 15, namedKey: '', namedVal: 0 },
                { id: 2, slot: 'Rucksack', setName: 'Striker', chc: 6, chd: 12, wd: 15, namedKey: '', namedVal: 0 },
                { id: 3, slot: 'Weste', setName: 'Striker', chc: 6, chd: 12, wd: 15, namedKey: '', namedVal: 0 },
                { id: 4, slot: 'Handschuhe', setName: 'Striker', chc: 6, chd: 12, wd: 15, namedKey: '', namedVal: 0 },
                { id: 5, slot: 'Holster', setName: 'Ceska', chc: 6, chd: 12, wd: 15, namedKey: '', namedVal: 0 },
                { id: 6, slot: 'Knieschoner', setName: 'Grupo Shadow', chc: 6, chd: 12, wd: 15, namedKey: '', namedVal: 0 },
                { id: 7, slot: 'Knieschoner', setName: 'Fox\'s Prayer', chc: 0, chd: 12, wd: 15, namedKey: 'dttooc', namedVal: 8, attrs: [{ type: 'chd', val: 12 }], proto: false },
                { id: 8, slot: 'Handschuhe', setName: 'Contractor\'s Gloves', chc: 0, chd: 12, wd: 15, namedKey: 'dta', namedVal: 8, attrs: [{ type: 'chd', val: 12 }], proto: false },
                { id: 9, slot: 'Holster', setName: 'Picaro\'s Holster', chc: 0, chd: 12, wd: 0, namedKey: 'wd', namedVal: 10, attrs: [{ type: 'chd', val: 12 }], proto: false }
            ];
            gearIdCounter = 10;
            saveToLocalStorage();
            renderGearInventory();
            updateTabUI();
            markComparisonStale();
            showToast('Standard-Ausrüstung geladen!', 'success');
        }

        // ========== VERGLEICHSANSICHT ==========
        // ========== BUILD-CACHE (PERFORMANCE, 2. Optimierungsschritt) ==========
        // Bündelt alle WAFFENUNABHÄNGIGEN Effekte eines Builds: Attribut-Summen,
        // Named-Item-Boni, Set-/4p-Stack-Boni und Marken-Boni. Wird einmal pro
        // Build vorausberechnet und für alle Kandidaten-Waffen wiederverwendet,
        // statt die Count-/String-Logik für jede Waffe×Build-Kombination erneut
        // auszuführen (bringt grob Faktor "Anzahl der Waffen" an Rechenzeit).
        function computeBuildCache(build, settings) {
            const targetGreenSet = settings.targetGreenSet;
            const targetWeaponType = settings.targetWeaponType;
            // Attribut-Summen aus gearItemAttrs: Nutzt das attrs-Array, wenn
            // vorhanden (synthetische BiS-Teile, DB-Import), sonst die
            // Legacy-Felder chc/chd. Echte Teile speichern beides mit
            // identischen Werten - gearItemAttrs verhindert Doppelzaehlung.
            const attrSumOf = (type) => build.reduce((sum, i) => sum + gearItemAttrs(i)
                .filter(a => a.type === type && a.val > 0)
                .reduce((x, a) => x + a.val, 0), 0);
            const cache = {
                buildChc: attrSumOf('chc'),
                buildChd: attrSumOf('chd'),
                buildDta: attrSumOf('dta'),
                buildDttooc: attrSumOf('dttooc'),
                buildDth: attrSumOf('dth'),
                buildHsd: attrSumOf('hsd'),
                buildRof: attrSumOf('rof'),
                buildWh: attrSumOf('wh'),
                buildWd: build.reduce((s, i) => s + (i.wd || 0) + (gearIsTriCoreItem(i) && gearCoreTypeOf(i) !== 'wd' ? (i.proto ? 22.5 : 15) : 0), 0) + attrSumOf('wd'),
                buildSkillTiers: build.reduce((s, i) => s + gearSkillTiersOf(i), 0),
                buildArmorCores: build.reduce((s, i) => s + (gearCoreTypeOf(i) === 'armour' || gearIsTriCoreItem(i) ? 1 : 0), 0),
                named: { wd: 0, chc: 0, chd: 0, dta: 0, dttooc: 0, dth: 0 },
                delta: { wd: 0, chc: 0, chd: 0, rof: 0, dta: 0, dttooc: 0, dth: 0, amp: 0, wh: 0 },
                boni: [],
                targetSetCount: 0,
                stackInfo: null
            };
            const d = cache.delta;

            // Named-Item-Boni der Teile
            build.forEach(item => {
                if (item.namedKey && item.namedVal > 0) {
                    const n = cache.named;
                    if (item.namedKey === 'dta') n.dta += item.namedVal;
                    else if (item.namedKey === 'dttooc') n.dttooc += item.namedVal;
                    else if (item.namedKey === 'dth') n.dth += item.namedVal;
                    else if (item.namedKey === 'chcchd') { n.chc += item.namedVal; n.chd += item.namedVal; }
                    else if (item.namedKey === 'wd') n.wd += item.namedVal;
                }
            });

            // v35: Kern-Verteilung des Builds ausweisen (inkl. Techniker-Bonus)
            if (cache.buildSkillTiers > 0) {
                const techTier = (settings && settings.specialization === 'technician') ? 1 : 0;
                const tierTotal = cache.buildSkillTiers + techTier;
                cache.boni.push(`🟡 Kern: ${formatGermanNumber(cache.buildSkillTiers)} Fertigkeitsstufe(n)${techTier ? ' + 1 (Techniker)' : ''} = Tier ${formatGermanNumber(tierTotal)}${tierTotal >= 6 ? ' ✅ 6 Cores erreicht' : ''}`);
            }
            if (cache.buildArmorCores > 0) cache.boni.push(`🔵 Kern: ${cache.buildArmorCores}× Rüstungs-Core`);

            // Set-Boni (2p/3p/4p)
            const gsInfo = GREEN_SET_INFO[targetGreenSet];
            const targetSetCount = getBrandCount(build, targetGreenSet);
            cache.targetSetCount = targetSetCount;
            [2, 3].forEach(tier => {
                if (targetSetCount < tier) return;
                const tierBonuses = (gsInfo.bonuses && gsInfo.bonuses[String(tier)]) || [];
                let bonusText = gsInfo['n' + tier] || '';
                const appliedParts = [];
                tierBonuses.forEach(b => {
                    const isScore = ['wd', 'chc', 'chd', 'hsd', 'dta', 'dth', 'rof', 'wh'].includes(b.attr);
                    const weaponOk = !b.weapon || b.weapon === targetWeaponType;
                    if (isScore && weaponOk) {
                        d[b.attr] += b.val;
                        appliedParts.push(`${b.val}${b.weapon ? ' (' + b.weapon + ')' : ''}% ${b.attr}`);
                    }
                });
                if (appliedParts.length) cache.boni.push(`${gsInfo.name} ${tier}p (${bonusText}) [angewendet: ${appliedParts.join(', ')}]`);
                else cache.boni.push(`${gsInfo.name} ${tier}p (${bonusText})`);
            });
            if (targetSetCount >= 4) cache.boni.push(`${gsInfo.name} 4p (${gsInfo.n4})`);

            // 4p-Stack-Schaden (z.B. Striker's Gamble) inkl. Westen-/Rucksack-Talent
            const stackConf = STACK_DAMAGE_CONFIG[targetGreenSet];
            if (targetSetCount >= 4 && stackConf) {
                // Stacks können WD (Striker, Heartbreaker), CHD (Tipping
                // Scales, Umbra), RPM (Umbra) oder Kombinationen erhöhen.
                let perStackWd = stackConf.perStackWd || 0;
                let perStackChd = stackConf.perStackChd || 0;
                let perStackRof = stackConf.perStackRof || 0;
                let perStackWh = stackConf.perStackWh || 0;
                let flatAmp = stackConf.flatAmp || 0;
                if (stackConf.flatAmpByWeapon && targetWeaponType in stackConf.flatAmpByWeapon) flatAmp = stackConf.flatAmpByWeapon[targetWeaponType];
                let maxStacks = stackConf.maxStacks;
                const hasSetChest = build.some(i => i.slot === 'Weste' && brandKeyMatches((i.setName || '').toLowerCase(), targetGreenSet));
                const hasSetBackpack = build.some(i => i.slot === 'Rucksack' && brandKeyMatches((i.setName || '').toLowerCase(), targetGreenSet));
                const chestT = stackConf.chestTalent;
                const bpT = stackConf.backpackTalent;
                if (hasSetChest && chestT && chestT.maxStacks) maxStacks = chestT.maxStacks;
                if (hasSetBackpack && bpT && bpT.perStackWd) perStackWd = bpT.perStackWd;
                if (hasSetBackpack && bpT && bpT.perStackChd) perStackChd = bpT.perStackChd;
                if (hasSetBackpack && bpT && bpT.perStackRof) perStackRof = bpT.perStackRof;
                if (hasSetBackpack && bpT && bpT.perStackWh) perStackWh = bpT.perStackWh;
                if (hasSetChest && chestT && chestT.flatAmp) flatAmp = chestT.flatAmp;
                else if (hasSetChest && chestT && chestT.ampMult) flatAmp = flatAmp * chestT.ampMult;
                // Stack-Auslastung (Einstellung, Standard 100% = volle Stacks)
                let utilization = parseLocalizedFloat(document.getElementById('stackUtilization')?.value, 100);
                if (utilization < 0) utilization = 100;
                if (utilization > 100) utilization = 100;
                let stacks = Math.round(maxStacks * (utilization / 100));
                const stackWd = stacks * perStackWd;
                const stackChd = stacks * perStackChd;
                const stackRof = stacks * perStackRof;
                const stackWh = stacks * perStackWh;
                const stackWdTotal = stacks * perStackWd;
                if (stackWdTotal > 0 || stackChd > 0 || stackRof > 0 || flatAmp > 0 || stackWh > 0) {
                    if (stackWdTotal > 0) d.wd += stackWdTotal;
                    if (stackChd > 0) d.chd += stackChd;
                    if (stackRof > 0) d.rof += stackRof;
                    if (stackWh > 0) d.wh += stackWh;
                    if (flatAmp > 0) d.amp += flatAmp;
                    cache.stackInfo = {
                        name: stackConf.name,
                        stacks: stacks,
                        maxStacks: maxStacks,
                        perStackWd: perStackWd,
                        perStackChd: perStackChd,
                        perStackRof: perStackRof,
                        perStackWh: perStackWh,
                        perStack: perStackWd || perStackChd,
                        attr: (perStackWd > 0 && perStackChd > 0) ? 'wd+chd' : (perStackChd > 0 ? 'chd' : 'wd'),
                        flatAmp: flatAmp,
                        wd: stackWdTotal,
                        chd: stackChd,
                        rof: stackRof,
                        wh: stackWh,
                        hasChest: hasSetChest,
                        hasBackpack: hasSetBackpack
                    };
                    const talentParts = [];
                    if (hasSetChest && chestT) talentParts.push(chestT.label + (chestT.maxStacks || chestT.marks ? '' : ''));
                    if (hasSetBackpack && bpT && (bpT.perStackWd || bpT.perStackChd || bpT.perStackRof || bpT.perStackWh)) talentParts.push(bpT.label);
                    if (hasSetChest && chestT && chestT.flatAmp) talentParts.push(chestT.label);
                    if (hasSetChest && chestT && chestT.ampMult) talentParts.push(chestT.label);
                    const unitParts = [];
                    if (flatAmp > 0) unitParts.push(`+${formatGermanNumber(flatAmp)}% verstärkter Schaden`);
                    if (stackWd > 0) unitParts.push(`+${formatGermanNumber(stackWd)}% WD`);
                    if (stackChd > 0) unitParts.push(`+${formatGermanNumber(stackChd)}% CHD`);
                    if (stackRof > 0) unitParts.push(`+${formatGermanNumber(stackRof)}% RPM`);
                    if (stackWh > 0) unitParts.push(`+${formatGermanNumber(stackWh)}% Waffenhandhabung`);
                    const perParts = [];
                    if (perStackWd > 0) perParts.push(`${formatGermanNumber(perStackWd)}% WD`);
                    if (perStackChd > 0) perParts.push(`${formatGermanNumber(perStackChd)}% CHD`);
                    if (perStackRof > 0) perParts.push(`${formatGermanNumber(perStackRof)}% RPM`);
                    if (perStackWh > 0) perParts.push(`${formatGermanNumber(perStackWh)}% WH`);
                    cache.boni.push(
                        `${stackConf.name}: ${flatAmp > 0 ? `+${formatGermanNumber(flatAmp)}% verstärkter Schaden` : ''}${perParts.length ? `${flatAmp > 0 ? ' + ' : ''}${stacks}/${maxStacks} Stacks × ${perParts.join(' & ')}/Stack = ${unitParts.join(' & ')}` : ` = ${unitParts.join(' & ')}`}` +
                        (talentParts.length ? ` — aktiv: ${[...new Set(talentParts)].join(' + ')}` : ` — ${stackConf.sourceNote}`)
                    );
                }
            }

            // Marken-Boni — datengetrieben aus BRAND_SET_INFO (bonuses_pve, Y8S3-Live-Werte).
            // Pro Brand werden die Boni aller erreichten Set-Größen (1p/2p/3p) kumulativ
            // angewendet. Score-Keys: wd/chc/chd/hsd/dta/dth/rof/wh; wd_by_weapon nur bei
            // passender Zielwaffe; text-Boni (Skill/Defense/Utility) nur als Ausweis ohne
            // Score-Beitrag (Skill-Optimierung separat, Issue #54).
            const brandBonusLabels = { wd: '% WD', chc: '% CHC', chd: '% CHD', hsd: '% HSD', dta: '% DTA', dth: '% DTH', rof: '% RoF', wh: '% Waffenhandhabung' };
            const brandWeaponTypeLabel = { AR: 'AR', LMG: 'LMG', MP: 'MP', Rifle: 'Gewehr', Shotgun: 'Schrotflinte', MMR: 'MMR', Pistol: 'Pistole' };
            Object.entries(BRAND_SET_INFO).forEach(([brandKey, bInfo]) => {
                const bonuses = bInfo.bonuses_pve;
                if (!bonuses) return;
                const count = getBrandCount(build, brandKey);
                if (count <= 0) return;
                const brandName = bInfo.name || brandKey;
                ['1', '2', '3'].forEach(tier => {
                    if (count < Number(tier)) return;
                    const b = bonuses[tier];
                    if (!b) return;
                    const parts = [];
                    ['wd', 'chc', 'chd', 'hsd', 'dta', 'dth', 'rof', 'wh'].forEach(k => {
                        if (b[k]) { d[k] += b[k]; parts.push(`+${formatGermanNumber(b[k])}${brandBonusLabels[k]}`); }
                    });
                    if (b.wd_by_weapon && b.wd_by_weapon[targetWeaponType] && brandWeaponTypeLabel[targetWeaponType]) {
                        const wwd = b.wd_by_weapon[targetWeaponType];
                        d.wd += wwd;
                        parts.push(`+${formatGermanNumber(wwd)}% ${brandWeaponTypeLabel[targetWeaponType]}-Schaden`);
                    }
                    const BRAND_BONUS_LABELS = { magSize: 'Magazingr\u00f6\u00dfe', stability: 'Stabilit\u00e4t', hazard: 'Gefahrenschutz', explosiveDmg: 'Explosionsschaden', ammoCap: 'Munitionskapazit\u00e4t', skillDuration: 'Skill-Dauer', statusEffects: 'Statuseffekte', armorOnKill: 'R\u00fcstung bei Kill', totalArmor: 'Gesamtr\u00fcstung', accuracy: 'Pr\u00e4zision', skillHealth: 'Skill-Health', reloadSpeed: 'Nachladetempo', repairSkills: 'Reparatur-Fertigkeiten', skillHaste: 'Skill-Haste', skillDmg: 'Skill-Schaden', skillEff: 'Skill-Effizienz', skillTier: 'Fertigkeitsstufe', explRes: 'Explosionsresistenz', armorRegen: 'R\u00fcstungs-Regeneration', pfe: 'Schutz vor Eliten', threat: 'erh\u00f6hte Bedrohung', pulseRes: 'Pulse-Resistenz', optRange: 'optimale Reichweite' };
                    Object.keys(BRAND_BONUS_LABELS).forEach(k => {
                        if (b[k] === undefined) return;
                        const isTier = k === 'skillTier';
                        const val = isTier ? b[k] : formatGermanNumber(b[k]) + '%';
                        const note = (k === 'magSize' || k === 'reloadSpeed' || k === 'accuracy' || k === 'stability' || k === 'optRange') ? ' (Modellierung folgt, Issue #56)' : '';
                        cache.boni.push(`${brandName} ${tier}p: +${isTier ? '' : ''}${val} ${BRAND_BONUS_LABELS[k]}${note}`);
                    });
                    if (b.text) cache.boni.push(`${brandName} ${tier}p (${b.text}) — kein Score-Beitrag`);
                });
            });

            // ===== Exotische Gear-Perks (Klasse 1+2) =====
            // Nur aktiv, wenn "Exoten-Perks aktiv" in den Einstellungen an ist
            // (analog "Bedingte Talente aktiv"). Coyote's Mask nutzt die
            // eingestellte Distanz-Zone, Stack-Perks die Stack-Auslastung.
            cache.exoticPerks = [];
            const exoticPerksOn = !!(settings && settings.exoticPerksActive);
            if (exoticPerksOn) {
                const coyoteZone = (document.getElementById('coyoteDistance')?.value) || 'mid';
                build.forEach(item => {
                    const def = EXOTIC_GEAR_PERKS[item.setName];
                    if (!def) return;
                    // #108 D: Abgewaehlte Exoten: kein Perk
                    if (isExoticGearDisabled(item)) return;
                    let utilization = 100;
                    if (def.perStackWd) {
                        const slider = document.getElementById('exoticStackUtil_' + slugify(item.setName));
                        if (slider && slider.value !== '' && !isNaN(parseLocalizedFloat(slider.value))) {
                            utilization = parseLocalizedFloat(slider.value);
                        } else {
                            utilization = parseLocalizedFloat(document.getElementById('stackUtilization')?.value, 100);
                        }
                        if (utilization < 0) utilization = 100;
                        if (utilization > 100) utilization = 100;
                    }
                    if (def.byDistance) {
                        const zone = def.byDistance[coyoteZone] || def.byDistance.mid;
                        d.chc += zone.chc; d.chd += zone.chd;
                        cache.boni.push(`${def.label}: ${zone.note} (Distanz-Zone "${coyoteZone}")`);
                        cache.exoticPerks.push({ name: def.label, chc: zone.chc, chd: zone.chd });
                    } else if (def.perStackWd) {
                        const stacks = Math.round(def.maxStacks * (utilization / 100));
                        const wd = stacks * def.perStackWd;
                        if (wd > 0) {
                            d.wd += wd;
                            cache.boni.push(`${def.label}: ${stacks}/${def.maxStacks} Stacks à +${formatGermanNumber(def.perStackWd)}% WD = +${formatGermanNumber(wd)}% WD — ${def.note}`);
                            cache.exoticPerks.push({ name: def.label, wd: wd });
                        }
                    } else if (def.chdPerRedAttr) {
                        const redCount = build.reduce((n, i) => n + (Array.isArray(i.attrs)
                            ? i.attrs.filter(a => a.type === 'chc' || a.type === 'chd' || a.type === 'wd').length
                            : ((i.chc || 0) > 0 ? 1 : 0) + ((i.chd || 0) > 0 ? 1 : 0)), 0);
                        const chd = redCount * def.chdPerRedAttr;
                        if (chd > 0) {
                            d.chd += chd;
                            cache.boni.push(`${def.label}: ${redCount} rote Nicht-Kern-Attribute × +${def.chdPerRedAttr}% CHD = +${formatGermanNumber(chd)}% CHD`);
                            cache.exoticPerks.push({ name: def.label, chd: chd });
                        }
                    } else if (def.wd || def.chd || def.amp || def.rof) {
                        d.wd += def.wd || 0; d.chd += def.chd || 0; d.amp += def.amp || 0; d.rof += def.rof || 0;
                        const parts = [];
                        if (def.wd) parts.push(`+${def.wd}% WD`);
                        if (def.chd) parts.push(`+${def.chd}% CHD`);
                        if (def.amp) parts.push(`+${def.amp}% verstärkter Schaden`);
                        if (def.rof) parts.push(`+${def.rof}% RPM`);
                        cache.boni.push(`${def.label}: ${parts.join(' & ')} — ${def.note}`);
                        cache.exoticPerks.push({ name: def.label, wd: def.wd || 0, chd: def.chd || 0, amp: def.amp || 0, rof: def.rof || 0 });
                    }
                });
            }
            // Named Items (markenbasiert)
            const hasPicaros = getBrandCount(build, 'Picaro\'s Holster') > 0;
            const hasCoyote = getBrandCount(build, 'Coyote\'s Mask') > 0;
            const hasHollowMan = getBrandCount(build, 'The Hollow Man') > 0;
            const hasMemento = getBrandCount(build, 'Memento') > 0;

            // Werte kommen bereits aus den Named-Feldern der Teile (cache.named) bzw. dem Kern-WD -> hier nur Info, kein zweites Addieren
            if (hasPicaros) cache.boni.push("Picaro's Holster (Named-Wert aus Teil)");
            if (hasCoyote) cache.boni.push("Coyote's Mask (Named-Wert aus Teil)");
            if (hasHollowMan) cache.boni.push("The Hollow Man (Named-Wert aus Teil)");
            if (hasMemento) cache.boni.push("Memento (Kern-WD aus Teil)");

            // Gear-Talente (High-End Weste/Rucksack): WD-Typ additiv zum Waffenschaden,
            // Verstärker (amp) als eigene multiplikative Gruppe. Bedingte Talente
            // fließen nur ein, wenn "Bedingte Talente aktiv" in den Einstellungen
            // angeschaltet ist (gleiche Annahme wie bei Waffen-Talenten).
            cache.gearAmp = 0;
            build.forEach(item => {
                if (!item.talent) return;
                const t = GEAR_TALENTS[item.talent];
                if (!t || !t.type) return;
                // Waffengattungs-Bindung (z.B. Opportunistisch nur Schrotflinte/MMR)
                if (t.onlyWeapons && !t.onlyWeapons.includes(targetWeaponType)) {
                    cache.boni.push(`${t.label}: nicht anwendbar auf ${targetWeaponType}`);
                    return;
                }
                const active = !t.conditional || !!settings.talentsActive;
                if (!active) {
                    cache.boni.push(`${t.label}: bedingt (${t.condition || 'Bedingung'}) – in Rechnung nur bei aktiven bedingten Talenten`);
                    return;
                }
                // Waffengattungsabhängiger Verstärker (Versatile: SMG/Shotgun/Rifle/MMR 35%, AR/LMG 10%)
                const val = (t.valueByWeapon && targetWeaponType in t.valueByWeapon)
                    ? t.valueByWeapon[targetWeaponType] : t.value;
                if (t.type === 'wd') {
                    d.wd += val;
                    cache.boni.push(`${t.label} (Weste/Rucksack-Talent): +${formatGermanNumber(val)}% Waffenschaden${t.condition ? ` — ${t.condition}` : ''}`);
                } else if (t.type === 'amp') {
                    cache.gearAmp += val;
                    cache.boni.push(`${t.label} (Weste/Rucksack-Talent): +${formatGermanNumber(val)}% verstärkter Schaden${t.condition ? ` — ${t.condition}` : ''}`);
                }
            });

            return cache;
        }

        function calculateWeaponWithBuild(weapon, build, settings, buildCache) {
            const { targetWeaponType, specialization, knowHowLevel, shdMax, shdCustomWd, shdCustomChc, shdCustomChd, require4pc, targetGreenSet, forceChest, forceBackpack, talentsActive } = settings;

            // 1. Waffen-Attribute
            let totalWd = weapon.core1;
            let totalChc = 0;
            let totalChd = 0;
            let totalDttooc = 0;
            let totalDta = 0;
            let totalDth = 0;
            let totalRof = 0;
            let totalHsd = 0;

            // Kern 2
            if (weapon.core2Type === 'chc') totalChc += weapon.core2Val;
            else if (weapon.core2Type === 'chd') totalChd += weapon.core2Val;
            else if (weapon.core2Type === 'dttooc') totalDttooc += weapon.core2Val;
            else if (weapon.core2Type === 'dta') totalDta += weapon.core2Val;
            else if (weapon.core2Type === 'dth') totalDth += weapon.core2Val;
            else if (weapon.core2Type === 'rof') totalRof += weapon.core2Val;
            else if (weapon.core2Type === 'hsd') totalHsd += weapon.core2Val;

            // Nebenattribut
            if (weapon.minorType === 'chc') totalChc += weapon.minorVal;
            else if (weapon.minorType === 'chd') totalChd += weapon.minorVal;
            else if (weapon.minorType === 'dttooc') totalDttooc += weapon.minorVal;
            else if (weapon.minorType === 'dta') totalDta += weapon.minorVal;
            else if (weapon.minorType === 'dth') totalDth += weapon.minorVal;
            else if (weapon.minorType === 'rof') totalRof += weapon.minorVal;
            else if (weapon.minorType === 'hsd') totalHsd += weapon.minorVal;

            // Mods (effektiv: manuell erfasst ODER automatisch optimiert)
            Object.values(getEffectiveMods(weapon)).forEach(mod => {
                if (mod.type === 'chc') totalChc += mod.val;
                else if (mod.type === 'chd') totalChd += mod.val;
                else if (mod.type === 'wd') totalWd += mod.val;
                else if (mod.type === 'dttooc') totalDttooc += mod.val;
                else if (mod.type === 'dta') totalDta += mod.val;
                else if (mod.type === 'dth') totalDth += mod.val;
                else if (mod.type === 'rof') totalRof += mod.val;
                else if (mod.type === 'hsd') totalHsd += mod.val;
            });

            // Herkunfts-Snapshot 1: alles aus der Waffe selbst (Kerne, Attribute, Waffen-Mods)
            const srcWeapon = { wd: totalWd, chc: totalChc, chd: totalChd };

            // Talent: Schadens-Talente fließen nur ein, wenn ihre Bedingung als
            // erfüllt angenommen wird (Einstellung "Bedingte Waffen-Talente").
            // Verstärker (amp) sind eine eigene multiplikative Schadensgruppe.
            let talentWd = 0, talentChc = 0, talentChd = 0, talentRof = 0, talentAmp = 0;
            let talentInfo = null;
            if (weapon.talent && weapon.talent !== 'none') {
                const rt = resolveTalentDef(weapon.talent);
                const tKey = rt.key;
                const t = rt.t;
                if (!t) {
                    // v36: Unbekannte Talente nicht stillschweigend ignorieren –
                    // im Ergebnis als "nicht modelliert" ausweisen.
                    talentInfo = { key: tKey, label: weapon.talent, active: false, unknown: true,
                        note: 'Talent nicht in der Talent-DB gefunden – kein Effekt berechnet' };
                } else {
                    // Talent-Synergie (#108 A2): Ist "Bedingte Talente aktiv"
                    // AUS, zaehlt ein bedingtes Talent nur, wenn der Build
                    // die Bedingung selbst liefern kann (z.B. Sadist-Blutung
                    // via Trauma-Weste). Bei AN gilt wie bisher die pauschale
                    // Annahme.
                    let active = !t.conditional || !!talentsActive;
                    let synergyVia = '';
                    if (t.conditional && !talentsActive) {
                        const syn = (typeof buildProvidesTalentCondition === 'function')
                            ? buildProvidesTalentCondition(tKey, build) : { possible: false, via: '' };
                        active = syn.possible;
                        synergyVia = syn.via || '';
                    }
                    const val = talentValueFor(tKey, weapon.isExotic);
                    let talentMagNote = '';
                    if (active) {
                        // Magazin-abhängige Talente (Optimist, Angespannt,
                        // Raserei): Ø-Bonus über ein volles Magazin statt
                        // Best-Case-Maximalwert (siehe magazineAverageTalent).
                        // v36: VOR dem type-Check prüfen, damit auch DB-Einträge
                        // mit type:null (z.B. Raserei aus der Talent-DB) wirken.
                        const magAvg = magazineAverageTalent(tKey, weapon);
                        if (magAvg) {
                            talentWd += magAvg.wd;
                            talentChd += magAvg.chd;
                            talentRof += magAvg.rof;
                            talentMagNote = magAvg.note;
                        } else if (t.type === 'wd') talentWd += val;
                        else if (t.type === 'chd') talentChd += val;
                        else if (t.type === 'chcchd') {
                            // v36: Getrennte CHC/CHD-Werte (z.B. Adaptive Instincts 20/50)
                            const chcVal = (t.valueChc !== undefined && t.valueChc !== null) ? t.valueChc : val;
                            const chdVal = (t.valueChd !== undefined && t.valueChd !== null) ? t.valueChd : val;
                            talentChc += chcVal;
                            talentChd += chdVal;
                        }
                        else if (t.type === 'wdrof') { talentWd += val; talentRof += val; }
                        else if (t.type === 'rof') talentRof += val;
                        else if (t.type === 'amp') talentAmp += val;
                    }
                    talentInfo = { key: tKey, label: t.label, active: active, conditional: !!t.conditional, val: val, type: t.type, synergyVia: synergyVia,
                        situational: !t.type && !talentMagNote,
                        note: (t.note || '') + (talentMagNote ? (t.note ? ' — ' : '') + talentMagNote : '') };
                }
            }
            // Issue #75: Numerisch modellierte Exoten-Waffen-Talente (Map
            // EXOTIC_WEAPON_TALENTS). Kein Doppelzaehlen mit WEAPON_TALENTS:
            // der Bonus greift nur, wenn die Waffe dort KEIN Modell hat.
            const exoW = (typeof exoticWeaponTalentBonus === 'function') ? exoticWeaponTalentBonus(weapon) : null;
            let exoWInfo = null;
            const exoWDef = (typeof exoticWeaponTalentDef === 'function') ? exoticWeaponTalentDef(weapon) : null;
            if (exoWDef && exoW) {
                const hasWtModel = !!(weapon.talent && weapon.talent !== 'none' && resolveTalentDef(weapon.talent).t);
                if (!hasWtModel) {
                    const skillTiers = (typeof computeBuildCache === 'function')
                        ? (buildCache || computeBuildCache(build, settings)).buildSkillTiers || 0
                        : 0;
                    const exoWd = exoW.wd + (exoW.skillTierWd ? exoW.skillTierWd * skillTiers : 0);
                    totalWd += exoWd; totalChc += exoW.chc; totalChd += exoW.chd;
                    totalRof += exoW.rof; totalHsd += exoW.hsd;
                    totalDttooc += exoW.dttooc; totalDta += exoW.dta;
                    talentAmp += exoW.amp;
                    const parts = [];
                    if (exoWd) parts.push(`+${formatGermanNumber(exoWd)}% WD`);
                    if (exoW.chc) parts.push(`+${formatGermanNumber(exoW.chc)}% CHC`);
                    if (exoW.chd) parts.push(`+${formatGermanNumber(exoW.chd)}% CHD`);
                    if (exoW.amp) parts.push(`+${formatGermanNumber(exoW.amp)}% verstaerkt`);
                    if (exoW.rof) parts.push(`+${formatGermanNumber(exoW.rof)}% RoF`);
                    if (exoW.hsd) parts.push(`+${formatGermanNumber(exoW.hsd)}% HSD`);
                    if (exoW.dttooc) parts.push(`+${formatGermanNumber(exoW.dttooc)}% DTToOC`);
                    if (exoW.dta) parts.push(`+${formatGermanNumber(exoW.dta)}% DTA`);
                    exoWInfo = { label: exoWDef.label, perk: exoWDef.perk,
                        note: `${exoWDef.perk}: ${parts.join(' & ') || 'kein Bonus'} — ${exoWDef.note}` };
                    if (!talentInfo) talentInfo = { key: 'exotic_weapon', label: exoWDef.label, active: true, exoticModel: true, note: exoWInfo.note };
                    else talentInfo.note = (talentInfo.note ? talentInfo.note + ' — ' : '') + exoWInfo.note;
                } else {
                    // Beide Modelle: WEAPON_TALENTS gewinnt, Exoten-Modell ruht
                    exoWInfo = { label: exoWDef.label, perk: exoWDef.perk,
                        note: `${exoWDef.perk}: bereits ueber die Talent-DB (WEAPON_TALENTS) eingerechnet — Exoten-Modell nicht doppelt gezaehlt` };
                    talentInfo.note = (talentInfo.note ? talentInfo.note + ' — ' : '') + exoWInfo.note;
                }
            }
            const talentAmpMult = 1 + (talentAmp / 100);

            // 2. Build-Attribute & Boni — aus dem Build-Cache (PERFORMANCE):
            // Alle waffenunabhängigen Effekte sind in computeBuildCache() einmal
            // pro Build vorausberechnet und werden hier nur noch angewendet.
            const bc = buildCache || computeBuildCache(build, settings);
            // Gear-Talent-Verstärker (Weste/Rucksack, z.B. Glaskanone +25%) –
            // eigene multiplikative Schadensgruppe aus dem Build-Cache.
            const gearAmpMult = 1 + ((bc.gearAmp || 0) / 100);
            // Set-Verstärker (4p-Talente wie Ongoing Directive Hohlspitz,
            // Hunter's Fury Debuff, Aces & Eights, Hotshot, Virtuoso):
            // eigene multiplikative Gruppe — in-game Verstärker stapeln
            // multiplikativ zwischen den Gruppen, nicht additiv im WD-Bucket.
            const setAmpMult = 1 + ((bc.delta.amp || 0) / 100);
            // Waffenhandhabung aus Set-Boni (z.B. Tipping Scales +0,5%/Stack):
            // wirkt in-game v.a. als Nachladetempo → fließt über den
            // Sustain-Faktor (Feuerzeit vs. Feuerzeit+Nachladezeit) in den
            // zeitlichen Schaden ein. 1% WH ≈ 1% Nachladetempo.
            const buildWh = (bc.delta.wh || 0) + (bc.buildWh || 0);
            let buildChc = bc.buildChc;
            let buildChd = bc.buildChd;
            let buildWd = bc.buildWd;

            // Named-Item-Boni
            totalDta += bc.named.dta;
            totalDttooc += bc.named.dttooc;
            totalDth += bc.named.dth;
            totalChc += bc.named.chc;
            totalChd += bc.named.chd;
            totalWd += bc.named.wd;
            // Gear-Minor-Attribute aus dem Build (nicht-CHC/CHD-Typen wie
            // DTA/DTToOC/HSD/RoF/WH) - bisher nur via attrs-Array erfasst
            // und von der Summe uebersehen worden.
            totalDta += bc.buildDta || 0;
            totalDttooc += bc.buildDttooc || 0;
            totalDth += bc.buildDth || 0;
            totalHsd += bc.buildHsd || 0;
            totalRof += bc.buildRof || 0;

            // Herkunfts-Snapshot 2: Named-Item-Boni (Differenz zur Waffe)
            const srcNamed = { wd: bc.named.wd, chc: bc.named.chc, chd: bc.named.chd };

            // 3. SHD-Uhr
            const shdWd = shdMax ? 10 : parseLocalizedFloat(shdCustomWd);
            const shdChc = shdMax ? 10 : parseLocalizedFloat(shdCustomChc);
            const shdChd = shdMax ? 20 : parseLocalizedFloat(shdCustomChd);

            // 4. Spezialisierung
            let specWd = 15;
            let specRof = 0;
            let specHsd = 0;
            let specDttoocBonus = 0;
            let specDmgAmp = 1.0;
            let specName = "";

            if (specialization === 'gunner') {
                specRof += 5;
                specName = "Richtschütze (+15% WD, +5% RoF)";
            } else if (specialization === 'firewall') {
                specDmgAmp = 1.10;
                specName = "Feuerteufel (+15% WD, +10% Stürmer-Schild)";
            } else if (specialization === 'demolitionist') {
                specDttoocBonus += 5;
                specName = "Zerstörungsexperte (+15% WD, +5% DTToOC)";
            } else if (specialization === 'sharpshooter') {
                specHsd += 15;
                specName = "Präzisionsschütze (+15% WD, +15% HSD)";
            } else if (specialization === 'survivalist') {
                specName = "Überlebensexperte (+15% WD, +10% vs Status)";
            } else if (specialization === 'technician') {
                specName = "Techniker (+15% WD, +1 Skill-Tier)";
            } else {
                specName = "Standard (+15% Waffenschaden)";
            }

            // 5. Gesamtwerte
            totalWd += buildWd + shdWd + specWd + talentWd;
            totalChc += buildChc + shdChc + talentChc;
            totalChd += buildChd + shdChd + talentChd;
            totalRof += specRof + talentRof;
            totalDttooc += specDttoocBonus;

            // Herkunfts-Snapshot 3: Basis nach Waffe + Named + Talent + Ausrüstung
            // + SHD + Spezialisierung. Alles, was danach (Set-/Marken-Boni in
            // Abschnitt 6-7) dazukommt, ist die Differenz zu diesem Stand.
            const srcAfterBase = { wd: totalWd, chc: totalChc, chd: totalChd };

            // 6./6b./7. Set-, 4p-Stack- und Marken-Boni (aus dem Build-Cache)
            const targetSetCount = bc.targetSetCount;
            let activeBrandBoni = [];
            if (specName) activeBrandBoni.push(specName);
            if (shdMax) {
                activeBrandBoni.push("SHD-Uhr Lvl 1000+ (+10% WD, +10% CHC, +20% CHD)");
            } else if (shdWd > 0 || shdChc > 0 || shdChd > 0) {
                activeBrandBoni.push(`SHD-Uhr (+${shdWd}% WD, +${shdChc}% CHC, +${shdChd}% CHD)`);
            }
            activeBrandBoni.push(...bc.boni);
            const epInfo = enemyProfile();
            activeBrandBoni.push(`Gegnerprofil: ${Math.round(epInfo.armor * 100)}% Ruestung / ${Math.round(epInfo.health * 100)}% Lebensenergie / ${Math.round(epInfo.ooc * 100)}% ungedeckt`);
            totalWd += bc.delta.wd;
            totalChc += bc.delta.chc;
            totalChd += bc.delta.chd;
            totalRof += bc.delta.rof;
            totalDttooc += bc.delta.dttooc;
            totalDta += bc.delta.dta;
            totalDth += bc.delta.dth;
            const stackInfo = bc.stackInfo;

            // 8. Mod-Konfigurationen (CHC/CHD Aufteilung)
            const modConfigs = [
                { chcCount: 0, chdCount: 3 },
                { chcCount: 1, chdCount: 2 },
                { chcCount: 2, chdCount: 1 },
                { chcCount: 3, chdCount: 0 }
            ];

            let bestResult = null;
            let maxDmg = 0;
            // v36: Mindest-CHC aus den Einstellungen (Element targetChc),
            // statt hartkodiert 50. Fällt das Feld weg, gilt weiter 50.
            const targetChcRaw = (typeof document !== 'undefined' && document.getElementById('targetChc')) ? parseLocalizedFloat(document.getElementById('targetChc').value, 50) : null;
            const targetChc = (targetChcRaw !== null) ? targetChcRaw : 50;

            // Herkunfts-Snapshot 4: Set- & Marken-Boni (Differenz seit Snapshot 3);
            // der 4p-Stack-Schaden wird separat als eigene Quelle ausgewiesen.
            const srcSetBrand = {
                wd: totalWd - srcAfterBase.wd - (stackInfo ? stackInfo.wd : 0),
                chc: totalChc - srcAfterBase.chc,
                chd: totalChd - srcAfterBase.chd
            };

            // v36: Nicht mehr still verwerfen, wenn KEINE Mod-Konfiguration das
            // Mindest-CHC erreicht – dann greift automatisch die beste
            // verfügbare Konfiguration (mit Hinweis chcBelowTarget).
            let chosenMod = null;
            let chosenDps = 0;
            let anyMeetsTarget = false;
            for (let mod of modConfigs) {
                let finalChc = totalChc + (mod.chcCount * 6);
                let finalChd = totalChd + (mod.chdCount * 12);

                let cappedChc = Math.min(finalChc, 60);

                // v32: Gegnerprofil gewichtet DTA/DTH/DTToOC
                const ep = enemyProfile();
                let dtaMult = 1 + (totalDta / 100) * ep.armor;
                let dttoocMult = 1 + (totalDttooc / 100) * ep.ooc; // specDttoocBonus steckt bereits in totalDttooc (Abschnitt 5)
                let dthMult = 1 + (totalDth / 100) * ep.health;
                let rofMult = 1 + (totalRof / 100);
                // Sustain-Faktor: Magazin vs. Nachladezeit inkl. WH-Bonus
                let sustainMult = 1;
                if (typeof weaponEffectiveRpm === 'function' && typeof weaponSustainFactor === 'function') {
                    const modRofPart = modAttrTotal(weapon, 'rof') || 0;
                    const talentRofPart = Math.max(0, totalRof - modRofPart);
                    const rpmInfo = weaponEffectiveRpm(weapon, talentRofPart);
                    const sf = rpmInfo.rpm ? weaponSustainFactor(weapon, rpmInfo.rpm, buildWh) : null;
                    if (sf) sustainMult = sf;
                }
                // Kopfschuss-Modell (#108): HSD wirkt nur auf dem Kopfschuss-
                // Anteil epHsd. Der Basis-HSD der Waffe (DB) stapelt
                // multiplikativ mit den Prozent-Boni (Kern 2, Mods, Exot,
                // Scharfschuetze +15%) auf dem Kopfschuss-Treffer.
                const dbEntryHsd = (typeof getWeaponDbEntry === 'function') ? getWeaponDbEntry(weapon) : null;
                const dbHsd = (dbEntryHsd && dbEntryHsd.stats && dbEntryHsd.stats.HSD) ? dbEntryHsd.stats.HSD : 0;
                const epHsd = ep.headshot || 0;
                let hsdMult = 1 + (totalHsd / 100) * epHsd;

                let knowHowMult = 1 + (knowHowLevel / 100);
                let rawHit = weapon.baseDmg * knowHowMult * (1 + (totalWd / 100)) * specDmgAmp;
                let nonCritBody = rawHit * dtaMult * dttoocMult * dthMult * talentAmpMult * gearAmpMult * setAmpMult;
                let nonCritHit = nonCritBody * ((1 - epHsd) + epHsd * (1 + (totalHsd + dbHsd) / 100));
                let critHit = nonCritHit * (1 + (finalChd / 100));

                let avgBulletDmg = (nonCritHit * (1 - cappedChc / 100)) + (critHit * (cappedChc / 100));
                let effectiveDPS = avgBulletDmg * rofMult * sustainMult;

                const meetsTarget = finalChc >= targetChc;
                if (meetsTarget) anyMeetsTarget = true;
                // Bevorzugt Konfigurationen, die das Mindest-CHC erreichen;
                // sonst die beste overall (Fallback-Teilmenge).
                const better = chosenMod === null || (meetsTarget && !chosenMod.meetsTarget) || (meetsTarget === chosenMod.meetsTarget && effectiveDPS > chosenDps);
                if (better) {
                    chosenMod = { mod, meetsTarget, finalChc, finalChd, cappedChc, dtaMult, dttoocMult, dthMult, rofMult, nonCritHit, critHit, avgBulletDmg, effectiveDPS, sustainMult, setAmpMult };
                    chosenDps = effectiveDPS;
                }
            }

            if (chosenMod) {
                const mod = chosenMod.mod;
                const finalChc = chosenMod.finalChc;
                const finalChd = chosenMod.finalChd;
                const cappedChc = chosenMod.cappedChc;
                const effectiveDPS = chosenMod.effectiveDPS;
                const belowTarget = !chosenMod.meetsTarget;
                bestResult = {
                    weapon: weapon,
                    build: build,
                    finalChc: finalChc,
                    cappedChc: cappedChc,
                    finalChd: finalChd,
                    totalWd: totalWd,
                    mods: mod,
                    chcBelowTarget: belowTarget,
                    modRecText: `${mod.chcCount}× CHC (+6%) · ${mod.chdCount}× CHD (+12%)`,
                    modRecReason: (belowTarget
                        ? `⚠️ Mindest-CHC ${formatGermanNumber(targetChc)}% ist mit keiner Mod-Konfiguration erreichbar (Build-CHC ${formatGermanNumber(finalChc)}%) – automatisch beste verfügbare Aufteilung gewählt. `
                        : '') + (finalChc > 60
                        ? `Vor dem Cap wären es ${formatGermanNumber(finalChc)}% CHC – alles über 60% wäre verschenkt, daher ${mod.chdCount}× CHD statt weiterer CHC-Mods.`
                        : `Grenzwert-Betrachtung: +6% CHC bringt Ø +${formatGermanNumber(0.06 * finalChd)}% Schaden (6% × CHD ${formatGermanNumber(finalChd)}%), +12% CHD bringt Ø +${formatGermanNumber(0.12 * Math.min(finalChc, 60))}% (12% × CHC ${formatGermanNumber(finalChc)}%). Diese Aufteilung liefert den höchsten Ø-Schaden pro Kugel.`),
                    knowHowLevel: knowHowLevel,
                    dtaBonus: totalDta,
                    dttoocBonus: totalDttooc,
                    dthBonus: totalDth,
                    rofBonus: totalRof,
                    specDmgAmp: specDmgAmp,
                    armorMult: chosenMod.dtaMult * chosenMod.dttoocMult,
                    healthMult: chosenMod.dthMult * chosenMod.dttoocMult,
                    nonCritHit: chosenMod.nonCritHit,
                    critHit: chosenMod.critHit,
                    avgDmg: chosenMod.avgBulletDmg,
                    effectiveDPS: effectiveDPS,
                    activeBrandBoni: activeBrandBoni,
                    targetSetCount: targetSetCount,
                    talentInfo: talentInfo,
                    talentAmp: talentAmp,
                    talentsActiveSetting: !!talentsActive,
                    stackInfo: stackInfo,
                    setAmpMult: chosenMod.setAmpMult,
                    sustainMult: chosenMod.sustainMult,
                    buildWh: buildWh,
                    breakdown: {
                        weapon: srcWeapon,
                        talent: { wd: talentWd, chc: talentChc, chd: talentChd },
                        gear: { wd: buildWd, chc: buildChc, chd: buildChd },
                        named: srcNamed,
                        shd: { wd: shdWd, chc: shdChc, chd: shdChd },
                        spec: { wd: specWd, chc: 0, chd: 0 },
                        stack: stackInfo ? { wd: stackInfo.wd || 0, chc: 0, chd: stackInfo.chd || 0 } : null,
                        setBrand: srcSetBrand,
                        knowhow: { wd: (knowHowLevel || 0), chc: 0, chd: 0 },
                        mods: { chcCount: mod.chcCount, chdCount: mod.chdCount, chc: mod.chcCount * 6, chd: mod.chdCount * 12, wd: 0 }
                    }
                };
            }

            return bestResult;
        }

        function getBrandCount(build, key) {
            key = key.toLowerCase();
            let count = 0;
            const hasNinja = build.some(item => (item.setName || '').toLowerCase().includes('ninjabike'));

            build.forEach(item => {
                const name = (item.setName || '').toLowerCase();
                if (brandKeyMatches(name, key)) count++;
            });

            if (hasNinja && count > 0 && key !== 'ninjabike') {
                count += 1;
            }

            return count;
        }

        // Green-Set-Keys (targetGreenSet) → Namensfragmente in setName.
        // Wichtig: brandKeyMatches muss ALLE grünen Sets kennen, sonst
        // zählen z.B. Hunter's-Fury-Teile nicht als Set-Teile und
        // require4pc/forceChest/forceBackpack filtern jeden Build weg.
        const GREEN_SET_MATCH = {
            striker: ['striker'],
            heartbreaker: ['heartbreaker'],
            huntersfury: ["hunter's fury", 'hunters fury', 'hunts fury'],
            negotiator: ["negotiator"],
            umbra: ['umbra'],
            hotshot: ['hotshot'],
            acesandeights: ['aces and eights'],
            breakingpoint: ['breaking point'],
            tipofthespear: ['tip of the spear'],
            virtuoso: ['virtuoso'],
            tippingscales: ['tipping scales'],
            concentratedcompany: ['concentrated company'],
            corestrength: ['core strength'],
            ongoing: ['ongoing directive'],
            future: ['future initiative'],
            eclipse: ['eclipse protocol'],
            foundry: ['foundry bulwark'],
            rigger: ['rigger'],
            hardwired: ['hard wired'],
            truepatriot: ['true patriot'],
            systemcorruption: ['system corruption'],
            cavalier: ['cavalier'],
            ortizexuro: ['exuro'],
            aegis: ['aegis'],
            refactor: ['refactor'],
            measuredassembly: ['measured assembly'],
            ortizreficere: ['reficere'],
            emberengine: ['ember engine']
        };

        // v36: Vollständige Markennamen (aus computeBuildCache/getBrandCount)
        // auf die Kurzschlüssel der Einzelfälle mappen. Vorher lieferten
        // z.B. zwei Grupo-Shadow-Teile den Count 0, weil brandKeyMatches
        // nur 'grupo' kannte.
        const BRAND_KEY_ALIAS = {
            "grupo shadow": "grupo",
            "walker, harris & co.": "walker", "walker harris": "walker",
            "ceska group": "ceska",
            "providence defense": "providence",
            "badger tuff": "badger",
            "unit alloys": "unitalloys",
            "overlord armaments": "overlord",
            "airaldi holdings": "airaldi",
            "gila guard": "gila",
            "douglas & harding": "douglas",
            "yaahl gear": "yaahl",
            "belstone armory": "belstone",
            "brazos de arcabuz": "brazos",
            "legatus s.p.a.": "legatus",
            "picaro's holster": "picaro", "picaros holster": "picaro",
            "coyote's mask": "coyote", "coyotes mask": "coyote",
            "the hollow man": "hollowman"
        };

        function brandKeyMatches(name, key) {
            key = key.toLowerCase().replace(/’/g, "'");
            name = name.toLowerCase().replace(/’/g, "'");
            key = BRAND_KEY_ALIAS[key] || key;
            // Named-Items: Marken-Zuordnung ueber GEAR_DB (brand-Name -> Brand-Key).
            // Im Spiel zaehlen Named-Teile fuer den Marken-Set-Bonus mit.
            const dbKey = (typeof GEAR_DB !== 'undefined') && Object.keys(GEAR_DB).find(n => n.toLowerCase() === name);
            const dbEntry = dbKey && GEAR_DB[dbKey];
            if (dbEntry && dbEntry.brand) {
                const brandKey = (typeof BRAND_SET_INFO !== 'undefined') && Object.keys(BRAND_SET_INFO).find(k => (BRAND_SET_INFO[k].name || '').toLowerCase() === dbEntry.brand.toLowerCase());
                if (brandKey === key) return true;
                return false;
            }
            // Brand-Sets: Fragment-Abgleich aus BRAND_SET_INFO (z.B. Y8S3-Brands)
            const bInfo = (typeof BRAND_SET_INFO !== 'undefined') && BRAND_SET_INFO[key];
            if (bInfo && Array.isArray(bInfo.fragments) && bInfo.fragments.length > 0) {
                return bInfo.fragments.some(f => name.includes(f));
            }
            // Grüne Sets: Fragment-Abgleich aus der Tabelle
            const frags = GREEN_SET_MATCH[key];
            if (frags) return frags.some(f => name.includes(f));
            if (key === 'striker' && name.includes('striker')) return true;
            if (key === 'grupo' && (name.includes('grupo') || name.includes('door-kicker'))) return true;
            if (key === 'walker' && (name.includes('walker') || name.includes('matador') || name.includes('chainkiller'))) return true;
            if (key === 'ceska' && (name.includes('ceska') || name.includes('devil'))) return true;
            if (key === 'fenris' && (name.includes('fenris') || name.includes('ferocious'))) return true;
            if (key === 'petrov' && (name.includes('petrov') || name.includes('contractor') || name.includes('vedmedytsya'))) return true;
            if (key === 'overlord' && (name.includes('overlord') || name.includes('fox'))) return true;
            if (key === 'airaldi' && (name.includes('airaldi') || name.includes('pristine'))) return true;
            if (key === 'sokolov' && (name.includes('sokolov') || name.includes('firm handshake'))) return true;
            if (key === 'providence' && (name.includes('providence') || name.includes('gift') || name.includes('sacrifice'))) return true;
            if (key === 'badger' && (name.includes('badger') || name.includes('zero f'))) return true;
            if (key === 'unitalloys' && name.includes('unit')) return true;
            if (key === 'habsburg' && (name.includes('habsburg') || name.includes('courier'))) return true;
            if (key === 'contractor' && (name.includes('contractor') || name.includes("contractors"))) return true;
            if (key === 'fox' && (name.includes('fox') || name.includes("fox's"))) return true;
            if (key === 'picaro' && (name.includes('picaro') || name.includes("picaro's"))) return true;
            if (key === 'coyote' && (name.includes('coyote') || name.includes("coyote's"))) return true;
            if (key === 'hollowman' && (name.includes('hollow') || name.includes('hollow man'))) return true;
            if (key === 'memento' && name.includes('memento')) return true;
            return false;
        }

// ===== Weapon-brand prefilter (v32) =====
// The heuristic pre-selection (preFilterSlot) now credits the brand bonuses
// that add weapon damage for the selected weapon type - regardless of
// whether 2 pieces would formally be required (e.g. Unit Alloys 2p,
// Habsburg Guard 2p). This keeps e.g. Fenris items in the candidate pool
// when optimizing for AR, instead of Petrov items winning on raw solo score.
// This bonus is used ONLY for pre-selection; the real piece-count logic
// (e.g. Petrov 1p only with LMG) stays unchanged in computeBuildCache.
function brandWeaponDamageBonusPct(item, targetWeaponType) {
    // v50 (Y8S3): datengetrieben aus BRAND_SET_INFO (bonuses_pve) statt
    // hartcodierter Switch-Liste. Erfasst wd-Boni und waffentypbezogene
    // wd_by_weapon-Boni (1p/2p/3p kumulativ), unabhaengig von der Stueckzahl
    // (Vorauswahl-Heuristik wie bisher: Unit Alloys 2p wird schon bei 1
    // Teil fuer AR gegutgeschrieben).
    const name = item.setName || '';
    let bonus = 0;
    Object.entries(BRAND_SET_INFO).forEach(([brandKey, bInfo]) => {
        const bonuses = bInfo.bonuses_pve;
        if (!bonuses || !brandKeyMatches(name, brandKey)) return;
        ['1', '2', '3'].forEach(tier => {
            const b = bonuses[tier];
            if (!b) return;
            if (b.wd) bonus += b.wd;
            if (b.wd_by_weapon && b.wd_by_weapon[targetWeaponType]) bonus += b.wd_by_weapon[targetWeaponType];
        });
    });
    return bonus;
}

// Pre-filter score: solo score multiplied by the expected brand weapon
// damage of the selected weapon type.
function prefilterItemScore(item, targetWeaponType) {
    // v32: brand bonus now lives inside gearItemScore (weaponTypeOverride or setting) - no double counting here.
    return gearItemScore(item, targetWeaponType).score;
}

        function generateAllGearBuilds(items, targetGreenSet, targetWeaponType, forceExoticGear, pinnedIds) {
            const pinnedSet = new Set((pinnedIds || []).map(String));
            // #108 D: deaktivierte Exoten fliegen raus, fixierte Teile sind
            // vom Pre-Filter geschuetzt und Pflicht in jedem Build.
            const slots = ['Maske', 'Rucksack', 'Weste', 'Handschuhe', 'Holster', 'Knieschoner'];
            let itemsBySlot = {};

            // ===== PERFORMANCE: Mehrstufige Vorauswahl pro Slot =====
            // Stufe 1: Item-Dedupe – identische Drops (gleiches Set, gleiche
            //          CHC/CHD/WD/Named-Werte) kollabieren auf ein Exemplar.
            // Stufe 2: Top 3 je Set+Attribut-Profil – Set-Kombinationen
            //          (z.B. Striker 4p) bleiben vollständig kalkulierbar,
            //          auch wenn Teile anderer Marken einzeln besser sind.
            // Stufe 3: Globale Obergrenze (beste 4 je Slot nach Score) –
            //          verhindert die kombinatorische Explosion bei vielen
            //          verschiedenen Teilen. Die besten 2 Teile des Ziel-
            //          Green-Sets bleiben davon ausgenommen (Set-Schutz),
            //          damit 4p-Striker-Builds immer darstellbar sind.
            //          Max. 6 Teile/Slot -> 6^6 = 46.656 Builds statt
            //          z.B. 10^6 = 1.000.000 (Faktor ~21 schneller).
            const TOP_N_PER_SET = 3;
            const MAX_PER_SLOT = 4;
            const TARGET_KEEP = 2;
            function preFilterSlot(slotItems) {
                // #108 D: Fixierte Teile sind immer dabei und vom Pre-Filter
                // ausgenommen (auch vom Dedupe - jedes gepinnte Teil zaehlt).
                const pinnedHere = slotItems.filter(i => pinnedSet.has(String(i.id)));
                const pinnedHereIds = new Set(pinnedHere.map(i => i.id));
                slotItems = slotItems.filter(i => !pinnedHereIds.has(i.id));
                // #108 D: Abgewaehlte Exoten raus (Perk + Build-Generierung)
                slotItems = slotItems.filter(i => !isExoticGearDisabled(i));
                // Stufe 1: Item-Dedupe
                const seenItems = new Set();
                const distinct = [];
                slotItems.forEach(item => {
                    // v36: Talent & Prototyp in die Signatur – sonst kollabieren
                    // z.B. zwei identische Westen, eine mit Glaskanone, zu einem
                    // Build und der +25%-Verstärker geht verloren.
                    const sig = `${item.setName}|${item.chc}|${item.chd}|${gearCoreTypeOf(item)}|${item.wd}|${gearAttrSig(item)}|${item.namedKey || ''}|${item.namedVal || 0}|${item.talent || ''}|${item.proto ? 'p' : ''}`;
                    if (!seenItems.has(sig)) {
                        seenItems.add(sig);
                        distinct.push(item);
                    }
                });
                // Stufe 2: Top-N je Set+Attribut-Profil
                const groups = {};
                distinct.forEach(item => {
                    const key = (item.setName || '—') + '|' + gearAttrProfile(item);
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(item);
                });
                let kept = [];
                Object.values(groups).forEach(group => {
                    group.sort((a, b) => prefilterItemScore(b, targetWeaponType) - prefilterItemScore(a, targetWeaponType));
                    kept.push(...group.slice(0, TOP_N_PER_SET));
                });
                // Stufe 3: globale Obergrenze mit Ziel-Set-Schutz
                if (kept.length > MAX_PER_SLOT) {
                    const withScore = kept.map(i => ({ item: i, sc: prefilterItemScore(i, targetWeaponType) }));
                    withScore.sort((a, b) => b.sc - a.sc);
                    let final = withScore.slice(0, MAX_PER_SLOT).map(x => x.item);
                    // Issue #41: Erzwungenes Exoten-Gear ist vom globalen
                    // Cutoff ausgenommen (Set-Schutz analog Ziel-Green-Set),
                    // sonst fliegt der Exot aus der Kandidatenliste, bevor
                    // der Vergleichs-Filter ihn fordern kann.
                    if (forceExoticGear) {
                        const forced = kept.filter(i => i.setName === forceExoticGear);
                        const finalIds = new Set(final);
                        forced.forEach(i => { if (!finalIds.has(i)) final.push(i); });
                    }
                    if (targetGreenSet) {
                        const targetItems = kept
                            .filter(i => brandKeyMatches((i.setName || '').toLowerCase(), targetGreenSet))
                            .sort((a, b) => prefilterItemScore(b, targetWeaponType) - prefilterItemScore(a, targetWeaponType))
                            .slice(0, TARGET_KEEP);
                        const finalIds = new Set(final);
                        targetItems.forEach(i => { if (!finalIds.has(i)) final.push(i); });
                    }
                    kept = final;
                }
                return pinnedHere.concat(kept);
            }

            slots.forEach(s => {
                itemsBySlot[s] = preFilterSlot(items.filter(i => i.slot === s));
            });

            // Prüfen, ob alle Slots mindestens ein Item haben
            for (let s of slots) {
                if (itemsBySlot[s].length === 0) {
                    return [];
                }
            }

            let allBuilds = [];
            // Issue #44/#99: Spielregel – max. 1 exotisches Gear-Teil pro Build.
            // Exoten werden waehrend des Aufbaus gezaehlt und ungültige Zweige
            // frueh abgeschnitten, statt jede Kombination fertig zu bauen und
            // erst am Ende zu verwerfen.
            function permute(currentBuild, slotIndex, exoticCount) {
                if (slotIndex === slots.length) {
                    allBuilds.push([...currentBuild]);
                    return;
                }
                const currentSlot = slots[slotIndex];
                // #108 D: Fixierter Slot -> nur das gepinnte Teil ist Option
                const pinnedInSlot = itemsBySlot[currentSlot].filter(i => pinnedSet.has(String(i.id)));
                const candidates = pinnedInSlot.length ? pinnedInSlot : itemsBySlot[currentSlot];
                for (let item of candidates) {
                    const isExotic = isExoticGearName(item.setName) ? 1 : 0;
                    if (exoticCount + isExotic > 1) continue;
                    permute([...currentBuild, item], slotIndex + 1, exoticCount + isExotic);
                }
            }

            permute([], 0, 0);

            // ===== PERFORMANCE: Dedupe identischer Stat-Profile =====
            // Builds, die sich in keinem relevanten Wert unterscheiden
            // (gleiches Set je Slot, gleiche CHC/CHD/WD/Named-Werte),
            // sind äquivalent – nur der erste wird berechnet.
            const seen = new Set();
            const unique = [];
            allBuilds.forEach(build => {
                const sig = build.map(i => `${i.slot}:${i.setName}:${i.chc}/${i.chd}/${gearCoreTypeOf(i)}/${i.wd}/${gearAttrSig(i)}:${i.namedKey || ''}:${i.namedVal || 0}:${i.talent || ''}:${i.proto ? 'p' : ''}`).join('|');
                if (!seen.has(sig)) {
                    seen.add(sig);
                    unique.push(build);
                }
            });
            return unique;
        }

        let _combinedBtnOriginalHTML = null;

        function setCombinedBusy(busy, progressText) {
            const btn = document.getElementById('btnCombinedOptimize');
            if (!btn) return;
            const spinnerSvg = '<svg class="w-6 h-6 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path fill="currentColor" opacity="0.9" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>';
            if (busy) {
                if (_combinedBtnOriginalHTML === null) _combinedBtnOriginalHTML = btn.innerHTML;
                btn.disabled = true;
                btn.classList.add('opacity-75', 'cursor-wait');
                const label = progressText ? `Optimierung läuft … ${progressText}` : 'Optimierung läuft …';
                btn.innerHTML = spinnerSvg + '<span>' + label + '</span>';
                const resultsBox = document.getElementById('comparisonResults');
                if (resultsBox) {
                    resultsBox.innerHTML = '<div class="text-center py-10">'
                        + '<svg class="w-10 h-10 mx-auto animate-spin text-div-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path fill="currentColor" opacity="0.9" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>'
                        + '<p class="mt-3 font-semibold text-white">Optimierung läuft …</p>'
                        + '<p class="text-sm text-gray-400">Berechne alle Waffen- &amp; Build-Kombinationen</p>'
                        + '</div>';
                }
            } else {
                btn.disabled = false;
                btn.classList.remove('opacity-75', 'cursor-wait');
                if (_combinedBtnOriginalHTML !== null) btn.innerHTML = _combinedBtnOriginalHTML;
                _combinedBtnOriginalHTML = null;
                const resultsBox = document.getElementById('comparisonResults');
                if (resultsBox && resultsBox.querySelector('.animate-spin')) {
                    if (typeof renderComparison === 'function') renderComparison();
                }
            }
        }

        async function calculateCombinedComparison() {
            if (weaponsInventory.length === 0 || gearInventory.length === 0) {
                showToast('Bitte füge mindestens eine Waffe und Ausrüstung für alle 6 Slots hinzu.', 'error');
                return;
            }

            // Einstellungen auslesen
            const settings = {
                targetWeaponType: document.getElementById('targetWeaponType').value,
                specialization: document.getElementById('specialization').value,
                knowHowLevel: (() => { const kh = parseInt(document.getElementById('knowHowLevel').value, 10); return Number.isNaN(kh) ? 30 : kh; })(),
                shdMax: document.getElementById('shdMax').checked,
                shdCustomWd: document.getElementById('shdCustomWd')?.value || 0,
                shdCustomChc: document.getElementById('shdCustomChc')?.value || 0,
                shdCustomChd: document.getElementById('shdCustomChd')?.value || 0,
                require4pc: document.getElementById('require4pc').checked,
                targetGreenSet: document.getElementById('targetGreenSet').value,
                forceChest: document.getElementById('forceChest').checked,
                forceBackpack: document.getElementById('forceBackpack').checked,
                pinnedGear: [...pinnedGearIds],
                pinnedWeapon: [...pinnedWeaponIds],
                disabledExoticGear: [...disabledExoticGear],
                disabledExoticWeapons: [...disabledExoticWeapons],
                talentsActive: document.getElementById('talentsActive')?.checked || false,
                exoticPerksActive: document.getElementById('exoticPerksActive')?.checked || false
            };

            // Spinner sofort anzeigen (mit kleinem Delay, damit das UI ihn
            // zeichnen kann, bevor die rechenintensive Schleife startet)
            setCombinedBusy(true);
            await new Promise(r => requestAnimationFrame(() => setTimeout(r, 40)));

            try {
                // Alle Builds generieren
                const allBuilds = generateAllGearBuilds(gearInventory, settings.targetGreenSet, settings.targetWeaponType, '', [...pinnedGearIds]);

                // PERFORMANCE (Schritt 2): Alle waffenunabhängigen Build-Effekte
                // (Attribut-Summen, Set-/Stack-/Marken-Boni) einmal pro Build
                // vorausberechnen und über alle Waffen wiederverwenden.
                const buildCaches = new WeakMap();
                allBuilds.forEach(b => buildCaches.set(b, computeBuildCache(b, settings)));
                if (allBuilds.length === 0) {
                    // Diagnose: welcher Slot ist leer bzw. warum greifen die
                    // Set-Bedingungen nicht (4p / Weste / Rucksack erzwingen)?
                    const emptySlots = ['Maske', 'Rucksack', 'Weste', 'Handschuhe', 'Holster', 'Knieschoner']
                        .filter(s => !gearInventory.some(i => i.slot === s));
                    if (emptySlots.length) {
                        showToast('Kein Build möglich — folgende Slots haben keine Items im Inventar: ' + emptySlots.join(', ') + '. Bitte ergänze mindestens ein Teil pro Slot.', 'error');
                    } else {
                        const setPieces = gearInventory.filter(i => brandKeyMatches((i.setName || '').toLowerCase(), settings.targetGreenSet));
                        const hasChestP = setPieces.some(i => i.slot === 'Weste');
                        const hasBpP = setPieces.some(i => i.slot === 'Rucksack');
                        const hints = [];
                        if (settings.require4pc && setPieces.length < 4) hints.push(`nur ${setPieces.length} Teile des Ziel-Sets im Inventar (4 benötigt)`);
                        if (settings.forceChest && !hasChestP) hints.push('keine Set-Weste im Inventar, aber „Weste aus diesem Set erzwingen“ ist aktiv');
                        if (settings.forceBackpack && !hasBpP) hints.push('keine Set-Rucksack im Inventar, aber „Rucksack aus diesem Set erzwingen“ ist aktiv');
                        
                        showToast('Kein Build möglich — Set-Bedingungen können nicht erfüllt werden: ' + (hints.join('; ') || 'unbekannte Ursache') + '. Haken entfernen oder Set-Teile ergänzen.', 'error');
                    }
                    return;
                }

                // Top 3 Waffen berechnen
                const topWeapons = calculateTopWeapons(settings);
                if (topWeapons.length === 0) {
                    showToast(`Keine passende Waffe im Waffen-Inventar gefunden. Bitte füge eine passende Waffe hinzu, wähle eine andere Gattung oder hebe die Fixierung/Abwahl auf.`, 'error');
                    return;
                }

                // Für jede Top-Waffe die besten 3 Builds berechnen
                const results = [];
                for (let wi = 0; wi < topWeapons.length; wi++) {
                    setCombinedBusy(true, `Waffe ${wi + 1}/${topWeapons.length}`);
                    const topBuildsForWeapon = calculateTopBuildsForWeapon(topWeapons[wi], allBuilds, settings, buildCaches);
                    topBuildsForWeapon.forEach((result, index) => {
                        // BUGFIX: bisher wurden hier nur einzelne Felder kopiert
                        // (finalChc, finalChd, totalWd, ...). Felder wie talentInfo,
                        // activeBrandBoni, nonCritHit, armorMult, critHit, cappedChc
                        // und breakdown gingen dabei verloren, obwohl die Detail-
                        // ansicht sie benötigt. Spread kopiert ALLE Felder.
                        results.push({
                            ...result,
                            weapon: topWeapons[wi],
                            rank: index + 1
                        });
                    });
                    // Kurze Pause zwischen den Waffen, damit der Spinner flüssig läuft
                    await new Promise(r => setTimeout(r, 0));
                }

                // Nach DPS sortieren
                results.sort((a, b) => b.effectiveDPS - a.effectiveDPS);
                lastComparisonData = results.slice(0, 10); // Top 10 Kombinationen
                comparisonStale = false; // frisch berechnet -> nicht mehr veraltet

                // Optionaler manueller Spiel-Build: mit denselben Einstellungen
                // bewerten und für die Vergleichsansicht bereitstellen.
                manualBuildResult = null;
                try {
                    const mb = getManualBuild();
                    if (mb) {
                        const mbCache = computeBuildCache(mb.build, settings);
                        const mbResult = calculateWeaponWithBuild(mb.weapon, mb.build, settings, mbCache);
                        if (mbResult) {
                            mbResult.boniList = (mbCache.boni || []).slice();
                            mbResult.rank = 'Manuell';
                            manualBuildResult = mbResult;
                        }
                    }
                } catch (mbErr) {
                    console.warn('Manueller Build konnte nicht berechnet werden:', mbErr);
                    showToast('⚠️ Mein Spiel-Build konnte nicht berechnet werden: ' + mbErr.message, 'error');
                }

                // Perfektes Build (#124): synthetisches DB-Inventar durch dieselbe
                // Optimierung schicken und parallel zum Inventar-Ergebnis anzeigen.
                // Vor renderComparison() berechnen, damit der Schadensverlauf-Chart
                // die BiS-Vergleichskurve bereits kennt.
                try {
                    bisBuildResult = calculateBestInSlotBuild(settings);
                } catch (bisErr) {
                    console.warn('Best-in-Slot-Berechnung fehlgeschlagen:', bisErr);
                    bisBuildResult = null;
                }
                renderComparison();
                renderBestInSlotCard();
                updateTabUI();
                showToast(`Vergleich berechnet: ${lastComparisonData.length} Top-Kombinationen aus ${allBuilds.length} Build-Kandidaten (heuristische Vorauswahl: beste Teile je Slot)!`, 'success');
            } finally {
                setCombinedBusy(false);
            }
        }

        function calculateTopWeapons(settings) {
            // Nur Waffen aus dem Inventar berücksichtigen, die zur in den
            // Globalen Einstellungen gewählten Waffengattung passen (z.B.
            // "LMG"). Ohne diesen Filter würden hier die Waffen mit dem
            // höchsten geschätzten DPS-Wert aus dem GESAMTEN Inventar
            // herangezogen werden – unabhängig von ihrer Gattung.
            const pinnedIds = new Set((settings.pinnedWeapon || []).map(String));
            const weaponsOfType = pinnedIds.size
                ? weaponsInventory.filter(w => pinnedIds.has(String(w.id)))
                : weaponsInventory.filter(w => w.type === settings.targetWeaponType
                    && !(w.isExotic && disabledExoticWeapons.has(String(w.id))));
            const ep = enemyProfile();
            const knowHowLevel = settings.knowHowLevel || 30;
            const knowHowMult = 1 + (knowHowLevel / 100);
            return weaponsOfType
                .map(weapon => {
                    // v36: Deutlich realistischere Schätzung – dieselben
                    // Komponenten wie im Hauptvergleich (DTA/DTToOC/DTH
                    // gegnerprofil-gewichtet, Talent inkl. Magazin-Ø,
                    // echte RPM). Vorher war es eine reine WD/CHC/CHD-
                    // Näherung mit pauschalem ×10, wodurch z.B. die echte
                    // Nummer 1 (SOCOM Mk16 / Angespannt bei Striker+AR)
                    // nicht unter den Top-3 landete.
                    let totalWd = weapon.core1;
                    let totalChc = 0, totalChd = 0, totalDttooc = 0, totalDta = 0, totalDth = 0, totalRof = 0, totalHsd = 0;
                    [[weapon.core2Type, weapon.core2Val], [weapon.minorType, weapon.minorVal]].forEach(([type, val]) => {
                        if (type === 'chc') totalChc += (val || 0);
                        else if (type === 'chd') totalChd += (val || 0);
                        else if (type === 'dttooc') totalDttooc += (val || 0);
                        else if (type === 'dta') totalDta += (val || 0);
                        else if (type === 'dth') totalDth += (val || 0);
                        else if (type === 'rof') totalRof += (val || 0);
                        else if (type === 'hsd') totalHsd += (val || 0);
                    });
                    Object.values(getEffectiveMods(weapon)).forEach(mod => {
                        if (mod.type === 'wd') totalWd += mod.val;
                        else if (mod.type === 'hsd') totalHsd += mod.val;
                        else if (mod.type === 'chc') totalChc += mod.val;
                        else if (mod.type === 'chd') totalChd += mod.val;
                        else if (mod.type === 'dttooc') totalDttooc += mod.val;
                        else if (mod.type === 'dta') totalDta += mod.val;
                        else if (mod.type === 'dth') totalDth += mod.val;
                        else if (mod.type === 'rof') totalRof += mod.val;
                    });

                    // Talent – gleiche Logik wie im Hauptvergleich (v36: auch
                    // Magazin-Ø und type:null-Einträge aus der Talent-DB).
                    let talentAmp = 0;
                    if (weapon.talent && weapon.talent !== 'none') {
                        const rt = resolveTalentDef(weapon.talent);
                        const t = rt.t;
                        if (t) {
                            // Ohne Build-Kontext (Vorranking): bedingte Talente
                            // nur bei pauschaler Annahme aktiv; die genaue
                            // Synergie-Pruefung macht der Hauptvergleich.
                            const active = !t.conditional || !!settings.talentsActive;
                            if (active) {
                                const val = talentValueFor(rt.key, weapon.isExotic);
                                const magAvg = magazineAverageTalent(rt.key, weapon);
                                if (magAvg) { totalWd += magAvg.wd; totalChd += magAvg.chd; totalRof += magAvg.rof; }
                                else if (t.type === 'wd') totalWd += val;
                                else if (t.type === 'chd') totalChd += val;
                                else if (t.type === 'chcchd') {
                                    totalChc += (t.valueChc !== undefined && t.valueChc !== null) ? t.valueChc : val;
                                    totalChd += (t.valueChd !== undefined && t.valueChd !== null) ? t.valueChd : val;
                                }
                                else if (t.type === 'wdrof') { totalWd += val; totalRof += val; }
                                else if (t.type === 'rof') totalRof += val;
                                else if (t.type === 'amp') talentAmp += val;
                            }
                        }
                    }

                    // Issue #75: modellierte Exoten-Waffen-Talente (wie Hauptvergleich)
                    const exoWDef3 = (typeof exoticWeaponTalentDef === 'function') ? exoticWeaponTalentDef(weapon) : null;
                    const exoW3 = (typeof exoticWeaponTalentBonus === 'function') ? exoticWeaponTalentBonus(weapon) : null;
                    if (exoWDef3 && exoW3 && !(weapon.talent && weapon.talent !== 'none' && resolveTalentDef(weapon.talent).t)) {
                        totalWd += exoW3.wd; totalChc += exoW3.chc; totalChd += exoW3.chd;
                        totalRof += exoW3.rof; totalDttooc += exoW3.dttooc; totalDta += exoW3.dta;
                        talentAmp += exoW3.amp;
                    }
                    const rawHit = weapon.baseDmg * knowHowMult * (1 + (totalWd / 100)) * (1 + (talentAmp / 100));
                    // Kopfschuss-Modell (#108): identisch zum Hauptvergleich –
                    // Basis-HSD der Waffe + HSD-Boni, gewichtet mit dem
                    // Kopfschuss-Anteil des Gegnerprofils.
                    const dbEntryHsd = (typeof getWeaponDbEntry === 'function') ? getWeaponDbEntry(weapon) : null;
                    const dbHsd = (dbEntryHsd && dbEntryHsd.stats && dbEntryHsd.stats.HSD) ? dbEntryHsd.stats.HSD : 0;
                    const epHsd = ep.headshot || 0;
                    const nonCritBody = rawHit
                        * (1 + (totalDta / 100) * ep.armor)
                        * (1 + (totalDttooc / 100) * ep.ooc)
                        * (1 + (totalDth / 100) * ep.health);
                    const nonCritHit = nonCritBody * ((1 - epHsd) + epHsd * (1 + (totalHsd + dbHsd) / 100));
                    const cappedChc = Math.min(Math.max(totalChc, 0), 60);
                    const critHit = nonCritHit * (1 + (totalChd / 100));
                    const avgDmg = (nonCritHit * (1 - cappedChc / 100)) + (critHit * (cappedChc / 100));

                    // v36: echte Feuerrate (DB-RPM + Mod-RoF + Talent-RoF) –
                    // Waffen unterschiedlicher RPM werden korrekt gereiht.
                    // weaponEffectiveRpm rechnet Mod-RoF selbst mit ein, daher
                    // hier nur den Talent-RoF-Anteil übergeben.
                    const modRof = modAttrTotal(weapon, 'rof') || 0;
                    const talentRof = Math.max(0, totalRof - modRof);
                    const rpmInfo = weaponEffectiveRpm(weapon, talentRof);
                    // Reload/Magazin (#108): Sustain-Faktor (Feuerzeit vs.
                    // Feuerzeit + Nachladezeit) auch im Waffen-Vorranking,
                    // damit z.B. kleinem Magazin + langem Reload nicht mehr
                    // Burst-DPS das Ranking diktieren.
                    let sustainMult = 1;
                    if (rpmInfo && rpmInfo.rpm && typeof weaponSustainFactor === 'function') {
                        const sf = weaponSustainFactor(weapon, rpmInfo.rpm, 0);
                        if (sf) sustainMult = sf;
                    }
                    const effDPS = (rpmInfo && rpmInfo.rpm) ? avgDmg * (rpmInfo.rpm / 60) * sustainMult : avgDmg * 10;

                    return {
                        ...weapon,
                        estimatedDPS: effDPS,
                        totalChc: totalChc,
                        totalChd: totalChd,
                        totalWd: totalWd
                    };
                })
                .sort((a, b) => b.estimatedDPS - a.estimatedDPS)
                .slice(0, 5);
        }

        // ========== MANUELLER SPIEL-BUILD (OPTIONAL) ==========
        // Füllt die Auswahl-Dropdowns für den manuellen Build aus dem
        // Inventar. Wird bei jedem Vergleichslauf aktualisiert; bisherige
        // Auswahl bleibt (sofern das Teil noch existiert) erhalten.
        function populateManualBuildSelects() {
            const wSel = document.getElementById('manualWeaponSelect');
            if (!wSel) return;
            // Kurz-Werte einer Waffe für die Dropdown-Anzeige
            const weaponValueText = w => {
                const parts = [];
                if (w.core1) parts.push(`${formatGermanNumber(w.core1)}% WD`);
                if (w.core2Val) parts.push(`${formatGermanNumber(w.core2Val)}% ${String(w.core2Type || '').toUpperCase()}`);
                if (w.minorVal) parts.push(`${formatGermanNumber(w.minorVal)}% ${String(w.minorType || '').toUpperCase()}`);
                return parts.join(' · ');
            };
            const prevWeapon = wSel.value;
            wSel.innerHTML = '<option value="">— keine —</option>' + weaponsInventory
                .slice().sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'de') : a.type.localeCompare(b.type, 'de')))
                .map(w => `<option value="${w.id}">${escapeHtml(weaponTypeLabel(w.type) + ' · ' + w.name)}${w.isExotic ? ' 🟠' : (weaponIsNamed(w) ? ' 🟡' : '')}${weaponValueText(w) ? ' (' + escapeHtml(weaponValueText(w)) + ')' : ''}</option>`).join('');
            if (prevWeapon && weaponsInventory.some(w => String(w.id) === prevWeapon)) wSel.value = prevWeapon;

            ['Maske', 'Weste', 'Rucksack', 'Handschuhe', 'Holster', 'Knieschoner'].forEach(slot => {
                const sel = document.getElementById('manualGearSelect_' + slot);
                if (!sel) return;
                const prev = sel.value;
                const items = gearInventory.filter(i => i.slot === slot);
                // Kurz-Werte eines Gear-Teils: Kern + CHC/CHD + ggf. Named-Bonus
                const gearValueText = i => {
                    const parts = [];
                    const cd = gearCoreDisplay(i);
                    if (cd && cd !== '—') parts.push(cd);
                    if (i.chc) parts.push(`${formatGermanNumber(i.chc)}% CHC`);
                    if (i.chd) parts.push(`${formatGermanNumber(i.chd)}% CHD`);
                    if (i.namedKey && i.namedVal > 0) parts.push(`+${formatGermanNumber(i.namedVal)}% ${String(i.namedKey).toUpperCase()}`);
                    const other = gearOtherAttrsText(i);
                    if (other) parts.push(other);
                    return parts.join(' · ');
                };
                sel.innerHTML = '<option value="">— leer —</option>' + items
                    .slice().sort((a, b) => (a.setName || '').localeCompare(b.setName || '', 'de'))
                    .map(i => `<option value="${i.id}">${escapeHtml((i.setName || '') + ' · ' + slot)}${(GEAR_DB[i.setName] && GEAR_DB[i.setName].cls === 'exotic') ? ' 🟠' : ((GEAR_DB[i.setName] && GEAR_DB[i.setName].cls === 'named') ? ' 🟡' : '')}${gearValueText(i) ? ' (' + escapeHtml(gearValueText(i)) + ')' : ''}</option>`).join('');
                if (prev && items.some(i => String(i.id) === prev)) sel.value = prev;
            });
        }

        // Liest die Auswahl und gibt { weapon, build } zurück — oder null,
        // wenn die Option deaktiviert oder keine Waffe gewählt ist.
        function getManualBuild() {
            const enabled = document.getElementById('manualBuildEnabled');
            if (!enabled || !enabled.checked) return null;
            populateManualBuildSelects();
            const wSel = document.getElementById('manualWeaponSelect');
            const weapon = wSel && wSel.value ? weaponsInventory.find(w => String(w.id) === wSel.value) : null;
            if (!weapon) return null;
            const build = [];
            ['Maske', 'Weste', 'Rucksack', 'Handschuhe', 'Holster', 'Knieschoner'].forEach(slot => {
                const sel = document.getElementById('manualGearSelect_' + slot);
                if (!sel || !sel.value) return;
                const item = gearInventory.find(i => String(i.id) === sel.value && i.slot === slot);
                if (item) build.push(item);
            });
            return { weapon: weapon, build: build };
        }

        // Vergleichsdarstellung: Mein Build vs. beste Optimizer-Kombination
        function renderManualBuildComparison(best) {
            const mb = manualBuildResult;
            if (!mb || !best) return '';
            const fmt = v => formatGermanNumber(Math.round(v));
            const pct = (a, b) => {
                if (!b) return '—';
                const d = (a / b - 1) * 100;
                return (d >= 0 ? '+' : '') + formatGermanNumber(Math.round(d * 10) / 10) + '%';
            };
            const rows = [
                ['Ø Schaden pro Kugel', fmt(mb.avgDmg), fmt(best.avgDmg), mb.avgDmg >= best.avgDmg],
                ['Effektiver DPS', fmt(mb.effectiveDPS), fmt(best.effectiveDPS), mb.effectiveDPS >= best.effectiveDPS],
                ['Waffenschaden (WD)', '+' + fmt(mb.totalWd) + '%', '+' + fmt(best.totalWd) + '%', mb.totalWd >= best.totalWd],
                ['Krit-Chance (effektiv)', fmt(Math.min(mb.finalChc, 60)) + '%', fmt(Math.min(best.finalChc, 60)) + '%', mb.finalChc >= best.finalChc],
                ['Krit-Schaden', '+' + fmt(mb.finalChd) + '%', '+' + fmt(best.finalChd) + '%', mb.finalChd >= best.finalChd],
                ['Rüstungs-Multiplikator (DTA/DTToOC)', '×' + formatGermanNumber(Math.round(mb.armorMult * 100) / 100), '×' + formatGermanNumber(Math.round(best.armorMult * 100) / 100), mb.armorMult >= best.armorMult]
            ];
            const dpsDelta = (mb.effectiveDPS / (best.effectiveDPS || 1) - 1) * 100;
            const verdict = dpsDelta >= 0
                ? `<span class="text-emerald-400 font-bold">Dein Build liegt mit +${formatGermanNumber(Math.round(dpsDelta * 10) / 10)}% DPS vorne</span>`
                : `<span class="text-amber-400 font-bold">Die beste Kombination liegt +${formatGermanNumber(Math.round(-dpsDelta * 10) / 10)}% DPS vor dir</span>`;
            return `
                <div class="mt-6 p-4 bg-zinc-900/80 rounded-lg border border-emerald-700/40">
                    <h4 class="text-sm font-bold text-div-accent mb-3 flex flex-wrap items-center gap-2">
                        🎮 Mein Spiel-Build vs. 🏆 Beste Optimizer-Kombination
                        <span class="text-[11px] font-normal text-gray-500">(gleiche Annahmen: Know-How, SHD, Spezialisierung, Gegnerprofil, Stack-Auslastung)</span>
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div class="p-3 bg-zinc-800/60 rounded border border-emerald-700/30">
                            <p class="text-xs font-bold text-emerald-400 mb-1">🎮 Mein Spiel-Build</p>
                            <p class="text-sm text-white font-semibold">${escapeHtml(mb.weapon.name)}</p>
                            <p class="text-[11px] text-gray-400">${mb.build.map(i => escapeHtml((i.setName || '?') + ' (' + i.slot + ')')).join(' · ') || '— keine Ausrüstung gewählt —'}</p>
                            <p class="text-[10px] text-gray-500 mt-1">${(mb.boniList || []).slice(0, 4).map(escapeHtml).join(' · ')}${(mb.boniList || []).length > 4 ? ' …' : ''}</p>
                        </div>
                        <div class="p-3 bg-zinc-800/60 rounded border border-gray-700">
                            <p class="text-xs font-bold text-gray-400 mb-1">🏆 Beste Kombination (#1)</p>
                            <p class="text-sm text-white font-semibold">${escapeHtml(best.weapon.name)}</p>
                            <p class="text-[11px] text-gray-400">${best.build.map(i => escapeHtml((i.setName || '?') + ' (' + i.slot + ')')).join(' · ')}</p>
                        </div>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-xs">
                            <thead>
                                <tr class="text-left text-gray-400 border-b border-gray-800">
                                    <th class="py-1.5 pr-2">Kennwert</th>
                                    <th class="py-1.5 pr-2">🎮 Mein Build</th>
                                    <th class="py-1.5 pr-2">🏆 Beste</th>
                                    <th class="py-1.5">Delta</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows.map(([label, mv, bv]) => `<tr class="border-b border-gray-800/50">
                                    <td class="py-1.5 pr-2 text-gray-400">${label}</td>
                                    <td class="py-1.5 pr-2 font-mono text-white">${mv}</td>
                                    <td class="py-1.5 pr-2 font-mono text-gray-300">${bv}</td>
                                    <td class="py-1.5 font-mono">${pct(parseFloat(String(mv).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0, parseFloat(String(bv).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0)}</td>
                                </tr>`).join('')}
                                <tr class="border-t border-gray-700">
                                    <td class="py-2 pr-2 font-semibold text-gray-300">DPS-Gesamturteil</td>
                                    <td colspan="3" class="py-2">${verdict}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p class="text-[10px] text-gray-500 mt-2">Hinweis: Der manuelle Build nutzt dieselbe Mod-Empfehlung (CHC/CHD-Verteilung) und Stack-Annahme wie die Optimizer-Kombination. Die Delta-Spalte bezieht sich zeilenweise auf den jeweiligen Kennwert („+x%“ = dein Build höher).</p>
                </div>
            `;
        }

        function calculateTopBuildsForWeapon(weapon, allBuilds, settings, buildCaches) {
            const validBuilds = allBuilds.filter(build => {
                const targetSetCount = getBrandCount(build, settings.targetGreenSet);
                if (settings.require4pc && targetSetCount < 4) return false;

                const hasChest = build.some(i => i.slot === 'Weste' && brandKeyMatches((i.setName || '').toLowerCase(), settings.targetGreenSet));
                const hasBackpack = build.some(i => i.slot === 'Rucksack' && brandKeyMatches((i.setName || '').toLowerCase(), settings.targetGreenSet));

                if (settings.forceChest && !hasChest) return false;
                if (settings.forceBackpack && !hasBackpack) return false;
                const pinnedIdsBuild = new Set((settings.pinnedGear || []).map(String));
                if (pinnedIdsBuild.size && ![...pinnedIdsBuild].every(id => build.some(i => String(i.id) === id))) return false;

                return true;
            });

            if (validBuilds.length === 0) return [];

            // PERFORMANCE: Build-Caches wiederverwenden, falls vorausberechnet
            // (calculateCombinedComparison), sonst lokal einmal pro Build.
            const caches = buildCaches || new WeakMap();
            const cacheFor = b => {
                if (!caches.has(b)) caches.set(b, computeBuildCache(b, settings));
                return caches.get(b);
            };

            return validBuilds
                .map(build => calculateWeaponWithBuild(weapon, build, settings, cacheFor(build)))
                .filter(r => r !== null)
                .sort((a, b) => b.effectiveDPS - a.effectiveDPS)
                .slice(0, 3);
        }

        // Rendert die Herkunfts-Aufschlüsselung für CHC/CHD/WD in der
        // Detailansicht ("Beste Kombination"), damit Anwender nachvollziehen
        // können, wie sich die Summen zusammensetzen.
        // ===== Stack-Schadensverlauf (Visualisierung) =====
        // Zeichnet für Stack-abhängige Sets (Striker, Heartbreaker,
        // Concentrated Company) den Ø-Schaden pro Kugel über den Stack-Aufbau
        // — jeweils in 4 Varianten: ohne Weste/Rucksack, nur Weste, nur
        // Rucksack, beide. Die Waffe (inkl. Talent-Boni und effektiver
        // Feuerrate aus der DB) fließt mit ein: die X-Achse ist die reale
        // Zeit in Sekunden (1 Stack pro Treffer).
        function effectiveChartRpm(weapon) {
            let rofPct = modAttrTotal(weapon, 'rof');
            if (weapon.talent && weapon.talent !== 'none') {
                const rt = resolveTalentDef(weapon.talent);
                const t = rt.t;
                if (t && t.type) {
                    const magAvg = magazineAverageTalent(rt.key, weapon);
                    if (magAvg) rofPct += magAvg.rof;
                    else if (t.type === 'rof' || t.type === 'wdrof') rofPct += talentValueFor(rt.key, weapon.isExotic);
                }
            }
            return weaponEffectiveRpm(weapon, rofPct);
        }

        function renderStackDamageChart(best) {
            const targetSet = (typeof document !== 'undefined' && document.getElementById('targetGreenSet')) ? document.getElementById('targetGreenSet').value : '';
            const conf = STACK_DAMAGE_CONFIG[targetSet || ''];
            if (!conf || !best.stackInfo || !best.nonCritHit || !best.avgDmg) return '';
            const si = best.stackInfo;
            const basePerWd = conf.perStackWd || 0;
            const basePerChd = conf.perStackChd || 0;
            const basePerRof = conf.perStackRof || 0;
            const flatAmp = conf.flatAmp || 0;
            const chestFlatAmp = (conf.chestTalent && conf.chestTalent.flatAmp) ? conf.chestTalent.flatAmp
                : (conf.chestTalent && conf.chestTalent.ampMult) ? flatAmp * conf.chestTalent.ampMult : flatAmp;
            // Zeit- statt Treffer-Achse: Manche Sets bauen Stacks zeitlich
            // auf (Umbra: +10/s in Deckung) statt pro Treffer.
            const gainPerSec = conf.stackGainPerSec || 0;
            // Schaden pro Kugel: WD-Stacks sind additiv in totalWd (Faktor
            // herausrechnen), CHD-Stacks erhöhen die Krit-Erwartung. Beides
            // kann kombiniert auftreten (Concentrated Company).
            const nonCritNoStack = ((si.wd || 0) > 0 ? best.nonCritHit / (1 + (si.wd || 0) / 100) : best.nonCritHit)
                / (1 + (si.flatAmp || 0) / 100);
            const chcFrac = (best.cappedChc || 0) / 100;
            const chd0 = (best.finalChd || 0) - (si.chd || 0);
            const dmgAt = (stacks, perWd, perChd, flat) =>
                nonCritNoStack * (1 + (stacks * perWd) / 100) * (1 + ((flat || 0)) / 100) *
                ((1 - chcFrac) + (1 + (chd0 + stacks * perChd) / 100) * chcFrac);
            // 4 Varianten: Weste erhöht maxStacks oder flatAmp (Ongoing
            // Directive, Aces & Eights, Virtuoso), Rucksack erhöht perStack
            const hasChestT = !!(conf.chestTalent && (conf.chestTalent.maxStacks || conf.chestTalent.flatAmp || conf.chestTalent.ampMult));
            const hasBpT = !!(conf.backpackTalent && (conf.backpackTalent.perStackWd || conf.backpackTalent.perStackChd || conf.backpackTalent.perStackRof));
            const bpPerWd = conf.backpackTalent ? (conf.backpackTalent.perStackWd || basePerWd) : basePerWd;
            const bpPerChd = conf.backpackTalent ? (conf.backpackTalent.perStackChd || basePerChd) : basePerChd;
            const bpPerRof = conf.backpackTalent ? (conf.backpackTalent.perStackRof || basePerRof) : basePerRof;
            const variants = [];
            variants.push({ key: 'base', label: 'Ohne Set-Weste & -Rucksack', max: conf.maxStacks, perWd: basePerWd, perChd: basePerChd, perRof: basePerRof, flat: flatAmp, color: '#9ca3af' });
            if (hasChestT) variants.push({ key: 'chest', label: conf.chestTalent.label, max: conf.chestTalent.maxStacks || conf.maxStacks, perWd: basePerWd, perChd: basePerChd, perRof: basePerRof, flat: chestFlatAmp, color: '#ff6600' });
            if (hasBpT) variants.push({ key: 'bp', label: conf.backpackTalent.label, max: conf.maxStacks, perWd: bpPerWd, perChd: bpPerChd, perRof: bpPerRof, flat: flatAmp, color: '#38bdf8' });
            if (hasChestT && hasBpT) variants.push({ key: 'both', label: conf.chestTalent.label + ' + ' + conf.backpackTalent.label, max: conf.chestTalent.maxStacks || conf.maxStacks, perWd: bpPerWd, perChd: bpPerChd, perRof: bpPerRof, flat: chestFlatAmp, color: '#34d399' });

            const rpmInfo = effectiveChartRpm(best.weapon);
            const rpm = rpmInfo && rpmInfo.rpm ? rpmInfo.rpm : null;
            const shotSec = rpm ? (60 / rpm) : null;
            // X-Achse: 1 Stack pro Treffer (Standard) oder zeitlicher Aufbau
            // X-Achse: 1 Stack pro Treffer (Standard), zeitlicher Aufbau
            // (Umbra) oder Kill-basiert (nur Stack-Zählung, keine Zeitachse)
            const secPerStack = gainPerSec ? (1 / gainPerSec) : (conf.killBased ? null : shotSec);

            // Datenpunkte je Variante: 1 Stack pro Treffer
            variants.forEach(v => {
                v.points = [];
                const step = Math.max(1, Math.ceil(v.max / 100));
                for (let s = 0; s <= v.max; s += step) {
                    v.points.push({ s: s, dmg: dmgAt(s, v.perWd, v.perChd, v.flat) });
                }
                if (v.points[v.points.length - 1].s !== v.max) v.points.push({ s: v.max, dmg: dmgAt(v.max, v.perWd, v.perChd, v.flat) });
            });

            // Perfektes Build (#124): BiS-Kurve mit denselben Stack-Parametern
            // wie der aktive Build, aber mit den BiS-Werten (gestrichelt, gold).
            const bisRes = (typeof bisBuildResult !== 'undefined') ? bisBuildResult : null;
            let bisPoints = null;
            if (bisRes && bisRes.result && bisRes.result.stackInfo && bisRes.result.nonCritHit) {
                const bsi = bisRes.result.stackInfo;
                const bisNonCritNoStack = ((bsi.wd || 0) > 0 ? bisRes.result.nonCritHit / (1 + (bsi.wd || 0) / 100) : bisRes.result.nonCritHit)
                    / (1 + (bsi.flatAmp || 0) / 100);
                const bisChcFrac = Math.min(bisRes.result.cappedChc || 0, 60) / 100;
                const bisChd0 = (bisRes.result.finalChd || 0) - (bsi.chd || 0);
                const bisDmgAt = (stacks, perWd, perChd, flat) =>
                    bisNonCritNoStack * (1 + (stacks * perWd) / 100) * (1 + ((flat || 0)) / 100) *
                    ((1 - bisChcFrac) + (1 + (bisChd0 + stacks * perChd) / 100) * bisChcFrac);
                const curVariant = variants.find(v => (v.max === si.maxStacks) && (v.perWd === (si.perStackWd || 0)) && (v.perChd === (si.perStackChd || 0)) && (v.flat === (si.flatAmp || 0))) || variants[0];
                const stepB = Math.max(1, Math.ceil(curVariant.max / 100));
                bisPoints = [];
                for (let s = 0; s <= curVariant.max; s += stepB) {
                    bisPoints.push({ s, dmg: bisDmgAt(s, curVariant.perWd, curVariant.perChd, curVariant.flat) });
                }
                if (bisPoints[bisPoints.length - 1].s !== curVariant.max) bisPoints.push({ s: curVariant.max, dmg: bisDmgAt(curVariant.max, curVariant.perWd, curVariant.perChd, curVariant.flat) });
            }
            const maxTime = secPerStack ? secPerStack * Math.max(...variants.map(v => v.max)) : Math.max(...variants.map(v => v.max));
            let yMin = dmgAt(0, basePerWd, basePerChd), yMax = Math.max(...variants.map(v => dmgAt(v.max, v.perWd, v.perChd, v.flat)));
            if (bisPoints && bisPoints.length) {
                yMin = Math.min(yMin, bisPoints[0].dmg);
                yMax = Math.max(yMax, bisPoints[bisPoints.length - 1].dmg);
            }
            const W = 800, H = 300, padL = 70, padR = 16, padT = 16, padB = 40;
            const px = s => padL + ((secPerStack ? s * secPerStack : s) / maxTime) * (W - padL - padR);
            const py = d => H - padB - ((d - yMin) / ((yMax - yMin) || 1)) * (H - padT - padB);

            let grid = '', labels = '';
            const ySteps = 5;
            for (let i = 0; i <= ySteps; i++) {
                const d = yMin + (i / ySteps) * (yMax - yMin);
                const y = py(d);
                grid += `<line class="stack-chart-grid" x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"></line>`;
                labels += `<text class="stack-chart-label" x="${padL - 6}" y="${y + 4}" text-anchor="end">${(d / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}k</text>`;
            }
            const xSteps = 5;
            for (let i = 0; i <= xSteps; i++) {
                const t = (i / xSteps) * maxTime;
                const x = padL + (i / xSteps) * (W - padL - padR);
                grid += `<line class="stack-chart-grid" x1="${x}" y1="${padT}" x2="${x}" y2="${H - padB}"></line>`;
                labels += `<text class="stack-chart-label" x="${x}" y="${H - padB + 16}" text-anchor="middle">${secPerStack ? t.toFixed(1) + 's' : Math.round(t)}</text>`;
            }
            labels += `<text class="stack-chart-label" x="${(W + padL) / 2}" y="${H - 6}" text-anchor="middle">${gainPerSec ? 'Zeit (Sekunden, ' + formatGermanNumber(gainPerSec) + ' Stacks/s in Deckung)' : (conf.killBased ? 'Kills (+1 Stack je Kill eines markierten/debufften Gegners)' : (rpm ? 'Zeit (Sekunden, 1 Stack pro Treffer @ ' + formatGermanNumber(Math.round(rpm)) + ' RPM)' : 'Treffer (keine RPM-Daten in der DB)'))}</text>`;

            let paths = '';
            variants.forEach(v => {
                const isCurrent = (v.max === si.maxStacks) && (v.perWd === (si.perStackWd || 0)) && (v.perChd === (si.perStackChd || 0)) && (v.flat === (si.flatAmp || 0));
                const d = v.points.map((p, i) => (i === 0 ? 'M' : 'L') + px(p.s).toFixed(1) + ',' + py(p.dmg).toFixed(1)).join(' ');
                const w = isCurrent ? 3.5 : 1.8;
                const op = isCurrent ? 1 : 0.55;
                paths += `<path d="${d}" fill="none" stroke="${v.color}" stroke-width="${w}" opacity="${op}" ${isCurrent ? '' : 'stroke-dasharray="4 3"'}></path>`;
                const last = v.points[v.points.length - 1];
                paths += `<circle class="stack-chart-point" cx="${px(last.s).toFixed(1)}" cy="${py(last.dmg).toFixed(1)}" r="4" fill="${v.color}"></circle>`;
                paths += `<text class="stack-chart-value" x="${Math.min(px(last.s) + 6, W - padR - 60).toFixed(1)}" y="${(py(last.dmg) - 8).toFixed(1)}">${(last.dmg / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}k</text>`;
                // Zusätzliche Marker bei 25/50/75% der max. Stacks (aktiver Build)
                if (isCurrent && v.max >= 4) {
                    [0.25, 0.5, 0.75].forEach(fr => {
                        const s = Math.round(v.max * fr);
                        const d = dmgAt(s, v.perWd, v.perChd, v.flat);
                        const lx = Math.min(px(s), W - padR - 70);
                        paths += `<circle class="stack-chart-point" cx="${px(s).toFixed(1)}" cy="${py(d).toFixed(1)}" r="3" fill="${v.color}" opacity="0.85"></circle>`;
                        paths += `<text class="stack-chart-value" x="${lx.toFixed(1)}" y="${(py(d) - 6).toFixed(1)}" opacity="0.9">${s} St: ${(d / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}k</text>`;
                    });
                }
            });

            // BiS-Kurve zeichnen: gold, gestrichelt, mit Endpunkt-Wert
            if (bisPoints && bisPoints.length) {
                const d = bisPoints.map((p, i) => (i === 0 ? 'M' : 'L') + px(p.s).toFixed(1) + ',' + py(p.dmg).toFixed(1)).join(' ');
                paths += `<path d="${d}" fill="none" stroke="#fbbf24" stroke-width="2" stroke-dasharray="6 4" opacity="0.9"></path>`;
                const last = bisPoints[bisPoints.length - 1];
                paths += `<circle class="stack-chart-point" cx="${px(last.s).toFixed(1)}" cy="${py(last.dmg).toFixed(1)}" r="4" fill="#fbbf24"></circle>`;
                paths += `<text class="stack-chart-value" x="${Math.min(px(last.s) + 6, W - padR - 60).toFixed(1)}" y="${(py(last.dmg) - 8).toFixed(1)}" fill="#fbbf24">${(last.dmg / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}k</text>`;
            }
            const legend = variants.map(v => {
                const isCurrent = (v.max === si.maxStacks) && (v.perWd === (si.perStackWd || 0)) && (v.perChd === (si.perStackChd || 0)) && (v.flat === (si.flatAmp || 0));
                return `<span class="inline-flex items-center gap-1.5 ${isCurrent ? 'font-bold text-white' : 'text-gray-400'}">
                    <span style="display:inline-block;width:18px;height:3px;background:${v.color};${isCurrent ? '' : 'opacity:.55'}"></span>
                    ${escapeHtml(v.label)} <span class="text-[10px] text-gray-500">(max. ${v.max} × ${[v.perWd ? `+${formatGermanNumber(v.perWd)}% WD` : '', v.perChd ? `+${formatGermanNumber(v.perChd)}% CHD` : '', v.perRof ? `+${formatGermanNumber(v.perRof)}% RPM` : ''].filter(Boolean).join(' & ')}/Stack)</span>
                    ${isCurrent ? '<span class="text-[10px] text-div-accent">◄ dieser Build</span>' : ''}
                </span>`;
            }).join('<span class="text-gray-600 mx-2">·</span>')
            + ((bisPoints && bisPoints.length) ? '<span class="text-gray-600 mx-2">·</span><span class="inline-flex items-center gap-1.5 font-bold text-amber-400"><span style="display:inline-block;width:18px;height:3px;background:#fbbf24;opacity:.9"></span>Perfektes Build (BiS) <span class="text-[10px] text-gray-500">— Maximum aus der DB zum Vergleich</span></span>' : '');

            const tFull = secPerStack ? (si.maxStacks * secPerStack).toFixed(1) + 's' : si.maxStacks + (conf.killBased ? ' Kills' : ' Treffer');
            return `
                <div class="stack-chart-wrap mt-6">
                    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <p class="text-sm font-bold text-div-accent">📈 ${conf.name}: Schadensverlauf beim Stack-Aufbau — Ø Schaden pro Kugel</p>
                        <p class="text-[11px] text-gray-400">${escapeHtml(best.weapon.name)} · volle Stacks nach ${tFull}${rpm ? ` (${formatGermanNumber(Math.round(rpm))} RPM eff.)` : ''}</p>
                    </div>
                    <svg class="stack-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img">
                        ${grid}${labels}${paths}
                    </svg>
                    <div class="text-[11px] mt-2 flex flex-wrap gap-x-2">${legend}</div>
                    <p class="text-[10px] text-gray-500 mt-1">Annahme: ${gainPerSec ? 'zeitlicher Stack-Aufbau (in Deckung)' : (conf.killBased ? '1 Stack pro Kill eines markierten/debufften Gegners; Stack-Verfall ignoriert' : '1 Stack pro Treffer, kein Stack-Verlust durch Fehlschüsse')}${flatAmp > 0 ? `; der Basis-Verstärker von +${formatGermanNumber(flatAmp)}% ist in jedem Datenpunkt enthalten` : ''}. Y-Achse: Ø-Schaden pro Kugel (inkl. Krit-Erwartung, Waffen-Talente, Rüstungs-/Ungedeckt-Multiplikatoren). X-Achse: ${gainPerSec ? 'reale Zeit' : (conf.killBased ? 'Kills' : 'reale Zeit aus der effektiven Feuerrate')}. Gestrichelte Linien = Varianten, die dieser Build NICHT nutzt.${conf.perStackRof ? ' Feuerraten-Anteil (+' + formatGermanNumber(conf.perStackRof) + '% RPM/Stack) erhöht den DPS, nicht den Schaden pro Kugel — daher flacht die Kurve nur mit dem CHD-Anteil ab.' : ''}${conf.perStackWh ? ' Waffenhandhabungs-Bonus pro Stack (+' + formatGermanNumber(conf.perStackWh) + '%/Stack) fließt über das Nachladetempo in den zeitlichen Schaden (Sustain-Faktor) ein.' : ''}${conf.chestTalent && conf.chestTalent.marks ? ` ${conf.chestTalent.label}: nur mehr Markierungen (${conf.chestTalent.marks}), keine Auswirkung auf die Kurve.` : ''}</p>
                </div>
            `;
        }

        function renderBreakdownSection(best) {
            const bd = best.breakdown;
            if (!bd) return '';
            const fmt = v => formatGermanNumber(Math.round(v * 100) / 100);

            const SOURCES = [
                ['weapon', '🔫 Waffe (Kerne, Attribute & Waffen-Mods)'],
                ['talent', '⭐ Waffen-Talent'],
                ['gear', '🎒 Ausrüstungs-Attribute (6 Teile)'],
                ['named', '🦊 Named-Items (Coyote, Memento, …)'],
                ['shd', '🕰️ SHD-Uhr'],
                ['spec', '🎖️ Spezialisierung'],
                ['stack', '🔥 4p-Stack-Schaden'],
                ['setBrand', '🟩 Set- & Marken-Boni (2p/3p/4p)'],
                ['knowhow', '🧠 Know-How-Level'],
                ['mods', '🔧 Mods (angenommen)']
            ];

            function columnTitle(key) {
                if (key === 'chc') return 'Krit-Chance (CHC)';
                if (key === 'chd') return 'Krit-Schaden (CHD)';
                return 'Waffenschaden (WD)';
            }

            function column(key, totalValue) {
                let rows = '';
                let sum = 0;
                SOURCES.forEach(([srcKey, label]) => {
                    const src = bd[srcKey];
                    if (!src) return;
                    let val = 0;
                    let detail = label;
                    if (srcKey === 'mods') {
                        if (key === 'chc') val = src.chcCount * 6;
                        else if (key === 'chd') val = src.chdCount * 12;
                    } else {
                        val = src[key] || 0;
                    }
                    if (srcKey === 'knowhow') {
                        // Know-How gibt nur Waffenschaden, KEIN CHC/CHD.
                        if (key !== 'wd') return;
                        // Know-How wirkt NICHT additiv in totalWd, sondern
                        // multiplikativ als eigener Grundschaden-Faktor.
                        // Zeile anzeigen, aber aus der Summe heraushalten.
                        const khDetail = `🧠 Know-How-Level (${best.knowHowLevel || 0})`;
                        rows += `<li class="flex justify-between gap-2"><span class="text-gray-400">${khDetail}</span><span class="font-mono text-gray-200">+${fmt(val)}% <span class="text-[10px] text-amber-400">(separat ×${(1 + val / 100).toFixed(2).replace('.', ',')} auf Grundschaden)</span></span></li>`;
                        return;
                    }
                    if (Math.round(val * 100) === 0) return;
                    sum += val;
                    if (srcKey === 'mods') {
                        const cnt = key === 'chc' ? src.chcCount : src.chdCount;
                        const per = key === 'chc' ? 6 : 12;
                        detail = `🔧 Mods (${cnt}× ${key === 'chc' ? 'CHC' : 'CHD'}-Mod à +${per}%)`;
                    }
                    if (srcKey === 'stack' && best.stackInfo) {
                        const si = best.stackInfo;
                        detail = `🔥 ${si.name} (${si.stacks}/${si.maxStacks} Stacks × ${[si.perStackWd ? `${formatGermanNumber(si.perStackWd)}% WD` : '', si.perStackChd ? `${formatGermanNumber(si.perStackChd)}% CHD` : '', si.perStackRof ? `${formatGermanNumber(si.perStackRof)}% RPM` : ''].filter(Boolean).join(' & ')}${si.hasChest ? ', Weste aktiv' : ''}${si.hasBackpack ? ', Rucksack aktiv' : ''})`;
                    }
                    rows += `<li class="flex justify-between gap-2"><span class="text-gray-400">${detail}</span><span class="font-mono text-gray-200">+${fmt(val)}%</span></li>`;
                });
                const isChc = key === 'chc';
                const capped = isChc && best.finalChc > 60;
                return `
                    <div class="p-3 bg-zinc-900/80 rounded-lg border border-gray-800">
                        <p class="text-xs font-bold uppercase text-gray-400 mb-2">${columnTitle(key)}</p>
                        <ul class="text-[11px] space-y-1">${rows || '<li class="text-gray-600">— keine Quellen —</li>'}</ul>
                        <div class="mt-2 pt-2 border-t border-gray-800 flex justify-between text-xs">
                            <span class="text-gray-300 font-semibold">Summe</span>
                            <span class="font-mono font-bold ${capped ? 'text-amber-400' : 'text-white'}">+${fmt(totalValue)}%</span>
                        </div>
                        ${capped ? `<p class="text-[10px] text-amber-400 mt-1">⚠ effektiv nur ${fmt(best.cappedChc)}% (60%-Cap)</p>` : ''}
                        ${key === 'wd' && (best.knowHowLevel || 0) > 0 ? `<p class="text-[10px] text-gray-500 mt-1">ℹ Summe × ${(1 + (best.knowHowLevel || 0) / 100).toFixed(2).replace('.', ',')} (Know-How) = effektiv +${fmt(((1 + totalValue / 100) * (1 + (best.knowHowLevel || 0) / 100) - 1) * 100)}% auf den Grundschaden.</p>` : ''}
                    </div>
                `;
            }

            return `
                <div class="mt-6">
                    <h4 class="text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
                        📊 Herkunft der Werte <span class="text-[11px] font-normal text-gray-500">(wie setzen sich CHC, CHD &amp; Waffenschaden zusammen?)</span>
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                        ${column('chc', best.finalChc)}
                        ${column('chd', best.finalChd)}
                        ${column('wd', best.totalWd)}
                    </div>
                    ${best.activeBrandBoni && best.activeBrandBoni.length ? `
                        <div class="mt-3 p-3 bg-zinc-900/80 rounded-lg border border-gray-800">
                            <p class="text-xs font-bold uppercase text-gray-400 mb-1">Aktive Boni im Detail</p>
                            <ul class="text-[11px] text-gray-400 space-y-0.5 list-disc list-inside pl-2">
                                ${best.activeBrandBoni.map(b => `<li>${escapeHtml(b)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // ========== PERFEKTES BUILD / BEST-IN-SLOT (#124) ==========
        // Synthetisiert ein "ideales Inventar" aus den JSON-Datenbanken
        // (GEAR_DB: Named/Exotic + Brand-Fragmente + Green-Set-Teile, alle
        // Werte auf God-Roll-Maxima) und schickt es durch dieselbe
        // Optimierungs-Pipeline wie das echte Inventar. Ergebnis: das
        // theoretisch beste Build unter den aktuellen Einstellungen
        // (Ziel-Set, Gattung, Know-How, SHD, Gegnerprofil, Set-Zwänge).
        let bisBuildResult = null;
        const BIS_SLOT_ORDER = ['Maske', 'Weste', 'Rucksack', 'Handschuhe', 'Holster', 'Knieschoner'];
        function bisAttrMax(type, proto) {
            const cfg = GEAR_ATTR_TYPES[type];
            let max = (cfg && cfg.max != null) ? cfg.max : null;
            if (max != null && proto) max *= GEAR_PROTO_FACTOR;
            return max;
        }
        function bisGearItemsForDb(targetGreenSet) {
            const items = [];
            let nextId = 900000;
            const mk = (slot, setName, cls, coreType, attrs, proto) => {
                const it = {
                    id: nextId++, slot, setName, cls, proto: !!proto,
                    namedKey: '', namedVal: 0,
                    coreType: coreType || 'wd',
                    attrs
                };
                if (coreType === 'wd') it.wd = proto ? 22.5 : 15;
                else if (coreType === 'armour') it.coreVal = proto ? 255000 : 170000;
                else if (coreType === 'skill') it.coreVal = proto ? 1.5 : 1;
                return it;
            };
            // 1) Named- und Exotic-Teile aus der GEAR_DB (fixe Attribute auf DB-Max;
            //    Nicht-Exoten zusaetzlich als Prototyp-Variante mit +50% Maxima)
            Object.entries(GEAR_DB).forEach(([name, e]) => {
                if (!e || !e.slot || BIS_SLOT_ORDER.indexOf(e.slot) < 0) return;
                const proto = !!e.proto;
                const mkAttrs = (isProto) => {
                    const fixed = (e.fixed || []).map(([type, val]) => ({ type, val: val * (isProto ? GEAR_PROTO_FACTOR : 1) }));
                    const free = e.free || 0;
                    const attrs = [...fixed];
                    for (let f = 0; f < free; f++) {
                        const max = bisAttrMax('chc', isProto);
                        if (max != null) attrs.push({ type: 'chc', val: max });
                    }
                    return attrs;
                };
                items.push(mk(e.slot, name, e.cls, e.core, mkAttrs(proto), proto));
                // Prototyp-Variante (x1,5): nur fuer Nicht-Exoten sinnvoll —
                // Exoten haben fixe Werte ohne Prototyp-Bonus.
                if (e.cls !== 'exotic' && !proto) {
                    items.push(mk(e.slot, name, e.cls, e.core, mkAttrs(true), true));
                }
            });
            // 2) Green-Set-Teile des Ziel-Sets (alle 6 Slots; als Prototyp x1,5)
            const greenInfo = GREEN_SET_INFO[targetGreenSet];
            if (greenInfo) {
                BIS_SLOT_ORDER.forEach(slot => {
                    items.push(mk(slot, greenInfo.name, 'green', 'wd', [{ type: 'chc', val: bisAttrMax('chc', false) }], false));
                    items.push(mk(slot, greenInfo.name, 'green', 'wd', [{ type: 'chc', val: bisAttrMax('chc', true) }], true));
                });
            }
            // 3) Marken-Fragmente je Slot (Brand-Sets mit WD-/CHC-/CHD-Fragmenten;
            //    ebenfalls mit Prototyp-Variante)
            Object.entries(BRAND_SET_INFO).forEach(([bkey, binfo]) => {
                const frags = (binfo && Array.isArray(binfo.fragments)) ? binfo.fragments : [];
                if (!frags.length) return;
                BIS_SLOT_ORDER.forEach(slot => {
                    [false, true].forEach(isProto => {
                        const attrs = [
                            { type: 'chc', val: bisAttrMax('chc', isProto) },
                            { type: 'chd', val: bisAttrMax('chd', isProto) }
                        ];
                        items.push(mk(slot, binfo.name || bkey, 'brand', 'wd', attrs, isProto));
                    });
                });
            });
            return items;
        }
        // Prototyp-Variante (x1,5) einer Waffe: Kern 1, Kern 2 und Nebenattribut
        // auf Prototyp-Maxima. Exoten behalten fixe Werte (kein Proto-Bonus).
        function bisWeaponProtoVariant(weapon, settings) {
            if (!weapon || weapon.isExotic || weapon.isPrototype) return null;
            const core1 = core1Max(true);
            const core2Type = weapon.core2Type || (WEAPON_CORE_ATTRIBUTES[weapon.type] || {}).core2;
            const core2Val = core2Max(true, weapon.type, core2Type);
            const minorType = weapon.minorType || 'chc';
            const minorCfg = WEAPON_MINOR_ATTRIBUTES[minorType];
            const minorVal = minorCfg ? minorCfg.max * 1.5 : null;
            const proto = {
                ...weapon,
                id: 'bis-proto-' + weapon.id,
                isPrototype: true,
                core1,
                core2Type,
                core2Val: core2Val != null ? core2Val : weapon.core2Val,
                minorType,
                minorVal: minorVal != null ? minorVal : weapon.minorVal
            };
            return proto;
        }
        function calculateBestInSlotBuild(settings) {
            const synth = bisGearItemsForDb(settings.targetGreenSet);
            const builds = generateAllGearBuilds(synth, settings.targetGreenSet, settings.targetWeaponType, '', []);
            if (!builds.length) return null;
            const caches = new WeakMap();
            const bestWeapon = calculateTopWeapons(settings)[0] || null;
            if (!bestWeapon) return null;
            // Waffen-Kandidaten: beste Inventar-Waffe + deren Prototyp-Variante
            // (x1,5 Maxima) — die bessere gewinnt.
            const weaponCandidates = [bestWeapon];
            const protoWeapon = bisWeaponProtoVariant(bestWeapon, settings);
            if (protoWeapon) weaponCandidates.push(protoWeapon);
            let best = null;
            weaponCandidates.forEach(wc => {
                const scored = calculateTopBuildsForWeapon(wc, builds, settings, caches);
                if (!scored.length) return;
                scored.sort((a, b) => b.effectiveDPS - a.effectiveDPS);
                if (!best || scored[0].effectiveDPS > best.result.effectiveDPS) {
                    best = { result: scored[0], weapon: wc };
                }
            });
            if (!best) return null;
            return { result: best.result, weapon: best.weapon, synthCount: synth.length };
        }
        function renderBestInSlotCard() {
            const box = document.getElementById('bisBuildCard');
            if (!box) return;
            if (!bisBuildResult || !bisBuildResult.result) { box.innerHTML = ''; return; }
            const best = bisBuildResult.result;
            const weapon = bisBuildResult.weapon;
            const ownBest = (lastComparisonData && lastComparisonData[0]) || null;
            const ownDps = ownBest ? ownBest.effectiveDPS : null;
            const gap = (ownDps && best.effectiveDPS) ? ((best.effectiveDPS / ownDps - 1) * 100) : null;
            const setCount = {};
            best.build.forEach(i => { const k = brandKeyMatches((i.setName || '').toLowerCase(), document.getElementById('targetGreenSet').value) ? document.getElementById('targetGreenSet').value : (i.setName || ''); setCount[k] = (setCount[k] || 0) + 1; });
            const setChips = Object.entries(setCount).map(([n, c]) => `${escapeHtml(GREEN_SET_INFO[n] ? GREEN_SET_INFO[n].name : n)} ×${c}`).join(' · ');
            const slotRows = BIS_SLOT_ORDER.map(slot => {
                const i = best.build.find(x => x.slot === slot);
                if (!i) return `<tr><td class="py-1 pr-2 text-gray-400">${escapeHtml(slot)}</td><td class="py-1 text-gray-500">—</td></tr>`;
                const dbE = GEAR_DB[i.setName];
                const cls = dbE ? dbE.cls : '';
                const god = isGearGodRoll(i);
                return `<tr><td class="py-1 pr-2 text-gray-400 whitespace-nowrap">${escapeHtml(slot)}</td><td class="py-1">${cls === 'exotic' ? '🟠 ' : (cls === 'named' ? '🟡 ' : '')}${escapeHtml(i.setName)}${god ? ' <span class="text-amber-400">★</span>' : ''}<br><span class="text-[10px] text-gray-400">${escapeHtml(gearCoreDisplay(i))} · ${escapeHtml(gearItemAttrs(i).map(a => { const cfg = GEAR_ATTR_TYPES[a.type]; return (cfg ? cfg.label : a.type) + ' ' + formatGermanNumber(a.val); }).join(' · '))}</span></td></tr>`;
            }).join('');
            box.innerHTML = `
                <div class="div-card p-6 rounded-xl border border-amber-500/30">
                    <h3 class="text-lg font-bold text-white border-b border-gray-800 pb-3 flex items-center gap-2">
                        <span class="text-amber-400">💎</span> Perfektes Build (Best-in-Slot)
                        <span class="ml-auto text-xs font-normal text-gray-400">Maximum aus der Datenbank — God-Rolls, Set-Zwänge &amp; Gegnerprofil berücksichtigt</span>
                    </h3>
                    <p class="text-xs text-gray-400 mt-2">Theoretisches Optimum unter den aktuellen Einstellungen (${escapeHtml(weaponTypeLabel(bisTargetWeaponType()))} · ${escapeHtml(GREEN_SET_INFO[document.getElementById('targetGreenSet').value]?.name || '')}${document.getElementById('require4pc').checked ? ' · 4p erzwungen' : ''}).</p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <table class="w-full text-xs text-gray-200"><tbody>${slotRows}</tbody></table>
                        <div>
                            <p class="text-sm"><strong class="text-gray-300">Waffe:</strong> ${escapeHtml(weapon.name)}${rarityBadge(weapon.isExotic, weaponIsNamed(weapon))}${weapon.isPrototype ? protoBadge() : ''}</p>
                            <p class="text-xs text-gray-400 mt-1">Ø Schuss: ${formatGermanNumber(Math.round(best.avgDmg))} · Effektiver DPS: <strong class="text-emerald-400">${formatGermanNumber(Math.round(best.effectiveDPS))}</strong></p>
                            <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-gray-300 mt-2">
                                <p>WD: <strong>+${formatGermanNumber(Math.round(best.totalWd * 10) / 10)}%</strong></p>
                                <p>CHC: <strong>${formatGermanNumber(Math.min(Math.round(best.finalChc * 10) / 10, 60))}%</strong>${best.finalChc > 60 ? ' <span class="text-amber-400" title="Cap 60% erreicht — überschüssige CHC wirken nicht">(cap: ' + formatGermanNumber(Math.round(best.finalChc * 10) / 10) + '%)</span>' : ''}</p>
                                <p>CHD: <strong>+${formatGermanNumber(Math.round(best.finalChd * 10) / 10)}%</strong></p>
                                <p>DTA: <strong>+${formatGermanNumber(Math.round((best.dtaBonus || 0) * 10) / 10)}%</strong></p>
                                <p>DTToOC: <strong>+${formatGermanNumber(Math.round((best.dttoocBonus || 0) * 10) / 10)}%</strong></p>
                                <p>DTH: <strong>+${formatGermanNumber(Math.round((best.dthBonus || 0) * 10) / 10)}%</strong></p>
                            </div>
                            ${ownDps ? (() => { const gapRounded = Math.round(gap * 10) / 10; const gapTxt = gap >= 0 ? `+${formatGermanNumber(gapRounded)}%` : `${formatGermanNumber(gapRounded)}%`; const gapPhrase = gap >= 0 ? `Differenz: <strong class="text-amber-400">${gapTxt}</strong>` : `dein Build liegt <strong class="text-amber-400">${formatGermanNumber(Math.abs(gapRounded))}%</strong> über dem theoretischen Optimum (BiS priorisiert Kritchance; deine Kritschaden-lastigen Rollen können lokal besser sein)`; return `<p class="text-xs text-gray-400 mt-2">Dein bestes Inventar-Build: ${formatGermanNumber(Math.round(ownDps))} DPS — ${gapPhrase}</p>`; })() : ''}
                            <p class="text-xs text-gray-400 mt-1">${setChips}</p>
                        </div>
                    </div>
                </div>
            `;
        }
        function bisTargetWeaponType() {
            const el = document.getElementById('targetWeaponType');
            return el ? el.value : 'AR';
        }
        function renderComparison() {
            if (!lastComparisonData || lastComparisonData.length === 0) {
                document.getElementById('comparisonResults').innerHTML = `
                    <div class="text-center py-10 text-gray-400">
                        <p>Keine Vergleichsdaten vorhanden. Starte die kombinierte Optimierung in den Einstellungen.</p>
                    </div>
                `;
                return;
            }

            // Top 3 Waffen extrahieren
            const uniqueWeapons = [];
            lastComparisonData.forEach(result => {
                if (!uniqueWeapons.some(w => w.id === result.weapon.id)) {
                    uniqueWeapons.push(result.weapon);
                }
            });

            let html = `
                <div class="space-y-6">
                    ${comparisonStale ? `
                    <div class="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-400 text-sm font-semibold flex items-center gap-2">
                        ⚠️ Ergebnis veraltet – Waffen- oder Ausrüstungs-Inventar hat sich seit der letzten Berechnung geändert. Bitte „Kombinierte Optimierung starten“ erneut ausführen.
                    </div>
                    ` : ''}
                    <!-- Top 3 Waffen -->
                    <div class="div-card p-6 rounded-xl border border-div-accent/30">
                        <h3 class="text-lg font-bold text-white border-b border-gray-800 pb-3 flex items-center gap-2">
                            <span class="text-div-accent">🏆</span> Top 3 Waffen (nach DPS-Potenzial)
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            `;

            uniqueWeapons.slice(0, 3).forEach((weapon, index) => {
                const eff = getEffectiveMods(weapon);
                const modsSummary = [
                        eff.optic && eff.optic.type ? `${eff.optic.val}% ${eff.optic.type.toUpperCase()}` : '',
                        eff.muzzle && eff.muzzle.type ? `${eff.muzzle.val}% ${eff.muzzle.type.toUpperCase()}` : '',
                        eff.underbarrel && eff.underbarrel.type ? `${eff.underbarrel.val}% ${eff.underbarrel.type.toUpperCase()}` : '',
                        eff.magazine && eff.magazine.type ? `${eff.magazine.val}% ${eff.magazine.type.toUpperCase()}` : ''
                    ].filter(Boolean).join(' | ') || '—';
                const autoBadge = (!weapon.isExotic && weapon.autoMods) ? '<span class="text-div-accent font-bold">🔧 Auto</span> ' : '';

                html += `
                    <div class="p-4 bg-zinc-900/80 rounded-lg border border-div-accent/30 comparison-card">
                        <div class="flex justify-between items-start mb-2">
                            <span class="text-xs bg-div-accent/20 text-div-accent font-bold px-2 py-1 rounded">#${index + 1}</span>
                        </div>
                        <p class="font-bold text-div-accent text-lg">${escapeHtml(weapon.name)}${rarityBadge(weapon.isExotic, weaponIsNamed(weapon))}${weapon.isPrototype ? protoBadge() : ''}</p>
                        <p class="text-sm text-gray-400">${weaponTypeLabel(weapon.type)} · Basis: ${formatGermanNumber(weapon.baseDmg)}</p>
                        <div class="mt-3 space-y-1 text-xs">
                            <p><strong class="text-gray-300">Kern:</strong> +${weapon.core1}% WD | ${weapon.core2Val}% ${weapon.core2Type.toUpperCase()}</p>
                            <p><strong class="text-gray-300">Neben:</strong> +${weapon.minorVal}% ${weapon.minorType.toUpperCase()}</p>
                            <p><strong class="text-gray-300">Mods:</strong> ${autoBadge}${modsSummary}</p>
                            <p><strong class="text-gray-300">Talent:</strong> ${getTalentLabel(weapon.talent)}</p>
                            ${talentStatusLine(weapon.talent)}
                        </div>
                        <div class="mt-3 pt-3 border-t border-gray-800">
                            <p class="text-xs text-gray-500">Geschätzter Basis-DPS: <strong class="text-emerald-400">${formatGermanNumber(weapon.estimatedDPS)}</strong></p>
                        </div>
                    </div>
                `;
            });

            html += `
                        </div>
                    </div>

                    <!-- Top Kombinationen -->
                    <div class="div-card p-6 rounded-xl">
                        <div class="flex flex-col md:flex-row justify-between items-center gap-3 border-b border-gray-800 pb-3">
                            <h3 class="text-lg font-bold text-white flex items-center gap-2">
                                <span class="text-div-accent">⚖️</span> Top Kombinationen (Waffe + Ausrüstung)
                            </h3>
                            <span class="text-xs bg-zinc-800 text-gray-300 font-semibold px-2.5 py-1 rounded-md border border-gray-700">
                                ${lastComparisonData.length} Kombinationen analysiert
                            </span>
                        </div>

                        <div class="overflow-x-auto mt-4 rounded-lg border border-gray-800">
                            <table class="w-full text-left border-collapse text-sm">
                                <thead class="bg-zinc-900 text-xs uppercase text-gray-400 sticky top-0 z-10 border-b border-gray-800">
                                    <tr>
                                        <th class="p-3">Platz</th>
                                        <th class="p-3">Waffe</th>
                                        <th class="p-3">Build</th>
                                        <th class="p-3 text-center">CHC</th>
                                        <th class="p-3 text-center">CHD</th>
                                        <th class="p-3 text-center">WD</th>
                                        <th class="p-3 text-center" title="Automatische Empfehlung für die CHC/CHD-Bestückung der Gear-Mod-Plätze">Gear-Mods</th>
                                        <th class="p-3 text-center">Ø Schaden/Treffer</th>
                                        <th class="p-3 text-center">DPS (geschätzt)</th>
                                        <th class="p-3 text-center">Set-Teile</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-800">
            `;

            lastComparisonData.forEach((result, index) => {
                const buildSummary = result.build.map(i => `${i.setName} (${i.slot})`).join(' | ');
                html += `
                    <tr class="hover:bg-zinc-800/50">
                        <td class="p-3 font-bold ${index === 0 ? 'text-div-accent' : 'text-white'}">${index + 1}.</td>
                        <td class="p-3 font-medium text-white">${result.weapon.name}</td>
                        <td class="p-3 text-xs text-gray-300">${buildSummary}</td>
                        <td class="p-3 text-center font-mono ${result.finalChc >= 60 ? 'text-amber-400' : 'text-emerald-400'}">
                            ${formatGermanNumber(result.cappedChc || result.finalChc)}%
                        </td>
                        <td class="p-3 text-center font-mono text-div-accent">${formatGermanNumber(result.finalChd)}%</td>
                        <td class="p-3 text-center font-mono text-white">+${formatGermanNumber(result.totalWd)}%</td>
                        <td class="p-3 text-center text-xs" title="${escapeHtml(result.modRecReason || '')}">
                            <span class="bg-zinc-800 text-gray-200 px-2 py-1 rounded font-semibold whitespace-nowrap">${result.modRecText || '—'}</span>
                        </td>
                        <td class="p-3 text-center font-mono text-emerald-400">${Math.round(result.avgDmg).toLocaleString('de-DE')}</td>
                        <td class="p-3 text-center font-mono text-sky-400">${Math.round(result.effectiveDPS).toLocaleString('de-DE')}</td>
                        <td class="p-3 text-center">
                            <span class="text-xs bg-zinc-800 text-gray-300 px-2 py-1 rounded">
                                ${result.targetSetCount}pc ${GREEN_SET_INFO[document.getElementById('targetGreenSet').value]?.name || ''}
                            </span>
                        </td>
                    </tr>
                `;
            });

            html += `
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Detailansicht der besten Kombination -->
                    <div class="div-card p-6 rounded-xl border border-emerald-500/30 bg-emerald-950/20">
                        <h3 class="text-lg font-bold text-emerald-400 border-b border-emerald-500/30 pb-3">
                            🎯 Detailansicht: Beste Kombination
                        </h3>
            `;

            if (lastComparisonData.length > 0) {
                const best = lastComparisonData[0];
                const build = best.build;
                const weapon = best.weapon;

                html += `
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        <!-- Waffe -->
                        <div class="p-4 bg-zinc-900/80 rounded-lg border border-gray-800">
                            <h4 class="font-bold text-div-accent mb-3">🔫 Waffe: ${escapeHtml(weapon.name)}${rarityBadge(weapon.isExotic, weaponIsNamed(weapon))}${weapon.isPrototype ? protoBadge() : ''}</h4>
                            <div class="space-y-2 text-sm">
                                <p><strong>Typ:</strong> ${weaponTypeLabel(weapon.type)}</p>
                                <p><strong>Basis-Schaden:</strong> ${formatGermanNumber(weapon.baseDmg)}</p>
                                <p><strong>Kernattribute:</strong> +${weapon.core1}% WD | +${weapon.core2Val}% ${weapon.core2Type.toUpperCase()}</p>
                                <p><strong>Nebenattribut:</strong> +${weapon.minorVal}% ${weapon.minorType.toUpperCase()}</p>
                                <p><strong>Mods:</strong></p>
                                <ul class="list-disc list-inside pl-4 text-xs text-gray-400">
                                    ${['optic','muzzle','underbarrel','magazine']
                                        .filter(k => {
                                            const effM = getEffectiveMods(weapon)[k];
                                            return effM && effM.type;
                                        })
                                        .map(k => {
                                            const labels = { optic: 'Visier', muzzle: 'Mündung', underbarrel: 'Unterlauf', magazine: 'Magazin' };
                                            const m = getEffectiveMods(weapon)[k];
                                            return `<li>${labels[k]}: +${m.val}% ${m.type.toUpperCase()}${m.name ? ` (${m.name})` : ''}</li>`;
                                        }).join('') || '<li>—</li>'}
                                </ul>
                                <p><strong>Talent:</strong> ${getTalentLabel(weapon.talent)}</p>
                                ${talentStatusLine(weapon.talent, best.talentInfo)}
                            </div>
                        </div>

                        <!-- Build -->
                        <div class="p-4 bg-zinc-900/80 rounded-lg border border-gray-800">
                            <h4 class="font-bold text-div-accent mb-3">🎒 Ausrüstung</h4>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            `;

                build.forEach(item => {
                    let namedBadge = '';
                    if (item.namedKey && item.namedVal > 0) {
                        let labelName = item.namedKey.toUpperCase();
                        if (item.namedKey === 'dta') labelName = 'DTA';
                        else if (item.namedKey === 'dttooc') labelName = 'DTToOC';
                        else if (item.namedKey === 'dth') labelName = 'DTH';
                        else if (item.namedKey === 'chcchd') labelName = 'CHC/CHD';
                    else if (item.namedKey === 'armorregen') labelName = 'Rüstungsreg.';
                        namedBadge = ` <span class="text-orange-400">(+${item.namedVal}% ${labelName})</span>`;
                    }

                    html += `
                        <div class="p-2 bg-zinc-800/60 rounded border border-gray-700">
                            <p class="font-medium text-white">${item.slot}</p>
                            <p class="text-xs text-gray-300">${item.setName}${gearRarityBadges(item)}${namedBadge}</p>
                            <p class="text-xs text-gray-400">CHC: +${item.chc}% | CHD: +${item.chd}% | Kern: ${gearCoreDisplay(item)}${gearOtherAttrsText(item) ? ' | ' + gearOtherAttrsText(item) : ''}${item.talent && GEAR_TALENTS[item.talent] ? ` | Talent: ${escapeHtml(GEAR_TALENTS[item.talent].label)}` : ''}${item.proto ? ' | Prototyp' : ''}</p>
                        </div>
                    `;
                });

                html += `
                            </div>
                        </div>
                    </div>

                    <!-- Schadensberechnung -->
                    <div class="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                        <div class="p-3 bg-zinc-900/80 rounded-lg border border-gray-800">
                            <p class="text-xs text-gray-400">Krit-Chance (CHC)</p>
                            <p class="text-xl font-black ${best.finalChc > 60 ? 'text-amber-400' : 'text-emerald-400'}">${formatGermanNumber(best.cappedChc || best.finalChc)}%</p>
                            ${best.finalChc > 60 ? `<p class="text-[10px] text-amber-400">gecappt: ${formatGermanNumber(best.finalChc)}% &gt; 60%-Cap</p>` : ''}
                        </div>
                        <div class="p-3 bg-zinc-900/80 rounded-lg border border-gray-800">
                            <p class="text-xs text-gray-400">Krit-Schaden (CHD)</p>
                            <p class="text-xl font-black text-div-accent">${formatGermanNumber(best.finalChd)}%</p>
                        </div>
                        <div class="p-3 bg-zinc-900/80 rounded-lg border border-gray-800">
                            <p class="text-xs text-gray-400">Waffenschaden</p>
                            <p class="text-xl font-black text-white">+${formatGermanNumber(best.totalWd)}%</p>
                        </div>
                        <div class="p-3 bg-zinc-900/80 rounded-lg border border-gray-800">
                            <p class="text-xs text-gray-400">Ø Schaden/Treffer</p>
                            <p class="text-xl font-black text-emerald-400">${Math.round(best.avgDmg).toLocaleString('de-DE')}</p>
                        </div>
                    </div>

                    <!-- Automatische Mod-Empfehlung für Gear-Mod-Plätze -->
                    <div class="mt-6 p-4 bg-zinc-900/80 rounded-lg border border-div-accent/40">
                        <p class="text-sm font-bold text-div-accent mb-1">🔧 Empfehlung: Gear-Mod-Plätze (CHC vs. CHD)</p>
                        <p class="text-sm text-gray-200">
                            Setze <strong>${(best.mods && best.mods.chcCount) || 0}× Kritische Trefferchance (+6%)</strong> und
                            <strong>${(best.mods && best.mods.chdCount) || 0}× Kritischen Trefferschaden (+12%)</strong> auf die Mod-Plätze deiner Ausrüstung.
                        </p>
                        <p class="text-xs text-gray-400 mt-1">${best.modRecReason || ''}</p>
                        ${best.finalChc > 60 ? `<p class="text-xs text-amber-400 mt-1">⚠️ Achtung: Vor dem Cap wären es ${formatGermanNumber(best.finalChc)}% CHC – alles über 60% hat keinen Effekt. CHC-Attribute/Mods über dem Cap solltest du gegen CHD oder WD tauschen.</p>` : ''}
                        <p class="text-[11px] text-gray-500 mt-1">Basis: dein Ausrüstungs-Inventar + SHD-Uhr + Set-/Named-Boni. Die Aufteilung wird automatisch optimiert – eine manuelle Mod-Erfassung ist dafür nicht nötig.</p>
                    </div>

                    ${renderBreakdownSection(best)}

                    ${renderStackDamageChart(best)}
                    ${renderManualBuildComparison(best)}

                    <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div class="p-3 bg-zinc-900/80 rounded-lg border border-gray-800 text-center">
                            <p class="text-xs text-gray-400">Nicht-Krit Treffer (Rüstung)</p>
                            <p class="text-lg font-bold text-white">${Math.round(best.nonCritHit * best.armorMult).toLocaleString('de-DE')}</p>
                        </div>
                        <div class="p-3 bg-zinc-900/80 rounded-lg border border-gray-800 text-center">
                            <p class="text-xs text-gray-400">Krit-Treffer (Rüstung)</p>
                            <p class="text-lg font-bold text-emerald-400">${Math.round(best.critHit * best.armorMult).toLocaleString('de-DE')}</p>
                        </div>
                    </div>
            `;
            } else {
                html += `<p class="text-center py-4 text-gray-400">Keine Daten verfügbar.</p>`;
            }

            html += `
                    </div>
                </div>
            `;

            document.getElementById('comparisonResults').innerHTML = html;
        }

        function exportComparisonCSV() {
            if (!lastComparisonData || lastComparisonData.length === 0) {
                showToast('Keine Vergleichsdaten zum Exportieren vorhanden.', 'error');
                return;
            }

            let csv = "Platz;Waffe;Waffen-Typ;Basis-Schaden;Build;CHC;CHD;WD;Ø Schaden/Treffer;DPS;Set-Teile\n";
            lastComparisonData.forEach((result, index) => {
                const buildSummary = result.build.map(i => `${i.setName} (${i.slot})`).join(' | ');
                csv += `${index + 1};${result.weapon.name};${weaponTypeLabel(result.weapon.type)};${result.weapon.baseDmg};` +
                       `"${buildSummary}";${formatGermanNumber(result.cappedChc || result.finalChc)}%;${formatGermanNumber(result.finalChd)}%;` +
                       `+${formatGermanNumber(result.totalWd)}%;${Math.round(result.avgDmg).toLocaleString('de-DE')};` +
                       `${Math.round(result.effectiveDPS).toLocaleString('de-DE')};${result.targetSetCount}pc\n`;
            });

            const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `div2_comparison_${new Date().toISOString().slice(0,10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Vergleich exportiert!', 'success');
        }

        // ========== STACK-CHARTS (für zukünftige Erweiterungen) ==========
        function renderStackGearSummary() {
            // Platzhalter für Stack-Chart-Integration
        }

        // ========== LOCALSTORAGE ==========
        // Issue #35: Inventar-Persistenz mit Schema-Version und Migration.
        // STORAGE_SCHEMA_VERSION 17 = aktueller Stand; aeltere Bestaende
        // (v16-Schluessel ohne Version) werden einmalig migriert. Defekte
        // Eintraege werden uebersprungen statt die initApp zu brechen.
        const STORAGE_SCHEMA_VERSION = 17;
        function storageGet(key) {
            try { return localStorage.getItem(key); } catch (e) { return null; }
        }
        function storageSet(key, val) {
            try { localStorage.setItem(key, val); return true; }
            catch (e) {
                if (typeof showToast === 'function') showToast('\u26a0\ufe0f Speichern fehlgeschlagen (Browser-Speicher voll?) \u2013 \u00c4nderungen gehen beim Neuladen verloren.', 'error');
                return false;
            }
        }
        function parseStorageJson(key, fallback) {
            const raw = storageGet(key);
            if (raw === null || raw === '') return fallback;
            try { return JSON.parse(raw); } catch (e) { return fallback; }
        }
        function saveToLocalStorage() {
            storageSet('div2_weapons', JSON.stringify(weaponsInventory));
            storageSet('div2_gear', JSON.stringify(gearInventory));
            storageSet('div2_weaponIdCounter', weaponIdCounter);
            storageSet('div2_gearIdCounter', gearIdCounter);
            storageSet('div2_schema_version', String(STORAGE_SCHEMA_VERSION));
        }
        // Einmalige Migration alter v16-Schluessel auf das neue Schema.
        // Datensatzstruktur unveraendert, nur die Schluessel wandern.
        function migrateStorage() {
            const version = parseInt(storageGet('div2_schema_version') || '0', 10) || 0;
            if (version >= STORAGE_SCHEMA_VERSION) return;
            const legacy = [
                ['div2_weapons_v16', 'div2_weapons'],
                ['div2_gear_v16', 'div2_gear'],
                ['div2_weaponIdCounter_v16', 'div2_weaponIdCounter'],
                ['div2_gearIdCounter_v16', 'div2_gearIdCounter'],
                ['div2_initialized_v16', 'div2_initialized']
            ];
            legacy.forEach(([oldKey, newKey]) => {
                if (storageGet(oldKey) !== null && storageGet(newKey) === null) {
                    storageSet(newKey, storageGet(oldKey));
                }
                try { localStorage.removeItem(oldKey); } catch (e) {}
            });
            storageSet('div2_schema_version', String(STORAGE_SCHEMA_VERSION));
        }
        function loadFromLocalStorage() {
            migrateStorage();
            const weapons = parseStorageJson('div2_weapons', null);
            const gear = parseStorageJson('div2_gear', null);
            const weaponCounter = storageGet('div2_weaponIdCounter');
            const gearCounter = storageGet('div2_gearIdCounter');
            if (Array.isArray(weapons)) weaponsInventory = weapons;
            if (Array.isArray(gear)) gearInventory = gear.map(normalizeGearItem);
            if (weaponCounter && !isNaN(parseInt(weaponCounter, 10))) weaponIdCounter = parseInt(weaponCounter, 10);
            if (gearCounter && !isNaN(parseInt(gearCounter, 10))) gearIdCounter = parseInt(gearCounter, 10);

            // Persistenz-Fix: „noch nie gespeichert" (Erststart) von „Nutzer hat
            // bewusst alles geleert" unterscheiden. Nur beim allerersten Start
            // (Initialisierungs-Marker fehlt) werden die Standardwerte angelegt.
            // Danach bleibt ein geleertes Inventar nach einem Reload leer.
            const initialized = storageGet('div2_initialized');
            if (!initialized) {
                storageSet('div2_initialized', '1');
                if (weaponsInventory.length === 0 && gearInventory.length === 0) {
                    loadDefaultWeapons();
                    loadDefaultGear();
                }
                saveToLocalStorage();
            }
        }

        function clearWeaponsInventory() {
            if (weaponsInventory.length === 0) {
                showToast('Das Waffen-Inventar ist bereits leer.', 'info');
                return;
            }
            if (confirm(`Möchtest du wirklich alle ${weaponsInventory.length} Waffen aus dem Inventar löschen?\n\nDie Ausrüstungs-Inventar bleibt unberührt.`)) {
                weaponsInventory = [];
                lastComparisonData = [];
                comparisonStale = false; // geleert -> kein Veraltet-Hinweis mehr
                // Laufende Bearbeitung abbrechen (Ziel-Waffe existiert nicht mehr)
                if (editWeaponId !== null) { editWeaponId = null; setEditUi(false); }
                saveToLocalStorage();
                renderWeaponsInventory();
                renderComparison();
                showToast('Waffen-Inventar geleert!', 'info');
            }
        }

        function clearAllInventory() {
            if (confirm('Möchtest du wirklich ALLE Daten (Waffen + Ausrüstung) löschen?')) {
                weaponsInventory = [];
                gearInventory = [];
                weaponIdCounter = 1;
                gearIdCounter = 1;
                lastComparisonData = [];
                comparisonStale = false; // geleert -> kein Veraltet-Hinweis mehr
                if (typeof editGearId !== 'undefined' && editGearId !== null) { editGearId = null; setGearEditUi(false); }
                saveToLocalStorage();
                renderWeaponsInventory();
                renderGearInventory();
                renderComparison();
                updateTabUI();
                showToast('Alle Inventare geleert!', 'info');
            }
        }

        function updateKnowHowDisplay() {
            const slider = document.getElementById('knowHowLevel');
            const input = document.getElementById('knowHowInput');
            const display = document.getElementById('knowHowBonusDisplay');
            if (!slider || !input || !display) return;

            let val = parseInt(slider.value, 10) || 0;
            if (val < 0) val = 0;
            if (val > 30) val = 30;

            input.value = val;
            display.textContent = `+${val}% Waffenschaden`;
        }

        function syncKnowHowInput(valStr) {
            const slider = document.getElementById('knowHowLevel');
            const display = document.getElementById('knowHowBonusDisplay');
            if (!slider || !display) return;

            let val = parseInt(valStr, 10);
            if (isNaN(val)) val = 0;
            if (val < 0) val = 0;
            if (val > 30) val = 30;

            slider.value = val;
            display.textContent = `+${val}% Waffenschaden`;
        }

        function toggleShdInputs() {
            const isMax = document.getElementById('shdMax').checked;
            const customContainer = document.getElementById('customShdContainer');
            if (customContainer) {
                if (isMax) {
                    customContainer.classList.add('hidden');
                } else {
                    customContainer.classList.remove('hidden');
                }
            }
            updateGearModAdvice();
        }

        function onTargetGreenSetChange() {
            const key = document.getElementById('targetGreenSet').value;
            const info = GREEN_SET_INFO[key];
            if (info) {
                document.getElementById('forceChestLabel').textContent = `Weste aus ${info.name} erzwingen`;
                document.getElementById('forceBackpackLabel').textContent = `Rucksack aus ${info.name} erzwingen`;
                document.getElementById('greenSetHint').textContent = `2p: ${info.n2} · 3p: ${info.n3} · 4p: ${info.n4} — Hinweis: ${info.modeled}.`;
            }
            if (typeof updateForceExoticOptions === 'function') updateForceExoticOptions();
            updateSetAvailability();
        }

        // Live-Validierung der Set-Bedingungen gegen das aktuelle Inventar.
        // Prüft: reichen die vorhandenen Teile für 4pc? Sind Weste/Rucksack da,
        // wenn diese erzwingbar angehakt sind? Zeigt das Ergebnis direkt unter
        // dem Set-Dropdown an — bereits vor dem Start der Optimierung.
        function updateSetAvailability() {
            const box = document.getElementById('setAvailabilityBox');
            if (!box) return;
            const sel = document.getElementById('targetGreenSet');
            const key = sel ? sel.value : '';
            const info = GREEN_SET_INFO[key];
            // Fixierungen (#108 D): Pin-Konflikte prüfen — unabhängig vom Ziel-Set
            const pinnedItems = pinnedGearItems();
            const pinnedSlotMap = {};
            pinnedItems.forEach(i => {
                pinnedSlotMap[i.slot] = (pinnedSlotMap[i.slot] || 0) + 1;
            });
            const exoticProblems = [];
            Object.entries(pinnedSlotMap).forEach(([slot, n]) => {
                if (n > 1) exoticProblems.push(`<strong>${n} fixierte Teile im Slot ${escapeHtml(slot)}</strong> — es passt nur eins pro Slot`);
            });
            // Struktureller Konflikt: fixierte Nicht-Set-Teile + 4pc-Zwang:
            // der Build braucht 4 Ziel-Set-Teile in den übrigen Slots.
            if (pinnedItems.length && key && info && document.getElementById('require4pc')?.checked) {
                const pinnedSetCount = pinnedItems.filter(i => brandKeyMatches((i.setName || '').toLowerCase(), key)).length;
                const setPiecesTotal = gearInventory.filter(i => brandKeyMatches((i.setName || '').toLowerCase(), key)).length;
                const need = Math.max(0, 4 - pinnedSetCount);
                if (setPiecesTotal < need) {
                    exoticProblems.push(`<strong>${escapeHtml(info.name)} 4p + ${pinnedItems.length} fixierte(s) Teil(e)</strong> zusammen benötigen ${need} weitere ${escapeHtml(info.name)}-Teile, im Inventar sind aber nur ${setPiecesTotal}`);
                }
            }
            if (!key || !info) {
                if (exoticProblems.length) {
                    box.innerHTML = `⚠️ <strong>Fixierung nicht erfüllbar:</strong> ${exoticProblems.join(' · ')}.`;
                    box.className = 'text-[11px] leading-snug rounded-lg p-2 mb-2 border bg-red-500/10 border-red-500/40 text-red-300';
                    box.classList.remove('hidden');
                } else {
                    box.classList.add('hidden');
                }
                return;
            }

            const pieces = gearInventory.filter(i => brandKeyMatches((i.setName || '').toLowerCase(), key));
            const slotsFound = [...new Set(pieces.map(i => i.slot))];
            const count = pieces.length;
            const need4 = document.getElementById('require4pc').checked;
            const fChest = document.getElementById('forceChest').checked;
            const fBackpack = document.getElementById('forceBackpack').checked;
            const hasChestP = slotsFound.includes('Weste');
            const hasBpP = slotsFound.includes('Rucksack');
            const hasNinja = gearInventory.some(i => brandKeyMatches((i.setName || '').toLowerCase(), 'ninjabike'));

            const problems = [];
            if (need4 && count < 4 && !(hasNinja && count === 3)) {
                problems.push(`nur <strong>${count} Teil${count === 1 ? '' : 'e'}</strong> von ${info.name} im Inventar (4 benötigt${hasNinja ? ', NinjaBike substituiert max. 1' : ''})`);
            }
            if (fChest && !hasChestP) problems.push(`keine <strong>${info.name}-Weste</strong> im Inventar, aber „Weste erzwingen“ ist aktiv`);
            if (fBackpack && !hasBpP) problems.push(`kein <strong>${info.name}-Rucksack</strong> im Inventar, aber „Rucksack erzwingen“ ist aktiv`);

            const slotList = count ? slotsFound.join(', ') : 'keine';
            let html;
            if (problems.length) {
                html = `⚠️ <strong>Set-Bedingung nicht erfüllbar:</strong> ${problems.join(' · ')}.<br>Vorhanden: ${slotList}. Haken entfernen oder fehlende Teile ergänzen.`;
                box.className = 'text-[11px] leading-snug rounded-lg p-2 mb-2 border bg-red-500/10 border-red-500/40 text-red-300';
            } else if (exoticProblems.length) {
                html = `⚠️ <strong>Fixierung nicht erfüllbar:</strong> ${exoticProblems.join(' · ')}.`;
                box.className = 'text-[11px] leading-snug rounded-lg p-2 mb-2 border bg-red-500/10 border-red-500/40 text-red-300';
            } else {
                html = `✅ <strong>${count} Teil${count === 1 ? '' : 'e'}</strong> von ${info.name} im Inventar: ${slotList}.`;
                box.className = 'text-[11px] leading-snug rounded-lg p-2 mb-2 border bg-green-500/10 border-green-500/40 text-green-300';
            }
            box.innerHTML = html;
            box.classList.remove('hidden');
        }

// ========== INITIALISIERUNG ==========
        function initApp() {
            loadFromLocalStorage();
            updateForceExoticOptions();
            updateKnowHowDisplay();
            onTargetGreenSetChange();
            renderWeaponsInventory();
            renderGearInventory();
            updateTabUI();
            showToast('Division 2 Optimizer v16.0 geladen! 🎉', 'success');
        }
