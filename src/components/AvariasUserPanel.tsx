import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import AvariasDashboard from './AvariasDashboard';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AvariasUserPanel: React.FC<Props> = ({ open, onOpenChange }) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-full sm:max-w-4xl p-0 flex flex-col">
      <SheetHeader className="px-4 sm:px-6 py-4 border-b border-border shrink-0">
        <SheetTitle className="flex items-center gap-2 font-display">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          Avarias & Trocas
        </SheetTitle>
      </SheetHeader>
      <div className="flex-1 min-h-0 overflow-auto">
        {open && <AvariasDashboard />}
      </div>
    </SheetContent>
  </Sheet>
);

export default AvariasUserPanel;
