# Empleado Digital - Backend

API REST y tiempo real de la plataforma SaaS multi-tenant **Empleado Digital para Microempresas**, desarrollada en **NestJS (ESM)** y **Prisma ORM** sobre PostgreSQL en Supabase (unicamente base de datos, sin Supabase Auth).

## Arquitectura modular por capas

```text
prisma/
  migrations/       # Migraciones SQL versionadas por Prisma
  schema.prisma     # 24 modelos relacionales multi-tenant
  seed.ts           # Seed idempotente (3 planes, SuperAdmin y 3 giros demo)
src/
  core/
    config/         # Validacion Zod (.env) y AppConfigService tipado
    decorators/     # Decoradores transversales (@Public, @CurrentUser)
    filters/        # GlobalHttpExceptionFilter uniforme
    guards/         # JwtAuthGuard global y guards de seguridad
    interceptors/   # Interceptores de contexto y auditoria
    prisma/         # PrismaModule y PrismaService globales
    security/       # Cifrado AES-256-GCM y contexto multi-tenant (BE-05)
    core.module.ts
  modules/
    auth/           # Autenticacion local (Argon2id, JWT, Refresh rotativo, Lockout)
      controllers/  # Capa HTTP (/api/auth/*)
      dto/          # DTOs validados con class-validator / @ApiProperty
      entities/     # Payloads JWT y AuthenticatedUser
      repositories/ # Persistencia atomica en Prisma ORM
      services/     # AuthService, PasswordService, TokenService
      auth.module.ts
    health/         # Modulo de estado operativo por capas
      controllers/  # Capa de presentacion HTTP y contratos Swagger
      dto/          # DTOs validados con class-validator / @ApiProperty
      entities/     # Entidades y tipos de dominio
      repositories/ # Capa de acceso a datos (Prisma ORM)
      services/     # Logica de negocio
      health.module.ts
  app.module.ts
  app.setup.ts      # Prefijo /api, Helmet, CORS, ValidationPipe y Swagger
  main.ts           # Bootstrap HTTP en puerto configurado
```

## Configuracion local

1. Copiar `.env.example` a `.env` y completar las credenciales reales:
   - Base de datos PostgreSQL en Supabase (`DATABASE_URL` puerto `6543` y `DIRECT_URL` puerto `5432`) para Prisma ORM.
   - Secretos JWT locales y clave maestra `ENCRYPTION_KEY` (64 caracteres hexadecimales).
   - Credenciales reales de Google Gemini, Meta WhatsApp Cloud API, Google Cloud (Calendar + Maps), PayPal Sandbox y `PUBLIC_TUNNEL_URL` (`cloudflared`).
2. Instalar dependencias, aplicar migraciones y poblar datos iniciales:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

3. Levantar en modo desarrollo:

```bash
npm run start:dev
```

## Cuentas semilla locales (Seed)

- `SUPER_ADMIN`: `admin@empleadodigital.local` / `Admin123456!`
- `OWNER` Barberia (Plan Pro): `barberia@empleadodigital.local` / `Demo123456!`
- `OWNER` Consultorio (Plan Basico): `consultorio@empleadodigital.local` / `Demo123456!`
- `OWNER` Restaurante (Plan Gratis): `restaurante@empleadodigital.local` / `Demo123456!`

## Endpoints base

- `GET /api/health` - Estado operativo de la API y conectividad Prisma/PostgreSQL.
- `GET /api/docs` - Documentacion interactiva Swagger / OpenAPI (`GET /api/docs-json` para esquema JSON).
- `POST /api/auth/register` - Registro local de negocio y usuario `OWNER` (Argon2id + Plan Gratis).
- `POST /api/auth/login` - Inicio de sesion local (con lockout tras 5 fallos por 15 min).
- `POST /api/auth/refresh` - Rotacion de Refresh Token con deteccion de reuso por familia.
- `POST /api/auth/logout` - Revocacion de sesion actual o todas las sesiones.
- `GET /api/auth/me` - Perfil autenticado del usuario y resumen del tenant.

## Comandos utiles

```bash
npm run lint             # Linter oxlint con type-checking
npm run build            # Compilacion TypeScript en dist/
npm run test             # Pruebas unitarias (Vitest)
npm run test:e2e         # Pruebas end-to-end (Vitest + Supertest)
npm run prisma:generate  # Regenerar Prisma Client
npm run prisma:migrate   # Ejecutar prisma migrate dev
npm run prisma:seed      # Ejecutar prisma db seed (idempotente)
npm run prisma:studio    # Abrir Prisma Studio
```
