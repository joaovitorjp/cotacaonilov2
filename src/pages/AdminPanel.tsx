import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SpreadsheetTable from '@/components/SpreadsheetTable';
import AnalisePrecosPanel from '@/components/AnalisePrecosPanel';
import { toast } from 'sonner';
import { LogOut, Search, Shield, ArrowLeft, FileText, Eye, Package, Users, Calendar, BarChart3, Table as TableIcon } from 'lucide-react';

interface Lista {
  id: string;
  nome: string;
  status: string;
  produtos: { codigo_interno: string; descricao: string; codigo_barras: string }[];
  created_at: string;
  user_id: string;
}

interface Profile {
  user_id: string;
  nome: string;
  email: string;
}

interface RespostaEmpresa {
  empresa: string;
  resposta: any[];
}

const AdminPanel: React.FC = () => {
  const { user, signOut } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  const [listas, setListas] = useState<Lista[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'aberta' | 'finalizada'>('all');
  const [currentLista, setCurrentLista] = useState<Lista | null>(null);
  const [respostas, setRespostas] = useState<RespostaEmpresa[]>([]);
  const [activeTab, setActiveTab] = useState<'planilha' | 'analise'>('planilha');

  useEffect(() => {
    if (roleLoading) return;
    if (!isAdmin) {
      navigate('/', { replace: true });
      return;
    }
    void fetchAll();
  }, [isAdmin, roleLoading, navigate]);

  const fetchAll = async () => {
    setLoading(true);
    const [listasRes, profilesRes] = await Promise.all([
      supabase.from('listas').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('user_id, nome, email'),
    ]);
    setListas((listasRes.data ?? []).map((l: any) => ({ ...l, produtos: l.produtos as any[] })));
    const map: Record<string, Profile> = {};
    (profilesRes.data ?? []).forEach((p: any) => { map[p.user_id] = p; });
    setProfiles(map);
    setLoading(false);
  };

  const openLista = async (lista: Lista) => {
    setCurrentLista(lista);
    setActiveTab('planilha');
    const { data } = await supabase
      .from('respostas')
      .select('empresa, resposta')
      .eq('lista_id', lista.id);
    setRespostas((data ?? []).map((d: any) => ({ empresa: d.empresa, resposta: d.resposta as any[] })));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listas.filter(l => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (!q) return true;
      const owner = profiles[l.user_id];
      const ownerMatch = owner?.nome?.toLowerCase().includes(q) || owner?.email?.toLowerCase().includes(q);
      const nameMatch = l.nome.toLowerCase().includes(q);
      return nameMatch || ownerMatch;
    });
  }, [listas, profiles, search, statusFilter]);

  if (roleLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Verificando acesso...</p>
      </div>
    );
  }

  if (currentLista) {
    return (
      <div className="flex flex-col h-screen">
        <header className="bg-background border-b border-border/50 px-4 sm:px-10 py-5 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-sm shadow-black/[0.01]">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setCurrentLista(null)} 
              className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/60 rounded-2xl transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="font-display font-bold text-sm text-foreground uppercase tracking-widest">Sair da Visualização</span>
            </button>
            <div className="w-px h-8 bg-border/60" />
            <div className="flex items-center gap-2.5 px-4 py-1.5 bg-primary/5 border border-primary/10 rounded-xl">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Monitoramento Admin</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
             <div className="hidden sm:flex flex-col items-end gap-0.5">
              <span className="text-xs font-bold text-foreground">Acesso Administrativo</span>
              <span className="text-[10px] text-muted-foreground font-medium opacity-60">{user?.email}</span>
            </div>
            <div className="w-px h-8 bg-border/60 mx-1 hidden sm:block" />
            <Button variant="ghost" size="icon" onClick={signOut} className="rounded-2xl hover:bg-destructive/10 hover:text-destructive transition-all duration-300">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="shrink-0 border-b border-border bg-card/60 backdrop-blur-xl sticky top-0 z-20 shadow-sm shadow-black/[0.01]">
          <div className="px-4 sm:px-10 py-6 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-4">
                <h2 className="font-display font-bold text-2xl text-foreground tracking-tight">{currentLista.nome}</h2>
                <span className={`text-[10px] px-3 py-1 rounded-lg font-bold uppercase tracking-[0.2em] shadow-sm ${
                  currentLista.status === 'finalizada' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
                }`}>
                  {currentLista.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-bold uppercase tracking-tighter">
                <span className="flex items-center gap-1.5 opacity-80">
                  <Package className="w-3.5 h-3.5 text-primary/40" />
                  <strong className="text-foreground">{currentLista.produtos.length}</strong> Produtos
                </span>
                <div className="w-1 h-1 rounded-full bg-border" />
                <span className="flex items-center gap-1.5 opacity-80">
                  <Users className="w-3.5 h-3.5 text-primary/40" />
                  <strong className="text-foreground">{respostas.length}</strong> Respostas
                </span>
                <div className="w-1 h-1 rounded-full bg-border" />
                <span className="truncate opacity-80">
                  Dono: <strong className="text-foreground">{profiles[currentLista.user_id]?.nome || 'Sem nome'}</strong>
                </span>
              </div>
            </div>
            
            <div className="flex p-1.5 bg-muted/40 rounded-[1.25rem] w-fit ring-1 ring-black/[0.03]">
              <button
                onClick={() => setActiveTab('planilha')}
                className={`flex items-center gap-2.5 px-8 py-2.5 text-sm font-display font-bold rounded-xl transition-all duration-500 ${
                  activeTab === 'planilha' 
                  ? 'bg-white text-primary shadow-lg shadow-black/[0.05] translate-y-[-1px]' 
                  : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TableIcon className="w-4 h-4" />
                PLANILHA
              </button>
              <button
                onClick={() => setActiveTab('analise')}
                className={`flex items-center gap-2.5 px-8 py-2.5 text-sm font-display font-bold rounded-xl transition-all duration-500 ${
                  activeTab === 'analise' 
                  ? 'bg-white text-primary shadow-lg shadow-black/[0.05] translate-y-[-1px]' 
                  : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                ANÁLISE E RELATÓRIO
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'planilha' ? (
          <SpreadsheetTable
            produtos={currentLista.produtos}
            respostas={respostas}
            readOnly
            highlightLowest={respostas.length > 1}
            listaId={currentLista.id}
          />
        ) : (
          <AnalisePrecosPanel
            produtos={currentLista.produtos}
            respostas={respostas}
            listaNome={currentLista.nome}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/10 selection:text-primary relative">
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b border-border/50 px-4 sm:px-8 py-4 flex items-center justify-between shadow-sm shadow-black/[0.02]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-2xl">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-display font-bold text-foreground tracking-tight leading-none uppercase">
              Painel Administrativo
            </h1>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mt-1.5 opacity-70">
              Controle Central de Cotações
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="hidden sm:flex flex-col items-end gap-0.5">
            <span className="text-xs font-bold text-foreground leading-none">{profiles[user?.id || '']?.nome || 'Administrador'}</span>
            <span className="text-[10px] text-muted-foreground font-medium leading-none opacity-60">{user?.email}</span>
          </div>
          <div className="w-px h-8 bg-border/60 mx-1 hidden sm:block" />
          <Button variant="ghost" size="icon" onClick={signOut} className="rounded-2xl hover:bg-destructive/10 hover:text-destructive transition-all duration-300">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto p-4 sm:p-10 space-y-12">
        <section className="space-y-2">
          <h2 className="text-3xl font-display font-bold text-foreground tracking-tight">Visão Geral</h2>
          <p className="text-sm text-muted-foreground max-w-2xl font-medium leading-relaxed">
            Monitore o fluxo de cotações em tempo real de todos os compradores da rede através de uma interface centralizada e segura.
          </p>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
          <aside className="xl:col-span-3 space-y-8">
            <div className="bg-card border border-border/50 rounded-[2rem] p-8 shadow-sm ring-1 ring-black/[0.02]">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Search className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-sm font-display font-bold uppercase tracking-wider">
                  Filtros
                </h3>
              </div>
              <div className="space-y-6">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar cotação..."
                    className="pl-12 bg-muted/30 border-none h-12 rounded-2xl focus-visible:ring-2 focus-visible:ring-primary/20 placeholder:text-muted-foreground/50 font-medium transition-all"
                  />
                </div>
                <div className="space-y-2.5">
                  {(['all', 'aberta', 'finalizada'] as const).map(opt => (
                    <button
                      key={opt}
                      onClick={() => setStatusFilter(opt)}
                      className={`flex items-center justify-between w-full px-5 py-3.5 rounded-2xl text-sm font-display font-bold transition-all duration-300 ${
                        statusFilter === opt 
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 translate-x-1' 
                        : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:translate-x-1'
                      }`}
                    >
                      <span className="uppercase tracking-widest">{opt === 'all' ? 'Todas' : opt === 'aberta' ? 'Abertas' : 'Finalizadas'}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold ${statusFilter === opt ? 'bg-white/20' : 'bg-muted-foreground/10'}`}>
                        {opt === 'all' ? listas.length : listas.filter(l => l.status === opt).length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <div className="xl:col-span-9">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-6">
                <div className="w-12 h-12 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground font-display font-bold uppercase tracking-widest animate-pulse">Sincronizando Banco de Dados</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 border-2 border-dashed border-border/60 rounded-[3rem] bg-muted/5">
                <div className="p-6 bg-muted/30 rounded-full mb-6 ring-8 ring-muted/10">
                  <Search className="w-10 h-10 text-muted-foreground/30" />
                </div>
                <h4 className="text-foreground font-display font-bold text-lg mb-1">Nenhum resultado</h4>
                <p className="text-muted-foreground text-sm font-medium">Tente ajustar seus filtros de busca.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-2 gap-6">
                {filtered.map(lista => {
                  const owner = profiles[lista.user_id];
                  const isFinalizada = lista.status === 'finalizada';
                  
                  return (
                    <div
                      key={lista.id}
                      onClick={() => openLista(lista)}
                      className="group bg-card border border-border/50 rounded-[2.5rem] p-7 hover:border-primary/40 hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] transition-all duration-500 relative overflow-hidden flex flex-col h-[320px] cursor-pointer"
                    >
                      <div className={`absolute top-0 right-0 w-48 h-48 -mr-24 -mt-24 rounded-full opacity-[0.04] transition-transform duration-1000 group-hover:scale-150 ${isFinalizada ? 'bg-success' : 'bg-primary'}`} />
                      
                      <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-start justify-between mb-6">
                          <div className="space-y-2 max-w-[80%]">
                            <h3 className="font-display font-bold text-xl text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-2">
                              {lista.nome}
                            </h3>
                            <div className="flex items-center gap-3">
                              <span className={`text-[9px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-widest ${
                                isFinalizada ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
                              }`}>
                                {lista.status}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-bold flex items-center gap-1.5 opacity-60">
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(lista.created_at).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 mb-8">
                          <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-[1.5rem] ring-1 ring-black/[0.02] group-hover:bg-primary/[0.03] transition-colors duration-500">
                            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-display font-bold text-sm shadow-inner">
                              {owner?.nome?.charAt(0) || '?'}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-bold text-foreground truncate">{owner?.nome || 'Usuário'}</span>
                              <span className="text-[10px] text-muted-foreground font-medium truncate opacity-70">{owner?.email}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6 px-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold">
                              <Package className="w-4 h-4 text-primary/40" />
                              <span>{lista.produtos.length} Itens</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Ícone de cadeado para área de login Master */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => navigate('/master/login')}
          className="p-3 bg-card/40 backdrop-blur-md border border-border/40 hover:bg-card/60 rounded-full shadow-lg transition-all duration-300 group"
          title="Acesso Master"
        >
          <Shield className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
        </button>
      </div>

    </div>
  );
};

export default AdminPanel;
