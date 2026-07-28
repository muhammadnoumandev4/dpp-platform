import { PassportUnavailable, PublicPassportShell } from '@/components/passport/PublicPassportShell';
import { fetchPublicPassport } from '@/lib/passport/fetch-public';

export default async function PublicItemPassportPage({
  params,
  searchParams,
}: {
  params: { itemUuid: string };
  searchParams: { src?: string };
}) {
  const fromQr = searchParams.src === 'qr';
  const result = await fetchPublicPassport(`/passport/i/${params.itemUuid}`);

  if (result.ok === false) {
    if (result.status === 404 || result.status === 410) {
      return (
        <PassportUnavailable
          title="This passport isn't available"
          body="The code you scanned doesn't resolve to a live product passport. It may never have existed, or the brand may have taken it down."
        />
      );
    }
    return (
      <PassportUnavailable
        title="Something went wrong"
        body="We couldn't load this passport right now. Please try again in a moment."
      />
    );
  }

  return (
    <PublicPassportShell
      data={result.data}
      fromQr={fromQr}
      scanPath={`/passport/i/${params.itemUuid}/scan`}
    />
  );
}
