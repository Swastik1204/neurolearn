export function setCors(res) {
  const allowed = [
    'https://neurolearn-tutor-app.web.app',
    'https://neurolearn.vercel.app',
    'http://localhost:5173'
  ];
  res.setHeader('Access-Control-Allow-Origin', allowed.join(','));
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
