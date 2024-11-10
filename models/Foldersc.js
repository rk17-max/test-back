// models/Folder.js
const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
    name: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to the user who owns the folder
    files: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }] // Array of references to files within the folder
}, {
    timestamps: true // Automatically manage createdAt and updatedAt timestamps
});

const Folder = mongoose.model('Folder', folderSchema);
module.exports = Folder;
