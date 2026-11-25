import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ShieldCheck,
  GitFork,
  MessageSquare,
  Truck,
  CheckCircle2,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  BarChart3,
  Layers,
  Lock,
} from 'lucide-react';
import {
  OrdexaWordmark,
  Button,
  SectionEyebrow,
  IconTile,
  KpiCard,
} from '../components/ui/Primitives';
import { MirroredCapsuleChart, PopOutDonutChart } from '../components/charts/ChartKit';
import { HeroDemoWidget } from '../components/landing/HeroDemoWidget';
import { RoiCalculator } from '../components/landing/RoiCalculator';

const MINI_CAPSULE_DATA = [
  { label: 'Jan', top: 38, bottom: 24 },
  { label: 'Feb', top: 44, bottom: 20 },
  { label: 'Mar', top: 35, bottom: 28 },
  { label: 'Apr', top: 49, bottom: 18 },
  { label: 'May', top: 53, bottom: 16 },
  { label: 'Jun', top: 47, bottom: 21 },
  { label: 'Jul', top: 56, bottom: 14 },
  { label: 'Aug', top: 52, bottom: 15 },
];

const BENTO_FEATURES = [
  {
    num: '01',
    title: 'Explainable RTO Risk Engine',
    description:
      'Every incoming COD & prepaid order is scored with human-readable reason codes—missing landmarks, high-value COD exposure, or repeated refusals—before you print an AWB.',
    icon: ShieldCheck,
    tone: 'peri',
    tag: 'Rules-Based v1 · ML-Ready',
    route: '/app/orders',
  },
  {
    num: '02',
    title: 'Merchant-Scoped Customer Graph',
    description:
      'Unify buyer phone numbers, PIN codes, and landmark updates across your owned Shopify, WooCommerce, and CSV channels with full merge/separate auditability.',
    icon: GitFork,
    tone: 'cyan',
    tag: 'Privacy-Safe Governance',
    route: '/app/graph',
  },
  {
    num: '03',
    title: 'Proportionate WhatsApp Rescue',
    description:
      'Replace blunt COD blocking with sub-rupee WhatsApp landmark prompts, 1-tap intent confirmation, or optional ₹150 UPI advances tailored to order risk.',
    icon: MessageSquare,
    tone: 'pink',
    tag: 'Interactive Sandbox',
    route: '/app/rescue',
  },
  {
    num: '04',
    title: 'Attempt #1 NDR Recovery',
    description:
      'Intercept "Customer Unavailable" and "Address Incomplete" courier exceptions immediately with buyer rescheduling flows before Attempt #3 triggers RTO.',
    icon: Truck,
    tone: 'coral',
    tag: 'Reverse Freight Protection',
    route: '/app/ndr',
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    step: 'Step 01',
    title: 'Ingest Storefront & CSV Orders',
    detail:
      'Sync orders via simulated Shopify/WooCommerce webhooks or upload live local CSV batches from social and WhatsApp catalogs.',
  },
  {
    step: 'Step 02',
    title: 'Score Risk & Resolve Buyer Graph',
    detail:
      'ORDEXA cross-checks delivery history within your merchant workspace and flags incomplete landmarks or high-exposure COD carts.',
  },
  {
    step: 'Step 03',
    title: 'Run Proportionate Pre-Dispatch Rescue',
    detail:
      'Low-attention orders clear automatically; flagged COD orders receive targeted WhatsApp confirmation or landmark requests.',
  },
  {
    step: 'Step 04',
    title: 'Manifest Verified & Audit Savings',
    detail:
      'Dispatch confirmed orders confidently and track conservative net freight protected separately from pre-dispatch cancellations.',
  },
];

const FAQS = [
  {
    q: 'Does ORDEXA share customer blacklists across competing merchants?',
    a: 'No. ORDEXA enforces strict merchant-scoped identity resolution by default. Your buyer records, phone hashes, and delivery outcomes stay isolated inside your workspace with explicit consent and retention controls.',
  },
  {
    q: 'Is the risk engine using a black-box AI model or auditable rules?',
    a: 'Version 1 runs a transparent, deterministic rules-based scoring engine with explicit reason codes (such as ADDRESS_INCOMPLETE and HIGH_VALUE_ORDER) so ops teams can audit and tune every threshold while preserving a clean contract for supervised ML.',
  },
  {
    q: 'How are rescued orders distinguished from cancelled orders in financial reports?',
    a: 'ORDEXA never inflates savings by lumping cancelled orders into delivered rescues. Verified Delivered Rescues, Pipeline Rescues, and Pre-Dispatch Freight Avoided (cancellations) are reported in separate accounting buckets minus outreach spend.',
  },
  {
    q: 'Which integrations are live locally vs. simulated in this demo?',
    a: 'CSV batch upload, manual order intake, rules re-scoring, Customer Graph merge/separate, and financial ledger math run live in your browser. Shopify, WooCommerce, WhatsApp Cloud API, and courier NDR webhooks run in realistic interactive simulation mode.',
  },
];

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#465478] overflow-x-clip selection:bg-[#E3E6FA]">
      {/* Floating Rescale Frosted-Glass Pill Navbar */}
      <header className="fixed top-4 inset-x-0 z-50 px-4">
        <div className="max-w-[980px] mx-auto rounded-[26px] bg-white/85 backdrop-blur-xl border border-white shadow-rescale-nav px-5 py-3 flex items-center justify-between gap-4">
          <a href="#top" className="inline-flex items-center">
            <OrdexaWordmark size="sm" />
          </a>

          <nav className="hidden md:flex items-center gap-6 text-[13.5px] font-display font-semibold text-[#5C6888]">
            <a href="#spotlight" className="hover:text-[#465478] transition-colors">
              Spotlight
            </a>
            <a href="#features" className="hover:text-[#465478] transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-[#465478] transition-colors">
              How It Works
            </a>
            <a href="#integration" className="hover:text-[#465478] transition-colors">
              Integrations
            </a>
            <a href="#roi-calculator" className="hover:text-[#465478] transition-colors">
              ROI Model
            </a>
            <a href="#faq" className="hover:text-[#465478] transition-colors">
              FAQ
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-2.5">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link to="/register">
              <Button variant="outline" size="sm">
                Register Store
              </Button>
            </Link>
            <Link to="/app/dashboard">
              <Button variant="primary" size="sm">
                Open Console
              </Button>
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="md:hidden w-9 h-9 rounded-full bg-[#F1F2F9] border border-[#DFE1F5] flex items-center justify-center text-[#465478]"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden max-w-[980px] mx-auto mt-2 rounded-[24px] bg-white/95 backdrop-blur-xl border border-[#DFE1F5] shadow-panel p-5 space-y-3 animate-fade-up">
            <div className="grid grid-cols-2 gap-2 text-[13px] font-display font-semibold text-[#465478]">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-xl hover:bg-[#F1F2F9]">
                Features
              </a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-xl hover:bg-[#F1F2F9]">
                How It Works
              </a>
              <a href="#integration" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-xl hover:bg-[#F1F2F9]">
                Integrations
              </a>
              <a href="#roi-calculator" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-xl hover:bg-[#F1F2F9]">
                ROI Model
              </a>
            </div>
            <Link to="/app/dashboard" onClick={() => setMobileMenuOpen(false)} className="block">
              <Button variant="primary" size="md" className="w-full">
                Launch Merchant Console <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        )}
      </header>

      {/* HERO SECTION — Exact Rescale Silk Wave + Floating 3D Sculptures */}
      <section id="top" className="relative pt-32 sm:pt-40 pb-16 px-4 sm:px-8 overflow-hidden">
        {/* Background Silk Wave from Template */}
        <img
          src="/template-assets/hero-wave-1.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute inset-x-0 top-0 w-full max-w-[1600px] mx-auto h-[680px] object-cover opacity-80"
        />

        {/* Floating 3D Pastel Sculptures from Template */}
        <img
          src="/template-assets/float-cross.png"
          alt=""
          aria-hidden="true"
          className="hidden lg:block pointer-events-none select-none absolute left-[6%] top-44 w-28 xl:w-36 opacity-90 drop-shadow-xl"
        />
        <img
          src="/template-assets/float-poly.png"
          alt=""
          aria-hidden="true"
          className="hidden lg:block pointer-events-none select-none absolute right-[6%] top-52 w-32 xl:w-40 opacity-90 drop-shadow-xl"
        />

        <div className="relative z-10 max-w-[920px] mx-auto text-center">
          {/* Top Pill Badge */}
          <div className="inline-flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 rounded-full bg-white/90 border border-[#DFE1F5] shadow-rescale-card">
            <span className="px-2.5 py-0.5 rounded-full bg-rescale-btn text-white font-display text-[11px] font-extrabold">
              v1.0
            </span>
            <span className="font-display text-[11.5px] font-bold uppercase tracking-[0.12em] text-[#545C9E]">
              Navigate Commerce with Clarity. · D2C Order &amp; RTO Intelligence
            </span>
          </div>

          <h1 className="mt-7 font-display text-[40px] sm:text-[56px] lg:text-[66px] font-extrabold text-[#465478] tracking-[-0.04em] leading-[1.06]">
            Amplify your D2C margin with{' '}
            <span className="rescale-gradient-text">Smart AI</span> order rescue.
          </h1>

          <p className="mt-5 text-[16px] sm:text-[18px] text-[#6A7594] max-w-2xl mx-auto leading-relaxed font-normal">
            Score Cash-on-Delivery risk with transparent reason codes, resolve missing landmarks via sub-rupee WhatsApp flows, and intercept NDR exceptions before reverse freight erodes your profit.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <Link to="/app/dashboard">
              <Button variant="primary" size="lg">
                Start Merchant Demo <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button variant="outline" size="lg">
                How It Works
              </Button>
            </a>
          </div>

          {/* Masked Ecosystem Ticker */}
          <div className="mt-14 pt-6">
            <div className="text-[11px] font-display font-bold uppercase tracking-[0.18em] text-[#95A0BA] mb-4">
              Built for Indian D2C Storefronts, Aggregators &amp; Last-Mile Workflows
            </div>
            <div className="rescale-ticker-mask flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[14px] font-display font-bold text-[#7C86A2]">
              <span>Shopify Webhooks</span>
              <span className="text-[#C7CEEC]">•</span>
              <span>WooCommerce</span>
              <span className="text-[#C7CEEC]">•</span>
              <span>WhatsApp Sandbox</span>
              <span className="text-[#C7CEEC]">•</span>
              <span>Delhivery NDR</span>
              <span className="text-[#C7CEEC]">•</span>
              <span>Shiprocket</span>
              <span className="text-[#C7CEEC]">•</span>
              <span>BlueDart</span>
              <span className="text-[#C7CEEC]">•</span>
              <span>Local CSV Intake</span>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCT SPOTLIGHT — Live Rescale Dashboard Preview + Interactive Sandbox */}
      <section id="spotlight" className="py-10 px-4 sm:px-8 relative">
        <div className="max-w-[1240px] mx-auto relative">
          <img
            src="/template-assets/float-sculpture.png"
            alt=""
            aria-hidden="true"
            className="hidden xl:block pointer-events-none absolute -right-12 -top-14 w-32 opacity-90 z-20"
          />

          {/* Translucent Frosted Bezel matching Rescale Spotlight */}
          <div className="rounded-[34px] p-3 sm:p-6 bg-white/75 backdrop-blur-xl border border-[#DFE1F5] shadow-panel space-y-6">
            {/* Miniature Rescale Dashboard Preview Header */}
            <div className="rounded-[26px] bg-[#F9FAFB] border border-[#E3E6FA] p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-4">
                  <OrdexaWordmark size="sm" />
                  <span className="hidden sm:inline-block h-4 w-[1px] bg-[#DFE1F5]" />
                  <span className="text-[12.5px] font-display font-semibold text-[#6E7896]">
                    Performance Overview · Live Merchant Console Preview
                  </span>
                </div>
                <Link to="/app/dashboard">
                  <Button variant="primary" size="sm">
                    Enter Full Console <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <KpiCard
                  title="Protected COD Margin"
                  value="₹48,620"
                  delta="+18.4% Net"
                  icon={ShieldCheck}
                  accent="coral"
                />
                <KpiCard
                  title="Orders Scored Today"
                  value="1,284"
                  delta="96.2% Auto"
                  icon={BarChart3}
                  accent="peri"
                />
                <KpiCard
                  title="Landmark Rescue Rate"
                  value="78.5%"
                  delta="₹0.90 / msg"
                  icon={Sparkles}
                  accent="pink"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-8 rescale-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-4 text-[12px] font-display font-semibold text-[#5C6888]">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#7584D6]" />
                        Verified Deliveries
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FA9A7C]" />
                        Flagged RTO Exposure
                      </span>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-[#F9FAFB] border border-[#DFE1F5] text-[11.5px] font-display font-semibold text-[#5C6888]">
                      8-Month Cohort
                    </span>
                  </div>
                  <MirroredCapsuleChart
                    data={MINI_CAPSULE_DATA}
                    topLabel="Verified Deliveries"
                    bottomLabel="RTO Exposure"
                    maxVal={60}
                    unitSuffix="K"
                  />
                </div>

                <div className="lg:col-span-4 rescale-card p-5">
                  <PopOutDonutChart
                    calloutTitle="AI Rescue"
                    calloutSubtitle="78.5% Win"
                    items={[
                      { name: 'WhatsApp Confirm', value: 36, color: '#FF9FD7' },
                      { name: 'Landmark Sync', value: 26, color: '#72E1FF' },
                      { name: 'NDR Re-attempt', value: 18, color: '#4A78D6' },
                      { name: 'Partial UPI', value: 20, color: '#8C8CF5' },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Interactive Live Pre-Dispatch Sandbox */}
            <HeroDemoWidget />
          </div>
        </div>
      </section>

      {/* FEATURES BENTO GRID — 01 to 04 with Dotted Pattern & Mesh Stripes */}
      <section id="features" className="py-20 px-4 sm:px-8">
        <div className="max-w-[1220px] mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <SectionEyebrow>Core Capabilities</SectionEyebrow>
            <h2 className="mt-4 font-display text-[32px] sm:text-[44px] font-extrabold text-[#465478] tracking-[-0.035em] leading-[1.12]">
              Every module needed to stop{' '}
              <span className="rescale-gradient-text">avoidable RTOs</span>.
            </h2>
            <p className="mt-3 text-[15px] text-[#6E7896]">
              Proportionate, explainable interventions across the entire post-checkout lifecycle.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {BENTO_FEATURES.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.num}
                  className="rescale-card rescale-card-hover p-7 sm:p-8 relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="rescale-dotted absolute inset-0 opacity-45 pointer-events-none" />
                  {i === 0 && (
                    <img
                      src="/template-assets/mesh-stripes.jpg"
                      alt=""
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-12 -bottom-12 w-56 h-56 object-cover opacity-15 rounded-full"
                    />
                  )}

                  <div className="relative z-10">
                    <div className="flex items-center justify-between gap-3 mb-6">
                      <span className="font-display text-[13px] font-extrabold text-[#7584D6] bg-[#F1F2F9] border border-[#E3E6FA] px-3 py-1 rounded-full">
                        {feat.num}
                      </span>
                      <span className="text-[11.5px] font-display font-semibold text-[#6E7896] bg-white/90 border border-[#E3E6FA] px-3 py-1 rounded-full">
                        {feat.tag}
                      </span>
                    </div>

                    <div className="flex items-start gap-4">
                      <IconTile icon={Icon} tone={feat.tone} size="lg" />
                      <div>
                        <h3 className="font-display text-[20px] font-bold text-[#465478] tracking-[-0.02em]">
                          {feat.title}
                        </h3>
                        <p className="mt-2 text-[14px] text-[#6A7594] leading-relaxed">
                          {feat.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 mt-7 pt-4 border-t border-[#EEF0FA] flex items-center justify-between">
                    <span className="text-[12px] font-display font-semibold text-[#8891AA]">
                      Merchant Console Module
                    </span>
                    <Link
                      to={feat.route}
                      className="inline-flex items-center gap-1.5 text-[13px] font-display font-bold text-[#545C9E] hover:text-[#465478]"
                    >
                      Explore Module <ArrowRight className="w-4 h-4 text-[#7584D6]" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — 4-Step Rescale Workflow Cards */}
      <section id="how-it-works" className="py-18 px-4 sm:px-8">
        <div className="max-w-[1220px] mx-auto rounded-[34px] bg-white border border-[#DFE1F5] shadow-rescale-card p-7 sm:p-12 relative overflow-hidden">
          <img
            src="/template-assets/pastel-glow.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 -bottom-24 w-80 h-80 object-cover opacity-50"
          />

          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <SectionEyebrow>How It Works</SectionEyebrow>
              <h2 className="mt-3 font-display text-[30px] sm:text-[38px] font-extrabold text-[#465478] tracking-[-0.03em]">
                From risky COD checkout to{' '}
                <span className="rescale-gradient-text">verified dispatch</span>.
              </h2>
            </div>
            <Link to="/app/orders">
              <Button variant="primary" size="md">
                Try Live CSV &amp; Queue <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {HOW_IT_WORKS_STEPS.map((st) => (
              <div
                key={st.step}
                className="rounded-[22px] bg-[#F9FAFB] border border-[#E3E6FA] p-6 flex flex-col justify-between hover:bg-white hover:shadow-rescale-card transition-all"
              >
                <div>
                  <span className="inline-block font-display text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-[#7584D6] bg-white border border-[#DFE1F5] px-3 py-1 rounded-full">
                    {st.step}
                  </span>
                  <h3 className="mt-4 font-display text-[17px] font-bold text-[#465478] leading-snug">
                    {st.title}
                  </h3>
                  <p className="mt-2 text-[13px] text-[#6E7896] leading-relaxed">{st.detail}</p>
                </div>
                <div className="mt-5 pt-3 border-t border-[#E8EBF8] flex items-center gap-1.5 text-[11.5px] font-display font-bold text-[#2EB37E]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Auditable Trail
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTEGRATION HUB — Featuring Template AI³ Sphere & Honest Mode Badges */}
      <section id="integration" className="py-20 px-4 sm:px-8">
        <div className="max-w-[1220px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5 text-center lg:text-left">
            <SectionEyebrow>Ecosystem &amp; Governance</SectionEyebrow>
            <h2 className="mt-4 font-display text-[32px] sm:text-[40px] font-extrabold text-[#465478] tracking-[-0.035em] leading-[1.12]">
              Connect storefronts without{' '}
              <span className="rescale-gradient-text">compromising</span> buyer privacy.
            </h2>
            <p className="mt-4 text-[14.5px] text-[#6A7594] leading-relaxed">
              NORTHSTAR clearly distinguishes live local features from simulated sandbox connectors and planned production APIs—so technical evaluators know exactly what runs today.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-3">
              <div className="rounded-full bg-white border border-[#DFE1F5] shadow-rescale-card px-4 py-2 flex items-center gap-2">
                <span className="font-display text-[16px] font-extrabold rescale-gradient-text">
                  100%
                </span>
                <span className="text-[12px] font-display font-semibold text-[#5C6888]">
                  Merchant-Scoped Data
                </span>
              </div>
              <div className="rounded-full bg-white border border-[#DFE1F5] shadow-rescale-card px-4 py-2 flex items-center gap-2">
                <span className="font-display text-[16px] font-extrabold rescale-gradient-text">
                  &lt; 50ms
                </span>
                <span className="text-[12px] font-display font-semibold text-[#5C6888]">
                  Deterministic Scoring
                </span>
              </div>
            </div>

            <div className="mt-7">
              <Link to="/app/integrations">
                <Button variant="outline" size="lg">
                  Inspect Integration Status <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5 items-center">
            {/* Centerpiece AI Sphere Card from Rescale Template */}
            <div className="rescale-card p-7 flex flex-col items-center text-center relative overflow-hidden">
              <div className="rescale-dotted absolute inset-0 opacity-40 pointer-events-none" />
              <img
                src="/template-assets/ai-sphere.png"
                alt="NORTHSTAR Order Intelligence Core"
                className="w-36 h-36 object-contain drop-shadow-md relative z-10"
              />
              <h3 className="mt-4 font-display text-[18px] font-bold text-[#465478] relative z-10">
                Unified Decision Core
              </h3>
              <p className="mt-1.5 text-[12.5px] text-[#6E7896] relative z-10">
                Combines rules-based scoring, merchant-scoped buyer history, and live threshold controls.
              </p>
            </div>

            {/* Honest Capability Tiers */}
            <div className="space-y-4">
              <div className="rescale-card p-5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-display text-[14px] font-bold text-[#465478] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#2EB37E]" /> Live Local Execution
                  </span>
                  <span className="text-[10.5px] font-display font-bold px-2.5 py-0.5 rounded-full bg-[#ECFEF6] text-[#17825B] border border-[#C3F3DE]">
                    LIVE
                  </span>
                </div>
                <p className="text-[12.5px] text-[#6E7896]">
                  CSV order import, manual intake, risk re-scoring, Customer Graph merge/separate, and ROI accounting.
                </p>
              </div>

              <div className="rescale-card p-5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-display text-[14px] font-bold text-[#465478] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#7584D6]" /> Interactive Sandbox
                  </span>
                  <span className="text-[10.5px] font-display font-bold px-2.5 py-0.5 rounded-full bg-[#EEF2FF] text-[#545C9E] border border-[#DFE1F5]">
                    SIMULATED
                  </span>
                </div>
                <p className="text-[12.5px] text-[#6E7896]">
                  Shopify &amp; WooCommerce webhooks, WhatsApp/SMS/Voice IVR handset threads, and courier NDR recovery.
                </p>
              </div>

              <div className="rescale-card p-5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-display text-[14px] font-bold text-[#465478] flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#FA6E43]" /> Production Roadmap
                  </span>
                  <span className="text-[10.5px] font-display font-bold px-2.5 py-0.5 rounded-full bg-[#FFF5ED] text-[#D96030] border border-[#FDE0CA]">
                    PLANNED
                  </span>
                </div>
                <p className="text-[12.5px] text-[#6E7896]">
                  OAuth Shopify App install, Meta Cloud BSP templates, live Shiprocket/Delhivery webhooks, and ML v2.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROI CALCULATOR */}
      <RoiCalculator />

      {/* FAQ ACCORDION */}
      <section id="faq" className="py-18 px-4 sm:px-8">
        <div className="max-w-[860px] mx-auto">
          <div className="text-center mb-10">
            <SectionEyebrow>Questions &amp; Architecture</SectionEyebrow>
            <h2 className="mt-4 font-display text-[30px] sm:text-[38px] font-extrabold text-[#465478] tracking-[-0.03em]">
              Frequently asked <span className="rescale-gradient-text">questions</span>.
            </h2>
          </div>

          <div className="space-y-3.5">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="rescale-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                    className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left"
                  >
                    <span className="font-display text-[15.5px] font-bold text-[#465478]">
                      {item.q}
                    </span>
                    <span
                      className={`w-8 h-8 rounded-full bg-[#F1F2F9] border border-[#DFE1F5] flex items-center justify-center text-[#7584D6] flex-shrink-0 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-[13.5px] text-[#6A7594] leading-relaxed border-t border-[#F1F2F9] pt-4">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* BOTTOM LAUNCH CONSOLE CTA BANNER */}
      <section className="py-16 px-4 sm:px-8">
        <div className="max-w-[1140px] mx-auto rounded-[34px] bg-white border border-[#DFE1F5] shadow-panel p-8 sm:p-14 text-center relative overflow-hidden">
          <img
            src="/template-assets/hero-wave-1.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-55"
          />
          <div className="relative z-10 max-w-2xl mx-auto">
            <SectionEyebrow>Ready to Explore</SectionEyebrow>
            <h2 className="mt-4 font-display text-[32px] sm:text-[44px] font-extrabold text-[#465478] tracking-[-0.035em] leading-[1.1]">
              Experience the full{' '}
              <span className="rescale-gradient-text">NORTHSTAR Console</span> now.
            </h2>
            <p className="mt-3 text-[15px] text-[#6A7594]">
              Inspect all 9 operational modules—Dashboard, Order Queue, Customer Intelligence Graph, WhatsApp Rescue Sandbox, NDR Recovery, Analytics, Financial Ledger, Integrations, and Settings.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3.5">
              <Link to="/app/dashboard">
                <Button variant="primary" size="lg">
                  Launch Merchant Console <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/app/rescue">
                <Button variant="outline" size="lg">
                  Open AI RTO Rescue
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* PEARL FOOTER */}
      <footer className="border-t border-[#DFE1F5] bg-white/70 py-12 px-4 sm:px-8">
        <div className="max-w-[1220px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-[#EEF0FA]">
          <div className="md:col-span-5">
            <OrdexaWordmark size="md" />
            <p className="mt-3 text-[13px] text-[#6E7896] max-w-sm leading-relaxed">
              Navigate Commerce with Clarity. Explainable pre-dispatch RTO prevention, merchant-scoped buyer intelligence, and NDR recovery built for modern D2C commerce.
            </p>
          </div>

          <div className="md:col-span-3 space-y-2 text-[13px]">
            <div className="font-display font-bold text-[#465478] mb-2">Operations</div>
            <Link to="/app/dashboard" className="block text-[#6E7896] hover:text-[#465478]">
              Dashboard Overview
            </Link>
            <Link to="/app/orders" className="block text-[#6E7896] hover:text-[#465478]">
              Order Management &amp; CSV
            </Link>
            <Link to="/app/graph" className="block text-[#6E7896] hover:text-[#465478]">
              Customer Intelligence Graph
            </Link>
            <Link to="/app/rescue" className="block text-[#6E7896] hover:text-[#465478]">
              AI RTO Rescue Sandbox
            </Link>
          </div>

          <div className="md:col-span-4 space-y-2 text-[13px]">
            <div className="font-display font-bold text-[#465478] mb-2">Insights &amp; Governance</div>
            <Link to="/app/ndr" className="block text-[#6E7896] hover:text-[#465478]">
              NDR Exception Recovery
            </Link>
            <Link to="/app/analytics" className="block text-[#6E7896] hover:text-[#465478]">
              Cohort &amp; PIN Analytics
            </Link>
            <Link to="/app/financial" className="block text-[#6E7896] hover:text-[#465478]">
              Financial Intelligence Ledger
            </Link>
            <Link to="/app/settings" className="block text-[#6E7896] hover:text-[#465478]">
              Rules &amp; Privacy Governance
            </Link>
          </div>
        </div>

        <div className="max-w-[1220px] mx-auto pt-6 flex flex-wrap items-center justify-between gap-3 text-[12px] text-[#8891AA]">
          <span>© {new Date().getFullYear()} NORTHSTAR — Navigate Commerce with Clarity. Merchant-Scoped Demo Suite.</span>
          <span>Rules-Based Scoring v1.0 · Privacy-First Architecture</span>
        </div>
      </footer>
    </div>
  );
}
