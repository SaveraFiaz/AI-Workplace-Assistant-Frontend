import './globals.css';
import Navbar from '../components/Navbar';

export const metadata = {
  title: 'AIAssist — AI Workplace Assistant',
  description: 'Unified AI platform for enterprise productivity',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 antialiased">
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
