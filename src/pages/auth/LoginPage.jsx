import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import {
  OrdexaWordmark,
  Button,
  Field,
  inputClass,
  SectionEyebrow,
} from '../../components/ui/Primitives';
import { useAuthStore } from '../../store/useAuthStore';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const isSubmitting = useAuthStore((s) => s.isSubmitting);
  const authError = useAuthStore((s) => s.authError);
  const clearAuthError = useAuthStore((s) => s.clearAuthError);

  const registeredEmail = location.state?.registeredEmail || '';
  const registeredBusiness = location.state?.registeredBusiness || '';
  const redirectTarget = location.state?.from || '/app/dashboard';

  const [email, setEmail] = useState(registeredEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [localError, setLocalError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);

    if (!email.trim() || !password) {
      setLocalError('Please enter your business email and password.');
      return;
    }

    try {
      const sessionData = await login({
        email: email.trim(),
        password,
      });

      if (
        sessionData.requiresWorkspaceSelection ||
        !sessionData.activeWorkspace ||
        (sessionData.workspaces && sessionData.workspaces.length > 1)
      ) {
        navigate('/workspaces', { replace: true });
      } else {
        navigate(redirectTarget, { replace: true });
      }
    } catch {
      // Displayed via authError
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#465478] flex flex-col justify-between relative overflow-hidden">
      <img
        src="/template-assets/hero-wave-1.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-x-0 top-0 w-full h-[540px] object-cover opacity-70"
      />

      {/* Top Navigation */}
      <header className="relative z-10 max-w-[1140px] w-full mx-auto px-4 sm:px-8 pt-6 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center">
          <OrdexaWordmark size="md" />
        </Link>
        <div className="flex items-center gap-3 text-[13px] font-display font-semibold text-[#5C6888]">
          <span className="hidden sm:inline">New to ORDEXA?</span>
          <Link to="/register">
            <Button variant="outline" size="sm">
              Create Workspace
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[460px] rounded-[28px] bg-white/95 backdrop-blur-xl border border-[#DFE1F5] shadow-panel p-7 sm:p-9">
          <div className="text-center mb-6">
            <SectionEyebrow>Merchant Console Authentication</SectionEyebrow>
            <h1 className="mt-3 font-display text-[26px] sm:text-[30px] font-extrabold text-[#465478] tracking-[-0.03em]">
              Sign in to <span className="rescale-gradient-text">ORDEXA</span>
            </h1>
            <p className="mt-1.5 text-[13px] text-[#6E7896]">
              Access your isolated merchant workspace and RTO rescue engine.
            </p>
          </div>

          {registeredBusiness && !displayError && (
            <div
              data-testid="login-registered-banner"
              className="mb-4 rounded-[16px] bg-[#ECFEF6] border border-[#C3F3DE] px-4 py-3 flex items-start gap-2.5 text-[12.5px] text-[#17825B] font-display font-semibold"
            >
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Workspace <strong>{registeredBusiness}</strong> created! Sign in with your owner
                password below.
              </span>
            </div>
          )}

          {displayError && (
            <div
              role="alert"
              data-testid="login-error-alert"
              className="mb-4 rounded-[16px] bg-[#FFF0F2] border border-[#FECDD6] px-4 py-3 flex items-start gap-2.5 text-[12.5px] text-[#D13B56] font-display font-semibold"
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Field label="Business Email" required>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#7584D6] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  name="email"
                  data-testid="login-email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (localError) setLocalError(null);
                    if (authError) clearAuthError();
                  }}
                  placeholder="rahul@abcfashion.in"
                  className={`${inputClass} pl-10`}
                  autoComplete="email"
                  required
                />
              </div>
            </Field>

            <Field label="Password" required>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#7584D6] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  data-testid="login-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (localError) setLocalError(null);
                    if (authError) clearAuthError();
                  }}
                  placeholder="Enter your password"
                  className={`${inputClass} pl-10 pr-10`}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8891AA] hover:text-[#465478]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>

            <div className="flex items-center justify-between text-[12px] text-[#6E7896]">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberSession}
                  onChange={(e) => setRememberSession(e.target.checked)}
                  className="rounded border-[#C5CAEC] text-[#7584D6] focus:ring-[#7584D6]"
                />
                <span>Keep session active (HttpOnly refresh cookie)</span>
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              data-testid="login-submit-btn"
              className="w-full mt-2"
            >
              Sign In to Merchant Console <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#EEF0FA] flex items-center justify-between text-[12px] text-[#7C86A2]">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#7584D6]" />
              JWT + Rotated Refresh Session
            </span>
            <Link
              to="/register"
              className="font-display font-bold text-[#545C9E] hover:text-[#465478]"
            >
              Register new merchant →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
