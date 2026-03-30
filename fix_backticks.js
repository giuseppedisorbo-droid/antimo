const fs = require('fs');
const file = 'g:/Il mio Drive/STORAGE/ANTIMO/GestioneAttivitaWeb/app.js';
let content = fs.readFileSync(file, 'utf8');

const splitPoint = content.indexOf('// STAMPA MODULO MAGAZZINO / PDF (SEQEX & GLOBAL)');
if (splitPoint !== -1) {
    let top = content.substring(0, splitPoint);
    let bottom = content.substring(splitPoint);
    
    bottom = bottom.replace(/\\`/g, '`').replace(/\\\$/g, '$');
    
    fs.writeFileSync(file, top + bottom);
    console.log("Fixed backticks successfully.");
} else {
    console.log("Split point not found.");
}
