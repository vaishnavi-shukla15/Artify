require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer"); // ✅ For File Uploads
const path = require("path");
const User = require("./models/User");
const Artwork = require("./models/Artwork");

const app = express();

// ✅ CORS Configuration
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

// ✅ Serve Uploaded Images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Ensure Required Environment Variables
const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI;

if (!JWT_SECRET || !MONGO_URI) {
  console.error("❌ Missing environment variables! Check .env file.");
  process.exit(1);
}

// ✅ Connect to MongoDB Atlas
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Atlas Connected Successfully!"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  });

// ✅ Multer Storage Configuration (For Image Uploads)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
  },
});
const upload = multer({ storage });

// ✅ Signup API Endpoint
app.post("/api/auth/signup", async (req, res) => {
    try {
        const { username, mobile, email, password } = req.body;
        console.log("Received Signup Request:", { username, mobile, email, password });

        if (!username || !mobile || !email || !password) {
            return res.status(400).json({ error: "All fields are required." });
        }

        const existingUser = await User.findOne({ email });
        console.log("Existing User Check:", existingUser);

        if (existingUser) {
            return res.status(400).json({ error: "Email already in use." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        console.log("Hashed Password:", hashedPassword);

        const newUser = new User({ username, mobile, email, password: hashedPassword });
        await newUser.save();

        console.log("User Saved Successfully:", newUser);
        res.status(201).json({ message: "User registered successfully", newUser });
    } catch (error) {
        console.error("❌ Signup Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ✅ Login API Endpoint
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials - user not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials - incorrect password" });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "1h" });

    res.json({ message: "Login successful", token, user });
  } catch (error) {
    console.error("❌ Login Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Artwork Upload API with Image Upload
app.post("/api/artworks", upload.single("image"), async (req, res) => {
  try {
    const { title, artist, price } = req.body;

    if (!title || !req.file || !artist || !price) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    const newArtwork = new Artwork({ title, imageUrl, artist, price });
    await newArtwork.save();

    res.status(201).json({ message: "Artwork uploaded successfully", newArtwork });
  } catch (error) {
    console.error("❌ Artwork Upload Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Fetch Artworks API
app.get("/api/artworks", async (req, res) => {
  try {
    const artworks = await Artwork.find({});
    res.json(artworks);
  } catch (error) {
    console.error("❌ Error fetching artworks:", error);
    res.status(500).json({ error: "Error fetching artworks" });
  }
});

// ✅ Start the Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
