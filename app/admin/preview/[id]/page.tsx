import { redirect, notFound } from 'next/navigation';
import { currentAdmin } from '../../../../server/auth';
import { db } from '../../../../server/db';
import { journeyInclude, toPublicTrip } from '../../../../server/queries';
import Journal from '../../../../components/site/Journal.jsx';
import { uuid } from '../../../../server/validation';

export const dynamic = 'force-dynamic';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (!(await currentAdmin())) redirect('/admin/login');
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const row = await db.journey.findUnique({ where: { id }, include: journeyInclude });
  if (!row || row.deletedAt) notFound();
  const trip = toPublicTrip(row);
  return <><aside className="preview-banner">管理员预览 · {row.status === 'published' ? '已发布' : '未公开'} <a href="/admin">返回编辑 →</a></aside><Journal trips={[trip]} initialId={trip.id} /></>;
}
