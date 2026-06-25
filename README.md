# CRM Besso Automotores

CRM web para la concesionaria **Besso Automotores**: stock de vehículos, pipeline de
clientes (kanban), panel de métricas y gestión del equipo. Multiusuario, sincronizado
entre dispositivos, con login real y roles.

- **Frontend:** HTML + CSS + JavaScript clásico (sin build, sin frameworks, sin módulos).
- **Backend:** [Supabase](https://supabase.com) (Postgres + Auth + Row Level Security).
- **Deploy:** sitio estático en [Vercel](https://vercel.com) (HTTPS incluido).

---

## 📁 Estructura

```
.
├─ index.html              Shell de la app + pantalla de login
├─ css/styles.css          Todos los estilos (navy / azul / blanco, Manrope)
├─ js/
│  ├─ config.js            SB_URL y SB_ANON_KEY  ← acá pegás tus credenciales
│  ├─ supabaseClient.js    Inicializa el cliente de Supabase (CDN)
│  ├─ auth.js              Login, sesión, logout, lectura del rol
│  ├─ data.js              CRUD a Supabase (autos, leads, notas, perfiles)
│  ├─ dashboard.js         Panel: métricas, barras y embudo
│  ├─ stock.js             Gestión de autos
│  ├─ leads.js             Kanban + ficha de cliente
│  ├─ usuarios.js          Equipo (solo dueño)
│  └─ app.js               Router, navegación, modales, toasts, init
├─ sql/schema.sql          Script SQL completo para Supabase (tablas + RLS)
├─ vercel.json             Cabeceras de seguridad para el deploy
└─ README.md
```

Los scripts se cargan en orden de dependencia con `<script src>` clásico. El cliente de
Supabase viene por CDN (`@supabase/supabase-js@2`).

---

## 🚀 Puesta en marcha

### 1) Crear el proyecto en Supabase
1. Entrá a [supabase.com](https://supabase.com) → **New project**.
2. Elegí nombre, contraseña de la base y región (la más cercana, ej. São Paulo).
3. Esperá a que termine de aprovisionarse (~2 min).

### 2) Crear las tablas y la seguridad
1. En el panel de Supabase, andá a **SQL Editor** → **New query**.
2. Copiá **todo** el contenido de [`sql/schema.sql`](sql/schema.sql) y pegalo.
3. Apretá **Run**. Esto crea las tablas (`perfiles`, `autos`, `leads`, `lead_notas`),
   activa Row Level Security y crea las políticas y el trigger que arma el perfil al
   registrarse un usuario.

### 3) Pegar las credenciales en el frontend
1. En Supabase → **Project Settings** → **API**.
2. Copiá **Project URL** y la **anon public** key.
3. Abrí [`js/config.js`](js/config.js) y reemplazá los placeholders:

   ```js
   window.CRM_CONFIG = {
     SB_URL:      "https://xxxxxxxx.supabase.co",
     SB_ANON_KEY: "eyJhbGciOi...."   // anon public key
   };
   ```

   > ⚠️ **Nunca** pongas la `service_role` key acá. Solo la `anon`. La seguridad real la
   > dan las políticas RLS, no el frontend.

### 4) Crear el usuario dueño
Tenés dos opciones:

**A. Desde Supabase (recomendado):**
1. **Authentication** → **Users** → **Add user** → email + contraseña.
   - Opcional: en *User Metadata* agregá `{ "nombre": "Tu Nombre" }`.
2. El trigger crea su perfil con rol `vendedor`. Para hacerlo **dueño**, andá a
   **SQL Editor** y ejecutá (cambiando el email):

   ```sql
   update public.perfiles
   set rol = 'dueño'
   where id = (select id from auth.users where email = 'TU_EMAIL@besso.com');
   ```

**B. Auto-registro:** si activás *Sign up* en Supabase Auth, podés registrar usuarios
y luego marcar el rol con el mismo `update` de arriba.

> Para agregar **vendedores**, creales el usuario en *Authentication → Users*. Quedan
> con rol `vendedor` por defecto. Desde la sección **Equipo** del CRM, el dueño puede
> cambiar roles cuando quiera.

### 5) Probar localmente
No alcanza con abrir el `index.html` con doble clic (hace falta servirlo por HTTP).
Levantá un server estático desde la carpeta del proyecto:

```bash
# Opción 1: Python
python -m http.server 5173

# Opción 2: Node
npx serve .
```

Abrí <http://localhost:5173> e ingresá con el usuario dueño.

---

## ☁️ Deploy en Vercel

1. Subí el proyecto a un repo de GitHub (o usá `vercel` CLI).
2. En [vercel.com](https://vercel.com) → **Add New… → Project** → importá el repo.
3. **Build & Output Settings:** dejá todo vacío.
   - Framework Preset: **Other**
   - Build Command: *(vacío)*
   - Output Directory: *(vacío / raíz)*
   Es un sitio estático: no hay paso de build.
4. **Deploy.** Vercel sirve los archivos tal cual y agrega HTTPS automáticamente.

> Las credenciales viven en `js/config.js` (la `anon` key es pública por diseño).
> No hace falta configurar variables de entorno en Vercel.

### CORS
Por defecto Supabase acepta peticiones desde cualquier origen con la `anon` key, así que
no hay que tocar nada. Si querés restringirlo, configurá los orígenes permitidos en
Supabase.

---

## 👤 Roles y permisos

| Acción                         | Dueño | Vendedor |
|--------------------------------|:-----:|:--------:|
| Ver panel y métricas           |  ✅   |    ✅    |
| Ver stock                      |  ✅   |    ✅    |
| Agregar / editar / borrar autos|  ✅   |    ❌    |
| Ver clientes (leads)           | todos | solo los suyos |
| Crear / editar sus clientes    |  ✅   |    ✅    |
| Sección **Equipo**             |  ✅   |    ❌    |
| Cambiar roles del equipo       |  ✅   |    ❌    |

Estos permisos están reforzados en el backend con **Row Level Security**: aunque alguien
manipule el frontend, la base de datos no le deja leer ni escribir lo que no le
corresponde.

---

## 🔒 Seguridad

- En el frontend solo se usa la **anon key** (pública por diseño).
- **Nunca** se expone la `service_role` key.
- Todo el acceso a datos pasa por Supabase con RLS activado en todas las tablas.
- HTTPS lo provee Vercel.

---

## 📸 Fotos de autos (Stock)

- En el formulario de auto (solo Dueño) podés **subir varias fotos** (`accept="image/*"`,
  múltiples). Se ven en miniatura, podés **quitarlas** y **marcar la principal** (la
  primera del array).
- Antes de subir, cada imagen se **comprime en el navegador** con canvas: se redimensiona
  a máx **1200px** de ancho y se exporta a JPEG (~0.72); si pesa más de **250KB** se
  recomprime bajando calidad. Se muestra el **peso final** de cada foto.
- Se suben al bucket **`autos`** de Supabase Storage usando el **access_token de la sesión**
  (apikey = anon). Se guarda el **array de URLs públicas** en el campo `fotos` del auto.
- Es el **mismo bucket y tabla** que usa la web pública, así que los autos cargados desde
  el CRM aparecen con sus fotos en josebessoautomoviles.com.ar.
- En la tabla de Stock se muestra la **miniatura de la foto principal** (o un placeholder).
- Si una foto falla al subir, se avisa con un toast y **el resto se guarda igual**.

> Requiere haber corrido la sección **9) STORAGE** de `sql/schema.sql` (crea/asegura el
> bucket público `autos` y las políticas para que el equipo autenticado pueda subir).

## 🧩 Pendientes / mejoras futuras (opcional)

- Arrastrar y soltar (drag & drop) entre columnas del kanban (hoy el cambio de etapa se
  hace desde la ficha del cliente).
- Reordenar fotos arrastrando (hoy se reordena marcando "principal").
- Exportar reportes a CSV.
- Recuperación de contraseña por email (se activa desde Supabase Auth).
```
