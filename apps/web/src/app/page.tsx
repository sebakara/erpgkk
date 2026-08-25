import type { CSSProperties } from 'react';
import Link from 'next/link';
import { RedirectIfAuthed } from '@/components/auth/redirect-if-authed';

const FEATURES = [
  {
    mark: '▣',
    title: 'Projects & sprints',
    body: 'Issues, kanban, backlog, docs, and analytics in one workspace.',
  },
  {
    mark: '☰',
    title: 'HR & leave',
    body: 'Requests, packages, performance reviews, and department heads.',
  },
  {
    mark: '✉',
    title: 'Team chat',
    body: 'DMs, department and project rooms, mentions, and slash commands.',
  },
  {
    mark: '◎',
    title: 'Clients & newsletters',
    body: 'Keep customer work linked to projects and send updates from the same app.',
  },
  {
    mark: '●',
    title: 'Live notifications',
    body: 'Assignments, leave decisions, and mentions land as they happen.',
  },
  {
    mark: '⬡',
    title: 'Role-based access',
    body: 'Admins, managers, and employees see only what they should.',
  },
];

const page: CSSProperties = { minHeight: '100vh', color: '#fff', background: '#0f1226' };
const hairline = 'rgba(255,255,255,0.1)';
const wrap: CSSProperties = { maxWidth: 1152, margin: '0 auto', padding: '0 24px' };

export default function HomePage() {
  return (
    <div style={page}>
      <RedirectIfAuthed />
      <header style={{ borderBottom: `1px solid ${hairline}` }}>
        <div style={{ ...wrap, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: '#6366f1',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700,
            }}>G</div>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>GKK ERP</p>
              <p style={{ margin: 0, fontSize: 11, color: '#a5b4fc', lineHeight: 1.2 }}>CompanyOS</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/login" style={{ fontSize: 14, color: '#c7d2fe', textDecoration: 'none', padding: '6px 12px' }}>
              Sign in
            </Link>
            <Link
              href="/register"
              style={{
                fontSize: 14, fontWeight: 500, background: '#6366f1', color: '#fff',
                textDecoration: 'none', padding: '8px 16px', borderRadius: 8,
              }}
            >
              Create workspace
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section style={{ ...wrap, paddingTop: 80, paddingBottom: 64 }}>
          <p style={{ color: '#a5b4fc', fontSize: 14, fontWeight: 500, margin: '0 0 16px' }}>
            Internal operations, in one place
          </p>
          <h1 style={{ fontSize: 44, fontWeight: 700, letterSpacing: -0.5, maxWidth: 768, lineHeight: 1.15, margin: 0 }}>
            Run projects, people, and conversations without leaving CompanyOS.
          </h1>
          <p style={{ margin: '20px 0 0', color: '#c7d2fe', fontSize: 18, maxWidth: 640, lineHeight: 1.6 }}>
            GKK ERP is the workspace for GKK Technologies — sprints and issues,
            HR leave, live chat, and client follow-up on a single login.
          </p>
          <div style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Link
              href="/login"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, background: '#6366f1',
                color: '#fff', fontWeight: 500, padding: '10px 20px', borderRadius: 12, textDecoration: 'none',
              }}
            >
              Sign in →
            </Link>
            <Link
              href="/register"
              style={{
                display: 'inline-flex', alignItems: 'center', color: '#fff', fontWeight: 500,
                padding: '10px 20px', borderRadius: 12, textDecoration: 'none',
                border: '1px solid rgba(255,255,255,0.25)',
              }}
            >
              Start a new company
            </Link>
          </div>
        </section>

        <section style={{ borderTop: `1px solid ${hairline}`, background: '#161936' }}>
          <div style={{ ...wrap, padding: '64px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            {FEATURES.map(({ mark, title, body }) => (
              <div
                key={title}
                style={{ borderRadius: 16, padding: 20, border: `1px solid ${hairline}`, background: 'rgba(255,255,255,0.03)' }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', marginBottom: 16, color: '#a5b4fc', background: 'rgba(99,102,241,0.2)',
                  fontSize: 16,
                }}>
                  {mark}
                </div>
                <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600 }}>{title}</h2>
                <p style={{ margin: 0, fontSize: 14, color: '#c7d2fe', lineHeight: 1.6 }}>{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer style={{ borderTop: `1px solid ${hairline}` }}>
        <div style={{ ...wrap, padding: '24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 12, color: '#a5b4fc' }}>
          <span>GKK Technologies · internal use</span>
          <Link href="/login" style={{ color: 'inherit', textDecoration: 'none' }}>Employee sign in</Link>
        </div>
      </footer>
    </div>
  );
}
