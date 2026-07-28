'use client';

import { Box, Button, Typography } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import { PassportView } from '@/components/passport/PassportView';
import { ScanBeacon } from '@/components/passport/ScanBeacon';
import { getPublicApiUrl, type PublicPassportResponse } from '@/lib/passport/fetch-public';

export function PublicPassportShell({
  data,
  fromQr,
  scanPath,
}: {
  data: PublicPassportResponse;
  fromQr: boolean;
  scanPath: string;
}) {
  const apiUrl = getPublicApiUrl();
  const accentColor =
    data.product.organisation?.accentColor &&
    /^#[0-9a-f]{6}$/i.test(data.product.organisation.accentColor)
      ? data.product.organisation.accentColor
      : '#157F5C';

  return (
    <>
      <ScanBeacon scanPath={scanPath} fromQr={fromQr} />
      <Box sx={{ maxWidth: 640, mx: 'auto', px: 2, pt: 2, textAlign: 'right' }}>
        <Button
          component="a"
          href={`${apiUrl}/passport/${data.uuid}/pdf`}
          startIcon={<PictureAsPdfIcon sx={{ color: accentColor }} />}
          variant="outlined"
          sx={{
            color: accentColor,
            borderColor: accentColor,
            fontWeight: 600,
            '&:hover': { borderColor: accentColor, bgcolor: 'rgba(21, 127, 92, 0.04)' },
          }}
        >
          Export as PDF
        </Button>
      </Box>
      <PassportView
        product={data.product}
        passportInfo={{
          uuid: data.uuid,
          version: data.version,
          createdAt: data.createdAt,
          publishedAt: data.publishedAt,
          status: data.status,
          verificationStatus: data.verificationStatus,
        }}
        apiBaseUrl={apiUrl}
      />
    </>
  );
}

export function PassportUnavailable({ title, body }: { title: string; body: string }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        p: 4,
      }}
    >
      <Box>
        <Typography variant="h1" sx={{ mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {body}
        </Typography>
      </Box>
    </Box>
  );
}
