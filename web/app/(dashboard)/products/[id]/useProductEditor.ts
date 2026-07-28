'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import type { CategoryResponse, CountryResponse, FullProduct, MaterialPresetResponse, PublishStatus } from '@/lib/types';

export function useProductEditor(id: string) {
  const [product, setProduct] = useState<FullProduct | null>(null);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [countries, setCountries] = useState<CountryResponse[]>([]);
  const [materialPresets, setMaterialPresets] = useState<MaterialPresetResponse[]>([]);
  const [publishStatus, setPublishStatus] = useState<PublishStatus | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(() => {
    setLoadError(false);
    Promise.all([
      api.get<FullProduct>(`/products/${id}`),
      api.get<PublishStatus>(`/products/${id}/publish-status`),
    ])
      .then(([p, status]) => {
        setProduct(p);
        setPublishStatus(status);
      })
      .catch(() => setLoadError(true));
  }, [id]);

  useEffect(() => {
    load();
    api.get<CategoryResponse[]>('/taxonomy/categories').then(setCategories);
    api.get<CountryResponse[]>('/taxonomy/countries').then(setCountries);
    api.get<MaterialPresetResponse[]>('/taxonomy/material-presets').then(setMaterialPresets);
  }, [load]);

  return { product, categories, countries, materialPresets, publishStatus, loadError, reload: load };
}
