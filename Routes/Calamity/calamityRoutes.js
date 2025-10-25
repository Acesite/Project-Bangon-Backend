// routes/calamity.routes.js
const express = require("express");
const router = express.Router();

// Keep the name "calamityController" even though it now works with tbl_incident
const calamityController = require("../../Controllers/Calamity/calamityController");

/**
 * GET /api/calamities
 * Optional query params:
 *   ?type=Flood|Typhoon|...     (maps to incident_type)
 *   ?status=Pending|Verified|...
 *   ?since=YYYY-MM-DD
 */
router.get("/", calamityController.getAllCalamities);

/**
 * GET /api/calamities/polygons
 * Optional: ?type=Flood|Typhoon|...
 * Returns GeoJSON FeatureCollection of incident polygons.
 */
router.get("/polygons", calamityController.getCalamityPolygons);

/**
 * GET /api/calamities/types
 * Returns distinct incident types (as strings).
 */
router.get("/types", calamityController.getCalamityTypes);

/**
 * Legacy crop-related endpoints (now stubbed to [] in the controller)
 * Keeping them so the UI doesn’t error while you transition.
 */
router.get("/ecosystems", calamityController.getAllEcosystems);
router.get("/crops", calamityController.getAllCrops);
router.get("/crops/:cropTypeId/varieties", calamityController.getVarietiesByCropType);

/**
 * POST /api/calamities
 * multipart/form-data with files under field name "photos"
 * Body (legacy FE keys): calamity_type, description, coordinates, barangay, status, severity_level, affected_area, admin_id, [latitude, longitude]
 * Writes to tbl_incident and responds with legacy keys.
 */
router.post("/", calamityController.addCalamity);

module.exports = router;
