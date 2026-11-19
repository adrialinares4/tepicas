# Tepicas · prototipo fase 1

Reto diario de reflejos (5 intentos, media en ms, igual para todos) con ligas por enlace, tarjeta para WhatsApp y medición propia sin cookies.
Stack: Cloudflare Pages (estáticos en `public/`) + Pages Functions (Workers, en `functions/` → `src/`) + D1. Sin dependencias en producción.

## Reglas
- Antitrampas en servidor: intentos < 100 ms se descartan; hacen falta 3 válidos para puntuar. Una partida oficial por dispositivo y día (Europe/Madrid).
- Semana (lunes–domingo): 1.º 10 pts, 2.º 8, 3.º 6, 4.º 5, 5.º 4, 6.º 3, 7.º 2, resto 1 por jugar.
- Apodo 2–16 y nombre de liga 3–30 caracteres, con filtro de palabrotas (`src/profanity.js`). Máx. 100 miembros por liga y 10 ligas creadas por dispositivo y día.

## Rutas
`/` inicio · `/reflejos` juego · `/l/CODIGO` liga (con vista previa para WhatsApp) · `/privacidad` · `/admin` panel (token).
API: `/api/today`, `/api/play`, `/api/leagues`, `/api/leagues/:code`, `/api/leagues/:code/join`, `/api/me/leagues`, `/api/event`, `/api/admin/stats`, `/api/admin/csv?kind=daily|cohorts|leagues|plays|events`.

## Desplegar (capa gratuita, desde el panel de Cloudflare)
1. **D1**: Workers & Pages → D1 → *Create database* → nombre `tepicas`. En su pestaña *Console*, pega `schema.sql` y ejecútalo. Copia el *Database ID* en `wrangler.toml` (`database_id`) y haz commit.
2. **Pages**: Workers & Pages → *Create* → Pages → *Connect to Git* → repo `tepicas`. Framework: ninguno · Build command: vacío · Output directory: `public`.
3. **Secreto**: en el proyecto de Pages → Settings → Variables and secrets → añade `ADMIN_TOKEN` (tipo secreto, 32+ caracteres aleatorios). Vuelve a desplegar.
4. **Dominio**: proyecto de Pages → Custom domains → `tepicas.com` (el dominio debe estar en Cloudflare).
5. Comprueba: abre `/`, juega, crea una liga, y entra en `/admin` con el token.

Alternativa por terminal: `npx wrangler d1 execute tepicas --remote --file=schema.sql` y `npx wrangler pages deploy`.

## Probar en local
```
npm test            # API + D1 (SQLite de Node) + filtro + panel
npm run dev         # http://localhost:8788 · token del panel: local-admin-token-123456
npm run test:e2e    # flujo completo en navegador móvil (requiere npm i y npx playwright install chromium)
```
