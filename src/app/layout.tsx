import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Book of the End',
  description: '고르기 → 빌리기 → 읽기 → 이해 확인 → 다음 책. 취향·어휘 수준·시간대·도서관 재고를 보고 지금 읽을 책을 고르는 독서 앱 프로토타입.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F3EE' },
    { media: '(prefers-color-scheme: dark)', color: '#0F141B' },
  ],
};

// 기기의 라이트/다크 설정을 따르고, 첫 화면이 그려지기 전에 정해 깜빡임을 막는다.
const themeScript = `(function(){try{var m=window.matchMedia('(prefers-color-scheme: dark)');var set=function(){document.documentElement.dataset.theme=m.matches?'dark':'light'};set();m.addEventListener('change',set)}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
