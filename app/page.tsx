import { publicJourneys } from '../server/queries';
import Journal from '../components/site/Journal.jsx';

export const dynamic = 'force-dynamic';
export default async function Page() { return <Journal trips={await publicJourneys()} initialId={undefined} />; }
