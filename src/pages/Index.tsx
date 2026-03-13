import React, { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import SpreadsheetTable from '@/components/SpreadsheetTable';
import ImportListaPanel from '@/components/ImportListaPanel';
import CarregarListaPanel from '@/components/CarregarListaPanel';
import GerarLinkPanel from '@/components/GerarLinkPanel';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

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

    // For each product, find the winning supplier (lowest price)
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

    // Generate one CSV file per supplier
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
          {!isFinalized && respostas.length > 0 && (
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => loadRespostas(currentLista.id)}>
              Atualizar Respostas
            </Button>
          )}
        </div>
      )}

      {/* Spreadsheet */}
      <SpreadsheetTable
        produtos={currentLista?.produtos ?? []}
        respostas={respostas}
        readOnly={isFinalized}
        highlightLowest={respostas.length > 1}
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
        onExport={handleExport}
        onDownloadResultados={handleDownloadResultados}
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
