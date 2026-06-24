import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildExternalGoogleOAuthUrl } from '@/lib/oauth';

const OAuthInitiate = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.get('provider');
    const state = params.get('state') || undefined;

    if (provider && provider !== 'google') {
      navigate('/login?oauth_error=Provedor%20nao%20suportado', { replace: true });
      return;
    }

    window.location.replace(buildExternalGoogleOAuthUrl(state));
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">Abrindo Google</h1>
        <p className="mt-2 text-sm text-muted-foreground">Redirecionando para autenticação segura.</p>
      </div>
    </main>
  );
};

export default OAuthInitiate;