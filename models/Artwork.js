const mongoose = require("mongoose");

const ArtworkSchema = new mongoose.Schema(
  {
    title: { 
      type: String, 
      required: true, 
      trim: true, 
      unique: true // Prevent duplicate artwork titles
    },
    description: { 
      type: String, 
      trim: true, 
      default: "No description available." // Default text if no description is given
    },
    imageUrl: { 
      type: String, 
      required: true, 
      trim: true
    },
    artist: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    price: { 
      type: Number, 
      required: true, 
      min: 1 // Ensures price is always positive
    },
    status: { 
      type: String, 
      enum: ["available", "sold"], 
      default: "available" 
    }
  },
  { timestamps: true } // Automatically adds createdAt & updatedAt fields
);

module.exports = mongoose.model("Artwork", ArtworkSchema);
