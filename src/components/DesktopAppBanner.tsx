import React, { useEffect, useState } from 'react';
import { Download, Monitor, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import desktopAsset from '@/assets/CotacaoNilo-desktop-linux-x64.tar.gz.asset.json';

const DISMISS_KEY = 'desktop_app_banner_dismissed';
const AUTO_HIDE_MS = 8000;

const DESKTOP_DOWNLOAD_URL = desktopAsset.url;

const DesktopAppBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const alreadyDismissed = sessionStorage.getItem(DISMISS_KEY);
    if (alreadyDismissed) return;

    // Pequeno atraso para não bloquear a renderização inicial.
    const showTimer = setTimeout(() => setVisible(true), 600);

    const hideTimer = setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem(DISMISS_KEY, '1');
    }, AUTO_HIDE_MS);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
    sessionStorage.setItem(DISMISS_KEY, '1');
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = DESKTOP_DOWNLOAD_URL;
    a.download = 'CotacaoNilo-desktop-linux-x64.tar.gz';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!visible) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,520px)] animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="bg-card border border-border rounded-xl shadow-2xl p-4 flex items-start gap-3">
        <div className="shrink-0 h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Monitor className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-sm text-foreground leading-tight">
            App desktop disponível
          </h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Baixe o Nilo Atacadista para usar diretamente no seu computador, com acesso rápido e sem depender do navegador.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <Button onClick={handleDownload} size="sm" className="text-xs h-8">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Baixar app
            </Button>
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={handleClose}>
              Agora não
            </Button>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="shrink-0 h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default DesktopAppBanner;
