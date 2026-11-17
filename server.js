require('dotenv').config();

const crypto = require('node:crypto');
const http = require('node:http');
const path = require('node:path');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const cors = require('cors');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { Server } = require('socket.io');

const SYNC_KEYS = new Set([
  'clients',
  'orders',
  'inventory',
  'inventoryCategories',
  'objects',
  'quotes',
  'quoteServices',
  'quoteKits',
  'quoteBranding'
]);
const MAX_VALUE_BYTES = 2 * 1024 * 1024;
const MAX_BOOTSTRAP_BYTES = 10 * 1024 * 1024;

function validateConfig(config) {
  const missing = ['DATABASE_URL', 'APP_PASSWORD', 'JWT_SECRET']
    .filter(key => !config[key]);
  if (missing.length) {
    throw new Error(`Faltan variables de entorno requeridas: ${missing.join(', ')}`);
  }
  if (config.APP_PASSWORD.length < 12) {
    throw new Error('APP_PASSWORD debe tener al menos 12 caracteres.');
  }
  if (Buffer.byteLength(config.JWT_SECRET) < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 bytes aleatorios.');
  }
}

function signInToken(password, appPassword, jwtSecret) {
  const supplied = crypto.createHmac('sha256', jwtSecret).update(password).digest();
  const expected = crypto.createHmac('sha256', jwtSecret).update(appPassword).digest();
  if (!crypto.timingSafeEqual(supplied, expected)) return null;
  return jwt.sign({ sub: 'leyra-app' }, jwtSecret, { expiresIn: '12h' });
}

function requireAuthentication(jwtSecret) {
  return (req, res, next) => {
    const match = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '');
    if (!match) return res.status(401).json({ error: 'Se requiere iniciar sesión.' });
    try {
      req.auth = jwt.verify(match[1], jwtSecret);
      next();
    } catch (error) {
      if (error.name !== 'TokenExpiredError' && error.name !== 'JsonWebTokenError') return next(error);
      res.status(401).json({ error: 'La sesión expiró. Iniciá sesión nuevamente.' });
    }
  };
}

function attachRealtime(server, { jwtSecret, corsOptions }) {
  const io = new Server(server, { cors: corsOptions });
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    try {
      socket.data.auth = jwt.verify(token, jwtSecret);
      next();
    } catch {
      next(new Error('Sesión no válida.'));
    }
  });
  io.on('connection', socket => {
    socket.join('authenticated');
    const expiry = socket.data.auth.exp * 1000 - Date.now();
    const expiryTimer = setTimeout(() => socket.disconnect(true), Math.max(expiry, 0));
    socket.on('disconnect', () => clearTimeout(expiryTimer));
  });
  return io;
}

function validateDataEntries(data, maxBytes) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return 'El cuerpo debe contener un objeto de datos.';
  }
  for (const [key, value] of Object.entries(data)) {
    if (!SYNC_KEYS.has(key)) return `La clave "${key}" no se puede sincronizar.`;
    let serialized;
    try {
      serialized = JSON.stringify(value);
    } catch {
      return `El valor de "${key}" no es JSON válido.`;
    }
    if (serialized === undefined || Buffer.byteLength(serialized) > maxBytes) {
      return `El valor de "${key}" supera el tamaño permitido.`;
    }
  }
  return null;
}

function createApp({
  db,
  appPassword,
  jwtSecret,
  allowedOrigins = [],
  getIo = () => null,
  updateRepository = process.env.UPDATE_GITHUB_REPOSITORY,
  updateToken = process.env.UPDATE_GITHUB_TOKEN,
  fetchImplementation = fetch
}) {
  const app = express();
  const corsOptions = {
    origin(origin, callback) {
      if (!origin || origin === 'null' || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Este origen no está autorizado.'));
    },
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  };

  app.disable('x-powered-by');
  if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '10mb' }));

  let latestReleaseCache = null;
  let latestReleaseCacheExpiresAt = 0;
  async function getLatestUpdateRelease() {
    if (!/^[\w.-]+\/[\w.-]+$/.test(updateRepository || '') || !updateToken) {
      return null;
    }
    if (latestReleaseCache && Date.now() < latestReleaseCacheExpiresAt) return latestReleaseCache;

    const response = await fetchImplementation(
      `https://api.github.com/repos/${updateRepository}/releases/latest`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${updateToken}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );
    if (!response.ok) throw new Error(`GitHub Releases respondió ${response.status}.`);
    const release = await response.json();
    if (!Array.isArray(release.assets)) throw new Error('GitHub devolvió una publicación sin archivos válidos.');
    latestReleaseCache = release;
    latestReleaseCacheExpiresAt = Date.now() + 60_000;
    return release;
  }

  async function proxyUpdateAsset(asset, req, res) {
    const headers = {
      Accept: 'application/octet-stream',
      Authorization: `Bearer ${updateToken}`,
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (req.get('range')) headers.Range = req.get('range');
    const upstream = await fetchImplementation(asset.url, { headers });
    if (upstream.status !== 200 && upstream.status !== 206) {
      throw new Error(`GitHub no pudo descargar ${asset.name} (HTTP ${upstream.status}).`);
    }

    res.status(upstream.status);
    for (const header of ['content-length', 'content-range', 'accept-ranges']) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!upstream.body) {
      res.end();
      return;
    }
    await pipeline(Readable.fromWeb(upstream.body), res);
  }

  const updateDownloadLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Se alcanzó el límite temporal de descargas de actualizaciones.' }
  });
  app.get('/updates/latest.yml', async (req, res, next) => {
    try {
      const release = await getLatestUpdateRelease();
      if (!release) {
        res.status(503).json({ error: 'El canal de actualizaciones todavía no está configurado.' });
        return;
      }
      const metadata = release.assets.find(asset => asset.name === 'latest.yml');
      if (!metadata) {
        res.status(404).json({ error: 'La última publicación no contiene metadatos de actualización.' });
        return;
      }
      await proxyUpdateAsset(metadata, req, res);
    } catch (error) {
      next(error);
    }
  });
  app.get('/updates/:fileName', updateDownloadLimit, async (req, res, next) => {
    try {
      const { fileName } = req.params;
      if (!/^[\w .()-]+\.(?:exe|blockmap)$/i.test(fileName) || fileName.includes('..')) {
        res.status(404).json({ error: 'No se encontró el archivo de actualización.' });
        return;
      }
      const release = await getLatestUpdateRelease();
      if (!release) {
        res.status(503).json({ error: 'El canal de actualizaciones todavía no está configurado.' });
        return;
      }
      const asset = release.assets.find(item => item.name === fileName);
      if (!asset) {
        res.status(404).json({ error: 'No se encontró el archivo de actualización.' });
        return;
      }
      await proxyUpdateAsset(asset, req, res);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/health', async (req, res, next) => {
    try {
      await db.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/login', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Esperá unos minutos e intentá nuevamente.' }
  }), (req, res) => {
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const token = signInToken(password, appPassword, jwtSecret);
    if (!token) {
      res.status(401).json({ error: 'Contraseña incorrecta.' });
      return;
    }
    res.json({ token });
  });

  const authenticate = requireAuthentication(jwtSecret);
  app.get('/api/data', authenticate, async (req, res, next) => {
    try {
      const { rows } = await db.query('SELECT key, value FROM app_state');
      res.json({ data: Object.fromEntries(rows.map(row => [row.key, row.value])) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/data/bootstrap', authenticate, async (req, res, next) => {
    const validationError = validateDataEntries(req.body?.data, MAX_BOOTSTRAP_BYTES);
    if (validationError) return res.status(400).json({ error: validationError });

    let client;
    try {
      client = await db.connect();
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [72615001]);
      const { rows } = await client.query('SELECT COUNT(*)::int AS count FROM app_state');
      if (rows[0].count > 0) {
        await client.query('COMMIT');
        res.status(409).json({ error: 'La base ya contiene datos.', initialized: false });
        return;
      }
      if (Object.keys(req.body.data).length === 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'No se recibieron datos para inicializar la base.' });
        return;
      }

      for (const [key, value] of Object.entries(req.body.data)) {
        await client.query(
          'INSERT INTO app_state (key, value) VALUES ($1, $2::jsonb)',
          [key, JSON.stringify(value)]
        );
      }
      await client.query('COMMIT');
      res.status(201).json({ initialized: true, data: req.body.data });
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(rollbackError => console.error('Falló rollback de bootstrap:', rollbackError));
      next(error);
    } finally {
      client?.release();
    }
  });

  app.put('/api/data/:key', authenticate, async (req, res, next) => {
    const { key } = req.params;
    const validationError = validateDataEntries({ [key]: req.body?.value }, MAX_VALUE_BYTES);
    if (validationError) return res.status(400).json({ error: validationError });

    try {
      await db.query(
        'INSERT INTO app_state (key, value, updated_at) VALUES ($1, $2::jsonb, NOW()) ' +
        'ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()',
        [key, JSON.stringify(req.body.value)]
      );
      getIo()?.to('authenticated').emit('cloud:data:update', { key, value: req.body.value });
      res.json({ saved: true });
    } catch (error) {
      next(error);
    }
  });

  const pages = ['dashboard.html', 'clientes.html', 'ordenes.html', 'presupuestos.html', 'equipos.html', 'inventario.html'];
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
  for (const page of pages) {
    app.get(`/${page}`, (req, res) => res.sendFile(path.join(__dirname, page)));
  }
  const noCache = response => response.setHeader('Cache-Control', 'no-store');
  app.use('/js', express.static(path.join(__dirname, 'js'), { setHeaders: noCache }));
  app.use('/css', express.static(path.join(__dirname, 'css'), { setHeaders: noCache }));

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error('Error de API:', error);
    const status = error.status === 413 ? 413 : 500;
    res.status(status).json({ error: status === 413 ? 'La solicitud supera el tamaño permitido.' : 'Error interno del servidor.' });
  });

  return { app, corsOptions, authenticate };
}

async function startServer() {
  const config = {
    DATABASE_URL: process.env.DATABASE_URL,
    APP_PASSWORD: process.env.APP_PASSWORD,
    JWT_SECRET: process.env.JWT_SECRET
  };
  validateConfig(config);

  const db = new Pool({
    connectionString: config.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
  });
  await db.query(
    'CREATE TABLE IF NOT EXISTS app_state (' +
    'key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())'
  );

  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  let io;
  const { app, corsOptions, authenticate } = createApp({
    db,
    appPassword: config.APP_PASSWORD,
    jwtSecret: config.JWT_SECRET,
    allowedOrigins,
    getIo: () => io
  });
  const server = http.createServer(app);
  io = attachRealtime(server, { jwtSecret: config.JWT_SECRET, corsOptions });

  server.listen(Number(process.env.PORT) || 3000, '0.0.0.0', () => {
    console.log(`API de Leyra Seguridad escuchando en el puerto ${server.address().port}`);
  });

  const shutdown = () => {
    io.close();
    server.close(() => db.end().finally(() => process.exit(0)));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (require.main === module) {
  startServer().catch(error => {
    console.error('No se pudo iniciar el backend de Leyra Seguridad:', error);
    process.exitCode = 1;
  });
}

module.exports = { attachRealtime, createApp, signInToken, validateConfig, validateDataEntries };
