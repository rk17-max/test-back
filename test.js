const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Folder = require('./models/Foldersc');
const File = require('./models/Filesc');
const axios = require('axios');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const updateFileSentiment = require('./sentimentAnalysis');
const pdf = require('pdf-parse');
const User = require('./models/test');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');

const fs = require('fs');
require('dotenv').config();
const app = express();

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'notes-app',
    allowed_formats: ['pdf', 'png', 'jpg', 'jpeg'],
    resource_type: 'auto'
  }
});

const upload = multer({ storage });

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/myapp1')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));
  const verifyUser = async (req, res, next) => {
    try {
        const token = req.cookies.token; // Check for token in cookies
        console.log(token)
        if (!token) {
            console.log("No token provided"); // Log message
            return res.status(401).json({ status: false, message: "No token provided" });
        }
  
        const decoded = await jwt.verify(token,"secret"); // Verify token
        const user = await User.findById(decoded.userid); // Fetch user details
        if (!user) {
            console.log("User not found"); // Log message
            return res.status(404).json({ status: false, message: "User not found" });
        }
  
        console.log("User verified:", user.username); // Log message
        req.user = user; // Attach the user to the request object
        next(); // Proceed to the next middleware or route handler
    } catch (err) {
        console.error("Verification error:", err); // Log the error
        return res.status(401).json({ status: false, message: "Invalid token", error: err.message });
    }
  };
// Route to get all PDF files from Cloudinary  (working)
app.get('/api/files', verifyUser, async (req, res) => {
  try {
    console.log("Fetching Cloudinary and database files for user:", req.user._id);

    // Retrieve files from Cloudinary for the specified folder and resource type
    const result = await cloudinary.search
    .expression('folder:notes-app')
    .with_field('context')
    .max_results(500)
    .execute();
    console.log("Cloudinary search raw result:", JSON.stringify(result, null, 2));


    console.log("Cloudinary search result:", result.resources.length, "files found");

    // Retrieve files associated with the authenticated user from MongoDB
    const dbFiles = await File.find({ user: req.user._id });
    console.log("Database files found:", dbFiles.length);

    // Map Cloudinary results to include matching database information
    const files = result.resources.map(cloudinaryFile => {
      // Find the corresponding MongoDB entry using cloudinaryId
      const dbFile = dbFiles.find(f => f.cloudinaryId === cloudinaryFile.public_id);

      // Return combined data from Cloudinary and MongoDB if a match is found
      if (dbFile) {
        console.log(`Matched file: Cloudinary ID ${cloudinaryFile.public_id}, DB ID ${dbFile._id}`);
        return {
          id: dbFile._id,
          name: dbFile.name,
          description: dbFile.description,
          category: dbFile.category,
          url: cloudinaryFile.secure_url,
          thumbnailUrl: dbFile.thumbnailUrl,
          originalName: dbFile.originalName,
          createdAt: dbFile.createdAt,
          updatedAt: dbFile.updatedAt,
          ratings: dbFile.ratings || [],
          cloudinaryId: cloudinaryFile.public_id,
          format: cloudinaryFile.format,
          size: cloudinaryFile.bytes,
          uploadedAt: cloudinaryFile.created_at
        };
      } else {
        console.log(`No matching database entry found for Cloudinary file: ${cloudinaryFile.public_id}`);
        return null;
      }
    }).filter(file => file !== null); // Filter out any files without matching DB entries

    console.log("Total matched files to send in response:", files.length);

    res.json({
      success: true,
      files,
      total: files.length
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching files',
      error: error.message
    });
  }
});

//working
app.get('/files/:fileId', async (req, res) => {
  const { fileId } = req.params; // Get the file ID from URL params


  try {
      const file = await File.findById(fileId); // Find the file by its ID
      console.log(file)
      if (!file) {
          return res.status(404).json({ message: "File not found" });
      }

      console.log("Found file:", file); // Debugging
      return res.status(200).json(file); // Send file details back
  } catch (error) {
      console.error("Error fetching file:", error);
      return res.status(500).json({ message: "Server error" });
  }
});
const extractPdfPages = async (fileUrl, pages = null) => {
  try {
    // Fetch the PDF file from Cloudinary
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });

    // Convert the Buffer to ArrayBuffer (pdf-lib expects ArrayBuffer)
    const pdfData = response.data;

    // Log the raw data (for debugging purposes)
    console.log('PDF Response:', pdfData);

    // Load the PDF document from the ArrayBuffer data
    const pdfDoc = await PDFDocument.load(pdfData);

    // Determine which pages to extract
    const pagesToExtract = pages || Array.from({ length: pdfDoc.getPageCount() }, (_, i) => i + 1);

    // Create a new PDF document to store the extracted pages
    const pdfDocExtracted = await PDFDocument.create();

    // Extract the specified pages
    for (const pageIndex of pagesToExtract) {
      const [copiedPage] = await pdfDocExtracted.copyPages(pdfDoc, [pageIndex - 1]);
      pdfDocExtracted.addPage(copiedPage);
    }

    // Return the extracted PDF as a byte array
    return await pdfDocExtracted.save();
  } catch (error) {
    console.error("Error extracting PDF pages:", error);
    throw error;
  }
};

//working
app.get("/preview/:id", verifyUser, async (req, res) => {
  try {
    const fileId = req.params.id;
    const file = await File.findById(fileId).populate('ratings.user', 'username');

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    // Assuming your file model now contains a URL to the Cloudinary-hosted file
    const fileUrl = file.url;  // This should be the URL from Cloudinary

    // Example user data fetching (replace with your auth system)
    const user = req.user; // Assumes req.user is populated with user data

    // Send full file URL to frontend (no page extraction)
    res.json({
      file,
      pdfPreview: fileUrl, // Send the full URL for the file
    });
  } catch (err) {
    console.error("Error generating preview:", err);
    res.status(500).json({ message: "Server error while generating preview" });
  }
});


//working
app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  console.log(username);
  
  // Check if the user already exists
  const user = await User.findOne({ email });
  if (user) {
      return res.json({ message: "User already registered" });
  }
  
  // Hash the password
  const hashPassword = await bcrypt.hash(password, 10);
  
  // Create a new user
  const newUser = new User({
      username,
      email,
      password: hashPassword,
  });
  
  await newUser.save();
  console.log("User saved");
  return res.json({ message: "User registered successfully" });
});

// Login Route working
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log(email)

  try {
    // Use `findOne` to get a single user
    const user = await User.findOne({ email });
    console.log("found user",user)
    if (!user) {
      return res.json({ message: "User is not registered" });
    }

    // Compare the plain text password with the hashed password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.json({ message: "Invalid password" });
    }

    // Sign the JWT with user info
    const token = jwt.sign({userid: user._id, username: user.username }, "secret", { expiresIn: "1h" });
    console.log(token)
    

    res.cookie('token', token, { httpOnly: false, sameSite: 'lax', maxAge: 3600000, path: '/' });


    return res.json({
      status: true,
      message: "Login successful",
      Token:token
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});
app.get('/profile', verifyUser, async (req, res) => {
  try {
      const userId = req.user._id; // Get the user ID from the authenticated user

      if (!userId) {
          return res.status(401).json({ message: 'Not authenticated' });
      }

      const user = await User.findById(userId); // Fetch the user by ID
      if (!user) {
          return res.status(404).json({ message: 'User not found' });
      }

      // Create a response object with the count of uploaded and downloaded files
      const profileData = {
          username: user.username,
          email: user.email,
          fullName: user.fullName || "N/A", // Handle case where full name might be missing
          createdAt: user.createdAt,
          premiumStatus: user.isPremium ? "Premium" : "Non-Premium",
          uploadedFilesCount: user.uploadedFiles.length, // Count of uploaded files
          downloadedFilesCount: user.downloadedFiles.length, // Count of downloaded files
      };

      res.json(profileData); // Send the formatted profile data
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
  }
});
//route for user files which he hhas uploadeded
app.get('/user/files', verifyUser, async (req, res) => {
  try {
      const user = await User.findById(req.user._id).populate('uploadedFiles'); // Populate the uploadedFiles field
      res.json(user.uploadedFiles); // Send the user's uploaded files
  } catch (error) {
      console.error("Error fetching user's files:", error);
      res.status(500).json({ message: "Internal server error" });
  }
});
//chatbot route
app.post('/chatbot', async (req, res) => {
  const { inputValue } = req.body; // Expecting { inputValue: "user input" }

  console.log('User Input:', inputValue);

  // Validate input
  if (!inputValue || typeof inputValue !== 'string') {
      return res.status(400).json({ message: "Invalid input. Please provide a valid message." });
  }

  try {
      // Send a request to the Flask API
      const response = await axios.post('http://127.0.0.1:5000/chatbot', {
          inputValue: inputValue
      });

      // Get the response message from Flask
      const botResponse = response.data.message;

      // Return the response to the client
      return res.json({ message: botResponse });
  } catch (error) {
      console.error('Error while processing the request:', error.message || error);
      // Handle specific error scenarios
      if (error.response) {
          return res.status(error.response.status).json({ message: error.response.data.message });
      }
      return res.status(500).json({ message: "An error occurred while processing your request." });
  }
});

app.get("/verify", verifyUser, (req, res) => {
  res.json({ status: true, username: req.user.username }); // Send username to the frontend
});
// rate file route
// app.post('/rate-file', verifyUser, async (req, res) => {
//   console.log('User:', req.user);
//   const userId = req.user._id;
//   const { fileId, rating, comment } = req.body;

//   try {
//       const file = await File.findById(fileId);
//       console.log('Found file:', file);

//       if (!file) {
//           return res.status(404).json({ message: 'File not found' });
//       }

//       file.ratings.push({
//           user: userId,
//           rating: parseInt(rating),
//           comment,
//       });

//       await file.save(); // Save the file with the new rating and comment

//       // Update sentiment and average rating
//       await updateFileSentiment(fileId);

//       const updatedFile = await File.findById(fileId);

//       res.status(200).json({
//           message: 'Rating and comment saved successfully',
//           sentiment: updatedFile.sentiment,
//           averageRating: updatedFile.averageRating // Send back the average rating
//       });
//   } catch (err) {
//       console.error('Error saving rating and comment:', err);
//       res.status(500).json({ message: 'Failed to save rating and comment' });
//   }
// });
app.post('/rate-file', verifyUser, async (req, res) => {
  console.log('User:', req.user);
  const userId = req.user._id;
  const { fileId, rating, comment } = req.body;

  try {
      const file = await File.findById(fileId);
      console.log('Found file:', file);

      if (!file) {
          return res.status(404).json({ message: 'File not found' });
      }

      // Fetch the username based on the userId
      const user = await User.findById(userId);
      const username = user ? user.username : 'Anonymous'; // Default to 'Anonymous' if no user is found
      console.log(username)

      // Add the rating with username to the file's ratings array
      file.ratings.push({
          user: userId,
          rating: parseInt(rating),
          comment,
          username,  // Include username here
      });

      await file.save(); // Save the file with the new rating and comment

      // Update sentiment and average rating
      await updateFileSentiment(fileId);

      const updatedFile = await File.findById(fileId);
      console.log(updatedFile.ratings)

      res.status(200).json({
          message: 'Rating and comment saved successfully',
          sentiment: updatedFile.sentiment,
          averageRating: updatedFile.averageRating, // Send back the average rating
          ratings: updatedFile.ratings // Send back the updated ratings
      });
  } catch (err) {
      console.error('Error saving rating and comment:', err);
      res.status(500).json({ message: 'Failed to save rating and comment' });
  }
});

//route to send username to view in comment
app.get('/users/:userId', async (req, res) => {
  const { userId } = req.params; // Get the user ID from URL params

  try {
      const user = await User.findById(userId); // Assuming you have a User model
      if (!user) {
          return res.status(404).json({ message: "User not found" });
      }

      return res.status(200).json(user); // Send user details back
  } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({ message: "Server error" });
  }
});
// Modified upload route for Cloudinary (working)
app.post('/upload', verifyUser, upload.fields([{ name: 'pdf' }, { name: 'thumbnail' }]), async (req, res) => {
  if (!req.files || !req.files.pdf || !req.files.thumbnail) {
    return res.status(400).json({ message: 'Both PDF and thumbnail are required' });
  }

  try {
    const newFile = new File({
      url: req.files.pdf[0].path,
      thumbnailUrl: req.files.thumbnail[0].path,
      originalName: req.files.pdf[0].originalname,
      user: req.user._id,
      category: req.body.category,
      description: req.body.description,
      name: req.body.name,
      cloudinaryId: req.files.pdf[0].filename
    });

    const savedFile = await newFile.save();
    await User.findByIdAndUpdate(req.user._id, { $push: { uploadedFiles: savedFile._id } });

    res.status(200).json({
      url: req.files.pdf[0].path,
      thumbnailUrl: req.files.thumbnail[0].path,
      message: 'File uploaded successfully'
    });
  } catch (err) {
    console.error("Error saving file:", err);
    res.status(500).json({ message: 'Failed to save file information.' });
  }
});
// API route to create a folder(working)
app.post('/folders', verifyUser, async (req, res) => {
  const { name } = req.body;
  const userId = req.user._id; // Assuming you have user authentication middleware to set req.user

  try {
      // Create the folder
      const newFolder = new Folder({ name, userId });
      await newFolder.save();

      // Update the user's folders array
      await User.findByIdAndUpdate(userId, { $push: { folders: newFolder._id } });

      res.status(201).json({ message: 'Folder created successfully', folder: newFolder });
  } catch (error) {
      console.error("Error creating folder:", error);
      res.status(500).json({ message: 'Error creating folder', error: error.message });
  }
});

// Modified delete route for Cloudinary
app.get("/filesdelete/:fileId", verifyUser, async (req, res) => {
  const { fileId } = req.params;
  const currentUserId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    return res.status(400).json({ error: "Invalid file ID format" });
  }

  try {
    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ error: "File not found in database" });
    }

    // Delete from Cloudinary
    if (file.cloudinaryId) {
      await cloudinary.uploader.destroy(file.cloudinaryId);
    }

    // Delete file from database
    await File.findByIdAndDelete(fileId);

    // Remove file reference from user
    await User.findByIdAndUpdate(
      currentUserId,
      { $pull: { uploadedFiles: fileId } }
    );

    res.json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
//route to add files in specific folder by id (working)
app.post('/folders/:folderId/add-file', verifyUser, async (req, res) => {
  const { folderId } = req.params; // Get folder ID from the request parameters
  const { fileId } = req.body; // Get file ID from the request body

  try {
      // Find the folder by ID and update it to include the new file
      const updatedFolder = await Folder.findByIdAndUpdate(
          folderId,
          { $addToSet: { files: fileId } }, // Use $addToSet to avoid duplicates
          { new: true } // Return the updated folder
      );

      if (!updatedFolder) {
          return res.status(404).json({ message: 'Folder not found' });
      }

      res.status(200).json({
          message: 'File added to folder successfully',
          folder: updatedFolder,
      });
  } catch (error) {
      console.error("Error adding file to folder:", error);
      res.status(500).json({ message: 'Error adding file to folder', error: error.message });
  }
});
//working
app.get('/folders/:folderId/files', async (req, res) => {
  const { folderId } = req.params;

  try {
    // Find the folder by ID, including its files
    const folder = await Folder.findById(folderId).populate('files'); // Assuming you have a reference to files

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    res.json({ files: folder.files });
  } catch (error) {
    console.error("Error fetching files:", error);
    res.status(500).json({ message: 'Server error' });
  }
});


//working
app.get('/folders', verifyUser, async (req, res) => {
  const userId = req.user._id; // Assuming user is authenticated
  try {
    const folders = await Folder.find({ userId }).populate('files'); // Find folders by userId
      
      res.json({ folders });
  } catch (error) {
      console.error("Error fetching folders:", error);
      res.status(500).json({ message: 'Error fetching folders', error: error.message });
  }
});
//working
app.get('/api/user/files',verifyUser, async (req, res) => {
  try {
      // Find the user by their ID and populate the uploadedFiles field
      const user = await User.findById(req.user._id).populate('uploadedFiles');
      
      // Check if the user has uploaded files
      if (!user || !user.uploadedFiles) {
          return res.status(404).json({ message: "User or uploaded files not found" });
      }

      // Send the user's uploaded files
      console.log("send user files")
      res.status(200).json(user.uploadedFiles);
  } catch (error) {
      console.error("Error fetching user's files:", error);
      res.status(500).json({ message: "Internal server error" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});