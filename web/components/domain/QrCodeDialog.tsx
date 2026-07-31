'use client';

import { MouseEvent, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useToast } from '@/components/providers/ToastProvider';
import { downloadQrCode } from '@/lib/download-qr';

interface QrCodeDialogProps {
  qrUrl: string;
  passportUuid: string;
  productName: string;
  size?: number;
}

export function QrCodeDialog({
  qrUrl,
  passportUuid,
  productName,
  size = 40,
}: QrCodeDialogProps) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const toast = useToast();

  function openDialog(event: MouseEvent) {
    event.stopPropagation();
    setDownloadError(false);
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setDownloadError(false);
  }

  async function downloadQr() {
    setDownloading(true);
    setDownloadError(false);
    try {
      await downloadQrCode(qrUrl, productName);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/passport/${passportUuid}`;
    await navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  }

  return (
    <>
      <Tooltip title="Enlarge QR code">
        <ButtonBase
          onClick={openDialog}
          aria-label={`Enlarge QR code for ${productName}`}
          sx={{
            borderRadius: 1,
            p: 0.5,
            border: '1px solid transparent',
            '&:hover, &:focus-visible': {
              borderColor: 'primary.main',
              bgcolor: 'primary.50',
            },
          }}
        >
          <Box
            component="img"
            src={qrUrl}
            alt={`QR code for ${productName}`}
            sx={{ display: 'block', width: size, height: size }}
          />
        </ButtonBase>
      </Tooltip>

      <Dialog open={open} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          Product passport QR
          <IconButton
            onClick={closeDialog}
            aria-label="Close QR code"
            sx={{ position: 'absolute', right: 12, top: 12 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          <Box
            component="img"
            src={qrUrl}
            alt={`QR code for ${productName}`}
            sx={{ width: '100%', maxWidth: 320, aspectRatio: '1', objectFit: 'contain' }}
          />
          <Typography variant="h3" sx={{ mt: 1 }}>{productName}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
            Passport ID: {passportUuid}
          </Typography>
          {downloadError && (
            <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
              We couldn&apos;t download the QR code. Please try again.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button variant="outlined" onClick={copyLink} startIcon={<ContentCopyIcon />}>
            Copy link
          </Button>
          <Button href={`/passport/${passportUuid}`} target="_blank" variant="outlined" endIcon={<OpenInNewIcon />}>
            Open passport
          </Button>
          <Button
            variant="contained"
            onClick={downloadQr}
            disabled={downloading}
            startIcon={downloading ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
          >
            {downloading ? 'Downloading…' : 'Download QR'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
