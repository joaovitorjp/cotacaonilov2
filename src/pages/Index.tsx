import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import SpreadsheetTable from '@/components/SpreadsheetTable';
import ImportListaPanel from '@/components/ImportListaPanel';
import CarregarListaPanel from '@/components/CarregarListaPanel';
import GerarLinkPanel from '@/components/GerarLinkPanel';
import FornecedoresPanel from '@/components/FornecedoresPanel';
import AnalisePrecosPanel from '@/components/AnalisePrecosPanel';
import Dashboard from '@/components/Dashboard';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LogOut, Menu, X, Home, Upload, FolderOpen, Link2, CheckSquare, Users, BarChart3, Table } from 'lucide-react';

interface Lista {
  id: string;
  nome: string;
  status: string;
  produtos: { codigo_interno: string; descricao: string; codigo_barras: string }[];
  created_at: string;
  prazo?: string | null;
}

interface RespostaEmpresa {
  empresa: string;
  resposta: { codigo_interno: string; preco?: number | string; preco_mt?: number | string; preco_go?: number | string }[];
}

const Index = () => {
  const { signOut } = useAuth();
  const [importOpen, setImportOpen] = useState(false);
  const [carregarOpen, setCarregarOpen] = useState(false);
  const [finalizadasOpen, setFinalizadasOpen] = useState(false);
  const [gerarLinkOpen, setGerarLinkOpen] = useState(false);
  const [fornecedoresOpen, setFornecedoresOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [currentLista, setCurrentLista] = useState<Lista | null>(null);
  const [respostas, setRespostas] = useState<RespostaEmpresa[]>([]);
  const [isFinalized, setIsFinalized] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);
  const [activeTab, setActiveTab] = useState<'planilha' | 'analise'>('planilha');

  // Confirmation dialog for encerrar
  const [showEncerrarDialog, setShowEncerrarDialog] = useState(false);
  const [encerrarStats, setEncerrarStats] = useState<{ total: number; responded: number; pending: string[] }>({ total: 0, responded: 0, pending: [] });

  const loadRespostas = useCallback(async (listaId: string) => {
    const { data } = await supabase
      .from('respostas')
      .select('empresa, resposta')
      .eq('lista_id', listaId);
    setRespostas((data ?? []).map((d: any) => ({ empresa: d.empresa, resposta: d.resposta as any[] })));
  }, []);

  // 1. REALTIME: Subscribe to new responses when a lista is open
  useEffect(() => {
    if (!currentLista || showDashboard) return;

    const channel = supabase
      .channel(`respostas-${currentLista.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'respostas',
          filter: `lista_id=eq.${currentLista.id}`,
        },
        (payload: any) => {
          const empresa = payload.new?.empresa || 'Fornecedor';
          toast.success(`📩 Nova resposta recebida de "${empresa}"!`, { duration: 6000 });
          loadRespostas(currentLista.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'respostas',
          filter: `lista_id=eq.${currentLista.id}`,
        },
        (payload: any) => {
          const empresa = payload.new?.empresa || 'Fornecedor';
          toast.info(`🔄 Resposta atualizada por "${empresa}"`, { duration: 4000 });
          loadRespostas(currentLista.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentLista?.id, showDashboard, loadRespostas]);

  const handleListaSelected = async (lista: Lista, finalized = false) => {
    setCurrentLista(lista);
    setIsFinalized(finalized);
    setShowDashboard(false);
    setActiveTab('planilha');
    await loadRespostas(lista.id);
  };

  const handleBackToDashboard = () => {
    setCurrentLista(null);
    setRespostas([]);
    setIsFinalized(false);
    setShowDashboard(true);
    setActiveTab('planilha');
  };

  // 4. CONFIRMATION: Load stats before showing dialog
  const handleEncerrarClick = async () => {
    if (!currentLista) return;
    const { data: links } = await supabase
      .from('links_cotacao')
      .select('empresa, respondido')
      .eq('lista_id', currentLista.id);

    const allLinks = links ?? [];
    const responded = allLinks.filter(l => l.respondido).length;
    const pending = allLinks.filter(l => !l.respondido).map(l => l.empresa);

    setEncerrarStats({ total: allLinks.length, responded, pending });
    setShowEncerrarDialog(true);
  };

  const handleEncerrarConfirm = async () => {
    if (!currentLista) return;
    const { error } = await supabase
      .from('listas')
      .update({ status: 'finalizada' })
      .eq('id', currentLista.id);

    if (error) {
      toast.error('Erro ao encerrar cotação.');
    } else {
      toast.success(`Cotação "${currentLista.nome}" encerrada.`);
      handleBackToDashboard();
    }
    setShowEncerrarDialog(false);
  };

  const handleExport = async (lista: Lista) => {
    const { data } = await supabase
      .from('respostas')
      .select('empresa, resposta')
      .eq('lista_id', lista.id);

    const resps: RespostaEmpresa[] = (data ?? []).map((d: any) => ({
      empresa: d.empresa,
      resposta: d.resposta as any[],
    }));

    const empresas = resps.map(r => r.empresa);
    const rows = lista.produtos.map(prod => {
      const row: Record<string, string | number> = {
        'Código Interno': prod.codigo_interno,
        'Descrição': prod.descricao,
        'Código de Barras': prod.codigo_barras,
      };
      for (const emp of empresas) {
        const resp = resps.find(r => r.empresa === emp);
        const item = resp?.resposta.find((i: any) => i.codigo_interno === prod.codigo_interno);
        row[emp] = item?.preco ?? '';
      }
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cotação');
    XLSX.writeFile(wb, `${lista.nome}.xlsx`);
    toast.success('Planilha exportada!');
  };

  const handleDownloadResultados = async (lista: Lista) => {
    const { data } = await supabase
      .from('respostas')
      .select('empresa, resposta')
      .eq('lista_id', lista.id);

    const resps: RespostaEmpresa[] = (data ?? []).map((d: any) => ({
      empresa: d.empresa,
      resposta: d.resposta as any[],
    }));

    const winnersBySupplier: Record<string, { codigo_barras: string; preco: number }[]> = {};

    for (const prod of lista.produtos) {
      let lowestPrice = Infinity;
      let winnerEmpresa: string | null = null;

      for (const resp of resps) {
        const item = resp.resposta.find((i: any) => i.codigo_interno === prod.codigo_interno);
        if (item) {
          const raw = item.preco;
          let num: number;
          if (typeof raw === 'number') {
            num = raw;
          } else if (typeof raw === 'string' && raw !== '') {
            num = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
          } else {
            continue;
          }
          if (!isNaN(num) && num > 0 && num < lowestPrice) {
            lowestPrice = num;
            winnerEmpresa = resp.empresa;
          }
        }
      }

      if (winnerEmpresa && lowestPrice !== Infinity) {
        if (!winnersBySupplier[winnerEmpresa]) winnersBySupplier[winnerEmpresa] = [];
        winnersBySupplier[winnerEmpresa].push({ codigo_barras: prod.codigo_barras, preco: lowestPrice });
      }
    }

    const suppliers = Object.keys(winnersBySupplier);
    if (suppliers.length === 0) {
      toast.error('Nenhum preço ganhador encontrado.');
      return;
    }

    for (const empresa of suppliers) {
      const items = winnersBySupplier[empresa];
      const csvLines = items.map(item => {
        const precoFormatted = item.preco.toFixed(2).replace('.', ',');
        return `${item.codigo_barras};1;${precoFormatted}`;
      });
      const csvContent = csvLines.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${lista.nome}_${empresa}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }

    toast.success(`${suppliers.length} arquivo(s) CSV baixado(s)!`);
  };

  const handleDashboardNavigate = (view: 'importar' | 'carregar' | 'finalizadas') => {
    if (view === 'importar') setImportOpen(true);
    else if (view === 'carregar') setCarregarOpen(true);
    else if (view === 'finalizadas') setFinalizadasOpen(true);
  };

  // Check if deadline passed
  const isExpired = currentLista?.prazo ? new Date(currentLista.prazo) < new Date() : false;

  const navItems = [
    { label: 'Início', icon: Home, action: handleBackToDashboard },
    { label: 'Importar', icon: Upload, action: () => { setImportOpen(true); setMobileMenuOpen(false); } },
    { label: 'Abertas', icon: FolderOpen, action: () => { setCarregarOpen(true); setMobileMenuOpen(false); } },
    { label: 'Gerar Link', icon: Link2, action: () => { setGerarLinkOpen(true); setMobileMenuOpen(false); }, disabled: !currentLista || isFinalized },
    { label: 'Finalizadas', icon: CheckSquare, action: () => { setFinalizadasOpen(true); setMobileMenuOpen(false); } },
    { label: 'Fornecedores', icon: Users, action: () => { setFornecedoresOpen(true); setMobileMenuOpen(false); } },
  ];

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
        <button onClick={handleBackToDashboard} className="flex items-center gap-2">
          <h1 className="text-lg sm:text-xl font-display font-bold text-foreground tracking-tight">Nilo Atacadista</h1>
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-2">
          {navItems.slice(1).map(item => (
            <Button
              key={item.label}
              variant={item.label === 'Gerar Link' ? 'default' : 'outline'}
              size="sm"
              onClick={item.action}
              disabled={item.disabled}
              className={item.disabled ? 'opacity-50 cursor-not-allowed' : ''}
            >
              <item.icon className="w-4 h-4 mr-1.5" />
              {item.label}
            </Button>
          ))}
          <div className="w-px h-6 bg-border mx-1" />
          <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        {/* Mobile menu toggle */}
        <div className="flex md:hidden items-center gap-2">
          <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-card border-b border-border px-4 py-2 space-y-1 shrink-0">
          {navItems.map(item => (
            <button
              key={item.label}
              onClick={() => { item.action(); setMobileMenuOpen(false); }}
              disabled={item.disabled}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-display font-bold text-left transition-colors ${
                item.disabled
                  ? 'opacity-40 cursor-not-allowed text-muted-foreground'
                  : 'text-foreground hover:bg-muted/50'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Lista info bar with tabs */}
      {currentLista && !showDashboard && (
        <div className="shrink-0 border-b border-border">
          <div className="bg-muted/50 px-4 sm:px-6 py-2 text-sm text-foreground flex items-center gap-2 flex-wrap">
            <button onClick={handleBackToDashboard} className="text-primary hover:underline text-xs font-display">
              ← Início
            </button>
            <span className="text-muted-foreground">·</span>
            <span className="font-display font-bold">{currentLista.nome}</span>
            <span className="text-muted-foreground text-xs">
              {currentLista.produtos.length} produtos · {respostas.length} resposta(s)
            </span>
            {isFinalized && (
              <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-full font-display font-bold">
                FINALIZADA
              </span>
            )}
            {currentLista.prazo && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-display font-bold ${
                isExpired
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-primary/10 text-primary'
              }`}>
                {isExpired ? '⏰ EXPIRADA' : `📅 Prazo: ${new Date(currentLista.prazo).toLocaleDateString('pt-BR')}`}
              </span>
            )}
            {!isFinalized && respostas.length > 0 && (
              <Button variant="outline" size="sm" className="ml-auto text-xs" onClick={() => loadRespostas(currentLista.id)}>
                Atualizar
              </Button>
            )}
          </div>
          {/* Tabs */}
          {respostas.length > 0 && (
            <div className="flex px-4 sm:px-6 bg-card">
              <button
                onClick={() => setActiveTab('planilha')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-display font-bold border-b-2 transition-colors ${
                  activeTab === 'planilha'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                Planilha
              </button>
              <button
                onClick={() => setActiveTab('analise')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-display font-bold border-b-2 transition-colors ${
                  activeTab === 'analise'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Análise
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main content */}
      {showDashboard ? (
        <Dashboard onNavigate={handleDashboardNavigate} />
      ) : activeTab === 'planilha' ? (
        <SpreadsheetTable
          produtos={currentLista?.produtos ?? []}
          respostas={respostas}
          readOnly={isFinalized}
          highlightLowest={respostas.length > 1}
          listaId={currentLista?.id}
          onSave={currentLista && !isFinalized ? async (updatedProdutos) => {
            const { error } = await supabase
              .from('listas')
              .update({ produtos: updatedProdutos as any })
              .eq('id', currentLista.id);
            if (error) {
              toast.error('Erro ao salvar alterações.');
            } else {
              setCurrentLista({ ...currentLista, produtos: updatedProdutos });
              toast.success('Alterações salvas com sucesso!');
            }
          } : undefined}
        />
      ) : (
        <AnalisePrecosPanel
          produtos={currentLista?.produtos ?? []}
          respostas={respostas}
          listaNome={currentLista?.nome}
        />
      )}

      {/* Floating button */}
      {currentLista && !isFinalized && !showDashboard && (
        <button
          onClick={handleEncerrarClick}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-success text-success-foreground px-4 sm:px-6 py-3 rounded shadow-lg font-display font-bold text-sm hover:bg-success/90 transition-colors duration-200 z-50"
        >
          Encerrar Cotação
        </button>
      )}

      {/* 4. Encerrar Confirmation Dialog */}
      <AlertDialog open={showEncerrarDialog} onOpenChange={setShowEncerrarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Encerrar cotação?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Deseja encerrar a cotação <strong>"{currentLista?.nome}"</strong>? Após encerrar, fornecedores não poderão mais enviar respostas.</p>
                
                <div className="bg-muted rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Links gerados:</span>
                    <span className="font-bold text-foreground">{encerrarStats.total}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Responderam:</span>
                    <span className="font-bold text-success">{encerrarStats.responded}</span>
                  </div>
                  {encerrarStats.pending.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Ainda não responderam:</p>
                      <div className="flex flex-wrap gap-1">
                        {encerrarStats.pending.map(emp => (
                          <span key={emp} className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-display font-bold">
                            {emp}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEncerrarConfirm} className="bg-success text-success-foreground hover:bg-success/90">
              Encerrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Panels */}
      <ImportListaPanel open={importOpen} onOpenChange={setImportOpen} onImported={() => {}} />
      <CarregarListaPanel
        open={carregarOpen}
        onOpenChange={setCarregarOpen}
        onListaSelected={lista => handleListaSelected(lista, false)}
        statusFilter="aberta"
        title="Listas Abertas"
      />
      <CarregarListaPanel
        open={finalizadasOpen}
        onOpenChange={setFinalizadasOpen}
        onListaSelected={lista => handleListaSelected(lista, true)}
        statusFilter="finalizada"
        title="Cotações Finalizadas"
        onExport={handleExport}
        onDownloadResultados={handleDownloadResultados}
      />
      <FornecedoresPanel open={fornecedoresOpen} onOpenChange={setFornecedoresOpen} />
      {currentLista && (
        <GerarLinkPanel open={gerarLinkOpen} onOpenChange={setGerarLinkOpen} listaId={currentLista.id} />
      )}
    </div>
  );
};

export default Index;
