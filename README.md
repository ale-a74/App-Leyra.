# Leyra Seguridad

Aplicación local organizada por pantallas y módulos para gestionar los servicios de Leyra Seguridad.

## Inicio

Abrir `dashboard.html` en el navegador o ejecutar la aplicación de escritorio con Electron:

1. Instalar Node.js (versión LTS).
2. Desde esta carpeta, ejecutar `npm install` en CMD o `npm.cmd install` en PowerShell.
3. Iniciar la aplicación con `npm start` en CMD o `npm.cmd start` en PowerShell.

Electron abre `dashboard.html` como ventana nativa. Los datos se guardan en el almacenamiento local de esa instalación de la aplicación.

## Pantallas

- `dashboard.html`: inicio y resumen de órdenes.
- `clientes.html`: directorio de clientes.
- `ordenes.html`: órdenes de servicio.
- `presupuestos.html`: cotizador e historial de presupuestos.
- `equipos.html`: equipos y objetos vinculados a clientes.
- `inventario.html`: materiales y stock.

En presupuestos se puede imprimir una propuesta de insumos sin mano de obra o una factura final que incluye la mano de obra como un solo total. El cálculo interno de la mano de obra usa horas y valor por hora. Se pueden configurar el nombre comercial, frase, contactos, logo, color y estilo del documento desde «Marca y estética del presupuesto»; la identidad visual queda guardada localmente. También se pueden agregar servicios ofrecidos desde el selector del cotizador; quedan guardados en el navegador para futuros presupuestos. Las categorías de inventario se pueden ampliar desde el formulario para agregar materiales. Las órdenes no requieren asignar un técnico.

## Recursos compartidos

- `js/core.js`: datos compartidos, almacenamiento local, navegación y utilidades.
- `js/dashboard.js`, `js/clients.js`, `js/orders.js`, `js/quotes.js`, `js/objects.js`, `js/inventory.js`: lógica de cada módulo.
- `css/app.css`: estilos compartidos y plantilla de impresión.

Los registros continúan guardándose en el almacenamiento local del navegador.

## Sincronización entre dispositivos

La aplicación puede sincronizar clientes, órdenes, inventario, equipos, presupuestos y marca mediante un backend protegido y una base PostgreSQL persistente. Socket.IO transmite los cambios a las otras sesiones conectadas. El backend también publica la interfaz web: una vez desplegado, se puede abrir su URL HTTPS desde una computadora o un celular. Los datos se mantienen también en el almacenamiento local; si la red se interrumpe, la aplicación conserva una cola de cambios pendientes para reintentar el envío.

### Preparar PostgreSQL en Supabase

1. Crear un proyecto de Supabase y conservar el usuario y la contraseña de la base de datos.
2. Copiar la cadena de conexión PostgreSQL (preferentemente la del pooler de Supabase) y añadir `?sslmode=require` si no lo incluye.
3. La primera conexión del backend crea la tabla `app_state`; la cuenta de base de datos debe tener permiso para crearla y modificarla.

### Desplegar el backend en Render

1. Subir el proyecto a un repositorio privado de GitHub.
2. En Render, crear un **Blueprint** y conectar ese repositorio; Render leerá `render.yaml` y configurará `npm ci` y `npm run server`.
3. Configurar como secretos `DATABASE_URL` (cadena de Supabase) y `APP_PASSWORD` (contraseña compartida de al menos 12 caracteres). Render genera `JWT_SECRET` automáticamente.
4. Esperar que el servicio quede **Live** y copiar su URL HTTPS.

Para probar el backend localmente, copiar `.env.example` a `.env`, completar las variables y ejecutar `npm run server`. La cadena de Supabase debe exigir TLS (`sslmode=require`). No subir `.env` al repositorio.

### Conectar cada dispositivo

1. Abrir la aplicación de escritorio y elegir **Sincronización** en el panel lateral. En una computadora o celular, abrir la URL HTTPS de Render.
2. Escribir la URL HTTPS de Render (se completa automáticamente al abrir la versión web) y la contraseña compartida configurada en `APP_PASSWORD`.
3. El primer dispositivo que conecta una base vacía copia allí sus datos locales. Los siguientes dispositivos descargan la información de la nube y sincronizan sus cambios.

La aplicación conserva el modo local sin iniciar sesión, pero esos cambios no se comparten entre dispositivos. Los tokens vencen a las 12 horas y se debe volver a iniciar sesión. Render Free puede suspender el backend cuando no se usa; PostgreSQL de Supabase conserva los datos y la aplicación intenta reconectarse al volver a estar disponible.

El endpoint de login limita intentos, el resto de la API y Socket.IO requieren un token temporal, y solo se aceptan las claves de datos definidas por la aplicación. La contraseña y la cadena de base de datos se configuran únicamente como secretos del servidor; no deben incluirse en archivos del frontend.
