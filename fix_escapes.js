const fs = require('fs');
let code = fs.readFileSync('programmati.js', 'utf8');

// The file literally contains `\` followed by ``` and `\` followed by `$` followed by `{`.
// We want to replace `\` + ``` with just ```.
// And we want to replace `\` + `$` + `{` with just `$` + `{`.

let fixedCode = "";
for (let i = 0; i < code.length; i++) {
    if (code[i] === '\\\\' && code[i+1] === '\`') {
        fixedCode += '\`';
        i++;
    } else if (code[i] === '\\\\' && code[i+1] === '$' && code[i+2] === '{') {
        fixedCode += '${';
        i += 2;
    } else {
        fixedCode += code[i];
    }
}

fs.writeFileSync('programmati.js', fixedCode);
console.log("Fixed all literal escapes.");
