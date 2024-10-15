// models/Folder.js
const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
    name: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to User model
}, {
    timestamps: true // Automatically manage createdAt and updatedAt fields
});

const Folder = mongoose.model('Folder', folderSchema); // Ensure this is correct

module.exports = Folder; // Export the model
