/* eslint-disable no-unused-vars */
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "../socket";
import {
  Copy,
  Users,
  Coins,
  Globe2,
  Trophy,
  UserPlus,
  BookOpen,
  Layers,
  DollarSign,
  List,
  ArrowRightCircle,
} from "lucide-react";
import Alert from "../components/Alert";

export default function RoomLobby() {
  const { roomCode } = useParams();
  const [players, setPlayers] = useState([]);
  const [creator, setCreator] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(0);
  const [budget, setBudget] = useState("");
  const [maxForeign, setMaxForeign] = useState("");
  const [league, setLeague] = useState("");
  const [maxPlayersPerTeam, setMaxPlayersPerTeam] = useState("");
  const navigate = useNavigate();
  const playerName = localStorage.getItem("playerName");
  const [copy, setCopy] = useState(false);

  // Alert state
  const [alertMsg, setAlertMsg] = useState(null);
  const [alertType, setAlertType] = useState("info");

  useEffect(() => {
    if (playerName && roomCode) {
      socket.emit("rejoin-room", { roomCode, playerName });
    }

    socket.emit("get-room-info", { roomCode });

    const onRoomInfo = ({
      creator,
      maxPlayers,
      budget,
      maxForeignPlayers,
      league,
      totalPlayersPerTeam,
    }) => {
      setCreator(creator);
      setMaxPlayers(maxPlayers);
      setBudget(budget);
      setMaxForeign(maxForeignPlayers);
      setMaxPlayersPerTeam(totalPlayersPerTeam);
      setLeague(league);
    };

    const onPlayerList = (list) => {
      setPlayers(list);
    };

    const onGameStarted = () => {
      setAlertType("success");
      setAlertMsg("🏏 Auction starting... Get ready!");
      // wait briefly before navigation so user sees the alert
      setTimeout(() => {
        navigate(`/auction/${roomCode}`);
      }, 1200);
    };

    const onStartError = ({ reason }) => {
      setAlertType("error");
      setAlertMsg(reason || "Failed to start auction.");
    };

    socket.on("room-info", onRoomInfo);
    socket.on("player-list", onPlayerList);
    socket.on("game-started", onGameStarted);
    socket.on("start-error", onStartError);

    // defensive: if no room info arrives after some time, show a warning
    const infoTimeout = setTimeout(() => {
      if (!creator && !league && players.length === 0) {
        setAlertType("warning");
        setAlertMsg("Unable to fetch room info — try refreshing.");
      }
    }, 2500);

    return () => {
      socket.off("room-info", onRoomInfo);
      socket.off("player-list", onPlayerList);
      socket.off("game-started", onGameStarted);
      socket.off("start-error", onStartError);
      clearTimeout(infoTimeout);
    };
  }, [roomCode, navigate, playerName, creator, players.length, league]);

  const handleStart = () => {
    const isRoomFull = players.length === maxPlayers;
    const isCreator =
      playerName?.trim().toLowerCase() === creator?.trim().toLowerCase();

    if (!isCreator) {
      setAlertType("warning");
      setAlertMsg("Only the host can start the auction.");
      return;
    }

    if (!isRoomFull) {
      setAlertType("warning");
      setAlertMsg("Cannot start: not all teams have joined yet.");
      return;
    }

    socket.emit("start-game", { roomCode });
    setAlertType("info");
    setAlertMsg("Starting auction...");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopy(true);
      setTimeout(() => {
        setCopy(false);
      }, 2000);
    } catch (err) {
      setAlertType("error");
      setAlertMsg("Failed to copy room code.");
    }
  };

  const isRoomFull = players.length === maxPlayers;
  const isCreator =
    playerName?.trim().toLowerCase() === creator?.trim().toLowerCase();

  // number of players still needed
  const remaining = Math.max(0, (Number(maxPlayers) || 0) - players.length);

  return (
    <div className="min-h-screen  bg-bg flex items-center justify-center p-6">
      {/* Global Alert */}
      {alertMsg && (
        <Alert
          type={alertType}
          message={alertMsg}
          duration={3000}
          onClose={() => setAlertMsg(null)}
          position="top"
        />
      )}

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Lobby card */}
        <div className="md:col-span-2 bg-surface rounded-2xl p-6 shadow-2xl border border-white/6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-heading text-white">Room Lobby</h1>
              <p className="text-sm text-white/80 mt-1">
                Hello <span className="font-semibold">{playerName}</span> — get
                ready for an exciting auction.
              </p>
            </div>

            <div className="flex flex-col items-end text-right">
              <div className="text-xs text-white/60">Players</div>
              <div className="text-lg font-bold text-highlight">
                {players.length}/{maxPlayers || "—"}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleCopy}
                  className="px-3 py-1 rounded-md bg-highlight/95 text-black text-sm font-semibold shadow-sm"
                  title={copy ? "Copied" : "Copy"}
                >
                  {copy ? "Copied" : "Copy Code"}
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(window.location.href)}
                  className="px-3 py-1 rounded-md bg-white/5 text-white/90 text-sm"
                  title="Copy URL"
                >
                  Share Link
                </button>
              </div>
            </div>
          </div>

          {/* top stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <StatCard icon={<Users size={16} />} label="Joined" value={`${players.length}`} />
            <StatCard icon={<Coins size={16} />} label="Budget" value={budget || "—"} />
            <StatCard icon={<Globe2 size={16} />} label="Foreign" value={maxForeign || "—"} />
            <StatCard icon={<Trophy size={16} />} label="League" value={league || "—"} />
          </div>

          {/* Player list + drawer note */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white/5 rounded-xl p-3 max-h-56 overflow-auto">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Joined Teams</h3>
                <div className="text-xs text-white/60">Room: <span className="font-mono ml-1">{roomCode}</span></div>
              </div>

              {players.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {players.map((p, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between p-2 rounded-md bg-white/4 border border-white/6"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/10 to-white/6 flex items-center justify-center font-semibold text-sm">{p.name?.charAt(0)?.toUpperCase()}</div>
                        <div>
                          <div className="text-sm font-medium">{p.name}</div>
                          <div className="text-[11px] text-white/60">Team</div>
                        </div>
                      </div>

                      {p.name === creator && (
                        <span className="text-[11px] text-highlight font-semibold">Host</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-white/60 italic text-sm">No teams yet — share the room code to invite friends.</p>
              )}
            </div>

            <div className="bg-white/5 rounded-xl p-3">
              <h4 className="text-sm font-semibold mb-2">Players Drawer</h4>
              <p className="text-xs text-white/60">A separate drawer in the auction will show all available players and filters (Batters, Bowlers, Allrounders). This lobby only shows joined teams — no player models are created here.</p>

              <div className="mt-3 space-y-2">
                <SmallStat label="Max Teams" value={maxPlayers || "—"} />
                <SmallStat label="Per Team" value={maxPlayersPerTeam || "—"} />
                <SmallStat label="Budget" value={budget || "—"} />
              </div>
            </div>
          </div>

          {/* Waiting / start area */}
          {remaining > 0 && (
            <div className="mt-6 p-3 rounded-lg bg-white/5 border border-white/6 flex items-center gap-3">
              <svg className="w-6 h-6 animate-spin text-highlight" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>

              <div className="flex-1 text-sm">
                <div className="font-semibold">Waiting for players</div>
                <div className="text-xs text-white/60">{remaining} more {remaining === 1 ? "player" : "players"} needed</div>
              </div>

              <div className="text-xs text-white/60">{isCreator ? "You can start when full" : "Please wait for host"}</div>
            </div>
          )}

          {/* Start button or hint */}
          <div className="mt-6 flex items-center justify-between gap-4">
            {isRoomFull && isCreator ? (
              <div className="flex gap-3">
                <button onClick={handleStart} className="btn btn-wide bg-highlight text-black font-semibold hover:scale-105 transition-all duration-200 px-6 py-2 rounded-lg">
                  <ArrowRightCircle className="mr-2" /> Start Auction
                </button>
                <button onClick={() => navigate(`/auction/${roomCode}`)} className="px-4 py-2 rounded-lg bg-white/5 text-white/90">Preview Auction</button>
              </div>
            ) : (
              <div className="text-xs text-white/60">{isCreator ? "Waiting for all teams to join…" : "Please wait for the host to start the auction."}</div>
            )}

            <div className="text-right text-xs text-white/60">Creator: <span className="font-semibold text-white">{creator || "—"}</span></div>
          </div>
        </div>

        {/* Right: Info / Rules / Features */}
        <aside className="space-y-4">
          <div className="bg-surface rounded-2xl p-4 border border-white/6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Upcoming Auction</h3>
                <p className="text-xs text-white/60 mt-1">A quick overview of rules, features and tips before the auction begins.</p>
              </div>
              <div className="text-sm text-highlight font-semibold">Ready</div>
            </div>

            <div className="mt-3 space-y-3">
              <RuleItem icon={<BookOpen size={16} />} title="Game Rules">
                <ul className="list-disc ml-4 text-xs text-white/70">
                  <li>No team creation happens here — players will pick from the auction drawer.</li>
                  <li>Each team has a fixed budget and foreign-player limit.</li>
                  <li>Host can start the auction only when all teams have joined.</li>
                </ul>
              </RuleItem>

              <RuleItem icon={<Layers size={16} />} title="Features">
                <div className="text-xs text-white/70">
                  • Trade requests: offer cash or swap with another player via a request system during the auction.
                  <br />• Budget strategy: plan how to split your budget — early bidding vs late value grabs.
                  <br />• Separate players drawer: use filters (Role / Team / Base price) in the auction view.
                </div>
              </RuleItem>

              <RuleItem icon={<DollarSign size={16} />} title="Bid Increments">
                <div className="text-xs text-white/70">
                  Bid increments change with the current price:
                  <ul className="ml-4 list-disc mt-2">
                    <li>0 — 10cr : increment 0.5cr</li>
                    <li>10 — 20cr : increment 1cr</li>
                    <li>20cr+ : increment 2cr</li>
                  </ul>
                </div>

                <div className="mt-3">
                  <IncrementBar />
                </div>
              </RuleItem>

              <RuleItem icon={<List size={16} />} title="Quick Tips">
                <div className="text-xs text-white/70">
                  • Keep some budget reserved for late surprises.
                  <br />• Don't exceed foreign-player limit when bidding.
                  <br />• Use trade requests to improve squad balance — trades require both parties to accept.
                </div>
              </RuleItem>

              <div className="mt-3 text-center">
                <button onClick={() => navigate(`/auction/${roomCode}`)} className="w-full px-4 py-2 rounded-lg bg-highlight/95 font-semibold text-black">See Auction Preview</button>
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl p-4 border border-white/6">
            <h4 className="text-sm font-semibold">Budget Planner</h4>
            <p className="text-xs text-white/60 mt-2">A simple suggested split to consider before auction:</p>
            <ol className="list-decimal ml-5 mt-2 text-xs text-white/70">
              <li>Star players (2-3) — 50% of budget</li>
              <li>Core players (6-8) — 35% of budget</li>
              <li>Bench & fillers — 15% of budget</li>
            </ol>
          </div>

          <div className="bg-white/5 rounded-2xl p-4 border border-white/6 text-xs text-white/70">
            <div className="flex items-center justify-between">
              <div>Max Foreign</div>
              <div className="font-semibold">{maxForeign || "—"}</div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div>Total Players / Team</div>
              <div className="font-semibold">{maxPlayersPerTeam || "—"}</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------- Small helper components inside the same file for readability ---------- */

function StatCard({ icon, label, value }) {
  return (
    <div className="p-3 rounded-xl bg-white/4 border border-white/6 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-white/6 flex items-center justify-center">{icon}</div>
      <div>
        <div className="text-sm font-semibold">{value}</div>
        <div className="text-xs text-white/60">{label}</div>
      </div>
    </div>
  );
}

function SmallStat({ label, value }) {
  return (
    <div className="flex items-center justify-between text-xs text-white/70">
      <div>{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function RuleItem({ icon, title, children }) {
  return (
    <div className="p-3 bg-white/5 rounded-lg border border-white/6">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-md bg-white/6 flex items-center justify-center">{icon}</div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-2 text-xs">{children}</div>
        </div>
      </div>
    </div>
  );
}

function IncrementBar() {
  // purely presentational. no logic/state needed here.
  return (
    <div className="w-full bg-white/6 rounded-lg p-2">
      <div className="text-[11px] text-white/70 mb-2">Price bands & increments</div>
      <div className="flex gap-2 text-[11px]">
        <Band label="0 - 10cr" note="+0.5cr" />
        <Band label="10 - 20cr" note="+1cr" />
        <Band label="20+" note="+2cr" />
      </div>
    </div>
  );
}

function Band({ label, note }) {
  return (
    <div className="flex-1 bg-white/4 p-2 rounded-md border border-white/6 text-center">
      <div className="font-semibold text-sm">{label}</div>
      <div className="text-[11px] text-white/60 mt-1">{note}</div>
    </div>
  );
}
