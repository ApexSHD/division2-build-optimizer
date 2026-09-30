// ===== BOOT: Daten per fetch() aus den JSON-Dateien laden =====
// Ersetzt die ehemals inline eingebetteten Daten-Kopien (js/data.js, js/gear-data.js).
// app.js und app2.js werden erst nach dem Laden der Daten eingebunden,
// da deren Parse-Time-Code (mergeTalentDbIntoCatalog, Exotic-Patch) die Daten benoetigt.
let weaponsData, TALENTS_DB, talentsData, MOD_CATALOG;
let NAMED_ITEM_CONFIGS, GEAR_DB, GREEN_SET_INFO;

async function loadJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(url + ': HTTP ' + res.status);
    return res.json();
}

(async function boot() {
    const results = await Promise.all([
        loadJson('weapons.json'),
        loadJson('talent.json'),
        loadJson('talents-display.json'),
        loadJson('mod.json'),
        loadJson('gear.json')
    ]);
    weaponsData = results[0];
    TALENTS_DB = results[1];
    talentsData = results[2];
    MOD_CATALOG = results[3].slots;
    NAMED_ITEM_CONFIGS = results[4].named_item_configs;
    GEAR_DB = results[4].gear_db;
    GREEN_SET_INFO = results[4].green_set_info;

    // App-Skripte erst nach den Daten laden
    // Lokale Verwaltungs-Overrides (Verwaltungs-Tab) anwenden, falls vorhanden
    try {
        const raw = localStorage.getItem('div2_admin_db');
        if (raw) {
            const o = JSON.parse(raw);
            if (Array.isArray(o.weapons)) weaponsData.weapons = o.weapons;
            if (o.gear) {
                if (o.gear.named_item_configs) NAMED_ITEM_CONFIGS = o.gear.named_item_configs;
                if (o.gear.gear_db) GEAR_DB = o.gear.gear_db;
                if (o.gear.green_set_info) GREEN_SET_INFO = o.gear.green_set_info;
            }
            if (o.mods && o.mods.slots) MOD_CATALOG = o.mods.slots;
        }
    } catch (e) { console.warn('Lokale DB-Overrides konnten nicht geladen werden:', e); }

    // app.js vor app2.js laden (Reihenfolge wie bisher); admin.js kann parallel
    for (const src of ['js/app.js', 'js/app2.js', 'js/admin.js']) {
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error(src + ' konnte nicht geladen werden'));
            document.body.appendChild(s);
        });
    }
})().catch(err => {
    console.error('Daten konnten nicht geladen werden:', err);
    const el = document.getElementById('toastContainer');
    if (el) {
        el.insertAdjacentHTML('beforeend',
            '<div class="bg-red-600 text-white px-4 py-3 rounded shadow-lg">Fehler beim Laden der Daten: ' +
            String(err.message).replace(/[<>]/g, '') + '</div>');
    }
});
