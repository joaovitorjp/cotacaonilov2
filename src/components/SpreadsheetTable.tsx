import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { AlignLeft, AlignCenter, AlignRight, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Copy, ClipboardPaste } from 'lucide-react';

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
}) => {
  const empresas = respostas.map(r => r.empresa);

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

  // Build column definitions
  const baseColDefs = useMemo(() => [
    { key: '#', label: '', defaultAlign: 'center' as TextAlign, isData: false, originalIdx: 0 },
    { key: 'cod_int', label: 'Código Interno', defaultAlign: 'center' as TextAlign, sticky: true, isData: true, originalIdx: 1 },
    { key: 'desc', label: 'Descrição', defaultAlign: 'left' as TextAlign, isData: true, originalIdx: 2 },
    { key: 'cod_bar', label: 'Código de Barras', defaultAlign: 'center' as TextAlign, isData: true, originalIdx: 3 },
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

          const cellBaseClass = `border-r border-b px-2 ${alignClass(effectiveAlign)} ${
            selected && !active ? 'bg-primary/10' : ''
          } ${active ? 'outline outline-2 outline-primary outline-offset-[-2px]' : ''} ${selBorders}`;

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
                }}
                {...cellEvents}
              >
                &nbsp;
              </td>
            );
          }

          const origIdx = col.originalIdx;
          if (origIdx === 1) {
            return (
              <td
                key={col.key}
                className={`${cellBaseClass} sticky left-[36px] bg-background z-[5] whitespace-nowrap text-xs`}
                style={{ borderColor: 'hsl(var(--border))', minWidth: getColWidth(visualColIdx), width: getColWidth(visualColIdx) }}
                {...cellEvents}
              >
                {prod!.codigo_interno}
              </td>
            );
          }
          if (origIdx === 2) {
            return (
              <td
                key={col.key}
                className={`${cellBaseClass} whitespace-nowrap overflow-hidden text-ellipsis text-xs`}
                style={{ borderColor: 'hsl(var(--border))', minWidth: getColWidth(visualColIdx), width: getColWidth(visualColIdx) }}
                {...cellEvents}
              >
                {prod!.descricao}
              </td>
            );
          }
          if (origIdx === 3) {
            return (
              <td
                key={col.key}
                className={`${cellBaseClass} whitespace-nowrap text-xs`}
                style={{ borderColor: 'hsl(var(--border))', minWidth: getColWidth(visualColIdx), width: getColWidth(visualColIdx) }}
                {...cellEvents}
              >
                {prod!.codigo_barras}
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
                style={{ borderColor: 'hsl(var(--border))', minWidth: getColWidth(visualColIdx), width: getColWidth(visualColIdx) }}
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
                  return num === Infinity ? raw : `R$ ${Number(num).toFixed(2).replace('.', ',')}`;
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
                style={{ borderColor: 'hsl(var(--border))' }}
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
              style={{ borderColor: 'hsl(var(--border))' }}
              {...cellEvents}
            >
              &nbsp;
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto relative"
      style={{ border: '1px solid hsl(var(--border))' }}
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
          {orderedRows.map((row, displayIdx) => renderRow(row.prod, row.idx, row.isEmpty, displayIdx))}
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
    </div>
  );
};

export default SpreadsheetTable;
