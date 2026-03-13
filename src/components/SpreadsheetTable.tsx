import React, { useState, useCallback, useRef, useEffect } from 'react';

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
const MIN_ROW_HEIGHT = 24;
const DEFAULT_ROW_HEIGHT = 30;

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
      if (val < lowest && val > 0) {
        lowest = val;
        lowestEmp = emp;
      }
    }
    return lowestEmp;
  };

  const EMPTY_ROWS = 30;
  const EMPTY_COLS = 8;

  const totalCols = 4 + empresas.length + (editableColumn && !empresas.includes(editableColumn) ? 1 : 0);
  const gridCols = Math.max(totalCols, EMPTY_COLS);
  const fillerCols = gridCols - totalCols;
  const rowCount = produtos.length > 0 ? produtos.length : EMPTY_ROWS;
  const fillerRows = produtos.length > 0 ? Math.max(0, EMPTY_ROWS - produtos.length) : 0;
  const totalRows = rowCount + fillerRows;

  // Column widths state: keyed by column index
  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  // Row heights state: keyed by row index
  const [rowHeights, setRowHeights] = useState<Record<number, number>>({});

  const tableRef = useRef<HTMLTableElement>(null);
  const resizingCol = useRef<{ colIdx: number; startX: number; startW: number; minW: number } | null>(null);
  const resizingRow = useRef<{ rowIdx: number; startY: number; startH: number; minH: number } | null>(null);

  // Measure the minimum width for a column based on content
  const measureColMinWidth = useCallback((colIdx: number): number => {
    if (!tableRef.current) return MIN_COL_WIDTH;
    const cells = tableRef.current.querySelectorAll(`th:nth-child(${colIdx + 1}), td:nth-child(${colIdx + 1})`);
    let maxContentWidth = MIN_COL_WIDTH;
    cells.forEach(cell => {
      const el = cell as HTMLElement;
      // Temporarily remove width constraint to measure natural content width
      const prevWidth = el.style.width;
      const prevOverflow = el.style.overflow;
      el.style.width = 'auto';
      el.style.overflow = 'visible';
      const contentWidth = el.scrollWidth;
      el.style.width = prevWidth;
      el.style.overflow = prevOverflow;
      if (contentWidth > maxContentWidth) maxContentWidth = contentWidth;
    });
    return maxContentWidth;
  }, []);

  // Measure the minimum height for a row based on content
  const measureRowMinHeight = useCallback((rowIdx: number): number => {
    if (!tableRef.current) return MIN_ROW_HEIGHT;
    const rows = tableRef.current.querySelectorAll('tr');
    // +1 to skip header row
    const row = rows[rowIdx + 1];
    if (!row) return MIN_ROW_HEIGHT;
    let maxContentHeight = MIN_ROW_HEIGHT;
    row.querySelectorAll('td, th').forEach(cell => {
      const el = cell as HTMLElement;
      const contentHeight = el.scrollHeight;
      if (contentHeight > maxContentHeight) maxContentHeight = contentHeight;
    });
    return maxContentHeight;
  }, []);

  const handleColResizeStart = useCallback((e: React.MouseEvent, colIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidths[colIdx] || 100;
    const minW = measureColMinWidth(colIdx);
    resizingCol.current = { colIdx, startX, startW, minW };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingCol.current) return;
      const { startX, startW, minW, colIdx: ci } = resizingCol.current;
      const diff = ev.clientX - startX;
      const newW = Math.max(minW, startW + diff);
      setColWidths(prev => ({ ...prev, [ci]: newW }));
    };
    const onMouseUp = () => {
      resizingCol.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [colWidths, measureColMinWidth]);

  const handleRowResizeStart = useCallback((e: React.MouseEvent, rowIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = rowHeights[rowIdx] || DEFAULT_ROW_HEIGHT;
    const minH = measureRowMinHeight(rowIdx);
    resizingRow.current = { rowIdx, startY, startH, minH };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRow.current) return;
      const diff = ev.clientY - resizingRow.current.startY;
      const newH = Math.max(resizingRow.current.minH, resizingRow.current.startH + diff);
      setRowHeights(prev => ({ ...prev, [resizingRow.current!.rowIdx]: newH }));
    };
    const onMouseUp = () => {
      resizingRow.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [rowHeights, measureRowMinHeight]);

  // Build column definitions for consistent indexing
  const colDefs: { key: string; label: string; align: string; sticky?: boolean; highlight?: boolean }[] = [
    { key: '#', label: '#', align: 'center' },
    { key: 'cod_int', label: 'Código Interno', align: 'center', sticky: true },
    { key: 'desc', label: 'Descrição', align: 'left' },
    { key: 'cod_bar', label: 'Código de Barras', align: 'center' },
    ...empresas.map(emp => ({ key: `emp_${emp}`, label: emp, align: 'center', highlight: editableColumn === emp })),
    ...(editableColumn && !empresas.includes(editableColumn) ? [{ key: `emp_${editableColumn}`, label: editableColumn, align: 'center', highlight: true }] : []),
    ...Array.from({ length: fillerCols }).map((_, i) => ({ key: `filler_${i}`, label: '', align: 'center' })),
  ];

  return (
    <div className="flex-1 overflow-auto border border-border">
      <table ref={tableRef} className="border-collapse font-body text-sm w-full min-w-max" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          {colDefs.map((col, i) => (
            <col key={col.key} style={{ width: colWidths[i] ? `${colWidths[i]}px` : (i === 0 ? '40px' : i === 2 ? '250px' : '120px') }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr className="bg-card">
            {colDefs.map((col, i) => (
              <th
                key={col.key}
                className={`border border-border px-3 py-2 font-display font-bold whitespace-nowrap relative select-none ${
                  col.align === 'left' ? 'text-left' : 'text-center'
                } ${col.sticky ? 'sticky left-0 bg-card z-20' : ''} ${col.highlight ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}
                style={{ height: DEFAULT_ROW_HEIGHT }}
              >
                {col.label}
                {/* Column resize handle */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize hover:bg-primary/30 z-30"
                  onMouseDown={e => handleColResizeStart(e, i)}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {produtos.map((prod, idx) => {
            const lowestEmp = getLowestEmpresa(prod.codigo_interno);
            const h = rowHeights[idx] || DEFAULT_ROW_HEIGHT;
            return (
              <tr key={idx} className="hover:bg-muted/30 relative" style={{ height: `${h}px` }}>
                <td className="border border-border px-3 text-center text-muted-foreground whitespace-nowrap relative">
                  {idx + 1}
                  {/* Row resize handle */}
                  <div
                    className="absolute left-0 right-0 bottom-0 h-[4px] cursor-row-resize hover:bg-primary/30 z-30"
                    onMouseDown={e => handleRowResizeStart(e, idx)}
                  />
                </td>
                <td className="border border-border px-3 text-center sticky left-0 bg-background whitespace-nowrap">{prod.codigo_interno}</td>
                <td className="border border-border px-3 whitespace-nowrap overflow-hidden text-ellipsis">{prod.descricao}</td>
                <td className="border border-border px-3 text-center whitespace-nowrap">{prod.codigo_barras}</td>
                {empresas.map(emp => {
                  const isLowest = lowestEmp === emp;
                  const cellClass = editableColumn === emp
                    ? 'bg-primary/5'
                    : isLowest
                      ? 'bg-green-100 text-green-800 font-bold'
                      : '';
                  return (
                    <td key={emp} className={`border border-border px-3 text-center whitespace-nowrap ${cellClass}`}>
                      {editableColumn === emp && !readOnly ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1 text-center"
                          value={editPrices[idx] ?? ''}
                          onChange={e => onPriceChange?.(idx, e.target.value)}
                          placeholder="0,00"
                        />
                      ) : (() => {
                        const raw = getPreco(emp, prod.codigo_interno);
                        if (raw === '' || raw === undefined || raw === null) return '';
                        const num = parsePrice(raw as string | number);
                        return num === Infinity ? raw : `R$ ${Number(num).toFixed(2).replace('.', ',')}`;
                      })()}
                    </td>
                  );
                })}
                {editableColumn && !empresas.includes(editableColumn) && (
                  <td className="border border-border px-3 text-center bg-primary/5 whitespace-nowrap">
                    {!readOnly ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1 text-center"
                        value={editPrices[idx] ?? ''}
                        onChange={e => onPriceChange?.(idx, e.target.value)}
                        placeholder="0,00"
                      />
                    ) : ''}
                  </td>
                )}
                {Array.from({ length: fillerCols }).map((_, i) => (
                  <td key={`fc-${i}`} className="border border-border px-3">&nbsp;</td>
                ))}
              </tr>
            );
          })}
          {Array.from({ length: produtos.length === 0 ? EMPTY_ROWS : fillerRows }).map((_, rowIdx) => {
            const absIdx = produtos.length + rowIdx;
            const h = rowHeights[absIdx] || DEFAULT_ROW_HEIGHT;
            return (
              <tr key={`empty-${rowIdx}`} style={{ height: `${h}px` }}>
                <td className="border border-border px-3 text-center text-muted-foreground whitespace-nowrap relative">
                  {produtos.length > 0 ? absIdx + 1 : ''}
                  <div
                    className="absolute left-0 right-0 bottom-0 h-[4px] cursor-row-resize hover:bg-primary/30 z-30"
                    onMouseDown={e => handleRowResizeStart(e, absIdx)}
                  />
                </td>
                {Array.from({ length: gridCols - 1 }).map((_, colIdx) => (
                  <td key={`ec-${colIdx}`} className={`border border-border px-3 ${colIdx === 0 ? 'sticky left-0 bg-background' : ''}`}>&nbsp;</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default SpreadsheetTable;
