'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Alert, Box, Button, CircularProgress, Paper, TextField, Typography } from '@mui/material';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';

interface InvitationDetails {
  email: string;
  role: 'MANAGER' | 'EDITOR';
  organisation: { name: string };
}

export default function AcceptInvitePage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const { login } = useAuth();

  const [invitation, setInvitation] = useState<InvitationDetails | 'invalid' | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get<InvitationDetails>(`/invitations/${token}`)
      .then(setInvitation)
      .catch(() => setInvitation('invalid'));
  }, [token]);

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/invitations/${token}/accept`, { name, password });
      if (invitation && invitation !== 'invalid') {
        await login(invitation.email, password);
      } else {
        router.push('/login');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not accept invitation.');
    } finally {
      setSubmitting(false);
    }
  }

  if (invitation === null) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (invitation === 'invalid') {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 4 }}>
        <Box>
          <Typography variant="h1" sx={{ mb: 1 }}>This invitation is invalid or has expired</Typography>
          <Typography variant="body2" color="text.secondary">Ask an administrator to send a new one.</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Paper sx={{ p: 5, width: 420 }} variant="outlined">
        <Typography variant="h1" sx={{ mb: 1 }}>Join {invitation.organisation.name}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4, textTransform: 'capitalize' }}>
          You&apos;ve been invited as {invitation.role.toLowerCase()} ({invitation.email})
        </Typography>
        <form onSubmit={handleAccept}>
          <TextField label="Your name" fullWidth required sx={{ mb: 2 }} value={name} onChange={(e) => setName(e.target.value)} />
          <TextField
            label="Set a password"
            type="password"
            fullWidth
            required
            sx={{ mb: 2 }}
            helperText="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Button type="submit" variant="contained" fullWidth size="large" disabled={submitting}>
            {submitting ? 'Joining…' : 'Accept invitation'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}
