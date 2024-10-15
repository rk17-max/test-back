const mongoose = require('mongoose');




const ratingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    rating: {
        type: Number,
        required: true,
    },
    comment: {
        type: String,
        required: true,
    }
});

const fileSchema = new mongoose.Schema({
    originalName: { 
        type: String, 
        required: true 
    },
    url: { 
        type: String, 
        required: true 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    }, // Reference to User model
    category: { 
        type: String, 
        required: true 
    }, // New category field
    folder: { // New field for referencing the Folder
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Folder' 
    },
    ratings: [
        {
            user: { 
                type: mongoose.Schema.Types.ObjectId, 
                ref: 'User' 
            },
            rating: Number,
            comment: String,
        },
    ],
}, {
    timestamps: true, // Automatically manage createdAt and updatedAt timestamps
});
const File = mongoose.model('File', fileSchema); // Ensure the model is correctly defined

module.exports = File; // Export the model

