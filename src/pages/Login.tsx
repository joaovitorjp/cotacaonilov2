import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { buildExternalGoogleOAuthUrl, isLovableHosted } from '@/lib/oauth';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthPage } from '@/components/ui/auth-page';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const oauthError = searchParams.get('oauth_error');
    if (!oauthError) return;

    toast.error(decodeURIComponent(oauthError));
    navigate('/login', { replace: true });
  }, [navigate, searchParams]);

  const rawNext = searchParams.get('next') || '';
  const safeNext = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '';
  const goNext = () => navigate(safeNext || '/');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Preencha email e senha.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error('Credenciais inválidas.');
    } else {
      goNext();
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !nome) {
      toast.error('Preencha todos os campos.');
      return;
    }
    if (password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nome },
        emailRedirectTo: window.location.origin + (safeNext || ''),
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Cadastro realizado! Verifique seu email para confirmar o acesso.');
      setIsSignUp(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      if (!isLovableHosted()) {
        window.location.assign(buildExternalGoogleOAuthUrl());
        return;
      }

      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin + (safeNext || ''),
      });
      if (result.error) {
        const msg = (result.error.message || '').toLowerCase();
        if (msg.includes('cancel') || msg.includes('closed') || msg.includes('popup') || msg.includes('denied') || msg.includes('abort')) {
          toast.error('Login com Google cancelado.');
        } else if (msg.includes('network') || msg.includes('fetch')) {
          toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
        } else if (msg.includes('unsupported provider') || msg.includes('provider')) {
          toast.error('Provedor Google não está configurado. Contate o administrador.');
        } else {
          toast.error(`Falha ao entrar com Google: ${result.error.message || 'erro desconhecido'}`);
        }
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) return;
      goNext();
    } catch (err: any) {
      toast.error(`Erro inesperado: ${err?.message || 'tente novamente'}`);
      setGoogleLoading(false);
    }
  };

  return (
    <AuthPage 
      onGoogleSignIn={handleGoogleSignIn}
      onEmailSignIn={isSignUp ? handleSignUp : handleLogin}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      nome={nome}
      setNome={setNome}
      isSignUp={isSignUp}
      setIsSignUp={setIsSignUp}
      loading={loading}
      googleLoading={googleLoading}
    />
  );
};

export default Login;
