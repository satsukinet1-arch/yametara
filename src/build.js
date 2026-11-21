// 使い方: SITE_URL=https://example.jp/ OPERATOR=... CONTACT=... node build.js
const fs = require('fs');
const env = { SITE_URL: process.env.SITE_URL || '', OPERATOR: process.env.OPERATOR || '', CONTACT: process.env.CONTACT || '' };
const fill = s => s.replace(/%%(\w+)%%/g, (m, k) => env[k] ?? m);
fs.mkdirSync('site', { recursive: true });
const eng = fs.readFileSync('engine.js', 'utf8').split('\n').filter(l => !l.startsWith('if (typeof module')).join('\n');
fs.writeFileSync('site/index.html', fill(fs.readFileSync('ui.html', 'utf8').replace('/*ENGINE*/', eng)));
fs.writeFileSync('site/privacy.html', fill(fs.readFileSync('privacy.html', 'utf8')));
fs.copyFileSync('ogp.png', 'site/ogp.png');
if (env.SITE_URL && !new URL(env.SITE_URL).host.endsWith('github.io')) fs.writeFileSync('site/CNAME', new URL(env.SITE_URL).host + '\n');
console.log('built site/', env);
