import { redirect } from 'next/navigation';
import { currentAdmin } from '../../server/auth';
import { adminJourneys } from '../../server/queries';
import { diskUsage, initStorage } from '../../server/runtime';
import AdminWorkspace from '../../components/admin/AdminWorkspace';

export const dynamic = 'force-dynamic';
export default async function Page() {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login');
  await initStorage();
  return <AdminWorkspace initialJourneys={await adminJourneys()} username={admin.username} diskPercent={await diskUsage()} />;
}
