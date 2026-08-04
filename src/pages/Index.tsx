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
import FloatingChat from '@/components/FloatingChat';
import PerfilPanel from '@/components/PerfilPanel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import ProfileGate from '@/components/ProfileGate';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LogOut, Menu, X, Home, Upload, FolderOpen, Link2, CheckSquare, Users, BarChart3, Table, MessageCircle, User as UserIcon, LucideIcon } from 'lucide-react';

const SidebarLink = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200 group ${
      active 
        ? 'bg-primary text-white shadow-md shadow-primary/20' 
        : 'text-slate-600 hover:bg-slate-50'
    }`}
  >
    <span className={`${active ? 'text-white' : 'text-slate-400 group-hover:text-primary'} transition-colors`}>
      {React.cloneElement(icon as React.ReactElement, { size: 20 })}
    </span>
    <span className="text-sm font-semibold">{label}</span>
  </button>
);

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
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [importOpen, setImportOpen] = useState(false);
  const [carregarOpen, setCarregarOpen] = useState(false);
  const [finalizadasOpen, setFinalizadasOpen] = useState(false);
  const [gerarLinkOpen, setGerarLinkOpen] = useState(false);
  const [fornecedoresOpen, setFornecedoresOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [perfilOpen, setPerfilOpen] = useState(false);
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
    // Buscar respostas e juntar com tipo_preco do link
    const { data: respData } = await supabase
      .from('respostas')
      .select('empresa, resposta')
      .eq('lista_id', listaId);
    
    const { data: linksData } = await supabase
      .from('links_cotacao')
      .select('empresa, tipo_preco')
      .eq('lista_id', listaId);

    const linksMap: Record<string, string> = {};
    (linksData ?? []).forEach(l => {
      linksMap[l.empresa] = l.tipo_preco || '';
    });

    setRespostas((respData ?? []).map((d: any) => ({ 
      empresa: d.empresa, 
      resposta: d.resposta as any[],
      tipo_preco: linksMap[d.empresa] || (d.empresa.includes('GO') ? 'NOTA' : 'IPI_ST') // Fallback logic requested
    })));
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
    setMobileMenuOpen(false);
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

    const parseBR = (v: any): number | null => {
      if (v === null || v === undefined || v === '') return null;
      if (typeof v === 'number') return isFinite(v) ? v : null;
      const s = String(v).trim().replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
      const n = parseFloat(s);
      return isFinite(n) ? n : null;
    };

    // Build price map and identify suppliers that have any MT / GO price
    const mtByEmp: Record<string, Record<string, number>> = {};
    const goByEmp: Record<string, Record<string, number>> = {};
    for (const r of resps) {
      mtByEmp[r.empresa] = {};
      goByEmp[r.empresa] = {};
      for (const item of r.resposta as any[]) {
        const mt = parseBR(item.preco_mt ?? item.preco);
        const go = parseBR(item.preco_go);
        if (mt !== null) mtByEmp[r.empresa][item.codigo_interno] = mt;
        if (go !== null) goByEmp[r.empresa][item.codigo_interno] = go;
      }
    }

    const mtEmpresas = resps.map(r => r.empresa).filter(e => Object.keys(mtByEmp[e]).length > 0);
    const goEmpresas = resps.map(r => r.empresa).filter(e => Object.keys(goByEmp[e]).length > 0);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Nilo Atacadista';
    wb.created = new Date();
    const ws = wb.addWorksheet('Cotação', {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }],
    });

    const fixedCols = ['Código Interno', 'Descrição', 'Código de Barras'];
    const totalCols = fixedCols.length + mtEmpresas.length + goEmpresas.length;

    // Row 1: Title
    ws.mergeCells(1, 1, 1, totalCols);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = `Cotação: ${lista.nome}`;
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    ws.getRow(1).height = 26;

    // Row 2: Subtitle
    ws.mergeCells(2, 1, 2, totalCols);
    const subCell = ws.getCell(2, 1);
    subCell.value = `Exportado em ${new Date().toLocaleString('pt-BR')} • ${lista.produtos.length} produtos • MT: ${mtEmpresas.length} fornecedor(es) • GO: ${goEmpresas.length} fornecedor(es)`;
    subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    ws.getRow(2).height = 18;

    // Header rows 3-4
    const headerFontWhite = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    const fixedFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF2563EB' } };
    const mtFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1D4ED8' } };
    const goFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF15803D' } };
    const mtSubFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFDBEAFE' } };
    const goSubFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFDCFCE7' } };

    fixedCols.forEach((label, i) => {
      const col = i + 1;
      ws.mergeCells(3, col, 4, col);
      const c = ws.getCell(3, col);
      c.value = label;
      c.font = headerFontWhite;
      c.fill = fixedFill;
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });

    // MT region group header + supplier columns
    if (mtEmpresas.length > 0) {
      const startCol = fixedCols.length + 1;
      const endCol = startCol + mtEmpresas.length - 1;
      ws.mergeCells(3, startCol, 3, endCol);
      const g = ws.getCell(3, startCol);
      g.value = 'MATO GROSSO (MT)';
      g.font = headerFontWhite;
      g.fill = mtFill;
      g.alignment = { vertical: 'middle', horizontal: 'center' };
      mtEmpresas.forEach((emp, idx) => {
        const cell = ws.getCell(4, startCol + idx);
        cell.value = emp;
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E3A8A' } };
        cell.fill = mtSubFill;
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });
    }

    // GO region group header + supplier columns
    if (goEmpresas.length > 0) {
      const startCol = fixedCols.length + mtEmpresas.length + 1;
      const endCol = startCol + goEmpresas.length - 1;
      ws.mergeCells(3, startCol, 3, endCol);
      const g = ws.getCell(3, startCol);
      g.value = 'GOIÁS (GO)';
      g.font = headerFontWhite;
      g.fill = goFill;
      g.alignment = { vertical: 'middle', horizontal: 'center' };
      goEmpresas.forEach((emp, idx) => {
        const cell = ws.getCell(4, startCol + idx);
        cell.value = emp;
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF14532D' } };
        cell.fill = goSubFill;
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });
    }

    ws.getRow(3).height = 22;
    ws.getRow(4).height = 22;

    // Data rows
    lista.produtos.forEach((prod, rIdx) => {
      const rowNum = 5 + rIdx;
      ws.getCell(rowNum, 1).value = prod.codigo_interno;
      ws.getCell(rowNum, 2).value = prod.descricao;
      ws.getCell(rowNum, 3).value = prod.codigo_barras;

      const mtPriceCells: { col: number; value: number }[] = [];
      const goPriceCells: { col: number; value: number }[] = [];

      mtEmpresas.forEach((emp, idx) => {
        const col = fixedCols.length + 1 + idx;
        const v = mtByEmp[emp][prod.codigo_interno];
        const cell = ws.getCell(rowNum, col);
        if (v !== undefined) {
          cell.value = v;
          cell.numFmt = '"R$" #,##0.00';
          mtPriceCells.push({ col, value: v });
        }
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      });

      goEmpresas.forEach((emp, idx) => {
        const col = fixedCols.length + mtEmpresas.length + 1 + idx;
        const v = goByEmp[emp][prod.codigo_interno];
        const cell = ws.getCell(rowNum, col);
        if (v !== undefined) {
          cell.value = v;
          cell.numFmt = '"R$" #,##0.00';
          goPriceCells.push({ col, value: v });
        }
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      });

      // Zebra
      if (rIdx % 2 === 1) {
        for (let c = 1; c <= totalCols; c++) {
          const cell = ws.getCell(rowNum, c);
          if (!cell.fill || (cell.fill as any).type !== 'pattern') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          }
        }
      }

      // Highlight min price per region (>= 2 prices)
      const highlight = (list: { col: number; value: number }[]) => {
        if (list.length < 2) return;
        const min = Math.min(...list.map(p => p.value));
        list.forEach(p => {
          if (p.value === min) {
            const cell = ws.getCell(rowNum, p.col);
            cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF166534' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
          }
        });
      };
      highlight(mtPriceCells);
      highlight(goPriceCells);
    });

    // Borders
    const lastRow = 4 + lista.produtos.length;
    for (let r = 3; r <= lastRow; r++) {
      for (let c = 1; c <= totalCols; c++) {
        ws.getCell(r, c).border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }
    }
    // Thicker divider between MT and GO blocks
    if (mtEmpresas.length > 0 && goEmpresas.length > 0) {
      const divCol = fixedCols.length + mtEmpresas.length;
      for (let r = 3; r <= lastRow; r++) {
        const cell = ws.getCell(r, divCol);
        cell.border = { ...cell.border, right: { style: 'medium', color: { argb: 'FF64748B' } } };
      }
    }

    // Column widths
    ws.getColumn(1).width = 14;
    ws.getColumn(2).width = 48;
    ws.getColumn(3).width = 18;
    for (let i = 0; i < mtEmpresas.length + goEmpresas.length; i++) {
      ws.getColumn(fixedCols.length + 1 + i).width = 16;
    }

    ws.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: lastRow, column: totalCols },
    };

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lista.nome}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Planilha exportada!');
  };

  const handleDownloadResultados = async (lista: Lista, type: 'CISS' | 'CONSINCO') => {
    const { data: respsData } = await supabase
      .from('respostas')
      .select('empresa, resposta')
      .eq('lista_id', lista.id);

    const { data: fornsData } = await supabase
      .from('fornecedores')
      .select('*');

    const resps: RespostaEmpresa[] = (respsData ?? []).map((d: any) => ({
      empresa: d.empresa,
      resposta: d.resposta as any[],
    }));

    const fornsMapCISS: Record<string, string> = {};
    const fornsMapCONSINCO: Record<string, string> = {};
    (fornsData ?? []).forEach(f => {
      fornsMapCISS[f.nome] = f.codigo_interno_ciss || '';
      fornsMapCONSINCO[f.nome] = f.codigo_interno_consinco || '';
    });

    const parsePrice = (raw: any): number => {
      if (typeof raw === 'number') return raw;
      if (typeof raw === 'string' && raw !== '') {
        const n = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
        return isNaN(n) ? NaN : n;
      }
      return NaN;
    };

    const estados: { key: 'mt' | 'go'; label: string }[] = [
      { key: 'mt', label: 'MT' },
      { key: 'go', label: 'GO' },
    ];

    let totalArquivos = 0;

    for (const est of estados) {
      const winnersBySupplier: Record<string, { codigo_barras: string; preco: number }[]> = {};

      for (const prod of lista.produtos) {
        let lowestPrice = Infinity;
        let winnerEmpresa: string | null = null;

        for (const resp of resps) {
          const item = resp.resposta.find((i: any) => i.codigo_interno === prod.codigo_interno);
          if (!item) continue;
          const raw = est.key === 'mt' ? (item.preco_mt ?? item.preco) : item.preco_go;
          const num = parsePrice(raw);
          if (!isNaN(num) && num > 0 && num < lowestPrice) {
            lowestPrice = num;
            winnerEmpresa = resp.empresa;
          }
        }

        if (winnerEmpresa && lowestPrice !== Infinity) {
          if (!winnersBySupplier[winnerEmpresa]) winnersBySupplier[winnerEmpresa] = [];
          winnersBySupplier[winnerEmpresa].push({ codigo_barras: prod.codigo_barras, preco: lowestPrice });
        }
      }

      const suppliers = Object.keys(winnersBySupplier);
      for (const empresa of suppliers) {
        const items = winnersBySupplier[empresa];
        
        if (type === 'CISS') {
          // CSV CISS (Existing format)
          const codFornecedor = fornsMapCISS[empresa] || '';
          const csvLinesCISS = items.map(item => {
            const precoFormatted = item.preco.toFixed(2).replace('.', ',');
            return `${item.codigo_barras};1;${precoFormatted}`;
          });
          const blobCISS = new Blob([csvLinesCISS.join('\n')], { type: 'text/csv;charset=utf-8;' });
          const urlCISS = URL.createObjectURL(blobCISS);
          const aCISS = document.createElement('a');
          aCISS.href = urlCISS;
          aCISS.download = `${lista.nome}_${est.label}_${empresa}_CISS.csv`;
          aCISS.click();
          URL.revokeObjectURL(urlCISS);
          totalArquivos++;
        } else {
          // CSV CONSINCO (New format)
          const codFornecedor = fornsMapCONSINCO[empresa] || '';
          const csvLinesCONSINCO = items.map(item => {
            const precoFormatted = item.preco.toFixed(2); // format 3.45 (dot separator)
            // Col A: codFornecedor, B: "", C: "", D: barcode, E: "", F: "1", G: price, H-K: "0"
            return `${codFornecedor};;;${item.codigo_barras};;1;${precoFormatted};0;0;0;0`;
          });
          const blobCONSINCO = new Blob([csvLinesCONSINCO.join('\n')], { type: 'text/csv;charset=utf-8;' });
          const urlCONSINCO = URL.createObjectURL(blobCONSINCO);
          const aCONSINCO = document.createElement('a');
          aCONSINCO.href = urlCONSINCO;
          aCONSINCO.download = `${lista.nome}_${est.label}_${empresa}_CONSINCO.csv`;
          aCONSINCO.click();
          URL.revokeObjectURL(urlCONSINCO);
          totalArquivos++;
        }
      }
    }

    if (totalArquivos === 0) {
      toast.error('Nenhum preço ganhador encontrado.');
      return;
    }
    toast.success(`${totalArquivos} arquivo(s) CSV baixado(s) (separados por estado).`);
  };

  const handleDashboardNavigate = (view: 'importar' | 'carregar' | 'finalizadas') => {
    if (view === 'importar') setImportOpen(true);
    else if (view === 'carregar') setCarregarOpen(true);
    else if (view === 'finalizadas') setFinalizadasOpen(true);
  };

  const [profile, setProfile] = useState<{ nome: string; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('nome, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setProfile(data);
    };
    fetchProfile();
  }, [user, perfilOpen]);

  // Check if deadline passed
  const isExpired = currentLista?.prazo ? new Date(currentLista.prazo) < new Date() : false;

  const navItems = [
    { label: 'Início', icon: Home, action: handleBackToDashboard },
    { label: 'Importar', icon: Upload, action: () => { setImportOpen(true); setMobileMenuOpen(false); } },
    { label: 'Abertas', icon: FolderOpen, action: () => { setCarregarOpen(true); setMobileMenuOpen(false); } },
    { label: 'Gerar Link', icon: Link2, action: () => { setGerarLinkOpen(true); setMobileMenuOpen(false); }, disabled: !currentLista || isFinalized },
    { label: 'Finalizadas', icon: CheckSquare, action: () => { setFinalizadasOpen(true); setMobileMenuOpen(false); } },
    { label: 'Fornecedores', icon: Users, action: () => { setFornecedoresOpen(true); setMobileMenuOpen(false); } },
    { label: 'Chat IA', icon: MessageCircle, action: () => { setChatOpen(true); setMobileMenuOpen(false); } },
    { label: 'Perfil', icon: UserIcon, action: () => { setPerfilOpen(true); setMobileMenuOpen(false); } },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <ProfileGate>
        <></>
      </ProfileGate>
      
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-md shadow-primary/20">
            <Table className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-display font-bold text-slate-800 tracking-tight">CISS & CONSINCO</h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <SidebarLink icon={<Home />} label="Início" active={showDashboard} onClick={handleBackToDashboard} />
          
          <div className="pt-4 pb-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ações Rápidas</div>
          <SidebarLink icon={<Upload />} label="Nova Cotação" onClick={() => setImportOpen(true)} />
          <SidebarLink icon={<Link2 />} label="Gerar Links" onClick={() => setGerarLinkOpen(true)} />
          <SidebarLink icon={<Users />} label="Fornecedores" onClick={() => setFornecedoresOpen(true)} />
          
          <div className="pt-4 pb-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Painéis</div>
          <SidebarLink icon={<BarChart3 />} label="Análise" active={!showDashboard && activeTab === 'analise'} onClick={() => { if (!showDashboard) setActiveTab('analise'); }} />
          <SidebarLink icon={<MessageCircle />} label="Assistente IA" onClick={() => setChatOpen(true)} />
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={() => setPerfilOpen(true)}
            className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-slate-50 transition-colors group"
          >
            <Avatar className="w-9 h-9 border border-slate-200 group-hover:border-primary/30 transition-colors">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                {profile?.nome ? profile.nome.substring(0, 1).toUpperCase() : <UserIcon className="w-4 h-4" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-slate-700 truncate">{profile?.nome || 'Meu Perfil'}</p>
              <p className="text-[10px] text-slate-400 font-medium">Configurações</p>
            </div>
          </button>
        </div>
      </aside>

      {/* Mobile Content Wrapper */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header Mobile */}
        <header className="md:hidden bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
          <button onClick={handleBackToDashboard}>
            <h1 className="text-lg font-display font-bold tracking-tight">Nilo Atacadista</h1>
          </button>
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8 border border-slate-200">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                {profile?.nome ? profile.nome.substring(0, 1).toUpperCase() : <UserIcon className="w-4 h-4" />}
              </AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </header>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-card border-b border-border px-4 py-2 space-y-1 shrink-0 z-50 shadow-lg animate-in slide-in-from-top duration-200">
            {navItems.map(item => (
              <button
                key={item.label}
                onClick={() => { item.action(); setMobileMenuOpen(false); }}
                disabled={item.disabled}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-semibold text-left transition-colors ${
                  item.disabled ? 'opacity-40 cursor-not-allowed text-slate-400' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
            <button
              onClick={() => { signOut(); setMobileMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-semibold text-left text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        )}

        {/* Lista info bar with tabs */}
        {currentLista && !showDashboard && (
          <div className="shrink-0 border-b border-border bg-white">
            <div className="bg-slate-50 px-4 sm:px-6 py-2 text-sm text-slate-600 flex items-center gap-2 flex-wrap">
              <button onClick={handleBackToDashboard} className="text-primary hover:underline text-xs font-semibold">
                ← Início
              </button>
              <span className="text-slate-300">·</span>
              <span className="font-bold text-slate-800">{currentLista.nome}</span>
              <span className="text-slate-400 text-xs">
                {currentLista.produtos.length} itens · {respostas.length} respostas
              </span>
              {isFinalized && (
                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                  FINALIZADA
                </span>
              )}
            </div>
            {/* Tabs */}
            {respostas.length > 0 && (
              <div className="flex px-4 sm:px-6 border-t border-slate-100">
                <button
                  onClick={() => setActiveTab('planilha')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
                    activeTab === 'planilha' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  Planilha
                </button>
                <button
                  onClick={() => setActiveTab('analise')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
                    activeTab === 'analise' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Análise
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-auto bg-slate-50/50">

        {showDashboard ? (
          <Dashboard onNavigate={handleDashboardNavigate} />
        ) : activeTab === 'planilha' ? (
          <SpreadsheetTable
            produtos={currentLista?.produtos ?? []}
            respostas={respostas}
            readOnly={false}
            highlightLowest={respostas.length > 1}
            listaId={currentLista?.id}
            onDeleteResposta={currentLista ? async (empresa: string) => {
              const { error } = await supabase
                .from('respostas')
                .delete()
                .eq('lista_id', currentLista.id)
                .eq('empresa', empresa);
              if (error) {
                toast.error('Erro ao excluir dados do fornecedor.');
              } else {
                setRespostas(prev => prev.filter(r => r.empresa !== empresa));
                toast.success(`Dados de "${empresa}" excluídos com sucesso.`);
              }
            } : undefined}
            onSave={currentLista ? async (updatedProdutos) => {
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
            onAfterSave={currentLista ? () => loadRespostas(currentLista.id) : undefined}
            onAddEmpresa={currentLista ? async (empresa: string, states: ('MT' | 'GO')[]) => {
              const marker = [{ __manual_states: states }] as any;
              const { error } = await supabase
                .from('respostas')
                .insert({ lista_id: currentLista.id, empresa, resposta: marker, user_id: user?.id });
              if (error) {
                toast.error('Erro ao adicionar fornecedor.');
              } else {
                await loadRespostas(currentLista.id);
                toast.success(`Coluna "${empresa}" adicionada em ${states.join(' e ')}!`);
              }
            } : undefined}
            onAddProduto={!isFinalized && currentLista ? (rowIndex) => {
              const newProd = { codigo_interno: '', descricao: 'Novo Produto', codigo_barras: '' };
              const newProdutos = [...currentLista.produtos];
              newProdutos.splice(rowIndex + 1, 0, newProd);
              setCurrentLista({ ...currentLista, produtos: newProdutos });
              toast.info('Produto adicionado. Lembre-se de salvar as alterações.');
            } : undefined}
            onDeleteProduto={!isFinalized && currentLista ? (rowIndex) => {
              const newProdutos = [...currentLista.produtos];
              newProdutos.splice(rowIndex, 1);
              setCurrentLista({ ...currentLista, produtos: newProdutos });
              toast.info('Produto removido. Lembre-se de salvar as alterações.');
            } : undefined}
          />
        ) : (
          <AnalisePrecosPanel
            produtos={currentLista?.produtos ?? []}
            respostas={respostas}
            listaNome={currentLista?.nome}
          />
        )}
        </div>
      </div>

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
        onDownloadCISS={(l) => handleDownloadResultados(l, 'CISS')}
        onDownloadCONSINCO={(l) => handleDownloadResultados(l, 'CONSINCO')}
      />
      <FornecedoresPanel open={fornecedoresOpen} onOpenChange={setFornecedoresOpen} />
      {currentLista && (
        <GerarLinkPanel open={gerarLinkOpen} onOpenChange={setGerarLinkOpen} listaId={currentLista.id} />
      )}
      <FloatingChat open={chatOpen} onOpenChange={setChatOpen} hideBubble />
      <PerfilPanel open={perfilOpen} onOpenChange={setPerfilOpen} />
    </div>
  );
};

export default Index;
