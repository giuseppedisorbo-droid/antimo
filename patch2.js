const fs = require('fs');
let js = fs.readFileSync('g:\\Il mio Drive\\STORAGE\\ANTIMO\\GestioneAttivitaWeb\\app.js', 'utf8');

const settingsLogic = `
// GET THE SETTINGS UI ELEMENTS
document.addEventListener('DOMContentLoaded', () => {
    const btnSettings = document.getElementById('btnSettings');
    const settingsModal = document.getElementById('settingsModal');
    const btnCloseSettings = document.getElementById('btnCloseSettings');

    if (btnSettings && settingsModal) {
        btnSettings.addEventListener('click', (e) => {
            e.preventDefault();
            settingsModal.classList.remove('hidden');
        });
    }

    if (btnCloseSettings && settingsModal) {
        btnCloseSettings.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
        });
    }
});
`;

if (!js.includes('btnSettings.addEventListener')) {
    js += '\n' + settingsLogic;
    fs.writeFileSync('g:\\Il mio Drive\\STORAGE\\ANTIMO\\GestioneAttivitaWeb\\app.js', js, 'utf8');
    console.log('App.js patched successfully');
} else {
    console.log('App.js already patched');
}
