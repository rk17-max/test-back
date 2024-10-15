const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const cloudinary = require('cloudinary').v2; // Ensure you have cloudinary configured
const storage = require('./cloud');
const File = require('./models/Filesc'); // Ensure the path is correct

const path = require('path');
const User = require('./models/test'); // Import the User model
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const app = express();

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// Set up storage engine for multer


// Initialize upload variable
const upload = multer({ storage: storage })
app.use(cors({
  origin: 'http://localhost:3000', // Adjust based on where your React app is hosted
  credentials: true, // Allow credentials (cookies) to be sent
}));
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// MongoDB Connection
mongoose.connect("mongodb+srv://backend:9873754056@cluster0.sbrgl.mongodb.net/myapp?retryWrites=true&w=majority&appName=Cluster0")
  .then(function() {
    console.log("Connected to the myapp database successfully!");
  })
  .catch(function(error) {
    console.log("Error connecting to the myapp database:", error);
  });

// Signup Route
app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  console.log(username);
  
  // Check if the user already exists
  const user = await User.findOne({ email }); // Use findOne to check for a single user by email
  if (user) {
    return res.json({ message: "User already registered" }); // Corrected the spelling of "message"
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

// Login Route
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Use `findOne` to get a single user
    const user = await User.findOne({ email });
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


//   try {
//     const token = req.cookies.token; // Check for token in cookies
//     if (!token) {
//       console.log("No token provided"); // Log message
//       return res.status(401).json({ status: false, message: "No token provided" });
//     }

//     const decoded = await jwt.verify(token, "secret"); // Verify token
//     const user = await User.findById(decoded.userid); // Fetch user details
//     if (!user) {
//       console.log("User not found"); // Log message
//       return res.status(404).json({ status: false, message: "User not found" });
//     }

//     console.log("User verified:", user.username); // Log message
//     req.user = user; // Optionally attach the user to the request object
//     next(); // Proceed to the next middleware or route handler
//   } catch (err) {
//     console.error("Verification error:", err); // Log the error
//     return res.status(401).json({ status: false, message: "Invalid token", error: err.message });
//   }
// };
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
app.get("/verify", verifyUser, (req, res) => {
  res.json({ status: true, username: req.user.username }); // Send username to the frontend
});


app.get("/logout",(req,res)=>{
  res.clearCookie("token");
  return res.json({status:true,message:"logout"})
})

// route for uploading files 
app.post('/upload', verifyUser, upload.single('pdf'), async (req, res) => {
  if (req.file) {
      // Create a new file object including the user ID and category
      const newFile = new File({
          url: req.file.path, // This should be the relative path to the file
          originalName: req.file.filename, // Ensure this has the full filename including timestamp
          user: req.user._id, // Include the user ID here
          category: req.body.category // Include the category from the request body
      });

      try {
          const savedFile = await newFile.save(); // Save the file to the database

          // Push the saved file ID to the user's uploadedFiles array
          await User.findByIdAndUpdate(req.user._id, { $push: { uploadedFiles: savedFile._id } });

          console.log('File uploaded and saved successfully:', req.file.path);
          res.status(200).json({ url: req.file.path }); // Respond with the file URL
      } catch (err) {
          console.error("Error saving file to MongoDB:", err);
          res.status(500).json({ message: 'Failed to save file information.' });
      }
  } else {
      res.status(400).json({ message: 'File upload failed.' });
  }
});


// Route to get the list of uploaded files
// app.get('/files', (req, res) => {
//   fs.readdir('uploads', (err, files) => {
//       if (err) {
//           return res.status(500).json({ message: 'Failed to retrieve files.' });
//       }
//       res.json(files); // Send the list of files
//   });
// });

// app.get('/files', async (req, res) => {
//   try {
//       // Read the files from the uploads directory
//       fs.readdir('uploads', async (err, fileNames) => {
//           if (err) {
//               return res.status(500).json({ message: 'Failed to retrieve files.' });
//           }

//           // Fetch file metadata from the database
//           const files = await File.find({ originalName: { $in: fileNames } }); // Ensure you only fetch files that exist in the uploads folder
          
//           // Create a mapping of the files from the database for easy lookup
//           const fileMap = files.reduce((acc, file) => {
//               acc[file.originalName] = {
//                   id: file._id,
//                   url: file.url,
//                   ratings: file.ratings, // Include ratings
//                   createdAt: file.createdAt,
//                   updatedAt: file.updatedAt,
//               };
//               return acc;
//           }, {});

//           // Combine file names and their metadata
//           const fileDetails = fileNames.map(fileName => ({
//               originalName: fileName,
//               ...fileMap[fileName], // Spread the metadata if available
//               ratings: fileMap[fileName]?.ratings || [], // Default to empty array if no ratings exist
//           }));

//           res.status(200).json(fileDetails); // Send the list of files with metadata
//       });
//   } catch (err) {
//       console.error('Error retrieving files:', err);
//       res.status(500).json({ message: 'Failed to retrieve files.' });
//   }
// });
app.get('/files', async (req, res) => {
  try {
    // Fetch file metadata from MongoDB
    const files = await File.find();

    if (files.length === 0) {
      return res.status(404).json({ message: 'No files found.' });
    }

    // Prepare file details to send to the frontend
    const fileDetails = files.map(file => ({
      id: file._id,
      originalName: file.originalName, // File name
      url: file.url,                   // Cloudinary URL
      category: file.category,         // File category
      ratings: file.ratings,           // Ratings (if any)
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    }));

    console.log('Fetched Files from Database:', fileDetails); // Log fetched file details

    // Send the file details to the frontend
    res.status(200).json(fileDetails);

  } catch (err) {
    console.error('Error retrieving files:', err);
    res.status(500).json({ message: 'Failed to retrieve files.' });
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


// rate file route
app.post('/rate-file', verifyUser, async (req, res) => { // Add verifyUser middleware
  console.log('User:', req.user); // Check the user info
  const userId = req.user._id; // Extract user ID
  const { fileId, rating, comment } = req.body; // Get fileId from the request body

  try {
      // Find the file by its ID
      const file = await File.findById(fileId);
      console.log('Found file:', file);

      if (!file) {
          return res.status(404).json({ message: 'File not found' });
      }

      // Add the new rating and comment
      file.ratings.push({
          user: userId, // Ensure this is correct
          rating: parseInt(rating),
          comment,
      });

      await file.save(); // Save the file with the new rating and comment
      res.status(200).json({ message: 'Rating and comment saved successfully' });
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

//route to view speciic file  with details
app.get('/files/:fileId', async (req, res) => {
  const { fileId } = req.params; // Get the file ID from URL params

  try {
      const file = await File.findById(fileId); // Find the file by its ID
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
//route to delete files
app.delete('/filesdelete/:id', verifyUser, async (req, res) => {
  console.log(`Received DELETE request for file ID: ${req.params.id}`);

  try {
      const fileId = req.params.id;

      // Find the file in the database
      const file = await File.findById(fileId);

      if (!file) {
          console.log('File not found');
          return res.status(404).json({ message: 'File not found' });
      }

      // Check if the user is the owner of the file
      if (!file.user.equals(req.user._id)) {
          console.log('Unauthorized access');
          return res.status(403).json({ message: 'You are not authorized to delete this file.' });
      }

      // Delete the file from the database
      await File.findByIdAndDelete(fileId);

      // Optionally, remove the file ID from the user's uploadedFiles array
      await User.findByIdAndUpdate(req.user._id, { $pull: { uploadedFiles: fileId } });

      return res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
      console.error("Error in delete file route:", error);
      return res.status(500).json({ message: 'Internal server error', error: error.message }); // Include the error message
  }
});



// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
