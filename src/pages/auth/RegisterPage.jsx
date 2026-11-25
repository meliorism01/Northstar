import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  UserCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
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

function validatePasswordClient(pwd) {
  if (!pwd || pwd.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Z]/.test(pwd)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(pwd)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[0-9]/.test(pwd)) {
    return 'Password must contain at least one digit.';
  }
  if (!/[^A-Za-z0-9\s]/.test(pwd)) {
    return 'Password must contain at least one special character (e.g. !@#$%).';
  }
  return null;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const registerMerchant = useAuthStore((s) => s.registerMerchant);
  const isSubmitting = useAuthStore((s) => s.isSubmitting);
  const authError = useAuthStore((s) => s.authError);
  const fieldErrors = useAuthStore((s) => s.fieldErrors);
  const clearAuthError = useAuthStore((s) => s.clearAuthError);

  const [form, setForm] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [registeredResult, setRegisteredResult] = useState(null);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (localError) setLocalError(null);
    if (authError) clearAuthError();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);

    if (!form.businessName.trim() || form.businessName.trim().length < 2) {
      setLocalError('Please enter your business or brand name (at least 2 characters).');
      return;
    }
    if (!form.ownerName.trim() || form.ownerName.trim().length < 2) {
      setLocalError('Please enter the owner full name.');
      return;
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setLocalError('Please enter a valid business email address.');
      return;
    }

    const pwdErr = validatePasswordClient(form.password);
    if (pwdErr) {
      setLocalError(pwdErr);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setLocalError('Password and Confirm Password do not match.');
      return;
    }

    try {
      const result = await registerMerchant({
        businessName: form.businessName.trim(),
        ownerName: form.ownerName.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setRegisteredResult(result);
    } catch {
      // Handled via authError in useAuthStore
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
          <span className="hidden sm:inline">Already registered?</span>
          <Link to="/login">
            <Button variant="outline" size="sm">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Registration Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[500px] rounded-[28px] bg-white/95 backdrop-blur-xl border border-[#DFE1F5] shadow-panel p-7 sm:p-9">
          <div className="text-center mb-6">
            <SectionEyebrow>Multi-Tenant Merchant Onboarding</SectionEyebrow>
            <h1 className="mt-3 font-display text-[26px] sm:text-[30px] font-extrabold text-[#465478] tracking-[-0.03em]">
              Create your <span className="rescale-gradient-text">NORTHSTAR</span> workspace
            </h1>
            <p className="mt-1.5 text-[13px] text-[#6E7896]">
              Provisions an isolated PostgreSQL merchant tenant and owner account.
            </p>
          </div>

          {registeredResult ? (
            <div
              data-testid="register-success-card"
              className="rounded-[22px] bg-[#ECFEF6] border border-[#C3F3DE] p-6 text-center space-y-4 animate-fade-up"
            >
              <CheckCircle2 className="w-10 h-10 text-[#17825B] mx-auto" />
              <div>
                <h2 className="font-display text-[18px] font-extrabold text-[#146C4B]">
                  Workspace Provisioned!
                </h2>
                <p className="text-[13px] text-[#17825B] mt-1 leading-relaxed">
                  <strong>{registeredResult.workspace?.businessName}</strong> has been created with{' '}
                  <strong>{registeredResult.user?.email}</strong> assigned as{' '}
                  <span className="font-mono font-bold">OWNER</span>.
                </p>
              </div>
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                data-testid="proceed-to-login-btn"
                onClick={() =>
                  navigate('/login', {
                    state: {
                      registeredEmail: registeredResult.user?.email,
                      registeredBusiness: registeredResult.workspace?.businessName,
                    },
                  })
                }
              >
                Continue to Secure Sign In <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {displayError && (
                <div
                  role="alert"
                  data-testid="register-error-alert"
                  className="rounded-[16px] bg-[#FFF0F2] border border-[#FECDD6] px-4 py-3 flex items-start gap-2.5 text-[12.5px] text-[#D13B56] font-display font-semibold"
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div>{displayError}</div>
                    {fieldErrors && (
                      <ul className="list-disc list-inside text-[11.5px] font-normal">
                        {Object.entries(fieldErrors).map(([field, msg]) => (
                          <li key={field}>{msg}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              <Field label="Business / D2C Brand Name" required>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-[#7584D6] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    name="businessName"
                    data-testid="register-business-name"
                    value={form.businessName}
                    onChange={(e) => updateField('businessName', e.target.value)}
                    placeholder="e.g., ABC Fashion Pvt Ltd"
                    className={`${inputClass} pl-10`}
                    required
                  />
                </div>
              </Field>

              <Field label="Owner Full Name" required>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-[#7584D6] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    name="ownerName"
                    data-testid="register-owner-name"
                    value={form.ownerName}
                    onChange={(e) => updateField('ownerName', e.target.value)}
                    placeholder="e.g., Rahul Sharma"
                    className={`${inputClass} pl-10`}
                    required
                  />
                </div>
              </Field>

              <Field label="Business Email Address" required>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#7584D6] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    name="email"
                    data-testid="register-email"
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="rahul@abcfashion.in"
                    className={`${inputClass} pl-10`}
                    autoComplete="email"
                    required
                  />
                </div>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Field label="Password" required>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#7584D6] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      data-testid="register-password"
                      value={form.password}
                      onChange={(e) => updateField('password', e.target.value)}
                      placeholder="StrongPassword123!"
                      className={`${inputClass} pl-10 pr-9`}
                      autoComplete="new-password"
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

                <Field label="Confirm Password" required>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#7584D6] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      data-testid="register-confirm-password"
                      value={form.confirmPassword}
                      onChange={(e) => updateField('confirmPassword', e.target.value)}
                      placeholder="Repeat password"
                      className={`${inputClass} pl-10`}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </Field>
              </div>

              <p className="text-[11px] text-[#8891AA] leading-relaxed">
                Password must be 8+ characters with at least one uppercase letter, lowercase letter,
                number, and special symbol.
              </p>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isSubmitting}
                data-testid="register-submit-btn"
                className="w-full mt-2"
              >
                Create Merchant Workspace <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-[#EEF0FA] flex items-center justify-between text-[12px] text-[#7C86A2]">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2EB37E]" />
              BCrypt Hashed · Tenant Isolated
            </span>
            <Link to="/login" className="font-display font-bold text-[#545C9E] hover:text-[#465478]">
              Sign in instead →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
