/* eslint-disable no-empty */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from "react";
// import { useNavigate, useParams } from "react-router-dom";
import { useParams, useNavigate } from "react-router-dom";

import socket from "../socket";
import axios from "axios";
import { API_BASE_URL } from "../config";
import { BadgeDollarSign } from "lucide-react";
import AnimateBid from "../components/AnimateBid";
import PlayerCard from "../components/PlayerCard";
import AnimateBudget from "../components/AnimateBudget";
import ChatBox from "../components/ChatBox.jsx";
import { MessageSquare, Users2, Wallet } from "lucide-react";
import PlayerStats from "../components/PlayerStats.jsx";
import OtherBudgetsModal from "../components/OtherBudgetsModal.jsx";
import AllTeamsModal from "../components/AllTeamsModal";
import SquadDrawer from "../components/SquadDrawer.jsx";
import TopPaidModal from "../components/TopPaidModal";
import LiveBidBox from "../components/LiveBidBox.jsx";

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
    <div className="min-h-screen bg-gradient-to-b from-[#071426] via-[#071C2A] to-[#071426] text-font p-4 pb-24">
      {/* Header */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-text font-bold text-white">
              AuctionPlay
            </h1>
            <p className="text-xs text-slate-300">
              Live auction room — be quick!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-black/30 px-3 py-2 rounded-md text-sm text-white">
            <span className="font-semibold">Room</span>
            <span className="px-2 py-1 bg-white/10 rounded-md font-mono">
              {roomCode}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 bg-black/30 px-3 py-2 rounded-md text-sm text-white">
            <span className="font-semibold">You</span>
            <span className="px-2 py-1 bg-white/10 rounded-md font-mono">
              {playerName}
            </span>
          </div>

          <button
            onClick={() => {
              setShowChat(true);
              lastSeenCountRef.current = messages.length;
              setUnreadCount(0);
            }}
            className="relative inline-flex items-center justify-center rounded-md px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white shadow-sm"
            aria-label="Open chat"
          >
            CHAT
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Player + Timer + Stats */}
        <section className="lg:col-span-7 col-span-1 flex flex-col gap-4">
          <div className="bg-black/40 rounded-2xl p-4 shadow-xl border border-white/5">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-3 justify-between w-full">
                <div className="flex flex-col text-sm">
                  <span className="text-xs text-slate-300 uppercase">
                    Remaining
                  </span>
                  <span className="text-2xl font-extrabold tabular-nums text-gold">
                    {timer}s
                  </span>
                </div>

                <div className="">
                  <AnimateBudget budget={remainingBudget} label="Remaining" />
                </div>
              </div>

       
            </div>

            {/* Player card */}
            <div className="w-full">
              <PlayerCard
                player={player}
                soldInfo={soldInfo}
                soldDisplayMs={SOLD_DISPLAY_MS}
                isForeign={isCurrentPlayerForeign}
              />
            </div>

            {/* Live bid */}
            <div className="mt-4">
              <LiveBidBox
                bid={bid}
                bidder={bidder}
                ownerName={playerName}
                socket={socket}
              />
            </div>
          </div>

          {/* Stats card */}
          <div className="bg-auc rounded-2xl p-2 shadow-inner border border-white/5">
            <PlayerStats player={player} />
          </div>

          {/* Mobile: replace inline top-paid cards with a compact PAID button that opens modal */}
          <div className="bg-black/30 rounded-2xl p-4 flex items-center justify-between gap-3 md:hidden">
            <div>
              <h3 className="text-sm font-bold text-white">Top Paid</h3>
              <p className="text-xs text-slate-400">
                Tap to view top 10 paid players
              </p>
            </div>
            <button
              className="btn btn-sm btn-primary"
              onClick={() =>
                document.getElementById("topPaidModal")?.showModal?.()(true)
              }
              aria-haspopup="dialog"
            >
              PAID
            </button>
          </div>
        </section>

        {/* Right: Controls, Utilities, Other Teams */}
        <aside className="lg:col-span-5 col-span-1 flex flex-col gap-4">
          <div className="bg-black/40 rounded-2xl p-4 shadow-xl border border-white/5 flex flex-col gap-4">
            {/* Budget summary */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-slate-300">Remaining Budget</div>
                <div className="text-lg font-extrabold">
                  ₹{Math.round(remainingBudget ?? 0)}
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-slate-300">Team Size</div>
                <div className="text-lg font-extrabold">
                  {team.length}/{totalPlayersPerTeam ?? 0}
                </div>
              </div>
            </div>

            {/* Primary actions (desktop/tablet) */}
            <div className="hidden md:grid grid-cols-2 gap-3">
              <button
                onClick={handleBid}
                disabled={bidDisabled}
                className={`h-12 rounded-lg text-base font-bold transition p-2 ${
                  bidDisabled
                    ? "bg-primary/40 text-white cursor-not-allowed"
                    : "bg-player text-white hover:bg-primary/90"
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
                className={`h-12 rounded-lg text-base font-bold transition p-2 ${
                  passDisabled ||
                  bidder?.toLowerCase() === playerName.toLowerCase() ||
                  (isCurrentPlayerForeign && foreignLimitReached)
                    ? "bg-amber-400/40 text-amber-900 cursor-not-allowed"
                    : "bg-amber-600 text-white hover:bg-amber-500"
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

            {/* Increment / Bid info */}
            <div className="text-sm text-slate-300">
              <div>
                Current bid: <span className="font-semibold">₹{bid}</span>
              </div>
              <div>
                Highest bidder:{" "}
                <span className="font-semibold">{bidder ?? "—"}</span>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Minimum increment:{" "}
                <span className="font-medium">{getIncrement(bid)}</span>
              </div>
            </div>
          </div>

          {/* Utility grid */}
          <div className="grid grid-cols-3 gap-3">
            <button
              className="rounded-lg p-3 text-xs font-semibold bg-neutral btn btn-neutral btn-outline hover:bg-neutral text-accent"
              onClick={() =>
                document.getElementById("allTeamsModal")?.showModal()
              }
              title="View all teams / trade"
            >
              TRADE
            </button>

            <label
              htmlFor="my-drawer-1"
              className="rounded-lg p-3 text-xs font-semibold cursor-pointer btn  btn-primary hover:bg-primary/80"
            >
              SQUAD
            </label>

            {/* BUDS button: small-screen only (inline panel shows on md+) */}
            <button
              className="rounded-lg p-3 text-xs font-semibold btn btn-secondary btn-outline hover:bg-neutral hover:btn-neutral text-secondary"
              onClick={() =>
                document.getElementById("otherBudgetsModal")?.showModal()
              }
            >
              BUDS
            </button>
          </div>

          {/* Other teams list */}
          <div className="bg-black/30 rounded-2xl p-4">
            <h4 className="text-sm font-bold text-white mb-2">Other Teams</h4>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {otherTeams?.length ? (
                otherTeams.map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center justify-between bg-white/5 p-2 rounded-md"
                  >
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-slate-300">
                      Budget: ₹{Math.round(p?.budget ?? room?.budget ?? 0)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400">
                  No other teams yet.
                </div>
              )}
            </div>
          </div>

          {/* Desktop: PAID button (opens TopPaidModal) */}
          <div className="hidden lg:block">
            <div className="bg-black/30 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white mb-1">
                  Top Paid (Top 10)
                </h4>
                <p className="text-xs text-slate-400">
                  Open full top-paid list
                </p>
              </div>

              <button
                className="btn btn-sm btn-primary"
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

      {/* Fixed bottom bar for small screens (floating Place Bid area).
        It's intentionally below typical dialog overlays (z-40) so modals can appear above it (z-50+). */}
      <div className="md:hidden fixed left-0 right-0 bottom-3 z-40 bg-linear-to-t from-black/80 to-black/60 border-t border-white/5 p-3 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="flex-1">
            <div className="text-xs text-slate-300">Current bid</div>
            <div className="text-lg font-extrabold">
              ₹{bid}{" "}
              <span className="text-sm font-normal text-slate-400">
                by {bidder ?? "—"}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
             <button
              onClick={handleBid}
              disabled={bidDisabled}
              className={`flex-1 h-12 rounded-lg text-base font-bold transition p-2  min-w-30 ${
                bidDisabled
                  ? "bg-primary/40 text-white cursor-not-allowed"
                  : "bg-player text-white"
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
              className={`flex-1 h-12 rounded-lg text-base font-bold transition p-2 min-w-30  ${
                passDisabled ||
                bidder?.toLowerCase() === playerName.toLowerCase() ||
                (isCurrentPlayerForeign && foreignLimitReached)
                  ? "bg-amber-400/40 text-amber-900 cursor-not-allowed"
                  : "bg-amber-600 text-white"
              }`}
              title={
                isCurrentPlayerForeign && foreignLimitReached
                  ? "You have reached your foreign player limit — you cannot participate in this auction"
                  : undefined
              }
            >
              {passDisabled ? `Pass (${passDisableRemaining}s)` : "Skip"}
            </button>

           
          </div>
        </div>
      </div>

      {/* Other Modals / Panels */}
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

      {/* Small-screen Budgets dialog is already handled inside OtherBudgetsModal component */}
      <OtherBudgetsModal
        room={room}
        playerName={playerName}
        totalPlayersPerTeam={totalPlayersPerTeam}
      />

      {/* TopPaidModal instance — open it from any PAID button above.
        This assumes TopPaidModal is implemented as a dialog/modal that appears when rendered,
        or it responds to document.getElementById('topPaidModal')?.showModal() if it uses native dialog.
    */}
      <TopPaidModal
        topPlayers={topPlayers}
        onClose={() => {
          /* noop or setShowTopPaid(false) if you wire local state */
        }}
      />

      {/* Chat overlay (kept interactive / high z-index so it covers bottom bar) */}
      {showChat && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex justify-center items-end sm:items-center p-4"
          onClick={() => setShowChat(false)}
        >
          <div
            className="w-full max-w-md h-96 bg-gradient-to-b from-white/5 to-white/3 rounded-2xl shadow-2xl overflow-hidden"
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
  );
}

export default AuctionRoom;
