import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
test('Catálogo: autenticación, altas, edición, ocultar, fotos y eliminación persistente',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'winni-test-'));
 process.env.DATA_DIR=dir;process.env.ADMIN_PASSWORD='abc';
 delete process.env.JSONBIN_BIN_ID;delete process.env.JSONBIN_ACCESS_KEY;
 const {server}=await import('../server.mjs');await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;let cookie='';
 const request=(route,method='GET',data,headers={})=>fetch(base+route,{method,headers:{'Content-Type':'application/json',Cookie:cookie,...headers},body:data?JSON.stringify(data):undefined});
 try{
  assert.equal((await request('/api/catalog')).status,200);
  assert.equal((await request('/api/admin/catalog')).status,401);
  assert.equal((await request('/.env')).status,404);
  assert.equal((await request('/data/catalog.seed.json')).status,404);
  assert.equal((await request('/api/login','POST',{password:'wrong'})).status,401);
  const login=await request('/api/login','POST',{password:process.env.ADMIN_PASSWORD});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];assert(login.headers.get('set-cookie').includes('HttpOnly'));
  assert.equal((await request('/api/admin/products','POST',{}, {Origin:'https://evil.example'})).status,403);
  const original=(await (await request('/api/admin/catalog')).json()).products.length;
  const input={nombre:'Prueba',categoria:'NUEVA CATEGORIA',descripcion:'Descripción <script> como texto',precio:12.5,precioAnterior:20,imagen:'assets/catalogo/producto-1-1.webp',disponible:'SI'};
  assert.equal((await request('/api/admin/products','POST',{...input,precio:-1})).status,400);
  assert.equal((await request('/api/admin/products','POST',{...input,imagen:'javascript:alert(1)'})).status,400);
  const created=await (await request('/api/admin/products','POST',input)).json();assert(created.product.id);const id=created.product.id;
  assert((await (await request('/api/catalog')).json()).products.some(p=>p.id===id));
  assert.equal((await request('/api/admin/products/'+id,'PUT',{...input,disponible:'NO'})).status,200);
  assert(!(await (await request('/api/catalog')).json()).products.some(p=>p.id===id));
  assert.equal((await (await request('/api/admin/catalog')).json()).products.length,original+1);
  assert.equal((await request('/api/admin/upload','POST',{data:Buffer.from('<svg>bad</svg>').toString('base64')})).status,400);
  const photo=await (await request('/api/admin/upload','POST',{data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1kAAAAASUVORK5CYII='})).json();assert(photo.url.startsWith('/uploads/'));assert.equal((await request(photo.url)).status,200);
  assert.equal((await request('/api/admin/products/'+id,'DELETE')).status,200);
  assert.equal((await (await request('/api/admin/catalog')).json()).products.length,original);
  const logout=await request('/api/logout','POST');assert(logout.headers.get('set-cookie').includes('Max-Age=0'));cookie='';assert.equal((await request('/api/admin/catalog')).status,401);
 }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});

test('Vercel: el handler espera la respuesta y la configuración inválida no rompe el arranque',()=>{
 for(const scenario of ['seed','invalid-config']){
  const code=`
   import assert from 'node:assert/strict';
   import handler from './api/handler.mjs';
   const res={headersSent:false,writableEnded:false,setHeader(){},writeHead(status){this.status=status;this.headersSent=true;},end(value){this.value=value;this.writableEnded=true;}};
   await handler({url:'/api/catalog',method:'GET',headers:{},socket:{}},res);
   assert.equal(res.writableEnded,true,'El handler debe esperar a que termine la respuesta');
   const data=JSON.parse(res.value);
   ${scenario==='seed'?"assert.equal(res.status,200);assert.equal(data.products.length,20);":"assert.equal(res.status,503);assert(data.error.includes('JSONBIN_BIN_ID'));"}
  `;
  const result=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:process.cwd(),encoding:'utf8',env:{...process.env,VERCEL:'1',DATA_DIR:path.join(process.cwd(),'does-not-exist','read-only'),JSONBIN_BIN_ID:scenario==='seed'?'':'invalid-placeholder',JSONBIN_ACCESS_KEY:scenario==='seed'?'':'test-key'}});
  assert.equal(result.status,0,result.stderr);
 }
});

test('Adaptadores JSONBin y Cloudinary: credenciales de servidor y sesión entre instancias',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'winni-cloud-test-'));
 process.env.DATA_DIR=dir;process.env.ADMIN_PASSWORD='cloud-test-long-password';
 process.env.JSONBIN_BIN_ID='1234567890abcdef12345678';process.env.JSONBIN_ACCESS_KEY='private-test-key';
 process.env.CLOUDINARY_CLOUD_NAME='test-cloud';process.env.CLOUDINARY_API_KEY='test-key';process.env.CLOUDINARY_API_SECRET='private-test-secret';
 const originalFetch=globalThis.fetch;let record={products:[]},writes=0,uploads=0;
 globalThis.fetch=async(url,options)=>{
  if(String(url).startsWith('https://api.jsonbin.io/')){assert.equal(options.headers['X-Access-Key'],'private-test-key');if(options.method==='PUT'){writes++;record=JSON.parse(options.body);}return new Response(JSON.stringify({record}),{status:200});}
  if(String(url).startsWith('https://api.cloudinary.com/')){uploads++;assert.equal(options.body.get('api_key'),'test-key');assert(options.body.get('signature'));assert(!options.body.has('api_secret'));return new Response(JSON.stringify({secure_url:'https://res.cloudinary.com/test/image/upload/photo.png'}));}
  return originalFetch(url,options);
 };
 const {server}=await import('../server.mjs?cloud-test');await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;let cookie;
 const request=(route,method='GET',body)=>originalFetch(base+route,{method,headers:{'Content-Type':'application/json',Cookie:cookie||''},body:body?JSON.stringify(body):undefined});
 try{
  const login=await request('/api/login','POST',{password:process.env.ADMIN_PASSWORD});cookie=login.headers.get('set-cookie').split(';')[0];
  const upload=await (await request('/api/admin/upload','POST',{data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1kAAAAASUVORK5CYII='})).json();assert.equal(uploads,1);
  const input={nombre:'Remoto',categoria:'TEST',descripcion:'Descripción',precio:10,imagen:upload.url};assert.equal((await request('/api/admin/products','POST',input)).status,200);assert.equal(writes,1);
  const publicData=await (await request('/api/catalog')).json();assert.equal(publicData.products.length,1);assert(!JSON.stringify(publicData).includes('private-test'));
  const {server:other}=await import('../server.mjs?other-instance');await new Promise(r=>other.listen(0,'127.0.0.1',r));try{const response=await originalFetch(`http://127.0.0.1:${other.address().port}/api/admin/catalog`,{headers:{Cookie:cookie}});assert.equal(response.status,200);}finally{await new Promise(r=>other.close(r));}
 }finally{globalThis.fetch=originalFetch;await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
