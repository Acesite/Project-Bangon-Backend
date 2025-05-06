const db = require("../Config/db");

// Get all crops
exports.getAllCrops = (req, res) => {
  const sql = "SELECT * FROM tbl_crops ORDER BY id DESC";
  db.query(sql, (err, results) => {
    if (err) {
      console.error(" Error fetching crops:", err);
      return res.status(500).json({ message: "Server error" });
    }
    res.status(200).json(results);
  });
};

// Delete a crop by ID
exports.deleteCrop = (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM tbl_crops WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("Error deleting crop:", err);
      return res.status(500).json({ message: "Server error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Crop not found" });
    }
    res.status(200).json({ message: "✅ Crop deleted successfully" });
  });
};


// managecropController.js
exports.updateCrop = (req, res) => {
    const { id } = req.params;
    const {
      crop,
      variety,
      planted_date,
      estimated_harvest,
      estimated_volume,
      estimated_hectares,
      note
    } = req.body;
  
    const sql = `
      UPDATE tbl_crops 
      SET crop = ?, variety = ?, planted_date = ?, estimated_harvest = ?, estimated_volume = ?, estimated_hectares = ?, note = ?
      WHERE id = ?
    `;
  
    const values = [crop, variety, planted_date, estimated_harvest, estimated_volume, estimated_hectares, note, id];
  
    db.query(sql, values, (err, result) => {
      if (err) {
        console.error("Error updating crop:", err);
        return res.status(500).json({ message: "Server error" });
      }
      res.status(200).json({ message: "Crop updated successfully" });
    });
  };
  
