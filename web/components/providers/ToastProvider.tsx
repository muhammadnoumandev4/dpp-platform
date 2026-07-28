'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';

interface ToastOptions {
  message: string;
  severity?: AlertColor;
  duration?: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions | string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ToastOptions>({ message: '', severity: 'info' });

  const showToast = useCallback((opts: ToastOptions | string) => {
    if (typeof opts === 'string') {
      setOptions({ message: opts, severity: 'info' });
    } else {
      setOptions({ severity: 'info', ...opts });
    }
    setOpen(true);
  }, []);

  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  const value: ToastContextValue = {
    showToast,
    success: (msg) => showToast({ message: msg, severity: 'success' }),
    error: (msg) => showToast({ message: msg, severity: 'error', duration: 10000 }),
    info: (msg) => showToast({ message: msg, severity: 'info' }),
    warning: (msg) => showToast({ message: msg, severity: 'warning' }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={options.duration || 6000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleClose} severity={options.severity} variant="filled" sx={{ width: '100%', boxShadow: 3 }}>
          {options.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
