import { Syne } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';

const syne = Syne({ subsets: ['latin'], variable: '--font-syne' });

export const metadata = {
  title: 'TaskFlow — Team Task Tracker',
  description: 'Collaborative task management for your team',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={syne.variable}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
