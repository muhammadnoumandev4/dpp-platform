'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogContentText, 
  DialogActions, 
  Button, 
  TextField, 
  Box,
  Typography
} from '@mui/material';

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  severity?: 'info' | 'warning' | 'destructive' | 'publish' | 'save';
  confirmText?: string;
  cancelText?: string;
  requireConfirmationText?: string;
}

type PromiseResolve = (value: boolean) => void;

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolve, setResolve] = useState<PromiseResolve | null>(null);
  const [typedText, setTypedText] = useState('');

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((res) => {
      setOptions(opts);
      setResolve(() => res);
      setTypedText('');
      setOpen(true);
    });
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    if (resolve) {
      resolve(false);
    }
  }, [resolve]);

  const handleConfirm = useCallback(() => {
    setOpen(false);
    if (resolve) {
      resolve(true);
    }
  }, [resolve]);

  if (!options) return <ConfirmContext.Provider value={{ confirm }}>{children}</ConfirmContext.Provider>;

  const isDestructive = options.severity === 'destructive';
  const isPublish = options.severity === 'publish';
  
  const requiresTyping = !!options.requireConfirmationText;
  const isTypingValid = !requiresTyping || typedText === options.requireConfirmationText;

  let confirmColor: 'primary' | 'error' | 'warning' | 'info' | 'success' = 'primary';
  if (isDestructive) confirmColor = 'error';
  else if (isPublish) confirmColor = 'success';
  else if (options.severity === 'warning') confirmColor = 'warning';

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Dialog 
        open={open} 
        onClose={handleClose} 
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        maxWidth="sm"
        fullWidth
        disableRestoreFocus
      >
        <DialogTitle id="confirm-dialog-title">{options.title}</DialogTitle>
        <DialogContent>
          <DialogContentText id="confirm-dialog-description" sx={{ mb: requiresTyping ? 3 : 0, color: 'text.primary' }}>
            {options.message}
          </DialogContentText>

          {requiresTyping && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Please type <strong>{options.requireConfirmationText}</strong> to confirm.
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                autoFocus
                autoComplete="off"
                placeholder={options.requireConfirmationText}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleClose} color="inherit" variant="text">
            {options.cancelText || 'Cancel'}
          </Button>
          <Button 
            onClick={handleConfirm} 
            color={confirmColor} 
            variant="contained"
            disabled={!isTypingValid}
            disableElevation
          >
            {options.confirmText || 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context.confirm;
}
