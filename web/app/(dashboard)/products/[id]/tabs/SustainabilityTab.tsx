'use client';

import { useState } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, Grid, InputAdornment, Paper, TextField, Typography } from '@mui/material';
import { api, ApiError } from '@/lib/api/client';
import { toSustainabilityInput } from '@/lib/types';
import type { FullProduct } from '@/lib/types';
import { useToast } from '@/components/providers/ToastProvider';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

export function SustainabilityTab({ product, onSaved }: { product: FullProduct; onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  const s = product.sustainability;

  const [fields, setFields] = useState({
    carbonFootprintKg: s?.carbonFootprintKg ?? '',
    waterConsumptionL: s?.waterConsumptionL ?? '',
    recycledPercent: s?.recycledPercent ?? '',
    repairabilityScore: s?.repairabilityScore ?? '',
    recyclable: s?.recyclable ?? false,
  });

  const toast = useToast();

  const isDirty = 
    fields.carbonFootprintKg !== (s?.carbonFootprintKg ?? '') ||
    fields.waterConsumptionL !== (s?.waterConsumptionL ?? '') ||
    fields.recycledPercent !== (s?.recycledPercent ?? '') ||
    fields.repairabilityScore !== (s?.repairabilityScore ?? '') ||
    fields.recyclable !== (s?.recyclable ?? false);

  useUnsavedChanges(isDirty);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const patch = {
        carbonFootprintKg: fields.carbonFootprintKg === '' ? undefined : Number(fields.carbonFootprintKg),
        waterConsumptionL: fields.waterConsumptionL === '' ? undefined : Number(fields.waterConsumptionL),
        recycledPercent: fields.recycledPercent === '' ? undefined : Number(fields.recycledPercent),
        repairabilityScore: fields.repairabilityScore === '' ? undefined : Number(fields.repairabilityScore),
        recyclable: fields.recyclable,
      };
      await api.patch(`/products/${product.id}`, { sustainability: toSustainabilityInput(s, patch) });
      onSaved();
      toast.success('Sustainability information saved successfully.');
    } catch (err) {
      toast.error('Failed to save sustainability information.');
      setError(err instanceof ApiError ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  const sustainabilityComplete =
    fields.carbonFootprintKg !== '' &&
    fields.waterConsumptionL !== '' &&
    fields.recycledPercent !== '' &&
    fields.repairabilityScore !== '';

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h3" sx={{ mb: 2 }}>Sustainability</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        All fields are required before a product can be published.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Carbon footprint"
            required
            type="number"
            fullWidth
            InputProps={{ endAdornment: <InputAdornment position="end">kg CO₂e</InputAdornment> }}
            value={fields.carbonFootprintKg}
            onChange={(e) => setFields({ ...fields, carbonFootprintKg: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Water consumption"
            required
            type="number"
            fullWidth
            InputProps={{ endAdornment: <InputAdornment position="end">L</InputAdornment> }}
            value={fields.waterConsumptionL}
            onChange={(e) => setFields({ ...fields, waterConsumptionL: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Recycled material"
            required
            type="number"
            fullWidth
            inputProps={{ min: 0, max: 100 }}
            InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
            value={fields.recycledPercent}
            onChange={(e) => setFields({ ...fields, recycledPercent: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Repairability score"
            required
            type="number"
            fullWidth
            inputProps={{ min: 1, max: 10 }}
            InputProps={{ endAdornment: <InputAdornment position="end">/10</InputAdornment> }}
            value={fields.repairabilityScore}
            onChange={(e) => setFields({ ...fields, repairabilityScore: e.target.value })}
          />
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            control={<Checkbox checked={fields.recyclable} onChange={(e) => setFields({ ...fields, recyclable: e.target.checked })} />}
            label="Recyclable through a take-back scheme"
          />
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button 
          variant="contained" 
          disabled={!isDirty || saving || !sustainabilityComplete} 
          onClick={save}
        >
          {saving ? 'Saving...' : 'Save Sustainability Info'}
        </Button>
      </Box>
    </Paper>
  );
}
