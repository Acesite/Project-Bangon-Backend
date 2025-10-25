// server.js
const path = require("path");
const express = require("express");
const cors = require("cors");
const fileUpload = require("express-fileupload");
require("dotenv").config();

// Routes
const userRoutes = require("./Routes/Signup/signupRoutes");
const loginRoutes = require("./Routes/Login/loginRoutes");
const manageAccountRoutes = require("./Routes/Account/manageaccountRoutes");
const cropsRoutes = require("./Routes/Crops/cropsRoutes");
const manageCropRoutes = require("./Routes/Crops/managecropRoutes");
const manageProfileRoutes = require("./Routes/Account/manageprofileRoutes");
const graphRoutes = require("./Routes/Graph/graphRoutes");
const farmersProfileRoutes = require("./Routes/Farmers/FarmersProfileRoutes");
const farmerLoginRoutes = require("./Routes/Login/loginFarmerRoutes");
const calamityRoutes = require("./Routes/Calamity/calamityRoutes");
const manageCalamityRoutes = require("./Routes/Calamity/managecalamityRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

/* ----------------------------- MIDDLEWARES -------------------------- */
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Increase upload limits for photos/videos
app.use(
  fileUpload({
    createParentPath: true,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
    abortOnLimit: true,
  })
);

// Static serving for uploads
const UPLOADS_DIR = path.join(__dirname, "uploads"); // absolute
app.use(
  "/uploads",
  express.static(UPLOADS_DIR, {
    acceptRanges: true, // video seeking
    fallthrough: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".mp4")) res.setHeader("Content-Type", "video/mp4");
      if (filePath.endsWith(".mov")) res.setHeader("Content-Type", "video/quicktime");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

/* ------------------------------- ROUTES ----------------------------- */
app.use("/", userRoutes);
app.use("/users", loginRoutes);
app.use("/manageaccount", manageAccountRoutes);
app.use("/api/crops", cropsRoutes);
app.use("/api/managecrops", manageCropRoutes);
app.use("/api", manageProfileRoutes);
app.use("/api/graphs", graphRoutes);
app.use("/api/farmers", farmersProfileRoutes);
app.use("/api/farmers", farmerLoginRoutes);
app.use("/api/calamities", calamityRoutes);
app.use("/api/managecalamities", manageCalamityRoutes);

/* --------------------------- ERROR HANDLER -------------------------- */
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
