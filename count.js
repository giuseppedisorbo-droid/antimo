const fs = require('fs');
const text = fs.readFileSync('programmati.js', 'utf8').split('\n').slice(0, 1600).join('\n');
let ticks = 0;
for (let c of text) {
    if (c === '\`') ticks++;
}
console.log('Ticks:', ticks);
