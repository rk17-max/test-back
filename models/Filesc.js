const mongoose = require('mongoose');
const fileSchema = new mongoose.Schema({
    originalName: { 
        type: String, 
        required: true 
    },
    name: { 
        type: String, 
        required: true 
    },
    url: { 
        type: String, 
        required: true 
    },
    thumbnailUrl: { 
        type: String, 
        required: true 
    },
    cloudinaryId:{
        type:String
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    category: { 
        type: String, 
        required: true 
    }, 
    description: { 
        type: String, 
        required: true 
    }, 
    folder: { 
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
            username:String
        },
    ],
    
    averageRating: { // New field to store the average numeric rating
        type: Number,
        default: 0
    }
}, {
    timestamps: true // Automatically manage createdAt and updatedAt timestamps
});
const File = mongoose.model('File', fileSchema); // Ensure the model is correctly defined

module.exports = File; // Export the model // 