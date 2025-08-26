// server.js - Combined Enhanced Email Analysis + Login + iFrame Navigation with NPR Dashboard Proxy

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const OpenAI = require('openai');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();
const { query } = require('./DbConnection');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'nra-portal-secret-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Simple user store (in production, use a database)
// Add your users here with username: password format
const users = {
    'admin': 'password',      // Change this password!
    'user': 'user123',        // Change this password!
    'president': 'nra2024',   // Example: President's account
    'vp': 'secure456',        // Example: VP account
    'director': 'dir789',     // Example: Director account
    'member': 'member2024',   // Example: Member account
    'ChairmanBB': 'HaveGunWillTravel!' // Chairman's account
};

// Helper function to extract text from HTML
function extractTextFromHTML(html) {
    let text = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

    return text;
}

// Load the enhanced email data
let emailData = null;
try {
    const fs = require('fs');

    if (fs.existsSync('./enhanced_email_analysis.json')) {
        const enhancedData = fs.readFileSync('./enhanced_email_analysis.json', 'utf8');
        emailData = JSON.parse(enhancedData);
        console.log('✅ Loaded enhanced email analysis data');
    } else {
        console.log('⚠️  Enhanced data not found, loading original data');
        emailData = require('./LiveEmailData');
    }
} catch (error) {
    console.error('Error loading email data:', error);
    emailData = { emails: [], summary: {} };
}

// Login page HTML
const loginPage = `
<!DOCTYPE html>
<html>
<head>
    <title>President's Portal Login</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background-image: linear-gradient(135deg, #1a1a2e 0%, #2d2d44 100%);
        }
        
        .login-container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            width: 400px;
            text-align: center;
        }
        
        .logo {
            font-size: 48px;
            color: #c41e3a;
            margin-bottom: 10px;
        }
        
        h2 {
            color: #333;
            margin-bottom: 30px;
            font-size: 24px;
        }
        
        .input-group {
            position: relative;
            margin-bottom: 20px;
            text-align: left;
        }
        
        .input-group i {
            position: absolute;
            left: 15px;
            top: 50%;
            transform: translateY(-50%);
            color: #666;
        }
        
        input {
            width: 100%;
            padding: 12px 12px 12px 45px;
            border: 2px solid #e0e0e0;
            border-radius: 5px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        
        input:focus {
            outline: none;
            border-color: #c41e3a;
        }
        
        button {
            width: 100%;
            padding: 12px;
            background: #c41e3a;
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.3s;
        }
        
        button:hover {
            background: #a01729;
        }
        
        .error {
            color: #d32f2f;
            margin-top: 15px;
            padding: 10px;
            background: #ffebee;
            border-radius: 5px;
            font-size: 14px;
        }
        
        .footer {
            margin-top: 20px;
            color: #666;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <i class="fas fa-bullseye logo"></i>
        <h2>President's Portal Login</h2>
        <form action="/login" method="POST">
            <div class="input-group">
                <i class="fas fa-user"></i>
                <input type="text" name="username" placeholder="Username" required autofocus>
            </div>
            <div class="input-group">
                <i class="fas fa-lock"></i>
                <input type="password" name="password" placeholder="Password" required>
            </div>
            <button type="submit">Sign In</button>
        </form>
        {{ERROR}}
        <div class="footer">
            Secure Member Portal
        </div>
    </div>
</body>
</html>
`;

// Dashboard/Portal page with iframes
const portalPage = `
<!DOCTYPE html>
<html>
<head>
    <title>President's Portal Dashboard</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        .header {
            background: #2c2c2c;
            color: white;
            padding: 0 20px;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        .logo-section {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .logo {
            font-size: 28px;
            color: #c41e3a;
        }
        
        .nav-menu {
            display: flex;
            gap: 5px;
            flex: 1;
            margin-left: 40px;
        }
        
        .nav-item {
            padding: 10px 20px;
            background: none;
            color: #ccc;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s;
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .nav-item:hover {
            background: #3c3c3c;
            color: white;
        }
        
        .nav-item.active {
            background: #c41e3a;
            color: white;
        }
        
        .user-section {
            display: flex;
            align-items: center;
            gap: 20px;
        }
        
        .username {
            font-size: 14px;
            color: #ccc;
        }
        
        .logout-btn {
            padding: 8px 16px;
            background: #c41e3a;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            text-decoration: none;
            transition: background 0.3s;
        }
        
        .logout-btn:hover {
            background: #a01729;
        }
        
        .content {
            flex: 1;
            position: relative;
            overflow: hidden;
        }
        
        iframe {
            width: 100%;
            height: 100%;
            border: none;
            display: none;
        }
        
        iframe.active {
            display: block;
        }
        
        .welcome-screen {
            padding: 40px;
            text-align: center;
            display: none;
        }
        
        .welcome-screen.active {
            display: block;
        }
        
        .welcome-screen h1 {
            color: #333;
            margin-bottom: 20px;
        }
        
        .welcome-screen p {
            color: #666;
            font-size: 18px;
            line-height: 1.6;
            max-width: 600px;
            margin: 0 auto;
        }
        
        .app-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 40px;
            max-width: 1000px;
            margin-left: auto;
            margin-right: auto;
        }
        
        .app-card {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            cursor: pointer;
            transition: transform 0.3s, box-shadow 0.3s;
            text-align: center;
        }
        
        .app-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 5px 20px rgba(0,0,0,0.15);
        }
        
        .app-card i {
            font-size: 48px;
            color: #c41e3a;
            margin-bottom: 15px;
        }
        
        .app-card h3 {
            color: #333;
            margin-bottom: 10px;
        }
        
        .app-card p {
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo-section">
            <i class="fas fa-bullseye logo"></i>
            <h1 style="font-size: 20px; font-weight: 600;">President's Portal</h1>
        </div>
        
        <nav class="nav-menu">
            <button class="nav-item active" onclick="showApp('home')">
                <i class="fas fa-home"></i> Home
            </button>
            <button class="nav-item" onclick="showApp('emails')">
                <i class="fas fa-envelope"></i> Email Analytics
            </button>
            <button class="nav-item" onclick="showApp('anythingllm')">
                <i class="fas fa-robot"></i> AnythingLLM
            </button>
            <button class="nav-item" onclick="showApp('analytics')">
                <i class="fas fa-chart-line"></i> Analytics
            </button>
            <button class="nav-item" onclick="showApp('members')">
                <i class="fas fa-users"></i> Members
            </button>
        </nav>
        
        <div class="user-section">
            <span class="username">
                <i class="fas fa-user-circle"></i> {{USERNAME}}
            </span>
            <a href="/logout" class="logout-btn">
                <i class="fas fa-sign-out-alt"></i> Logout
            </a>
        </div>
    </div>
    
    <div class="content">
        <div id="home" class="welcome-screen active">
            <h1>Welcome to the President's Portal</h1>
            <p>Select an application from the menu above or click on one of the cards below to get started.</p>
            
            <div class="app-grid">
                <div class="app-card" onclick="showApp('emails')">
                    <i class="fas fa-envelope"></i>
                    <h3>Email Analytics</h3>
                    <p>AI-powered email analysis and insights</p>
                </div>
                <div class="app-card" onclick="showApp('anythingllm')">
                    <i class="fas fa-robot"></i>
                    <h3>AnythingLLM</h3>
                    <p>AI assistant and document analysis</p>
                </div>
                <div class="app-card" onclick="showApp('analytics')">
                    <i class="fas fa-chart-line"></i>
                    <h3>Analytics Dashboard</h3>
                    <p>Data visualization and reports</p>
                </div>
                <div class="app-card" onclick="showApp('members')">
                    <i class="fas fa-users"></i>
                    <h3>Member Management</h3>
                    <p>Member database and communications</p>
                </div>
            </div>
        </div>
        
        <iframe id="emails" src="/index.html"></iframe>
        <iframe id="anythingllm" 
                src="{{ANYTHINGLLM_URL}}"
                frameborder="0"
                style="width: 100%; height: 100%; border: none;"
                allow="clipboard-write; microphone">
        </iframe>
        <iframe id="analytics" src="/npr-dashboard"></iframe>
        <iframe id="members" src="/members"></iframe>
    </div>
    
    <script>
        function showApp(appId) {
            // Hide all content
            document.querySelectorAll('iframe, .welcome-screen').forEach(el => {
                el.classList.remove('active');
            });
            
            // Remove active class from all nav items
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // Show selected app
            document.getElementById(appId).classList.add('active');
            
            // Set active nav item
            event.currentTarget.classList.add('active');
        }
    </script>
</body>
</html>
`;

// Auth middleware
function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Add proxy for npr-dashboard using public URL
const nprDashboardUrl = process.env.NPR_DASHBOARD_URL || 'https://npr-dashboard-production.up.railway.app';
console.log('🔧 NPR Dashboard Proxy Target (Public URL):', nprDashboardUrl);

app.use('/npr-dashboard', requireAuth, createProxyMiddleware({
    target: nprDashboardUrl,
    changeOrigin: true,
    secure: true, // For HTTPS
    pathRewrite: {
        '^/npr-dashboard': '', // Remove /npr-dashboard prefix when forwarding
    },
    headers: {
        'X-Forwarded-Host': 'nra-portal-final.up.railway.app', // Your portal's domain
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`Proxying to: ${nprDashboardUrl}${proxyReq.path}`);
    },
    onError: (err, req, res) => {
        console.error('NPR Dashboard proxy error:', err);
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Dashboard Error</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        background: #f5f5f5;
                    }
                    .error {
                        text-align: center;
                        color: #666;
                        padding: 40px;
                        background: white;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .error h1 {
                        color: #c41e3a;
                        margin-bottom: 20px;
                    }
                    .error p {
                        margin-bottom: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="error">
                    <h1>Dashboard Connection Error</h1>
                    <p>Unable to connect to the NPR Dashboard.</p>
                    <p>Please try again later or contact support.</p>
                </div>
            </body>
            </html>
        `);
    }
}));

// Authentication Routes
app.get('/login', (req, res) => {
    res.send(loginPage.replace('{{ERROR}}', ''));
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (users[username] && users[username] === password) {
        req.session.authenticated = true;
        req.session.username = username;
        res.redirect('/portal');
    } else {
        const errorMsg = '<div class="error"><i class="fas fa-exclamation-circle"></i> Invalid username or password</div>';
        res.send(loginPage.replace('{{ERROR}}', errorMsg));
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Main portal page
app.get('/portal', requireAuth, (req, res) => {
    let html = portalPage.replace('{{USERNAME}}', req.session.username);
    const anythingLLMUrl = process.env.ANYTHINGLLM_URL || 'https://your-anythingllm-instance.com/embed';
    html = html.replace('{{ANYTHINGLLM_URL}}', anythingLLMUrl);
    res.send(html);
});

// Redirect root to portal
app.get('/', (req, res) => {
    res.redirect('/portal');
});

// Placeholder for members page
app.get('/members', requireAuth, (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Members</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: #f5f5f5;
                }
                .placeholder {
                    text-align: center;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="placeholder">
                <h1>Members Section</h1>
                <p>This section is under development</p>
            </div>
        </body>
        </html>
    `);
});

// Serve static files only for authenticated users
app.use('/public', requireAuth, express.static('public'));
app.use('/index.html', requireAuth, express.static('public/index.html'));
app.use('/roi.html', requireAuth, express.static('public/roi.html'));
app.use('/Dashboard1.html', requireAuth, express.static('public/Dashboard1.html'));

// API Routes (protected)
app.get('/api/emails', requireAuth, (req, res) => {
    if (emailData.emails) {
        res.json({
            emails: emailData.emails,
            summary: emailData.summary
        });
    } else {
        res.status(500).json({ error: 'Email data not loaded' });
    }
});

app.get('/api/stats', requireAuth, (req, res) => {
    if (emailData.summary) {
        const summary = emailData.summary;
        res.json({
            total: summary.overview?.total_analyzed || summary.statistics?.total_emails || 0,
            analyzed: summary.overview?.total_analyzed || summary.statistics?.analyzed || 0,
            failed: summary.statistics?.failed || 0,
            avgPriorityScore: summary.overview?.average_priority || summary.statistics?.avg_priority_score || 0,
            emailsRequiringAction: summary.overview?.requiring_response || summary.statistics?.emails_requiring_action || 0,
            sentiments: summary.distributions?.by_sentiment || summary.distributions?.sentiment || {},
            urgency: summary.distributions?.by_priority || summary.distributions?.urgency || {},
            topics: summary.distributions?.by_topic || summary.distributions?.topics || {},
            senderAnalysis: summary.sender_analysis || {},
            highPriorityItems: summary.high_impact_items || summary.high_priority_items || [],
            aiInsights: summary.ai_insights || {
                executive_summary: "AI insights not available",
                key_points: [],
                risks: [],
                opportunities: [],
                stakeholders: []
            }
        });
    } else {
        res.status(500).json({ error: 'Summary data not available' });
    }
});

app.get('/api/quick-views', requireAuth, (req, res) => {
    if (emailData.quick_views) {
        res.json(emailData.quick_views);
    } else {
        res.json({
            fires_to_put_out: [],
            quick_wins: [],
            retention_risks: [],
            positive_testimonials: [],
            needs_response_today: [],
            vip_communications: []
        });
    }
});

app.get('/api/emails/priority/:level', requireAuth, (req, res) => {
    const level = req.params.level;
    let filtered = [];

    if (level === 'high') {
        filtered = emailData.emails.filter(e =>
            e.analysis && e.analysis.priority_score >= 7
        );
    } else if (level === 'medium') {
        filtered = emailData.emails.filter(e =>
            e.analysis && e.analysis.priority_score >= 5 && e.analysis.priority_score < 7
        );
    } else if (level === 'low') {
        filtered = emailData.emails.filter(e =>
            e.analysis && e.analysis.priority_score < 5
        );
    }

    res.json({ emails: filtered });
});

app.get('/api/emails/sentiment/:sentiment', requireAuth, (req, res) => {
    const sentiment = req.params.sentiment;
    const filtered = emailData.emails.filter(e => {
        if (!e.analysis) return false;
        if (e.analysis.sentiment_category === sentiment) return true;
        const aiSentiment = e.analysis.sentiment?.ai_analysis?.overall_sentiment;
        const classification = e.analysis.sentiment?.classification;
        return aiSentiment === sentiment || classification === sentiment;
    });

    res.json({ emails: filtered });
});

app.get('/api/emails/response/:type', requireAuth, (req, res) => {
    const type = req.params.type;
    const filtered = emailData.emails.filter(e =>
        e.analysis && e.analysis.response_required === type
    );

    res.json({ emails: filtered });
});

app.get('/api/emails/topic/:category', requireAuth, (req, res) => {
    const category = req.params.category;
    const filtered = emailData.emails.filter(e =>
        e.analysis && e.analysis.topic_category === category
    );

    res.json({ emails: filtered });
});

app.get('/api/senders/:email', requireAuth, (req, res) => {
    const senderEmail = decodeURIComponent(req.params.email);
    if (emailData.summary && emailData.summary.sender_analysis && emailData.summary.sender_analysis[senderEmail]) {
        res.json(emailData.summary.sender_analysis[senderEmail]);
    } else {
        res.status(404).json({ error: 'Sender not found' });
    }
});

app.post('/api/chat', requireAuth, async (req, res) => {
    try {
        const { message } = req.body;

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({
                error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your .env file.'
            });
        }

        const highPriorityEmails = emailData.emails
            .filter(e => e.analysis && e.analysis.priority_score >= 7)
            .map(e => ({
                subject: e.subject,
                sender: e.sender,
                priority: e.analysis.priority_score,
                sentiment: e.analysis.sentiment_category,
                response_required: e.analysis.response_required,
                summary: e.analysis.summary
            }));

        const distributions = emailData.summary?.distributions || {};

        const emailContext = `You are analyzing emails from NRA members with enhanced AI analysis.
        
        Summary Statistics:
        - Total emails: ${emailData.summary?.overview?.total_analyzed || 0}
        - Average priority score: ${emailData.summary?.overview?.average_priority || 0}
        - Emails requiring response: ${emailData.summary?.overview?.requiring_response || 0}
        
        Sentiment Distribution:
        ${Object.entries(distributions.by_sentiment || {})
                .map(([sentiment, count]) => `- ${sentiment}: ${count}`)
                .join('\n')}
        
        Priority Distribution:
        ${Object.entries(distributions.by_priority || {})
                .map(([priority, count]) => `- ${priority}: ${count}`)
                .join('\n')}
        
        Topic Categories:
        ${Object.entries(distributions.by_topic || {})
                .map(([topic, count]) => `- ${topic}: ${count}`)
                .join('\n')}
        
        High Priority Emails (7+):
        ${highPriorityEmails.map(e =>
                    `- "${e.subject}" from ${e.sender} (Priority: ${e.priority.toFixed(1)}, ${e.sentiment}, Response: ${e.response_required}) - ${e.summary}`
                ).join('\n')}
        
        Quick Views Summary:
        - Fires to Put Out: ${emailData.quick_views?.fires_to_put_out?.length || 0} critical issues
        - Quick Wins: ${emailData.quick_views?.quick_wins?.length || 0} easy responses
        - Retention Risks: ${emailData.quick_views?.retention_risks?.length || 0} cancellation threats
        - Positive Testimonials: ${emailData.quick_views?.positive_testimonials?.length || 0} success stories
        
        Please provide helpful, specific analysis based on this enhanced analysis when answering questions.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: emailContext
                },
                {
                    role: "user",
                    content: message
                }
            ],
            temperature: 0.7,
            max_tokens: 500
        });

        res.json({
            response: completion.choices[0].message.content
        });

    } catch (error) {
        console.error('OpenAI API Error:', error);
        res.status(500).json({
            error: 'Failed to get AI response. Please check your OpenAI API key.'
        });
    }
});

app.get('/api/action-items', requireAuth, (req, res) => {
    const actionItems = [];

    emailData.emails.forEach(email => {
        if (email.analysis && email.analysis.action_items && email.analysis.action_items.length > 0) {
            email.analysis.action_items.forEach(item => {
                actionItems.push({
                    emailSubject: email.subject,
                    emailSender: email.sender,
                    emailId: email.id || emailData.emails.indexOf(email),
                    action: item.action,
                    priority: item.priority,
                    type: item.type || 'general',
                    deadline: email.analysis.response_deadline || item.deadline
                });
            });
        }
    });

    actionItems.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return 0;
    });

    res.json({ actionItems });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        openai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured',
        dataLoaded: emailData ? 'yes' : 'no',
        emailCount: emailData?.emails?.length || 0,
        enhancedAnalysis: emailData?.emails?.[0]?.analysis?.sentiment_category ? 'yes' : 'no',
        nprDashboard: process.env.NPR_DASHBOARD_URL || 'using internal URL'
    });
});

app.post('/api/ai/reply', requireAuth, async (req, res) => {
    try {
        const { originalEmail, tone = 'professional' } = req.body;

        if (!originalEmail) {
            return res.json({ success: false, error: 'Original email data is required' });
        }

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({
                error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your .env file.'
            });
        }

        // Extract sender name from email address
        function extractNameFromEmail(email) {
            const username = email.split('@')[0];
            return username
                .replace(/[._-]/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        }

        // Extract relevant context from the original email
        const emailContext = {
            subject: originalEmail.subject,
            sender: originalEmail.sender,
            senderName: extractNameFromEmail(originalEmail.sender),
            content: originalEmail.clean_text || originalEmail.body,
            sentiment: originalEmail.analysis?.sentiment_category,
            priority: originalEmail.analysis?.priority_score,
            issues: originalEmail.analysis?.specific_topics || [],
            actionItems: originalEmail.analysis?.action_items || [],
            summary: originalEmail.analysis?.summary
        };

        const systemPrompt = `You are Bill Bachenberg, President of the NRA, responding to member communications. 
        
        Create a professional, ${tone} email reply that:
        - Addresses the sender by their name: ${emailContext.senderName}
        - Acknowledges their specific concerns or points raised
        - Provides a thoughtful, constructive response
        - Maintains a ${tone} but respectful tone
        - Shows appreciation for their membership and feedback
        - Includes appropriate professional closing
        - Is suitable for NRA leadership communication
        
        Original Email Details:
        - From: ${emailContext.senderName} (${emailContext.sender})
        - Subject: ${emailContext.subject}
        - Sentiment: ${emailContext.sentiment || 'neutral'}
        - Priority Level: ${emailContext.priority || 'standard'}
        - Key Issues: ${emailContext.issues.length > 0 ? emailContext.issues.join(', ') : 'general communication'}
        - Summary: ${emailContext.summary || 'Member communication'}
        
        Email Content Preview: ${emailContext.content ? emailContext.content.substring(0, 400) + '...' : 'Content not available'}
        
        Generate a complete, professional email reply that directly addresses their message.
        
        Return the output in the following JSON format:
        {
        "subject": <string, the subject of the reply>,
        "body": <string, the full body text of the reply>,
        "to": <string, the recipient's name and email>,
        "from": <string, the sender information (Bill Bachenberg, President, NRA)>,
        "closing": <string, professional closing statement>
        }`;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: `Generate a reply to this email from ${emailContext.senderName}. Their main concerns appear to be: ${emailContext.issues.length > 0 ? emailContext.issues.join(', ') : 'general feedback and communication'}.`
                }
            ],
            temperature: 0.7,
            max_tokens: 600,
            response_format: { type: "json_object" }
        });

        const generatedReply = completion.choices[0].message.content;

        res.json({
            success: true,
            reply: generatedReply,
            context: emailContext
        });

    } catch (error) {
        console.error('AI Reply Generation Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate AI reply. Please try again.'
        });
    }
});

app.post('/api/ai/compose', async (req, res) => {
    try {
        const { prompt, tone } = req.body;

        if (!prompt) {
            return res.json({ success: false, error: 'Prompt is required' });
        }

        // const systemPrompt = `You are an AI assistant helping to compose professional emails for the NRA leadership. 
        // Create a well-structured, ${tone} email based on the user's request. 
        // Keep it appropriate for organizational communications and maintain a professional tone while being ${tone}.
        // Format the email with proper greeting, body, and closing.

        // Guidelines:
        // - Use appropriate salutation (Dear [Name] or Dear Members)
        // - Create clear, well-organized paragraphs
        // - Include a professional closing
        // - Keep the tone ${tone} but always professional
        // - Make it suitable for organizational leadership communication

        // Output Format:
        // - Response should always be in valid JSON object format with the following fields:
        // - Subject: [Subject Line]
        // - Body: [Email Body]
        // - Closing: [Closing Line]
        // - Tone: [Tone of the email]
        // - Response Required: [Yes or No]
        // - Priority Score: [Priority Score]
        // - Sentiment: [Sentiment of the email]
        // - Topic: [Topic of the email]
        // - Sender: [Sender of the email]
        // - Recipient: [Recipient of the email]
        // - Date: [Date of the email]
        // - Time: [Time of the email]
        // - Example:
        // {
        //     "subject": "Subject Line",
        //     "body": "Email Body",
        //     "closing": "Closing Line",
        //     "tone": "Tone of the email",
        //     "responseRequired": "Yes or No",
        //     "priorityScore": "Priority Score",
        //     "sentiment": "Sentiment of the email",
        //     "topic": "Topic of the email",
        //     "sender": "Sender of the email",
        //     "recipient": "Recipient of the email",
        //     "date": "Date of the email",
        //     "time": "Time of the email"
        // }
        // - Example:
        // {
        //     "subject": "Subject Line",
        //     "body": "Email Body",
        //     "closing": "Closing Line",
        //     "tone": "Tone of the email",
        //     "responseRequired": "Yes or No",
        //     "priorityScore": "Priority Score",
        //     "sentiment": "Sentiment of the email",
        //     "topic": "Topic of the email",
        //     "sender": "Sender of the email",
        //     "recipient": "Recipient of the email",
        //     "date": "Date of the email",
        //     "time": "Time of the email"
        // }
        // - Example:
        // {
        //     "subject": "Subject Line",
        //     "body": "Email Body",
        //     "closing": "Closing Line",
        //     "tone": "Tone of the email",
        //     "responseRequired": "Yes or No",
        //     "priorityScore": "Priority Score",
        //     "sentiment": "Sentiment of the email",
        //     "topic": "Topic of the email",
        //     "sender": "Sender of the email",
        //     "recipient": "Recipient of the email",
        //     "date": "Date of the email",
        //     "time": "Time of the email"
        // }
        // - Example:
        // {
        //     "subject": "Subject Line",
        //     "body": "Email Body",
        //     "closing": "Closing Line",
        //     "tone": "Tone of the email",
        //     "responseRequired": "Yes or No",
        //     "priorityScore": "Priority Score",
        //     "sentiment": "Sentiment of the email",
        //     "topic": "Topic of the email",
        //     "sender": "Sender of the email",
        //     "recipient": "Recipient of the email",
        //     "date": "Date of the email",
        //     "time": "Time of the email"
        // }
        // `;

        const systemPrompt = `
                                Developer: You are an AI assistant tasked with composing professional emails for NRA leadership.

                                Begin with a concise checklist (3-7 bullets) of your intended actions before generating the output.

                                # Objective
                                - Generate well-structured organizational emails with a tone matching the provided ${tone} variable, or default to "professional" if missing or invalid.

                                # Instructions
                                - Always begin with an appropriate salutation, such as "Dear [Name]" or "Dear Members".
                                - Construct the email body using clear, concise, and logically-organized paragraphs.
                                - Conclude with a professional closing.
                                - Ensure all content meets standards for professionalism and appropriateness for leadership and organizational communication.
                                - Respect the user's requested tone (${tone}); fallback to "professional" if the input is missing or malformed.
                                - If information for any required output field is not provided, leave that field blank using the placeholder format [Your Field Name], e.g., [Your Name].

                                # Output Format
                                - Your response must be a valid JSON object containing these fields in the specified order:
                                - subject: string (subject line of the email)
                                - body: string (full email body)
                                - closing: string (professional closing line)
                                - tone: string (one of [professional, formal, friendly, persuasive, urgent, informational])
                                - responseRequired: string (exactly "Yes" or "No")
                                - priorityScore: integer (between 1 and 5, inclusive)
                                - sentiment: string ([positive, neutral, negative])
                                - topic: string (main topic summary)
                                - sender: string (name or title of sender)
                                - recipient: string (name(s) or title of recipient(s))
                                - date: string (ISO 8601, YYYY-MM-DD)
                                - time: string (24-hour, HH:MM)

                                Include an # Output Format section specifying exact fields and types. Ensure your output is a valid JSON object matching this format and using exhaustive, descriptive field values. If information for any required field is not provided, leave that field blank in the format [Your Field Name].

                                # Verbosity
                                - Email content should be clear and concise.
                                - Output JSON must use high verbosity: descriptive field names, full information per field.

                                # Stop Condition
                                - Complete and return only when all required JSON output fields are populated as specified (use placeholders [Your Field Name] as needed if information is missing).
                            `;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            max_tokens: 500,
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const draft = completion.choices[0].message.content;

        res.json({
            success: true,
            draft: draft
        });

    } catch (error) {
        console.error('AI Compose Error:', error);
        res.json({
            success: false,
            error: 'Failed to generate email draft. Please check your OpenAI API key configuration.'
        });
    }
});

// AI Queue API
app.get('/api/ai/queue', requireAuth, async (req, res) => {
    try {
        // TODO:
        // 1. Fetch the queue items from the database
        const userId = req.session.username;
        const { status, type, limit = 50, offset = 0 } = req.query;

        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        let whereConditions = ['user_id = $1'];
        let queryParams = [userId];
        let paramCount = 1;

        if (status) {
            paramCount++;
            whereConditions.push(`status = $${paramCount}`);
            queryParams.push(status);
        }

        if (type) {
            paramCount++;
            whereConditions.push(`type = $${paramCount}`);
            queryParams.push(type);
        }

        const selectQuery = `
        SELECT 
            id, type, content, original_email, metadata, status, 
            timestamp, user_id, priority, created_at, updated_at
        FROM ai_queue
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY timestamp DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

        queryParams.push(parseInt(limit), parseInt(offset));

        const result = await query(selectQuery, queryParams);

        // 2. Return the queue items
        res.json({
            success: true,
            queue: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching AI queue:', error);
        res.status(500).json({ error: 'Failed to fetch queue items' });
    }
});

app.post('/api/ai/queue/add', requireAuth, async (req, res) => {
    try {
        const { type, content, originalEmail, metadata } = req.body;
        // TODO:
        // 1. Save the queue item to the database
        const queueItem = {
            id: Date.now() + Math.random(),
            type: type,
            content: content,
            originalEmail: originalEmail,
            metadata: metadata,
            status: 'ready',
            timestamp: new Date().toISOString(),
            userId: req.session.username
        };

        const insertQuery = `
        INSERT INTO ai_queue (type, content, original_email, metadata, timestamp, user_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `;

        const result = await query(insertQuery, [
            type,
            content,
            originalEmail || null,
            JSON.stringify(metadata || {}),
            new Date().toISOString(),
            req.session.username
        ]);

        // TODO:
        // 2. Send the email via email service

        res.json({
            success: true,
            item: queueItem
        });

    } catch (error) {
        console.error('AI Queue Add Error:', error);
        res.json({
            success: false,
            error: 'Failed to add item to queue'
        });
    }
});

app.post('/api/ai/queue/send/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // TODO:
        // 1. Fetch the queue item from database
        // 2. Send the actual email via email service
        // 3. Remove from queue or mark as sent

        res.json({
            success: true,
            message: 'Email sent successfully'
        });

    } catch (error) {
        console.error('AI Queue Send Error:', error);
        res.json({
            success: false,
            error: 'Failed to send email'
        });
    }
});

app.delete('/api/ai/queue/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // TODO:
        // 1. Remove the queue item from the database

        res.json({
            success: true,
            message: 'Item removed from queue'
        });

    } catch (error) {
        console.error('AI Queue Delete Error:', error);
        res.json({
            success: false,
            error: 'Failed to remove item from queue'
        });
    }
});

// AI Sentence Generation API
app.post('/api/ai/generate-sentence', requireAuth, async (req, res) => {
    try {
        const { 
            action, // 'regenerate', 'expand', 'shorten'
            currentSentence, 
            previousContext = '', 
            currentParagraph = '',
            tone = 'professional',
            emailContext = {}
        } = req.body;

        if (!currentSentence || !action) {
            return res.status(400).json({
                success: false,
                error: 'Current sentence and action are required'
            });
        }

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({
                success: false,
                error: 'OpenAI API key not configured'
            });
        }

        // Build context-aware prompt based on action
        let systemPrompt = '';
        let userPrompt = '';

        const contextInfo = `
Previous Context: ${previousContext || 'None'}
Current Paragraph: ${currentParagraph || currentSentence}
Current Sentence: ${currentSentence}
Email Context: ${emailContext.subject ? `Subject: ${emailContext.subject}, ` : ''}${emailContext.sender ? `From: ${emailContext.sender}, ` : ''}${emailContext.sentiment ? `Sentiment: ${emailContext.sentiment}` : ''}
Tone: ${tone}
`;

        switch (action) {
            case 'regenerate':
                systemPrompt = `You are an AI assistant helping to rewrite sentences for professional email communication. 
                Generate 1 alternative version of the given sentence that:
                - Maintains the same meaning and intent
                - Uses a ${tone} tone
                - Fits naturally with the surrounding context
                - Is appropriate for NRA leadership communication
                - Maintains professional email standards
                
                Return only the rewritten sentence, no additional text or formatting.`;
                
                userPrompt = `Rewrite this sentence while maintaining its meaning:\n\n${contextInfo}`;
                break;

            case 'expand':
                systemPrompt = `You are an AI assistant helping to expand sentences for professional email communication.
                Take the given sentence and expand it with additional relevant detail that:
                - Adds valuable context or explanation
                - Maintains a ${tone} tone
                - Flows naturally with the surrounding content
                - Is appropriate for NRA leadership communication
                - Doesn't change the core meaning
                
                Return only the expanded sentence, no additional text or formatting.`;
                
                userPrompt = `Expand this sentence with relevant additional detail:\n\n${contextInfo}`;
                break;

            case 'shorten':
                systemPrompt = `You are an AI assistant helping to shorten sentences for professional email communication.
                Take the given sentence and make it more concise while:
                - Preserving the essential meaning
                - Maintaining a ${tone} tone
                - Keeping it natural and professional
                - Being appropriate for NRA leadership communication
                - Ensuring it still fits the context
                
                Return only the shortened sentence, no additional text or formatting.`;
                
                userPrompt = `Make this sentence more concise while preserving its meaning:\n\n${contextInfo}`;
                break;

            default:
                return res.status(400).json({
                    success: false,
                    error: 'Invalid action. Must be regenerate, expand, or shorten'
                });
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 200
        });

        const generatedSentence = completion.choices[0].message.content.trim();

        res.json({
            success: true,
            sentence: generatedSentence,
            action: action,
            originalSentence: currentSentence
        });

    } catch (error) {
        console.error('AI Sentence Generation Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate sentence. Please try again.'
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🎯 NRA Portal Server running on http://localhost:${PORT}`);
    console.log(`📊 Portal available at http://localhost:${PORT}/portal`);

    if (!process.env.OPENAI_API_KEY) {
        console.warn('⚠️  Warning: OPENAI_API_KEY not found in environment variables');
        console.warn('   AI chat features will not work without it');
    } else {
        console.log('✅ OpenAI API key configured');
    }

    const dashboardUrl = process.env.NPR_DASHBOARD_URL || 'http://npr-dashboard.railway.internal';
    console.log(`📈 NPR Dashboard proxied from: ${dashboardUrl}`);

    if (emailData && emailData.summary) {
        console.log(`📧 Loaded ${emailData.emails?.length || 0} emails with enhanced AI analysis`);
        console.log(`⚡ Average priority score: ${emailData.summary.overview?.average_priority || 0}`);
        console.log(`🎯 Emails requiring action: ${emailData.summary.overview?.requiring_response || 0}`);
        console.log(`🔥 Critical issues: ${emailData.summary.overview?.critical_issues || 0}`);

        if (emailData.quick_views) {
            console.log('\n📋 Quick Views:');
            console.log(`  🔥 Fires to Put Out: ${emailData.quick_views.fires_to_put_out?.length || 0}`);
            console.log(`  ✅ Quick Wins: ${emailData.quick_views.quick_wins?.length || 0}`);
            console.log(`  ⚠️  Retention Risks: ${emailData.quick_views.retention_risks?.length || 0}`);
            console.log(`  👍 Positive Testimonials: ${emailData.quick_views.positive_testimonials?.length || 0}`);
        }
    }
});