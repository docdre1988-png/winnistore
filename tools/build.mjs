import fs from 'node:fs/promises';
import path from 'node:path';
const output=path.resolve('public');
await fs.mkdir(output,{recursive:true});
for(const file of ['index.html','admin.html','config.js','script.js','admin.js','styles.css','refinement.css','admin.css'])await fs.copyFile(file,path.join(output,file));
await fs.cp('assets',path.join(output,'assets'),{recursive:true});
console.log('Sitio estático preparado en public/. No incluye secretos ni datos internos.');
