/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Users,
  Trophy,
  BarChart2,
  Star,
  ThumbsUp,
  Search,
  TrendingUp,
  ShieldCheck,
  Menu,
  X,
  Code,
  Share2,
  Zap,
  Cpu,
  Award,
  Calendar,
} from "lucide-react";

// Modernized single-file Home component with an in-page Trade section and scroll-entry animations
export default function Home() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // prefilled live auction (exact data preserved)
  const liveAuction = useMemo(
    () => ({
      id: "ipldraft2025",
      title: "IPL Legends Draft — Live Preview",
      endsAt: Date.now() + 1000 * 60 * 3 + 4000,
      currentBid: 24000000,
      nextMinBid: 25000000,
      topBidder: "SkyBound",
      room: "IPLLegends2025",
      featuredPlayer: {
        name: "Rohit Sharma",
        role: "Top-order Batter",
        basePrice: 5000000,
        image: null,
      },
    }),
    []
  );

  const fmtINR = (value) => {
    if (!value && value !== 0) return "—";
    const rupees = Math.round(value / 100);
    if (rupees >= 10000000) return `₹ ${rupees / 10000000} Cr`;
    if (rupees >= 100000) return `₹ ${rupees / 100000} Lakh`;
    return `₹ ${rupees.toLocaleString()}`;
  };

  // demo teams & players (unchanged)
  const teams = useMemo(
    () => [
      {
        id: "team-sky",
        name: "SkyBound",
        players: [
          { id: "p1", name: "Rohit Sharma", role: "Top-order Batter", value: 5000000 },
          { id: "p2", name: "Hardik Pandya", role: "All-rounder", value: 3600000 },
        ],
      },
      {
        id: "team-blue",
        name: "BlueWave",
        players: [
          { id: "p3", name: "Virat Kohli", role: "Top-order Batter", value: 4200000 },
          { id: "p4", name: "Jasprit Bumrah", role: "Pacer", value: 2900000 },
        ],
      },
    ],
    []
  );

  // prefill for when user requests a trade from team cards: we'll scroll to the trade section and pre-select
  const tradeScroll = useRef(null);
  const [prefill, setPrefill] = useState(null);

  function openTradeSectionWith(player, fromTeam) {
    setPrefill({ player, fromTeam });
    document.getElementById('trade')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#050816] via-[#07102a] to-black text-slate-50 antialiased font-inter">
      <Header menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      <section className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-7">
          <AnimatedBlock>
            <Hero fmtINR={fmtINR} navigate={navigate} />
          </AnimatedBlock>

          <AnimatedBlock className="mt-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FeatureCard title="Auto-extend" copy="Prevent sniping with configurable extension windows." icon={<Zap className="w-5 h-5" />} />
              <FeatureCard title="Auditable Receipts" copy="Download full bid history and receipts." icon={<BarChart2 className="w-5 h-5" />} />
              <FeatureCard title="Draft Mode" copy="Round-based drafts with budgets and caps." icon={<Trophy className="w-5 h-5" />} />
            </div>
          </AnimatedBlock>

          <AnimatedBlock className="mt-8">
            <div className="rounded-2xl border border-slate-700 bg-slate-900/40 p-4">
              <h4 className="text-lg font-semibold">Demo Rooms</h4>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {teams.map((t) => (
                  <TeamCard key={t.id} team={t} onRequestTrade={(p) => openTradeSectionWith(p, t)} />
                ))}
              </div>
            </div>
          </AnimatedBlock>
        </div>

        <div className="lg:col-span-5">
          <AnimatedBlock>
            <LiveBox liveAuction={liveAuction} fmtINR={fmtINR} onPlaceBid={() => alert('Bid placed — integrate API')} />
          </AnimatedBlock>

          <AnimatedBlock className="mt-4">
            <div className="text-sm text-slate-400">Pro tip: Use Host to configure budgets, reserves and timed rounds before going live.</div>
          </AnimatedBlock>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-12">
        <AnimatedBlock>
          <HowToPlay />
        </AnimatedBlock>
      </section>

      {/* Trade Section (in-page, detailed) */}
      <section id="trade" ref={tradeScroll} className="max-w-7xl mx-auto px-6 py-16">
        <AnimatedBlock>
          <TradeSection teams={teams} prefill={prefill} fmtINR={fmtINR} />
        </AnimatedBlock>
      </section>

      {/* About section — expanded and specific to AuctionPlay */}
      <section id="about" className="max-w-7xl mx-auto px-6 py-12">
        <AnimatedBlock>
          <About />
        </AnimatedBlock>
      </section>

      <footer className="max-w-7xl mx-auto px-6 py-8 text-center text-xs text-slate-500">© {new Date().getFullYear()} AuctionPlay — Built for the cricket community</footer>
    </main>
  );
}

/* ---------------- Components ---------------- */
function Header({ menuOpen, setMenuOpen }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-50 backdrop-blur-sm bg-black/30 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
        
          <div>
            <h1 className="text-lg font-bold tracking-tight">AuctionPlay</h1>
            <p className="text-xs text-slate-400">Fast • Fair • Futuristic</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <button className="text-sm text-slate-300 hover:text-white" onClick={() => document.getElementById('how-to-play')?.scrollIntoView({behavior:'smooth'})}>How to play</button>
          <button className="text-sm text-slate-300 hover:text-white" onClick={() => document.getElementById('trade')?.scrollIntoView({behavior:'smooth'})}>Trade</button>
          <button className="text-sm text-slate-300 hover:text-white" onClick={() => document.getElementById('about')?.scrollIntoView({behavior:'smooth'})}>About</button>
          <button onClick={() => navigate('/create')} className="ml-4 btn btn-sm btn-primary rounded-full">Host</button>
        </nav>

        <div className="md:hidden">
          <button aria-label="Toggle menu" onClick={() => setMenuOpen((s) => !s)} className="p-2 rounded-md bg-slate-800/40">
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="md:hidden bg-slate-900/90 border-t border-slate-800">
            <div className="px-6 py-4 flex flex-col gap-3">
              <button onClick={() => document.getElementById('how-to-play')?.scrollIntoView({behavior:'smooth'})} className="text-left">How to play</button>
              <button onClick={() => document.getElementById('trade')?.scrollIntoView({behavior:'smooth'})} className="text-left">Trade</button>
              <button onClick={() => navigate('/create')} className="text-left btn btn-primary rounded-full w-full">Host Auction</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function AnimatedBlock({ children, className = '' }) {
  return (
    <motion.div
      initial={{ y: 18, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Hero({ fmtINR, navigate }) {
  return (
    <div>
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-rose-400 to-yellow-400 text-black text-xs font-semibold">Live • Realtime</div>
      <h2 className="mt-6 text-4xl sm:text-5xl font-extrabold leading-tight">Draft champions. Build dynasties. Run auctions like a pro — instantly.</h2>
      <p className="mt-4 text-lg text-slate-300 max-w-prose">A modern, secure auction platform for leagues, teams and superfans. Create private rooms, invite teammates with a code, and run realistic GPT-powered auction simulations to decide winners.</p>

      <div className="mt-8 flex gap-4">
        <button onClick={() => navigate('/create')} className="btn btn-primary px-6 py-3 rounded-2xl shadow-lg">Create Room</button>
        <button onClick={() => navigate('/join')} className="btn btn-outline px-6 py-3 rounded-2xl">Browse Live</button>
      </div>
    </div>
  );
}

function LiveBox({ liveAuction, fmtINR, onPlaceBid }) {
  return (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative rounded-3xl p-6 shadow-2xl border border-slate-700 bg-gradient-to-br from-slate-800/60 to-slate-900/50">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-emerald-300 font-semibold">LIVE • IPL PREVIEW</p>
          <h3 className="mt-2 font-semibold text-xl">{liveAuction.title}</h3>
          <p className="mt-1 text-sm text-slate-400">Ends in <Countdown end={liveAuction.endsAt} /></p>
        </div>

        <div className="text-right">
          <p className="text-xs text-slate-400">Current bid</p>
          <p className="text-lg font-bold">{fmtINR(liveAuction.currentBid)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl p-3 bg-gradient-to-br from-slate-700/40 to-slate-700/10">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-lg bg-slate-900/40 flex items-center justify-center font-semibold">R</div>
          <div className="flex-1">
            <p className="font-semibold">{liveAuction.featuredPlayer.name}</p>
            <p className="text-xs text-slate-300">{liveAuction.featuredPlayer.role} • Base: {fmtINR(liveAuction.featuredPlayer.basePrice)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Top bidder</p>
            <p className="font-medium">@{liveAuction.topBidder}</p>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <PlaceBidButton amount={liveAuction.nextMinBid} onConfirm={onPlaceBid} />
          <button className="btn btn-ghost rounded-xl py-2">Watch</button>
        </div>

        <div className="mt-3 text-xs text-slate-400">Room: <span className="font-medium">#{liveAuction.room}</span></div>
      </div>

      <LiveTicker />
    </motion.div>
  );
}

function TeamCard({ team, onRequestTrade }) {
  return (
    <div className="p-3 rounded-xl bg-slate-900/30 border border-slate-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{team.name}</p>
          <p className="text-xs text-slate-400">Players: {team.players.length}</p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {team.players.map((p) => (
          <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40">
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-slate-400">{p.role} • {`₹ ${(p.value/100).toLocaleString()}`}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => onRequestTrade(p)} className="btn btn-sm btn-outline">Request trade</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowToPlay() {
  return (
    <div id="how-to-play" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
      <div className="lg:col-span-7">
        <h3 className="text-3xl font-extrabold">How to play — in 4 steps</h3>
        <p className="mt-3 text-slate-300 max-w-prose">A sleek, social auction flow with AI-powered simulations. Create a room, share the code, pick your team and run simulations with GPT to practice or decide winners.</p>

        <div className="mt-8 space-y-4">
          <HowStep idx={1} title="Create room" copy="Tap Create Room, choose draft settings (league, budgets, foreign counts)." icon={<Code className="w-6 h-6" />} />
          <HowStep idx={2} title="Share code & invite" copy="Share a short room code or link — teammates join in seconds." icon={<Share2 className="w-6 h-6" />} />
          <HowStep idx={3} title="Draft your dream team" copy="Take turns or auto-draft — manage budgets and preferences." icon={<Users className="w-6 h-6" />} />
          <HowStep idx={4} title="Ask GPT & simulate" copy="Ask any GPT to run auction simulations or predict outcomes — then run a final live auction and declare winners." icon={<Cpu className="w-6 h-6" />} />
        </div>
      </div>

      <div className="lg:col-span-5">
        <div className="rounded-3xl p-6 bg-gradient-to-br from-slate-900/40 to-slate-800/40 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-300 font-semibold">Demo Room</p>
              <h4 className="font-semibold text-lg">Room • CODE: APL-9X2</h4>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-400">Players joined</p>
              <p className="font-semibold">4/8</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <div className="p-3 rounded-xl bg-slate-900/40 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Draft Mode: Round-based</p>
                <p className="text-xs text-slate-400">Budget: ₹ 5 Cr • Reserve: ₹ 25 Lakh</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Next pick</p>
                <p className="font-semibold">@SkyBound</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/30 text-sm text-slate-300">
              <p className="font-medium">GPT Simulation</p>
              <p className="mt-2 text-xs">"Simulate 100 auction runs with current budgets and show the most likely winners."</p>
            </div>

            <div className="flex gap-2">
              <button className="btn btn-success flex-1 rounded-xl py-2">Run simulation</button>
              <button className="btn btn-ghost rounded-xl py-2">Share room</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Trade Section (in-page detailed) ---------------- */
function TradeSection({ teams, prefill, fmtINR }) {
  // in-page trade state
  const [selectedTarget, setSelectedTarget] = useState(prefill?.player || null);
  const [targetFrom, setTargetFrom] = useState(prefill?.fromTeam || null);
  const [offeredPlayerId, setOfferedPlayerId] = useState('');
  const [offeredCash, setOfferedCash] = useState(0);
  const [status, setStatus] = useState('idle'); // idle | sent | accepted | rejected
  const [log, setLog] = useState([]);

  useEffect(() => {
    if (prefill) {
      setSelectedTarget(prefill.player);
      setTargetFrom(prefill.fromTeam);
    }
  }, [prefill]);

  function sendOffer() {
    if (!selectedTarget || (!offeredPlayerId && offeredCash <= 0)) {
      setLog((l) => [...l, { t: Date.now(), m: 'Please offer a player, cash or both.' }]);
      return;
    }

    setStatus('sent');
    setLog((l) => [...l, { t: Date.now(), m: `Offer sent for ${selectedTarget.name}.` }]);

    // demo acceptance logic: if offeredCash >= 3000000 or offeredPlayerId present => accept
    const willAccept = offeredPlayerId || offeredCash >= 3000000;
    setTimeout(() => {
      setStatus(willAccept ? 'accepted' : 'rejected');
      setLog((l) => [...l, { t: Date.now(), m: willAccept ? 'Offer accepted.' : 'Offer rejected.' }]);
    }, 1200);
  }

  function animateAndApplyTrade() {
    // in a real app: call server to swap rosters, emit websockets, etc.
    setLog((l) => [...l, { t: Date.now(), m: 'Applying trade (demo).' }]);
    // animate visually: we simply transition status to accepted and show flying animation placeholder
  }

  const allPlayers = teams.flatMap((t) => t.players.map((p) => ({ ...p, team: t })));

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/40 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-emerald-300 font-semibold">Trade Center</p>
          <h3 className="text-xl font-semibold">Request / Manage Trades</h3>
        </div>

        <div className="text-sm text-slate-400">Offer players, cash or both. See demo responses below.</div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Select target */}
        <div className="col-span-1">
          <p className="text-xs text-slate-400">Target player</p>
          <div className="mt-3 space-y-2">
            {teams.map((t) => (
              <div key={t.id} className="p-2 rounded-lg bg-slate-900/30">
                <p className="font-medium">{t.name}</p>
                <div className="mt-2 space-y-1">
                  {t.players.map((p) => (
                    <button key={p.id} onClick={() => { setSelectedTarget(p); setTargetFrom(t); }} className={`w-full text-left p-2 rounded ${selectedTarget?.id === p.id ? 'bg-emerald-500/10 border border-emerald-500' : 'bg-slate-900/20'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-slate-400">{p.role}</p>
                        </div>
                        <div className="text-xs">{fmtINR(p.value)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Middle: Build offer */}
        <div className="col-span-1">
          <p className="text-xs text-slate-400">Your offer</p>
          <div className="mt-3 p-4 rounded-lg bg-slate-900/30">
            <p className="text-sm">Offer a player from your roster</p>
            <select className="w-full mt-2 rounded-lg p-2 bg-slate-900/20" value={offeredPlayerId} onChange={(e) => setOfferedPlayerId(e.target.value)}>
              <option value="">-- Select one --</option>
              {allPlayers.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.team.name}</option>
              ))}
            </select>

            <p className="text-sm mt-4">Offer cash (paise)</p>
            <input type="number" className="w-full mt-2 rounded-lg p-2 bg-slate-900/20" placeholder="e.g. 3000000" value={offeredCash} onChange={(e) => setOfferedCash(Number(e.target.value))} />

            <div className="mt-4 flex gap-2">
              <button onClick={sendOffer} className="btn btn-primary flex-1">Send Offer</button>
              <button onClick={() => { setOfferedPlayerId(''); setOfferedCash(0); }} className="btn btn-ghost">Reset</button>
            </div>

            <div className="mt-3 text-xs text-slate-400">Tip: you can offer a player, cash or both. The receiving team may accept, reject or propose a counter (demo uses simple rules).</div>
          </div>
        </div>

        {/* Right: Status & logs */}
        <div className="col-span-1">
          <p className="text-xs text-slate-400">Status</p>
          <div className="mt-3 p-4 rounded-lg bg-slate-900/30">
            <div className="mb-3">
              <p className="text-sm font-medium">Selected target</p>
              {selectedTarget ? (
                <div className="mt-2">
                  <p className="font-semibold">{selectedTarget.name}</p>
                  <p className="text-xs text-slate-400">From: {targetFrom?.name}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-400">No target selected</p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium">Current offer</p>
              <div className="mt-2 text-xs text-slate-300">
                <p>Player: {offeredPlayerId ? allPlayers.find(p => p.id === offeredPlayerId)?.name : '—'}</p>
                <p>Cash: {offeredCash ? fmtINR(offeredCash) : '—'}</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm font-medium">Result</p>
              <div className="mt-2">
                <StatusPill status={status} />
                <AnimatePresence>
                  {status === 'accepted' && (
                    <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-3 p-3 rounded bg-emerald-900/20">
                      <p className="font-semibold">Accepted — trade applied (demo)</p>
                      <button onClick={animateAndApplyTrade} className="mt-2 btn btn-success btn-sm">Animate trade</button>
                    </motion.div>
                  )}

                  {status === 'rejected' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 p-3 rounded bg-rose-900/20">
                      <p className="font-semibold">Rejected</p>
                      <p className="text-xs text-slate-400">Consider increasing cash or offering a player.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm font-medium">Activity log</p>
              <div className="mt-2 max-h-40 overflow-auto text-xs">
                {log.length === 0 ? <p className="text-slate-400">No activity yet.</p> : log.map((e, i) => (
                  <div key={i} className="py-1 border-b border-slate-800/30"><small>{new Date(e.t).toLocaleTimeString()}</small> — {e.m}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Animated playground: show a small visual when offer accepted (demo 'fly' animation) */}
      <div className="mt-6">
        <TradeAnimation status={status} selectedTarget={selectedTarget} offeredPlayer={allPlayers.find(p => p.id === offeredPlayerId)} />
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    idle: { label: 'Idle', cls: 'bg-slate-800/40' },
    sent: { label: 'Sent', cls: 'bg-amber-700/20' },
    accepted: { label: 'Accepted', cls: 'bg-emerald-600/20' },
    rejected: { label: 'Rejected', cls: 'bg-rose-600/20' },
  };
  const s = map[status] || map.idle;
  return <span className={`inline-block px-3 py-1 rounded ${s.cls} text-xs font-medium`}>{s.label}</span>;
}

function TradeAnimation({ status, selectedTarget, offeredPlayer }) {
  // simple placeholder animation: when accepted, show two cards and animate the offered player moving to the target team
  return (
    <div className="relative h-36">
      <div className="absolute left-6 top-6 w-40 p-3 rounded-lg bg-slate-900/30 border border-slate-700">
        <p className="text-xs text-slate-400">From</p>
        <p className="font-semibold">{offeredPlayer ? offeredPlayer.team.name : 'Your team'}</p>
        <p className="text-xs">{offeredPlayer ? offeredPlayer.name : '—'}</p>
      </div>

      <div className="absolute right-6 top-6 w-40 p-3 rounded-lg bg-slate-900/30 border border-slate-700 text-right">
        <p className="text-xs text-slate-400">To</p>
        <p className="font-semibold">{selectedTarget ? (selectedTarget.team ? selectedTarget.team.name : 'Target team') : 'Target team'}</p>
        <p className="text-xs">{selectedTarget ? selectedTarget.name : '—'}</p>
      </div>

      {status === 'accepted' && offeredPlayer && selectedTarget && (
        <motion.div initial={{ left: 24, top: 80, opacity: 0 }} animate={{ left: '60%', top: 12, opacity: 1 }} transition={{ duration: 0.9 }} className="absolute w-32 p-2 rounded bg-emerald-700/10 border border-emerald-500">
          <p className="font-medium text-sm">{offeredPlayer.name}</p>
          <p className="text-xs text-slate-400">Moving →</p>
        </motion.div>
      )}
    </div>
  );
}

/* ---------------- About ---------------- */
function About() {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/40 p-6">
      <h3 className="text-2xl font-semibold">About AuctionPlay</h3>
      <p className="mt-3 text-slate-300 max-w-prose">AuctionPlay is a modern, auditable auction platform built for leagues, teams and superfans who care about fairness, transparency and speed. We combine:</p>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MiniStat label="Fast & Real-time" value="<50ms" icon={<TrendingUp className="w-5 h-5" />} />
        <MiniStat label="Auditable Receipts" value="Downloadable" icon={<Award className="w-5 h-5" />} />
        <MiniStat label="Upcoming" value="Ai Simulation" icon={<Cpu className="w-5 h-5" />} />
      </div>

      <div className="mt-4 text-slate-300">
        <p className="font-semibold">Key principles</p>
        <ul className="list-disc list-inside mt-2 text-slate-400">
          <li>Fair play: anti-sniping auto-extend to protect last-second bidders.</li>
          <li>Transparency: full bid history and receipts for audits and disputes.</li>
          <li>Flexibility: run classic auctions, round drafts, or hybrid formats with reserves and budget caps.</li>
        </ul>

        <p className="mt-3">Whether you're running a friendly league or a serious draft, AuctionPlay aims to make auctions accessible, fair and fun. Use Host to configure rules, or ask a GPT to simulate outcomes before you finalize your picks.</p>
      </div>
    </div>
  );
}

/* ---------------- Small helpers & shared components ---------------- */
function PlaceBidButton({ amount, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex-1">
      <AnimatePresence>
        {!confirming ? (
          <motion.button initial={{ scale: 0.98 }} animate={{ scale: 1 }} whileTap={{ scale: 0.98 }} className="btn btn-success flex-1 rounded-xl py-2" onClick={() => setConfirming(true)} aria-label={`Place bid ${amount}`}>
            Place Bid
          </motion.button>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2">
            <button onClick={() => { onConfirm(); setConfirming(false); }} className="btn btn-success/80 flex-1 rounded-xl py-2">Confirm</button>
            <button onClick={() => setConfirming(false)} className="btn btn-ghost rounded-xl py-2">Cancel</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Countdown({ end }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const diff = Math.max(0, end - now);
  const mm = Math.floor(diff / 60000);
  const ss = Math.floor((diff % 60000) / 1000);

  return (
    <time dateTime={new Date(end).toISOString()} aria-live="polite">{mm}m {String(ss).padStart(2, '0')}s</time>
  );
}

function LiveTicker() {
  const entries = [
    { msg: 'Rohit Sharma won for ₹2.4 Cr by @SkyBound' },
    { msg: 'Auto-extend triggered — 10s added' },
    { msg: '@BlueWave increased bid to ₹3.6 Cr' },
  ];

  return (
    <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-slate-300">
      <div className="p-2 rounded-md bg-slate-900/40">
        <p className="font-medium">Auction Ticker</p>
        <div className="mt-2 space-y-1">
          {entries.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-emerald-300">•</span>
              <span>{e.msg}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-2 rounded-md bg-slate-900/40 text-xs flex items-center justify-between">
        <div>
          <p className="font-medium">Top 3 Spenders</p>
          <ol className="mt-1 leading-5">
            <li>1. @SkyBound — ₹4.2 Cr</li>
            <li>2. @BlueWave — ₹3.6 Cr</li>
            <li>3. @NightOwls — ₹2.9 Cr</li>
          </ol>
        </div>

        <div className="text-right">
          <p className="text-xs text-slate-400">Fast facts</p>
          <p className="text-xs">Auto-extend • Audit logs • Receipts</p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, copy, icon }) {
  return (
    <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-emerald-500/10">{icon}</div>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-slate-400 text-sm mt-1">{copy}</p>
        </div>
      </div>
    </div>
  );
}

function HowStep({ idx, title, copy, icon }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-400 flex items-center justify-center font-bold">{idx}</div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-slate-400 mt-1">{copy}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon }) {
  return (
    <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-700 flex items-center gap-3">
      <div className="p-2 rounded-md bg-emerald-500/10">{icon}</div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}

function StatusPillSmall({ status }) {
  const map = {
    idle: { label: 'Idle', cls: 'bg-slate-800/40' },
    sent: { label: 'Sent', cls: 'bg-amber-700/20' },
    accepted: { label: 'Accepted', cls: 'bg-emerald-600/20' },
    rejected: { label: 'Rejected', cls: 'bg-rose-600/20' },
  };
  const s = map[status] || map.idle;
  return <span className={`inline-block px-2 py-1 rounded ${s.cls} text-xs font-medium`}>{s.label}</span>;
}

function TradeAnimationPlaceholder() {
  return (
    <div className="p-4 rounded bg-slate-900/30 border border-slate-700 text-center text-sm text-slate-400">Trade animation will play here on accept.</div>
  );
}

/* ----------------- End ----------------- */