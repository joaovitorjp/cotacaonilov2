import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';

interface ImportListaPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

const ImportListaPanel: React.FC<ImportListaPanelProps> = ({ open, onOpenChange, onImported }) => {
  const [nome, setNome] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!file || !nome.trim()) {
      toast.error('Informe o nome da lista e selecione um arquivo.');
      return;
    }

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const produtos = rows
        .filter((row, idx) => idx > 0 || (row[0] && !isNaN(Number(row[0]))))
        .filter(row => row[0] || row[1] || row[2])
        .map(row => ({
          codigo_interno: String(row[0] ?? '').trim(),
          descricao: String(row[1] ?? '').trim(),
          codigo_barras: String(row[2] ?? '').trim(),
        }))
        .filter(p => p.codigo_interno || p.descricao);

      if (produtos.length === 0) {
        toast.error('Nenhum produto encontrado no arquivo.');
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('listas').insert({
        nome: nome.trim(),
        produtos,
        status: 'aberta',
      });

      if (error) throw error;

      toast.success(`Lista "${nome}" importada com ${produtos.length} produtos.`);
      setNome('');
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      onOpenChange(false);
      onImported();
    } catch (err: any) {
      toast.error('Erro ao importar: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[40vw] min-w-[360px] sm:max-w-none">
        <SheetHeader>
          <SheetTitle className="font-display">Importar Lista</SheetTitle>
          <SheetDescription>
            Anexe um arquivo .xls ou .xlsx com as colunas: Código Interno (A), Descrição (B), Código de Barras (C).
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-display font-bold text-foreground">Nome da Lista</label>
            <Input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Cotação Março 2026"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-display font-bold text-foreground">Arquivo (.xls / .xlsx)</label>
            <input
              ref={inputRef}
              type="file"
              accept=".xls,.xlsx"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-display file:font-bold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
          </div>
          <Button onClick={handleImport} disabled={loading || !file || !nome.trim()} className="w-full">
            {loading ? 'Importando...' : 'Importar Lista'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ImportListaPanel;
