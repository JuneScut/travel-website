import { redirect } from 'next/navigation';
import { currentAdmin } from '../../../server/auth';
import LoginForm from '../../../components/admin/LoginForm';

export const dynamic = 'force-dynamic';
export default async function Page() {
  if (await currentAdmin()) redirect('/admin');
  return <main className="admin-login"><a href="/" className="admin-brand">旅迹 <small>JOURNAL</small></a><p className="admin-eyebrow">PRIVATE ARCHIVE</p><h1>继续记录<br />你的旅途。</h1><LoginForm /><p className="admin-note">仅管理员可登录。忘记密码请在服务器执行密码重置命令。</p></main>;
}
