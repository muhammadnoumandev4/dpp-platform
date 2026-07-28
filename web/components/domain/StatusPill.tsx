import { Chip } from '@mui/material';

const STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  DRAFT: { bg: '#F5F5F3', color: '#5C5C55', border: '#E4E4E1', label: 'Draft' },
  PENDING_REVIEW: { bg: '#FBF6EA', color: '#9A6B0F', border: '#EADFC2', label: 'Pending review' },
  PUBLISHED: { bg: '#E8F1ED', color: '#157F5C', border: '#C9E0D6', label: 'Published' },
  UNPUBLISHED: { bg: '#FBF1F1', color: '#A32B2B', border: '#E8CFCF', label: 'Unpublished' },
};

export function StatusPill({ status }: { status: string }) {
  const style = STYLES[status] ?? STYLES.DRAFT;
  return (
    <Chip
      size="small"
      label={style.label}
      sx={{ bgcolor: style.bg, color: style.color, border: `1px solid ${style.border}`, fontWeight: 500 }}
    />
  );
}
