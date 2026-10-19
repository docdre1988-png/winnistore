# Winni Store

Sitio local con el catálogo de CATALOGO (1).xlsx, Hoja1, filas 2–21: 20 productos, 6 categorías y 47 imágenes extraídas del archivo y optimizadas en WebP.

- Productos y precios: config.js. Se conservan los precios anteriores cuando existen.
- Categorías: TELEFONIA Y ACCESORIOS, CALZADO Y ZAPATILLAS, ELECTROHOGAR, MUJER, HOMBRES y EDUCACION. La fila 9 (New Balance) no tenía categoría y se asignó a CALZADO Y ZAPATILLAS, siguiendo su sección.
- Descripciones: visibles exclusivamente en la ventana del producto, junto con una sola imagen y el botón para agregar a la bolsa. Abre con clic o teclado y cierra con el botón, Escape o clic fuera.
- Limpieza editorial: se excluyó una nota de edición del combo Practika (D13) y una frase sobre certificado ajena al polo Sybilla (D17). Las demás descripciones proceden del Excel.
- Contacto: completar CONFIG.whatsapp con el número real, incluyendo código de país y sin símbolos. Mientras está vacío, se puede copiar el pedido.
- Imágenes del catálogo: assets/catalogo/. No requieren servicios externos. La tipografía de Google requiere internet y cuenta con fuentes de respaldo.
- El modelo anterior se conserva en modelo-original/. Las páginas legales heredadas requieren los datos reales antes de enlazarlas.
- Bolsa guardada en el navegador con una nueva clave para evitar mezclar el catálogo antiguo de ejemplo.

Validación: sintaxis de JavaScript; reconciliación de productos, categorías e imágenes; apertura y cierre de las 20 fichas; descripción ausente de tarjetas; búsqueda, filtro por categoría y totales de bolsa. No se realizó una comprobación visual en navegador en esta actualización.

Actualización: una imagen visible por producto, sin miniaturas ni galería. Se conservan los archivos de imagen originales para futuros cambios.

## Administración

Panel nuevo: admin.html. El proyecto está preparado para Vercel con catálogo en JSONBin y fotos en Cloudinary. Sigue ADMIN-SETUP.md para configurar las seis variables de entorno y activar la conexión real. El contacto de pedidos ya está configurado al +51 914 663 723. Para probar localmente: copia .env.example a .env, define ADMIN_PASSWORD y ejecuta npm start.

## Catálogo revisado por fila

Se cotejaron visualmente las 47 imágenes incrustadas del Excel y se seleccionó una foto correspondiente para cada uno de los 20 productos. Algunas anclas incluyen imágenes de otros modelos; no se usa automáticamente la primera imagen de la fila. El mapa revisado y la huella del archivo fuente están en data/catalog.review.json. El importador se detiene si cambia el archivo y exige nuevo cotejo.

Se corrigieron las fotos de AirPods, Converse, Nike, Adidas Response Pace, Puma Running, freidora Oster y top Sybilla. Se conservan las rutas públicas que el catálogo de JSONBin ya utiliza. Los productos agregados por el dueño y sus fotos en Cloudinary no se modifican.
