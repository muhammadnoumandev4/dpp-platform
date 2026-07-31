'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  IconButton,
  ListSubheader,
  MenuItem,
  Paper,
  Table,
  TableContainer,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { api, ApiError } from '@/lib/api/client';
import { toMaterialInput } from '@/lib/types';
import type { CountryResponse, FullProduct, MaterialPresetResponse, MaterialResponse } from '@/lib/types';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

export function MaterialsTab({
  product,
  countries,
  materialPresets,
  onSaved,
}: {
  product: FullProduct;
  countries: CountryResponse[];
  materialPresets: MaterialPresetResponse[];
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<MaterialResponse[]>(product.materials);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const total = rows.reduce((sum, m) => sum + (Number(m.percentage) || 0), 0);
  const materialGroups = useMemo(
    () => materialPresets.reduce<Record<string, MaterialPresetResponse[]>>((groups, preset) => {
      (groups[preset.group] ??= []).push(preset);
      return groups;
    }, {}),
    [materialPresets],
  );
  const presetNames = useMemo(() => new Set(materialPresets.map((preset) => preset.name)), [materialPresets]);
  const isComplete = rows.length > 0
    && rows.every((row) => row.name.trim().length > 0 && Number(row.percentage) > 0)
    && Math.abs(total - 100) < 0.01;

  const isDirty = JSON.stringify(rows.map(toMaterialInput)) !== JSON.stringify(product.materials.map(toMaterialInput));
  useUnsavedChanges(isDirty);

  const confirm = useConfirm();
  const toast = useToast();

  function update(index: number, patch: Partial<MaterialResponse>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { id: `new-${prev.length}`, name: '', percentage: 0, countryOfOriginId: null, recyclable: false, sortOrder: prev.length },
    ]);
  }

  async function removeRow(index: number) {
    const materialName = rows[index].name;
    if (materialName) {
      const confirmed = await confirm({
        title: 'Delete Material?',
        message: 'Are you sure you want to remove this material?',
        severity: 'destructive',
        confirmText: 'Delete'
      });
      if (!confirmed) return;
    }

    if (rows.length === 1) {
      update(index, { name: '', percentage: 0, countryOfOriginId: null, recyclable: false });
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveAll() {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/products/${product.id}`, { materials: rows.map(toMaterialInput) });
      onSaved();
      toast.success('Materials saved successfully.');
    } catch (err) {
      toast.error('Failed to save materials.');
      setError(err instanceof ApiError ? err.message : 'Could not save materials.');
    } finally {
      setSaving(false);
    }
  }

  const muiTheme = useTheme();
  const compactScreen = useMediaQuery(muiTheme.breakpoints.down('md'));

  const materialField = (m: (typeof rows)[number], i: number) => (
    <TextField
      select
      size="small"
      fullWidth
      label="Select material"
      value={m.name}
      onChange={(e) => update(i, { name: e.target.value })}
    >
      <MenuItem value="" disabled>Select material</MenuItem>
      {m.name && !presetNames.has(m.name) && (
        <MenuItem value={m.name}>{m.name} (custom)</MenuItem>
      )}
      {Object.entries(materialGroups).flatMap(([group, presets]) => [
        <ListSubheader key={`group-${group}`}>{group}</ListSubheader>,
        ...presets.map((preset) => (
          <MenuItem key={preset.id} value={preset.name}>{preset.name}</MenuItem>
        )),
      ])}
    </TextField>
  );

  const originField = (m: (typeof rows)[number], i: number) => (
    <TextField
      select
      size="small"
      fullWidth
      label={compactScreen ? 'Country of origin' : undefined}
      value={m.countryOfOriginId ?? ''}
      onChange={(e) => update(i, { countryOfOriginId: e.target.value || null })}
      inputProps={{ 'aria-label': 'Country of origin' }}
    >
      <MenuItem value="">—</MenuItem>
      {countries.map((c) => (
        <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
      ))}
    </TextField>
  );

  const percentageField = (m: (typeof rows)[number], i: number) => (
    <TextField
      size="small"
      fullWidth
      type="number"
      label={compactScreen ? 'Percentage' : undefined}
      inputProps={{ min: 0, max: 100, step: 0.1, 'aria-label': 'Percentage' }}
      value={m.percentage}
      onChange={(e) => update(i, { percentage: Number(e.target.value) })}
    />
  );

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h3">Materials</Typography>
        <Button size="small" onClick={addRow}>+ Add material</Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {compactScreen ? (
        // A five-column editor cannot be filled in on a phone; each material
        // becomes a stacked card instead of a sideways-scrolling row.
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {rows.map((m, i) => (
            <Box
              key={m.id}
              sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>{materialField(m, i)}</Box>
                <IconButton size="small" onClick={() => removeRow(i)} aria-label="Remove material">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
              {originField(m, i)}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ width: 120 }}>{percentageField(m, i)}</Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Checkbox
                    id={`recyclable-${m.id}`}
                    checked={m.recyclable}
                    onChange={(e) => update(i, { recyclable: e.target.checked })}
                  />
                  <Typography component="label" htmlFor={`recyclable-${m.id}`} variant="body2">
                    Recyclable
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      ) : (
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                <TableCell>Material</TableCell>
                <TableCell width={160}>Origin</TableCell>
                <TableCell width={100}>%</TableCell>
                <TableCell width={90}>Recyclable</TableCell>
                <TableCell width={40} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((m, i) => (
                <TableRow key={m.id}>
                  <TableCell>{materialField(m, i)}</TableCell>
                  <TableCell>{originField(m, i)}</TableCell>
                  <TableCell>{percentageField(m, i)}</TableCell>
                  <TableCell>
                    <Checkbox
                      checked={m.recyclable}
                      onChange={(e) => update(i, { recyclable: e.target.checked })}
                      inputProps={{ 'aria-label': 'Recyclable' }}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => removeRow(i)} aria-label="Remove material">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
        <Typography variant="caption" color={Math.abs(total - 100) < 0.01 ? 'success.main' : 'warning.main'}>
          Total {total.toFixed(1)}% / 100%
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {!isComplete && rows.length > 0 && Math.abs(total - 100) >= 0.01 && (
            <Typography variant="caption" color="text.secondary">
              Percentages must total 100%
            </Typography>
          )}
          <Button size="small" variant="contained" disabled={saving || !isComplete || !isDirty} onClick={saveAll}>
            {saving ? 'Saving…' : 'Save materials'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
