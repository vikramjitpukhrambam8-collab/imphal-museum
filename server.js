// server.js - Manipur State Museum Web Portal
// Complete Node.js + Express Backend

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// MongoDB Connection
// In mongoose >=6 the options `useNewUrlParser` and `useUnifiedTopology`
// are enabled by default. Start the server only after a successful
// connection so requests won't run while the driver is still connecting.
const connectToMongo = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/manipur_museum', {
      // fail fast if the server is unreachable (milliseconds)
      serverSelectionTimeoutMS: 10000
    });

    console.log('MongoDB Connected');
    // Start server after DB connection
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`\n╔════════════════════════════════════════════╗\n║   Manipur State Museum Web Portal         ║\n║   Server running on port ${PORT}              ║\n║   http://localhost:${PORT}                    ║\n╚════════════════════════════════════════════╝\n`);
    });
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
    console.error('Tried URI:', process.env.MONGODB_URI || 'mongodb://localhost:27017/manipur_museum');
    console.error('Will retry connection in 5 seconds...');
    // If running in development or explicitly requested, start an
    // in-memory MongoDB server instead of retrying indefinitely.
    const useMemory = process.env.NODE_ENV === 'development' || process.env.USE_IN_MEMORY_DB === 'true';
    if (useMemory) {
      try {
        console.log('Attempting to start in-memory MongoDB for development...');
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongoServer = await MongoMemoryServer.create();
        const uri = mongoServer.getUri();
        console.log('In-memory MongoDB started at', uri);
        process.env.MONGODB_URI = uri;
        // Retry connecting to the new in-memory DB
        return connectToMongo();
      } catch (memErr) {
        console.error('Failed to start in-memory MongoDB:', memErr);
      }
    }

    // Don't exit the process in development — retry after a delay so the
    // app can still serve static files and show a helpful 503 for API calls.
    setTimeout(connectToMongo, 5000);
  }
};

// Useful connection event logs
mongoose.connection.on('error', err => console.error('Mongoose connection error:', err));
mongoose.connection.on('disconnected', () => console.warn('Mongoose disconnected'));
mongoose.connection.on('reconnected', () => console.log('Mongoose reconnected'));

connectToMongo();

// If the DB is not connected, return a friendly 503 for API requests
app.use((req, res, next) => {
  if (req.path.startsWith('/api') && mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Service unavailable: database not connected' });
  }
  next();
});

// Database Models
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'editor', 'viewer'], default: 'viewer' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

const collectionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  period: { type: String, required: true },
  origin: { type: String, required: true },
  material: String,
  image: String,
  status: { type: String, default: 'active' },
  viewCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const exhibitionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  type: { type: String, enum: ['Permanent', 'Temporary', 'Special'], required: true },
  startDate: { type: Date, required: true },
  endDate: Date,
  status: { type: String, default: 'upcoming' },
  location: String,
  image: String,
  createdAt: { type: Date, default: Date.now }
});

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  time: String,
  location: { type: String, required: true },
  category: String,
  image: String,
  status: { type: String, default: 'upcoming' },
  createdAt: { type: Date, default: Date.now }
});

const newsSchema = new mongoose.Schema({
  title: { type: String, required: true },
  excerpt: { type: String, required: true },
  content: { type: String, required: true },
  image: String,
  status: { type: String, default: 'published' },
  publishDate: { type: Date, default: Date.now },
  views: { type: Number, default: 0 }
});

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  subject: String,
  message: { type: String, required: true },
  status: { type: String, default: 'new' },
  createdAt: { type: Date, default: Date.now }
});

// Models
const User = mongoose.model('User', userSchema);
const Collection = mongoose.model('Collection', collectionSchema);
const Exhibition = mongoose.model('Exhibition', exhibitionSchema);
const Event = mongoose.model('Event', eventSchema);
const News = mongoose.model('News', newsSchema);
const Contact = mongoose.model('Contact', contactSchema);

// Ensure a demo admin exists in development (helps with login tests)
const ensureAdminUser = async () => {
  try {
    const adminExists = await User.findOne({ email: 'admin@museum.gov.in' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('Admin@123', 12);
      await User.create({
        name: 'Admin User',
        email: 'admin@museum.gov.in',
        password: hashedPassword,
        role: 'admin'
      });
      console.log('Created demo admin user: admin@museum.gov.in / Admin@123');
    }
  } catch (err) {
    console.error('Error ensuring admin user:', err);
  }
};

mongoose.connection.on('connected', () => {
  if (process.env.NODE_ENV === 'development' || process.env.USE_IN_MEMORY_DB === 'true') {
    ensureAdminUser();
  }
});

// File Upload Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Ensure uploads directory exists to prevent multer errors when saving files
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory at', uploadsDir);
  } catch (err) {
    console.error('Failed to create uploads directory:', err);
  }
}

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
  
  jwt.verify(token, process.env.JWT_SECRET || 'museum_secret_key', (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Authorization Middleware
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    next();
  };
};

// ==================== PUBLIC ROUTES ====================

// Serve HTML Pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/collections', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'collections.html'));
});

app.get('/exhibitions', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'exhibitions.html'));
});

app.get('/visitor-info', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'visitor-info.html'));
});

app.get('/events', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'events.html'));
});

app.get('/news', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'news.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// New simple page route
app.get('/newpage', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'newpage.html'));
});

// API: Get Collections
app.get('/api/collections', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = { status: 'active' };
    
    if (category && category !== 'All') {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const collections = await Collection.find(query).sort('-createdAt');
    res.json({ success: true, data: collections });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Get Single Collection
app.get('/api/collections/:id', async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);
    if (!collection) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }
    collection.viewCount += 1;
    await collection.save();
    res.json({ success: true, data: collection });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Get Exhibitions
app.get('/api/exhibitions', async (req, res) => {
  try {
    const exhibitions = await Exhibition.find().sort('-createdAt');
    res.json({ success: true, data: exhibitions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Get Events
app.get('/api/events', async (req, res) => {
  try {
    const events = await Event.find().sort('date');
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Get News
app.get('/api/news', async (req, res) => {
  try {
    const news = await News.find({ status: 'published' }).sort('-publishDate');
    res.json({ success: true, data: news });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Submit Contact Form
app.post('/api/contact', async (req, res) => {
  try {
    const contact = await Contact.create(req.body);
    res.status(201).json({ 
      success: true, 
      message: 'Message sent successfully',
      data: contact 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== AUTHENTICATION ROUTES ====================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    if (user.status !== 'active') {
      return res.status(401).json({ success: false, message: 'Account is inactive' });
    }
    
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'museum_secret_key',
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Register (Admin only)
app.post('/api/auth/register', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'viewer'
    });
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Current User
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== ADMIN ROUTES ====================

// Create Collection
app.post('/api/admin/collections', authenticateToken, authorizeRoles('admin', 'editor'), handleMulterUpload(upload.single('image')), async (req, res) => {
  try {
    // Use uploaded file path if present; otherwise keep any image URL provided
    const collectionData = {
      ...req.body,
      image: req.file ? `/uploads/${req.file.filename}` : (req.body.image || null)
    };

    // Debug log to help diagnose 500 errors related to payloads/uploads
    console.log('Creating collection with payload:', {
      contentType: req.headers['content-type'],
      body: req.body,
      file: req.file ? { filename: req.file.filename, size: req.file.size } : null,
      user: req.user?.email
    });

    const collection = await Collection.create(collectionData);
    res.status(201).json({ 
      success: true, 
      message: 'Collection created successfully',
      data: collection 
    });
  } catch (error) {
    // Return validation errors with 400 for better client feedback
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      console.error('Collection creation validation failed:', messages, 'payload:', req.body);
      return res.status(400).json({ success: false, message: 'Validation failed', errors: messages });
    }
    console.error('Error creating collection:', error, 'payload:', req.body);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Collection
app.put('/api/admin/collections/:id', authenticateToken, authorizeRoles('admin', 'editor'), async (req, res) => {
  try {
    const collection = await Collection.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!collection) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Collection updated successfully',
      data: collection 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete Collection
app.delete('/api/admin/collections/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const collection = await Collection.findByIdAndDelete(req.params.id);
    
    if (!collection) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }
    
    res.json({ success: true, message: 'Collection deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create Exhibition (supports image upload via `image` field)
// Helper to handle multer errors for routes that accept file uploads
function handleMulterUpload(mw) {
  return (req, res, next) => {
    try {
      const ct = req.headers['content-type'] || '';
      // Only invoke multer when request is multipart/form-data
      if (!ct.includes('multipart/form-data')) {
        return next();
      }

      mw(req, res, (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            return res.status(400).json({ success: false, message: err.message });
          }
          console.error('Multer error:', err);
          return res.status(500).json({ success: false, message: 'File upload failed' });
        }
        next();
      });
    } catch (err) {
      console.error('handleMulterUpload error:', err);
      return res.status(500).json({ success: false, message: 'File upload handling failed' });
    }
  };
}

app.post('/api/admin/exhibitions', authenticateToken, authorizeRoles('admin', 'editor'), handleMulterUpload(upload.single('image')), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      // store the uploaded file path
      data.image = `/uploads/${req.file.filename}`;
    }

    // Log incoming payload for easier debugging
    console.log('Creating exhibition with payload:', { data, file: req.file ? req.file.filename : null, user: req.user?.email });

    const exhibition = await Exhibition.create(data);
    res.status(201).json({ 
      success: true, 
      message: 'Exhibition created successfully',
      data: exhibition 
    });
  } catch (error) {
    // Handle mongoose validation errors with 400 and helpful details
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: 'Validation failed', errors: messages });
    }

    console.error('Error creating exhibition:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete Exhibition
app.delete('/api/admin/exhibitions/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const exhibition = await Exhibition.findByIdAndDelete(req.params.id);
    if (!exhibition) {
      return res.status(404).json({ success: false, message: 'Exhibition not found' });
    }
    res.json({ success: true, message: 'Exhibition deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create Event
// Create Event (supports image upload via `image` field)
app.post('/api/admin/events', authenticateToken, authorizeRoles('admin', 'editor'), upload.single('image'), async (req, res) => {
  try {
    // Log raw incoming request for easier debugging
    console.log('POST /api/admin/events - content-type:', req.headers['content-type']);
    console.log('POST /api/admin/events - raw req.body:', req.body);
    console.log('POST /api/admin/events - req.file:', req.file ? { filename: req.file.filename, size: req.file.size } : null);

    let data = { ...req.body };
    // If form fields are submitted as arrays (some clients do), prefer the first value
    const normalizeField = (f) => {
      if (Array.isArray(data[f])) data[f] = data[f][0];
      if (typeof data[f] === 'string') data[f] = data[f].trim();
    };
    ['title', 'description', 'date', 'location', 'time', 'category'].forEach(normalizeField);
    if (req.file) {
      data.image = `/uploads/${req.file.filename}`;
    }

    console.log('Creating event with payload:', { data, file: req.file ? req.file.filename : null, user: req.user?.email });

    // Basic server-side validation for required fields
    const required = ['title', 'description', 'date', 'location'];
    const missing = required.filter(f => !data[f] || data[f].toString().trim() === '');
    if (missing.length > 0) {
      console.warn('Event creation - missing required fields:', missing, 'payload:', data);
      return res.status(400).json({ success: false, message: 'Missing required fields', fields: missing, payload: data });
    }

    // Validate date
    const parsed = Date.parse(data.date);
    if (isNaN(parsed)) {
      console.warn('Event creation - invalid date:', data.date, 'payload:', data);
      return res.status(400).json({ success: false, message: 'Invalid date format for field "date"', payload: data });
    }
    // normalize date to Date object so mongoose gets a proper Date
    data.date = new Date(parsed);

    const event = await Event.create(data);
    res.status(201).json({ 
      success: true, 
      message: 'Event created successfully',
      data: event 
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      console.error('Event creation - Mongoose ValidationError:', messages, 'payload:', data);
      return res.status(400).json({ success: false, message: 'Validation failed', errors: messages, raw: error.message, payload: data });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: `Invalid value for field ${error.path}: ${error.message}` });
    }
    console.error('Error creating event:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete Event
app.delete('/api/admin/events/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const ev = await Event.findByIdAndDelete(req.params.id);
    if (!ev) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create News
app.post('/api/admin/news', authenticateToken, authorizeRoles('admin', 'editor'), async (req, res) => {
  try {
    const news = await News.create(req.body);
    res.status(201).json({ 
      success: true, 
      message: 'News created successfully',
      data: news 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Dashboard Stats
app.get('/api/admin/stats', authenticateToken, authorizeRoles('admin', 'editor'), async (req, res) => {
  try {
    const stats = {
      collections: await Collection.countDocuments(),
      exhibitions: await Exhibition.countDocuments(),
      events: await Event.countDocuments(),
      news: await News.countDocuments(),
      contacts: await Contact.countDocuments({ status: 'new' })
    };
    
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get All Users (Admin only)
app.get('/api/admin/users', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== SEED DATA (Development Only) ====================

app.post('/api/seed', async (req, res) => {
  try {
    // Create admin user
    const adminExists = await User.findOne({ email: 'admin@museum.gov.in' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('Admin@123', 12);
      await User.create({
        name: 'Admin User',
        email: 'admin@museum.gov.in',
        password: hashedPassword,
        role: 'admin'
      });
    }
    
    // Create sample collections
    const collectionsCount = await Collection.countDocuments();
    if (collectionsCount === 0) {
      await Collection.insertMany([
        {
          title: 'Ancient Pottery Collection',
          description: 'A remarkable collection of pottery from ancient Manipur, dating back to 100 BCE.',
          category: 'Archaeology',
          period: '100 BCE - 200 CE',
          origin: 'Manipur Valley',
          material: 'Terracotta',
          image: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=400'
        },
        {
          title: 'Traditional Manipuri Textiles',
          description: 'Handwoven textiles showcasing the exquisite craftsmanship of Manipuri weavers.',
          category: 'Ethnography',
          period: '18th-19th Century',
          origin: 'Imphal',
          material: 'Cotton, Silk',
          image: 'https://images.unsplash.com/photo-1615397349754-5db1d78e2d39?w=400'
        },
        {
          title: 'Bronze Sculptures',
          description: 'Medieval bronze sculptures depicting various deities and historical figures.',
          category: 'Art',
          period: '15th Century',
          origin: 'Kangla Fort',
          material: 'Bronze',
          image: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=400'
        }
      ]);
    }
    
    res.json({ success: true, message: 'Database seeded successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== ERROR HANDLING ====================

// Debug endpoint to inspect incoming requests (temporary - can be removed)
app.post('/debug/echo', handleMulterUpload(upload.single('image')), (req, res) => {
  try {
    return res.json({
      success: true,
      headers: req.headers,
      body: req.body,
      file: req.file ? { filename: req.file.filename, size: req.file.size, mimetype: req.file.mimetype } : null
    });
  } catch (err) {
    console.error('Echo endpoint error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Convenience GET echo for quick checks (only in development)
app.get('/debug/echo', (req, res) => {
  if (process.env.NODE_ENV !== 'development') return res.status(404).json({ success: false, message: 'Route not found' });
  res.json({ success: true, method: 'GET', query: req.query, headers: req.headers });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (process.env.NODE_ENV === 'development') {
    return res.status(500).json({ success: false, message: err.message, stack: err.stack });
  }
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// The server is started after a successful MongoDB connection in
// `connectToMongo()` above. Export the `app` for testing.
module.exports = app;
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});
