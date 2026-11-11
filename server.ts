import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

async function bootstrap() {
  const app = express();

  // Allow larger payload for captured photos (base64)
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Central Database Directory & File
  const DATA_DIR = path.join(__dirname, 'data');
  const DB_FILE = path.join(DATA_DIR, 'database.json');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  function readServerDb() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error reading server database file:', err);
    }
    return null;
  }

  function writeServerDb(data: any) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('Error writing server database file:', err);
      return false;
    }
  }

  // --- REST API FOR MULTI-DEVICE SYNCHRONIZATION ---

  // Health & Device Sync Status
  app.get('/api/sync/status', (req, res) => {
    const db = readServerDb();
    res.json({
      success: true,
      serverTime: new Date().toISOString(),
      hasData: !!db,
      residentCount: db?.residents?.length || 0,
      logCount: db?.logs?.length || 0,
      lastUpdated: db?.lastUpdated || null,
    });
  });

  // Pull latest data (for all devices: phones, laptops, desktops)
  app.get('/api/sync/pull', (req, res) => {
    const db = readServerDb();
    if (!db) {
      // Database not yet seeded on server
      return res.json({
        success: true,
        seeded: false,
        residents: [],
        logs: [],
        lastUpdated: null,
      });
    }

    res.json({
      success: true,
      seeded: true,
      residents: db.residents || [],
      logs: db.logs || [],
      lastUpdated: db.lastUpdated || new Date().toISOString(),
      sheetConfig: db.sheetConfig || null,
    });
  });

  // Push updated data to central server
  app.post('/api/sync/push', (req, res) => {
    const { residents, logs, sheetConfig, deviceId } = req.body;

    if (!Array.isArray(residents)) {
      return res.status(400).json({ success: false, error: 'Danh sách cư dân không hợp lệ' });
    }

    const currentDb = readServerDb() || { residents: [], logs: [] };
    const now = new Date().toISOString();

    const updatedDb = {
      residents: residents || currentDb.residents || [],
      logs: logs !== undefined ? logs : (currentDb.logs || []),
      sheetConfig: sheetConfig || currentDb.sheetConfig || null,
      lastUpdated: now,
      lastUpdatedByDevice: deviceId || 'unknown_device',
    };

    const ok = writeServerDb(updatedDb);
    if (!ok) {
      return res.status(500).json({ success: false, error: 'Lỗi ghi dữ liệu trên máy chủ' });
    }

    res.json({
      success: true,
      message: `Đã đồng bộ thành công ${updatedDb.residents.length} cư dân lên máy chủ trung tâm!`,
      lastUpdated: now,
      residentCount: updatedDb.residents.length,
    });
  });

  // Single resident upsert (for fast real-time push)
  app.post('/api/residents/upsert', (req, res) => {
    const resident = req.body;
    if (!resident || !resident.cccd || !resident.fullName) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin bắt buộc' });
    }

    const db = readServerDb() || { residents: [], logs: [] };
    const list = db.residents || [];
    const idx = list.findIndex((r: any) => r.id === resident.id || r.cccd === resident.cccd);

    if (idx !== -1) {
      list[idx] = { ...list[idx], ...resident, updatedAt: new Date().toISOString() };
    } else {
      list.unshift({ ...resident, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }

    db.residents = list;
    db.lastUpdated = new Date().toISOString();
    writeServerDb(db);

    res.json({ success: true, resident, lastUpdated: db.lastUpdated });
  });

  // Vite middleware in development mode
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[KP16 SERVER] Running at http://0.0.0.0:${PORT} (Multi-device Sync Ready)`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
