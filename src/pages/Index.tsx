import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import SpreadsheetTable from '@/components/SpreadsheetTable';
import ImportListaPanel from '@/components/ImportListaPanel';
import CarregarListaPanel from '@/components/CarregarListaPanel';
import GerarLinkPanel from '@/components/GerarLinkPanel';
import { toast } from 'sonner';

interface Lista {
  id: string;
  nome: string;
  status: string;
  produtos: { codigo_interno: string; descricao: string; codigo_barras: string }[];
  created_at: string;
}

interface RespostaEmpresa {
  empresa: string;
  resposta: { codigo_interno: string; preco: number | string }[];
}

const Index = () => {
  const [importOpen, setImportOpen] = useState(false);
  const [carregarOpen, setCarregarOpen] = useState(false);
  const [finalizadasOpen, setFinalizadasOpen] = useState(false);
  const [gerarLinkOpen, setGerarLinkOpen] = useState(false);

  const [currentLista, setCurrentLista] = useState<Lista | null>(null);
  const [respostas, setRespostas] = useState<RespostaEmpresa[]>([]);
  const [isFinalized, setIsFinalized] = useState(false);

  const loadRespostas = useCallback(async (listaId: string) => {
    const { data } = await supabase
      .from('respostas')
      .select('empresa, resposta')
      .eq('lista_id', listaId);
    setRespostas((data ?? []).map((d: any) => ({ empresa: d.empresa, resposta: d.resposta as any[] })));
  }, []);

  const handleListaSelected = async (lista: Lista, finalized = false) => {
    setCurrentLista(lista);
    setIsFinalized(finalized);
    await loadRespostas(lista.id);
  };

  const handleEncerrar = async () => {
    if (!currentLista) return;
    const { error } = await supabase
      .from('listas')
      .update({ status: 'finalizada' })
      .eq('id', currentLista.id);

    if (error) {
      toast.error('Erro ao encerrar cotação.');
    } else {
      toast.success(`Cotação "${currentLista.nome}" encerrada.`);
      setCurrentLista(null);
      setRespostas([]);
      setIsFinalized(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-display font-bold text-foreground tracking-tight">Nilo Atacadista</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            Importar Lista
          </Button>
          <Button variant="outline" onClick={() => setCarregarOpen(true)}>
            Carregar Lista
          </Button>
          <Button
            onClick={() => setGerarLinkOpen(true)}
            disabled={!currentLista || isFinalized}
            className={!currentLista || isFinalized ? 'opacity-50 cursor-not-allowed' : ''}
          >
            Gerar Link Cotação
          </Button>
          <Button variant="outline" onClick={() => setFinalizadasOpen(true)}>
            Cotações Finalizadas
          </Button>
        </div>
      </header>

      {/* Lista info bar */}
      {currentLista && (
        <div className="bg-muted/50 px-6 py-2 text-sm text-foreground border-b border-border shrink-0 flex items-center gap-2">
          <span className="font-display font-bold">{currentLista.nome}</span>
          <span className="text-muted-foreground">
            · {currentLista.produtos.length} produtos · {respostas.length} resposta(s)
          </span>
          {isFinalized && (
            <span className="ml-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded font-display">
              FINALIZADA
            </span>
          )}
        </div>
      )}

      {/* Spreadsheet */}
      <SpreadsheetTable
        produtos={currentLista?.produtos ?? []}
        respostas={respostas}
        readOnly={isFinalized}
      />

      {/* Floating button */}
      {currentLista && !isFinalized && (
        <button
          onClick={handleEncerrar}
          className="fixed bottom-6 right-6 bg-success text-success-foreground px-6 py-3 rounded shadow-lg font-display font-bold text-sm hover:bg-success/90 transition-colors duration-200 z-50"
        >
          Encerrar Cotação
        </button>
      )}

      {/* Panels */}
      <ImportListaPanel
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {}}
      />
      <CarregarListaPanel
        open={carregarOpen}
        onOpenChange={setCarregarOpen}
        onListaSelected={lista => handleListaSelected(lista, false)}
        statusFilter="aberta"
        title="Carregar Lista"
      />
      <CarregarListaPanel
        open={finalizadasOpen}
        onOpenChange={setFinalizadasOpen}
        onListaSelected={lista => handleListaSelected(lista, true)}
        statusFilter="finalizada"
        title="Cotações Finalizadas"
      />
      {currentLista && (
        <GerarLinkPanel
          open={gerarLinkOpen}
          onOpenChange={setGerarLinkOpen}
          listaId={currentLista.id}
        />
      )}
    </div>
  );
};

export default Index;
