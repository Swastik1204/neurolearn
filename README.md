# NeuroLearn - AI-Powered Adaptive Learning for Neurodivergent Children

[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?style=flat&logo=vercel)](https://neurolearn.vercel.app)
[![Firebase](https://img.shields.io/badge/Backend-Firebase-orange?style=flat&logo=firebase)](https://neurolearn-tutor-app.web.app)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

NeuroLearn is a progressive web application that provides personalized literacy education for neurodivergent children through adaptive AI tutoring, handwriting analysis, and emotional reinforcement.

## ✨ Features

### 🎨 **Adaptive Learning**
- **AI-Generated Lessons**: Dynamic story-based learning powered by OpenAI/Gemini/HuggingFace
- **Personalized Curriculum**: Adapts difficulty based on performance and emotional state
- **Multi-Sensory Activities**: Drawing, coloring, storytelling, and movement exercises

### ✏️ **Handwriting Analysis**
- **Real-time Stroke Capture**: Canvas-based drawing with pressure and timing analysis
- **TensorFlow.js Integration**: ML-powered handwriting quality assessment
- **Emotional Pattern Recognition**: Detects frustration and confidence through writing patterns

### 😊 **Emotional Intelligence**
- **Mood Tracking**: Real-time emotion analysis from drawing behavior
- **Adaptive Reinforcement**: Adjusts activities based on emotional state
- **Positive Feedback Loops**: Encourages engagement through personalized responses

### 🔐 **Authentication & Data**
- **Secure Firebase Auth**: Email/password authentication with user profiles
- **Firestore Database**: Real-time data storage for progress tracking
- **Cloud Storage**: Secure drawing uploads and asset management
- **Privacy-First**: User data isolation and secure access controls

### 📱 **Progressive Web App**
- **Offline Functionality**: Service worker with advanced caching strategies
- **Installable**: PWA manifest with app shortcuts and native-like experience
- **Cross-Platform**: Works on desktop, tablet, and mobile devices
- **Responsive Design**: DaisyUI + TailwindCSS for accessible, adaptive UI

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Firebase project (for backend services)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Swastik1204/neurolearn.git
   cd neurolearn
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Fill in your Firebase configuration and AI API keys in `.env`

4. **Start development server**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:5173`

## 🔧 Configuration

### Firebase Setup
1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication, Firestore, and Storage
3. Get your config from Project Settings > General > Your apps
4. Update `.env` with your Firebase credentials

### AI Integration
Choose your preferred AI provider and add the API key to `.env`:

```env
VITE_GENAI_API_KEY=your_api_key_here
VITE_GENAI_PROVIDER=openai  # or gemini, huggingface
```

Supported providers:
- **OpenAI**: GPT-4 for lesson generation
- **Google Gemini**: Multimodal AI responses
- **HuggingFace**: Open-source models

## 📁 Project Structure

```
neurolearn/
├── public/
│   ├── manifest.json          # PWA configuration
│   ├── service-worker.js      # Offline caching
│   └── icons/                 # App icons
├── src/
│   ├── components/            # Reusable UI components
│   │   ├── Navbar.jsx         # Navigation with auth
│   │   ├── CanvasPad.jsx      # Drawing interface
│   │   ├── EmotionVisualizer.jsx # Mood display
│   │   ├── LessonGenerator.jsx   # AI lesson creation
│   │   └── ProgressDashboard.jsx # Analytics
│   ├── context/
│   │   └── AppContext.jsx     # Global state management
│   ├── firebase/
│   │   ├── auth.js            # Authentication helpers
│   │   ├── db.js              # Firestore operations
│   │   ├── config.js          # Firebase configuration
│   │   └── ml.js              # ML model hosting
│   ├── pages/                 # Route components
│   │   ├── Home.jsx           # Landing page
│   │   ├── Learn.jsx          # Lesson interface
│   │   ├── Draw.jsx           # Drawing practice
│   │   ├── Profile.jsx        # Progress tracking
│   │   └── Login.jsx          # Authentication
│   ├── utils/                 # Utility functions
│   │   ├── genAI.js           # AI integration
│   │   ├── emotionAnalysis.js # ML analysis
│   │   └── reinforcement.js   # Adaptive logic
│   └── main.jsx               # App entry point
├── .env.example               # Environment template
├── firebase.json              # Firebase config
├── firestore.rules            # Database security
├── vercel.json                # Vercel deployment
└── tailwind.config.js         # Styling config
```

## 🎯 Usage

### For Learners
1. **Sign Up**: Create an account with email and age
2. **Home Dashboard**: View personalized lessons and emotional insights
3. **Learn**: Engage with AI-generated educational content
4. **Draw**: Practice handwriting with real-time feedback
5. **Track Progress**: Monitor improvement over time

### For Parents/Educators
- **Progress Monitoring**: Real-time analytics and emotional tracking
- **Data Export**: Access to all learning session data
- **Customization**: Adjust difficulty and learning preferences

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 19 + Vite
- **Styling**: TailwindCSS + DaisyUI
- **Backend**: Firebase (Auth, Firestore, Storage, Hosting)
- **AI/ML**: TensorFlow.js + Multiple LLM providers
- **PWA**: Service Worker + Web App Manifest

### Data Flow
1. **User Interaction** → Canvas captures stroke data
2. **ML Analysis** → TensorFlow.js processes handwriting
3. **Emotion Detection** → Pattern recognition for mood assessment
4. **AI Adaptation** → LLM generates personalized content
5. **Data Persistence** → Firebase stores progress and sessions

### Security
- **Authentication**: Firebase Auth with email/password
- **Data Privacy**: User-scoped database access
- **Secure Storage**: Encrypted file uploads
- **API Security**: Environment-based API key management

## ☁️ Deployment

The app is deployed on multiple platforms:

- **Primary**: [https://neurolearn.vercel.app](https://neurolearn.vercel.app)
- **Backup**: [https://neurolearn-tutor-app.web.app](https://neurolearn-tutor-app.web.app)

### Deploy to Vercel
```bash
npm run build
vercel --prod
```

### Deploy to Firebase
```bash
npm run build
firebase deploy --only hosting
```

### Environment Variables
Set these in your deployment platform:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GENAI_API_KEY=your_ai_api_key
VITE_GENAI_PROVIDER=openai
```

## 🔬 Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Testing AI Features
- Use the fallback mode by commenting out API keys
- Test with mock data for development
- Verify TensorFlow.js model loading

### Firebase Emulators
```bash
firebase emulators:start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

### Development Guidelines
- Follow React best practices and hooks patterns
- Use TypeScript for new components (optional)
- Maintain accessibility standards (WCAG 2.1)
- Test PWA functionality across devices
- Document new features in this README

## 📊 Roadmap

### Phase 1 ✅ (Current)
- Core PWA with Firebase backend
- Basic handwriting analysis
- AI-powered lesson generation
- Authentication and user management

### Phase 2 🔄 (Next)
- Advanced ML models for handwriting recognition
- Voice narration and audio feedback
- Parent dashboard and reporting
- Multi-language support

### Phase 3 📋 (Future)
- Real-time collaboration features
- Integration with educational platforms
- Advanced analytics and insights
- Mobile app versions (React Native)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **TensorFlow.js** for machine learning capabilities
- **Firebase** for robust backend infrastructure
- **DaisyUI** for beautiful, accessible components
- **Vite** for lightning-fast development experience

## 📞 Support

For questions, issues, or contributions:
- Open an issue on GitHub
- Contact the maintainers
- Check the documentation for common solutions

---

**Built with ❤️ for neurodivergent learners worldwide** 🌈
