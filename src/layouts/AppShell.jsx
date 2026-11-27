import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { TopHeader } from '../components/layout/TopHeader';
import { ToastContainer } from '../components/ui/Primitives';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen flex items-start bg-[#F9FAFB] text-[#465478] relative">
      {/* Subtle Top-Right Pastel Ambient Glow matching Rescale Canvas */}
      <div
        className="pointer-events-none fixed -top-32 right-0 w-[520px] h-[520px] rounded-full opacity-45 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(227,230,250,0.85) 0%, rgba(128,229,255,0.18) 55%, rgba(249,250,251,0) 100%)',
        }}
        aria-hidden="true"
      />

      <Sidebar
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <TopHeader onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="flex-1 px-4 sm:px-8 pb-12 pt-2">
          <div className="max-w-[1400px] mx-auto">
            <ErrorBoundary title="View Rendering Error">
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>

      <ErrorBoundary fallback={null}>
        <ToastContainer />
      </ErrorBoundary>
    </div>
  );
}
