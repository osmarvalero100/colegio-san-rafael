# ERP Colegio San Rafael — Frontend

Interfaz web del sistema académico y administrativo del **Colegio San Rafael**. SPA estática (sin build step) en **HTML/CSS/JS vanilla con ES modules**, que consume la API REST del backend.

- **Stack:** HTML5 · CSS3 · JavaScript (ES modules) · sin frameworks ni dependencias
- **Backend:** repositorio hermano `colegio` (Node.js + Express + MySQL)
- **Despliegue:** GitHub Pages (carpeta `/frontend`)

---

## 1. Estructura

```
frontend/
├── index.html               # Login + shell + 11 pantallas (SPA)
└── assets/
    ├── css/styles.css       # Sistema de diseño del mockup (mockup-colegio.html)
    └── js/
        ├── config.js        # Única fuente de la URL del backend (API_URL)
        ├── api.js           # Cliente fetch con JWT y manejo de errores
        ├── auth.js          # Login/logout, token y sesión (localStorage)
        ├── context.js       # Catálogos y estado global por rol
        ├── utils.js         # Helpers (modales, toasts, formatos)
        ├── app.js           # Bootstrap: arranca el router de pantallas
        └── *.js             # Un módulo por pantalla (resumen, estudiantes, ...)
```

---

## 2. Requisitos

- Navegador moderno (Chrome, Edge, Firefox, Safari) con soporte de **ES modules**.
- El backend corriendo en `http://localhost:3000` (ver repo `colegio`).

---

## 3. Puesta en marcha

```bash
cd backend        # (repositorio hermano) levantar la API
npm install
npm start         # http://localhost:3000

cd frontend       # este repositorio
python3 -m http.server 5000
```

Abrir `http://localhost:5000`.

> No hay build: se sirven los archivos tal cual. La URL del backend se configura **solo** en `frontend/assets/js/config.js`.

---

## 4. Configuración de la API

Editar `assets/js/config.js`:

```js
// Local (desarrollo):
export const API_URL = "http://localhost:3000/api";
// Producción (Render) — descomentar y ajustar:
// export const API_URL = "https://TU-SERVICIO.onrender.com/api";
```

---

## 5. Credenciales demo

| Rol        | Usuario      | Contraseña     |
|------------|--------------|----------------|
| ADMIN      | `admin`      | `Admin123!`    |
| SECRETARIA | `secretaria` | `Secretaria123!` |
| PROFESOR   | `profesor`   | `Demo123!`     |
| ESTUDIANTE | `estudiante` | `Demo123!`     |
| TUTOR      | `tutor`      | `Demo123!`     |

El menú lateral se adapta al rol: cada usuario ve solo las pantallas que le corresponden (el control de acceso también está validado en el backend).

---

## 6. Despliegue (GitHub Pages)

1. En GitHub: **Settings → Pages** → deploy desde la rama `main`, carpeta `/frontend`.
2. Editar `assets/js/config.js`:

```js
export const API_URL = "https://TU-SERVICIO.onrender.com/api";
```

3. Publicar y verificar en `https://TU-USUARIO.github.io/colegio-san-rafael/`.

> **CORS** es la causa más común de fallos en producción: el backend debe tener `CORS_ORIGIN` con el dominio exacto de Pages (protocolo `https://` incluido, sin `/` final).

---

## 7. Pantallas

| Pantalla | Módulo | Acceso típico |
|----------|--------|---------------|
| Resumen general | `resumen.js` | todos |
| Estudiantes | `estudiantes.js` | ADMIN, SECRETARIA |
| Matrículas | `matriculas.js` | ADMIN, SECRETARIA |
| Notas | `notas.js` | ADMIN, PROFESOR |
| Asistencia | `asistencia.js` | ADMIN, PROFESOR |
| Horarios | `horarios.js` | ADMIN, SECRETARIA |
| Pagos | `pagos.js` | ADMIN, SECRETARIA, TUTOR |
| Profesores | `profesores.js` | ADMIN, SECRETARIA |
| Usuarios y roles | `usuarios.js` | ADMIN |
| Configuración | `configuracion.js` | ADMIN |
| Notificaciones | `notificaciones.js` | todos |

---

## 8. Pruebas

Los tests E2E (Chrome DevTools Protocol) se ejecutan desde la raíz del proyecto:

```bash
npm run test:static   # Validador estático de identificadores no declarados
npm run test:screens  # Cada rol renderiza sus pantallas sin errores de consola
npm run test:pagos    # Flujo de pagos E2E
npm run test:crud     # CRUD E2E (profesor, usuario, concepto de pago)
```

Requieren un Chromium headless con CDP y los servidores de backend y frontend corriendo.
