import { Box, Button, Typography } from '@mui/material';
import Link from 'next/link';

export default function NotFound() {
  return (
    <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center', p: 4, textAlign: 'center' }}>
      <Box>
        <Typography variant="h1" sx={{ mb: 1 }}>Page not found</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          The page you requested does not exist or is no longer available.
        </Typography>
        <Button component={Link} href="/" variant="contained">Go home</Button>
      </Box>
    </Box>
  );
}
