#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function fail(msg){
  console.error(msg);
  process.exitCode = 1;
}

function parseJs(file){
  const src = fs.readFileSync(file, 'utf8');
  try { new Function(src); }
  catch (e) { fail(`JS parse failed: ${file}\n${e.message}`); }
}

function checkSpriteRefs(cssFile){
  const css = fs.readFileSync(cssFile, 'utf8');
  const re = /background-image\s*:\s*url\("\.\.\/assets\/sprites\/([^)"']+)"\)/g;
  let m;
  while((m = re.exec(css))){
    const sprite = m[1];
    const full = path.join('assets','sprites',sprite);
    if(!fs.existsSync(full)) fail(`Missing sprite referenced in ${cssFile}: ${full}`);
  }
}

['js/core/game.js','js/data/content.js','js/systems/systems.js','js/systems/shop.js'].forEach(f=>{
  if(fs.existsSync(f)) parseJs(f);
});

['css/main.css','css/sprites.css'].forEach(f=>{
  if(fs.existsSync(f)) checkSpriteRefs(f);
});

if(process.exitCode){
  process.exit(process.exitCode);
}
console.log('ci-check: OK');
