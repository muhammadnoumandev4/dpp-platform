'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import type { Role } from '@/lib/auth-context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import { useToast } from '@/components/providers/ToastProvider';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  lastLoginAt: string | null;
  createdAt: string;
}
interface InvitationRow {
  id: string;
  email: string;
  role: 'MANAGER' | 'EDITOR';
  expiresAt: string;
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [error, setError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'MANAGER' | 'EDITOR'>('EDITOR');
  const [formError, setFormError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(false);
    Promise.all([api.get<UserRow[]>('/users'), api.get<InvitationRow[]>('/invitations')])
      .then(([u, i]) => {
        setUsers(u);
        setInvitations(i);
      })
      .catch(() => setError(true));
  }, []);

  const { hasPermission } = usePermissions();
  const canManage = hasPermission('users.manage');

  useEffect(() => {
    if (canManage) {
      load();
    }
  }, [canManage, load]);

  const confirm = useConfirm();
  const toast = useToast();

  async function handleInvite() {
    setFormError(null);
    try {
      const invitation = await api.post<{ token: string }>('/invitations', { email, role });
      setInviteLink(`${window.location.origin}/invite/${invitation.token}`);
      setEmail('');
      load();
      toast.success('Invitation generated successfully.');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not send invitation.');
    }
  }

  async function handleRemove(id: string) {
    const user = users?.find(u => u.id === id);
    const confirmed = await confirm({
      title: 'Remove User?',
      message: `You are about to remove "${user?.name}" from your organisation. They will lose access immediately.`,
      severity: 'destructive',
      confirmText: 'Remove User'
    });

    if (!confirmed) return;

    try {
      await api.delete(`/users/${id}`);
      load();
      toast.success('User removed successfully.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove user.');
    }
  }

  if (currentUser && !hasPermission('users.manage')) {
    return <Alert severity="error">You do not have permission to manage users and invitations.</Alert>;
  }

  if (error) {
    return (
      <Alert severity="error">
        We couldn&apos;t load users. <Button size="small" onClick={load}>Retry</Button>
      </Alert>
    );
  }

  if (!users) return <CircularProgress size={24} />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h1">Users</Typography>
        <Button variant="contained" onClick={() => { setDialogOpen(true); setInviteLink(null); setRole('EDITOR'); }}>+ Invite user</Button>
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ mb: invitations.length ? 3 : 0 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Last active</TableCell>
              <TableCell width={48} />
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>{u.name[0]}</Avatar>
                    <Box>
                      <Typography variant="subtitle2">{u.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell sx={{ textTransform: 'capitalize' }}>{u.role.toLowerCase()}</TableCell>
                <TableCell>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}</TableCell>
                <TableCell>
                  {currentUser?.id !== u.id && u.role !== 'OWNER' && (
                    <IconButton size="small" onClick={() => handleRemove(u.id)} aria-label="Remove user">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {invitations.length > 0 && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h3" sx={{ mb: 2 }}>Pending invitations</Typography>
          {invitations.map((inv) => (
            <Box key={inv.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="body2">{inv.email}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                {inv.role.toLowerCase()} · expires {new Date(inv.expiresAt).toLocaleDateString()}
              </Typography>
            </Box>
          ))}
        </Paper>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Invite user</DialogTitle>
        <DialogContent>
          {inviteLink ? (
            <>
              <Alert severity="success" sx={{ mb: 2 }}>Invitation created. Share this link with them:</Alert>
              <TextField fullWidth value={inviteLink} InputProps={{ readOnly: true }} onFocus={(e) => e.target.select()} />
            </>
          ) : (
            <>
              <TextField label="Email" type="email" fullWidth required sx={{ mt: 1, mb: 2 }} value={email} onChange={(e) => setEmail(e.target.value)} />
              <TextField
                select
                label="Role"
                fullWidth
                value={role}
                onChange={(event) => setRole(event.target.value as 'MANAGER' | 'EDITOR')}
                helperText={role === 'MANAGER'
                  ? 'Can manage products and publish passports, but cannot manage users or brand settings.'
                  : 'Can edit product and passport content, but cannot publish, archive, or manage the team.'}
              >
                <MenuItem value="MANAGER">Manager</MenuItem>
                <MenuItem value="EDITOR">Editor</MenuItem>
              </TextField>
              {formError && <Alert severity="error" sx={{ mt: 2 }}>{formError}</Alert>}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{inviteLink ? 'Done' : 'Cancel'}</Button>
          {!inviteLink && <Button variant="contained" disabled={!email} onClick={handleInvite}>Send invitation</Button>}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
