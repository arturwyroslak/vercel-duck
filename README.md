# 🦆 DuckAI Server for Vercel

A **serverless DuckDuckGo AI chat API** optimized for deployment on **Vercel**. This is an adapted version of [duckai-server](https://github.com/MyHoldFast/duckai-server) by MyHoldFast, specifically optimized for Vercel's serverless environment using `@sparticuz/chromium` and `playwright-core`.

## ✨ Features

- 🚀 **Serverless deployment** on Vercel
- 🤖 **Multiple AI models** support (GPT, Claude, Llama, Mistral)
- 🧠 **Automatic CAPTCHA solving** using Gemini Vision API
- ⚡ **Memory optimized** for serverless functions
- 🔄 **Browser instance caching** for better performance
- 🛡️ **Resource blocking** for faster responses
- 🌐 **CORS enabled** for web applications
- 📊 **Request monitoring** with processing time metrics

## 🚀 Quick Deploy

### Option 1: Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/arturwyroslak/vercel-duck)

1. Click the "Deploy with Vercel" button above
2. Connect your GitHub account
3. Set up the required environment variable:
   - `GEMINI_API_KEY`: Your Google Gemini API key (for CAPTCHA solving)
4. Deploy!

### Option 2: Manual Deployment

1. **Clone the repository:**
```bash
git clone https://github.com/arturwyroslak/vercel-duck.git
cd vercel-duck
```

2. **Install Vercel CLI:**
```bash
npm install -g vercel
```

3. **Login to Vercel:**
```bash
vercel login
```

4. **Deploy:**
```bash
vercel
```

5. **Set environment variable:**
```bash
vercel env add GEMINI_API_KEY
```

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for CAPTCHA solving ([Get it here](https://aistudio.google.com/app/apikey)) |

### Vercel Settings

The `vercel.json` configuration optimizes the deployment:

```json
{
  "functions": {
    "api/ask.js": {
      "memory": 3008,
      "maxDuration": 30
    }
  }
}
```

- **Memory**: 3008MB (maximum for Pro plan)
- **Timeout**: 30 seconds (allows time for CAPTCHA solving)

## 📡 API Usage

### Endpoint
```
POST /api/ask
```

### Request Body
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Hello, who are you?"
    }
  ],
  "model": "gpt-5-mini"
}
```

### Response
```json
{
  "answer": "I'm Claude, an AI assistant created by Anthropic...",
  "model": "gpt-5-mini",
  "processingTime": 2543
}
```

### cURL Example
```bash
curl -X POST https://your-deployment.vercel.app/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What is the capital of France?"}
    ],
    "model": "gpt-5-mini"
  }'
```

### JavaScript Example
```javascript
const response = await fetch('https://your-deployment.vercel.app/api/ask', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'Explain quantum computing' }
    ],
    model: 'gpt-5-mini'
  })
});

const data = await response.json();
console.log(data.answer);
```

## 🤖 Available Models

| Model | Provider | Description |
|-------|----------|-------------|
| `gpt-5-mini` | OpenAI | Default model, fastest response |
| `gpt-4o-mini` | OpenAI | Optimized GPT-4 variant |
| `claude-3-5-haiku-latest` | Anthropic | Latest Claude model |
| `mistralai/Mistral-Small-24B-Instruct-2501` | Mistral AI | Advanced reasoning model |
| `meta-llama/Llama-4-Scout-17B-16E-Instruct` | Meta | Latest Llama model |

## 🛠️ Technical Details

### Architecture

- **Runtime**: Node.js 20.x
- **Browser**: Playwright with @sparticuz/chromium
- **Memory**: 3008MB (Vercel Pro limit)
- **Timeout**: 30 seconds
- **CAPTCHA Solving**: Gemini Vision API

### Optimizations

1. **Resource Blocking**: Images, stylesheets, fonts blocked to save bandwidth
2. **Browser Caching**: Browser instances reused for 10 minutes
3. **Memory Management**: Automatic cleanup of old browser instances
4. **Stealth Mode**: Anti-detection measures enabled
5. **Connection Pooling**: Efficient handling of multiple requests

### Error Handling

- Automatic CAPTCHA detection and solving
- Graceful fallback for failed requests
- Comprehensive error messages
- Request timeout handling

## 🔍 Troubleshooting

### Common Issues

**1. Memory Limit Exceeded**
- Upgrade to Vercel Pro for 3008MB memory
- The free plan (1024MB) may not be sufficient

**2. CAPTCHA Solving Failed**
- Ensure `GEMINI_API_KEY` is set correctly
- Check Gemini API quota and billing
- CAPTCHA appears randomly, usually resolves automatically

**3. Timeout Errors**
- Increase `maxDuration` in `vercel.json` (Pro plan allows up to 60s)
- Check target website responsiveness

**4. Browser Launch Failed**
- Ensure `@sparticuz/chromium` version compatibility
- Check Vercel function logs for detailed errors

### Debugging

Enable debug logging by checking Vercel function logs:
```bash
vercel logs
```

## 📊 Performance

- **Cold Start**: ~2-5 seconds
- **Warm Request**: ~1-3 seconds  
- **With CAPTCHA**: ~8-15 seconds
- **Memory Usage**: ~500-800MB per request
- **Concurrent Requests**: Up to 10 (Vercel Pro)

## 🔐 Security

- Environment variables for sensitive data
- CORS properly configured
- No persistent data storage
- Anti-bot detection measures
- Automatic cleanup of browser sessions

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Original [duckai-server](https://github.com/MyHoldFast/duckai-server) by **MyHoldFast**
- [Vercel Playwright deployment guide](https://vercel.com/guides/using-playwright-with-vercel-functions) referenced from the attached doc3.md
- [@sparticuz/chromium](https://github.com/Sparticuz/chromium) for serverless Chromium support

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

**Made with ❤️ for the serverless community**