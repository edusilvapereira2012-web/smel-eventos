'use client';

import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from './ui/button';

export function PwaInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent default install bar
      e.preventDefault();
      // Store event
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if app is already installed/standalone
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show prompt
    deferredPrompt.prompt();

    // Wait for choice
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the PWA install prompt');
    } else {
      console.log('User dismissed the PWA install prompt');
    }

    // Clear prompt
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  if (!isInstallable) return null;

  return (
    <Button
      onClick={handleInstallClick}
      variant="outline"
      size="sm"
      className="bg-violet-950/40 hover:bg-violet-900/40 border-violet-850 text-violet-300 hover:text-white font-semibold transition duration-200 gap-2 text-xs h-9 px-3 rounded-lg"
    >
      <Download className="h-4 w-4" />
      <span>Instalar App</span>
    </Button>
  );
}
