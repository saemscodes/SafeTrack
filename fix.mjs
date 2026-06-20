import fs from 'fs';

const JS_PATH = 'd:/SafeTrack/web-client/js/bip39.js';
const TXT_PATH = 'd:/SafeTrack/ios/SafeTrack/Resources/bip39_en.txt';

let txt = fs.readFileSync(TXT_PATH, 'utf8').trim().split(/\r?\n/).filter(Boolean);
console.log('TXT length:', txt.length);

let formatted = txt.map(w => `'${w.trim()}'`).join(',');

let code = fs.readFileSync(JS_PATH, 'utf8');

code = code.replace(/const EN_WORDS = \[[\s\S]*?\];/, `const EN_WORDS = [${formatted}];`);

fs.writeFileSync(JS_PATH, code);
console.log('bip39.js successfully updated.');
