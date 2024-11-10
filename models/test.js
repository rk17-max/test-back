// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    isPremium: { type: Boolean, default: false },
    password: { type: String, required: true }, // Consider hashing the password
    uploadedFiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],   // Array of references to uploaded files
    downloadedFiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],  // Array of references to downloaded files
    folders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Folder' }] // Array of references to folders
}, {
    timestamps: true // Automatically manage createdAt and updatedAt timestamps
});

const User = mongoose.model('User', userSchema);
module.exports = User;
