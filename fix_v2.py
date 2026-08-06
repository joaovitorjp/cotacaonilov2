import sys
path = 'src/components/SpreadsheetTable.tsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Look for the broken section precisely
# It seems there's a mix of line numbers inside the content
start_idx = -1
for i, line in enumerate(lines):
    if '802: 802:     else if (type === "row" && rowIdx !== undefined)' in line:
        start_idx = i
        break

if start_idx != -1:
    # Find handleCopyFromMenu
    end_idx = -1
    for i in range(start_idx, len(lines)):
        if 'const handleCopyFromMenu' in lines[i]:
            end_idx = i
            break
    
    if end_idx != -1:
        # Replace from line 801 (one before start_idx) up to end_idx
        # Line 801 (1-indexed) is index 800 in the list
        # start_idx corresponds to line 802
        new_block = [
            '    else if (type === \'column\' && colIdx !== undefined) setColBgColor(prev => ({ ...prev, [colIdx]: color }));\n',
            '    else if (type === \'row\' && rowIdx !== undefined) setRowBgColor(prev => ({ ...prev, [rowIdx]: color }));\n',
            '    setContextMenu(null);\n',
            '  };\n',
            '\n',
            '  const deleteRow = (rowIdx: number) => {\n',
            '    if (readOnly || rowIdx >= produtos.length) return;\n',
            '    const updated = produtos.filter((_, i) => i !== rowIdx);\n',
            '    if (onSave) onSave(updated);\n',
            '    setContextMenu(null);\n',
            '  };\n',
            '\n',
            '  const addRow = () => {\n',
            '    if (readOnly) return;\n',
            '    const newProd: Produto = {\n',
            '      codigo_interno: `NOVO-${Date.now().toString().slice(-4)}`,\n',
            '      descricao: \'Novo Produto\',\n',
            '      codigo_barras: \'\',\n',
            '    };\n',
            '    const updated = [...produtos, newProd];\n',
            '    if (onSave) onSave(updated);\n',
            '  };\n',
            '\n'
        ]
        # index mapping: line 801 (1-indexed) is lines[800]
        # start_idx is 801 (0-indexed)
        lines[start_idx-1 : end_idx] = new_block
        with open(path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print("Success")
else:
    print("Not found")
