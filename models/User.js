const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true, // Ensures case-insensitive email storage
      trim: true 
    },
    password: { type: String, required: true, minlength: 6 }, // Enforce password length
    role: { type: String, enum: ["user", "admin"], default: "user" },
    profilePic: { 
      type: String, 
      default: "https://example.com/default-profile.png" // Set default image URL
    },
  },
  { timestamps: true }
);

// Virtual field for full name (optional, if you store first & last name separately)
// UserSchema.virtual("fullName").get(function () {
//   return `${this.firstName} ${this.lastName}`;
// });

// Hash password before saving


// Compare passwords
UserSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);
