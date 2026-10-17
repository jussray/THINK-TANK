import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import './globals.css';
export const metadata:Metadata={
  title:'Think Tank | Where ideas become evidence',
  description:'Founder-owned interviews and evidence-bound analysis, with durable records and deliberate approvals.'
};
export default function RootLayout({children}:{children:ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
