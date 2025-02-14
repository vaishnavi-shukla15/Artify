const express = require("express");
const multer = require("multer");
const Artwork = require("../models/Artwork");
const { authenticate } = require("../middleware/authMiddleware"); // Authentication Middleware
const path = require("path");

const router = express.Router();

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

// File filter for images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error("Only JPG, PNG, and JPEG files are allowed"), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB file size limit
});

// Upload Artwork (Requires Authentication)
router.post("/upload", authenticate, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Image file is required" });
    }

    const { title, price } = req.body;
    if (!title || !price) {
      return res.status(400).json({ error: "Title and price are required" });
    }

    // Check for duplicate titles
    const existingArtwork = await Artwork.findOne({ title });
    if (existingArtwork) {
      return res.status(400).json({ error: "Artwork with this title already exists" });
    }

    const newArtwork = new Artwork({
      title,
      price,
      artist: req.user.id, // Automatically assign logged-in user as artist
      imageUrl: `/uploads/${req.file.filename}`,
    });

    await newArtwork.save();
    res.status(201).json({ message: "Artwork uploaded successfully", artwork: newArtwork });
  } catch (error) {
    console.error("❌ Upload Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get All Artworks (Including Artist Info)
router.get("/", async (req, res) => {
  try {
    const artworks = await Artwork.find()
      .populate("artist", "username email") // Include artist's username and email
      .sort({ createdAt: -1 });

    res.json(artworks);
  } catch (error) {
    console.error("❌ Fetch Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get Single Artwork by ID
router.get("/:id", async (req, res) => {
  try {
    const artwork = await Artwork.findById(req.params.id).populate("artist", "username email");
    if (!artwork) {
      return res.status(404).json({ error: "Artwork not found" });
    }
    res.json(artwork);
  } catch (error) {
    console.error("❌ Fetch Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete Artwork (Only Admin or Owner can delete)
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const artwork = await Artwork.findById(req.params.id);
    if (!artwork) {
      return res.status(404).json({ error: "Artwork not found" });
    }

    // Only allow owner or admin to delete
    if (req.user.role !== "admin" && artwork.artist.toString() !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized to delete this artwork" });
    }

    await Artwork.findByIdAndDelete(req.params.id);
    res.json({ message: "Artwork deleted successfully" });
  } catch (error) {
    console.error("❌ Delete Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
