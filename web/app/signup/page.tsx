'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';

export default function SignupPage() {
  const { registerBrand } = useAuth();
  const [brandName, setBrandName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await registerBrand({ brandName, name, email, password });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the brand account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', py: 4 }}>
      <Paper sx={{ p: { xs: 3, sm: 5 }, width: '100%', maxWidth: 460 }} variant="outlined">
        <Typography variant="h1" sx={{ mb: 1 }}>Create your brand account</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Your products, users, analytics and passports stay isolated from every other brand.
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Brand name"
            fullWidth
            required
            autoFocus
            value={brandName}
            onChange={(event) => setBrandName(event.target.value)}
            inputProps={{ minLength: 2, maxLength: 120 }}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Your full name"
            fullWidth
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            inputProps={{ minLength: 2, maxLength: 120 }}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Work email"
            type="email"
            fullWidth
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            required
            helperText="Use at least 8 characters."
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            inputProps={{ minLength: 8, maxLength: 128 }}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Confirm password"
            type="password"
            fullWidth
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            inputProps={{ minLength: 8, maxLength: 128 }}
            sx={{ mb: 2 }}
          />
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Button type="submit" variant="contained" fullWidth size="large" disabled={loading}>
            {loading ? 'Creating account…' : 'Create brand account'}
          </Button>
          <Button component={Link} href="/login" fullWidth size="large" sx={{ mt: 1.5 }}>
            Back to sign in
          </Button>
        </form>
      </Paper>
    </Box>
  );
}
