'use strict';
let products=PRODUCTOS.filter(p=>p.disponible==='SI');
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>`${CONFIG.moneda} ${n.toFixed(2)}`;
let category='todos',cart=[],timer;
try{const saved=JSON.parse(sessionStorage.getItem('winni_bag_session_v1')||'[]');if(Array.isArray(saved))cart=saved.filter(x=>products.some(p=>p.id===x.id)&&Number.isInteger(x.quantity)&&x.quantity>0&&x.quantity<=99);}catch{}
function render(){const q=$('search').value.trim().toLocaleLowerCase('es');const sort=$('sort').value;const list=products.filter(p=>(category==='todos'||p.categoria===category)&&`${p.nombre} ${p.descripcion} ${p.categoria}`.toLocaleLowerCase('es').includes(q));list.sort((a,b)=>sort==='low'?a.precio-b.precio:sort==='high'?b.precio-a.precio:sort==='name'?a.nombre.localeCompare(b.nombre,'es'):Number(b.destacado==='SI')-Number(a.destacado==='SI'));$('results').textContent=`${list.length} productos`;$('empty').hidden=!!list.length;$('products').innerHTML=list.map(p=>`<article data-product="${p.id}"><div class="photo"><button class="product-preview" data-preview="${p.id}" aria-label="Ver ${esc(p.nombre)}"><img src="${esc(p.imagen)}" alt="${esc(p.nombre)}" width="600" height="660" loading="lazy"></button><button class="add" data-add="${p.id}" aria-label="Agregar ${esc(p.nombre)}">+</button></div><p class="category">${esc(p.categoria)}</p><h3><button class="product-title" data-preview="${p.id}">${esc(p.nombre)}</button></h3><span class="price">${money(p.precio)}</span> ${p.precioAnterior>p.precio?`<del class="old-price">${money(p.precioAnterior)}</del>`:""}</article>`).join('');document.querySelectorAll('[data-category]').forEach(b=>{b.classList.toggle('active',b.dataset.category===category);b.setAttribute('aria-pressed',String(b.dataset.category===category));});}
function renderCart(){$('count').textContent=cart.reduce((s,x)=>s+x.quantity,0);$('total').textContent=money(cart.reduce((s,x)=>s+products.find(p=>p.id===x.id).precio*x.quantity,0));$('checkout').disabled=!cart.length;$('status').textContent='';$('items').innerHTML=cart.length?cart.map(x=>{const p=products.find(p=>p.id===x.id);return `<div class="item"><img src="${esc(p.imagen)}" alt="${esc(p.nombre)}"><div><h3>${esc(p.nombre)}</h3><p>${money(p.precio)}</p><div class="quantity"><button data-id="${p.id}" data-change="-1" aria-label="Reducir ${esc(p.nombre)}">−</button><span>${x.quantity}</span><button data-id="${p.id}" data-change="1" aria-label="Aumentar ${esc(p.nombre)}">+</button></div></div><button class="remove" data-remove="${p.id}" aria-label="Quitar ${esc(p.nombre)}">Quitar</button></div>`;}).join(''):'<p class="note">Tu bolsa está vacía. Explora los productos y cursos para empezar.</p>';}
function save(){try{sessionStorage.setItem('winni_bag_session_v1',JSON.stringify(cart));}catch{}renderCart();}
function toast(s){$('toast').textContent=s;$('toast').classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>$('toast').classList.remove('visible'),2400);}
const categoryIcons = {
 'todos': '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
 'TELEFONIA Y ACCESORIOS': '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 5h4M11 18h2"/>',
 'CALZADO Y ZAPATILLAS': '<path d="m3 14 2-8 5 5 4 2 6 1 1 5H3v-5Zm0 2h18M9 10l-2 3m5-1-2 3m5-2-2 3"/>',
 'ELECTROHOGAR': '<path d="m3 11 9-8 9 8M5 9v12h14V9M9 21v-7h6v7"/>',
 'MUJER': '<path d="M9 3h6l1 5-2 3 5 10H5l5-10-2-3 1-5Zm0 0 3 3 3-3M10 11h4"/>',
 'HOMBRES': '<path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4c0 4-8 4-8 0Z"/>',
 'EDUCACION': '<path d="m2 9 10-5 10 5-10 5-10-5Zm4 2v6c4 3 8 3 12 0v-6M22 9v8"/>'
};
const categoryLabels = {'todos':'Ver todo','TELEFONIA Y ACCESORIOS':'Telefonía y accesorios','CALZADO Y ZAPATILLAS':'Calzado y zapatillas','ELECTROHOGAR':'Electrohogar','MUJER':'Mujer','HOMBRES':'Hombres','EDUCACION':'Educación'};
$('filters').setAttribute('role','group');
$('filters').setAttribute('aria-label','Categorías del catálogo');
function renderFilters(){$('filters').innerHTML=['todos',...new Set(products.map(p=>p.categoria))].map(c=>`<button data-category="${esc(c)}" aria-pressed="${c==='todos'}"><span class="category-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${categoryIcons[c]||categoryIcons.todos}</svg></span><span class="category-label">${esc(categoryLabels[c]||c)}</span></button>`).join('');}
renderFilters();
$('filters').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(b){category=b.dataset.category;render();}});
$('search').addEventListener('input',render);$('sort').addEventListener('change',render);
$('reset').addEventListener('click',()=>{category='todos';$('search').value='';render();});
$('products').addEventListener('click',e=>{const b=e.target.closest('[data-add]');if(!b){const card=e.target.closest('[data-product]');if(card)openProduct(Number(card.dataset.product));return;}const id=Number(b.dataset.add),item=cart.find(x=>x.id===id);if(item&&item.quantity>=99){toast('Máximo 99 unidades por producto.');return;}if(item)item.quantity++;else cart.push({id,quantity:1});save();toast('Producto agregado a tu bolsa.');});
$('open-cart').addEventListener('click',()=>$('cart').showModal());$('close-cart').addEventListener('click',()=>$('cart').close());
$('cart').addEventListener('click',e=>{if(e.target===$('cart')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('items').addEventListener('click',e=>{const r=e.target.closest('[data-remove]'),b=e.target.closest('[data-change]');if(r)cart=cart.filter(x=>x.id!==Number(r.dataset.remove));if(b){const item=cart.find(x=>x.id===Number(b.dataset.id));item.quantity=Math.min(99,item.quantity+Number(b.dataset.change));cart=cart.filter(x=>x.quantity>0);}if(r||b)save();});
$('checkout').addEventListener('click',async()=>{const message='Hola, Winni Store. Quisiera consultar:\n\n'+cart.map(x=>{const p=products.find(p=>p.id===x.id);return `${x.quantity} × ${p.nombre} — ${money(p.precio*x.quantity)}`;}).join('\n')+'\n\nTotal referencial: '+$('total').textContent+'\nConfirmar precios, opciones y disponibilidad.';if(/^\d{10,15}$/.test(CONFIG.whatsapp)){window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer');return;}try{await navigator.clipboard.writeText(message);$('status').textContent='Pedido copiado. Puedes compartirlo con la tienda.';}catch{$('status').textContent='Selecciona y copia tu pedido:';const area=document.createElement('textarea');area.value=message;area.rows=8;area.style.width='100%';$('status').append(area);area.select();}});
if(/^\d{10,15}$/.test(CONFIG.whatsapp))$('checkout').textContent='Pedir por WhatsApp ↗';
$('year').textContent=new Date().getFullYear();render();renderCart();

function openProduct(id){
 const p=products.find(p=>p.id===id);if(!p)return;
 $('product-name').textContent=p.nombre;
 $('product-category').textContent=p.categoria;
 $('product-description').textContent=p.descripcion;
 $('product-description').classList.add('description-collapsed');
 $('description-toggle').setAttribute('aria-expanded','false');
 $('description-toggle').textContent='Leer más';
 $('description-toggle').hidden=true;
 $('product-price').textContent=money(p.precio);
 $('product-old-price').textContent=p.precioAnterior>p.precio?money(p.precioAnterior):'';
 $('product-image').src=p.imagen;$('product-image').alt=p.nombre;
 $('product-add').dataset.id=String(id);$('product-dialog').showModal();
 $('product-dialog').scrollTop=0;
 requestAnimationFrame(()=>{const description=$('product-description');$('description-toggle').hidden=description.scrollHeight<=description.clientHeight+1;});
}
$('product-close').addEventListener('click',()=>$('product-dialog').close());
$('product-dialog').addEventListener('click',e=>{if(e.target!==$('product-dialog'))return;const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();});
$('product-add').addEventListener('click',()=>{const id=Number($('product-add').dataset.id),item=cart.find(x=>x.id===id);if(item&&item.quantity>=99){toast('Máximo 99 unidades por producto.');return;}if(item)item.quantity++;else cart.push({id,quantity:1});save();toast('¡Un favorito más en tu bolsa!');});

async function refreshCatalog(){try{const response=await fetch("/api/catalog",{cache:"no-store"});if(!response.ok)return;const data=await response.json();if(!Array.isArray(data.products))return;products=data.products;cart=cart.filter(x=>products.some(p=>p.id===x.id));if(category!=="todos"&&!products.some(p=>p.categoria===category))category="todos";renderFilters();render();save();}catch{/* Static preview retains the seed catalog. */}}
refreshCatalog();
window.addEventListener("focus",refreshCatalog);

$('description-toggle').addEventListener('click',()=>{const expanded=$('description-toggle').getAttribute('aria-expanded')==='true';$('description-toggle').setAttribute('aria-expanded',String(!expanded));$('description-toggle').textContent=expanded?'Leer más':'Leer menos';$('product-description').classList.toggle('description-collapsed',expanded);});
