'use client';

import { Box, Button, Typography } from '@mui/material';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center', p: 4, textAlign: 'center' }}>
      <Box>
        <Typography variant="h1" sx={{ mb: 1 }}>Something went wrong</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 420 }}>
          {error.message || 'An unexpected error occurred while rendering this page.'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
          <Button variant="contained" onClick={reset}>Try again</Button>
          <Button component={Link} href="/" variant="outlined">Go home</Button>
        </Box>
      </Box>
    </Box>
  );
}
