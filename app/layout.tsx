import type { Metadata } from 'next';
import '../styles.css';
import './globals.css';

export const metadata: Metadata = { title: '旅迹 JOURNAL', description: '去远方，收集日常之外。旅行、摄影与世界足迹。' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN"><head><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" /><link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;1,400&family=Noto+Serif+SC:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;600&display=swap" rel="stylesheet" /></head><body>{children}</body></html>;
}
