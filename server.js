require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer"); // ✅ For File Uploads
const path = require("path");
const http = require("http"); // ✅ For creating the HTTP server
const { Server } = require("socket.io"); // ✅ For WebSocket support
const User = require("./models/User");
const Artwork = require("./models/Artwork");
const Otp = require("./models/Otp");
const nodemailer = require("nodemailer"); // For sending OTP via email

const app = express();
const server = http.createServer(app); // ✅ Create the HTTP server
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// ✅ CORS Configuration
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Add this to parse form data

// ✅ Serve Uploaded Images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Ensure Required Environment Variables
const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;


if (!JWT_SECRET || !MONGO_URI || !EMAIL_USER || !EMAIL_PASS) {
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

// Nodemailer configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});


// Generate and Send OTP Endpoint
app.post("/api/send-otp", async (req, res) => {
  const { emailOrUsername } = req.body;

  try {
    // Verify user exists with given email or phone number
    const user = await User.findOne({ $or: [{ email: emailOrUsername }, { mobile: emailOrUsername }] });
    if (!user) {
      return res.status(400).send('User not found');
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP to database
    const newOtp = new Otp({ emailOrUsername, otp });
    await newOtp.save();

    // Send OTP via email
    const mailOptions = {
      from: EMAIL_USER,
      to: user.email, // Ensure OTP is sent to registered email
      subject: 'Your OTP Code',
      text: `Your OTP code is ${otp}`,
    };
    await transporter.sendMail(mailOptions);

    // Send OTP via SMS
    await client.messages.create({
      body: `Your OTP code is ${otp}`,
      from: TWILIO_PHONE_NUMBER,
      to: user.mobile, // Ensure OTP is sent to registered phone
    });

    res.status(200).send('OTP sent');
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).send('Error sending OTP');
  }
});

// Verify OTP and Reset Password Endpoint
app.post("/api/verify-otp", async (req, res) => {
  const { emailOrUsername, otp, newPassword } = req.body;

  try {
    // Find OTP in database
    const otpRecord = await Otp.findOne({ emailOrUsername, otp });

    if (!otpRecord) {
      return res.status(400).send('Invalid OTP');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await User.findOneAndUpdate({ email: emailOrUsername }, { password: hashedPassword });

    res.status(200).send('Password reset successful');
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).send('Error verifying OTP');
  }
});

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

   // JWT token creation with long expiration time
   const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });

    res.json({ message: "Login successful", token, user });
  } catch (error) {
    console.error("❌ Login Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Profile Picture Upload API with Image Upload
app.post("/api/upload-profile-pic", upload.single("profilePic"), async (req, res) => {
  try {
    const { userId } = req.body;
    const profilePic = `/uploads/${req.file.filename}`;

    // Update user's profile picture in the database
    await User.findByIdAndUpdate(userId, { profilePic });

    res.status(200).json({ profilePic });
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    res.status(500).json({ error: "Error uploading profile picture" });
  }
});

// Update Profile API
app.put("/api/update-profile", async (req, res) => {
  const { userId, name, username, bio } = req.body;

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, username, bio },
      { new: true }
    );

    res.json(updatedUser);
  } catch (error) {
    console.error("❌ Error updating profile:", error);
    res.status(500).json({ error: "Error updating profile" });
  }
});


// ✅ Artwork Upload API with Image Upload
app.post("/api/artworks", upload.single("image"), async (req, res) => {
  try {
    const { title, description, dimensions, material,artist, price } = req.body;

    console.log("Received artwork data:", req.body); // Log received data
    console.log("Received file data:", req.file); // Log received file data

    if (!title || !req.file || !artist || !price) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    const newArtwork = new Artwork({
      title,
      description: description || "No description available", // Default if missing
      dimensions: dimensions || "Not specified",              // Default if missing
      material: material || "Not specified",                  // Default if missing
      imageUrl,
      artist,
      price
    });

    console.log("Artwork to be saved:", newArtwork); // Log data before saving
    console.log("Description field before saving:", newArtwork.description);
    console.log("Dimensions field before saving:", newArtwork.dimensions);
    console.log("Material field before saving:", newArtwork.material);
    await newArtwork.save();

    // ✅ Emit event to notify about the new artwork
    io.emit("newArtwork", newArtwork);

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

// ✅ Fetch Artwork by ID API
app.get("/api/artworks/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const artwork = await Artwork.findById(id);

    if (!artwork) {
      return res.status(404).json({ error: "Artwork not found" });
    }

    res.json(artwork);
  } catch (error) {
    console.error("❌ Error fetching artwork:", error);
    res.status(500).json({ error: "Error fetching artwork" });
  }
});

// ✅ WebSocket Connection
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// ✅ Start the Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
