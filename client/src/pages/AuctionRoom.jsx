/* eslint-disable no-empty */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from "react";
// import { useNavigate, useParams } from "react-router-dom";
import { useParams, useNavigate } from "react-router-dom";

import socket from "../socket";
import axios from "axios";
import { API_BASE_URL } from "../config";
import PlayerCard from "../components/PlayerCard";
import AnimateBudget from "../components/AnimateBudget";
import ChatBox from "../components/ChatBox.jsx";
import PlayerStats from "../components/PlayerStats.jsx";
import OtherBudgetsModal from "../components/OtherBudgetsModal.jsx";
import AllTeamsModal from "../components/AllTeamsModal";
import SquadDrawer from "../components/SquadDrawer.jsx";
import { Menu } from "lucide-react";
import { CircleDollarSign, IndianRupee } from "lucide-react";
import { Repeat } from "lucide-react";
import { Crown } from "lucide-react";
import TopPaidModal from "../components/TopPaidModal";
import LiveBidBox from "../components/LiveBidBox.jsx";
import HintButton from "../components/HintButton.jsx";
import WikiPlayerStats from "../components/WikiPlayerStats.jsx";
// import AuctionSimulationRunner from "../components/AuctionSimulationRunner.jsx";

function AuctionRoom() {
  const { roomCode } = useParams();
  const [player, setPlayer] = useState(null);
  const [bid, setBid] = useState(0);
  const [bidder, setBidder] = useState(null);
  const [timer, setTimer] = useState(20);
  const [auctionEnded, setAuctionEnded] = useState(false);
  const [showSquad, setShowSquad] = useState(false);
  const [team, setTeam] = useState([]);
  const [remainingBudget, setRemainingBudget] = useState(null);
  const [totalPlayersPerTeam, setTotalPlayersPerTeam] = useState(null);
  const [room, setRoom] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [topPlayers, setTopPlayers] = useState([]);
  const [passDisabled, setPassDisabled] = useState(false);
  const [passDisableRemaining, setPassDisableRemaining] = useState(0); // seconds remaining
  const passTimerRef = useRef(null); // interval id
  const soldTimerRef = useRef(null);
  const [soldInfo, setSoldInfo] = useState(null); // { name, winner, price, expiresAt }
  const [pendingNextPlayer, setPendingNextPlayer] = useState(null);
  const SOLD_DISPLAY_MS = 2200;
  const soldTimeoutRef = useRef(null);
  const allTeamsModalRef = useRef(null);
  const navigate = useNavigate();

  // const navigate = useNavigate();
  const [playerName, setPlayerName] = useState(
    localStorage.getItem("playerName") || ""
  );
  const showChatRef = useRef(showChat);
  const lastSeenCountRef = useRef(0);

  // helper normalization (put once at top of file where handlers live)
  // put near your other helpers (top of file)
  const normalizePlayer = (p) => {
    if (!p) return null;
    const player = { ...p };

    // stats: accept STATS | stats | Stats
    player.stats = player.stats ?? player.STATS ?? player.Stats ?? {};

    // canonical best fields
    player.best = player.best ?? player.BEST ?? player.Best ?? null;
    player.bestBatting =
      player.bestBatting ?? player.BEST_BATTING ?? player.BestBatting ?? null;
    player.bestBowling =
      player.bestBowling ?? player.BEST_BOWLING ?? player.BestBowling ?? null;

    // other canonical fields
    player.playerStyle = player.playerStyle ?? player.PLAYER_STYLE ?? null;
    player.playerType = player.playerType ?? player.PLAYER_TYPE ?? null;
    player.basePrice = player.basePrice ?? player.BASE_PRICE ?? 0;
    player.price = player.price ?? player.PRICE ?? player.basePrice ?? 0;

    player.name = String(player.name ?? player.NAME ?? "");
    player.role = player.role ?? player.ROLE ?? "";
    player.nation = player.nation ?? player.NATION ?? "";

    return player;
  };

  useEffect(() => {
    if (playerName) {
      localStorage.setItem("playerName", playerName);
    }
  }, [playerName]);

  useEffect(() => {
    // console.log("💰 Remaining Budget:", remainingBudget);
    // console.log("👥 Total Players Per Team:", totalPlayersPerTeam);
  }, [remainingBudget, totalPlayersPerTeam]);

  const fetchTeam = () => {
    axios
      .get(`${API_BASE_URL}/api/room/${roomCode}`)
      .then((res) => {
        // console.log("✅ Response received:", res.data);
        const roomData = res.data;
        setRoom(roomData); // ✅ Store full room object
        if (!roomData || !Array.isArray(roomData.players)) {
          setTeam([]);
          setRemainingBudget(0);
          return;
        }

        const myPlayer = roomData.players.find(
          (p) => p.name.trim().toLowerCase() === playerName.trim().toLowerCase()
        );

        // console.log("📦 Room Data:", roomData);
        // console.log("📦 Players:", roomData.players);
        // console.log("🙍‍♂️ My Player Name:", playerName);

        if (!myPlayer) {
          setTeam([]);
          setRemainingBudget(0);
          return;
        }

        setTeam(Array.isArray(myPlayer.team) ? myPlayer.team : []);
        setRemainingBudget(Number(myPlayer?.budget ?? roomData.budget ?? 0));
        setTotalPlayersPerTeam(Number(roomData?.totalPlayersPerTeam ?? 0));
        // console.log(myPlayer);
      })
      .catch((err) => {
        console.error("❌ fetchTeam error:", err);
        setTeam([]);
        setRemainingBudget(0);
      });
  };
  const saveAuctionState = (state) => {
    localStorage.setItem("auctionState", JSON.stringify(state));
  };

  // 🔹 Load last known auction state from localStorage
  const loadAuctionState = () => {
    const saved = localStorage.getItem("auctionState");
    if (saved) {
      const { player, bid, bidder, timer } = JSON.parse(saved);
      setPlayer(player);
      setBid(bid);
      setBidder(bidder);
      setTimer(timer);
    }
  };

  const fetchAuctionState = () => {
    axios
      .get(`${API_BASE_URL}/api/room/${roomCode}`)
      .then((res) => {
        const room = res.data;
        if (!room) return;
        setPlayer(room.currentPlayer || null);
        setBid(room.bid || 0);
        setBidder(room.bidder || null);
        setTimer(room.timer || 20);
        setAuctionEnded(room.auctionEnded || false);
      })
      .catch(() => {});
  };

  const checkRoomState = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/room/${roomCode}/state`);

      if (res.data.auctionEnded) {
        setAuctionEnded(true);
        setPlayer(null);
        setBid(0);
        setBidder(null);
        setTimer(0);
        return; // stop further actions
      }

      // Auction ongoing → safe to rejoin
      if (playerName && roomCode) {
        socket.emit("rejoin-room", { roomCode, playerName });
      }

      // Update current auction state
      setPlayer(res.data.currentPlayer);
      setBid(res.data.bid);
      setBidder(res.data.bidder);
      setTimer(res.data.timer);
    } catch (err) {
      console.error("Error fetching room state:", err);
    }
  };

  useEffect(() => {
    loadAuctionState();
    checkRoomState();
    fetchTeam();
    fetchAuctionState();

    const handleTeamData = (payload) => {
      // Support both old array-only payload and new { team, budget } payload
      if (Array.isArray(payload)) {
        setTeam(payload);
        // no budget provided — keep existing remainingBudget
        return;
      }
      if (payload && typeof payload === "object") {
        setTeam(Array.isArray(payload.team) ? payload.team : []);
        setRemainingBudget(Number(payload.budget) || 0);
        // console.log("🔁 team-data received:", payload);
      }
    };

    // NEW handleNewPlayer — replaces your existing handler
    const handleNewPlayer = ({
      player: nextPlayer,
      bid: nextBid,
      bidder: nextBidder,
      timer: nextTimer,
    }) => {
      const normPlayer = normalizePlayer(nextPlayer);

      // debug: inspect incoming shape (remove in production)
      // console.log("socket -> new-player payload:", {
      //   nextPlayer,
      //   normPlayer,
      //   nextBid,
      //   nextBidder,
      //   nextTimer,
      // });

      // if a sold badge is currently being shown, queue this nextPlayer
      if (soldInfo) {
        // replace any previously queued player (only one at a time needed)
        setPendingNextPlayer({
          player: normPlayer,
          bid: nextBid,
          bidder: nextBidder,
          timer: nextTimer,
        });
        // console.log(
        //   "Queued next player because soldInfo active:",
        //   normPlayer?.name
        // );
        return;
      }

      // otherwise show immediately
      setPlayer(normPlayer);
      setBid(nextBid ?? 0);
      setBidder(nextBidder ?? null);
      setTimer(nextTimer ?? 20);

      // persist a small auction snapshot (optional)
      saveAuctionState({
        player: normPlayer,
        bid: nextBid ?? 0,
        bidder: nextBidder ?? null,
        timer: nextTimer ?? 20,
      });

      // console.log("Showing new player immediately:", normPlayer?.name);
    };

    const handleBidUpdate = ({ bid, bidder, timer }) => {
      setBid(bid);
      setBidder(bidder);
      setTimer(timer);
      const saved = JSON.parse(localStorage.getItem("auctionState")) || {};
      saveAuctionState({ ...saved, bid, bidder, timer });
    };

    // put these near top of component (you already have them)

    // inside your useEffect where you wire socket handlers:
    const handlePlayerSold = ({ player: soldPlayer, winner }) => {
      // defensive guards
      if (!soldPlayer || !soldPlayer.name) {
        // console.warn("handlePlayerSold: invalid payload", soldPlayer, winner);
        return;
      }

      // PASS disable logic (your existing behavior)
      const DISABLE_MS = 2000;
      setPassDisabled(true);
      setPassDisableRemaining(Math.ceil(DISABLE_MS / 1000));
      if (passTimerRef.current) {
        clearTimeout(passTimerRef.current);
        passTimerRef.current = null;
      }
      passTimerRef.current = setTimeout(() => {
        setPassDisabled(false);
        setPassDisableRemaining(0);
        passTimerRef.current = null;
      }, DISABLE_MS);

      // normalize winner & determine unsold
      const winnerNormalized =
        typeof winner === "string" ? winner.trim() : winner;
      const isUnsold =
        !winnerNormalized ||
        String(winnerNormalized).trim().length === 0 ||
        ["no one", "unsold"].includes(String(winnerNormalized).toLowerCase());

      const soldTo = isUnsold ? "No one" : winnerNormalized;
      const price = soldPlayer.price ?? null;
      const name = String(soldPlayer.name).trim();

      // Show sold badge immediately by setting soldInfo
      setSoldInfo({ name, winner: soldTo, price, ts: Date.now() });

      // Clear any previously scheduled sold timer
      if (soldTimerRef.current) {
        clearTimeout(soldTimerRef.current);
        soldTimerRef.current = null;
      }

      // Keep badge visible for SOLD_DISPLAY_MS, then clear and show queued next player
      soldTimerRef.current = setTimeout(() => {
        setSoldInfo(null);
        soldTimerRef.current = null;

        // If parent queued a next player while sold badge was visible, dequeue it now
        if (pendingNextPlayer) {
          setPlayer(normalizePlayer(pendingNextPlayer.player) ?? null);
          setBid(pendingNextPlayer.bid ?? 0);
          setBidder(pendingNextPlayer.bidder ?? null);
          setTimer(pendingNextPlayer.timer ?? 20);
          setPendingNextPlayer(null);
        }
      }, SOLD_DISPLAY_MS);

      // Update topPlayers / team only for *actually sold* players (not unsold)
      if (!isUnsold) {
        // If I won, refetch team shortly so UI updates quickly
        if (String(soldTo).toLowerCase() === playerName.toLowerCase()) {
          setTimeout(() => fetchTeam(), 250); // slight delay so DB has updated
        }

        setTopPlayers((prev) => {
          const filtered = prev.filter((p) => p.name !== name);
          const updated = [
            ...filtered,
            {
              name,
              nation: soldPlayer.nation || "Unknown",
              price: Number(price) || 0,
              team: soldTo,
            },
          ];
          updated.sort((a, b) => b.price - a.price);
          return updated.slice(0, 10);
        });
      }

      // persist cleanup of auctionState if needed
      localStorage.removeItem("auctionState");
    };

    // ensure trades update this client's team & room when others execute a swap
    const onTradeExecutedRoom = (payload) => {
      // payload may include an authoritative room — prefer that
      if (payload?.room) {
        setRoom(payload.room);
        const myPlayer = payload.room.players?.find(
          (p) =>
            (p.name || "").toLowerCase() === (playerName || "").toLowerCase()
        );
        if (myPlayer) {
          setTeam(Array.isArray(myPlayer.team) ? myPlayer.team : []);
          setRemainingBudget(
            Number(myPlayer?.budget ?? payload.room.budget ?? 0)
          );
        }
      } else {
        // fallback: poll the server for authoritative room state
        fetchTeam();
      }

      // show a small sold-like banner for user feedback (optional)
      setSoldInfo({
        name:
          payload?.trade?.playerRequested?.name ||
          payload?.trade?.player?.name ||
          "Player",
        winner: payload?.trade?.to || payload?.trade?.winner || "Updated",
        price: payload?.trade?.cashOffered ?? payload?.trade?.price ?? null,
        ts: Date.now(),
      });
    };

    //handleMessages
    const handleReceiveMessage = (msg) => {
      setMessages((prev) => {
        if (
          prev.some(
            (m) => m.message === msg.message && m.playerName === msg.playerName
          )
        ) {
          return prev;
        }

        const newMessages = [...prev, msg];

        if (!showChatRef.current) {
          const unread = Math.max(
            0,
            newMessages.length - lastSeenCountRef.current
          );
          setUnreadCount(unread);
        } else {
          // Chat is open — mark as read immediately
          lastSeenCountRef.current = newMessages.length;
          setUnreadCount(0);
        }

        return newMessages;
      });
    };

    socket.on("receive_message", handleReceiveMessage);

    const handleAuctionEnd = () => {
      setAuctionEnded(true);
      setPlayer(null);
      setBidder(null);
      setBid(0);
      setTimer(0);
      localStorage.removeItem("auctionState");
    };
    // NEW handleAuctionState — accepts either currentPlayer or player
    const handleAuctionState = ({
      currentPlayer,
      player: altPlayer,
      bid,
      bidder,
      timer,
    }) => {
      // server may send currentPlayer (your code) or player (older code) — prefer currentPlayer if present
      const raw = currentPlayer ?? altPlayer ?? null;
      const normPlayer = normalizePlayer(raw);

      // console.log("socket -> auction-state:", {
      //   raw,
      //   normPlayer,
      //   bid,
      //   bidder,
      //   timer,
      // });

      setPlayer(normPlayer);
      setBid(bid ?? 0);
      setBidder(bidder ?? null);
      setTimer(timer ?? 20);

      saveAuctionState({
        player: normPlayer,
        bid: bid ?? 0,
        bidder: bidder ?? null,
        timer: timer ?? 20,
      });
    };

    socket.on("new-player", handleNewPlayer);
    socket.on("trade-executed", onTradeExecutedRoom);
    socket.on("bid-update", handleBidUpdate);
    socket.on("team-data", handleTeamData);
    socket.on("auction-state", handleAuctionState);
    socket.on("player-sold", handlePlayerSold);
    socket.on("timer-update", setTimer);
    socket.on("auction-incomplete", ({ message }) => {
      console.warn("⚠️ Auction incomplete:", message);
      alert(message); // or show a modal/toast
    });
    socket.on("auction-ended", handleAuctionEnd);
    socket.on("bid-rejected", ({ reason }) => {
      alert(`Bid rejected: ${reason}`);
    });

    return () => {
      socket.off("new-player", handleNewPlayer);
      socket.off("bid-update", handleBidUpdate);
      socket.off("team-data", handleTeamData);
      socket.off("auction-state", handleAuctionState);
      socket.off("player-sold", handlePlayerSold);
      socket.off("receive_message", handleReceiveMessage);
      socket.off("timer-update");
      socket.off("auction-incomplete");
      socket.off("auction-ended", handleAuctionEnd);
      socket.off("trade-executed", onTradeExecutedRoom);
      socket.off("bid-rejected");
    };
  }, [roomCode, playerName]);

  // ensure modal opens when auction ends and cannot be closed by ESC / backdrop
  useEffect(() => {
    const modal =
      allTeamsModalRef.current || document.getElementById("allTeamsModal");
    if (!modal) return;

    // Prevent ESC / cancel from closing dialog
    const onCancel = (e) => {
      e.preventDefault();
      // keep it open
      try {
        if (!modal.open) modal.showModal();
      } catch (err) {}
    };

    // Prevent clicking backdrop from closing: if click target is the dialog itself, re-open / stop propagation
    const onClick = (e) => {
      if (e.target === modal) {
        e.stopPropagation();
        // re-open to ensure it stays
        try {
          if (!modal.open) modal.showModal();
        } catch (err) {}
      }
    };

    modal.addEventListener("cancel", onCancel);
    modal.addEventListener("click", onClick);

    // Open when auctionEnded becomes true; close when auction restarts (safety)
    if (auctionEnded) {
      try {
        if (!modal.open) modal.showModal();
      } catch (err) {}
    } else {
      try {
        if (modal.open) modal.close();
      } catch (err) {}
    }

    return () => {
      modal.removeEventListener("cancel", onCancel);
      modal.removeEventListener("click", onClick);
    };
  }, [auctionEnded]);

  // ensure AllTeamsModal opens and stays open after auction ends
  useEffect(() => {
    if (!auctionEnded) return;
    try {
      const dlg = document.getElementById("allTeamsModal");
      if (dlg && !dlg.open) {
        dlg.showModal();
      }
    } catch (err) {
      // ignore older browsers or failures
    }
  }, [auctionEnded]);

  useEffect(() => {
    fetchTeam();
  }, [player]);

  useEffect(() => {
    showChatRef.current = showChat;

    // When user opens chat → mark all messages seen
    if (showChat) {
      lastSeenCountRef.current = messages.length;
      setUnreadCount(0);
    }
  }, [showChat, messages.length]);

  useEffect(() => {
    showChatRef.current = showChat;
  }, [showChat]);

  // 🔹 Load top players only for this room
  useEffect(() => {
    const saved = localStorage.getItem(`topPlayers_${roomCode}`);
    if (saved) setTopPlayers(JSON.parse(saved));
  }, [roomCode]);

  // 🔹 Save top players per room
  useEffect(() => {
    localStorage.setItem(`topPlayers_${roomCode}`, JSON.stringify(topPlayers));
  }, [topPlayers, roomCode]);

  useEffect(() => {
    if (auctionEnded) {
      localStorage.removeItem(`topPlayers_${roomCode}`);
      setTopPlayers([]);
    }
  }, [auctionEnded, roomCode]);

  const handleBid = () => {
    socket.emit("place-bid", { roomCode, playerName });
  };

  const handlePass = () => {
    socket.emit("not-interested", { roomCode, playerName });
  };

  // client: robust isForeign (trim + case-insensitive)
  const isForeign = (dataset, nation) => {
    if (!nation) return false;
    if (!dataset) return false;

    const ds = String(dataset).trim().toLowerCase();
    const n = String(nation).trim().toLowerCase();

    if (ds === "ipl") return n !== "india";
    if (ds === "hundred") return n !== "england";
    if (ds === "sa20") return n !== "south africa";
    if (ds === "cpl") return n !== "west indies";
    if (ds === "bbl") return n !== "australia";
    if (ds === "mlc") return n !== "usa";
    if (ds === "test") return n !== "india";
    if (ds === "odi") return n !== "india";
    return false;
  };

  // returns minimum increment based on current bid (same logic used in server)
  const getIncrement = (currentBid) => {
    if (currentBid >= 20) return 2;
    if (currentBid >= 10) return 1;
    return 0.5;
  };

  const isCurrentPlayerForeign = isForeign(room?.dataset, player?.nation);
  const foreignCount = team.filter((p) =>
    isForeign(room?.dataset, p.nation)
  ).length;
  const foreignLimitReached =
    typeof room?.maxForeignPlayers === "number" &&
    foreignCount >= room.maxForeignPlayers;

  const isTeamFull =
    typeof totalPlayersPerTeam === "number" &&
    team.length >= totalPlayersPerTeam;

  // 🟡 Filter other teams (excluding your own)
  const otherTeams = room?.players?.filter(
    (p) => p.name.toLowerCase() !== playerName.toLowerCase()
  );

  const bidDisabled =
    isTeamFull ||
    typeof remainingBudget !== "number" ||
    remainingBudget < bid + 0.5 ||
    (isCurrentPlayerForeign && foreignLimitReached) ||
    (bidder && bidder.toLowerCase() === playerName.toLowerCase()); //

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 relative overflow-hidden">
      {/* subtle stadium glow */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-200px] left-8 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 px-3 pb-28">
        {/* Header */}
        <header className="max-w-6xl mx-auto w-full flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                AuctionPlay
              </h1>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Cricket Auction Room
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs sm:text-sm">
            <div className="hidden sm:flex items-center gap-2 bg-slate-900/70 border border-slate-700 rounded-xl px-3 py-2">
              <span className="uppercase text-slate-400 text-[11px]">Room</span>

              <span className="px-2 py-1 rounded-lg bg-slate-800 font-mono text-[12px]">
                {roomCode}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-2 bg-slate-900/70 border border-slate-700 rounded-xl px-3 py-2">
              <span className="uppercase text-slate-400 text-[11px]">
                Owner
              </span>
              <span className="px-2 py-1 rounded-lg bg-slate-800 font-mono text-[12px]">
                {playerName}
              </span>
            </div>

            <button
              onClick={() => {
                setShowChat(true);
                lastSeenCountRef.current = messages.length;
                setUnreadCount(0);
              }}
              className="relative inline-flex items-center justify-center gap-1 rounded-full px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold shadow-lg shadow-emerald-500/30 transition"
              aria-label="Open chat"
            >
              {/* <MessageSquare className="w-4 h-4 mt-1" /> */}
              Chat
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Main layout */}
        <main className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT PANEL */}
          <section className="lg:col-span-7 col-span-1 flex flex-col gap-4">
            {/* Timer + Player + Live bid */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg shadow-slate-950/60">
              {/* Top row: timer + team summary */}
              <div className="flex items-center justify-between gap-4 mb-4">
                {/* Timer */}
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20">
                    <div className="absolute inset-0 rounded-full border border-slate-700/70" />
                    <div className="absolute inset-1 rounded-full border-2 border-amber-400/80 border-t-transparent animate-[spin_35s_linear_infinite]" />
                    <div className="relative flex flex-col items-center justify-center h-full">
                      <span className="text-[10px] uppercase text-slate-400 tracking-wide">
                        Timer
                      </span>

                      <span className="text-lg sm:text-xl font-extrabold tabular-nums text-amber-400">
                        {timer}s
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-slate-400">
                      Current Lot
                    </p>
                    <p className="text-sm text-slate-300">Be ready to bid.</p>
                  </div>
                </div>

                {/* Your budget snapshot */}
                <div className="sm:flex flex flex-col items-end gap-1">
                  <AnimateBudget budget={remainingBudget} />
                  <div className="flex gap-2 items-center">
                    <p className="text-[11px] text-slate-400 text-right">
                      Squad:{" "}
                      <span className="font-semibold text-slate-100">
                        {team.length}/{totalPlayersPerTeam ?? 0}
                      </span>
                    </p>
                    <HintButton />

                    
                  </div>
                </div>
              </div>

              {/* Player card block */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
                    Player on the block
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider bg-slate-800 text-slate-300">
                    {isCurrentPlayerForeign ? (
                      <>
                        🌍 <span>Foreign</span>
                      </>
                    ) : (
                      <>
                        <span>Domestic</span>
                      </>
                    )}
                  </span>
                </div>
                <PlayerCard
                  player={player}
                  soldInfo={soldInfo}
                  soldDisplayMs={SOLD_DISPLAY_MS}
                  isForeign={isCurrentPlayerForeign}
                />
              </div>

              {/* Live bid row */}

              <div className="md:col-span-2 bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] uppercase text-slate-400 tracking-[0.16em]">
                    Live bidding
                  </p>
                  <p className="text-xs text-slate-400">
                    Min increment:{" "}
                    <span className="font-semibold text-slate-200">
                      {getIncrement(bid)}
                    </span>
                  </p>
                </div>
                <LiveBidBox
                  bid={bid}
                  bidder={bidder}
                  ownerName={playerName}
                  socket={socket}
                />
              </div>
            </div>

            <div className="fab  fixed bottom-16 right-2 md:hidden lg:hidden">
              <div
                tabIndex={0}
                role="button"
                className="btn btn-lg btn-circle btn-primary"
              >
                <Menu />
              </div>

              <div className="fab-close">
                Close <span className="btn btn-circle btn-lg btn-error">✕</span>
              </div>
              <button
                className="btn btn-lg btn-circle text-xs"
                onClick={() =>
                  document.getElementById("topPaidModal")?.showModal?.()(true)
                }
              >
                <Crown className="text-emerald-500" />
              </button>
              <button
                className="btn btn-lg btn-circle "
                onClick={() =>
                  document.getElementById("otherBudgetsModal")?.showModal()
                }
              >
                {/* <span className="text-xs">BUDS</span> */}
                <CircleDollarSign className="text-gold" />
              </button>

              <button
                className="btn btn-lg btn-circle"
                onClick={() =>
                  document.getElementById("allTeamsModal")?.showModal()
                }
                title="View all teams / trade players"
              >
                {/* <span className="text-xs">TRADE</span> */}
                <Repeat className="text-primary" />
              </button>
              
            </div>

            {/* Stats card */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Player Insights</h3>
                <span className="text-[10px] uppercase text-slate-500">
                  Recent seasons
                </span>
              </div>
              <PlayerStats player={player} />

              <WikiPlayerStats player={player} room={room} />
            </div>

            {/* Mobile Top Paid CTA */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3  items-center justify-between gap-3 flex md:hidden sm:hidden ">
              <div>
                <h3 className="text-sm font-semibold">Top Paid</h3>
                <p className="text-xs text-slate-400">
                  Tap to view top 10 paid players
                </p>
              </div>
              <button
                className="btn btn-sm btn-primary rounded-lg px-4 py-2 bg-indigo-600 hover:bg-indigo-500 border-0"
                onClick={() =>
                  document.getElementById("topPaidModal")?.showModal?.()(true)
                }
                aria-haspopup="dialog"
              >
                PAID
              </button>
            </div>
          </section>

          {/* RIGHT PANEL */}
          <aside className="lg:col-span-5 col-span-1 flex flex-col gap-4">
            {/* Your table / budget & main actions */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg shadow-slate-950/60 flex flex-col gap-4">
              {/* Budget + team size */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase text-slate-400 tracking-[0.16em]">
                    Remaining Budget
                  </p>
                  <p className="text-xl font-bold text-emerald-400">
                    ₹{Math.round(remainingBudget ?? 0)}
                  </p>
                  <div className="mt-1 h-1.5 w-32 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{
                        width: `${
                          totalPlayersPerTeam
                            ? (team.length / totalPlayersPerTeam) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[11px] uppercase text-slate-400 tracking-[0.16em]">
                    Squad Size
                  </p>
                  <p className="text-xl font-bold">
                    {team.length}/{totalPlayersPerTeam ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Keep enough for last slots
                  </p>
                </div>
              </div>

              {/* Actions (desktop/tablet) */}
              <div className="hidden md:grid grid-cols-2 gap-3">
                <button
                  onClick={handleBid}
                  disabled={bidDisabled}
                  className={`h-11 rounded-lg text-sm font-semibold uppercase tracking-wide transition ${
                    bidDisabled
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-emerald-500 text-slate-900 hover:bg-emerald-400 shadow-sm shadow-emerald-500/40"
                  }`}
                >
                  Place Bid
                </button>

                <button
                  onClick={handlePass}
                  disabled={
                    passDisabled ||
                    bidder?.toLowerCase() === playerName.toLowerCase() ||
                    (isCurrentPlayerForeign && foreignLimitReached)
                  }
                  className={`h-11 rounded-lg text-sm font-semibold uppercase tracking-wide transition ${
                    passDisabled ||
                    bidder?.toLowerCase() === playerName.toLowerCase() ||
                    (isCurrentPlayerForeign && foreignLimitReached)
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-amber-500 text-slate-900 hover:bg-amber-400 shadow-sm shadow-amber-500/40"
                  }`}
                  title={
                    isCurrentPlayerForeign && foreignLimitReached
                      ? "You have reached your foreign player limit — you cannot participate in this auction"
                      : undefined
                  }
                >
                  {passDisabled
                    ? `Pass (${passDisableRemaining}s)`
                    : isCurrentPlayerForeign && foreignLimitReached
                    ? "Locked"
                    : "Skip Player"}
                </button>
              </div>

              {/* <label htmlFor="leagueRunnerModal" className="btn btn-primary">
                Open League Runner
              </label> */}

              {/* Bid meta */}
              <div className="text-sm text-slate-300">
                <div>
                  Current bid:{" "}
                  <span className="font-semibold text-slate-50">₹{bid}</span>
                </div>
                <div>
                  Highest bidder:{" "}
                  <span className="font-semibold text-slate-50">
                    {bidder ?? "—"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Minimum increment:{" "}
                  <span className="font-medium">{getIncrement(bid)}</span>
                </div>
              </div>
            </div>

            {/* Utility grid */}
            <div className="grid grid-cols-3 gap-3">
              <button
                className="rounded-xl p-3 text-xs font-semibold bg-slate-950/80 border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-900 transition flex flex-col items-start gap-1"
                onClick={() =>
                  document.getElementById("allTeamsModal")?.showModal()
                }
                title="View all teams / trade players"
              >
                <span className="text-[11px] uppercase text-slate-400">
                  Trade Table
                </span>
                <span className="text-sm">TRADE</span>
              </button>

              <label
                htmlFor="my-drawer-1"
                className="rounded-xl p-3 text-xs font-semibold bg-slate-950/80 border border-slate-800 hover:border-indigo-500/60 hover:bg-slate-900 transition flex flex-col items-start gap-1 cursor-pointer"
              >
                <span className="text-[11px] uppercase text-slate-400">
                  Your Squad
                </span>
                <span className="text-sm">SQUAD</span>
              </label>

              <button
                className="rounded-xl p-3 text-xs font-semibold bg-slate-950/80 border border-slate-800 hover:border-amber-500/60 hover:bg-slate-900 transition flex flex-col items-start gap-1"
                onClick={() =>
                  document.getElementById("otherBudgetsModal")?.showModal()
                }
              >
                <span className="text-[11px] uppercase text-slate-400">
                  Budgets
                </span>
                <span className="text-sm">BUDS</span>
              </button>
            </div>

            {/* Other teams */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold">Other Tables</h4>
                <span className="text-[11px] uppercase text-slate-500">
                  Live budgets
                </span>
              </div>
              <div className="max-h-52 overflow-y-auto space-y-2">
                {otherTeams?.length ? (
                  otherTeams.map((p) => {
                    const maxBudget = room?.budget ?? p?.budget ?? 0;
                    const currentBudget = Math.round(
                      p?.budget ?? room?.budget ?? 0
                    );
                    const percent =
                      maxBudget > 0
                        ? Math.max(
                            0,
                            Math.min(100, (currentBudget / maxBudget) * 100)
                          )
                        : 0;

                    return (
                      <div
                        key={p.name}
                        className="flex flex-col gap-1 bg-slate-900/80 border border-slate-800 rounded-lg p-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium truncate">
                            {p.name}
                          </div>
                          <div className="text-[11px] text-slate-300">
                            ₹{currentBudget}
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500/80"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-slate-400">
                    No other teams yet.
                  </div>
                )}
              </div>
            </div>

            {/* Desktop: Top Paid */}
            <div className="hidden lg:block">
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">Top Paid (Top 10)</h4>
                  <p className="text-xs text-slate-400">
                    Open leaderboard of highest bids
                  </p>
                </div>
                <button
                  className="btn btn-sm btn-primary rounded-lg px-4 py-2 bg-indigo-600 hover:bg-indigo-500 border-0"
                  onClick={() =>
                    document.getElementById("topPaidModal")?.showModal?.()(true)
                  }
                >
                  PAID
                </button>
              </div>
            </div>
          </aside>
        </main>

        {/* Mobile bottom bid bar */}
        <div className="md:hidden fixed left-0 right-0 bottom-0 z-40 bg-slate-950/95 border-t border-slate-800 px-3 py-2">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[11px] uppercase text-slate-400 tracking-[0.14em]">
                Current Bid 
              </p>
              <p className="text-base font-semibold">
                ₹{bid}{" "}
                <span className="text-xs font-normal text-slate-400">
                  by {bidder ?? "—"}
                </span>
              </p>

              
              
            </div>
            <div className="flex gap-2 w-64">
              <button
                onClick={handleBid}
                disabled={bidDisabled}
                className={`flex-1 h-10 rounded-lg text-xs font-semibold uppercase tracking-wide transition ${
                  bidDisabled
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-emerald-500 text-slate-900 hover:bg-emerald-400"
                }`}
              >
                Bid
              </button>
              
              <button
                onClick={handlePass}
                disabled={
                  passDisabled ||
                  bidder?.toLowerCase() === playerName.toLowerCase() ||
                  (isCurrentPlayerForeign && foreignLimitReached)
                }
                className={`flex-1 h-10 rounded-lg text-xs font-semibold uppercase tracking-wide transition ${
                  passDisabled ||
                  bidder?.toLowerCase() === playerName.toLowerCase() ||
                  (isCurrentPlayerForeign && foreignLimitReached)
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-amber-500 text-slate-900 hover:bg-amber-400"
                }`}
                title={
                  isCurrentPlayerForeign && foreignLimitReached
                    ? "Foreign player limit reached"
                    : undefined
                }
              >
                {passDisabled ? `Pass (${passDisableRemaining}s)` : "Skip"}
              </button>

              {/* <label
                htmlFor="my-drawer-1"
                className="flex-1 rounded-lg text-xs font-semibold uppercase tracking-wide transition flex justify-center items-center text-white border cursor-pointer "
              >
                <span className="text-xs">SQUAD</span>
              </label> */}
            </div>
          </div>
        </div>

        {/* <AuctionSimulationRunner
          roomCode={roomCode}
          playerName={playerName}
          isHost={
            (room?.creator || "").trim().toLowerCase() ===
            (playerName || "").trim().toLowerCase()
          }
        /> */}

        <AllTeamsModal
          room={room}
          totalPlayersPerTeam={totalPlayersPerTeam}
          playerName={playerName}
          socket={socket}
          preventClose={auctionEnded}
          onClose={() => {
            if (auctionEnded) {
              navigate("/");
              return;
            }
          }}
        />

        <OtherBudgetsModal
          room={room}
          playerName={playerName}
          totalPlayersPerTeam={totalPlayersPerTeam}
        />

        <TopPaidModal
          topPlayers={topPlayers}
          onClose={() => {
            /* noop or your own state handler */
          }}
        />

        {showChat && (
          <div
            className="fixed inset-0 z-50 bg-black/70 flex justify-center items-end sm:items-center p-4"
            onClick={() => setShowChat(false)}
          >
            <div
              className="w-full max-w-md h-96  overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <ChatBox
                roomId={roomCode}
                playerName={playerName}
                messages={messages}
                setMessages={setMessages}
                closeChat={() => setShowChat(false)}
              />
            </div>
          </div>
        )}

        <SquadDrawer
          team={team}
          room={room}
          remainingBudget={remainingBudget}
          totalPlayersPerTeam={totalPlayersPerTeam}
          bid={bid}
          bidder={bidder}
        />
      </div>
    </div>
  );
}

export default AuctionRoom;
