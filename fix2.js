const fs = require('fs');
const path = require('path');
const filePath = path.join('g:', 'Il mio Drive', 'STORAGE', 'ANTIMO', 'GestioneAttivitaWeb', 'admin.html');

try {
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const fixedContent = Buffer.from(rawContent, 'latin1').toString('utf8');

    if (!fixedContent.includes("â")) {
        fs.writeFileSync(filePath, fixedContent, 'utf8');
        console.log("Successfully restored utf8 via Buffer");
    } else {
        console.log("Still has corrupted chars. Decoding was incorrect.");
    }
} catch (e) {
    console.error(e);
}
