const fs = require('fs');
const path = require('path');

const filePath = path.join('g:', 'Il mio Drive', 'STORAGE', 'ANTIMO', 'GestioneAttivitaWeb', 'admin.html');

try {
    const rawContent = fs.readFileSync(filePath, 'utf8');
    
    // We attempt to decode the mojibake. 
    // Since powershell's Get-Content read UTF-8 bytes as Windows-1252, and Set-Content -Encoding utf8 wrote those out as UTF-8 string:
    // This means the rawContent string contains characters that correspond to the Windows-1252 interpretation of UTF-8 bytes.
    // By converting this string back to a binary buffer using 'latin1' (close enough to 1252 for these bytes), 
    // and decoding it as utf8, we recover the original.
    const buf = Buffer.from(rawContent, 'latin1');
    const fixedContent = buf.toString('utf8');
    
    // Fallback if that creates invalid characters or fails (e.g. if the file wasn't purely double-encoded)
    if(fixedContent.includes("")) {
        console.log("Latin1 conversion might not be perfect due to Windows-1252 specific bytes (like 0x80-0x9F).");
        // We will try manual replacements as a secondary fallback
        let manualFix = rawContent;
        const replacements = {
            "âš ï¸": "⚠️",
            "ðŸ‘¤": "👤",
            "ðŸ”™": "🔙",
            "â¬‡ï¸": "⬇️",
            "âœ…": "✅",
            "âš™ï¸": "⚙️",
            "ðŸ—‘ï¸": "🗑️",
            "â ³": "⏳",
            "ðŸ“Š": "📊",
            "âœ ï¸": "✏️",
            "ðŸ¤–": "🤖",
            "ðŸ’¾": "💾",
            "ðŸ”„": "🔄",
            "CittÃ ": "Città",
            "LocalitÃ ": "Località",
            "AttivitÃ ": "Attività"
        };
        for(let key in replacements) {
            manualFix = manualFix.split(key).join(replacements[key]);
        }
        fs.writeFileSync(filePath, manualFix, 'utf8');
        console.log('Fixed via manual string replacements.');
    } else {
        fs.writeFileSync(filePath, fixedContent, 'utf8');
        console.log('Fixed via Buffer decode.');
    }
} catch (e) {
    console.error(e);
}
