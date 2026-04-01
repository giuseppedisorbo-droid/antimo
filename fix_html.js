const fs = require('fs');

['admin.html', 'admin_utf8.html'].forEach(file => {
    let p = 'g:/Il mio Drive/STORAGE/ANTIMO/GestioneAttivitaWeb/' + file;
    let content = fs.readFileSync(p, 'utf8');

    let target = `                </table>
            <h2 id="toggleStoricoHeader"`;
    
    // In case there is an empty line between them:
    let regex = /<\/table>\s*<h2 id="toggleStoricoHeader"/g;

    if (regex.test(content)) {
        content = content.replace(regex, `</table>\n            </div>\n\n            <h2 id="toggleStoricoHeader"`);
        fs.writeFileSync(p, content, 'utf8');
        console.log('Fixed ' + file);
    } else {
        console.log('Did not find the exact pattern in ' + file + ', it might be already fixed or slightly different.');
    }
});
