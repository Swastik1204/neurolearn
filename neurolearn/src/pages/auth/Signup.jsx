import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import ConsentModal from './ConsentModal';
import { BookOpen, UserPlus, GraduationCap, Users, School } from 'lucide-react';

const ROLES = [
  {
    id: 'student',
    label: 'Student',
    description: 'I want to practice writing and reading',
    icon: GraduationCap,
    color: 'from-purple-500 to-indigo-500',
  },
  {
    id: 'guardian',
    label: 'Parent / Guardian',
    description: 'I want to track my child\'s progress',
    icon: Users,
    color: 'from-amber-500 to-orange-500',
  },
  {
    id: 'teacher',
    label: 'Teacher',
    description: 'I want to manage my class',
    icon: School,
    color: 'from-emerald-500 to-teal-500',
  },
];

export default function Signup() {
  const location = useLocation();
  const fromGoogle = location.state?.fromGoogle;
  const googleUid = location.state?.uid;

  const [step, setStep] = useState(1); // 1: role, 2: details
  const [selectedRole, setSelectedRole] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const navigate = useNavigate();

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    if (role === 'guardian') {
      setShowConsent(true);
    } else {
      setStep(2);
    }
  };

  const handleConsentAccept = () => {
    setShowConsent(false);
    setStep(2);
  };

  const handleConsentDecline = () => {
    setShowConsent(false);
    setSelectedRole('');
  };

  const createUserDocument = async (uid, name, userEmail) => {
    const userData = {
      uid: uid,
      role: selectedRole,
      displayName: name,
      email: userEmail ?? auth.currentUser?.email ?? email ?? '',
      createdAt: serverTimestamp(),
      linkedStudentIds: [],
      consentGiven: selectedRole === 'guardian',
      consentTimestamp: selectedRole === 'guardian' ? serverTimestamp() : null,
    };
    await setDoc(doc(db, 'users', uid), userData);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (fromGoogle && googleUid) {
        // Google user just picking role
        await createUserDocument(googleUid, auth.currentUser?.displayName || displayName, auth.currentUser?.email);
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName });
        await createUserDocument(result.user.uid, displayName, result.user.email);
      }

      switch (selectedRole) {
        case 'student': navigate('/student'); break;
        case 'guardian': navigate('/guardian'); break;
        case 'teacher': navigate('/teacher'); break;
        default: navigate('/');
      }
    } catch (err) {
      console.error('Signup error full details:', err.code, err.message, err);
      setError(
        err.code === 'auth/email-already-in-use'
          ? 'This email is already registered. Try signing in instead.'
          : err.code === 'auth/weak-password'
            ? 'Password should be at least 6 characters.'
            : 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary mb-4 shadow-lg">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Join NeuroLearn</h1>
          <p className="text-muted-foreground mt-2">
            {step === 1 ? 'Who are you?' : `Create your ${selectedRole} account`}
          </p>
        </div>

        <div className="bg-card rounded-xl shadow-lg border border-border p-8">
          {/* Step 1 — Role Selection */}
          {step === 1 && (
            <div className="space-y-3">
              {ROLES.map((role) => {
                const Icon = role.icon;
                return (
                  <button
                    key={role.id}
                    onClick={() => handleRoleSelect(role.id)}
                    className={`w-full p-4 rounded-xl border-2 text-left flex items-center gap-4 transition-all hover:shadow-md ${
                      selectedRole === role.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${role.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{role.label}</div>
                      <div className="text-sm text-muted-foreground">{role.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2 — Registration Form */}
          {step === 2 && (
            <>
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm animate-scale-in">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="signup-name" className="block text-sm font-medium text-foreground mb-1.5">
                    Full name
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-input bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    placeholder="Enter your full name"
                    required={!fromGoogle}
                  />
                </div>

                {!fromGoogle && (
                  <>
                    <div>
                      <label htmlFor="signup-email" className="block text-sm font-medium text-foreground mb-1.5">
                        Email address
                      </label>
                      <input
                        id="signup-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-input bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                        placeholder="you@example.com"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="signup-password" className="block text-sm font-medium text-foreground mb-1.5">
                        Password
                      </label>
                      <input
                        id="signup-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-input bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                        placeholder="At least 6 characters"
                        required
                        minLength={6}
                      />
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-lg gradient-primary text-white font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      Create account
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep(1); setError(''); }}
                  className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Change role
                </button>
              </div>
            </>
          )}

          {step === 1 && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>

      <ConsentModal
        isOpen={showConsent}
        onAccept={handleConsentAccept}
        onDecline={handleConsentDecline}
      />
    </div>
  );
}
