'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const user = localStorage.getItem('user');
    router.replace(user ? '/board' : '/login');
  }, []);
  return null;
}
