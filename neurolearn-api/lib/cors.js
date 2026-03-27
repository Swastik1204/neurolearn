export function setCors(req, res) {
  const allowed = [
    'https://neurolearn-tutor-app.web.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ];
  
  const origin = req.headers.origin;
  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin && process.env.NODE_ENV === 'development') {
    // Allow server-to-server or local non-browser requests in dev
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-ML-Secret');
}
