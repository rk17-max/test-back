const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const Message = require('./models/messages'); // Ensure the Message model is correctly set up

const app = express();
const port = 8080;
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: 'http://localhost:3000', // Your frontend URL
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true,
}));

// MongoDB Connection
const mongoURI = 'mongodb://localhost:27017/message'; // Replace with your actual MongoDB URI
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Socket.IO Connection
io.on('connection', async (socket) => {
  const userId = uuidv4();
  socket.userId = userId;
  console.log(`A user connected: ${userId}`);

  // Fetch and emit previous messages to the newly connected user
  try {
    const previousMessages = await Message.find().sort({ createdAt: 1 }); // Fetching messages in chronological order
    socket.emit('previous messages', previousMessages);
  } catch (err) {
    console.error('Error fetching previous messages:', err);
  }

  // Listen for chat messages
  socket.on('chat message', async ({ message, senderId }) => {
    console.log(`Chat message from ${senderId}: ${message}`);

    // Save the new message to the database
    const newMessage = new Message({ message, senderId });
    try {
      await newMessage.save();
    } catch (err) {
      console.error('Error saving message:', err);
    }

    // Broadcast the new message to all clients
    io.emit('chat message', { message, senderId });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${userId}`);
  });
});

// Start the server
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
