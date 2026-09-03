import type { Metadata } from 'next';
import AdvertisePage from '@/components/advertise/advertise-page';
import { brand } from '@/lib/brand';
import { NETWORK_STORES, PLAYS_PER_DAY_PER_SLOT, SLOT_SECONDS } from '@/lib/advertise-network';

export const metadata: Metadata = {
  title: `Advertise on ${brand.name} — in-store screens across ${brand.city}`,
  description:
    `A ${SLOT_SECONDS}-second ad on screens inside ${NETWORK_STORES.length} supermarkets in ` +
    `${brand.city}, playing ${PLAYS_PER_DAY_PER_SLOT} times a day. Pick your stores, see the price, book in a week.`,
  // TODO: add an OG image once the creative team has one for this page.
};

export default function Page() {
  return <AdvertisePage />;
}
