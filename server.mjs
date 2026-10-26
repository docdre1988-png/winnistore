import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes, timingSafeEqual,createHmac,createHash} from 'node:crypto';
const root=process.env.VERCEL?process.cwd():path.dirname(fileURLToPath(import.meta.url));
const dataDir=path.resolve(process.env.DATA_DIR||(process.env.VERCEL?'/tmp/winni':path.join(root,'data')));
const password=process.env.ADMIN_PASSWORD||'';
const bin=(process.env.JSONBIN_BIN_ID||'').trim(),key=(process.env.JSONBIN_ACCESS_KEY||'').trim();
const configError=Boolean(bin)!==Boolean(key)?'Configura JSONBIN_BIN_ID y JSONBIN_ACCESS_KEY juntos.':bin&&!/^[a-f\d]{24}$/i.test(bin)?'JSONBIN_BIN_ID inválido. Usa solo el ID de 24 caracteres, no la URL.':null;
const attempts=new Map();let queue=Promise.resolve(),cache;
const sign=value=>createHmac('sha256',password).update(value).digest('hex');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
const categoryKey=name=>name.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');
function catalogCategories(record,products=record.products){
 const categories=[],seen=new Set();
 for(const value of [...(Array.isArray(record.categories)?record.categories:[]),...products.map(p=>p.categoria)]){
  if(typeof value!=='string'||!value.trim())continue;
  const name=value.trim().replace(/\s+/g,' '),key=categoryKey(name);
  if(!seen.has(key)){seen.add(key);categories.push(name);}
 }
 return categories;
}
async function jsonbin(method,body){
 const response=await fetch(`https://api.jsonbin.io/v3/b/${bin}${method==='GET'?'/latest':''}`,{method,headers:{'Content-Type':'application/json','X-Access-Key':key},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
 if(!response.ok){
  const details=await response.json().catch(()=>({}));
  const message=String(details.message||'');
  if(/requests? exhausted|quota|credits? exhausted/i.test(message)||response.status===429)throw fail('JSONBin agotó su cuota de solicitudes. Revisa el consumo de la cuenta. [CATALOG_QUOTA]',502);
  if(/version/i.test(message))throw fail('JSONBin rechazó el historial de versiones. Revisa los límites del bin y del plan. [CATALOG_VERSIONS]',502);
  if(/schema|validation mismatch/i.test(message))throw fail('La estructura del producto no cumple la validación configurada en JSONBin. [CATALOG_SCHEMA]',502);
  if(/100kb|record over|size|too large/i.test(message))throw fail('JSONBin rechazó el tamaño del catálogo. [CATALOG_SIZE]',502);
  if(/does not have permission|grant.*permission|permission.*update|permission.*read/i.test(message))throw fail('La clave que usa este despliegue no tiene el permiso necesario. Si la clave de tu cuenta ya tiene Read y Update, verifica que JSONBIN_ACCESS_KEY en Vercel contenga esa misma clave completa. [CATALOG_PERMISSION]',502);
  if(/invalid.*key|key.*invalid|need to pass.*key|unauthorized|does not belong/i.test(message)||response.status===401)throw fail('JSONBin rechazó la clave configurada en Vercel. JSONBIN_ACCESS_KEY debe contener la clave completa, no el Access Key ID ni la Master Key. [CATALOG_KEY]',502);
  if(response.status===404||/bin not found|invalid bin/i.test(message))throw fail('No se encontró el catálogo configurado. JSONBIN_BIN_ID debe ser el ID del bin, no el Access Key ID. [CATALOG_BIN]',502);
  throw fail(`JSONBin rechazó ${method==='PUT'?'el guardado':'la lectura'} del catálogo (HTTP ${response.status}). No se confirmó un problema de permisos. [CATALOG_REJECTED]`,502);
 }
 return (await response.json()).record;
}
async function read(){if(configError)throw fail(configError,503);if(bin){if(cache&&Date.now()-cache.time<15000)return structuredClone(cache.record);const record=await jsonbin('GET');if(!record||!Array.isArray(record.products))throw fail('El bin debe contener un objeto con products.',502);cache={time:Date.now(),record};return structuredClone(record);}try{return JSON.parse(await fs.readFile(path.join(dataDir,'catalog.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;return JSON.parse(await fs.readFile(path.join(root,'data/catalog.seed.json'),'utf8'));}}
async function write(record){if(configError)throw fail(configError,503);if(process.env.VERCEL&&!bin)throw fail('Configura JSONBin antes de guardar en Vercel.',503);if(Buffer.byteLength(JSON.stringify(record))>95000)throw fail('El catálogo supera el límite configurado de 95 KB.');if(bin){await jsonbin('PUT',record);cache={time:Date.now(),record:structuredClone(record)};}else{await fs.mkdir(dataDir,{recursive:true});await fs.writeFile(path.join(dataDir,'catalog.tmp'),JSON.stringify(record,null,2));await fs.rename(path.join(dataDir,'catalog.tmp'),path.join(dataDir,'catalog.json'));}}
function validate(p){
 for(const [field,max] of [['nombre',180],['categoria',80],['descripcion',10000]])if(typeof p[field]!=='string'||!p[field].trim()||p[field].length>max)throw fail(`Revisa el campo ${field}.`);
 if(['todos','__new__'].includes(categoryKey(p.categoria)))throw fail('Ese nombre de categoría está reservado. Elige otro nombre.');
 if(typeof p.precio!=='number'||!Number.isFinite(p.precio)||p.precio<=0||p.precio>1000000)throw fail('Precio inválido.');
 if(p.precioAnterior!=null&&(!Number.isFinite(p.precioAnterior)||p.precioAnterior<=p.precio))throw fail('El precio anterior debe superar el precio actual.');
 if(typeof p.imagen!=='string'||p.imagen.length>2000||!(/^(?:assets\/catalogo\/|\/uploads\/)[a-zA-Z0-9_.-]+$/.test(p.imagen)||(/^https:\/\//.test(p.imagen)&&(()=>{try{const u=new URL(p.imagen);return !u.username&&!u.password;}catch{return false;}})())))throw fail('Usa una imagen del catálogo, una foto subida o una URL HTTPS.');
 return {nombre:p.nombre.trim(),categoria:p.categoria.trim(),descripcion:p.descripcion.trim(),precio:Math.round(p.precio*100)/100,precioAnterior:p.precioAnterior==null?null:Math.round(p.precioAnterior*100)/100,imagen:p.imagen,imagenes:[p.imagen],disponible:p.disponible==='NO'?'NO':'SI',destacado:p.destacado==='SI'?'SI':'NO'};
}
async function body(req){if(req.body&&typeof req.body==='object'){if(Buffer.byteLength(JSON.stringify(req.body))>4400000)throw fail('Archivo demasiado grande.',413);return req.body;}let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>4400000)throw fail('Archivo demasiado grande.',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw fail('JSON inválido.');}}
function send(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
function authed(req){const token=(req.headers.cookie||'').split('; ').find(x=>x.startsWith('winni_admin='))?.slice(12);if(password.length>0&&token){const [expiry,nonce,signature]=token.split('.');if(Number(expiry)>Date.now()&&nonce&&signature&&equal(sign(`${expiry}.${nonce}`),signature))return token;}throw fail('Inicia sesión para continuar.',401);}
function originCheck(req){if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw fail('Origen no permitido.',403);}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
export async function handleRequest(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
 try{
 const url=new URL(req.url,'http://localhost'),route=url.pathname;
 if(route.startsWith('/api/')){
  if(req.method!=='GET')originCheck(req);
  if(route==='/api/catalog'&&req.method==='GET'){const record=await read();const products=record.products.filter(p=>p.disponible==='SI');return send(res,200,{products,categories:catalogCategories(record,products)});}
  if(route==='/api/login'&&req.method==='POST'){
   if(!password.length)throw fail('Configura ADMIN_PASSWORD en el servidor. No puede estar vacía.',503);
   const ip=req.socket.remoteAddress,now=Date.now();let limit=attempts.get(ip);if(!limit||now>limit.until){limit={count:0,until:now+900000};attempts.set(ip,limit);}if(limit.count>=10)throw fail('Demasiados intentos. Espera 15 minutos.',429);
   const input=await body(req);if(typeof input.password!=='string'||!equal(input.password,password)){limit.count++;throw fail('Contraseña incorrecta.',401);}attempts.delete(ip);
   const payload=`${now+8*3600000}.${randomBytes(16).toString('hex')}`,token=`${payload}.${sign(payload)}`;res.setHeader('Set-Cookie',`winni_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${req.socket.encrypted||process.env.VERCEL||process.env.COOKIE_SECURE==='true'?'; Secure':''}`);return send(res,200,{ok:true});
  }
  authed(req);
  if(route==='/api/logout'&&req.method==='POST'){res.setHeader('Set-Cookie',`winni_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${process.env.VERCEL||process.env.COOKIE_SECURE==='true'?'; Secure':''}`);return send(res,200,{ok:true});}
  if(route==='/api/admin/catalog'&&req.method==='GET'){const record=await read();return send(res,200,{...record,categories:catalogCategories(record),storage:bin?'JSONBin':'Local'});}
  if(route==='/api/admin/categories'&&req.method==='POST'){
   const input=await body(req);
   if(typeof input.nombre!=='string'||!input.nombre.trim()||input.nombre.length>80)throw fail('Escribe un nombre de categoría de hasta 80 caracteres.');
   const name=input.nombre.trim().replace(/\s+/g,' ');
   if(['todos','__new__'].includes(categoryKey(name)))throw fail('Ese nombre está reservado. Elige otro nombre para tu categoría.');
   const operation=queue.catch(()=>{}).then(async()=>{const record=await read();const categories=catalogCategories(record);if(categories.some(c=>categoryKey(c)===categoryKey(name)))throw fail('Esa categoría ya existe. Puedes seleccionarla al agregar un producto.',409);categories.push(name);record.categories=categories;await write(record);return categories;});
   queue=operation;return send(res,201,{ok:true,categories:await operation});
  }
  if(route==='/api/admin/categories'&&req.method==='DELETE'){
   const input=await body(req);
   if(typeof input.nombre!=='string'||!input.nombre.trim()||input.nombre.length>80)throw fail('Selecciona una categoría válida.');
   const operation=queue.catch(()=>{}).then(async()=>{
    const record=await read(),categories=catalogCategories(record);
    const name=categories.find(c=>categoryKey(c)===categoryKey(input.nombre));
    if(!name)throw fail('Esa categoría ya no existe.',404);
    const assigned=record.products.filter(p=>categoryKey(p.categoria)===categoryKey(name));
    let movedTo=null;
    if(assigned.length){
     if(typeof input.moverA!=='string')throw fail('Elige otra categoría para conservar los productos antes de eliminar esta.',409);
     movedTo=categories.find(c=>categoryKey(c)===categoryKey(input.moverA));
     if(!movedTo||categoryKey(movedTo)===categoryKey(name))throw fail('Selecciona una categoría de destino diferente y existente.');
     assigned.forEach(p=>{p.categoria=movedTo;});
    }
    record.categories=categories.filter(c=>categoryKey(c)!==categoryKey(name));
    await write(record);
    return {categories:record.categories,moved:assigned.length,movedTo};
   });
   queue=operation;return send(res,200,{ok:true,...await operation});
  }
  if(route==='/api/admin/upload'&&req.method==='POST'){
   const input=await body(req),buffer=Buffer.from(String(input.data||''),'base64');if(buffer.length<12||buffer.length>3*1024*1024)throw fail('La foto debe pesar menos de 3 MB.');
   const ext=buffer.subarray(0,3).equals(Buffer.from([255,216,255]))?'jpg':buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP'?'webp':null;if(!ext)throw fail('Solo se admiten imágenes JPG, PNG o WebP.');
   if(process.env.CLOUDINARY_CLOUD_NAME&&process.env.CLOUDINARY_API_KEY&&process.env.CLOUDINARY_API_SECRET){
    const timestamp=String(Math.floor(Date.now()/1000)),folder='winni',signature=createHash('sha1').update(`asset_folder=${folder}&folder=${folder}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET.trim()}`).digest('hex');
    const form=new FormData();form.set('file',new Blob([buffer],{type:`image/${ext==='jpg'?'jpeg':ext}`}),`producto.${ext}`);for(const [k,v] of Object.entries({timestamp,folder,asset_folder:folder,signature,api_key:process.env.CLOUDINARY_API_KEY.trim()}))form.set(k,v);
    const response=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(process.env.CLOUDINARY_CLOUD_NAME.trim())}/image/upload`,{method:'POST',body:form,signal:AbortSignal.timeout(20000)});if(!response.ok){
     const details=await response.json().catch(()=>({}));const message=String(details.error?.message||'');
     if(/signature|api.?key|api.?secret|unknown cloud|cloud.?name/i.test(message))throw fail('La conexión de fotos tiene credenciales incorrectas. Revisa los tres datos del servicio de imágenes en Vercel y vuelve a desplegar.',502);
     if(response.status===401||response.status===403||/permission|not allowed|access denied|unauthorized|forbidden/i.test(message))throw fail('La clave de fotos no tiene permiso para subir imágenes a la carpeta winni. Falta autorizar esa carpeta en el servicio de imágenes.',502);
     if(response.status===429||/quota|limit exceeded/i.test(message))throw fail('El servicio de fotos alcanzó su cuota. Contacta al administrador de la página.',502);
     throw fail('No se pudo subir la foto. Prueba con otra imagen; si continúa, revisa la conexión del servicio de imágenes.',502);
    }const result=await response.json();if(!result.secure_url?.startsWith('https://'))throw fail('Cloudinary no devolvió una imagen válida.',502);return send(res,201,{url:result.secure_url});
   }
   if(process.env.VERCEL)throw fail('Configura Cloudinary para subir fotos en Vercel, o usa una URL HTTPS.',503);
   await fs.mkdir(path.join(dataDir,'uploads'),{recursive:true});const name=randomBytes(16).toString('hex')+'.'+ext;await fs.writeFile(path.join(dataDir,'uploads',name),buffer);return send(res,201,{url:'/uploads/'+name});
  }
  const match=route.match(/^\/api\/admin\/products(?:\/(\d+))?$/);
  if(match&&['POST','PUT','DELETE'].includes(req.method)){
   const input=req.method==='DELETE'?null:validate(await body(req));const id=match[1]?Number(match[1]):null;
   if((req.method==='POST'&&id)||(req.method!=='POST'&&!id))throw fail('Ruta inválida.');
   const operation=queue.catch(()=>{}).then(async()=>{const record=await read();record.categories=catalogCategories(record);if(input){const existing=record.categories.find(c=>categoryKey(c)===categoryKey(input.categoria));input.categoria=existing||input.categoria;if(!existing)record.categories.push(input.categoria);}let product;if(req.method==='POST'){product={...input,id:Math.max(Date.now(),...record.products.map(p=>p.id+1))};record.products.push(product);}else{const index=record.products.findIndex(p=>p.id===id);if(index<0)throw fail('Producto no encontrado.',404);if(req.method==='DELETE')record.products.splice(index,1);else{product={...input,id};record.products[index]=product;}}await write(record);return product;});queue=operation;const product=await operation;return send(res,200,{ok:true,product});
  }
  throw fail('Ruta no encontrada.',404);
 }
 if(req.method!=='GET'&&req.method!=='HEAD')throw fail('Método no permitido.',405);
 const pages=new Set(['index.html','admin.html','admin.js','admin.css','script.js','config.js','styles.css','refinement.css']);const rel=decodeURIComponent(route==='/'?'/index.html':route).slice(1);
 if(!pages.has(rel)&&!/^assets\/[a-zA-Z0-9_./-]+$/.test(rel)&&!/^uploads\/[a-f0-9]+\.(jpg|png|webp)$/.test(rel))throw fail('No encontrado.',404);
 const base=rel.startsWith('uploads/')?dataDir:root,file=path.resolve(base,rel);if(!file.startsWith(base+path.sep))throw fail('No encontrado.',404);
 const buffer=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':rel.startsWith('uploads/')?'public, max-age=86400':'no-cache'});res.end(req.method==='HEAD'?undefined:buffer);
 }catch(e){send(res,e.status||(e.code==='ENOENT'?404:500),{error:e.status?e.message:e.code==='ENOENT'?'No encontrado.':'Error del servidor. Intenta nuevamente.'});}
}
export const server=http.createServer(handleRequest);
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(Number(process.env.PORT||4174),process.env.HOST||'127.0.0.1',()=>console.log(`Winni Store: http://127.0.0.1:${process.env.PORT||4174} · Admin: /admin.html`));
