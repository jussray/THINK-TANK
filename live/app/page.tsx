import Link from 'next/link';
export default function Landing(){
return <div className="ambient">
  <header className="topbar"><Link href="/" className="logo">Think Tank<span>.</span></Link>
    <nav className="topnav" aria-label="Primary">
      <a href="#why">The process</a><Link href="/workspace" className="outline">Enter workspace</Link>
    </nav></header>
  <main className="hero">
    <div className="portal" aria-hidden="true"/>
    <p className="eyebrow">The idea is only the beginning</p>
    <h1>Where your next big idea meets its future.</h1>
    <p className="lead">Question what you think. Keep what you discover. Build a stronger idea with an adaptive interview and a record that belongs to you.</p>
    <div className="actions"><Link href="/workspace" className="primary">Enter the Think Tank →</Link>
      <a className="outline" href="#why">Explore the process</a></div>
    <p className="footnote">Founder-owned records · Evidence before conclusions · No invented market validation</p>
  </main>
  <section id="why" className="mainArea" style={{paddingBottom:100}}>
    <p className="eyebrow">Interview · Reflect · Verify</p><h2>Five disciplines. One accountable record.</h2>
    <div className="orbList">{['Interviewer','Critic','Synthesizer','Scorecard','Matchmaker'].map(x=>
      <div className="agent" key={x}><div className="orb" aria-hidden="true"/><strong>{x}</strong></div>)}</div>
    <p className="note">Interviewer is the first live-agent implementation target. Additional provider agents, research and Council Bus transport become active only after independent runtime verification.</p>
  </section>
</div>}
