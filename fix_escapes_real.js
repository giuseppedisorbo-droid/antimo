const fs = require('fs');
let code = fs.readFileSync('programmati.js', 'utf8');

// A backslash followed by a backtick is 2 characters in the file: '\\' and '\`'.
// To find and replace this sequence:
code = code.split('\\' + '\`').join('\`');
code = code.split('\\' + '$' + '{').join('${');

fs.writeFileSync('programmati.js', code);
console.log("Fixed all literal escapes for real.");
