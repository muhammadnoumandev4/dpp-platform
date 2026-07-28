'use client';

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import { API_URL, api, ApiError } from '@/lib/api/client';
import { DropZone } from '@/components/domain/DropZone';
import type { FullProduct } from '@/lib/types';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import { useToast } from '@/components/providers/ToastProvider';

export function ImagesTab({ product, onSaved }: { product: FullProduct; onSaved: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const confirm = useConfirm();
  const toast = useToast();

  const allImages = product.images ?? [];
  // Ensure activeIndex stays within bounds when images are deleted
  const currentImage = allImages[activeIndex] || allImages[0];

  async function handleUploadMultiple(files: File[], isCover: boolean) {
    setUploading(true);
    setError(null);
    let successCount = 0;
    let failCount = 0;

    for (const file of files) {
      let uploadedKey: string | undefined;
      try {
        const uploaded = await api.upload<{ key: string }>('/uploads', file, 'image');
        uploadedKey = uploaded.key;
        await api.post(`/products/${product.id}/images`, {
          key: uploaded.key,
          isCover: isCover && successCount === 0 && allImages.length === 0,
        });
        successCount++;
      } catch (err) {
        if (uploadedKey) {
          await api.post('/uploads/cleanup', { key: uploadedKey }).catch(() => undefined);
        }
        failCount++;
      }
    }

    onSaved();
    if (successCount > 0) {
      toast.success(`${successCount} image(s) uploaded successfully.`);
      // Focus on the newly uploaded image
      setActiveIndex(allImages.length);
    }
    if (failCount > 0) {
      toast.error(`Failed to upload ${failCount} image(s).`);
    }
    setUploading(false);
  }

  async function handleSetCover(imageId: string) {
    try {
      await api.patch(`/products/${product.id}/images/${imageId}/cover`);
      onSaved();
      toast.success('Cover image updated.');
    } catch (err) {
      toast.error('Failed to set cover image.');
    }
  }

  async function handleRemove(imageId: string) {
    const confirmed = await confirm({
      title: 'Delete Image?',
      message: 'Are you sure you want to remove this image? This action cannot be undone.',
      severity: 'destructive',
      confirmText: 'Delete',
    });

    if (!confirmed) return;

    try {
      await api.delete(`/products/${product.id}/images/${imageId}`);
      if (activeIndex > 0 && activeIndex >= allImages.length - 1) {
        setActiveIndex(activeIndex - 1);
      }
      onSaved();
      toast.success('Image removed successfully.');
    } catch (err) {
      toast.error('Failed to remove image.');
    }
  }

  const handlePrev = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 4 } }}>
      <Typography variant="h3" sx={{ mb: 1 }}>Product Images Gallery</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Upload high-resolution product photos. The designated Cover Image will be displayed first to consumers scanning the QR passport.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {allImages.length > 0 ? (
        <Box sx={{ mb: 4 }}>
          {/* Main Slider Display (Centered, Full Aspect Ratio) */}
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              maxWidth: 680,
              height: { xs: 320, sm: 400, md: 440 },
              mx: 'auto',
              bgcolor: '#ffffff',
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              p: 3,
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            }}
          >
            {/* Centered Full Image */}
            <Box
              component="img"
              src={`${API_URL}/uploads/${currentImage.fileKey}`}
              alt="Product preview"
              sx={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                display: 'block',
                mx: 'auto',
                my: 'auto',
                transition: 'opacity 200ms ease-in-out',
              }}
            />

            {/* Top Left Badge: Cover status or Set as Cover */}
            <Box
              sx={{
                position: 'absolute',
                top: 16,
                left: 16,
                zIndex: 3,
              }}
            >
              {currentImage.isCover ? (
                <Chip
                  icon={<StarIcon fontSize="small" style={{ color: '#fff' }} />}
                  label="Cover Image"
                  color="primary"
                  size="small"
                  sx={{ fontWeight: 600, boxShadow: 1 }}
                />
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  startIcon={<StarBorderIcon fontSize="small" />}
                  onClick={() => handleSetCover(currentImage.id)}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.95)',
                    backdropFilter: 'blur(4px)',
                    fontWeight: 600,
                    boxShadow: 1,
                    '&:hover': { bgcolor: '#fff' },
                  }}
                >
                  Set as Cover
                </Button>
              )}
            </Box>

            {/* Top Right Action: Remove Button */}
            <Box
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                zIndex: 3,
              }}
            >
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon fontSize="small" />}
                onClick={() => handleRemove(currentImage.id)}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.95)',
                  backdropFilter: 'blur(4px)',
                  fontWeight: 600,
                  boxShadow: 1,
                  '&:hover': { bgcolor: 'error.main', color: '#fff' },
                }}
              >
                Remove
              </Button>
            </Box>

            {/* Slider Navigation Arrows */}
            {allImages.length > 1 && (
              <>
                <IconButton
                  onClick={handlePrev}
                  aria-label="Previous image"
                  sx={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    bgcolor: 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(4px)',
                    boxShadow: 2,
                    '&:hover': { bgcolor: '#fff', transform: 'translateY(-50%) scale(1.08)' },
                  }}
                >
                  <ChevronLeftIcon fontSize="medium" />
                </IconButton>
                <IconButton
                  onClick={handleNext}
                  aria-label="Next image"
                  sx={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    bgcolor: 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(4px)',
                    boxShadow: 2,
                    '&:hover': { bgcolor: '#fff', transform: 'translateY(-50%) scale(1.08)' },
                  }}
                >
                  <ChevronRightIcon fontSize="medium" />
                </IconButton>
              </>
            )}

            {/* Slide Position Counter Badge */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 12,
                left: '50%',
                transform: 'translateX(-50%)',
                bgcolor: 'rgba(0,0,0,0.65)',
                color: '#fff',
                px: 1.5,
                py: 0.25,
                borderRadius: 10,
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.5px',
              }}
            >
              {activeIndex + 1} / {allImages.length}
            </Box>
          </Box>

          {/* Thumbnail Carousel Bar */}
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              justifyContent: 'center',
              alignItems: 'center',
              mt: 2.5,
              overflowX: 'auto',
              py: 1,
              px: 1,
            }}
          >
            {allImages.map((img, idx) => {
              const isActive = idx === activeIndex;
              return (
                <Box
                  key={img.id}
                  onClick={() => setActiveIndex(idx)}
                  sx={{
                    position: 'relative',
                    width: 76,
                    height: 76,
                    borderRadius: 1.5,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    bgcolor: 'grey.100',
                    border: '2px solid',
                    borderColor: isActive ? 'primary.main' : 'divider',
                    boxShadow: isActive ? '0 0 0 2px rgba(25, 118, 210, 0.3)' : 'none',
                    transition: 'all 150ms ease-in-out',
                    flexShrink: 0,
                    p: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '&:hover': {
                      borderColor: isActive ? 'primary.main' : 'grey.400',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <Box
                    component="img"
                    src={`${API_URL}/uploads/${img.fileKey}`}
                    alt={`Thumbnail ${idx + 1}`}
                    sx={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                    }}
                  />
                  {img.isCover && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        bgcolor: 'primary.main',
                        borderRadius: '50%',
                        width: 16,
                        height: 16,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <StarIcon style={{ color: '#fff', fontSize: 11 }} />
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      ) : (
        /* Empty State */
        <Box
          sx={{
            py: 6,
            px: 2,
            maxWidth: 720,
            mx: 'auto',
            mb: 4,
            textAlign: 'center',
            bgcolor: 'grey.50',
            borderRadius: 2,
            border: '2px dashed',
            borderColor: 'divider',
          }}
        >
          <AddPhotoAlternateIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
          <Typography variant="h6" color="text.secondary">No product images uploaded yet</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Upload images below to create a full gallery and set a cover image for your product passport.
          </Typography>
        </Box>
      )}

      {/* Upload Zone */}
      <Box sx={{ maxWidth: 720, mx: 'auto' }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          {allImages.length === 0 ? 'Upload Initial Product Images' : 'Add More Photos to Gallery'}
        </Typography>
        <DropZone
          accept="image/png,image/jpeg,image/webp"
          hint="PNG, JPEG or WebP · Maximum 10 MB per file · Select or drop multiple images"
          multiple={true}
          disabled={uploading}
          onFiles={(files) => handleUploadMultiple(files, allImages.length === 0)}
        >
          {uploading ? 'Uploading images…' : 'Drop product images here (or click Browse to select multiple)'}
        </DropZone>
      </Box>
    </Paper>
  );
}
