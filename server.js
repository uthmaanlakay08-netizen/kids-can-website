require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase;
if (supabaseUrl && supabaseKey) {
    try {
        supabase = createClient(supabaseUrl, supabaseKey);
        console.log("Supabase client initialized successfully.");
    } catch (err) {
        console.error("Critical: Failed to initialize Supabase client:", err.message);
    }
} else {
    console.warn("Warning: SUPABASE_URL or SUPABASE_KEY missing. Supabase functionality will be disabled.");
}

// Helper to check if Supabase is available
const isSupabaseReady = () => !!supabase;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Basic Request Logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Ensure uploads directory exists - Skip if on Vercel
const isVercel = process.env.VERCEL === '1';
const uploadDir = 'uploads';

if (!isVercel) {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir);
    }
}

// Multer Storage Configuration
// Use disk storage locally, memory storage on Vercel (or handle differently)
const storage = isVercel
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            cb(null, 'file-' + Date.now() + path.extname(file.originalname));
        }
    });

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Serve static files
// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

if (!isVercel) {
    app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// --- API ROUTES ---

// Team Registration (Still just logs/emails for now, could save to DB later)
app.post('/api/register-team', upload.single('smashVideo'), (req, res) => {
    const { teamName, player1, player2, email, phone } = req.body;
    console.log(`New Team Registration: ${teamName}`);

    // Note: If on Vercel and using memoryStorage, req.file.buffer contains the file
    // For now we just return success

    res.send(`
        <h1>Registration Successful!</h1>
        <p>Team <strong>${teamName}</strong> has been registered.</p>
        <a href="/">Back to Home</a>
    `);
});

// --- PUBLIC DATA ENDPOINTS ---

// Get Heroes
app.get('/api/heroes', async (req, res) => {
    if (!isSupabaseReady()) return res.status(503).json({ error: "Service unavailable: Database not connected." });
    try {
        const { data, error } = await supabase.from('heroes').select('*').order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });

        const searchQuery = req.query.search ? req.query.search.toLowerCase() : '';
        if (searchQuery) {
            const filtered = data.filter(h =>
                h.name.toLowerCase().includes(searchQuery) ||
                (h.diagnosis && h.diagnosis.toLowerCase().includes(searchQuery))
            );
            return res.json(filtered);
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Events
app.get('/api/events', async (req, res) => {
    if (!isSupabaseReady()) return res.status(503).json({ error: "Service unavailable: Database not connected." });
    try {
        const { data, error } = await supabase.from('events').select('*').order('date', { ascending: true });
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get About Page Data
app.get('/api/about', async (req, res) => {
    if (!isSupabaseReady()) return res.json({ mission: '', mission_extended: '', gallery: [] });
    try {
        const { data, error } = await supabase.from('about_page').select('*').limit(1).single();
        if (error) {
            return res.json({ mission: '', mission_extended: '', gallery: [] });
        }
        res.json({
            mission: data.mission,
            missionExtended: data.mission_extended,
            gallery: data.gallery
        });
    } catch (err) {
        res.json({ mission: '', mission_extended: '', gallery: [] });
    }
});

// Get Site Content
app.get('/api/admin/content', async (req, res) => {
    if (!isSupabaseReady()) return res.json({});
    try {
        const { data, error } = await supabase.from('site_content').select('*');
        if (error) return res.json({});

        const contentObj = {};
        data.forEach(item => contentObj[item.key] = item.value);
        res.json(contentObj);
    } catch (err) {
        res.json({});
    }
});


// --- ADMIN ENDPOINTS ---

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";

app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true, token: "demo-token-supabase" });
    } else {
        res.status(401).json({ success: false, message: "Invalid password" });
    }
});

// Analytics Data
app.get('/api/admin/analytics', async (req, res) => {
    if (!isSupabaseReady()) return res.status(503).json({ error: "Service unavailable: Database not connected." });
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: views, error } = await supabase
            .from('page_views')
            .select('viewed_at, path')
            .gte('viewed_at', thirtyDaysAgo.toISOString());

        if (error) return res.status(500).json({ error: error.message });

        const dailyCounts = {};
        const pageCounts = {};

        views.forEach(view => {
            const date = new Date(view.viewed_at).toLocaleDateString();
            dailyCounts[date] = (dailyCounts[date] || 0) + 1;
            pageCounts[view.path] = (pageCounts[view.path] || 0) + 1;
        });

        const topPages = Object.entries(pageCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([path, count]) => ({ path, count }));

        res.json({
            totalViews: views.length,
            dailyCounts,
            topPages
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Heroes CRUD
app.get('/api/admin/heroes', async (req, res) => {
    if (!isSupabaseReady()) return res.status(503).json({ error: "Service unavailable: Database not connected." });
    const { data, error } = await supabase.from('heroes').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/admin/heroes', async (req, res) => {
    if (!isSupabaseReady()) return res.status(503).json({ error: "Service unavailable: Database not connected." });
    const { data, error } = await supabase.from('heroes').insert([req.body]).select();
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, hero: data[0] });
});

app.delete('/api/admin/heroes/:id', async (req, res) => {
    if (!isSupabaseReady()) return res.status(503).json({ error: "Service unavailable: Database not connected." });
    const { error } = await supabase.from('heroes').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false });
    res.json({ success: true });
});

// Events CRUD
app.get('/api/admin/events', async (req, res) => {
    if (!isSupabaseReady()) return res.json([]);
    const { data, error } = await supabase.from('events').select('*').order('date', { ascending: true });
    res.json(data || []);
});

app.post('/api/admin/events', async (req, res) => {
    if (!isSupabaseReady()) return res.status(503).json({ error: "Service unavailable: Database not connected." });
    const { data, error } = await supabase.from('events').insert([req.body]).select();
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, event: data[0] });
});

app.delete('/api/admin/events/:id', async (req, res) => {
    if (!isSupabaseReady()) return res.status(503).json({ error: "Service unavailable: Database not connected." });
    const { error } = await supabase.from('events').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false });
    res.json({ success: true });
});

// Content Update
app.post('/api/admin/content', async (req, res) => {
    if (!isSupabaseReady()) return res.status(503).json({ error: "Service unavailable: Database not connected." });
    const updates = Object.entries(req.body).map(([key, value]) => ({ key, value }));
    const { error } = await supabase.from('site_content').upsert(updates);
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true });
});

// About Page Update
app.post('/api/admin/about', async (req, res) => {
    if (!isSupabaseReady()) return res.status(503).json({ error: "Service unavailable: Database not connected." });
    const { data: existing } = await supabase.from('about_page').select('id').limit(1);

    const payload = {
        mission: req.body.mission,
        mission_extended: req.body.missionExtended,
        gallery: req.body.gallery
    };

    if (existing && existing.length > 0) {
        const { error } = await supabase.from('about_page').update(payload).eq('id', existing[0].id);
        if (error) return res.status(400).json({ success: false, message: error.message });
    } else {
        const { error } = await supabase.from('about_page').insert([payload]);
        if (error) return res.status(400).json({ success: false, message: error.message });
    }
    res.json({ success: true });
});

// Gallery Image Upload - Note: Local storage will not persist on Vercel
app.post('/api/admin/gallery-upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    const imageUrl = isVercel ? "#" : `/uploads/${req.file.filename}`;
    if (isVercel) {
        return res.status(400).json({ success: false, message: "Local file uploads are not supported on Vercel. Please use Supabase Storage." });
    }
    res.json({ success: true, imageUrl });
});

// --- FACEBOOK INTEGRATION ---
app.get('/api/social/facebook', async (req, res) => {
    const pageId = process.env.FACEBOOK_PAGE_ID;
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

    if (!pageId || !accessToken || pageId === 'your_page_id_here') {
        return res.status(500).json({ error: 'Facebook credentials not configured' });
    }

    try {
        const url = `https://graph.facebook.com/v18.0/${pageId}/posts?fields=id,message,created_time,full_picture,permalink_url&access_token=${accessToken}&limit=3`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) throw new Error(data.error.message);
        res.json(data.data || []);
    } catch (error) {
        console.error('Facebook API Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch Facebook posts' });
    }
});

// Export the app for Vercel
module.exports = app;

if (!isVercel) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT} with Supabase`);
    });
}
