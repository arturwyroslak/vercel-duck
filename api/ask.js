// DuckAI Server for Vercel - Optimized for serverless deployment
// Based on original duckai-server by MyHoldFast
// Adapted for Vercel serverless functions using @sparticuz/chromium

import chromium from '@sparticuz/chromium';
import playwright from 'playwright-core';
import axios from 'axios';

// Configuration constants
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'your_free_gemini_key';
const MODEL_NAME = 'gemini-2.5-flash-preview-05-20';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_CAPTCHA_ATTEMPTS = 2;

// Available AI models
const AVAILABLE_MODELS = [
  'claude-3-5-haiku-latest',
  'mistralai/Mistral-Small-24B-Instruct-2501', 
  'meta-llama/Llama-4-Scout-17B-16E-Instruct',
  'gpt-4o-mini',
  'gpt-5-mini'
];
const DEFAULT_MODEL = 'gpt-5-mini';

// CAPTCHA solving coordinates (based on DuckDuckGo's UI)
const CAPTCHA_CONFIG = {
  VIEW_W: 1920,
  VIEW_H: 1080,
  GRID_START_X: 780,
  GRID_START_Y: 380,
  GRID_STEP_X: 114,
  GRID_STEP_Y: 114,
  GRID_CENTER_OFFSET: 57,
  SUBMIT_X: 960,
  SUBMIT_Y: 735,
  CLICK_DELAY: 250,
  SUBMIT_DELAY: 1500
};

// Global browser instance cache for warm connections
let browserInstance = null;
let lastUsed = Date.now();
const BROWSER_TIMEOUT = 10 * 60 * 1000; // 10 minutes

/**
 * Get or create browser instance with connection pooling
 */
async function getBrowser() {
  // Clean up old browser instances
  if (browserInstance && (Date.now() - lastUsed) > BROWSER_TIMEOUT) {
    try {
      await browserInstance.close();
    } catch (e) {
      console.log('Error closing old browser:', e.message);
    }
    browserInstance = null;
  }

  if (!browserInstance) {
    const executablePath = await chromium.executablePath();
    
    // Convert @sparticuz/chromium headless value to Playwright-compatible boolean
    // @sparticuz/chromium returns 'shell' but Playwright 1.55.0 only accepts boolean
    const headlessMode = chromium.headless === 'shell' || chromium.headless === 'new' || chromium.headless === true || chromium.headless === 'true';
    
    browserInstance = await playwright.chromium.launch({
      args: chromium.args,
      executablePath,
      headless: headlessMode,
    });
  }

  lastUsed = Date.now();
  return browserInstance;
}

/**
 * Configure page with stealth settings and resource blocking
 */
async function configurePage(page) {
  // Block heavy resources to save memory and bandwidth
  await page.route('**/*', (route) => {
    const resourceType = route.request().resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  // Set stealth properties
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
  });

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  await page.setViewport({ width: CAPTCHA_CONFIG.VIEW_W, height: CAPTCHA_CONFIG.VIEW_H });
}

/**
 * Solve CAPTCHA using Gemini Vision API
 */
async function solveCaptchaWithGemini(screenshotBuffer) {
  const url = `${BASE_URL}/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
  const imageBase64 = screenshotBuffer.toString('base64');
  
  const prompt = 'where is the duck/duck on the captcha, give the answer as a 3*3 matrix in json';
  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: 'image/png', data: imageBase64 }}
      ]
    }],
    generationConfig: { responseModalities: ['TEXT'] }
  };

  try {
    const response = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    if (response.status === 200) {
      const candidates = response.data.candidates;
      if (!candidates || candidates.length === 0) {
        return null;
      }

      const textResponse = candidates[0].content.parts[0].text.trim();
      
      // Clean and parse the response
      const clean = textResponse.replace(/^```json\s*|^```\s*|\s*```$/gi, '').trim();
      
      let matrix;
      try {
        const parsed = JSON.parse(clean);
        
        if (Array.isArray(parsed)) {
          matrix = parsed;
        } else if (parsed.matrix) {
          matrix = parsed.matrix;
        } else if (parsed.answer) {
          matrix = parsed.answer;
        } else if (parsed.response) {
          matrix = parsed.response;
        } else {
          // Find first array value
          for (const value of Object.values(parsed)) {
            if (Array.isArray(value) && value.length === 3) {
              matrix = value;
              break;
            }
          }
        }
      } catch (e) {
        // Fallback: extract matrix pattern with regex
        const matrixMatch = clean.match(/\[\s*\[.*?\]\s*,\s*\[.*?\]\s*,\s*\[.*?\]\s*\]/s);
        if (matrixMatch) {
          matrix = JSON.parse(matrixMatch[0]);
        }
      }

      if (matrix && Array.isArray(matrix) && matrix.length === 3) {
        // Convert to integer matrix
        return matrix.map(row => row.map(cell => parseInt(cell)));
      }
    }
  } catch (error) {
    console.log('Gemini API error:', error.message);
  }

  return null;
}

/**
 * Click CAPTCHA tiles based on solution matrix
 */
async function clickCaptcha(page, matrix) {
  try {
    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix[i].length; j++) {
        if (matrix[i][j] === 1) {
          const x = CAPTCHA_CONFIG.GRID_START_X + j * CAPTCHA_CONFIG.GRID_STEP_X + CAPTCHA_CONFIG.GRID_CENTER_OFFSET;
          const y = CAPTCHA_CONFIG.GRID_START_Y + i * CAPTCHA_CONFIG.GRID_STEP_Y + CAPTCHA_CONFIG.GRID_CENTER_OFFSET;
          
          await page.mouse.click(x, y);
          await page.waitForTimeout(CAPTCHA_CONFIG.CLICK_DELAY);
        }
      }
    }

    // Click submit button
    await page.mouse.click(CAPTCHA_CONFIG.SUBMIT_X, CAPTCHA_CONFIG.SUBMIT_Y + 50);
    await page.waitForTimeout(CAPTCHA_CONFIG.SUBMIT_DELAY);
    
    return true;
  } catch (error) {
    console.log('Error clicking captcha:', error.message);
    return false;
  }
}

/**
 * Initialize DuckDuckGo chat page
 */
async function initializeChatPage() {
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await configurePage(page);

  let headers = null;
  page.on('request', (request) => {
    if (request.url().includes('duckduckgo.com/duckchat/v1/chat')) {
      headers = request.headers();
    }
  });

  // Navigate to DuckDuckGo and set up chat
  await page.goto('https://duckduckgo.com', { waitUntil: 'domcontentloaded' });
  
  // Set preferences
  await page.evaluate(() => {
    try {
      localStorage.setItem('duckaiHasAgreedToTerms', 'true');
      localStorage.setItem('preferredDuckaiModel', '"203"');
      localStorage.setItem('isRecentChatsOn', '"1"');
    } catch (e) {}
  });

  await page.goto(
    'https://duckduckgo.com/?q=test&ia=chat&duckai=1',
    { waitUntil: 'domcontentloaded' }
  );

  // Wait for input field
  try {
    await page.waitForSelector('textarea[name="user-prompt"]', { timeout: 10000 });
  } catch {
    await page.waitForSelector('div[contenteditable="true"]', { timeout: 10000 });
  }

  return { page, context, getHeaders: () => headers };
}

/**
 * Refresh API headers by simulating user interaction
 */
async function refreshHeaders(page) {
  try {
    // Try to click "New Chat" button
    const newChatSelectors = [
      'button[type="button"]:has-text("Новый чат")',
      'button[type="button"]:has-text("New Chat")',
      'button[type="button"]:has-text("Start chat")'
    ];

    for (const selector of newChatSelectors) {
      try {
        await page.locator(selector).first().click({ timeout: 3000 });
        break;
      } catch {}
    }
  } catch {}

  // Trigger input field to generate headers
  const inputSelectors = [
    'textarea[name="user-prompt"]',
    'div[contenteditable="true"]'
  ];

  for (const selector of inputSelectors) {
    try {
      const input = await page.waitForSelector(selector, { timeout: 5000 });
      await input.click();
      await input.fill(' ');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      break;
    } catch {}
  }
}

/**
 * Filter headers for API request
 */
function getFilteredHeaders(headers) {
  if (!headers) return {};
  
  const allowedHeaders = [
    'accept', 'content-type', 'origin', 'referer', 'user-agent',
    'x-fe-signals', 'x-fe-version', 'x-vqd-hash-1',
    'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform'
  ];

  return Object.fromEntries(
    Object.entries(headers).filter(([key]) => 
      allowedHeaders.includes(key.toLowerCase())
    )
  );
}

/**
 * Send message to DuckDuckGo API
 */
async function sendMessage(headers, messages, model) {
  const payload = {
    model,
    metadata: {
      toolChoice: { WebSearch: false }
    },
    messages,
    canUseTools: true,
    canUseApproxLocation: false
  };

  try {
    const response = await axios.post(
      'https://duckduckgo.com/duckchat/v1/chat',
      payload,
      {
        headers: getFilteredHeaders(headers),
        timeout: 30000,
        responseType: 'stream'
      }
    );

    if (response.status === 418) {
      return 'CAPTCHA_REQUIRED';
    }

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }

    const fullAnswer = [];
    
    return new Promise((resolve, reject) => {
      let buffer = '';
      
      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataLine = line.slice(6).trim();
            if (dataLine === '[DONE]') {
              resolve(fullAnswer.join(''));
              return;
            }
            
            try {
              const obj = JSON.parse(dataLine);
              if (obj.message) {
                fullAnswer.push(obj.message);
              } else if (obj.action === 'error' && obj.type === 'ERR_CHALLENGE') {
                resolve('CAPTCHA_REQUIRED');
                return;
              }
            } catch {}
          }
        }
      });
      
      response.data.on('end', () => {
        resolve(fullAnswer.join(''));
      });
      
      response.data.on('error', reject);
    });
  } catch (error) {
    throw new Error(`Request failed: ${error.message}`);
  }
}

/**
 * Main handler function for Vercel
 */
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  let page = null;
  let context = null;

  try {
    const { messages, model = DEFAULT_MODEL } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    const actualModel = AVAILABLE_MODELS.includes(model) ? model : DEFAULT_MODEL;
    
    console.log(`Processing request with model: ${actualModel}`);

    // Initialize page
    const { page: chatPage, context: chatContext, getHeaders } = await initializeChatPage();
    page = chatPage;
    context = chatContext;

    // Refresh headers and send message
    await refreshHeaders(page);
    let answer = await sendMessage(getHeaders(), messages, actualModel);

    // Handle CAPTCHA if required
    let captchaAttempts = 0;
    while (answer === 'CAPTCHA_REQUIRED' && captchaAttempts < MAX_CAPTCHA_ATTEMPTS) {
      captchaAttempts++;
      console.log(`CAPTCHA detected, attempt ${captchaAttempts}/${MAX_CAPTCHA_ATTEMPTS}`);

      try {
        // Take screenshot and solve captcha
        const screenshot = await page.screenshot({ fullPage: true });
        const matrix = await solveCaptchaWithGemini(screenshot);
        
        if (matrix && await clickCaptcha(page, matrix)) {
          await page.waitForTimeout(2000);
          await refreshHeaders(page);
          answer = await sendMessage(getHeaders(), messages, actualModel);
        } else {
          throw new Error('Failed to solve captcha');
        }
      } catch (error) {
        console.log('Captcha solving error:', error.message);
        break;
      }
    }

    if (answer === 'CAPTCHA_REQUIRED') {
      return res.status(400).json({ 
        error: 'CAPTCHA required and auto-solving failed',
        details: 'Please try again later'
      });
    }

    // Clean up chat history
    try {
      await page.evaluate(() => localStorage.removeItem('savedAIChats'));
    } catch {}

    const processingTime = Date.now() - startTime;
    console.log(`Request completed in ${processingTime}ms`);

    return res.status(200).json({
      answer,
      model: actualModel,
      processingTime
    });

  } catch (error) {
    console.error('Handler error:', error.message);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  } finally {
    // Clean up page and context (but keep browser for reuse)
    try {
      if (page) await page.close();
      if (context) await context.close();
    } catch (e) {
      console.log('Cleanup error:', e.message);
    }
  }
}