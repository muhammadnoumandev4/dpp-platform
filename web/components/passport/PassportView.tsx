'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  Divider,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableContainer,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined';
import DownloadIcon from '@mui/icons-material/DownloadOutlined';
import type { PassportProduct, ProductImageResponse } from '@/lib/types';

export interface PassportInfo {
  uuid: string;
  version: number;
  createdAt: string;
  publishedAt: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  verificationStatus: 'UNVERIFIED' | 'VERIFIED';
}

const DOCUMENT_LABELS: Record<string, string> = {
  MANUAL: 'User manual',
  WARRANTY: 'Warranty',
  DATASHEET: 'Technical datasheet',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ProductImageGallery({
  images,
  productName,
  apiBaseUrl,
  accentColor,
}: {
  images: ProductImageResponse[];
  productName: string;
  apiBaseUrl: string;
  accentColor: string;
}) {
  const [selectedImageId, setSelectedImageId] = useState(images[0]?.id ?? null);
  const selectedIndex = Math.max(0, images.findIndex((image) => image.id === selectedImageId));
  const selectedImage = images[selectedIndex];
  const hasMultipleImages = images.length > 1;

  function selectRelativeImage(offset: number) {
    if (!hasMultipleImages) return;
    const nextIndex = (selectedIndex + offset + images.length) % images.length;
    setSelectedImageId(images[nextIndex].id);
  }

  if (!selectedImage) {
    return (
      <Box
        role="img"
        aria-label="No product image available"
        sx={{
          height: { xs: 280, sm: 380 },
          borderRadius: 3,
          bgcolor: 'grey.100',
          border: '1px solid',
          borderColor: 'divider',
        }}
      />
    );
  }

  return (
    <Box>
      <Box
        sx={{
          position: 'relative',
          height: { xs: 300, sm: 420 },
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: '#FAFAF9',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box
          component="img"
          key={selectedImage.id}
          src={`${apiBaseUrl}/uploads/${selectedImage.fileKey}`}
          alt={selectedImage.altText || `${productName} image ${selectedIndex + 1}`}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            p: { xs: 1, sm: 2 },
            animation: 'passport-image-in 180ms ease-out',
            '@keyframes passport-image-in': {
              from: { opacity: 0.45, transform: 'scale(0.99)' },
              to: { opacity: 1, transform: 'scale(1)' },
            },
          }}
        />

        {hasMultipleImages && (
          <>
            <Chip
              label={`${selectedIndex + 1} / ${images.length}`}
              size="small"
              aria-live="polite"
              sx={{
                position: 'absolute',
                top: 12,
                left: '50%',
                transform: 'translateX(-50%)',
                bgcolor: 'rgba(28, 28, 25, 0.72)',
                color: 'common.white',
                fontWeight: 600,
              }}
            />
            <IconButton
              aria-label="Previous product image"
              onClick={() => selectRelativeImage(-1)}
              sx={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(255,255,255,0.92)',
                boxShadow: 2,
                '&:hover': { bgcolor: 'common.white' },
              }}
            >
              <ArrowBackIosNewIcon fontSize="small" />
            </IconButton>
            <IconButton
              aria-label="Next product image"
              onClick={() => selectRelativeImage(1)}
              sx={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(255,255,255,0.92)',
                boxShadow: 2,
                '&:hover': { bgcolor: 'common.white' },
              }}
            >
              <ArrowForwardIosIcon fontSize="small" />
            </IconButton>
          </>
        )}
      </Box>

      {hasMultipleImages && (
        <Box
          aria-label="Product image thumbnails"
          sx={{
            display: 'flex',
            gap: 1,
            mt: 1.5,
            pb: 0.75,
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'thin',
          }}
        >
          {images.map((image, index) => {
            const selected = index === selectedIndex;
            return (
              <ButtonBase
                key={image.id}
                aria-label={`Show product image ${index + 1}`}
                aria-current={selected ? 'true' : undefined}
                onClick={() => setSelectedImageId(image.id)}
                sx={{
                  width: 68,
                  height: 68,
                  flex: '0 0 68px',
                  p: 0.5,
                  borderRadius: 1.5,
                  border: '2px solid',
                  borderColor: selected ? accentColor : 'divider',
                  bgcolor: 'background.paper',
                  scrollSnapAlign: 'start',
                }}
              >
                <Box
                  component="img"
                  src={`${apiBaseUrl}/uploads/${image.fileKey}`}
                  alt=""
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 1 }}
                />
              </ButtonBase>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

/**
 * The single component both the editor's Preview tab and the public
 * /passport/[uuid] page render — same markup, two hosts. This is what
 * guarantees a Preview can never lie about what the public page will show:
 * there is no second implementation to drift out of sync.
 */
export function PassportView({
  product,
  passportInfo,
  apiBaseUrl,
}: {
  product: PassportProduct;
  passportInfo: PassportInfo | null;
  apiBaseUrl: string;
}) {
  const cover = product.images.find((i) => i.isCover) ?? product.images[0];
  const gallery = product.images.filter((i) => i.id !== cover?.id);
  const orderedImages = cover ? [cover, ...gallery] : [];
  const accentColor = product.organisation?.accentColor && /^#[0-9a-f]{6}$/i.test(product.organisation.accentColor)
    ? product.organisation.accentColor
    : '#157F5C';
  const sustainabilityCards = product.sustainability
    ? [
        ['Carbon footprint', product.sustainability.carbonFootprintKg, 'kg CO₂e'],
        ['Water consumption', product.sustainability.waterConsumptionL, 'litres'],
        ['Recycled material', product.sustainability.recycledPercent, '%'],
        ['Repairability', product.sustainability.repairabilityScore, '/10'],
      ].filter(([, value]) => value != null)
    : [];

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', p: { xs: 2, md: 4 } }}>
      {/* Sleek Luxury Brand Header */}
      {product.organisation?.name && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 2,
            mb: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {product.organisation.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.organisation.logoUrl}
                alt={product.organisation.name}
                style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'contain' }}
              />
            ) : (
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1.5,
                  bgcolor: accentColor,
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {product.organisation.name.slice(0, 2).toUpperCase()}
              </Box>
            )}
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.2rem', letterSpacing: '0.3px', color: 'text.primary' }}>
              {product.organisation.name}
            </Typography>
          </Box>
        </Box>
      )}

      <Box sx={{ my: 2 }}>
        <ProductImageGallery
          images={orderedImages}
          productName={product.name}
          apiBaseUrl={apiBaseUrl}
          accentColor={accentColor}
        />
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, mt: 2, borderRadius: 2 }}>
          {passportInfo?.verificationStatus === 'VERIFIED' && (
            <Chip
              icon={<CheckCircleIcon />}
              label="Verified product"
              size="small"
              variant="outlined"
              sx={{ mb: 1, color: accentColor, borderColor: accentColor, '& .MuiChip-icon': { color: accentColor } }}
            />
          )}
          <Typography variant="h1" sx={{ wordBreak: 'break-word' }}>{product.name}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {product.sku} {product.serialNumber ? `· ${product.serialNumber}` : ''}
          </Typography>
        </Paper>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="overline" color="text.secondary">Product information</Typography>
      {product.description && <Typography variant="body1" sx={{ mb: 2, mt: 0.5 }}>{product.description}</Typography>}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={4}>
          <Typography variant="caption" color="text.secondary">Category</Typography>
          <Typography variant="body2">{product.category?.name ?? '—'}</Typography>
        </Grid>
        <Grid item xs={4}>
          <Typography variant="caption" color="text.secondary">Production date</Typography>
          <Typography variant="body2">{product.productionDate?.slice(0, 10) ?? '—'}</Typography>
        </Grid>
        <Grid item xs={4}>
          <Typography variant="caption" color="text.secondary">Country of origin</Typography>
          <Typography variant="body2">{product.countryOfOrigin?.name ?? '—'}</Typography>
        </Grid>
      </Grid>

      {product.materials.length > 0 && (
        <>
          <Typography variant="overline" color="text.secondary">Materials</Typography>
          <TableContainer sx={{ mb: 3, mt: 0.5, overflowX: 'auto' }}>
            <Table size="small" aria-label="Material composition">
              <TableHead>
                <TableRow>
                  <TableCell>Material</TableCell>
                  <TableCell>Origin</TableCell>
                  <TableCell align="right">Percentage</TableCell>
                  <TableCell align="right">Recyclable</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {product.materials.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.name}</TableCell>
                    <TableCell>{m.countryOfOrigin?.name ?? '—'}</TableCell>
                    <TableCell align="right">{m.percentage}%</TableCell>
                    <TableCell align="right">{m.recyclable ? 'Yes' : 'No'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {sustainabilityCards.length > 0 && (
        <>
          <Typography variant="overline" color="text.secondary">Sustainability</Typography>
          <Grid container spacing={2} sx={{ mb: 3, mt: 0.5 }}>
            {sustainabilityCards.map(([label, value, unit]) => (
              <Grid item xs={6} key={label as string}>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: `${accentColor}0D`, borderTop: '3px solid', borderTopColor: accentColor }}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="h3">
                    {value}
                    {unit === '%' || unit === '/10' ? unit : ''}
                  </Typography>
                  {unit !== '%' && unit !== '/10' && <Typography variant="caption" color="text.secondary">{unit}</Typography>}
                </Paper>
              </Grid>
            ))}
          </Grid>
          {product.sustainability?.recyclable && (
            <Typography variant="body2" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 0.5, color: accentColor }}>
              <CheckCircleIcon fontSize="small" /> Recyclable
            </Typography>
          )}
        </>
      )}

      {product.certifications.length > 0 && (
        <>
          <Typography variant="overline" color="text.secondary">Certifications</Typography>
          <Box sx={{ mb: 3, mt: 0.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {product.certifications.map((cert) => {
              const isExpired = cert.expiryDate && new Date(cert.expiryDate) < new Date();
              return (
                <Paper key={cert.id} variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {cert.name}
                      {isExpired && (
                        <Chip size="small" color="warning" label="Expired" sx={{ height: 20, fontSize: 11 }} icon={<ErrorOutlineIcon sx={{ fontSize: 14 }} />} />
                      )}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[
                        cert.issuingAuthority,
                        cert.issueDate ? `issued ${cert.issueDate.slice(0, 10)}` : null,
                        cert.expiryDate ? `valid to ${cert.expiryDate.slice(0, 10)}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Typography>
                  </Box>
                  {cert.fileKey && (
                    <Button
                      component="a"
                      href={`${apiBaseUrl}/uploads/${cert.fileKey}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Download ${cert.name} certificate PDF`}
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadIcon fontSize="small" />}
                      sx={{
                        color: accentColor,
                        borderColor: accentColor,
                        fontWeight: 600,
                        fontSize: 12,
                        borderRadius: 1.5,
                        px: 1.5,
                        py: 0.5,
                        textTransform: 'none',
                        '&:hover': {
                          borderColor: accentColor,
                          bgcolor: `${accentColor}12`,
                        },
                      }}
                    >
                      PDF
                    </Button>
                  )}
              </Paper>
            );
            })}
          </Box>
        </>
      )}

      {product.documents.length > 0 && (
        <>
          <Typography variant="overline" color="text.secondary">Documents</Typography>
          <Box sx={{ mb: 3, mt: 0.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {product.documents.map((doc) => (
              <a
                key={doc.id}
                href={`${apiBaseUrl}/uploads/${doc.fileKey}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Download ${DOCUMENT_LABELS[doc.type] ?? doc.type}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <DescriptionIcon fontSize="small" color="action" />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2">{DOCUMENT_LABELS[doc.type] ?? doc.type}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {doc.fileName.toLowerCase().endsWith('.docx') ? 'DOCX' : 'PDF'} · {formatBytes(doc.sizeBytes)}
                    </Typography>
                  </Box>
                  <DownloadIcon fontSize="small" />
                </Paper>
              </a>
            ))}
          </Box>
        </>
      )}

      <Divider sx={{ my: 3 }} />
      {passportInfo ? (
        <>
          <Typography variant="overline" color="text.secondary">Passport information</Typography>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Passport ID</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {passportInfo.uuid}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">Creation date</Typography>
              <Typography variant="body2">{new Date(passportInfo.createdAt).toLocaleDateString()}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">Version</Typography>
              <Typography variant="body2">v{passportInfo.version}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">Status</Typography>
              <Typography variant="body2">{passportInfo.status === 'PUBLISHED' ? 'Published' : 'Draft'}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">Verification status</Typography>
              <Typography variant="body2">
                {passportInfo.verificationStatus === 'VERIFIED' ? 'Verified' : 'Unverified'}
              </Typography>
            </Grid>
          </Grid>
        </>
      ) : (
        <Typography variant="caption" color="text.secondary">
          This product has not been published yet — this is a preview only.
        </Typography>
      )}

      {/* Powered By Notarify Footer (Clean & Minimal) */}
      <Box
        component="footer"
        sx={{
          py: 3,
          px: 2,
          textAlign: 'center',
          mt: 5,
          pt: 3,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: '0.3px', fontSize: '0.9rem', color: 'text.primary' }}>
          Powered by Notarify DPP
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontSize: '0.8rem' }}>
          Digital Product Passport Platform · Immutable Product Transparency
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5, fontSize: '0.75rem' }}>
          © {new Date().getFullYear()} Notarify Inc. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
}
