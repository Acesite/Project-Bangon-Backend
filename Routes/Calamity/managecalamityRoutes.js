const express = require("express");
const router = express.Router();

const ctrl = require("../../Controllers/Calamity/managecalamityController");

router.get("/types", ctrl.listDistinctTypes);

// list
router.get("/", ctrl.listCalamities);

// CRUD
router.get("/:id", ctrl.getCalamityById);
router.post("/", ctrl.createCalamity);
router.put("/:id", ctrl.updateCalamity);
router.delete("/:id", ctrl.deleteCalamity);

module.exports = router;
