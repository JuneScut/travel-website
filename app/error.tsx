'use client';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="admin-login"><h1>暂时无法载入。</h1><p>请检查服务与数据库连接后重试。</p><button className="admin-primary" onClick={reset}>重新载入</button></main>; }
