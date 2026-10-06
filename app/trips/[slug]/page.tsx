import { notFound } from 'next/navigation';
import { publicJourney } from '../../../server/queries';
import Journal from '../../../components/site/Journal.jsx';

export const dynamic = 'force-dynamic';
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trip = await publicJourney(slug);
  if (!trip) notFound();
  return <Journal trips={[trip]} initialId={trip.id} />;
}
