-- The server cannot distinguish a QR scan from a typed/shared link when both
-- resolve the same URL. QR images now encode `?src=qr`; the public page
-- forwards that as a source header and each scan records where it came from.
-- Pre-existing printed QRs (generated without the parameter) keep working and
-- are recorded as DIRECT, matching the column default for historical rows.
CREATE TYPE "ScanSource" AS ENUM ('QR', 'DIRECT');

ALTER TABLE "scans"
  ADD COLUMN "source" "ScanSource" NOT NULL DEFAULT 'DIRECT';
