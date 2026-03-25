const fs = require('fs');
const path = require('path');

const bPath = path.join('g:', 'Il mio Drive', 'STORAGE', 'ANTIMO', 'GestioneAttivitaWeb');
const adminHtmlPath = path.join(bPath, 'admin.html');
const adminJsPath = path.join(bPath, 'admin.js');

try {
    let html = fs.readFileSync(adminHtmlPath, 'utf8');
    html = html.replace('                </table>\n\n            <h2 id="toggleStoricoHeader"', '                </table>\n            </div>\n\n            <h2 id="toggleStoricoHeader"');
    html = html.replace('                </table>\r\n\r\n            <h2 id="toggleStoricoHeader"', '                </table>\r\n            </div>\r\n\r\n            <h2 id="toggleStoricoHeader"');
    fs.writeFileSync(adminHtmlPath, html, 'utf8');

    let js = fs.readFileSync(adminJsPath, 'utf8');
    const toggleCode = `
if (toggleStoricoHeader && storicoWrapper && storicoToggleIcon) {
    toggleStoricoHeader.addEventListener('click', () => {
        if (storicoWrapper.classList.contains('hidden')) {
            storicoWrapper.classList.remove('hidden');
            storicoToggleIcon.innerHTML = 'Chiudi Storico ⬆️';
        } else {
            storicoWrapper.classList.add('hidden');
            storicoToggleIcon.innerHTML = 'Apri Storico ⬇️';
        }
    });
}
`;
    // Insert after "const storicoToggleIcon = document.getElementById('storicoToggleIcon');"
    if(!js.includes("Apri Storico ⬇️")) {
        js = js.replace("const storicoToggleIcon = document.getElementById('storicoToggleIcon');", "const storicoToggleIcon = document.getElementById('storicoToggleIcon');\n" + toggleCode);
        fs.writeFileSync(adminJsPath, js, 'utf8');
    }

    console.log("Fixed DOM and js wrappers");
} catch(e) { console.error(e); }
