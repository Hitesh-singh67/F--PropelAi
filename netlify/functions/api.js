const fs = require('fs');
const path = require('path');

// Load config
let config = {
  googleSheetWebhookUrl: "",
  googleSheetWebhookUrlQueries: ""
};

try {
  // Load from environment variables first
  config.googleSheetWebhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL || "";
  config.googleSheetWebhookUrlQueries = process.env.GOOGLE_SHEET_WEBHOOK_URL_QUERIES || "";

  // Fallback to backend/config.json via require (inlined by Netlify esbuild at bundle-time)
  const fileConfig = require('../../backend/config.json');
  if (!config.googleSheetWebhookUrl) {
    config.googleSheetWebhookUrl = fileConfig.googleSheetWebhookUrl || "";
  }
  if (!config.googleSheetWebhookUrlQueries) {
    config.googleSheetWebhookUrlQueries = fileConfig.googleSheetWebhookUrlQueries || "";
  }
} catch (e) {
  console.warn("Failed to load config.json via require:", e.message);
}

exports.handler = async (event, context) => {
  // Normalize path to match routes (e.g. /api/waitlist -> /waitlist)
  const pathPart = event.path.replace(/^\/\.netlify\/functions\/api/, '').replace(/^\/api/, '');
  const method = event.httpMethod;

  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // 1. POST /api/waitlist
    if (pathPart === '/waitlist' && method === 'POST') {
      const { email } = JSON.parse(event.body || '{}');
      if (!email || !email.includes('@')) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid email address.' })
        };
      }

      const timestamp = new Date().toISOString();

      // Forward waitlist entry to Google Sheet Web App if configured
      if (config.googleSheetWebhookUrl) {
        try {
          const sheetRes = await fetch(config.googleSheetWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email,
              timestamp: timestamp
            })
          });
          if (!sheetRes.ok) {
            const errText = await sheetRes.text();
            console.error(`Google Sheet returned error status ${sheetRes.status}:`, errText);
          }
        } catch (err) {
          console.error("Failed to forward to Google Sheet Web App Webhook:", err);
        }
      } else {
        console.warn("Google Sheet Webhook URL not configured for waitlist.");
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Successfully joined waitlist!' })
      };
    }

    // 2. POST /api/connect-founders
    if (pathPart === '/connect-founders' && method === 'POST') {
      const { name, email, message } = JSON.parse(event.body || '{}');
      if (!name || !email || !message) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Name, email, and message are required.' })
        };
      }
      if (!email.includes('@')) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid email address.' })
        };
      }

      const timestamp = new Date().toISOString();

      // Forward query to founders Google Sheet Web App if configured
      if (config.googleSheetWebhookUrlQueries) {
        try {
          const sheetRes = await fetch(config.googleSheetWebhookUrlQueries, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: name,
              email: email,
              message: message,
              timestamp: timestamp
            })
          });
          if (!sheetRes.ok) {
            const errText = await sheetRes.text();
            console.error(`Google Sheet Queries returned error status ${sheetRes.status}:`, errText);
          }
        } catch (err) {
          console.error("Failed to forward query to Google Sheet Web App Webhook:", err);
        }
      } else {
        console.warn("Founder query received but googleSheetWebhookUrlQueries is not configured.");
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Message successfully sent to founders!' })
      };
    }

    // 3. GET /api/score
    if (pathPart === '/score' && method === 'GET') {
      const sector = (event.queryStringParameters && event.queryStringParameters.sector) || 'default';
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

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: '200 OK',
          target: sector,
          score: Number(score),
          yield: yieldRate,
          rating: rating
        })
      };
    }

    // 4. GET /api/system-status
    if (pathPart === '/system-status' && method === 'GET') {
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
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: randomLog })
      };
    }

    // 5. GET /api/builder-ledger
    if (pathPart === '/builder-ledger' && method === 'GET') {
      const projects = ["Trump Towers", "Godrej Zenith", "M3M Capital", "DLF The Aralias", "Emaar Palm Drive", "IREO Skyon", "Pioneer Park"];
      const leadTypes = ["Appreciation Score query", "Yield telemetry scan", "GIS coordination check", "Smart Contract sync", "Investor KYC verification"];
      
      const hash = '0x' + Math.random().toString(16).substring(2, 8).toUpperCase();
      const project = projects[Math.floor(Math.random() * projects.length)];
      const leadType = leadTypes[Math.floor(Math.random() * leadTypes.length)];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          hash: hash,
          project: project,
          leadType: leadType
        })
      };
    }

    // 6. GET /api/news
    if (pathPart === '/news' && method === 'GET') {
      const response = await fetch('https://news.google.com/rss/search?q=real+estate+india&hl=en-IN&gl=IN&ceid=IN:en');
      if (!response.ok) {
        return {
          statusCode: 502,
          headers,
          body: JSON.stringify({ error: 'Failed to retrieve news from Google News.' })
        };
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
          } catch (e) {}

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

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: '200 OK', news: items.slice(0, 3) })
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Route not found' })
    };
  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error.' })
    };
  }
};
