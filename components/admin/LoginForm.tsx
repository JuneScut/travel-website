'use client';
import { useActionState } from 'react';
import { loginAction } from '../../server/actions';
export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  return <form action={action}><label>账号<input name="username" autoComplete="username" required maxLength={80} /></label><label>密码<input name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>{state && !state.ok && <p role="alert" className="admin-error">{state.error}</p>}<button className="admin-primary" disabled={pending}>{pending ? '正在登录…' : '登录管理页 →'}</button></form>;
}
