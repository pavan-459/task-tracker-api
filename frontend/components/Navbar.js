'use client';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const ROLE_COLORS = { ADMIN: '#f76a7c', MANAGER: '#f7a26a', MEMBER: '#4af7a2' };

export default function Navbar({ onCreateTask }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { label: 'Board', href: '/board' },
    ...(user?.role !== 'MEMBER' ? [{ label: 'Analytics', href: '/analytics' }] : []),
  ];

  return (
    <nav style={{
      height: '56px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: '0',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '32px' }}>
        <div style={{ width: '26px', height: '26px', background: 'var(--accent)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>⬡</div>
        <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '15px' }}>TaskFlow</span>
      </div>

      {/* Nav links */}
      <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
        {navItems.map(item => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            style={{
              padding: '6px 14px',
              background: pathname === item.href ? 'var(--accent-glow)' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: pathname === item.href ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: 'DM Mono, monospace',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (pathname !== item.href) e.target.style.color = 'var(--text)'; }}
            onMouseLeave={e => { if (pathname !== item.href) e.target.style.color = 'var(--text-muted)'; }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {user?.role !== 'MEMBER' && onCreateTask && (
          <button
            onClick={onCreateTask}
            style={{
              padding: '7px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: '7px',
              color: '#fff',
              fontSize: '13px',
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span> New Task
          </button>
        )}

        {/* User badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            padding: '2px 8px',
            background: `${ROLE_COLORS[user?.role]}18`,
            border: `1px solid ${ROLE_COLORS[user?.role]}40`,
            borderRadius: '20px',
            color: ROLE_COLORS[user?.role],
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.06em',
          }}>
            {user?.role}
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{user?.name}</span>
          <button
            onClick={logout}
            style={{
              padding: '5px 10px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-muted)',
              fontSize: '11px',
              cursor: 'pointer',
              fontFamily: 'DM Mono, monospace',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            logout
          </button>
        </div>
      </div>
    </nav>
  );
}
