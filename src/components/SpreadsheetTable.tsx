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
const MIN_ROW_HEIGHT = 21;
const DEFAULT_ROW_HEIGHT = 25;
const HEADER_HEIGHT = 28;

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

  const tableRef = useRef<HTMLTableElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-fit column widths on data change
  useEffect(() => {
    if (!tableRef.current) return;
    const timer = setTimeout(() => {
      const newWidths: Record<number, number> = {};
      const colCount = gridCols;
      for (let i = 0; i < colCount; i++) {
        if (colWidths[i]) continue; // don't override user-resized
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

  // Column resize — Excel-style: thin line appears on hover, blue indicator while dragging
  const handleColResizeStart = useCallback((e: React.MouseEvent, colIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = getColWidth(colIdx);
    setActiveColResize(colIdx);

    const onMouseMove = (ev: MouseEvent) => {
      const diff = ev.clientX - startX;
      const newW = Math.max(MIN_COL_WIDTH, startW + diff);
      setColWidths(prev => ({ ...prev, [colIdx]: newW }));
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
      const newH = Math.max(MIN_ROW_HEIGHT, startH + diff);
      setRowHeights(prev => ({ ...prev, [rowIdx]: newH }));
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

  // Double-click to auto-fit row
  const handleRowAutoFit = useCallback((rowIdx: number) => {
    setRowHeights(prev => {
      const copy = { ...prev };
      delete copy[rowIdx];
      return copy;
    });
  }, []);

  const colDefs: { key: string; label: string; align: string; sticky?: boolean; highlight?: boolean }[] = [
    { key: '#', label: '', align: 'center' },
    { key: 'cod_int', label: 'Código Interno', align: 'center', sticky: true },
    { key: 'desc', label: 'Descrição', align: 'left' },
    { key: 'cod_bar', label: 'Código de Barras', align: 'center' },
    ...empresas.map(emp => ({ key: `emp_${emp}`, label: emp, align: 'center', highlight: editableColumn === emp })),
    ...(editableColumn && !empresas.includes(editableColumn) ? [{ key: `emp_${editableColumn}`, label: editableColumn, align: 'center', highlight: true }] : []),
    ...Array.from({ length: fillerCols }).map((_, i) => ({ key: `filler_${i}`, label: '', align: 'center' })),
  ];

  const renderRow = (prod: Produto | null, idx: number, isEmpty: boolean) => {
    const lowestEmp = prod ? getLowestEmpresa(prod.codigo_interno) : null;
    const h = rowHeights[idx] || DEFAULT_ROW_HEIGHT;
    return (
      <tr
        key={isEmpty ? `empty-${idx}` : idx}
        className="group/row"
        style={{ height: `${h}px` }}
      >
        {/* Row number cell — Excel gray background */}
        <td
          className="border-r border-b px-0 text-center text-[11px] text-muted-foreground select-none relative"
          style={{
            borderColor: 'hsl(var(--border))',
            backgroundColor: 'hsl(var(--muted))',
            minWidth: getColWidth(0),
            width: getColWidth(0),
          }}
        >
          {prod ? idx + 1 : (produtos.length > 0 ? idx + 1 : '')}
          {/* Row resize handle */}
          <div
            className={`absolute left-0 right-0 bottom-[-2px] h-[5px] cursor-row-resize z-30 ${
              activeRowResize === idx ? 'bg-primary' : 'hover:bg-primary/40'
            }`}
            style={{ opacity: activeRowResize === idx ? 1 : undefined }}
            onMouseDown={e => handleRowResizeStart(e, idx)}
            onDoubleClick={() => handleRowAutoFit(idx)}
          />
        </td>

        {isEmpty ? (
          Array.from({ length: gridCols - 1 }).map((_, colIdx) => (
            <td
              key={`ec-${colIdx}`}
              className={`border-r border-b px-2 ${colIdx === 0 ? 'sticky left-[36px] bg-background z-[5]' : ''}`}
              style={{
                borderColor: 'hsl(var(--border))',
                minWidth: getColWidth(colIdx + 1),
                width: getColWidth(colIdx + 1),
              }}
            >
              &nbsp;
            </td>
          ))
        ) : (
          <>
            <td
              className="border-r border-b px-2 text-center sticky left-[36px] bg-background z-[5] whitespace-nowrap text-xs"
              style={{ borderColor: 'hsl(var(--border))', minWidth: getColWidth(1), width: getColWidth(1) }}
            >
              {prod!.codigo_interno}
            </td>
            <td
              className="border-r border-b px-2 whitespace-nowrap overflow-hidden text-ellipsis text-xs"
              style={{ borderColor: 'hsl(var(--border))', minWidth: getColWidth(2), width: getColWidth(2) }}
            >
              {prod!.descricao}
            </td>
            <td
              className="border-r border-b px-2 text-center whitespace-nowrap text-xs"
              style={{ borderColor: 'hsl(var(--border))', minWidth: getColWidth(3), width: getColWidth(3) }}
            >
              {prod!.codigo_barras}
            </td>
            {empresas.map((emp, empIdx) => {
              const isLowest = lowestEmp === emp;
              const isEditable = editableColumn === emp;
              return (
                <td
                  key={emp}
                  className={`border-r border-b px-1 text-center whitespace-nowrap text-xs ${
                    isEditable ? 'bg-primary/5' : isLowest ? 'bg-success/10 text-success font-bold' : ''
                  }`}
                  style={{ borderColor: 'hsl(var(--border))', minWidth: getColWidth(4 + empIdx), width: getColWidth(4 + empIdx) }}
                >
                  {isEditable && !readOnly ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1 text-center text-xs h-full"
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
            })}
            {editableColumn && !empresas.includes(editableColumn) && (
              <td
                className="border-r border-b px-1 text-center bg-primary/5 whitespace-nowrap text-xs"
                style={{ borderColor: 'hsl(var(--border))' }}
              >
                {!readOnly ? (
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1 text-center text-xs"
                    value={editPrices[idx] ?? ''}
                    onChange={e => onPriceChange?.(idx, e.target.value)}
                    placeholder="0,00"
                  />
                ) : ''}
              </td>
            )}
            {Array.from({ length: fillerCols }).map((_, i) => (
              <td
                key={`fc-${i}`}
                className="border-r border-b px-2"
                style={{ borderColor: 'hsl(var(--border))' }}
              >
                &nbsp;
              </td>
            ))}
          </>
        )}
      </tr>
    );
  };

  return (
    <div ref={containerRef} className="flex-1 overflow-auto" style={{ border: '1px solid hsl(var(--border))' }}>
      <table
        ref={tableRef}
        className="border-collapse text-sm min-w-max"
        style={{ tableLayout: 'fixed', fontFamily: 'var(--font-body)', fontSize: '12px' }}
      >
        <colgroup>
          {colDefs.map((col, i) => (
            <col key={col.key} style={{ width: `${getColWidth(i)}px` }} />
          ))}
        </colgroup>

        {/* Header — Excel-style gray */}
        <thead className="sticky top-0 z-10">
          <tr style={{ height: `${HEADER_HEIGHT}px` }}>
            {colDefs.map((col, i) => (
              <th
                key={col.key}
                className={`border-r border-b px-2 font-semibold whitespace-nowrap relative select-none text-[11px] ${
                  col.align === 'left' ? 'text-left' : 'text-center'
                } ${col.sticky ? 'sticky left-[36px] z-20' : ''} ${
                  col.highlight
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground'
                }`}
                style={{
                  borderColor: 'hsl(var(--border))',
                  backgroundColor: col.highlight ? undefined : 'hsl(var(--muted))',
                  height: HEADER_HEIGHT,
                }}
              >
                {col.label}
                {/* Column resize handle — thin line, blue on hover/active */}
                <div
                  className={`absolute top-0 bottom-0 w-[4px] cursor-col-resize z-30 ${
                    activeColResize === i ? 'bg-primary' : 'hover:bg-primary/50'
                  }`}
                  style={{ right: '-2px' }}
                  onMouseDown={e => handleColResizeStart(e, i)}
                  onDoubleClick={() => handleColAutoFit(i)}
                />
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {produtos.map((prod, idx) => renderRow(prod, idx, false))}
          {Array.from({ length: fillerRows }).map((_, rowIdx) => {
            const absIdx = produtos.length + rowIdx;
            return renderRow(null, absIdx, true);
          })}
        </tbody>
      </table>
    </div>
  );
};

export default SpreadsheetTable;
