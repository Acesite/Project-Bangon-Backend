// Controllers/Calamity/managecalamityController.js
const db = require("../../Config/db");

const query = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const severityToNumber = (sevText) => {
  if (!sevText) return 0;
  const s = String(sevText).toLowerCase();
  if (s === "severe") return 6;
  if (s === "high") return 5;
  if (s === "moderate") return 3;
  if (s === "low") return 1;
  return 0;
};

const toCSV = (v) =>
  Array.isArray(v) ? v.filter(Boolean).join(",") : v || null;

/* Map DB row → UI shape. We keep both `incident_type` and `calamity_type`
   so the existing React works without changes. We also expose area_ha as affected_area. */
const mapRow = (r) => ({
  id: r.incident_id,
  incident_type: r.incident_type,
  calamity_type: r.incident_type,        // alias for UI
  description: r.description,
  note: r.description,                    // UI sometimes reads "note"
  barangay: r.barangay,
  status: r.status,
  severity_text: r.severity_level,
  severity: severityToNumber(r.severity_level),

  coordinates: r.coordinates,
  affected_area: r.area_ha,               // alias for UI
  area_ha: r.area_ha,

  admin_id: r.admin_id,
  latitude: r.latitude != null ? Number(r.latitude) : null,
  longitude: r.longitude != null ? Number(r.longitude) : null,

  date_reported: r.date_reported || null, // timestamp in your table
  reported_at: r.date_reported || null,

  photos: r.photos
    ? String(r.photos)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [],
});

/* --------- LIST --------- */
exports.listCalamities = async (_req, res) => {
  try {
    const rows = await query(
      `SELECT incident_id, admin_id, incident_type, severity_level, status,
              description, barangay, latitude, longitude, coordinates,
              area_ha, photos, date_reported
       FROM tbl_incident
       ORDER BY date_reported DESC, incident_id DESC`
    );
    res.json(rows.map(mapRow));
  } catch (err) {
    console.error("listCalamities error:", err);
    res.status(500).json({ message: "Failed to fetch incidents." });
  }
};

/* --------- GET ONE --------- */
exports.getCalamityById = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query(
      `SELECT incident_id, admin_id, incident_type, severity_level, status,
              description, barangay, latitude, longitude, coordinates,
              area_ha, photos, date_reported
       FROM tbl_incident
       WHERE incident_id = ?
       LIMIT 1`,
      [id]
    );
    res.json(rows[0] ? mapRow(rows[0]) : null);
  } catch (err) {
    console.error("getCalamityById error:", err);
    res.status(500).json({ message: "DB error" });
  }
};

/* --------- DISTINCT TYPES (for chips) --------- */
exports.listDistinctTypes = async (_req, res) => {
  try {
    const rows = await query(
      `SELECT DISTINCT incident_type AS name
       FROM tbl_incident
       WHERE incident_type IS NOT NULL AND incident_type <> ''
       ORDER BY incident_type ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error("listDistinctTypes error:", err);
    res.status(500).json({ message: "Failed to fetch types." });
  }
};

/* --------- CREATE --------- */
exports.createCalamity = async (req, res) => {
  try {
    const b = req.body || {};
    const payload = {
      admin_id: b.admin_id ?? null,
      incident_type: b.incident_type ?? b.calamity_type ?? null, // accept either name
      description: b.description ?? b.note ?? null,
      barangay: b.barangay ?? null,
      status: b.status ?? "Pending",
      severity_level:
        b.severity_text ??
        (Number(b.severity) >= 6
          ? "Severe"
          : Number(b.severity) >= 5
          ? "High"
          : Number(b.severity) >= 3
          ? "Moderate"
          : Number(b.severity) >= 1
          ? "Low"
          : null),
      coordinates: b.coordinates ?? null,
      area_ha: b.affected_area ?? b.area_ha ?? null, // map UI → DB
      latitude: b.latitude ?? null,
      longitude: b.longitude ?? null,
      date_reported: b.reported_at ?? new Date(),
      photos: toCSV(b.photos),
    };

    const result = await query(`INSERT INTO tbl_incident SET ?`, payload);
    const rows = await query(
      `SELECT incident_id, admin_id, incident_type, severity_level, status,
              description, barangay, latitude, longitude, coordinates,
              area_ha, photos, date_reported
       FROM tbl_incident
       WHERE incident_id = ?`,
      [result.insertId]
    );
    res.status(201).json(rows[0] ? mapRow(rows[0]) : { ok: true });
  } catch (err) {
    console.error("createCalamity error:", err);
    res.status(500).json({ message: "Failed to create record." });
  }
};

/* --------- UPDATE --------- */
exports.updateCalamity = async (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body || {};
    const fields = {};

    if (b.incident_type !== undefined || b.calamity_type !== undefined)
      fields.incident_type = b.incident_type ?? b.calamity_type;
    if (b.description !== undefined || b.note !== undefined)
      fields.description = b.description ?? b.note;
    if (b.barangay !== undefined) fields.barangay = b.barangay;
    if (b.status !== undefined) fields.status = b.status;

    if (b.severity_text !== undefined) fields.severity_level = b.severity_text;
    if (b.severity !== undefined && b.severity_text === undefined) {
      const n = Number(b.severity);
      fields.severity_level =
        n >= 6 ? "Severe" : n >= 5 ? "High" : n >= 3 ? "Moderate" : n >= 1 ? "Low" : null;
    }

    if (b.coordinates !== undefined) fields.coordinates = b.coordinates;
    if (b.affected_area !== undefined || b.area_ha !== undefined)
      fields.area_ha = b.affected_area ?? b.area_ha;
    if (b.latitude !== undefined) fields.latitude = b.latitude;
    if (b.longitude !== undefined) fields.longitude = b.longitude;
    if (b.reported_at !== undefined) fields.date_reported = b.reported_at;
    if (b.photos !== undefined) fields.photos = toCSV(b.photos);

    if (!Object.keys(fields).length)
      return res.status(400).json({ message: "No fields to update." });

    await query(`UPDATE tbl_incident SET ? WHERE incident_id = ?`, [fields, id]);

    const rows = await query(
      `SELECT incident_id, admin_id, incident_type, severity_level, status,
              description, barangay, latitude, longitude, coordinates,
              area_ha, photos, date_reported
       FROM tbl_incident
       WHERE incident_id = ?
       LIMIT 1`,
      [id]
    );

    if (!rows.length) return res.status(404).json({ message: "Not found" });
    res.json(mapRow(rows[0]));
  } catch (err) {
    console.error("updateCalamity error:", err);
    res.status(500).json({ message: "Failed to update record." });
  }
};

/* --------- DELETE --------- */
exports.deleteCalamity = async (req, res) => {
  try {
    const { id } = req.params;
    await query(`DELETE FROM tbl_incident WHERE incident_id = ?`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteCalamity error:", err);
    res.status(500).json({ message: "Failed to delete record." });
  }
};
