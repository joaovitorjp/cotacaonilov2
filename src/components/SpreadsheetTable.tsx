import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { AlignLeft, AlignCenter, AlignRight, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Copy, ClipboardPaste, Bold, Italic, Paintbrush, X, Save, Percent, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Produto {
  codigo_interno: string;
  descricao: string;
  codigo_barras: string;
}

interface RespostaEmpresa {
  empresa: string;
  resposta: { codigo_interno: string; preco: number | string }[];
}

interface SpreadsheetTableProps {
  produtos: Produto[];
  respostas: RespostaEmpresa[];
  readOnly?: boolean;
  editableColumn?: string;
  onPriceChange?: (rowIndex: number, preco: string) => void;
  editPrices?: Record<number, string>;
  highlightLowest?: boolean;
  onSave?: (produtos: Produto[]) => void;
  listaId?: string;
}

const parsePrice = (val: string | number): number => {
  if (typeof val === 'number') return val;
  if (!val || val === '') return Infinity;
  const normalized = val.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized);
  return isNaN(num) ? Infinity : num;
};

const MIN_COL_WIDTH = 40;
const MIN_ROW_HEIGHT = 21;
const DEFAULT_ROW_HEIGHT = 25;
const HEADER_HEIGHT = 28;

type TextAlign = 'left' | 'center' | 'right';

interface CellPos {
  row: number;
  col: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  type: 'cell' | 'column' | 'row';
  colIdx?: number;
  rowIdx?: number;
}

const SpreadsheetTable: React.FC<SpreadsheetTableProps> = ({
  produtos,
  respostas,
  readOnly = false,
  editableColumn,
  onPriceChange,
  editPrices = {},
  highlightLowest = false,
  onSave,
  listaId,
}) => {
  const empresas = respostas.map(r => r.empresa);

  // Editable cell data: key = "row-origColIdx", value = edited string
  const [cellEdits, setCellEdits] = useState<Record<string, string>>({});
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const getPreco = (empresa: string, codigoInterno: string) => {
    const resp = respostas.find(r => r.empresa === empresa);
    if (!resp) return '';
    const item = resp.resposta.find(i => i.codigo_interno === codigoInterno);
    return item ? item.preco : '';
  };

  const getLowestEmpresa = (codigoInterno: string): string | null => {
    if (!highlightLowest || empresas.length === 0) return null;
    let lowest = Infinity;
    let lowestEmp: string | null = null;
    for (const emp of empresas) {
      const raw = getPreco(emp, codigoInterno);
      const val = parsePrice(raw as string | number);
      if (val < lowest && val > 0) { lowest = val; lowestEmp = emp; }
    }
    return lowestEmp;
  };

  const EMPTY_ROWS = 30;
  const EMPTY_COLS = 8;

  const totalCols = 4 + empresas.length + (editableColumn && !empresas.includes(editableColumn) ? 1 : 0);
  const gridCols = Math.max(totalCols, EMPTY_COLS);
  const fillerCols = gridCols - totalCols;
  const fillerRows = produtos.length > 0 ? Math.max(0, EMPTY_ROWS - produtos.length) : EMPTY_ROWS;

  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<number, number>>({});
  const [activeColResize, setActiveColResize] = useState<number | null>(null);
  const [activeRowResize, setActiveRowResize] = useState<number | null>(null);

  // Alignment state
  const [cellAligns, setCellAligns] = useState<Record<string, TextAlign>>({});
  const [colAligns, setColAligns] = useState<Record<number, TextAlign>>({});
  const [rowAligns, setRowAligns] = useState<Record<number, TextAlign>>({});

  // Formatting state (bold, italic, bgColor)
  const [cellBold, setCellBold] = useState<Record<string, boolean>>({});
  const [cellItalic, setCellItalic] = useState<Record<string, boolean>>({});
  const [cellBgColor, setCellBgColor] = useState<Record<string, string>>({});
  const [colBold, setColBold] = useState<Record<number, boolean>>({});
  const [colItalic, setColItalic] = useState<Record<number, boolean>>({});
  const [colBgColor, setColBgColor] = useState<Record<number, string>>({});
  const [rowBold, setRowBold] = useState<Record<number, boolean>>({});
  const [rowItalic, setRowItalic] = useState<Record<number, boolean>>({});
  const [rowBgColor, setRowBgColor] = useState<Record<number, string>>({});

  // Column/row order for drag-move
  const [colOrder, setColOrder] = useState<number[]>([]);
  const [rowOrder, setRowOrder] = useState<number[]>([]);

  // Drag state
  const [dragCol, setDragCol] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);
  const [dragRow, setDragRow] = useState<number | null>(null);
  const [dragOverRow, setDragOverRow] = useState<number | null>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Selection state
  const [activeCell, setActiveCell] = useState<CellPos | null>(null);
  const [selectionAnchor, setSelectionAnchor] = useState<CellPos | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<CellPos | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const tableRef = useRef<HTMLTableElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  interface ColDef {
    key: string;
    label: string;
    defaultAlign: TextAlign;
    isData: boolean;
    originalIdx: number;
    sticky?: boolean;
    highlight?: boolean;
  }

  // Build column definitions
  const baseColDefs = useMemo((): ColDef[] => [
    { key: '#', label: '', defaultAlign: 'center', isData: false, originalIdx: 0 },
    { key: 'cod_int', label: 'Código Interno', defaultAlign: 'center', sticky: true, isData: true, originalIdx: 1 },
    { key: 'desc', label: 'Descrição', defaultAlign: 'left', isData: true, originalIdx: 2 },
    { key: 'cod_bar', label: 'Código de Barras', defaultAlign: 'center', isData: true, originalIdx: 3 },
    ...empresas.map((emp, i) => ({ key: `emp_${emp}`, label: emp, defaultAlign: 'center' as TextAlign, highlight: editableColumn === emp, isData: true, originalIdx: 4 + i })),
    ...(editableColumn && !empresas.includes(editableColumn) ? [{ key: `emp_${editableColumn}`, label: editableColumn, defaultAlign: 'center' as TextAlign, highlight: true, isData: true, originalIdx: 4 + empresas.length }] : []),
    ...Array.from({ length: fillerCols }).map((_, i) => ({ key: `filler_${i}`, label: '', defaultAlign: 'center' as TextAlign, isData: false, originalIdx: totalCols + i })),
  ], [empresas.length, editableColumn, fillerCols, totalCols]);

  // Initialize column order
  useEffect(() => {
    setColOrder(baseColDefs.map((_, i) => i));
  }, [baseColDefs.length]);

  // Initialize row order
  useEffect(() => {
    const total = produtos.length + fillerRows;
    setRowOrder(Array.from({ length: total }, (_, i) => i));
  }, [produtos.length, fillerRows]);

  const orderedColDefs = colOrder.length === baseColDefs.length
    ? colOrder.map(i => ({ ...baseColDefs[i], orderIdx: i }))
    : baseColDefs.map((c, i) => ({ ...c, orderIdx: i }));

  // Total data rows
  const totalRows = produtos.length + fillerRows;

  // Auto-fit column widths on data change
  useEffect(() => {
    if (!tableRef.current) return;
    const timer = setTimeout(() => {
      const newWidths: Record<number, number> = {};
      for (let i = 0; i < gridCols; i++) {
        if (colWidths[i]) continue;
        const cells = tableRef.current!.querySelectorAll(
          `thead th:nth-child(${i + 1}), tbody td:nth-child(${i + 1})`
        );
        let max = i === 0 ? 36 : MIN_COL_WIDTH;
        cells.forEach(cell => {
          const el = cell as HTMLElement;
          const prev = el.style.width;
          el.style.width = 'auto';
          const w = el.scrollWidth + 8;
          el.style.width = prev;
          if (w > max) max = w;
        });
        newWidths[i] = Math.max(max, i === 2 ? 200 : i === 0 ? 36 : 80);
      }
      setColWidths(prev => ({ ...newWidths, ...prev }));
    }, 50);
    return () => clearTimeout(timer);
  }, [produtos, respostas, empresas.length, gridCols]);

  const getColWidth = (i: number) => colWidths[i] || (i === 0 ? 36 : i === 2 ? 200 : 80);

  // Get effective alignment for a cell
  const getCellAlign = (colIdx: number, rowIdx: number, defaultAlign: TextAlign): TextAlign => {
    const cellKey = `${rowIdx}-${colIdx}`;
    if (cellAligns[cellKey]) return cellAligns[cellKey];
    if (rowAligns[rowIdx]) return rowAligns[rowIdx];
    if (colAligns[colIdx]) return colAligns[colIdx];
    return defaultAlign;
  };

  const alignClass = (align: TextAlign) => {
    if (align === 'left') return 'text-left';
    if (align === 'right') return 'text-right';
    return 'text-center';
  };

  // Get effective formatting for a cell (cell > row > col)
  const getCellFormatting = (colIdx: number, rowIdx: number) => {
    const key = `${rowIdx}-${colIdx}`;
    return {
      bold: cellBold[key] ?? rowBold[rowIdx] ?? colBold[colIdx] ?? false,
      italic: cellItalic[key] ?? rowItalic[rowIdx] ?? colItalic[colIdx] ?? false,
      bgColor: cellBgColor[key] || rowBgColor[rowIdx] || colBgColor[colIdx] || '',
    };
  };

  // Selection helpers
  const getSelectionRange = useCallback((): { minRow: number; maxRow: number; minCol: number; maxCol: number } | null => {
    if (!selectionAnchor || !selectionEnd) {
      if (activeCell) return { minRow: activeCell.row, maxRow: activeCell.row, minCol: activeCell.col, maxCol: activeCell.col };
      return null;
    }
    return {
      minRow: Math.min(selectionAnchor.row, selectionEnd.row),
      maxRow: Math.max(selectionAnchor.row, selectionEnd.row),
      minCol: Math.min(selectionAnchor.col, selectionEnd.col),
      maxCol: Math.max(selectionAnchor.col, selectionEnd.col),
    };
  }, [selectionAnchor, selectionEnd, activeCell]);

  const isCellSelected = useCallback((row: number, col: number): boolean => {
    const range = getSelectionRange();
    if (!range) return false;
    return row >= range.minRow && row <= range.maxRow && col >= range.minCol && col <= range.maxCol;
  }, [getSelectionRange]);

  const isCellActive = useCallback((row: number, col: number): boolean => {
    return activeCell?.row === row && activeCell?.col === col;
  }, [activeCell]);

  // Get cell value for copy
  const getCellValue = useCallback((rowIdx: number, colIdx: number): string => {
    if (rowIdx >= produtos.length) return '';
    const prod = produtos[rowIdx];
    // Find the original column index from ordered defs
    const colDef = orderedColDefs[colIdx];
    if (!colDef) return '';
    const origIdx = colDef.originalIdx;

    if (origIdx === 0) return String(rowIdx + 1);
    if (origIdx === 1) return prod.codigo_interno;
    if (origIdx === 2) return prod.descricao;
    if (origIdx === 3) return prod.codigo_barras;
    if (origIdx >= 4 && origIdx < 4 + empresas.length) {
      const emp = empresas[origIdx - 4];
      if (editableColumn === emp && editPrices[rowIdx] !== undefined) return editPrices[rowIdx];
      const raw = getPreco(emp, prod.codigo_interno);
      if (raw === '' || raw === undefined || raw === null) return '';
      const num = parsePrice(raw as string | number);
      return num === Infinity ? String(raw) : Number(num).toFixed(2).replace('.', ',');
    }
    if (editableColumn && !empresas.includes(editableColumn) && origIdx === 4 + empresas.length) {
      return editPrices[rowIdx] ?? '';
    }
    return '';
  }, [produtos, orderedColDefs, empresas, editableColumn, editPrices, respostas]);

  // Cell click handler
  const handleCellClick = useCallback((row: number, col: number, e: React.MouseEvent) => {
    if (col === 0) return; // row number column
    if (e.shiftKey && activeCell) {
      // Extend selection
      setSelectionEnd({ row, col });
    } else {
      setActiveCell({ row, col });
      setSelectionAnchor({ row, col });
      setSelectionEnd({ row, col });
    }
    setContextMenu(null);
  }, [activeCell]);

  // Double-click to edit cell
  const handleCellDoubleClick = useCallback((row: number, visualCol: number, origIdx: number) => {
    if (readOnly) return;
    // Get current displayed value
    const editKey = `${row}-${origIdx}`;
    let currentVal = cellEdits[editKey];
    if (currentVal === undefined && row < produtos.length) {
      const prod = produtos[row];
      if (origIdx === 1) currentVal = prod.codigo_interno;
      else if (origIdx === 2) currentVal = prod.descricao;
      else if (origIdx === 3) currentVal = prod.codigo_barras;
      else currentVal = '';
    }
    setEditingCell({ row, col: visualCol });
    setEditingValue(currentVal ?? '');
    setTimeout(() => editInputRef.current?.focus(), 0);
  }, [readOnly, cellEdits, produtos]);

  const commitEdit = useCallback((origIdx: number) => {
    if (!editingCell) return;
    const editKey = `${editingCell.row}-${origIdx}`;
    setCellEdits(prev => ({ ...prev, [editKey]: editingValue }));
    setHasUnsavedChanges(true);
    setEditingCell(null);
  }, [editingCell, editingValue]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  // Get display value for a cell (edited or original)
  const getDisplayValue = useCallback((row: number, origIdx: number): string => {
    const editKey = `${row}-${origIdx}`;
    if (cellEdits[editKey] !== undefined) return cellEdits[editKey];
    if (row >= produtos.length) return '';
    const prod = produtos[row];
    if (origIdx === 1) return prod.codigo_interno;
    if (origIdx === 2) return prod.descricao;
    if (origIdx === 3) return prod.codigo_barras;
    return '';
  }, [cellEdits, produtos]);

  // Save handler
  const handleSave = useCallback(() => {
    if (!onSave) return;
    const updated = produtos.map((prod, rowIdx) => ({
      codigo_interno: cellEdits[`${rowIdx}-1`] ?? prod.codigo_interno,
      descricao: cellEdits[`${rowIdx}-2`] ?? prod.descricao,
      codigo_barras: cellEdits[`${rowIdx}-3`] ?? prod.codigo_barras,
    }));
    onSave(updated);
    setCellEdits({});
    setHasUnsavedChanges(false);
  }, [onSave, produtos, cellEdits]);

  // Mouse down for drag selection
  const handleCellMouseDown = useCallback((row: number, col: number, e: React.MouseEvent) => {
    if (col === 0 || e.button !== 0 || e.shiftKey) return;
    setIsSelecting(true);
    setActiveCell({ row, col });
    setSelectionAnchor({ row, col });
    setSelectionEnd({ row, col });
  }, []);

  const handleCellMouseEnter = useCallback((row: number, col: number) => {
    if (!isSelecting || col === 0) return;
    setSelectionEnd({ row, col });
  }, [isSelecting]);

  useEffect(() => {
    const handleMouseUp = () => setIsSelecting(false);
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeCell) return;
      // Don't intercept if typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && !['ArrowUp', 'ArrowDown', 'Tab', 'Enter', 'Escape'].includes(e.key)) return;

      const maxCol = orderedColDefs.length - 1;
      const maxRow = totalRows - 1;
      let newRow = activeCell.row;
      let newCol = activeCell.col;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          newRow = Math.max(0, activeCell.row - 1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          newRow = Math.min(maxRow, activeCell.row + 1);
          break;
        case 'ArrowLeft':
          if (target.tagName === 'INPUT') return;
          e.preventDefault();
          newCol = Math.max(1, activeCell.col - 1);
          break;
        case 'ArrowRight':
          if (target.tagName === 'INPUT') return;
          e.preventDefault();
          newCol = Math.min(maxCol, activeCell.col + 1);
          break;
        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) {
            newCol = activeCell.col - 1;
            if (newCol < 1) { newCol = maxCol; newRow = Math.max(0, activeCell.row - 1); }
          } else {
            newCol = activeCell.col + 1;
            if (newCol > maxCol) { newCol = 1; newRow = Math.min(maxRow, activeCell.row + 1); }
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (e.shiftKey) {
            newRow = Math.max(0, activeCell.row - 1);
          } else {
            newRow = Math.min(maxRow, activeCell.row + 1);
          }
          break;
        case 'Escape':
          setActiveCell(null);
          setSelectionAnchor(null);
          setSelectionEnd(null);
          return;
        default:
          return;
      }

      const pos = { row: newRow, col: newCol };
      setActiveCell(pos);
      if (e.shiftKey && e.key.startsWith('Arrow')) {
        setSelectionEnd(pos);
      } else {
        setSelectionAnchor(pos);
        setSelectionEnd(pos);
      }

      // Scroll active cell into view
      const cell = tableRef.current?.querySelector(`[data-cell="${newRow}-${newCol}"]`) as HTMLElement;
      cell?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeCell, orderedColDefs.length, totalRows]);

  // Copy (Ctrl+C)
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      const range = getSelectionRange();
      if (!range) return;
      // Don't intercept if in an input with text selected
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT') {
        const input = target as HTMLInputElement;
        if (input.selectionStart !== input.selectionEnd) return;
      }

      e.preventDefault();
      const lines: string[] = [];
      for (let r = range.minRow; r <= range.maxRow; r++) {
        const cells: string[] = [];
        for (let c = range.minCol; c <= range.maxCol; c++) {
          cells.push(getCellValue(r, c));
        }
        lines.push(cells.join('\t'));
      }
      e.clipboardData?.setData('text/plain', lines.join('\n'));
    };

    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, [getSelectionRange, getCellValue]);

  // Paste (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!activeCell || readOnly) return;
      const target = e.target as HTMLElement;
      // Allow paste in inputs normally if not our managed cell
      if (target.tagName === 'INPUT') return;

      const text = e.clipboardData?.getData('text/plain');
      if (!text) return;
      e.preventDefault();

      const lines = text.split('\n').map(l => l.split('\t'));
      for (let r = 0; r < lines.length; r++) {
        for (let c = 0; c < lines[r].length; c++) {
          const targetRow = activeCell.row + r;
          const targetCol = activeCell.col + c;
          if (targetRow >= produtos.length) continue;
          const colDef = orderedColDefs[targetCol];
          if (!colDef) continue;
          const origIdx = colDef.originalIdx;
          // Only paste into editable columns
          const isEditableEmpCol = origIdx >= 4 && editableColumn && (
            (origIdx < 4 + empresas.length && empresas[origIdx - 4] === editableColumn) ||
            (!empresas.includes(editableColumn) && origIdx === 4 + empresas.length)
          );
          if (isEditableEmpCol) {
            onPriceChange?.(targetRow, lines[r][c]);
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [activeCell, readOnly, orderedColDefs, editableColumn, empresas, produtos.length, onPriceChange]);

  // Column resize
  const handleColResizeStart = useCallback((e: React.MouseEvent, colIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = getColWidth(colIdx);
    setActiveColResize(colIdx);

    const onMouseMove = (ev: MouseEvent) => {
      const diff = ev.clientX - startX;
      setColWidths(prev => ({ ...prev, [colIdx]: Math.max(MIN_COL_WIDTH, startW + diff) }));
    };
    const onMouseUp = () => {
      setActiveColResize(null);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [colWidths]);

  // Row resize
  const handleRowResizeStart = useCallback((e: React.MouseEvent, rowIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = rowHeights[rowIdx] || DEFAULT_ROW_HEIGHT;
    setActiveRowResize(rowIdx);

    const onMouseMove = (ev: MouseEvent) => {
      const diff = ev.clientY - startY;
      setRowHeights(prev => ({ ...prev, [rowIdx]: Math.max(MIN_ROW_HEIGHT, startH + diff) }));
    };
    const onMouseUp = () => {
      setActiveRowResize(null);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [rowHeights]);

  // Double-click to auto-fit column
  const handleColAutoFit = useCallback((colIdx: number) => {
    if (!tableRef.current) return;
    const cells = tableRef.current.querySelectorAll(
      `thead th:nth-child(${colIdx + 1}), tbody td:nth-child(${colIdx + 1})`
    );
    let max = MIN_COL_WIDTH;
    cells.forEach(cell => {
      const el = cell as HTMLElement;
      const prev = el.style.width;
      el.style.width = 'auto';
      const w = el.scrollWidth + 12;
      el.style.width = prev;
      if (w > max) max = w;
    });
    setColWidths(prev => ({ ...prev, [colIdx]: max }));
  }, []);

  const handleRowAutoFit = useCallback((rowIdx: number) => {
    setRowHeights(prev => { const copy = { ...prev }; delete copy[rowIdx]; return copy; });
  }, []);

  // Column drag-move
  const handleColDragStart = (e: React.DragEvent, colIdx: number) => {
    if (colIdx === 0) return;
    e.dataTransfer.effectAllowed = 'move';
    setDragCol(colIdx);
  };
  const handleColDragOver = (e: React.DragEvent, colIdx: number) => {
    if (dragCol === null || colIdx === 0) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colIdx);
  };
  const handleColDrop = (e: React.DragEvent, colIdx: number) => {
    e.preventDefault();
    if (dragCol === null || dragCol === colIdx || colIdx === 0) { setDragCol(null); setDragOverCol(null); return; }
    setColOrder(prev => {
      const order = [...prev];
      const fromPos = order.indexOf(dragCol);
      const toPos = order.indexOf(colIdx);
      if (fromPos === -1 || toPos === -1) return order;
      const [moved] = order.splice(fromPos, 1);
      order.splice(toPos, 0, moved);
      return order;
    });
    setDragCol(null);
    setDragOverCol(null);
  };
  const handleColDragEnd = () => { setDragCol(null); setDragOverCol(null); };

  // Row drag-move
  const handleRowDragStart = (e: React.DragEvent, rowIdx: number) => {
    e.dataTransfer.effectAllowed = 'move';
    setDragRow(rowIdx);
  };
  const handleRowDragOver = (e: React.DragEvent, rowIdx: number) => {
    if (dragRow === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverRow(rowIdx);
  };
  const handleRowDrop = (e: React.DragEvent, rowIdx: number) => {
    e.preventDefault();
    if (dragRow === null || dragRow === rowIdx) { setDragRow(null); setDragOverRow(null); return; }
    setRowOrder(prev => {
      const order = [...prev];
      const fromPos = order.indexOf(dragRow);
      const toPos = order.indexOf(rowIdx);
      if (fromPos === -1 || toPos === -1) return order;
      const [moved] = order.splice(fromPos, 1);
      order.splice(toPos, 0, moved);
      return order;
    });
    setDragRow(null);
    setDragOverRow(null);
  };
  const handleRowDragEnd = () => { setDragRow(null); setDragOverRow(null); };

  // Context menu
  const handleContextMenu = (e: React.MouseEvent, type: 'cell' | 'column' | 'row', colIdx?: number, rowIdx?: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, colIdx, rowIdx });
  };

  const setAlignment = (align: TextAlign) => {
    if (!contextMenu) return;
    const { type, colIdx, rowIdx } = contextMenu;
    if (type === 'cell' && colIdx !== undefined && rowIdx !== undefined) {
      setCellAligns(prev => ({ ...prev, [`${rowIdx}-${colIdx}`]: align }));
    } else if (type === 'column' && colIdx !== undefined) {
      setColAligns(prev => ({ ...prev, [colIdx]: align }));
    } else if (type === 'row' && rowIdx !== undefined) {
      setRowAligns(prev => ({ ...prev, [rowIdx]: align }));
    }
    setContextMenu(null);
  };

  const moveColumn = (direction: 'left' | 'right') => {
    if (!contextMenu || contextMenu.colIdx === undefined) return;
    const colIdx = contextMenu.colIdx;
    setColOrder(prev => {
      const order = [...prev];
      const pos = order.indexOf(colIdx);
      if (pos === -1) return order;
      const newPos = direction === 'left' ? pos - 1 : pos + 1;
      if (newPos < 1 || newPos >= order.length) return order;
      const [moved] = order.splice(pos, 1);
      order.splice(newPos, 0, moved);
      return order;
    });
    setContextMenu(null);
  };

  const moveRow = (direction: 'up' | 'down') => {
    if (!contextMenu || contextMenu.rowIdx === undefined) return;
    const rowIdx = contextMenu.rowIdx;
    setRowOrder(prev => {
      const order = [...prev];
      const pos = order.indexOf(rowIdx);
      if (pos === -1) return order;
      const newPos = direction === 'up' ? pos - 1 : pos + 1;
      if (newPos < 0 || newPos >= order.length) return order;
      const [moved] = order.splice(pos, 1);
      order.splice(newPos, 0, moved);
      return order;
    });
    setContextMenu(null);
  };

  const BG_COLORS = [
    { label: 'Amarelo', value: '#FEF9C3' },
    { label: 'Verde', value: '#DCFCE7' },
    { label: 'Azul', value: '#DBEAFE' },
    { label: 'Rosa', value: '#FCE7F3' },
    { label: 'Laranja', value: '#FED7AA' },
    { label: 'Roxo', value: '#E9D5FF' },
    { label: 'Cinza', value: '#F3F4F6' },
  ];

  const toggleBold = () => {
    if (!contextMenu) return;
    const { type, colIdx, rowIdx } = contextMenu;
    if (type === 'cell' && colIdx !== undefined && rowIdx !== undefined) {
      const key = `${rowIdx}-${colIdx}`;
      setCellBold(prev => ({ ...prev, [key]: !prev[key] }));
    } else if (type === 'column' && colIdx !== undefined) {
      setColBold(prev => ({ ...prev, [colIdx]: !prev[colIdx] }));
    } else if (type === 'row' && rowIdx !== undefined) {
      setRowBold(prev => ({ ...prev, [rowIdx]: !prev[rowIdx] }));
    }
    setContextMenu(null);
  };

  const toggleItalic = () => {
    if (!contextMenu) return;
    const { type, colIdx, rowIdx } = contextMenu;
    if (type === 'cell' && colIdx !== undefined && rowIdx !== undefined) {
      const key = `${rowIdx}-${colIdx}`;
      setCellItalic(prev => ({ ...prev, [key]: !prev[key] }));
    } else if (type === 'column' && colIdx !== undefined) {
      setColItalic(prev => ({ ...prev, [colIdx]: !prev[colIdx] }));
    } else if (type === 'row' && rowIdx !== undefined) {
      setRowItalic(prev => ({ ...prev, [rowIdx]: !prev[rowIdx] }));
    }
    setContextMenu(null);
  };

  const setBgColor = (color: string) => {
    if (!contextMenu) return;
    const { type, colIdx, rowIdx } = contextMenu;
    if (type === 'cell' && colIdx !== undefined && rowIdx !== undefined) {
      const key = `${rowIdx}-${colIdx}`;
      setCellBgColor(prev => ({ ...prev, [key]: color }));
    } else if (type === 'column' && colIdx !== undefined) {
      setColBgColor(prev => ({ ...prev, [colIdx]: color }));
    } else if (type === 'row' && rowIdx !== undefined) {
      setRowBgColor(prev => ({ ...prev, [rowIdx]: color }));
    }
    setContextMenu(null);
  };

  const handleCopyFromMenu = () => {
    document.execCommand('copy');
    setContextMenu(null);
  };

  const handlePasteFromMenu = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!activeCell || readOnly || !text) return;
      const lines = text.split('\n').map(l => l.split('\t'));
      for (let r = 0; r < lines.length; r++) {
        for (let c = 0; c < lines[r].length; c++) {
          const targetRow = activeCell.row + r;
          const targetCol = activeCell.col + c;
          if (targetRow >= produtos.length) continue;
          const colDef = orderedColDefs[targetCol];
          if (!colDef) continue;
          const origIdx = colDef.originalIdx;
          const isEditableEmpCol = origIdx >= 4 && editableColumn && (
            (origIdx < 4 + empresas.length && empresas[origIdx - 4] === editableColumn) ||
            (!empresas.includes(editableColumn) && origIdx === 4 + empresas.length)
          );
          if (isEditableEmpCol) {
            onPriceChange?.(targetRow, lines[r][c]);
          }
        }
      }
    } catch { /* clipboard access denied */ }
    setContextMenu(null);
  };

  // Close context menu on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [contextMenu]);

  // Determine ordered rows
  const allRows = useMemo(() => {
    const rows = [...produtos.map((p, i) => ({ prod: p, idx: i, isEmpty: false }))];
    for (let i = 0; i < fillerRows; i++) {
      rows.push({ prod: null as any, idx: produtos.length + i, isEmpty: true });
    }
    return rows;
  }, [produtos, fillerRows]);

  const orderedRows = rowOrder.length === allRows.length
    ? rowOrder.map(i => allRows[i]).filter(Boolean)
    : allRows;

  // Apply sorting
  const sortedRows = useMemo(() => {
    if (sortCol === null) return orderedRows;
    const dataRows = orderedRows.filter(r => !r.isEmpty);
    const emptyRows = orderedRows.filter(r => r.isEmpty);

    dataRows.sort((a, b) => {
      if (!a.prod || !b.prod) return 0;
      let valA = '', valB = '';
      if (sortCol === 1) { valA = a.prod.codigo_interno; valB = b.prod.codigo_interno; }
      else if (sortCol === 2) { valA = a.prod.descricao; valB = b.prod.descricao; }
      else if (sortCol === 3) { valA = a.prod.codigo_barras; valB = b.prod.codigo_barras; }
      else if (sortCol >= 4 && sortCol < 4 + empresas.length) {
        const emp = empresas[sortCol - 4];
        const prA = getPreco(emp, a.prod.codigo_interno);
        const prB = getPreco(emp, b.prod.codigo_interno);
        const numA = parsePrice(prA as string | number);
        const numB = parsePrice(prB as string | number);
        const cmp = numA - numB;
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const cmp = valA.localeCompare(valB, 'pt-BR', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return [...dataRows, ...emptyRows];
  }, [orderedRows, sortCol, sortDir, empresas]);

  // Selection border helpers
  const getSelectionBorders = useCallback((row: number, col: number) => {
    const range = getSelectionRange();
    if (!range) return '';
    const selected = row >= range.minRow && row <= range.maxRow && col >= range.minCol && col <= range.maxCol;
    if (!selected) return '';
    const classes: string[] = [];
    if (row === range.minRow) classes.push('border-t-2 border-t-primary');
    if (row === range.maxRow) classes.push('border-b-2 border-b-primary');
    if (col === range.minCol) classes.push('border-l-2 border-l-primary');
    if (col === range.maxCol) classes.push('border-r-2 border-r-primary');
    return classes.join(' ');
  }, [getSelectionRange]);

  const renderRow = (prod: Produto | null, idx: number, isEmpty: boolean, displayIdx: number) => {
    const lowestEmp = prod ? getLowestEmpresa(prod.codigo_interno) : null;
    const h = rowHeights[idx] || DEFAULT_ROW_HEIGHT;
    const isDragOver = dragOverRow === idx;

    return (
      <tr
        key={isEmpty ? `empty-${idx}` : idx}
        className={`group/row ${isDragOver ? 'border-t-2 border-t-primary' : ''}`}
        style={{ height: `${h}px` }}
      >
        {/* Row number cell */}
        <td
          className="border-r border-b px-0 text-center text-[11px] text-muted-foreground select-none relative cursor-grab active:cursor-grabbing"
          style={{
            borderColor: 'hsl(var(--border))',
            backgroundColor: dragRow === idx ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))',
            minWidth: getColWidth(0),
            width: getColWidth(0),
          }}
          draggable
          onDragStart={e => handleRowDragStart(e, idx)}
          onDragOver={e => handleRowDragOver(e, idx)}
          onDrop={e => handleRowDrop(e, idx)}
          onDragEnd={handleRowDragEnd}
          onContextMenu={e => handleContextMenu(e, 'row', undefined, idx)}
        >
          {prod ? displayIdx + 1 : (produtos.length > 0 ? displayIdx + 1 : '')}
          <div
            className={`absolute left-0 right-0 bottom-[-2px] h-[5px] cursor-row-resize z-30 ${
              activeRowResize === idx ? 'bg-primary' : 'hover:bg-primary/40'
            }`}
            style={{ opacity: activeRowResize === idx ? 1 : undefined }}
            onMouseDown={e => handleRowResizeStart(e, idx)}
            onDoubleClick={() => handleRowAutoFit(idx)}
          />
        </td>

        {/* Data cells in column order */}
        {orderedColDefs.slice(1).map((col, renderIdx) => {
          const colIdx = col.orderIdx;
          const visualColIdx = renderIdx + 1;
          const effectiveAlign = getCellAlign(colIdx, idx, col.defaultAlign);
          const selected = isCellSelected(idx, visualColIdx);
          const active = isCellActive(idx, visualColIdx);
          const selBorders = getSelectionBorders(idx, visualColIdx);
          const fmt = getCellFormatting(colIdx, idx);

          const cellBaseClass = `border-r border-b px-2 ${alignClass(effectiveAlign)} ${
            fmt.bold ? 'font-bold' : ''
          } ${fmt.italic ? 'italic' : ''} ${
            selected && !active ? 'bg-primary/10' : ''
          } ${active ? 'outline outline-2 outline-primary outline-offset-[-2px]' : ''} ${selBorders}`;

          const cellBgStyle = fmt.bgColor && !selected ? { backgroundColor: fmt.bgColor } : {};

          const isEditing = editingCell?.row === idx && editingCell?.col === visualColIdx;

          const cellEvents = {
            onClick: (e: React.MouseEvent) => handleCellClick(idx, visualColIdx, e),
            onMouseDown: (e: React.MouseEvent) => handleCellMouseDown(idx, visualColIdx, e),
            onMouseEnter: () => handleCellMouseEnter(idx, visualColIdx),
            onContextMenu: (e: React.MouseEvent) => handleContextMenu(e, 'cell', colIdx, idx),
            'data-cell': `${idx}-${visualColIdx}`,
          };

          if (isEmpty) {
            return (
              <td
                key={col.key}
                className={`${cellBaseClass} ${col.sticky ? 'sticky left-[36px] bg-background z-[5]' : ''}`}
                style={{
                  borderColor: 'hsl(var(--border))',
                  minWidth: getColWidth(visualColIdx),
                  width: getColWidth(visualColIdx),
                  ...cellBgStyle,
                }}
                {...cellEvents}
              >
                &nbsp;
              </td>
            );
          }

          const origIdx = col.originalIdx;
          if (origIdx >= 1 && origIdx <= 3) {
            const displayVal = getDisplayValue(idx, origIdx);
            const stickyClass = origIdx === 1 ? 'sticky left-[36px] bg-background z-[5]' : '';
            const extraClass = origIdx === 2 ? 'overflow-hidden text-ellipsis' : '';
            return (
              <td
                key={col.key}
                className={`${cellBaseClass} ${stickyClass} whitespace-nowrap ${extraClass} text-xs`}
                style={{ borderColor: 'hsl(var(--border))', minWidth: getColWidth(visualColIdx), width: getColWidth(visualColIdx), ...cellBgStyle }}
                {...cellEvents}
                onDoubleClick={() => handleCellDoubleClick(idx, visualColIdx, origIdx)}
              >
                {isEditing ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    className={`w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1 ${alignClass(effectiveAlign)} text-xs h-full`}
                    value={editingValue}
                    onChange={e => setEditingValue(e.target.value)}
                    onBlur={() => commitEdit(origIdx)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitEdit(origIdx);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                ) : displayVal}
              </td>
            );
          }
          // Empresa columns
          if (origIdx >= 4 && origIdx < 4 + empresas.length) {
            const empIdx = origIdx - 4;
            const emp = empresas[empIdx];
            const isLowest = lowestEmp === emp;
            const isEditable = editableColumn === emp;
            return (
              <td
                key={col.key}
                className={`${cellBaseClass} px-1 whitespace-nowrap text-xs ${
                  isEditable ? 'bg-primary/5' : isLowest ? 'bg-success/10 text-success font-bold' : ''
                }`}
                style={{ borderColor: 'hsl(var(--border))', minWidth: getColWidth(visualColIdx), width: getColWidth(visualColIdx), ...cellBgStyle }}
                {...cellEvents}
              >
                {isEditable && !readOnly ? (
                  <input
                    type="text"
                    inputMode="decimal"
                    className={`w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1 ${alignClass(effectiveAlign)} text-xs h-full`}
                    value={editPrices[idx] ?? ''}
                    onChange={e => onPriceChange?.(idx, e.target.value)}
                    placeholder="0,00"
                  />
                ) : (() => {
                  const raw = getPreco(emp, prod!.codigo_interno);
                  if (raw === '' || raw === undefined || raw === null) return '';
                  const num = parsePrice(raw as string | number);
                  if (num === Infinity) return raw;
                  const finalPrice = getMarkedUpPrice(num, emp);
                  return `R$ ${Number(finalPrice).toFixed(2).replace('.', ',')}`;
                })()}
              </td>
            );
          }
          // Editable column not in empresas
          if (editableColumn && !empresas.includes(editableColumn) && origIdx === 4 + empresas.length) {
            return (
              <td
                key={col.key}
                className={`${cellBaseClass} px-1 bg-primary/5 whitespace-nowrap text-xs`}
                style={{ borderColor: 'hsl(var(--border))', ...cellBgStyle }}
                {...cellEvents}
              >
                {!readOnly ? (
                  <input
                    type="text"
                    inputMode="decimal"
                    className={`w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1 ${alignClass(effectiveAlign)} text-xs`}
                    value={editPrices[idx] ?? ''}
                    onChange={e => onPriceChange?.(idx, e.target.value)}
                    placeholder="0,00"
                  />
                ) : ''}
              </td>
            );
          }
          // Filler
          return (
            <td
              key={col.key}
              className={`${cellBaseClass}`}
              style={{ borderColor: 'hsl(var(--border))', ...cellBgStyle }}
              {...cellEvents}
            >
              &nbsp;
            </td>
          );
        })}
      </tr>
    );
  };

  // Toolbar actions (operate on current selection)
  const getSelectionTarget = (): { type: 'cell'; keys: string[] } | null => {
    const range = getSelectionRange();
    if (!range) return null;
    const keys: string[] = [];
    for (let r = range.minRow; r <= range.maxRow; r++) {
      for (let c = range.minCol; c <= range.maxCol; c++) {
        // Find the colIdx (orderIdx) for visual column c
        const colDef = orderedColDefs[c];
        if (colDef) keys.push(`${r}-${colDef.orderIdx}`);
      }
    }
    return { type: 'cell', keys };
  };

  const toolbarToggleBold = () => {
    const target = getSelectionTarget();
    if (!target) return;
    const allBold = target.keys.every(k => cellBold[k]);
    setCellBold(prev => {
      const next = { ...prev };
      target.keys.forEach(k => { next[k] = !allBold; });
      return next;
    });
  };

  const toolbarToggleItalic = () => {
    const target = getSelectionTarget();
    if (!target) return;
    const allItalic = target.keys.every(k => cellItalic[k]);
    setCellItalic(prev => {
      const next = { ...prev };
      target.keys.forEach(k => { next[k] = !allItalic; });
      return next;
    });
  };

  const toolbarSetAlign = (align: TextAlign) => {
    const target = getSelectionTarget();
    if (!target) return;
    setCellAligns(prev => {
      const next = { ...prev };
      target.keys.forEach(k => { next[k] = align; });
      return next;
    });
  };

  const toolbarSetBgColor = (color: string) => {
    const target = getSelectionTarget();
    if (!target) return;
    setCellBgColor(prev => {
      const next = { ...prev };
      target.keys.forEach(k => { next[k] = color; });
      return next;
    });
  };

  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Column sorting state
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleHeaderSort = useCallback((colIdx: number, origIdx: number) => {
    if (origIdx === 0 || origIdx > 3 + empresas.length) return; // only sort data columns
    if (sortCol === origIdx) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(origIdx);
      setSortDir('asc');
    }
  }, [sortCol, empresas.length]);

  // Price markup state (per empresa)
  const [priceMarkups, setPriceMarkups] = useState<Record<string, number>>({});
  const [markupDialog, setMarkupDialog] = useState<{ empresa: string } | null>(null);
  const [markupValue, setMarkupValue] = useState('');
  const markupInputRef = useRef<HTMLInputElement>(null);

  // Load markups from DB
  useEffect(() => {
    if (!listaId) return;
    const loadMarkups = async () => {
      const { data } = await supabase
        .from('price_markups')
        .select('empresa, markup_percent')
        .eq('lista_id', listaId);
      if (data && data.length > 0) {
        const loaded: Record<string, number> = {};
        data.forEach((row: any) => { loaded[row.empresa] = Number(row.markup_percent); });
        setPriceMarkups(loaded);
      }
    };
    loadMarkups();
  }, [listaId]);

  // Save markup to DB
  const saveMarkupToDb = async (empresa: string, percent: number) => {
    if (!listaId) return;
    if (percent === 0) {
      await supabase
        .from('price_markups')
        .delete()
        .eq('lista_id', listaId)
        .eq('empresa', empresa);
    } else {
      await supabase
        .from('price_markups')
        .upsert(
          { lista_id: listaId, empresa, markup_percent: percent, updated_at: new Date().toISOString() },
          { onConflict: 'lista_id,empresa' }
        );
    }
  };

  useEffect(() => {
    if (markupDialog) {
      setTimeout(() => markupInputRef.current?.focus(), 50);
    }
  }, [markupDialog]);

  const applyMarkup = () => {
    if (!markupDialog) return;
    const pct = parseFloat(markupValue.replace(',', '.'));
    if (isNaN(pct)) {
      setMarkupDialog(null);
      setMarkupValue('');
      return;
    }
    const newVal = (priceMarkups[markupDialog.empresa] || 0) + pct;
    setPriceMarkups(prev => ({
      ...prev,
      [markupDialog.empresa]: newVal,
    }));
    saveMarkupToDb(markupDialog.empresa, newVal);
    setMarkupDialog(null);
    setMarkupValue('');
  };

  const getMarkedUpPrice = (rawPrice: number, empresa: string): number => {
    const markup = priceMarkups[empresa];
    if (!markup) return rawPrice;
    return rawPrice * (1 + markup / 100);
  };

  // Helper to check if a context menu column is a supplier column
  const getContextEmpresa = (): string | null => {
    if (!contextMenu || contextMenu.colIdx === undefined) return null;
    const colDef = orderedColDefs.find(c => c.orderIdx === contextMenu.colIdx);
    if (!colDef) return null;
    const origIdx = colDef.originalIdx;
    if (origIdx >= 4 && origIdx < 4 + empresas.length) {
      return empresas[origIdx - 4];
    }
    return null;
  };

  useEffect(() => {
    if (!showColorPicker) return;
    const handler = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColorPicker]);

  const hasSelection = activeCell !== null;

  // 3. SEARCH: Filter rows
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  return (
    <div className="flex-1 flex flex-col" style={{ border: '1px solid hsl(var(--border))' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/50" style={{ borderColor: 'hsl(var(--border))' }}>
        <button
          onClick={toolbarToggleBold}
          disabled={!hasSelection}
          className="p-1.5 rounded hover:bg-accent disabled:opacity-40 transition-colors"
          title="Negrito"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={toolbarToggleItalic}
          disabled={!hasSelection}
          className="p-1.5 rounded hover:bg-accent disabled:opacity-40 transition-colors"
          title="Itálico"
        >
          <Italic className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <button
          onClick={() => toolbarSetAlign('left')}
          disabled={!hasSelection}
          className="p-1.5 rounded hover:bg-accent disabled:opacity-40 transition-colors"
          title="Alinhar à Esquerda"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => toolbarSetAlign('center')}
          disabled={!hasSelection}
          className="p-1.5 rounded hover:bg-accent disabled:opacity-40 transition-colors"
          title="Centralizar"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={() => toolbarSetAlign('right')}
          disabled={!hasSelection}
          className="p-1.5 rounded hover:bg-accent disabled:opacity-40 transition-colors"
          title="Alinhar à Direita"
        >
          <AlignRight className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <div className="relative">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            disabled={!hasSelection}
            className="p-1.5 rounded hover:bg-accent disabled:opacity-40 transition-colors flex items-center gap-1"
            title="Cor de Fundo"
          >
            <Paintbrush className="w-4 h-4" />
          </button>
          {showColorPicker && (
            <div
              ref={colorPickerRef}
              className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg p-2 z-50 flex gap-1 flex-wrap w-[140px]"
            >
              {BG_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => { toolbarSetBgColor(c.value); setShowColorPicker(false); }}
                  className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
              <button
                onClick={() => { toolbarSetBgColor(''); setShowColorPicker(false); }}
                className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform flex items-center justify-center bg-background"
                title="Remover cor"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>

        {onSave && (
          <>
            <div className="w-px h-5 bg-border mx-1" />
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges}
              className={`p-1.5 rounded transition-colors flex items-center gap-1 text-xs ${
                hasUnsavedChanges
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'hover:bg-accent disabled:opacity-40'
              }`}
              title="Salvar alterações"
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">Salvar</span>
            </button>
          </>
        )}


        {/* Search */}
        <div className="w-px h-5 bg-border mx-1" />
        <button
          onClick={() => setShowSearch(!showSearch)}
          className={`p-1.5 rounded transition-colors ${showSearch ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
          title="Buscar"
        >
          <Search className="w-4 h-4" />
        </button>
        {showSearch && (
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              className="w-full h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar código, descrição..."
              autoFocus
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Spreadsheet */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto relative"
        tabIndex={0}
      >
      <table
        ref={tableRef}
        className="border-collapse text-sm min-w-max"
        style={{ tableLayout: 'fixed', fontFamily: 'var(--font-body)', fontSize: '12px' }}
      >
        <colgroup>
          {orderedColDefs.map((col, i) => (
            <col key={col.key} style={{ width: `${getColWidth(i)}px` }} />
          ))}
        </colgroup>

        {/* Header */}
        <thead className="sticky top-0 z-10">
          <tr style={{ height: `${HEADER_HEIGHT}px` }}>
            {orderedColDefs.map((col, i) => {
              const colIdx = col.orderIdx;
              const isDragOverCol = dragOverCol === colIdx;
              return (
                <th
                  key={col.key}
                  className={`border-r border-b px-2 font-semibold whitespace-nowrap relative select-none text-[11px] ${
                    getCellAlign(colIdx, -1, col.defaultAlign) === 'left' ? 'text-left' : getCellAlign(colIdx, -1, col.defaultAlign) === 'right' ? 'text-right' : 'text-center'
                  } ${col.sticky ? 'sticky left-[36px] z-20' : ''} ${
                    col.highlight
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground'
                  } ${isDragOverCol ? 'border-l-2 border-l-primary' : ''}`}
                  style={{
                    borderColor: 'hsl(var(--border))',
                    backgroundColor: col.highlight ? undefined : dragCol === colIdx ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))',
                    height: HEADER_HEIGHT,
                    cursor: i > 0 ? 'grab' : 'default',
                  }}
                  draggable={i > 0}
                  onDragStart={e => handleColDragStart(e, colIdx)}
                  onDragOver={e => handleColDragOver(e, colIdx)}
                  onDrop={e => handleColDrop(e, colIdx)}
                  onDragEnd={handleColDragEnd}
                  onContextMenu={e => handleContextMenu(e, 'column', colIdx)}
                >
                  {col.label}
                  {col.originalIdx >= 4 && col.originalIdx < 4 + empresas.length && priceMarkups[empresas[col.originalIdx - 4]] ? (
                    <span className="ml-1 text-[9px] opacity-70">
                      (+{priceMarkups[empresas[col.originalIdx - 4]].toFixed(1)}%)
                    </span>
                  ) : null}
                  <div
                    className={`absolute top-0 bottom-0 w-[4px] cursor-col-resize z-30 ${
                      activeColResize === i ? 'bg-primary' : 'hover:bg-primary/50'
                    }`}
                    style={{ right: '-2px' }}
                    onMouseDown={e => handleColResizeStart(e, i)}
                    onDoubleClick={() => handleColAutoFit(i)}
                  />
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {orderedRows
            .filter(row => {
              if (!searchTerm.trim() || row.isEmpty || !row.prod) return true;
              const term = searchTerm.toLowerCase();
              return (
                row.prod.codigo_interno.toLowerCase().includes(term) ||
                row.prod.descricao.toLowerCase().includes(term) ||
                row.prod.codigo_barras.toLowerCase().includes(term)
              );
            })
            .map((row, displayIdx) => renderRow(row.prod, row.idx, row.isEmpty, displayIdx))}
        </tbody>
      </table>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-popover border border-border rounded-lg shadow-lg py-1 z-50 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {/* Copy/Paste */}
          <button
            onClick={handleCopyFromMenu}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-foreground"
          >
            <Copy className="w-3.5 h-3.5" /> Copiar (Ctrl+C)
          </button>
          {!readOnly && (
            <button
              onClick={handlePasteFromMenu}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-foreground"
            >
              <ClipboardPaste className="w-3.5 h-3.5" /> Colar (Ctrl+V)
            </button>
          )}

          <div className="border-t border-border my-1" />

          {/* Alignment options */}
          <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Alinhamento {contextMenu.type === 'column' ? 'da Coluna' : contextMenu.type === 'row' ? 'da Linha' : 'da Célula'}
          </div>
          <button onClick={() => setAlignment('left')} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-foreground">
            <AlignLeft className="w-3.5 h-3.5" /> Alinhar à Esquerda
          </button>
          <button onClick={() => setAlignment('center')} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-foreground">
            <AlignCenter className="w-3.5 h-3.5" /> Centralizar
          </button>
          <button onClick={() => setAlignment('right')} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-foreground">
            <AlignRight className="w-3.5 h-3.5" /> Alinhar à Direita
          </button>

          <div className="border-t border-border my-1" />

          {/* Formatting options */}
          <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Formatação
          </div>
          <button onClick={toggleBold} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-foreground">
            <Bold className="w-3.5 h-3.5" /> Negrito
          </button>
          <button onClick={toggleItalic} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-foreground">
            <Italic className="w-3.5 h-3.5" /> Itálico
          </button>

          {/* Background color */}
          <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">
            Cor de Fundo
          </div>
          <div className="flex gap-1 px-3 py-1 flex-wrap">
            {BG_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setBgColor(c.value)}
                className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            ))}
            <button
              onClick={() => setBgColor('')}
              className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform flex items-center justify-center bg-background"
              title="Remover cor"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>

          <div className="border-t border-border my-1" />

          {/* Acrescentar % - only for supplier columns */}
          {(() => {
            const emp = getContextEmpresa();
            if (!emp) return null;
            return (
              <>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Preços</div>
                <button
                  onClick={() => {
                    setMarkupDialog({ empresa: emp });
                    setMarkupValue('');
                    setContextMenu(null);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-foreground"
                >
                  <Percent className="w-3.5 h-3.5" /> Acrescentar %
                  {priceMarkups[emp] ? (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      ({priceMarkups[emp] > 0 ? '+' : ''}{priceMarkups[emp].toFixed(1)}%)
                    </span>
                  ) : null}
                </button>
                {priceMarkups[emp] ? (
                  <button
                    onClick={() => {
                      setPriceMarkups(prev => {
                        const next = { ...prev };
                        delete next[emp];
                        return next;
                      });
                      saveMarkupToDb(emp, 0);
                      setContextMenu(null);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-destructive"
                  >
                    <X className="w-3.5 h-3.5" /> Remover acréscimo
                  </button>
                ) : null}
                <div className="border-t border-border my-1" />
              </>
            );
          })()}

          {/* Move options */}
          {(contextMenu.type === 'column' || contextMenu.type === 'cell') && contextMenu.colIdx !== undefined && contextMenu.colIdx > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mover Coluna</div>
              <button onClick={() => moveColumn('left')} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-foreground">
                <ArrowLeft className="w-3.5 h-3.5" /> Mover para Esquerda
              </button>
              <button onClick={() => moveColumn('right')} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-foreground">
                <ArrowRight className="w-3.5 h-3.5" /> Mover para Direita
              </button>
            </>
          )}

          {(contextMenu.type === 'row' || contextMenu.type === 'cell') && contextMenu.rowIdx !== undefined && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mover Linha</div>
              <button onClick={() => moveRow('up')} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-foreground">
                <ArrowUp className="w-3.5 h-3.5" /> Mover para Cima
              </button>
              <button onClick={() => moveRow('down')} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-foreground">
                <ArrowDown className="w-3.5 h-3.5" /> Mover para Baixo
              </button>
            </>
          )}
        </div>
      )}

      {/* Markup Dialog */}
      {markupDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]" onClick={() => setMarkupDialog(null)}>
          <div className="bg-popover border border-border rounded-lg shadow-xl p-4 w-72" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-foreground mb-1">Acrescentar %</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Fornecedor: <span className="font-bold text-foreground">{markupDialog.empresa}</span>
              {priceMarkups[markupDialog.empresa] ? (
                <span className="ml-1">(acréscimo atual: {priceMarkups[markupDialog.empresa]}%)</span>
              ) : null}
            </p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  ref={markupInputRef}
                  type="text"
                  inputMode="decimal"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={markupValue}
                  onChange={e => setMarkupValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') applyMarkup();
                    if (e.key === 'Escape') setMarkupDialog(null);
                  }}
                  placeholder="Ex: 10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
              <button
                onClick={applyMarkup}
                className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default SpreadsheetTable;
