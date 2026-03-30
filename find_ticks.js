const fs = require('fs');
const lines = fs.readFileSync('programmati.js', 'utf8').split('\n');

let ticks = 0;
let out = '';
let open = false;

for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    for (let j = 0; j < l.length; j++) {
        if (l[j] === '\`') {
            ticks++;
            open = !open;
            out += 'Tick ' + ticks + ' at line ' + (i + 1) + ' is ' + (open ? 'OPEN' : 'CLOSE') + '\n';
        }
    }
}
fs.writeFileSync('ticks_all.log', out);
