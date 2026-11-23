import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Ban,
  MapPinOff,
  UserX,
  Truck,
  TrendingDown,
  Layers,
  EyeOff,
  Share2,
  ShieldCheck,
  CheckCircle2,
  Menu,
  X,
  PhoneCall,
  MapPin,
} from 'lucide-react';
import { BrandLogo } from '../components/ui/BrandLogo';
import { Button, SectionEyebrow } from '../components/ui/Primitives';
import { HeroDemoWidget } from '../components/landing/HeroDemoWidget';
import { RoiCalculator } from '../components/landing/RoiCalculator';

const PROBLEMS = [
  {
    icon: Ban,
    title: 'COD Order Refusals',
    desc: 'Impulse or unverified Cash-on-Delivery orders rejected at the doorstep wipe out contribution margins.',
  },
  {
    icon: MapPinOff,
    title: 'Incomplete Addresses',
    desc: 'Missing house numbers and landmarks in Tier-2/3 PIN codes cause avoidable "Address Not Found" NDRs.',
  },
  {
    icon: UserX,
    title: 'Fake or Unverified Orders',
    desc: 'Bot submissions, wrong phone numbers, and prank COD checkouts consume warehouse packing & freight.',
  },
  {
    icon: Truck,
    title: 'Failed Delivery Attempts',
    desc: 'Uncoordinated courier attempts without buyer availability confirmation spiral straight into RTO.',
  },
  {
    icon: TrendingDown,
    title: 'Expensive Reverse Logistics',
    desc: 'Merchants pay forward shipping, reverse freight, COD fees, and damaged inventory write-offs twice over.',
  },
  {
    icon: Layers,
    title: 'Fragmented Order Management',
    desc: 'Orders scattered across Shopify, WooCommerce, WhatsApp, and CSVs lack a unified verification layer.',
  },
  {
    icon: EyeOff,
    title: 'No Customer Delivery Intelligence',
    desc: 'Without linking history across your own stores, repeat delivery risks go unnoticed until dispatch.',
  },
];

const WORKFLOW_STEPS = [
  { num: '01', title: 'Order Ingestion', desc: 'Capture orders from Shopify, WooCommerce, WhatsApp, or CSV in one unified queue.' },
  { num: '02', title: 'Customer Intelligence', desc: 'Resolve merchant-scoped delivery history, addresses, and responsiveness.' },
  { num: '03', title: 'Risk Diagnosis', desc: 'Generate transparent reason codes (e.g., ADDRESS_INCOMPLETE) and attention levels.' },
  { num: '04', title: 'Recommended Intervention', desc: 'Select the least intrusive, lowest-cost action matched to the exact uncertainty.' },
  { num: '05', title: 'Customer Confirmation', desc: 'Verify intent or capture missing landmarks via WhatsApp, SMS, or Voice.' },
  { num: '06', title: 'Dispatch', desc: 'Approve verified orders with enriched addresses for clean first-attempt delivery.' },
  { num: '07', title: 'Delivery Outcome', desc: 'Track delivered, NDR recovery, and RTO events across courier partners.' },
  { num: '08', title: 'Continuous Learning', desc: 'Feed outcomes back into your merchant graph to sharpen future decisions.' },
];

const INTEGRATIONS = [
  {
    category: 'E-Commerce',
    items: [
      { name: 'Shopify', status: 'Simulated (Demo)' },
      { name: 'WooCommerce', status: 'Simulated (Demo)' },
      { name: 'Wix', status: 'Planned Roadmap' },
      { name: 'BigCommerce', status: 'Planned Roadmap' },
    ],
  },
  {
    category: 'Social Commerce',
    items: [
      { name: 'WhatsApp', status: 'Simulated (Demo)' },
      { name: 'Instagram', status: 'Planned Roadmap' },
      { name: 'CSV Upload', status: 'Live (Local)' },
    ],
  },
  {
    category: 'Logistics',
    items: [
      { name: 'Shiprocket', status: 'Simulated (Demo)' },
      { name: 'Delhivery', status: 'Simulated (Demo)' },
      { name: 'ClickPost', status: 'Simulated (Demo)' },
      { name: 'Blue Dart', status: 'Simulated (Demo)' },
      { name: 'Shadowfax', status: 'Simulated (Demo)' },
    ],
  },
  {
    category: 'Dropshipping & Suppliers',
    items: [
      { name: 'IndiaMART', status: 'Planned Roadmap' },
      { name: 'Meesho', status: 'Planned Roadmap' },
      { name: 'Supplier CSV Feeds', status: 'Live (Local)' },
    ],
  },
];

function IntegrationBadge({ status }) {
  if (status === 'Live (Local)') {
    return (
      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
        {status}
      </span>
    );
  }
  if (status === 'Simulated (Demo)') {
    return (
      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 bg-gold-subtle text-navy border border-gold">
        {status}
      </span>
    );
  }
  return (
    <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200">
      {status}
    </span>
  );
}

export function LandingPage() {
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white text-slateMuted">
      {/* Top Info Strip */}
      <div className="bg-navy border-b border-white/10 text-xs text-slate-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-gold" />
            <span>Built for Indian D2C Brands, Social Commerce &amp; High-COD Sellers</span>
          </div>
          <div className="flex items-center gap-2">
            <PhoneCall className="w-3.5 h-3.5 text-gold" />
            <span>
              Interactive Prototype • <span className="text-gold font-semibold">Zero API Keys Required</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <header className="sticky top-0 z-40 bg-navy">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="bg-navy-dark flex items-center justify-between border-b border-white/10">
            <Link to="/" className="flex-shrink-0">
              <BrandLogo variant="block" />
            </Link>

            <div className="hidden lg:flex items-center gap-7 px-6">
              <a href="#problems" className="text-sm text-slate-200 hover:text-gold transition-colors">
                The RTO Problem
              </a>
              <a href="#usps" className="text-sm text-slate-200 hover:text-gold transition-colors">
                Core Intelligence
              </a>
              <a href="#how-it-works" className="text-sm text-slate-200 hover:text-gold transition-colors">
                How It Works
              </a>
              <a href="#roi-calculator" className="text-sm text-slate-200 hover:text-gold transition-colors">
                ROI Calculator
              </a>
              <a href="#integrations" className="text-sm text-slate-200 hover:text-gold transition-colors">
                Integrations
              </a>
              <Link to="/app/dashboard">
                <Button variant="primary" size="sm">
                  Launch Merchant Demo
                </Button>
              </Link>
            </div>

            <button
              onClick={() => setMobileMenu((v) => !v)}
              className="lg:hidden p-4 text-white hover:text-gold"
              aria-label="Toggle menu"
            >
              {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </nav>

          {mobileMenu && (
            <div className="lg:hidden bg-navy-dark border-b border-gold/30 px-6 py-4 space-y-3">
              <a href="#problems" onClick={() => setMobileMenu(false)} className="block text-sm text-white hover:text-gold">
                The RTO Problem
              </a>
              <a href="#usps" onClick={() => setMobileMenu(false)} className="block text-sm text-white hover:text-gold">
                Core Intelligence
              </a>
              <a href="#how-it-works" onClick={() => setMobileMenu(false)} className="block text-sm text-white hover:text-gold">
                How It Works
              </a>
              <a href="#roi-calculator" onClick={() => setMobileMenu(false)} className="block text-sm text-white hover:text-gold">
                ROI Calculator
              </a>
              <a href="#integrations" onClick={() => setMobileMenu(false)} className="block text-sm text-white hover:text-gold">
                Integrations
              </a>
              <Link to="/app/dashboard" className="block pt-2">
                <Button variant="primary" className="w-full">
                  Launch Merchant Demo
                </Button>
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* A. HERO SECTION */}
      <section className="bg-navy text-white pt-12 pb-16 lg:pt-16 lg:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <div className="lg:col-span-6">
              <SectionEyebrow light className="mb-4">
                ORDEXA — Intelligence Behind Every Order
              </SectionEyebrow>
              <h1 className="font-serif text-4xl sm:text-5xl font-bold leading-[1.15] text-white">
                <span className="text-gold">Don&apos;t Just Predict</span> Failed Deliveries.{' '}
                <span className="text-gold">Rescue Them.</span>
              </h1>
              <p className="mt-5 text-base text-slate-300 leading-relaxed max-w-xl">
                ORDEXA is an intelligent order management and RTO prevention platform that
                understands customer delivery behaviour, identifies operational risks and recommends
                proportionate interventions before costly returns happen.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link to="/app/dashboard">
                  <Button variant="primary" size="lg">
                    Launch Merchant Demo <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <a href="#how-it-works">
                  <Button variant="outlineLight" size="lg">
                    Explore How It Works
                  </Button>
                </a>
              </div>
            </div>

            <div className="lg:col-span-6">
              <HeroDemoWidget />
            </div>
          </div>

          {/* Architectural Dark Stat Strip */}
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-navy-dark border border-white/10 p-6 text-center">
              <div className="font-serif text-3xl font-bold text-gold">₹170 – ₹240</div>
              <div className="text-xs uppercase tracking-wider text-slate-300 mt-1.5">
                Typical Round-Trip Freight Lost Per COD RTO
              </div>
            </div>
            <div className="bg-navy-dark border border-white/10 p-6 text-center">
              <div className="font-serif text-3xl font-bold text-white">₹0.90</div>
              <div className="text-xs uppercase tracking-wider text-slate-300 mt-1.5">
                Proportionate WhatsApp Clarification Cost
              </div>
            </div>
            <div className="bg-navy-dark border border-white/10 p-6 text-center">
              <div className="font-serif text-3xl font-bold text-gold">100%</div>
              <div className="text-xs uppercase tracking-wider text-slate-300 mt-1.5">
                Merchant-Scoped, Explainable Risk Rules
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* B. PROBLEM SECTION */}
      <section id="problems" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <SectionEyebrow className="mb-3 justify-center">The Indian D2C Reality</SectionEyebrow>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-navy">
              Why Cash-on-Delivery Silently Erodes D2C Profit Margins
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-l border-slate-200">
            {PROBLEMS.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.title}
                  className="p-7 border-r border-b border-slate-200 hover:bg-gold-subtle/35 transition-colors"
                >
                  <div className="w-11 h-11 bg-navy text-gold flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif text-lg font-bold text-navy">{p.title}</h3>
                  <p className="text-sm text-slateMuted mt-2 leading-relaxed">{p.desc}</p>
                </div>
              );
            })}
            {/* Callout Tile completing the 3x3 or 2x4 grid */}
            <div className="p-7 border-r border-b border-slate-200 bg-navy text-white flex flex-col justify-between md:col-span-2 lg:col-span-2">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-gold font-semibold">
                  The ORDEXA Shift
                </div>
                <h3 className="font-serif text-2xl font-bold text-white mt-2">
                  Stop Blocking Good Buyers. Intervene Only Where Uncertainty Exists.
                </h3>
                <p className="text-sm text-slate-300 mt-2.5 max-w-xl leading-relaxed">
                  Blanket COD cancellation destroys conversion. ORDEXA diagnoses the exact
                  operational gap—whether a missing landmark, unverified intent, or prior delivery
                  exception—and triggers a proportionate rescue action.
                </p>
              </div>
              <div className="mt-6">
                <Link to="/app/rescue">
                  <Button variant="primary" size="sm">
                    Open AI RTO Rescue Centre <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* C. TWO CORE USPs */}
      <section id="usps" className="py-20 bg-surface-muted border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <SectionEyebrow className="mb-3">Platform Architecture</SectionEyebrow>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-navy">
              Two Purpose-Built Intelligence Engines
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* USP 1 */}
            <div className="bg-white border border-slate-200 border-t-4 border-t-navy p-8 shadow-card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-gold-hover">
                    USP 01
                  </span>
                  <div className="w-11 h-11 bg-surface-muted text-navy flex items-center justify-center">
                    <Share2 className="w-5 h-5 text-gold-hover" />
                  </div>
                </div>
                <h3 className="font-serif text-2xl font-bold text-navy">
                  Customer Intelligence Graph
                </h3>
                <p className="mt-3 text-sm text-slateMuted leading-relaxed">
                  Connects customer order history, verified addresses, payment behaviour, prior
                  interventions, and courier delivery outcomes across all of a merchant&apos;s own
                  stores—strictly merchant-scoped with auditable identity resolution.
                </p>
                <ul className="mt-5 space-y-2.5 text-sm text-navy">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-gold-hover mt-0.5 flex-shrink-0" />
                    <span>Unified buyer timeline across Shopify, WooCommerce &amp; CSV channels</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-gold-hover mt-0.5 flex-shrink-0" />
                    <span>Evidence-backed identity resolution with manual merge/split controls</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-gold-hover mt-0.5 flex-shrink-0" />
                    <span>Zero unrestricted cross-merchant blacklists</span>
                  </li>
                </ul>
              </div>
              <div className="mt-7 pt-5 border-t border-slate-100">
                <Link to="/app/graph" className="text-xs font-serif font-bold uppercase tracking-wider text-navy hover:text-gold-hover inline-flex items-center gap-1.5">
                  Explore Customer Graph <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* USP 2 */}
            <div className="bg-white border border-slate-200 border-t-4 border-t-gold p-8 shadow-card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-gold-hover">
                    USP 02
                  </span>
                  <div className="w-11 h-11 bg-surface-muted text-navy flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-gold-hover" />
                  </div>
                </div>
                <h3 className="font-serif text-2xl font-bold text-navy">
                  AI RTO Rescue Engine
                </h3>
                <p className="mt-3 text-sm text-slateMuted leading-relaxed">
                  Diagnoses specific delivery uncertainties with transparent reason codes and
                  recommends the least intrusive, most cost-effective intervention—keeping your
                  ops team in full human-in-the-loop control.
                </p>
                <ul className="mt-5 space-y-2.5 text-sm text-navy">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-gold-hover mt-0.5 flex-shrink-0" />
                    <span>Missing Landmark → ₹0.90 WhatsApp Address Clarification</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-gold-hover mt-0.5 flex-shrink-0" />
                    <span>High-Value COD → Optional Partial UPI Advance + Incentive</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-gold-hover mt-0.5 flex-shrink-0" />
                    <span>Verified Returning Buyer → Instant Auto-Approve for Dispatch</span>
                  </li>
                </ul>
              </div>
              <div className="mt-7 pt-5 border-t border-slate-100">
                <Link to="/app/rescue" className="text-xs font-serif font-bold uppercase tracking-wider text-navy hover:text-gold-hover inline-flex items-center gap-1.5">
                  Try Rescue Engine &amp; Sandbox <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* D. HOW ORDEXA WORKS */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <SectionEyebrow className="mb-3 justify-center">Closed-Loop Workflow</SectionEyebrow>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-navy">
              How ORDEXA Rescues Orders End to End
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {WORKFLOW_STEPS.map((step) => (
              <div
                key={step.num}
                className="bg-white border border-slate-200 p-6 hover:border-gold transition-colors relative"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="ordexa-outline-num text-4xl font-bold leading-none">
                    {step.num}
                  </span>
                  <ArrowRight className="w-4 h-4 text-gold" />
                </div>
                <h3 className="font-serif text-base font-bold text-navy">{step.title}</h3>
                <p className="text-xs text-slateMuted mt-2 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* E. INTERACTIVE ROI CALCULATOR */}
      <RoiCalculator />

      {/* F. INTEGRATIONS SECTION */}
      <section id="integrations" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div>
              <SectionEyebrow className="mb-3">Ecosystem &amp; Roadmap</SectionEyebrow>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-navy">
                Transparent Integration Readiness
              </h2>
            </div>
            <p className="text-xs text-slateMuted max-w-md">
              We clearly label local working imports, interactive demo simulations, and planned
              production connectors—never presenting unimplemented APIs as live.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {INTEGRATIONS.map((group) => (
              <div key={group.category} className="border border-slate-200 bg-white">
                <div className="px-5 py-3.5 bg-navy text-white font-serif text-sm font-semibold border-b border-gold/40">
                  {group.category}
                </div>
                <ul className="divide-y divide-slate-100">
                  {group.items.map((item) => (
                    <li
                      key={item.name}
                      className="px-5 py-3 flex items-center justify-between gap-2"
                    >
                      <span className="text-sm font-medium text-navy">{item.name}</span>
                      <IntegrationBadge status={item.status} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* G. FINAL CTA */}
      <section className="bg-navy text-white py-20 border-t-4 border-t-gold">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <SectionEyebrow light className="mb-4 justify-center">
            Ready for Live Inspection
          </SectionEyebrow>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white">
            Every Order Deserves a Better Chance of Delivery.
          </h2>
          <p className="mt-4 text-slate-300 max-w-xl mx-auto text-sm leading-relaxed">
            Walk through the full merchant experience—from COD webhook ingestion and Customer
            Intelligence Graph resolution to WhatsApp rescue and NDR recovery.
          </p>
          <div className="mt-8">
            <Link to="/app/dashboard">
              <Button variant="primary" size="lg">
                Enter ORDEXA Dashboard <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Executive Footer */}
      <footer className="bg-navy-dark text-slate-300 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <BrandLogo variant="inline" />
            <p className="text-xs text-slate-400 mt-4 max-w-md leading-relaxed">
              ORDEXA — Intelligence Behind Every Order. An AI-assisted order management and RTO
              prevention workspace built for Indian D2C commerce.
            </p>
          </div>
          <div>
            <div className="font-serif text-sm font-semibold text-white mb-3">Merchant Modules</div>
            <ul className="space-y-2 text-xs">
              <li><Link to="/app/dashboard" className="hover:text-gold">Executive Dashboard</Link></li>
              <li><Link to="/app/orders" className="hover:text-gold">Order Intelligence Queue</Link></li>
              <li><Link to="/app/graph" className="hover:text-gold">Customer Intelligence Graph</Link></li>
              <li><Link to="/app/rescue" className="hover:text-gold">AI RTO Rescue Centre</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-serif text-sm font-semibold text-white mb-3">Operations</div>
            <ul className="space-y-2 text-xs">
              <li><Link to="/app/ndr" className="hover:text-gold">Logistics &amp; NDR Recovery</Link></li>
              <li><Link to="/app/analytics" className="hover:text-gold">Financial Leakage Analytics</Link></li>
              <li><Link to="/app/settings" className="hover:text-gold">Store Settings &amp; Governance</Link></li>
            </ul>
          </div>
        </div>
        <div className="bg-navy-deep py-4 text-center text-xs text-slate-400 border-t border-white/5">
          © 2026 ORDEXA Technologies. Interactive SaaS Prototype — Simulated Operational Data.
        </div>
      </footer>
    </div>
  );
}
