const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
const SUBSCRIBERS_PATH = path.join(__dirname, 'subscribers.json');

// Middleware
app.use(express.json());
// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '..')));

const CONFIG_PATH = path.join(__dirname, 'config.json');

// Initialize subscribers file if not present
if (!fs.existsSync(SUBSCRIBERS_PATH)) {
  fs.writeFileSync(SUBSCRIBERS_PATH, JSON.stringify([], null, 2));
}

// Initialize config file if not present (local fallback)
if (!fs.existsSync(CONFIG_PATH) && !process.env.GOOGLE_SHEET_WEBHOOK_URL && !process.env.GOOGLE_SHEET_WEBHOOK_URL_QUERIES) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ googleSheetWebhookUrl: "", googleSheetWebhookUrlQueries: "" }, null, 2));
}

// Load config, supporting both env variables (production) and config.json (local)
let config = {
  googleSheetWebhookUrl: process.env.GOOGLE_SHEET_WEBHOOK_URL || "",
  googleSheetWebhookUrlQueries: process.env.GOOGLE_SHEET_WEBHOOK_URL_QUERIES || ""
};
try {
  if (fs.existsSync(CONFIG_PATH)) {
    const fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    config.googleSheetWebhookUrl = fileConfig.googleSheetWebhookUrl || config.googleSheetWebhookUrl;
    config.googleSheetWebhookUrlQueries = fileConfig.googleSheetWebhookUrlQueries || config.googleSheetWebhookUrlQueries;
  }
} catch (e) {
  console.error("Failed to load config, using defaults.");
}

/* =========================================================================
   API ENDPOINTS
   ========================================================================= */

// 1. POST /api/waitlist - Register user waitlist emails
app.post('/api/waitlist', (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  try {
    const rawData = fs.readFileSync(SUBSCRIBERS_PATH, 'utf8');
    let subscribers = [];
    try {
      const parsed = JSON.parse(rawData);
      if (Array.isArray(parsed)) {
        subscribers = parsed;
      } else if (parsed && typeof parsed === 'object') {
        subscribers = [parsed];
      }
    } catch (e) {
      console.warn("Subscribers JSON invalid, resetting to empty array.");
    }

    // Check if email already registered (safeguard email existence check)
    const exists = subscribers.some(sub => sub && sub.email && sub.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      return res.status(409).json({ error: 'This email is already registered on the waitlist!' });
    }

    // Add subscriber
    const timestamp = new Date().toISOString();
    subscribers.push({
      email: email,
      timestamp: timestamp
    });

    fs.writeFileSync(SUBSCRIBERS_PATH, JSON.stringify(subscribers, null, 2));

    // Forward waitlist entry to Google Sheet Web App if configured
    if (config.googleSheetWebhookUrl) {
      fetch(config.googleSheetWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          timestamp: timestamp
        })
      })
      .then(async res => {
        if (!res.ok) {
          const errText = await res.text();
          console.error(`Google Sheet Web App Webhook returned error status ${res.status}:`, errText);
        } else {
          console.log("Successfully forwarded waitlist entry to Google Sheet Web App.");
        }
      })
      .catch(err => {
        console.error("Failed to forward to Google Sheet Web App Webhook:", err);
      });
    }

    return res.json({ message: 'Successfully joined waitlist!' });
  } catch (err) {
    console.error('Error writing to subscribers file:', err);
    return res.status(500).json({ error: 'Internal server error saving waitlist.' });
  }
});

// 1b. POST /api/connect-founders - Save inquiries/messages to founders
app.post('/api/connect-founders', (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  try {
    const timestamp = new Date().toISOString();

    // Forward founder query to Google Sheet Web App if configured
    if (config.googleSheetWebhookUrlQueries) {
      fetch(config.googleSheetWebhookUrlQueries, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          email: email,
          message: message,
          timestamp: timestamp
        })
      })
      .then(async res => {
        if (!res.ok) {
          const errText = await res.text();
          console.error(`Google Sheet Web App Webhook (Queries) returned error status ${res.status}:`, errText);
        } else {
          console.log("Successfully forwarded founder query to Google Sheet Web App.");
        }
      })
      .catch(err => {
        console.error("Failed to forward founder query to Google Sheet Web App Webhook:", err);
      });
    } else {
      console.warn("Founder query received but googleSheetWebhookUrlQueries is not configured.");
    }

    return res.json({ message: 'Message successfully sent to founders!' });
  } catch (err) {
    console.error('Error processing founder query:', err);
    return res.status(500).json({ error: 'Internal server error processing inquiry.' });
  }
});

// 2. GET /api/score - Return ratings/scores for Gurugram sectors
app.get('/api/score', (req, res) => {
  const sector = req.query.sector || 'default';
  
  let score, yieldRate, rating;

  switch (sector.toLowerCase()) {
    case 'sector-29':
      score = 88.5;
      yieldRate = '8.20%';
      rating = 'A+ (High Yield)';
      break;
    case 'sector-54':
      score = 92.1;
      yieldRate = '9.42%';
      rating = 'AAA (Institutional)';
      break;
    case 'dwarka-exp':
      score = 85.4;
      yieldRate = '7.85%';
      rating = 'A (Rapid Appreciation)';
      break;
    case 'sohna-road':
      score = 79.2;
      yieldRate = '6.50%';
      rating = 'B+ (Consolidated Residential)';
      break;
    case 'golf-course-ext':
      score = 90.3;
      yieldRate = '8.95%';
      rating = 'AA (Premium Commercial)';
      break;
    default:
      score = (Math.random() * 10 + 75).toFixed(1);
      yieldRate = (Math.random() * 3 + 5).toFixed(2) + '%';
      rating = 'A- (Stable Growth)';
  }

  return res.json({
    status: '200 OK',
    target: sector,
    score: Number(score),
    yield: yieldRate,
    rating: rating
  });
});

// 3. GET /api/system-status - Stream live system logs
app.get('/api/system-status', (req, res) => {
  const logs = [
    "AI valuation core: Synced with Dwarka corridors",
    "Ledger transaction recorded: Heatmap block [HEX: #29AF]",
    "Oracle update: Sector 109 accessibility index rose by 1.8%",
    "Smart contract verified: PropelAI Corridor Vault #011",
    "DLF Phase 5 registry records indexed successfully",
    "TAM telemetry updated: ₹50.2T live tracking active",
    "Machine learning pricing vectors loaded: Sector 54",
    "Regional GIS coordination: Gurugram masterplan sync active",
    "Security nodes update: Geofence boundaries recalculated",
    "Valuation matrix calibrated: Confidence buffer at 98.4%"
  ];

  const randomLog = logs[Math.floor(Math.random() * logs.length)];
  return res.json({ message: randomLog });
});

// 4. GET /api/builder-ledger - Stream dynamic builder ledger logs
app.get('/api/builder-ledger', (req, res) => {
  const projects = ["Trump Towers", "Godrej Zenith", "M3M Capital", "DLF The Aralias", "Emaar Palm Drive", "IREO Skyon", "Pioneer Park"];
  const leadTypes = ["Appreciation Score query", "Yield telemetry scan", "GIS coordination check", "Smart Contract sync", "Investor KYC verification"];
  
  const hash = '0x' + Math.random().toString(16).substring(2, 8).toUpperCase();
  const project = projects[Math.floor(Math.random() * projects.length)];
  const leadType = leadTypes[Math.floor(Math.random() * leadTypes.length)];

  return res.json({
    hash: hash,
    project: project,
    leadType: leadType
  });
});

// 5. GET /api/news - Fetch and parse live Indian Real Estate News from Google News
app.get('/api/news', async (req, res) => {
  try {
    const response = await fetch('https://news.google.com/rss/search?q=real+estate+india&hl=en-IN&gl=IN&ceid=IN:en');
    if (!response.ok) {
      return res.status(502).json({ error: 'Failed to retrieve news from Google News.' });
    }
    const xmlText = await response.text();
    const items = [];
    const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
    
    for (const itemXml of itemMatches) {
      const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
      const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const sourceMatch = itemXml.match(/<source[\s\S]*?>([\s\S]*?)<\/source>/);
      
      if (titleMatch && linkMatch) {
        const rawTitle = titleMatch[1];
        const link = linkMatch[1];
        const pubDateRaw = pubDateMatch ? pubDateMatch[1] : '';
        const source = sourceMatch ? sourceMatch[1] : 'Google News';
        
        // Clean CDATA and XML entities
        const cleanText = (str) => {
          return str
            .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .trim();
        };

        let title = cleanText(rawTitle);
        const sourceSuffix = ` - ${cleanText(source)}`;
        if (title.endsWith(sourceSuffix)) {
          title = title.substring(0, title.length - sourceSuffix.length);
        }

        // Format publication date to a clean readable format (e.g. "May 28, 2026")
        let pubDate = pubDateRaw;
        try {
          if (pubDateRaw) {
            const dateObj = new Date(pubDateRaw);
            if (!isNaN(dateObj.getTime())) {
              pubDate = dateObj.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });
            }
          }
        } catch (e) {
          // Fallback to raw string
        }

        // Categorize based on keywords
        let category = 'trends';
        const titleLower = title.toLowerCase();
        if (
          titleLower.includes('reit') ||
          titleLower.includes('sebi') ||
          titleLower.includes('rbi') ||
          titleLower.includes('bank') ||
          titleLower.includes('invest') ||
          titleLower.includes('finance') ||
          titleLower.includes('policy') ||
          titleLower.includes('regulations') ||
          titleLower.includes('budget') ||
          titleLower.includes('tax')
        ) {
          category = 'policy';
        } else if (
          titleLower.includes('expressway') ||
          titleLower.includes('metro') ||
          titleLower.includes('highway') ||
          titleLower.includes('corridor') ||
          titleLower.includes('airport') ||
          titleLower.includes('infrastructure') ||
          titleLower.includes('flyover') ||
          titleLower.includes('link road') ||
          titleLower.includes('connectivity')
        ) {
          category = 'infrastructure';
        }

        items.push({
          title: title,
          link: link,
          pubDate: pubDate,
          source: cleanText(source),
          category: category
        });
      }
    }

    // Limit to top 3 news items to avoid cluttering the UI
    return res.json({ status: '200 OK', news: items.slice(0, 3) });
  } catch (err) {
    console.error('Error fetching/parsing news feed:', err);
    return res.status(500).json({ error: 'Internal server error processing news feed.' });
  }
});

// Fallback to index.html for any other route
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`PropelAI Backend running at http://127.0.0.1:${PORT}`);
});
