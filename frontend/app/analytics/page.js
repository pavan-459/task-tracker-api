'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import { getAnalytics } from '../../lib/api';

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { router.replace('/login'); return; }
    if (!authLoading && user?.role === 'MEMBER') { router.replace('/board'); return; }
  }, [user, authLoading]);

  useEffect(() => {
    if (!user || user.role === 'MEMBER') return;
    getAnalytics().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  const maxOverdue = Math.max(...data.map(d => d.overdueCount), 1);

  if (authLoading || !user) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <main style={{ padding: '28px 24px', maxWidth: '900px' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '22px', marginBottom: '4px' }}>
            Analytics
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Overdue tasks and completion times per team member</p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '80px', borderRadius: '12px' }} />)}
          </div>
        ) : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>No data yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
              {[
                { label: 'Total Members', value: data.length, color: 'var(--accent)' },
                { label: 'Total Overdue', value: data.reduce((s, d) => s + d.overdueCount, 0), color: 'var(--red)' },
                { label: 'Avg Completion', value: (() => {
                  const valid = data.filter(d => d.avgCompletionHours);
                  if (!valid.length) return '—';
                  const avg = valid.reduce((s, d) => s + parseFloat(d.avgCompletionHours), 0) / valid.length;
                  return `${avg.toFixed(1)}h`;
                })(), color: 'var(--green)' },
              ].map(card => (
                <div key={card.label} style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '20px',
                }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{card.label}</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '28px', color: card.color }}>{card.value}</div>
                </div>
              ))}
            </div>

            {/* Per-user rows */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 180px 120px 120px', gap: '12px' }}>
                {['Member', 'Overdue Tasks', 'Completed', 'Avg Time'].map(h => (
                  <span key={h} style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</span>
                ))}
              </div>
              {data.map((row, i) => (
                <div key={row.userId} style={{
                  padding: '16px 20px',
                  borderBottom: i < data.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'grid',
                  gridTemplateColumns: '1fr 180px 120px 120px',
                  gap: '12px',
                  alignItems: 'center',
                  animation: `fadeUp 0.3s ease ${i * 0.05}s both`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px', height: '32px',
                      background: 'var(--accent-glow)',
                      border: '1px solid var(--accent)',
                      borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'Syne, sans-serif', fontWeight: 700,
                      color: 'var(--accent)', fontSize: '13px',
                    }}>
                      {row.name[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{row.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{row.email}</div>
                    </div>
                  </div>

                  {/* Overdue bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${(row.overdueCount / maxOverdue) * 100}%`,
                        background: row.overdueCount > 0 ? 'var(--red)' : 'var(--green)',
                        borderRadius: '3px',
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                    <span style={{ color: row.overdueCount > 0 ? 'var(--red)' : 'var(--green)', fontSize: '13px', fontWeight: 700, minWidth: '16px' }}>
                      {row.overdueCount}
                    </span>
                  </div>

                  <span style={{ color: 'var(--text)', fontSize: '13px' }}>
                    {row.completedCount || 0}
                  </span>

                  <span style={{ color: row.avgCompletionHours ? 'var(--green)' : 'var(--text-dim)', fontSize: '13px' }}>
                    {row.avgCompletionHours ? `${row.avgCompletionHours}h` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
