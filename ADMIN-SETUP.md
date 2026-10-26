# Panel de administración de Winni Store

## Vercel + JSONBin + Cloudinary

El panel está en `/admin.html`. Permite crear, editar, ocultar y eliminar productos, crear categorías y subir una foto por producto. La tienda consulta el catálogo compartido al cargar y al volver a la pestaña. Nunca se exponen las claves de los servicios al navegador.

### Configuración necesaria

1. Crea un **bin privado** en JSONBin con el contenido de `data/catalog.seed.json` (20 productos iniciales). Si ya realizaste cambios con el servidor local, usa `data/catalog.json` para migrarlos.
2. Crea una Access Key con permisos de lectura y actualización del bin.
3. Crea un entorno de Cloudinary para guardar las fotografías.
4. En Vercel, importa este proyecto y configura estas variables de entorno para los entornos deseados:

| Variable | Contenido |
| --- | --- |
| `ADMIN_PASSWORD` | Contraseña del panel (no puede estar vacía) |
| `JSONBIN_BIN_ID` | ID del bin privado |
| `JSONBIN_ACCESS_KEY` | Access Key del bin |
| `CLOUDINARY_CLOUD_NAME` | Cloud name de Cloudinary |
| `CLOUDINARY_API_KEY` | API key de Cloudinary |
| `CLOUDINARY_API_SECRET` | API secret de Cloudinary |

5. Despliega o vuelve a desplegar tras configurar las variables. `vercel.json` prepara los archivos públicos con `tools/build.mjs` y enruta `/api/*` hacia la función del servidor.
6. Abre `/admin.html` e ingresa la contraseña. El panel mostrará “Guardado: JSONBin”. Agrega un producto y comprueba que aparece en otra pestaña de la tienda.

Las credenciales no fueron proporcionadas, por lo que **no se ha conectado ni desplegado una cuenta real**. No guardes claves en config.js, en Git ni en mensajes públicos. No uses el antiguo servidor estático para administrar: las operaciones necesitan la API.

### Fotografías

En Vercel las fotos se suben a Cloudinary mediante una solicitud firmada por el servidor. Se permiten JPG, PNG y WebP hasta 3 MB. También puedes pegar una URL HTTPS de una imagen ya alojada. La tienda mantiene una sola imagen por producto. JSONBin guarda los datos y URLs, no las fotos. Los originales del catálogo siguen publicados desde assets/catalogo.

Eliminar un producto no destruye su foto en Cloudinary: podría utilizarse en otro registro o en una versión anterior del catálogo.

### Sesión y límites

La sesión es una cookie firmada HttpOnly y SameSite=Strict con duración de ocho horas, compatible con distintas instancias de Vercel. En Vercel usa Secure. Cerrar sesión borra la cookie del navegador; cambiar ADMIN_PASSWORD invalida todas las sesiones. No hay contraseña predeterminada ni alta pública de administradores.

El límite de intentos de contraseña (diez por IP cada quince minutos) es por instancia; para protección global configura las reglas de seguridad de Vercel. No es un servicio de usuarios con recuperación de contraseña.

Las actualizaciones de JSONBin guardan el documento completo sin solicitar historial de versiones. El máximo preventivo es 95 KB. Las lecturas tienen caché por instancia de hasta 15 segundos. Usa un solo administrador a la vez: JSONBin no ofrece aquí una transacción entre funciones y dos cambios simultáneos podrían sobrescribirse. Para varios administradores concurrentes habría que agregar coordinación persistente o migrar a una base transaccional.

### Prueba local

Node.js 22 o posterior. Copia `.env.example` a `.env`, define ADMIN_PASSWORD y ejecuta `npm start`. Visita http://127.0.0.1:4174/admin.html. No hay dependencias que instalar.

Sin credenciales de servicios, el servidor local usa data/catalog.json y data/uploads; los cambios persisten en ese equipo. En Vercel se rechaza guardar sin JSONBin o subir fotos sin Cloudinary para evitar pérdidas por almacenamiento temporal. Si no configuras JSONBin, la tienda puede mostrar el catálogo inicial y el panel debe configurarse antes de editar.

`npm test` verifica autenticación, aislamiento de archivos privados, validación, CRUD, ocultación, fotos y conexiones simuladas. `node tools/build.mjs` prepara la carpeta public para Vercel.

Referencias oficiales: https://jsonbin.io/api-reference/bins/read, https://jsonbin.io/api-reference/bins/update, https://cloudinary.com/documentation/image_upload_api_reference y https://vercel.com/docs/functions/runtimes/node-js.

## Categorías independientes

El panel incluye «Agregar categoría» junto a «Agregar producto». El nombre se guarda en la propiedad categories del mismo catálogo de JSONBin y aparece en los filtros de la tienda, aunque todavía no tenga productos. Las categorías existentes se reconocen automáticamente desde los productos; no hay que migrar el bin ni agregar variables. Se impiden nombres vacíos y duplicados por mayúsculas o espacios. Las nuevas categorías usan un icono general del catálogo y los colores de la marca. La tienda actualiza los filtros al cargar o volver a la pestaña (las lecturas pueden tener hasta 15 segundos de caché por instancia).

Cada categoría incluye un botón «Eliminar» con confirmación. Las vacías se eliminan directamente; si tiene productos (también ocultos), el dueño elige otra categoría para trasladarlos en la misma operación. No se eliminan productos ni imágenes. Si no hay otra categoría, debe crearla primero. La categoría eliminada deja de aparecer en los filtros y en el selector del formulario.
