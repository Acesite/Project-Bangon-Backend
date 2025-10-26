// Controllers/Graph/graphController.js
const db = require("../../Config/db");

/* ------------- helpers ------------- */
function buildWhere({ city, barangay }) {
  const where = [];
  const params = [];
  if (city && city !== "all") {
    where.push("city = ?");
    params.push(city);
  }
  if (barangay && barangay !== "all") {
    where.push("barangay = ?");
    params.push(barangay);
  }
  return { where, params };
}

/* ------------- filters (for dropdowns) ------------- */
// GET /api/graphs/filters
// -> { cities: ["Bacolod", ...], barangaysByCity: { "Bacolod": ["Estefania", ...], "_all": [...] } }
exports.getFilters = (_req, res) => {
  const sql = `
    SELECT DISTINCT city, barangay
    FROM tbl_incident
    WHERE city IS NOT NULL AND city <> '' AND barangay IS NOT NULL AND barangay <> ''
  `;
  db.query(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const cities = Array.from(new Set(rows.map(r => r.city))).sort((a,b)=>a.localeCompare(b));
    const barangaysByCity = { _all: [] };
    const allBarangays = new Set();
    for (const r of rows) {
      allBarangays.add(r.barangay);
      if (!barangaysByCity[r.city]) barangaysByCity[r.city] = new Set();
      barangaysByCity[r.city].add(r.barangay);
    }
    barangaysByCity._all = Array.from(allBarangays).sort((a,b)=>a.localeCompare(b));
    for (const c of Object.keys(barangaysByCity)) {
      if (barangaysByCity[c] instanceof Set) {
        barangaysByCity[c] = Array.from(barangaysByCity[c]).sort((a,b)=>a.localeCompare(b));
      }
    }
    res.json({ cities, barangaysByCity });
  });
};

/* ------------- totals ------------- */
// GET /api/graphs/total-incidents?city=&barangay=
exports.getTotalIncidents = (req, res) => {
  const { where, params } = buildWhere(req.query);
  const sql = `
    SELECT COUNT(*) AS total
    FROM tbl_incident
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
  `;
  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ total: rows[0]?.total || 0 });
  });
};

/* ------------- group by type (count) ------------- */
// GET /api/graphs/incident-type-counts?city=&barangay=
exports.getIncidentTypeCounts = (req, res) => {
  const { where, params } = buildWhere(req.query);
  const sql = `
    SELECT incident_type AS type, COUNT(*) AS total
    FROM tbl_incident
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    GROUP BY incident_type
    ORDER BY total DESC
  `;
  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ type: r.type || "Unknown", total: Number(r.total) })));
  });
};

/* ------------- group by type (area) ------------- */
// GET /api/graphs/incident-area-by-type?city=&barangay=
exports.getIncidentAreaByType = (req, res) => {
  const { where, params } = buildWhere(req.query);
  const sql = `
    SELECT incident_type AS type, COALESCE(SUM(area_ha),0) AS total_area
    FROM tbl_incident
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    GROUP BY incident_type
    ORDER BY total_area DESC
  `;
  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ type: r.type || "Unknown", total: Number(r.total_area) })));
  });
};

/* ------------- trend by month ------------- */
// GET /api/graphs/incident-trend?city=&barangay=&months=12
exports.getIncidentTrend = (req, res) => {
  const months = Math.max(1, Math.min(36, Number(req.query.months) || 12));
  const { where, params } = buildWhere(req.query);

  const sql = `
    SELECT DATE_FORMAT(date_reported, '%Y-%m') AS ym, COUNT(*) AS total
    FROM tbl_incident
    ${where.length ? "WHERE " + where.join(" AND ") + " AND " : "WHERE "}
    date_reported >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
    GROUP BY ym
    ORDER BY ym ASC
  `;
  db.query(sql, [...params, months], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ month: r.ym, total: Number(r.total) })));
  });
};

/* ------------- summary chips ------------- */
// GET /api/graphs/summary?city=&barangay=
exports.getSummary = (req, res) => {
  const { where, params } = buildWhere(req.query);

  const q1 = `
    SELECT incident_type AS type, COUNT(*) AS cnt
    FROM tbl_incident
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    GROUP BY incident_type
    ORDER BY cnt DESC LIMIT 1
  `;
  const q2 = `
    SELECT barangay, COUNT(*) AS cnt
    FROM tbl_incident
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    GROUP BY barangay
    ORDER BY cnt DESC LIMIT 1
  `;
  const q3 = `
    SELECT incident_type AS type, COALESCE(SUM(area_ha),0) AS area
    FROM tbl_incident
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    GROUP BY incident_type
    ORDER BY area DESC LIMIT 1
  `;

  db.query(q1, params, (e1, r1) => {
    if (e1) return res.status(500).json({ error: e1.message });
    db.query(q2, params, (e2, r2) => {
      if (e2) return res.status(500).json({ error: e2.message });
      db.query(q3, params, (e3, r3) => {
        if (e3) return res.status(500).json({ error: e3.message });
        res.json({
          mostCommonType: r1[0]?.type || "—",
          topBarangay: r2[0]?.barangay || "—",
          largestAreaType: r3[0]?.type || "—",
          largestAreaHa: r3[0]?.area ? Number(r3[0].area) : 0,
        });
      });
    });
  });
};
