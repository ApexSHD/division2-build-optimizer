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
    for (const src of ['js/app.js', 'js/app2.js']) {
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
