// Controllers/Calamity/calamityController.js
const db = require("../../Config/db");
const path = require("path");
const fs = require("fs");

/* ------------------------------ CONFIG ------------------------------ */
const UPLOAD_SUBDIR = "uploads/calamity"; // web path base -> served at /uploads/...
const UPLOAD_ABS_DIR = path.join(__dirname, "../../", UPLOAD_SUBDIR);

/* ------------------------------ HELPERS ----------------------------- */
function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_ABS_DIR)) fs.mkdirSync(UPLOAD_ABS_DIR, { recursive: true });
}

// Build both absolute filesystem path (for saving) and relative web URL (for DB/FE)
function buildSaveTargets(originalName) {
  const safeBase = String(originalName || "file")
    .replace(/\s+/g, "_")                // spaces -> underscores
    .replace(/[^a-zA-Z0-9._()\-]/g, ""); // keep letters, numbers, . _ ( ) -
  const fileName = `${Date.now()}_${safeBase}`;

  // absolute path on disk where we will write the file
  const absPath = path.join(UPLOAD_ABS_DIR, fileName);

  // URL path your frontend will use (served by express.static("/uploads", ...))
  const relUrl = `/${UPLOAD_SUBDIR}/${fileName}`;

  return { absPath, relUrl };
}

// Turn any stored value (string | csv | json | string[]) -> string[]
function parseJsonishArray(value) {
  if (!value) return [];
  const raw = String(value).trim();

  // JSON array?
  if (raw.startsWith("[")) {
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter(Boolean) : [];
    } catch {
      /* ignore */
    }
  }
  // Comma-separated?
  if (raw.includes(",")) return raw.split(",").map((s) => s.trim()).filter(Boolean);

  // Single string
  return [raw].filter(Boolean);
}

// Normalize to "/uploads/*" URL or pass through if absolute http(s)
function normalizeToUploadsOrHttp(list) {
  return (list || [])
    .filter(Boolean)
    .map((p) => {
      const v = String(p).trim();
      if (!v) return null;
      if (v.startsWith("/uploads/")) return v;
      if (/^https?:\/\//i.test(v)) return v;
      // if someone saved just a bare filename (legacy), map it to our subdir
      return `/${UPLOAD_SUBDIR}/${v}`;
    })
    .filter(Boolean);
}

/* ----------------------------- CONTROLLERS -------------------------- */

// GET /api/calamities
// Optional filters ?type=&status=&since=YYYY-MM-DD
exports.getAllCalamities = (req, res) => {
  const { type, status, since } = req.query;

  const where = [];
  const params = [];

  if (type) { where.push("incident_type = ?"); params.push(type); }
  if (status) { where.push("status = ?"); params.push(status); }
  if (since) { where.push("date_reported >= ?"); params.push(since); }

  const sql = `
    SELECT *
    FROM tbl_incident
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY date_reported DESC, incident_id DESC
  `;

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const out = rows.map((r) => {
      const photos = normalizeToUploadsOrHttp(parseJsonishArray(r.photos));
      const videos = normalizeToUploadsOrHttp(parseJsonishArray(r.videos));
      return {
        // legacy-compatible keys for your FE
        calamity_id: r.incident_id,
        admin_id: r.admin_id,
        calamity_type: r.incident_type,
        description: r.description,
        barangay: r.barangay,
        status: r.status,
        severity_level: r.severity_level,
        latitude: r.latitude,
        longitude: r.longitude,
        coordinates: r.coordinates ? JSON.parse(r.coordinates) : null,
        affected_area: r.area_ha,
        date_reported: r.date_reported,
        photo: photos[0] || null,
        photos,
        videos,
      };
    });

    res.json(out);
  });
};

// GET /api/calamities/polygons -> GeoJSON
exports.getCalamityPolygons = (req, res) => {
  const { type } = req.query;

  const where = ["coordinates IS NOT NULL"];
  const params = [];

  if (type) { where.push("incident_type = ?"); params.push(type); }

  const sql = `
    SELECT incident_id AS id, incident_type, barangay, severity_level, coordinates
    FROM tbl_incident
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
  `;

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const features = [];
    for (const c of rows) {
      try {
        let ring = JSON.parse(c.coordinates);
        if (!Array.isArray(ring) || ring.length < 3) continue;

        // close ring if needed
        const first = JSON.stringify(ring[0]);
        const last = JSON.stringify(ring[ring.length - 1]);
        if (first !== last) ring = [...ring, ring[0]];

        features.push({
          type: "Feature",
          properties: {
            id: c.id,
            calamity_type: c.incident_type,
            barangay: c.barangay || null,
            severity_level: c.severity_level || null,
          },
          geometry: { type: "Polygon", coordinates: [ring] },
        });
      } catch (e) {
        console.error(`Invalid coordinates for incident ${c.id}`, e);
      }
    }

    res.json({ type: "FeatureCollection", features });
  });
};

// GET /api/calamities/types
exports.getCalamityTypes = (_req, res) => {
  db.query("SELECT DISTINCT incident_type FROM tbl_incident", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map((r) => r.incident_type).filter(Boolean));
  });
};

// Legacy stubs to keep FE stable
exports.getAllEcosystems = (_req, res) => res.json([]);
exports.getAllCrops = (_req, res) => res.json([]);
exports.getVarietiesByCropType = (_req, res) => res.json([]);

// POST /api/calamities (multipart/form-data)
// Fields: calamity_type, description, barangay, status, severity_level,
//         coordinates (JSON polygon ring), affected_area (ha), admin_id,
//         [latitude, longitude]
// Files: photos[] (images/videos mixed ok) and/or videos[] (optional)
exports.addCalamity = async (req, res) => {
  try {
    const {
      calamity_type,            // -> incident_type
      description,
      barangay,
      status,
      severity_level,
      coordinates,              // JSON string (polygon ring)
      affected_area,            // -> area_ha
      admin_id,
      latitude,
      longitude,
    } = req.body;

    if (!calamity_type || !description || !coordinates) {
      return res.status(400).json({ error: "calamity_type, description, and coordinates are required" });
    }
    const adminId = Number(admin_id);
    if (!adminId) return res.status(400).json({ error: "admin_id is required" });

    // parse polygon
    let polygon = null;
    try {
      polygon = typeof coordinates === "string" ? JSON.parse(coordinates) : coordinates;
    } catch {
      return res.status(400).json({ error: "Invalid coordinates JSON" });
    }
    if (!Array.isArray(polygon) || polygon.length < 3) {
      return res.status(400).json({ error: "Coordinates must be an array with at least 3 points" });
    }

    const [lon0, lat0] = polygon[0] || [];
    const latVal = latitude != null ? Number(latitude) : (typeof lat0 === "number" ? lat0 : 0);
    const lonVal = longitude != null ? Number(longitude) : (typeof lon0 === "number" ? lon0 : 0);

    const safeBarangay = (barangay && String(barangay).trim()) || null;

    // status/severity validation
    const ALLOWED_STATUS = new Set(["Pending", "Verified", "Resolved", "Rejected"]);
    const safeStatus = ALLOWED_STATUS.has(String(status)) ? String(status) : "Pending";

    const ALLOWED_SEVERITY = new Set(["Low", "Moderate", "High", "Severe"]);
    const safeSeverity = ALLOWED_SEVERITY.has(String(severity_level)) ? String(severity_level) : null;

    // uploads
    ensureUploadDir();
    const imagePaths = [];
    const videoPaths = [];
    const filesToSave = [];

    const ALLOWED_MIME = new Set([
      "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
      "video/mp4", "video/quicktime"
    ]);
    const MAX_BYTES = 50 * 1024 * 1024; // 50MB

    // mixed "photos" (frontend uses this) + optional "videos"
    if (req.files?.photos) {
      if (Array.isArray(req.files.photos)) filesToSave.push(...req.files.photos);
      else filesToSave.push(req.files.photos);
    }
    if (req.files?.videos) {
      if (Array.isArray(req.files.videos)) filesToSave.push(...req.files.videos);
      else filesToSave.push(req.files.videos);
    }

    for (const f of filesToSave) {
      if (!ALLOWED_MIME.has(f.mimetype)) {
        return res.status(400).json({ error: `Unsupported file type: ${f.mimetype}` });
      }
      if (f.size > MAX_BYTES) {
        return res.status(400).json({ error: `File too large: ${(f.size / 1024 / 1024).toFixed(1)} MB (max 50MB)` });
      }

      const { absPath, relUrl } = buildSaveTargets(f.name);
      await f.mv(absPath);

      if (f.mimetype.startsWith("video/")) videoPaths.push(relUrl);
      else imagePaths.push(relUrl);
    }

    const photosJson = JSON.stringify(imagePaths);
    const videosJson = JSON.stringify(videoPaths);
    const areaHa = affected_area != null ? Number(affected_area) : null;

    const sql = `
      INSERT INTO tbl_incident
        (admin_id, incident_type, description, barangay, status, severity_level,
         latitude, longitude, coordinates, area_ha, photos, videos, date_reported)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    const params = [
      adminId,
      calamity_type,
      description,
      safeBarangay,
      safeStatus,
      safeSeverity,
      latVal,
      lonVal,
      JSON.stringify(polygon),
      areaHa,
      photosJson,
      videosJson,
    ];

    db.query(sql, params, (err, result) => {
      if (err) {
        console.error("Insert error:", err);
        return res.status(500).json({ error: "Failed to save incident: " + err.message });
      }

      // Respond with normalized shape for FE
      const photos = normalizeToUploadsOrHttp(imagePaths);
      const videos = normalizeToUploadsOrHttp(videoPaths);

      res.status(201).json({
        calamity_id: result.insertId,
        admin_id: adminId,
        calamity_type,
        description,
        barangay: safeBarangay,
        status: safeStatus,
        severity_level: safeSeverity,
        latitude: latVal,
        longitude: lonVal,
        coordinates: polygon,
        affected_area: areaHa,
        date_reported: new Date().toISOString(),
        photo: photos[0] || null,
        photos,
        videos,
      });
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
