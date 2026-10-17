import openpyxl,json,re,io
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parent.parent
s=openpyxl.load_workbook(r'C:\Users\USUARIO\Downloads\CATALOGO (1).xlsx',data_only=True).active
out=root/'assets'/'catalogo';out.mkdir(exist_ok=True)
images={}
for i,img in enumerate(s._images,1):
    row=img.anchor._from.row+1
    name=f'producto-{row-1}-{i}.webp'
    im=Image.open(io.BytesIO(img._data())).convert('RGB');im.thumbnail((1200,1200));im.save(out/name,'WEBP',quality=86)
    images.setdefault(row,[]).append('assets/catalogo/'+name)
products=[];category=''
for row in range(2,s.max_row+1):
    cat,_,name,description,price,old=[s.cell(row,c).value for c in range(1,7)]
    if not name:continue
    category=str(cat).strip() if cat else category
    description=str(description or '').replace('Haz la descripción más vendedoraAñade una llamada a la acción','').strip()
    if row==17:description=description.replace(' Se entrega certificado al concluir el curso','')
    products.append(dict(id=1000+row,nombre=re.sub(r'\s+',' ',name).strip(),categoria=category,precio=float(price),precioAnterior=float(old) if old else None,imagen=images[row][0],imagenes=images[row][:1],descripcion=description,disponible='SI',destacado='SI' if old and old>price else 'NO'))
(root/'config.js').write_text('// Fuente: CATALOGO (1).xlsx, Hoja1, filas 2–21.\nconst CONFIG = '+json.dumps(dict(negocio='Winni Store',whatsapp='51914663723',moneda='S/',catalogoDemo=False),ensure_ascii=False)+';\nconst PRODUCTOS = '+json.dumps(products,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
print(json.dumps({'productos':len(products),'categorias':sorted(set(p['categoria'] for p in products)),'imagenes':sum(len(p['imagenes']) for p in products)},ensure_ascii=False))
