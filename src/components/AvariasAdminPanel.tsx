import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AvariasDashboard from './AvariasDashboard';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Upload, Trash2, FileSpreadsheet, Calendar, BarChart3, ListChecks } from 'lucide-react';
import {
  SESSOES, compradorFromSessao, lojaNome, normalizeLojaNumero, parseNumber, fmtBRL,
} from '@/lib/avariasConstants';

interface UploadRow {
  id: string;
  sessao: string;
  comprador: string;
  filename: string | null;
  data_referencia: string;
  total_rows: number;
  total_valor: number;
  created_at: string;
}

const AvariasAdminPanel: React.FC = () => {
  const { user } = useAuth();
  const [sessao, setSessao] = useState<string>('');
  const [dataRef, setDataRef] = useState<string>(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'dashboard' | 'uploads'>('dashboard');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const fetchUploads = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('avarias_uploads')
      .select('*')
      .order('created_at', { ascending: false });
    setUploads((data ?? []).map((u: any) => ({ ...u, total_valor: Number(u.total_valor) || 0 })));
    setLoading(false);
  };

  useEffect(() => { void fetchUploads(); }, []);

  const handleUpload = async () => {
    if (!sessao) { toast.error('Selecione a sessão.'); return; }
    if (!file) { toast.error('Selecione um arquivo Excel.'); return; }
    if (!user) return;

    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<any>(ws, { header: 1, defval: '' });

      // Skip header row if column A looks like a header (non-numeric)
      let start = 0;
      if (raw[0] && isNaN(parseNumber(raw[0][0]))) start = 1;

      const comprador = compradorFromSessao(sessao);
      const items: any[] = [];
      let totalValor = 0;

      for (let i = start; i < raw.length; i++) {
        const row = raw[i];
        if (!row || row.every((c: any) => c === '' || c === null || c === undefined)) continue;
        const loja_numero = normalizeLojaNumero(row[0]);
        if (!loja_numero) continue;
        const valor = parseNumber(row[1]);
        const fornecedor_codigo = row[2] !== undefined && row[2] !== '' ? String(row[2]).trim() : null;
        const fornecedor_nome = row[3] !== undefined && row[3] !== '' ? String(row[3]).trim() : null;
        const quantidade = parseNumber(row[4]);
        items.push({
          sessao, comprador, loja_numero, loja_nome: lojaNome(loja_numero),
          valor_total: valor, fornecedor_codigo, fornecedor_nome, quantidade,
          data_referencia: dataRef,
        });
        totalValor += valor;
      }

      if (items.length === 0) {
        toast.error('Nenhuma linha válida encontrada no arquivo.');
        setUploading(false);
        return;
      }

      const { data: up, error: upErr } = await supabase
        .from('avarias_uploads')
        .insert({
          user_id: user.id, sessao, comprador,
          filename: file.name, data_referencia: dataRef,
          total_rows: items.length, total_valor: totalValor,
        })
        .select('id')
        .single();

      if (upErr || !up) throw upErr ?? new Error('Falha ao registrar upload');

      const rowsToInsert = items.map(i => ({ ...i, upload_id: up.id }));
      // Insert in chunks of 500 to avoid payload limits
      for (let i = 0; i < rowsToInsert.length; i += 500) {
        const chunk = rowsToInsert.slice(i, i + 500);
        const { error } = await supabase.from('avarias').insert(chunk);
        if (error) throw error;
      }

      toast.success(`${items.length} avarias importadas · ${fmtBRL(totalValor)}`);
      setFile(null); setSessao('');
      const el = document.getElementById('avarias-file-input') as HTMLInputElement | null;
      if (el) el.value = '';
      await fetchUploads();
      setReloadKey(k => k + 1);
    } catch (e: any) {
      console.error(e);
      toast.error(`Erro ao importar: ${e?.message ?? 'desconhecido'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('avarias_uploads').delete().eq('id', deleteId);
    if (error) {
      toast.error('Erro ao excluir upload.');
    } else {
      toast.success('Upload excluído.');
      await fetchUploads();
      setReloadKey(k => k + 1);
    }
    setDeleteId(null);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Upload form */}
      <div className="shrink-0 bg-card border-b border-border p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <Upload className="w-4 h-4 text-primary" />
          <span className="font-display font-bold text-sm">Anexar planilha de avarias/trocas</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div>
            <label className="text-[10px] font-display font-bold text-muted-foreground uppercase">Sessão *</label>
            <Select value={sessao} onValueChange={setSessao}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione a sessão" /></SelectTrigger>
              <SelectContent>
                {SESSOES.map(s => (
                  <SelectItem key={s.sessao} value={s.sessao}>
                    {s.sessao} — {s.comprador}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-display font-bold text-muted-foreground uppercase">Data de referência</label>
            <Input type="date" value={dataRef} onChange={e => setDataRef(e.target.value)} className="h-9" />
          </div>
          <div className="md:col-span-1">
            <label className="text-[10px] font-display font-bold text-muted-foreground uppercase">Arquivo Excel *</label>
            <Input id="avarias-file-input" type="file" accept=".xls,.xlsx,.csv" onChange={e => setFile(e.target.files?.[0] ?? null)} className="h-9" />
          </div>
          <Button onClick={handleUpload} disabled={uploading || !sessao || !file}>
            <Upload className="w-4 h-4 mr-1.5" />
            {uploading ? 'Importando...' : 'Importar'}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Colunas esperadas: <strong>A</strong>=Nº loja · <strong>B</strong>=Valor (R$) · <strong>C</strong>=Cód. fornecedor · <strong>D</strong>=Nome fornecedor · <strong>E</strong>=Quantidade.
        </p>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex px-4 sm:px-6 bg-card border-b border-border">
        <button
          onClick={() => setTab('dashboard')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-display font-bold border-b-2 transition-colors ${
            tab === 'dashboard' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" /> Dashboard
        </button>
        <button
          onClick={() => setTab('uploads')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-display font-bold border-b-2 transition-colors ${
            tab === 'uploads' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ListChecks className="w-3.5 h-3.5" /> Uploads ({uploads.length})
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto bg-background">
        {tab === 'dashboard' ? (
          <AvariasDashboard key={reloadKey} />
        ) : (
          <div className="p-4 sm:p-6">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Carregando...</p>
            ) : uploads.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-lg bg-card">
                <FileSpreadsheet className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">Nenhuma planilha importada ainda.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {uploads.map(u => (
                  <div key={u.id} className="border border-border rounded-lg p-3 bg-card flex items-center gap-3 flex-wrap">
                    <FileSpreadsheet className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-bold text-sm">{u.sessao}</span>
                        <span className="text-xs text-muted-foreground">· {u.comprador}</span>
                        <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-display font-bold">
                          {u.total_rows} linhas
                        </span>
                        <span className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-display font-bold">
                          {fmtBRL(u.total_valor)}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(u.data_referencia).toLocaleDateString('pt-BR')}</span>
                        {u.filename && <span className="truncate max-w-xs">{u.filename}</span>}
                        <span className="text-muted-foreground/60">enviado {new Date(u.created_at).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(u.id)} title="Excluir upload">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir upload?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os registros de avarias vinculados a este upload serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AvariasAdminPanel;
