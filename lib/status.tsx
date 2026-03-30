
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type StatusType = 'success' | 'error' | 'warning' | 'info';

interface StatusContextType {
  showStatus: (message: string, type?: StatusType) => void;
  confirm: (title: string, message: string) => Promise<boolean>;
}

const StatusContext = createContext<StatusContextType | undefined>(undefined);

export const StatusProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<{ message: string; type: StatusType } | null>(null);
  const [confirmation, setConfirmation] = useState<{ title: string; message: string; resolve: (value: boolean) => void } | null>(null);

  const showStatus = useCallback((message: string, type: StatusType = 'success') => {
    setStatus({ message, type });
    setTimeout(() => setStatus(null), 4000);
  }, []);

  const confirm = useCallback((title: string, message: string) => {
    return new Promise<boolean>((resolve) => {
      setConfirmation({ title, message, resolve });
    });
  }, []);

  const handleConfirm = () => {
    if (confirmation) {
      confirmation.resolve(true);
      setConfirmation(null);
    }
  };

  const handleCancel = () => {
    if (confirmation) {
      confirmation.resolve(false);
      setConfirmation(null);
    }
  };

  return (
    <StatusContext.Provider value={{ showStatus, confirm }}>
      {children}
      
      {/* Toast Notification */}
      {status && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] animate-vix-in">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl ${
            status.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
            status.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
            status.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' :
            'bg-blue-500/10 border-blue-500/20 text-blue-500'
          }`}>
            {status.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
            {status.type === 'error' && <XCircle className="w-5 h-5" />}
            {status.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
            {status.type === 'info' && <Info className="w-5 h-5" />}
            <span className="text-sm font-bold tracking-tight">{status.message}</span>
            <button onClick={() => setStatus(null)} className="ml-2 p-1 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmation && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-vix-in">
          <div className="w-full max-w-sm bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-[2.5rem] p-8 shadow-2xl ring-1 ring-white/10">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 border border-yellow-500/20">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black uppercase tracking-widest text-[var(--vix-text)]">{confirmation.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{confirmation.message}</p>
              </div>
              <div className="flex flex-col w-full gap-3">
                <button 
                  onClick={handleConfirm}
                  className="w-full py-4 bg-gradient-to-r from-pink-500 to-blue-500 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Confirm Action
                </button>
                <button 
                  onClick={handleCancel}
                  className="w-full py-4 bg-[var(--vix-secondary)] rounded-2xl text-zinc-500 font-black text-xs uppercase tracking-widest hover:text-[var(--vix-text)] transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </StatusContext.Provider>
  );
};

export const useStatus = () => {
  const context = useContext(StatusContext);
  if (context === undefined) {
    throw new Error('useStatus must be used within a StatusProvider');
  }
  return context;
};
