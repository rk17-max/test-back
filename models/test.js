const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Consider hashing the password
    uploadedFiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],   // Array of references to uploaded files
    downloadedFiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],  // Array of references to downloaded files
}, {
    timestamps: true // Automatically manage createdAt and updatedAt timestamps
});

const User = mongoose.model('User', userSchema);
module.exports = User;
