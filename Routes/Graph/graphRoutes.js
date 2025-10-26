// Routes/Graph/graphRoutes.js
const express = require("express");
const router = express.Router();
const {
  getFilters,
  getTotalIncidents,
  getIncidentTypeCounts,
  getIncidentAreaByType,
  getIncidentTrend,
  getSummary,
} = require("../../Controllers/Graph/graphController");

// filters for dropdowns
router.get("/filters", getFilters);

// totals & grouped series
router.get("/total-incidents", getTotalIncidents);
router.get("/incident-type-counts", getIncidentTypeCounts);     // counts by incident_type
router.get("/incident-area-by-type", getIncidentAreaByType);    // sum(area_ha) by incident_type
router.get("/incident-trend", getIncidentTrend);                // monthly trend
router.get("/summary", getSummary);                             // chips

module.exports = router;
