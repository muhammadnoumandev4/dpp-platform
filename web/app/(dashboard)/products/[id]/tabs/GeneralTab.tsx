'use client';

import { useState } from 'react';
import { Alert, Box, Button, Grid, MenuItem, Paper, TextField, Typography } from '@mui/material';
import { api, ApiError } from '@/lib/api/client';
import type { CategoryResponse, CountryResponse, FullProduct } from '@/lib/types';
import { useToast } from '@/components/providers/ToastProvider';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

export function GeneralTab({
  product,
  categories,
  countries,
  onSaved,
}: {
  product: FullProduct;
  categories: CategoryResponse[];
  countries: CountryResponse[];
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [fields, setFields] = useState({
    name: product.name,
    sku: product.sku,
    serialNumber: product.serialNumber ?? '',
    categoryId: product.categoryId ?? '',
    productionDate: product.productionDate?.slice(0, 10) ?? '',
    countryOfOriginId: product.countryOfOriginId ?? '',
    description: product.description ?? '',
  });

  const toast = useToast();

  const isDirty = 
    fields.name !== product.name ||
    fields.sku !== product.sku ||
    fields.serialNumber !== (product.serialNumber ?? '') ||
    fields.categoryId !== (product.categoryId ?? '') ||
    fields.productionDate !== (product.productionDate?.slice(0, 10) ?? '') ||
    fields.countryOfOriginId !== (product.countryOfOriginId ?? '') ||
    fields.description !== (product.description ?? '');

  useUnsavedChanges(isDirty);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await api.patch(`/products/${product.id}`, {
        name: fields.name,
        sku: fields.sku,
        serialNumber: fields.serialNumber || null,
        categoryId: fields.categoryId || null,
        productionDate: fields.productionDate || null,
        countryOfOriginId: fields.countryOfOriginId || null,
        description: fields.description || null,
      });
      onSaved();
      toast.success('Product general information saved successfully.');
    } catch (err) {
      toast.error('Failed to save product information.');
      setError(err instanceof ApiError ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h3" sx={{ mb: 2 }}>General</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField label="Product name" required fullWidth value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField label="SKU" required fullWidth value={fields.sku} helperText="Unique within your organisation" onChange={(e) => setFields({ ...fields, sku: e.target.value })} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Serial number"
            fullWidth
            value={fields.serialNumber}
            helperText={fields.sku ? `Manual input or Auto-generate (e.g. ${fields.sku}-000001)` : "Manual input or click Auto-generate"}
            onChange={(e) => setFields({ ...fields, serialNumber: e.target.value })}
            InputProps={{
              endAdornment: (
                <Button
                  size="small"
                  variant="text"
                  onClick={() => {
                    const prefix = fields.sku ? fields.sku : 'SN';
                    setFields({ ...fields, serialNumber: `${prefix}-000001` });
                  }}
                  sx={{ fontSize: 11, textTransform: 'none', whiteSpace: 'nowrap', fontWeight: 600 }}
                >
                  Auto-generate
                </Button>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField select label="Category" required fullWidth value={fields.categoryId} onChange={(e) => setFields({ ...fields, categoryId: e.target.value })}>
            {categories.length === 0 && <MenuItem value="" disabled>Category catalog unavailable</MenuItem>}
            {categories.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Production date"
            type="date"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={fields.productionDate}
            onChange={(e) => setFields({ ...fields, productionDate: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField select label="Country of origin" fullWidth value={fields.countryOfOriginId} onChange={(e) => setFields({ ...fields, countryOfOriginId: e.target.value })}>
            {countries.length === 0 && <MenuItem value="" disabled>Country catalog unavailable</MenuItem>}
            {countries.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Description"
            fullWidth
            multiline
            minRows={3}
            value={fields.description}
            helperText="Appears in the Product information section of the public passport"
            onChange={(e) => setFields({ ...fields, description: e.target.value })}
          />
        </Grid>
      </Grid>
      
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button 
          variant="contained" 
          disabled={!isDirty || saving || !fields.name || !fields.sku} 
          onClick={save}
        >
          {saving ? 'Saving...' : 'Save General Info'}
        </Button>
      </Box>
    </Paper>
  );
}
