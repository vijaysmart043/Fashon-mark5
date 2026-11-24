import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Mail, Lock, User, Phone, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'login' }) => {
  const { loginWithEmail, registerWithEmail, loginWithGoogle, resetPassword } = useAuth();
  
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
        setSuccessMsg('Successfully logged in!');
        setTimeout(() => { onClose(); }, 1000);
      } else if (mode === 'register') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        await registerWithEmail(email, password, fullName, phoneNumber);
        setSuccessMsg('Registration successful! Verification email sent.');
        setTimeout(() => { onClose(); }, 1500);
      } else if (mode === 'forgot') {
        await resetPassword(email);
        setSuccessMsg('Password reset link sent to your email.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      setSuccessMsg('Google login successful!');
      setTimeout(() => { onClose(); }, 1000);
    } catch (err: any) {
      setError(err.message || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#120D0B] text-[#F8F1E4] rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-[#D4AF62]/40 animate-in fade-in zoom-in duration-200 relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-[#D4AF62] rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4AF62]/20 text-[#D4AF62] text-xs font-semibold tracking-widest uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>SDA ROYAL CLUB</span>
            </div>
            <h2 className="font-cinzel text-2xl font-bold">
              {mode === 'login' && 'Welcome Back'}
              {mode === 'register' && 'Create Account'}
              {mode === 'forgot' && 'Reset Password'}
            </h2>
            <p className="text-xs text-[#F8F1E4]/70">
              {mode === 'login' && 'Sign in to access your orders and wishlist.'}
              {mode === 'register' && 'Join SDA Collections for exclusive bridal drops.'}
              {mode === 'forgot' && 'Enter your email to receive a password reset link.'}
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/20 border border-rose-500/50 rounded-xl text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-[#D4AF62] mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#D4AF62]/70 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Sravani Reddy"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#211713] border border-[#D4AF62]/30 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#D4AF62]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#D4AF62] mb-1">Mobile Number</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-[#D4AF62]/70 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      placeholder="+91 9848012345"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#211713] border border-[#D4AF62]/30 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#D4AF62]"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-[#D4AF62] mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#D4AF62]/70 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#211713] border border-[#D4AF62]/30 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#D4AF62]"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="block text-xs font-medium text-[#D4AF62] mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#D4AF62]/70 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#211713] border border-[#D4AF62]/30 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#D4AF62]"
                  />
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-[#D4AF62] mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#D4AF62]/70 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#211713] border border-[#D4AF62]/30 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#D4AF62]"
                  />
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-xs text-[#D4AF62] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-[#D4AF62] to-[#AA8230] text-[#120D0B] font-bold rounded-xl text-xs uppercase tracking-wider hover:from-[#f3e5ab] hover:to-[#d4af62] transition-all shadow-lg"
            >
              {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link'}
            </button>
          </form>

          {mode !== 'forgot' && (
            <>
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-[#D4AF62]/20"></div>
                <span className="flex-shrink mx-4 text-xs text-[#F8F1E4]/50 uppercase tracking-widest">or</span>
                <div className="flex-grow border-t border-[#D4AF62]/20"></div>
              </div>

              <button
                onClick={handleGoogle}
                disabled={loading}
                className="w-full py-2.5 bg-[#211713] border border-[#D4AF62]/40 rounded-xl text-xs font-semibold text-white hover:bg-[#D4AF62]/10 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.1 8.9 5 12 5z" />
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                  <path fill="#FBBC05" d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.7s.2-2 .4-2.7L1.6 6.4C.6 8.4 0 10.6 0 13s.6 4.6 1.6 6.6l3.7-2.9z" />
                  <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5.3L1.6 15.9C3.5 19.7 7.4 23 12 23z" />
                </svg>
                <span>Continue with Google</span>
              </button>
            </>
          )}

          <div className="text-center text-xs pt-2 border-t border-[#D4AF62]/20">
            {mode === 'login' ? (
              <p>Don't have an account? <button onClick={() => setMode('register')} className="text-[#D4AF62] font-semibold hover:underline">Register here</button></p>
            ) : (
              <p>Already have an account? <button onClick={() => setMode('login')} className="text-[#D4AF62] font-semibold hover:underline">Sign in</button></p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
