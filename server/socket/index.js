import { Server } from "socket.io";
import Room from "../models/Room.js";
import crypto from "crypto";
// import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

let auctionState = {};

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function setupSocket(server) {
 const allowedEnv = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const io = new Server(server, {
    cors: {
      origin: (origin, cb) => {
        // allow non-browser requests (no origin)
        if (!origin) return cb(null, true);
        if (allowedEnv.includes(origin) || origin.endsWith(".vercel.app")) return cb(null, true);
        return cb(new Error("CORS not allowed"), false);
      },
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"]
    },
    transports: ["websocket", "polling"],
    allowEIO3: true // optional: if older clients require it
  });

  function normalizeName(n) {
    return (n || "").trim();
  }
  function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function ciNameQueryField(name) {
    return { $regex: `^${escapeRegex(normalizeName(name))}$`, $options: "i" };
  }

  io.on("connection", (socket) => {
    // console.log("⚡ A user connected");

    //     socket.on("match-simulated", ({ roomCode, result }) => {
    //       console.log(`🏏 Match simulated for room ${roomCode}`);
    //       io.to(roomCode).emit("matchSimulated", result); // broadcast to all in room
    //     });

    //     socket.on("simulate-match", async ({ roomCode, prompt }) => {
    //       const room = await Room.findOne({ roomCode });
    //       if (!room) return;

    //       const host = room.creator;
    //       const player = room.players.find((p) => p.socketId === socket.id);
    //       if (!player || player.name !== host) {
    //         socket.emit("matchSimulated", "❌ Only host can simulate match.");
    //         return;
    //       }

    //       const teamObjects = room.players || [];
    //       if (teamObjects.length < 2) {
    //         io.to(roomCode).emit(
    //           "matchSimulated",
    //           "⚠️ Not enough teams to simulate!"
    //         );
    //         return;
    //       }

    //       const team1 =
    //         teamObjects[0]?.team?.map((p) => `${p.name} (${p.role})`) || [];
    //       const team2 =
    //         teamObjects[1]?.team?.map((p) => `${p.name} (${p.role})`) || [];

    //       // If host didn't type anything, use default fallback
    //       const basePrompt = `
    // You are a cricket match simulator.
    // Generate a concise T20 score summary between:
    // 🏏 Team 1: ${JSON.stringify(team1)}
    // 🏆 Team 2: ${JSON.stringify(team2)}
    // Use scoreboard-like format (10 lines max). Include toss, totals, top batters, wicket takers, result & Player of the Match.
    // `;

    //       const finalPrompt = `
    // You are a cricket match simulator.

    // ${prompt?.trim() ? `Host instruction: ${prompt.trim()}` : ""}
    // Now simulate a T20 match and generate a concise scoreboard-like summary between:
    // Keep it realistic, short (max 10 lines). Include toss, totals, top batters, best bowlers, result & Player of the Match.
    // `;

    //       try {
    //         const result = await model.generateContent(finalPrompt);
    //         const text = result.response.text();
    //         io.to(roomCode).emit("matchSimulated", text);
    //       } catch (err) {
    //         console.error("❌ Gemini error:", err);
    //         io.to(roomCode).emit("matchSimulated", "Failed to simulate match.");
    //       }
    //     });

    socket.on("get-room", async () => {
      try {
        const room = await Room.findOne({ "players.socketId": socket.id });
        if (room) {
          socket.emit("room-data", room);
        } else {
          // console.log("⚠️ No room found for socket:", socket.id);
        }
      } catch (err) {
        console.error("❌ Error fetching room:", err);
      }
    });

    // inside io.on("connection", (socket) => { ... })

    // lightweight per-socket guard
    socket._lastCreateAt = 0;
    socket._lastCreatedRoomCode = null;

    socket.on(
      "create-room",
      async ({
        roomCode: clientRoomCode,
        maxPlayers,
        name,
        budget,
        dataset,
        totalPlayersPerTeam,
        maxForeignPlayers,
      }) => {
        try {
          const now = Date.now();
          // Prevent obvious duplicates from quick double-send
          if (now - (socket._lastCreateAt || 0) < 1000) {
            // console.log("Ignoring rapid duplicate create-room from", socket.id);
            // If we created a room recently for this socket, return that info
            if (socket._lastCreatedRoomCode) {
              const existing = await Room.findOne({
                roomCode: socket._lastCreatedRoomCode,
              });
              if (existing) {
                socket.emit("create-success", {
                  roomCode: existing.roomCode,
                  room: existing,
                });
                return;
              }
            }
            socket.emit("create-error", { reason: "Duplicate create attempt" });
            return;
          }
          socket._lastCreateAt = now;

          const requestedName = (name || "").trim() || "Unknown";
          // Try to find an *active* room created by this creator (recent) to return instead of creating new.
          // This prevents duplicates if client retried after network hiccup.
          const recentWindowMs = 60 * 1000; // 60s
          const recentRoom = await Room.findOne({
            creator: { $regex: `^${requestedName}$`, $options: "i" }, // case-insensitive match
            createdAt: { $gte: new Date(Date.now() - recentWindowMs) },
          });

          if (recentRoom) {
            // reuse the recent room instead of creating a new one
            socket.join(recentRoom.roomCode);
            socket._lastCreatedRoomCode = recentRoom.roomCode;
            // ensure host is set for this socket if it's the creator
            if (
              recentRoom.creator &&
              recentRoom.creator.toLowerCase() === requestedName.toLowerCase()
            ) {
              await Room.updateOne(
                { roomCode: recentRoom.roomCode },
                { $set: { host: socket.id } }
              );
            }
            const fresh = await Room.findOne({ roomCode: recentRoom.roomCode });
            io.to(fresh.roomCode).emit("player-list", fresh.players);
            io.to(fresh.roomCode).emit("room-data", fresh);
            socket.emit("create-success", {
              roomCode: fresh.roomCode,
              room: fresh,
            });
            // console.log("Re-used recent room for", requestedName, fresh.roomCode);
            return;
          }

          // Generate a server-side unique roomCode if client didn't provide or to avoid trusting client
          // Keep trying until unique (rare loop)
          let uniqueCode = (clientRoomCode || "").trim();
          const makeCode = () =>
            String(Math.floor(10000 + Math.random() * 90000)); // 5-digit codes similar to your examples

          if (!uniqueCode) uniqueCode = makeCode();

          // ensure uniqueness (try a few times)
          let tries = 0;
          while (tries < 8) {
            const exists = await Room.findOne({ roomCode: uniqueCode });
            if (!exists) break;
            uniqueCode = makeCode();
            tries += 1;
          }
          if (tries >= 8) {
            // fallback: append timestamp to ensure uniqueness
            uniqueCode = `${uniqueCode}-${Date.now()}`;
          }

          const insertDoc = {
            roomCode: uniqueCode,
            creator: requestedName,
            host: socket.id,
            maxPlayers: Number(maxPlayers) || 2,
            budget: Number(budget) || 100,
            totalPlayersPerTeam: Number(totalPlayersPerTeam) || 11,
            maxForeignPlayers: Number(maxForeignPlayers) || 4,
            dataset: dataset || null,
            players: [
              {
                name: requestedName,
                socketId: socket.id,
                team: [],
                budget: Number(budget) || 100,
              },
            ],
            createdAt: new Date(),
          };

          // Atomic insert — will not create duplicate document if two calls race here.
          const room = await Room.findOneAndUpdate(
            { roomCode: uniqueCode },
            { $setOnInsert: insertDoc },
            { new: true, upsert: true }
          );

          // Save last created code on socket for quick reuse or de-dup returns
          socket._lastCreatedRoomCode = room.roomCode;

          // Join and emit
          socket.join(room.roomCode);
          const fresh = await Room.findOne({ roomCode: room.roomCode });
          io.to(fresh.roomCode).emit("player-list", fresh.players);
          io.to(fresh.roomCode).emit("room-data", fresh);

          socket.emit("create-success", {
            roomCode: fresh.roomCode,
            room: fresh,
          });
          // console.log(`✅ Room created ${fresh.roomCode} by ${requestedName} (${socket.id})`);
        } catch (err) {
          console.error("❌ create-room error:", err);
          socket.emit("create-error", { reason: "Server error" });
        }
      }
    );

    socket.on("join-room", async ({ roomCode, name }) => {
      try {
        if (!roomCode || !name) {
          socket.emit("join-error", { reason: "Missing room code or name" });
          return;
        }

        const requestedName = normalizeName(name);
        const ciName = ciNameQueryField(requestedName);

        // find room
        const room = await Room.findOne({ roomCode });
        if (!room) {
          socket.emit("join-error", { reason: "Room not found" });
          return;
        }

        if (room.players.length >= room.maxPlayers) {
          socket.emit("join-error", { reason: "Room is full" });
          return;
        }

        // Check if a player with same name (case-insensitive) exists
        const existingPlayerIndex = (room.players || []).findIndex(
          (p) =>
            (p.name || "").trim().toLowerCase() === requestedName.toLowerCase()
        );

        if (existingPlayerIndex > -1) {
          const existing = room.players[existingPlayerIndex];

          // If already connected with a different socket -> reject
          if (existing.socketId && existing.socketId !== socket.id) {
            socket.emit("join-error", {
              reason: "Name already taken by another connected player",
            });
            return;
          }

          // Atomically update that player's socketId in DB
          const updated = await Room.findOneAndUpdate(
            { roomCode, "players.name": ciName },
            { $set: { "players.$.socketId": socket.id } },
            { new: true }
          );

          // join and emit
          socket.join(roomCode);
          io.to(roomCode).emit("room-data", updated);
          // console.log(
          //   `🔄 Reconnected player ${requestedName} in room ${roomCode} (${socket.id})`
          // );

          // If player is creator, update host too
          if (
            (updated.creator || "").trim().toLowerCase() ===
            requestedName.toLowerCase()
          ) {
            await Room.updateOne({ roomCode }, { $set: { host: socket.id } });
            // console.log(`👑 Host (${requestedName}) set to ${socket.id}`);
          }

          return;
        }

        // New player: push atomically
        const newPlayer = {
          name: requestedName,
          socketId: socket.id,
          team: [],
          budget: room.budget,
        };

        const updatedRoom = await Room.findOneAndUpdate(
          { roomCode },
          { $push: { players: newPlayer } },
          { new: true }
        );

        // ensure join happens before broadcast
        socket.join(roomCode);
        io.to(roomCode).emit("room-data", updatedRoom);

        // console.log(`${requestedName} joined room ${roomCode} (${socket.id})`);
      } catch (err) {
        console.error("❌ join-room error:", err);
        socket.emit("join-error", { reason: "Server error" });
      }
    });

    // ✅ Get Room Info
    socket.on("get-room-info", async ({ roomCode }) => {
      const room = await Room.findOne({ roomCode });
      if (room) {
        socket.emit("room-info", {
          creator: room.creator,
          maxPlayers: room.maxPlayers,
          maxForeignPlayers: room.maxForeignPlayers,
          budget: room.budget,
          totalPlayersPerTeam: room.totalPlayersPerTeam,
          league: room.dataset,
        });
      }
    });

    // ✅ Start Game
    socket.on("start-game", async ({ roomCode }) => {
      // console.log("🟢 start-game received for room:", roomCode);
      const room = await Room.findOne({ roomCode });
      if (!room) return;

      let dataset = [];
      // console.log(room.dataset);
      if (room.dataset === "hundred") {
        dataset = (await import("../data/hundredPlayers.js")).default;
      } else if (room.dataset === "ipl") {
        dataset = (await import("../data/iplPlayers.js")).default;
        // } else if (room.dataset === "test") {
        //   dataset = (await import("../data/testPlayers.js")).default;
      } else if (room.dataset === "sa20") {
        dataset = (await import("../data/SA20.js")).default;
      } else if (room.dataset === "cpl") {
        dataset = (await import("../data/CPL.js")).default;
      } else if (room.dataset === "bbl") {
        dataset = (await import("../data/BBL.js")).default;
      } else if (room.dataset === "mlc") {
        dataset = (await import("../data/MLC.js")).default;
      } else if (room.dataset === "test") {
        dataset = (await import("../data/Test.js")).default;
      } else if (room.dataset === "odi") {
        dataset = (await import("../data/ODI.js")).default;
      }

      // console.log("🟢 Dataset loaded:", dataset.length, "players");

      auctionState[roomCode] = {
        currentPlayerIndex: 0,
        currentBid: 0,
        currentBidder: null,
        timer: 20,
        notInterested: [],
        assigned: false,
        players: shuffleArray([...dataset]),
        unsoldPlayers: [], // ✅ Add this
      };

      io.to(roomCode).emit("game-started");
      sendNextPlayer(roomCode); // ✅ Immediately send first player
    });

    // ✅ Place Bid
    socket.on("place-bid", async ({ roomCode, playerName }) => {
      try {
        const state = auctionState[roomCode];
        if (!state) {
          socket.emit("bid-rejected", {
            reason: "Auction not running for room",
          });
          return;
        }

        // Defensive: ensure state.currentBid is initialized from player base price if missing
        if (
          (state.currentBid === undefined || state.currentBid === null) &&
          state.players &&
          state.players[state.currentPlayerIndex]
        ) {
          state.currentBid =
            state.players[state.currentPlayerIndex].BASE_PRICE || 0;
        }

        const room = await Room.findOne({ roomCode });
        if (!room) {
          socket.emit("bid-rejected", { reason: "Room not found" });
          return;
        }

        // NORMALIZE helpers
        const normalize = (s) => (s || "").trim().toLowerCase();

        // Try to find bidder by case-insensitive name match
        let bidder = null;
        if (playerName) {
          bidder = room.players.find(
            (p) => normalize(p.name) === normalize(playerName)
          );
        }

        // Fallback: find by socket.id (client may omit or send wrong name; the socket is authoritative)
        if (!bidder) {
          bidder = room.players.find((p) => p.socketId === socket.id);
        }

        // If still not found -> reject (and log players for debugging)
        if (!bidder) {
          console.warn(
            "❌ place-bid: bidder not found. roomCode:",
            roomCode,
            "playerName:",
            playerName,
            "socket.id:",
            socket.id
          );
          console.warn(
            "❌ place-bid: players in room:",
            (room.players || []).map((p) => ({
              name: p.name,
              socketId: p.socketId,
              budget: p.budget,
            }))
          );
          socket.emit("bid-rejected", { reason: "Bidder not found" });
          return;
        }

        // Prevent bidder from bidding for themselves repeatedly (existing logic)
        if (state.currentBidder === bidder.name) return;

        // Ensure bidder has budget for at least next min increment
        // If no current bidder, first bid stays at base price (increment 0)
        if (!state.currentBidder) {
          // first bid: state.currentBid should already be player's base price; ensure it's present
          if (state.currentBid === undefined || state.currentBid === null) {
            state.currentBid =
              state.players[state.currentPlayerIndex]?.BASE_PRICE || 0;
          }

          // Validate budget
          if ((bidder.budget || 0) < state.currentBid) {
            socket.emit("bid-rejected", {
              reason: "Insufficient budget for base price",
            });
            return;
          }

          state.currentBidder = bidder.name;
          state.timer = 20;
          state.notInterested = [];

          room.bid = state.currentBid;
          room.bidder = bidder.name;
          room.timer = state.timer;
          await room.save();

          io.to(roomCode).emit("bid-update", {
            bid: state.currentBid,
            bidder: bidder.name,
            timer: state.timer,
            increment: 0,
            message: "First bid at base price",
          });

          return;
        }

        // Compute increment based on current bid (same rules as before)
        let increment = 0.5;
        if (state.currentBid >= 10 && state.currentBid < 20) increment = 1;
        else if (state.currentBid >= 20) increment = 2;

        const newBid = state.currentBid + increment;

        if ((bidder.budget || 0) < newBid) {
          socket.emit("bid-rejected", { reason: "Insufficient budget" });
          return;
        }

        // Accept bid
        state.currentBid = newBid;
        state.currentBidder = bidder.name;
        state.timer = 20;
        state.notInterested = [];

        room.bid = state.currentBid;
        room.bidder = bidder.name;
        room.timer = state.timer;
        await room.save();

        // console.log(
        //   `🧠 Bid accepted by ${bidder.name} in ${roomCode}: ${newBid} (socket ${socket.id})`
        // );
        io.to(roomCode).emit("bid-update", {
          bid: state.currentBid,
          bidder: bidder.name,
          timer: state.timer,
          increment,
        });
      } catch (err) {
        console.error("❌ place-bid error:", err);
        socket.emit("bid-rejected", { reason: "Server error" });
      }
    });

    // ✅ Not Interested (updated: ignore players who are ineligible due to team-size or foreign limits)
    socket.on("not-interested", async ({ roomCode, playerName }) => {
      try {
        const state = auctionState[roomCode];
        if (!state) return;

        const room = await Room.findOne({ roomCode });
        if (!room) return;

        // current raw player being auctioned
        const rawPlayer = state.players[state.currentPlayerIndex];
        if (!rawPlayer) return;

        // helper: determine if a given room player is eligible to bid on current rawPlayer
        function isPlayerEligibleToBid(roomPlayer) {
          if (!roomPlayer) return false;

          // team size check
          const teamSize = (roomPlayer.team || []).length;
          const totalPlayersLimit = Number(room.totalPlayersPerTeam || 0);
          if (typeof totalPlayersLimit === "number" && totalPlayersLimit > 0) {
            if (teamSize >= totalPlayersLimit) return false; // team full -> not eligible
          }

          // foreign check
          const maxForeign =
            typeof room.maxForeignPlayers === "number"
              ? Number(room.maxForeignPlayers)
              : null;

          if (typeof maxForeign === "number") {
            // count foreign players currently in the player's team
            const currentForeignCount = (roomPlayer.team || []).reduce(
              (acc, pl) => acc + (isForeign(room.dataset, pl.nation) ? 1 : 0),
              0
            );

            // would the incoming player be foreign for this dataset?
            const incomingIsForeign = isForeign(room.dataset, rawPlayer.NATION)
              ? 1
              : 0;

            if (currentForeignCount + incomingIsForeign > maxForeign) {
              return false; // would exceed foreign limit -> not eligible
            }
          }

          // otherwise eligible
          return true;
        }

        // find the room player who is signalling not-interested
        const normalize = (s) => (s || "").trim().toLowerCase();
        let signallingPlayer =
          (playerName &&
            room.players.find(
              (p) => normalize(p.name) === normalize(playerName)
            )) ||
          room.players.find((p) => p.socketId === socket.id); // fallback to socket id

        if (!signallingPlayer) {
          // unknown player — ignore
          return;
        }

        // If player is NOT eligible, ignore the not-interested entirely
        if (!isPlayerEligibleToBid(signallingPlayer)) {
          // optional: inform that they were ignored (uncomment if desired)
          // const targetSocket = io.sockets.sockets.get(signallingPlayer.socketId);
          // if (targetSocket) targetSocket.emit("info", { message: "You are not eligible to pass on this player (team full or foreign limit reached)." });
          return;
        }

        // add to notInterested only if not already present
        if (!state.notInterested.includes(signallingPlayer.name)) {
          state.notInterested.push(signallingPlayer.name);
        }

        // compute number of eligible players at this moment (fresh)
        const eligiblePlayers = (room.players || []).filter((p) =>
          isPlayerEligibleToBid(p)
        );
        const eligibleCount = eligiblePlayers.length;

        // When all eligible players have said not interested -> unsold
        if (state.notInterested.length >= eligibleCount && !state.assigned) {
          if (state.intervalId) clearInterval(state.intervalId);
          assignPlayer(roomCode, null); // unsold
          state.assigned = true;
          return;
        }

        // If only currentBidder remains among eligible players and others passed -> assign to currentBidder
        // Count how many eligible players have NOT said not interested
        const notInterestedSet = new Set(
          state.notInterested.map((n) => (n || "").trim().toLowerCase())
        );
        const eligibleStillIn = eligiblePlayers.filter(
          (p) => !notInterestedSet.has((p.name || "").trim().toLowerCase())
        );

        // If only one eligible player left and that is currentBidder -> assign to them
        if (
          eligibleStillIn.length === 1 &&
          state.currentBidder &&
          (eligibleStillIn[0].name || "").trim().toLowerCase() ===
            (state.currentBidder || "").trim().toLowerCase() &&
          !state.assigned
        ) {
          if (state.intervalId) clearInterval(state.intervalId);
          assignPlayer(roomCode, state.currentBidder);
          state.assigned = true;
          return;
        }

        // otherwise, nothing special to do — auction continues
      } catch (err) {
        console.error("❌ not-interested error:", err);
      }
    });

    socket.on("rejoin-room", async ({ roomCode, playerName }) => {
      try {
        if (!roomCode || !playerName) return;

        const requestedName = normalizeName(playerName);
        const ciName = ciNameQueryField(requestedName);

        // Atomically set player's socketId
        const updatedRoom = await Room.findOneAndUpdate(
          { roomCode, "players.name": ciName },
          { $set: { "players.$.socketId": socket.id } },
          { new: true }
        );

        if (!updatedRoom) {
          socket.emit("rejoin-error", { reason: "Player or room not found" });
          return;
        }

        socket.join(roomCode);
        // console.log(
        //   `🔄 ${requestedName} rejoined room ${roomCode} (${socket.id})`
        // );

        // Emit player's own team directly
        const player = updatedRoom.players.find(
          (p) =>
            (p.name || "").trim().toLowerCase() === requestedName.toLowerCase()
        );

        if (player) {
          socket.emit("team-data", {
            team: player.team || [],
            budget: player.budget || 0,
          });
        }

        // Broadcast updated player list to the room
        io.to(roomCode).emit("player-list", updatedRoom.players);

        // Also emit auction/room state to the rejoined socket only (if running)
        const state = auctionState[roomCode];
        if (state) {
          const currentPlayer =
            updatedRoom.currentPlayer ||
            state.players[state.currentPlayerIndex];
          socket.emit("auction-state", {
            currentPlayer,
            bid: state.currentBid,
            bidder: state.currentBidder,
            timer: state.timer,
          });
        }
      } catch (err) {
        console.error("❌ rejoin-room error:", err);
        socket.emit("rejoin-error", { reason: "Server error" });
      }
    });

    socket.on("get-all-teams", async (_, callback) => {
      try {
        const room = await Room.findOne({ "players.socketId": socket.id });
        if (!room) return callback([]);

        // Return all players with their team arrays
        const teams = room.players.map((p) => ({
          name: p.name,
          team: p.team || [],
        }));

        callback(teams);
      } catch (err) {
        console.error("❌ Error in get-all-teams:", err);
        callback([]);
      }
    });

    // ✅ Get Team
    socket.on("get-team", async ({ playerName }) => {
      const room = await Room.findOne({ "players.name": playerName });
      if (!room) return;

      const player = room.players.find((p) => p.name === playerName);

      // console.log("📦 Team data requested:", playerName, player.team);

      socket.emit("team-data", {
        team: player.team || [],
        budget: player.budget || 0,
      });
    });

    function isForeign(dataset, nation) {
      if (!nation || !dataset) return false;
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
    }

    // ---- Trade: receive request from requester and forward to owner ----
    socket.on("send-trade-request", async ({ roomCode, request }, ack) => {
      try {
        if (!roomCode || !request) {
          if (ack) ack({ error: "Missing params" });
          return;
        }

        // ensure server generates canonical id and timestamps
        const id =
          (crypto.randomUUID && crypto.randomUUID()) ||
          `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const reqObj = {
          _id: id,
          from: request.from,
          to: request.to,
          playerRequested: request.playerRequested,
          offeredPlayer: request.offeredPlayer || null,
          cashOffered: Number(request.cashOffered || 0),
          status: "pending",
          createdAt: new Date(),
          resolvedAt: null,
        };

        const room = await Room.findOne({ roomCode });
        if (!room) {
          if (ack) ack({ error: "Room not found" });
          return;
        }

        // can't trade with yourself
        if (
          (reqObj.from || "").trim().toLowerCase() ===
          (reqObj.to || "").trim().toLowerCase()
        ) {
          if (ack) ack({ error: "Cannot trade with yourself." });
          return;
        }

        // persist in room.tradeRequests
        room.tradeRequests = room.tradeRequests || [];
        room.tradeRequests.push(reqObj);
        await room.save();
        // console.log("➤ send-trade-request", {
        //   roomCode,
        //   requestFrom: reqObj.from,
        //   requestTo: reqObj.to,
        //   reqId: reqObj._id,
        // });

        // console.log("➤ send-trade-request", {
        //   roomCode,
        //   from: reqObj.from,
        //   to: reqObj.to,
        //   id: reqObj._id,
        // });
        // notify the target owner (by socketId if connected)
        const targetPlayer = room.players.find(
          (p) =>
            (p.name || "").trim().toLowerCase() ===
            (reqObj.to || "").trim().toLowerCase()
        );
        if (targetPlayer && targetPlayer.socketId) {
          const targetSocket = io.sockets.sockets.get(targetPlayer.socketId);
          if (targetSocket) {
            targetSocket.emit("incoming-trade-request", {
              _id: reqObj._id,
              from: reqObj.from,
              to: reqObj.to,
              playerRequested: reqObj.playerRequested,
              offeredPlayer: reqObj.offeredPlayer,
              cashOffered: reqObj.cashOffered,
              createdAt: reqObj.createdAt,
            });
          } else {
            console.warn("targetSocket not found for", targetPlayer.socketId);
            // fallback: broadcast to the room so clients get notified for testing
            io.to(roomCode).emit("incoming-trade-request", {
              _id: reqObj._id,
              from: reqObj.from,
              to: reqObj.to,
              playerRequested: reqObj.playerRequested,
              offeredPlayer: reqObj.offeredPlayer,
              cashOffered: reqObj.cashOffered,
              createdAt: reqObj.createdAt,
            });
          }
        } else {
          // no socketId known — broadcast (fallback)
          io.to(roomCode).emit("incoming-trade-request", {
            _id: reqObj._id,
            from: reqObj.from,
            to: reqObj.to,
            playerRequested: reqObj.playerRequested,
            offeredPlayer: reqObj.offeredPlayer,
            cashOffered: reqObj.cashOffered,
            createdAt: reqObj.createdAt,
          });
        }

        // broadcast trade-request-updated to room (if you want everyone to see requests)
        io.to(roomCode).emit("trade-request-updated", {
          requestId: reqObj._id,
          status: "pending",
          message: `${reqObj.from} requested ${reqObj.playerRequested?.name}`,
        });

        if (ack) ack({ ok: true, requestId: reqObj._id });
      } catch (err) {
        console.error("❌ send-trade-request error:", err);
        if (ack) ack({ error: "Server error" });
      }
    });

    socket.on(
      "respond-trade-request",
      async ({ roomCode, requestId, accept, responderName }, ack) => {
        // console.log("🔁 respond-trade-request called", {
        //   roomCode,
        //   requestId,
        //   accept,
        //   responderName,
        //   socketId: socket.id,
        // });
        try {
          const room = await Room.findOne({ roomCode });
          if (!room) {
            if (ack) ack({ error: "Room not found" });
            return;
          }

          const reqIndex = (room.tradeRequests || []).findIndex(
            (r) => r._id === requestId
          );
          if (reqIndex === -1) {
            if (ack) ack({ error: "Request not found" });
            return;
          }

          const req = room.tradeRequests[reqIndex];

          // Quick auth: only the requested owner may respond
          const socketPlayer = room.players.find(
            (p) => p.socketId === socket.id
          );
          const socketPlayerName = socketPlayer?.name?.trim()?.toLowerCase();
          const intendedOwner = (req.to || "").trim().toLowerCase();

          if (
            responderName &&
            responderName.trim().toLowerCase() !== intendedOwner &&
            socketPlayerName !== intendedOwner
          ) {
            if (ack)
              ack({
                error: "Only the requested owner can respond to this trade.",
              });
            return;
          }

          if (
            !socketPlayer ||
            (socketPlayer.name || "").trim().toLowerCase() !== intendedOwner
          ) {
            if (ack)
              ack({
                error: "Only the requested owner can respond to this trade.",
              });
            return;
          }

          req.status = accept ? "accepted" : "declined";
          req.resolvedAt = new Date();

          if (!accept) {
            await room.save();
            // notify requester if present
            const requester = room.players.find(
              (p) =>
                (p.name || "").trim().toLowerCase() ===
                (req.from || "").trim().toLowerCase()
            );
            if (requester && requester.socketId) {
              const rSocket = io.sockets.sockets.get(requester.socketId);
              if (rSocket) {
                rSocket.emit("trade-declined", {
                  requestId: req._id,
                  message: `${req.to} declined your trade request.`,
                });
              }
            }
            io.to(roomCode).emit("trade-request-updated", {
              requestId: req._id,
              status: req.status,
              message: `${req.to} declined the trade.`,
            });
            if (ack) ack({ ok: true, message: "Declined" });
            return;
          }

          // ACCEPT: validate both players still exist in their teams
          const fromPlayerObj = room.players.find(
            (p) =>
              (p.name || "").trim().toLowerCase() ===
              (req.from || "").trim().toLowerCase()
          );
          const toPlayerObj = room.players.find(
            (p) =>
              (p.name || "").trim().toLowerCase() ===
              (req.to || "").trim().toLowerCase()
          );
          if (!fromPlayerObj || !toPlayerObj) {
            if (ack) ack({ error: "One of the owners not found in room" });
            return;
          }

          // requested player must still be in toPlayerObj.team
          const requestedIdx = (toPlayerObj.team || []).findIndex(
            (pl) =>
              (pl.name || "").trim().toLowerCase() ===
              (req.playerRequested?.name || "").trim().toLowerCase()
          );
          if (requestedIdx === -1) {
            req.status = "cancelled";
            req.resolvedAt = new Date();
            await room.save();
            const requester = room.players.find(
              (p) =>
                (p.name || "").trim().toLowerCase() ===
                (req.from || "").trim().toLowerCase()
            );
            if (requester && requester.socketId) {
              const rSocket = io.sockets.sockets.get(requester.socketId);
              if (rSocket) {
                rSocket.emit("trade-declined", {
                  requestId: req._id,
                  message: `Trade failed: ${req.playerRequested?.name} is no longer available.`,
                });
              }
            }
            io.to(roomCode).emit("trade-request-updated", {
              requestId: req._id,
              status: req.status,
              message: `Trade cancelled — requested player not available.`,
            });
            if (ack) ack({ error: "Requested player not available" });
            return;
          }

          // offered player (if provided) must still be in fromPlayerObj.team
          let offeredIdx = -1;
          if (req.offeredPlayer && req.offeredPlayer.name) {
            offeredIdx = (fromPlayerObj.team || []).findIndex(
              (pl) =>
                (pl.name || "").trim().toLowerCase() ===
                (req.offeredPlayer.name || "").trim().toLowerCase()
            );
            if (offeredIdx === -1) {
              req.status = "cancelled";
              req.resolvedAt = new Date();
              await room.save();
              const requester = room.players.find(
                (p) =>
                  (p.name || "").trim().toLowerCase() ===
                  (req.from || "").trim().toLowerCase()
              );
              if (requester && requester.socketId) {
                const rSocket = io.sockets.sockets.get(requester.socketId);
                if (rSocket) {
                  rSocket.emit("trade-declined", {
                    requestId: req._id,
                    message: `Trade failed: Offered player is no longer available.`,
                  });
                }
              }
              io.to(roomCode).emit("trade-request-updated", {
                requestId: req._id,
                status: req.status,
                message: `Trade cancelled — offered player not available.`,
              });
              if (ack) ack({ error: "Offered player not available" });
              return;
            }
          } else {
            // if no player offered, check cash offer is numeric and requester budget is sufficient
            if (req.cashOffered && fromPlayerObj.budget < req.cashOffered) {
              req.status = "cancelled";
              req.resolvedAt = new Date();
              await room.save();
              const requester = room.players.find(
                (p) =>
                  (p.name || "").trim().toLowerCase() ===
                  (req.from || "").trim().toLowerCase()
              );
              if (requester && requester.socketId) {
                const rSocket = io.sockets.sockets.get(requester.socketId);
                if (rSocket) {
                  rSocket.emit("trade-declined", {
                    requestId: req._id,
                    message: `Trade failed: Insufficient budget for cash offer.`,
                  });
                }
              }
              io.to(roomCode).emit("trade-request-updated", {
                requestId: req._id,
                status: req.status,
                message: `Trade cancelled — insufficient cash.`,
              });
              if (ack) ack({ error: "Insufficient budget for cash offer" });
              return;
            }
          }

          // --- NEW: TEAM SIZE & FOREIGN LIMIT VALIDATION (simulate swap, do not mutate yet) ---
          // helper to count foreign players (optionally exclude a player by name)
          function countForeignInTeam(team = [], dataset, excludeName = null) {
            return (team || []).reduce((acc, pl) => {
              if (!pl) return acc;
              if (
                excludeName &&
                (pl.name || "").trim().toLowerCase() ===
                  (excludeName || "").trim().toLowerCase()
              )
                return acc;
              return acc + (isForeign(dataset, pl.nation) ? 1 : 0);
            }, 0);
          }

          const requestedPlayerObj =
            (toPlayerObj.team || [])[requestedIdx] || null;
          const offeredPlayerObj =
            offeredIdx !== -1 ? (fromPlayerObj.team || [])[offeredIdx] : null;

          const totalPlayersLimit = Number(room.totalPlayersPerTeam || 0);
          const maxForeign =
            typeof room.maxForeignPlayers === "number"
              ? Number(room.maxForeignPlayers)
              : null;

          // sizes after swap
          const fromSizeAfter =
            (fromPlayerObj.team?.length || 0) - (offeredPlayerObj ? 1 : 0) + 1;
          const toSizeAfter =
            (toPlayerObj.team?.length || 0) - 1 + (offeredPlayerObj ? 1 : 0);

          if (typeof totalPlayersLimit === "number" && totalPlayersLimit > 0) {
            if (fromSizeAfter > totalPlayersLimit) {
              req.status = "cancelled";
              req.resolvedAt = new Date();
              await room.save();
              const requester = room.players.find(
                (p) =>
                  (p.name || "").trim().toLowerCase() ===
                  (req.from || "").trim().toLowerCase()
              );
              if (requester && requester.socketId) {
                const rSocket = io.sockets.sockets.get(requester.socketId);
                if (rSocket) {
                  rSocket.emit("trade-declined", {
                    requestId: req._id,
                    message: `Trade failed: ${req.from} would exceed team size limit.`,
                  });
                }
              }
              io.to(roomCode).emit("trade-request-updated", {
                requestId: req._id,
                status: req.status,
                message: `Trade cancelled — ${req.from} would exceed team size.`,
              });
              if (ack) ack({ error: "Requester would exceed team size" });
              return;
            }
            if (toSizeAfter > totalPlayersLimit) {
              req.status = "cancelled";
              req.resolvedAt = new Date();
              await room.save();
              io.to(roomCode).emit("trade-request-updated", {
                requestId: req._id,
                status: "cancelled",
                message: `Trade cancelled — ${req.to} would exceed team size.`,
              });
              if (ack) ack({ error: "Owner would exceed team size" });
              return;
            }
          }

          // foreign counts after swap
          if (typeof maxForeign === "number") {
            const fromForeignExclOffered = offeredPlayerObj
              ? countForeignInTeam(
                  fromPlayerObj.team,
                  room.dataset,
                  offeredPlayerObj.name
                )
              : countForeignInTeam(fromPlayerObj.team, room.dataset);
            const toForeignExclRequested = requestedPlayerObj
              ? countForeignInTeam(
                  toPlayerObj.team,
                  room.dataset,
                  requestedPlayerObj.name
                )
              : countForeignInTeam(toPlayerObj.team, room.dataset);

            const incomingIsForeignForFrom = requestedPlayerObj
              ? isForeign(room.dataset, requestedPlayerObj.nation)
                ? 1
                : 0
              : 0;
            const incomingIsForeignForTo = offeredPlayerObj
              ? isForeign(room.dataset, offeredPlayerObj.nation)
                ? 1
                : 0
              : 0;

            const fromForeignAfter =
              fromForeignExclOffered + incomingIsForeignForFrom;
            const toForeignAfter =
              toForeignExclRequested + incomingIsForeignForTo;

            if (fromForeignAfter > maxForeign) {
              req.status = "cancelled";
              req.resolvedAt = new Date();
              await room.save();
              const requester = room.players.find(
                (p) =>
                  (p.name || "").trim().toLowerCase() ===
                  (req.from || "").trim().toLowerCase()
              );
              if (requester && requester.socketId) {
                const rSocket = io.sockets.sockets.get(requester.socketId);
                if (rSocket) {
                  rSocket.emit("trade-declined", {
                    requestId: req._id,
                    message: `Trade failed: ${req.from} would exceed foreign player limit.`,
                  });
                }
              }
              io.to(roomCode).emit("trade-request-updated", {
                requestId: req._id,
                status: req.status,
                message: `Trade cancelled — ${req.from} would exceed foreign limit.`,
              });
              if (ack)
                ack({ error: "Requester would exceed foreign player limit" });
              return;
            }
            if (toForeignAfter > maxForeign) {
              req.status = "cancelled";
              req.resolvedAt = new Date();
              await room.save();
              io.to(roomCode).emit("trade-request-updated", {
                requestId: req._id,
                status: "cancelled",
                message: `Trade cancelled — ${req.to} would exceed foreign limit.`,
              });
              if (ack)
                ack({ error: "Owner would exceed foreign player limit" });
              return;
            }
          }

          // --- All validations passed; perform the swap (mutate teams, budgets) ---
          const removedRequested = toPlayerObj.team.splice(requestedIdx, 1)[0];
          let removedOffered = null;
          if (offeredIdx !== -1) {
            removedOffered = fromPlayerObj.team.splice(offeredIdx, 1)[0];
          }

          if (removedOffered) {
            // canonicalize price fields (fall back to basePrice if needed)
            const requestedPrice =
              (removedRequested &&
                (removedRequested.price ??
                  removedRequested.price ??
                  removedRequested.basePrice)) ||
              0;
            const offeredPrice =
              (removedOffered &&
                (removedOffered.price ??
                  removedOffered.price ??
                  removedOffered.basePrice)) ||
              0;

            // difference = how much the requester (fromPlayerObj) must pay to the owner (toPlayerObj)
            const priceDiff = requestedPrice - offeredPrice;

            if (priceDiff > 0) {
              // requester must pay `priceDiff` to owner
              if ((fromPlayerObj.budget || 0) < priceDiff) {
                // cancel trade due to insufficient funds for the price difference
                req.status = "cancelled";
                req.resolvedAt = new Date();
                await room.save();
                const requester = room.players.find(
                  (p) =>
                    (p.name || "").trim().toLowerCase() ===
                    (req.from || "").trim().toLowerCase()
                );
                if (requester && requester.socketId) {
                  const rSocket = io.sockets.sockets.get(requester.socketId);
                  if (rSocket) {
                    rSocket.emit("trade-declined", {
                      requestId: req._id,
                      message: `Trade failed: ${req.from} has insufficient budget to cover the price difference of ${priceDiff}.`,
                    });
                  }
                }
                io.to(roomCode).emit("trade-request-updated", {
                  requestId: req._id,
                  status: req.status,
                  message: `Trade cancelled — insufficient funds for price difference.`,
                });
                if (ack)
                  ack({ error: "Insufficient budget for price difference" });
                return;
              }
              // perform transfer
              fromPlayerObj.budget = Math.max(
                0,
                (fromPlayerObj.budget || 0) - priceDiff
              );
              toPlayerObj.budget = (toPlayerObj.budget || 0) + priceDiff;
            } else if (priceDiff < 0) {
              // owner must pay requester the absolute difference
              const abs = Math.abs(priceDiff);
              if ((toPlayerObj.budget || 0) < abs) {
                // cancel trade due to owner's insufficient funds
                req.status = "cancelled";
                req.resolvedAt = new Date();
                await room.save();
                io.to(roomCode).emit("trade-request-updated", {
                  requestId: req._id,
                  status: req.status,
                  message: `Trade cancelled — ${req.to} has insufficient budget to cover the price difference.`,
                });
                if (ack)
                  ack({
                    error: "Owner has insufficient budget for price difference",
                  });
                return;
              }
              toPlayerObj.budget = Math.max(0, (toPlayerObj.budget || 0) - abs);
              fromPlayerObj.budget = (fromPlayerObj.budget || 0) + abs;
            }
          }

          // adjust budgets if cash offered
          if (req.cashOffered && req.cashOffered > 0) {
            fromPlayerObj.budget = Math.max(
              0,
              (fromPlayerObj.budget || 0) - req.cashOffered
            );
            toPlayerObj.budget = (toPlayerObj.budget || 0) + req.cashOffered;
          }

          // push swapped players to opposite teams
          if (removedRequested) {
            if (typeof removedRequested.price === "undefined")
              removedRequested.price = removedRequested.basePrice || 0;
            fromPlayerObj.team.push(removedRequested);
          }
          if (removedOffered) {
            if (typeof removedOffered.price === "undefined")
              removedOffered.price = removedOffered.basePrice || 0;
            toPlayerObj.team.push(removedOffered);
          }

          // mark accepted and save
          req.status = "accepted";
          req.resolvedAt = new Date();
          room.markModified("players");
          await room.save();

          // notify both parties
          const requesterSocketId = fromPlayerObj.socketId;
          const ownerSocketId = toPlayerObj.socketId;

          if (requesterSocketId) {
            const rsock = io.sockets.sockets.get(requesterSocketId);
            if (rsock) {
              rsock.emit("trade-executed", {
                requestId: req._id,
                from: req.from,
                to: req.to,
                swapped: {
                  youReceived: removedRequested || null,
                  youGave: removedOffered || null,
                  cash: req.cashOffered || 0,
                },
                message: `${req.to} accepted your trade. Swap executed.`,
              });
            }
          }

          if (ownerSocketId) {
            const osock = io.sockets.sockets.get(ownerSocketId);
            if (osock) {
              osock.emit("trade-executed", {
                requestId: req._id,
                from: req.from,
                to: req.to,
                swapped: {
                  youReceived: removedOffered || null,
                  youGave: removedRequested || null,
                  cash: req.cashOffered || 0,
                },
                message: `You accepted trade from ${req.from}. Swap executed.`,
              });
            }
          }

          io.to(roomCode).emit("player-list", room.players);
          io.to(roomCode).emit("trade-request-updated", {
            requestId: req._id,
            status: "accepted",
            message: `Trade accepted and executed between ${req.from} and ${req.to}`,
          });

          if (ack) ack({ ok: true, message: "Trade executed" });
        } catch (err) {
          console.error("❌ respond-trade-request error:", err);
          if (ack) ack({ error: "Server error" });
        }
      }
    );

    socket.on("get-trade-requests", async (_, ack) => {
      try {
        // find room where this socketId belongs
        const room = await Room.findOne({ "players.socketId": socket.id });
        if (!room) return ack?.({ requests: [] });

        const player = room.players.find((p) => p.socketId === socket.id);
        if (!player) return ack?.({ requests: [] });

        const pending = (room.tradeRequests || []).filter(
          (r) =>
            (r.to || "").trim().toLowerCase() ===
              (player.name || "").trim().toLowerCase() && r.status === "pending"
        );
        ack?.({ requests: pending || [] });
      } catch (err) {
        console.error("❌ get-trade-requests error", err);
        ack?.({ requests: [] });
      }
    });

   // ------------------- Replace assignPlayer, sendNextPlayer, startTimer -------------------

async function assignPlayer(roomCode, winnerName) {
  const state = auctionState[roomCode];
  if (!state) return;

  // Defensive: ensure there's a player in front of the queue
  if (!state.players || state.players.length === 0) return;
  // Capture the winning bid BEFORE we reset or mutate state.
  const winningBid = typeof state.currentBid === "number" ? state.currentBid : 0;

  // Remove player from the front of the queue (we are processing it)
  const currentRaw = state.players.shift(); // deterministic: always the "current" player
  if (!currentRaw) return;

  const room = await Room.findOne({ roomCode });
  if (!room) return;

  // Build playerData using winningBid
  const playerData = {
    name: currentRaw.NAME,
    team: currentRaw.TEAM?.trim(),
    role: currentRaw.ROLE,
    nation: currentRaw.NATION,
    stats: currentRaw.STATS || currentRaw.Stats || currentRaw.stats || {},
    price: winningBid || currentRaw.BASE_PRICE || 0,
    basePrice: currentRaw.BASE_PRICE || 0,
  };

  // clear any interval to avoid double-assign from timer (do NOT clear winningBid)
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }

  // reset room's current player/bid state BEFORE DB save (clear UI)
  // but DON'T clobber winningBid which we already captured
  room.currentPlayer = null;
  room.bid = 0;
  room.bidder = null;
  room.timer = 0;

  // We'll reset in-memory state AFTER assignment logic below
  // (so we can still reference winningBid while assigning)
  // state.currentBid = 0;
  // state.currentBidder = null;
  // state.timer = 0;
  // state.notInterested = [];

  let assigned = false;

  if (winnerName) {
    const winner = room.players.find((p) => (p.name || "") === winnerName);
    if (winner) {
      if (!winner.team) winner.team = [];

      // team size check
      if (winner.team.length >= room.totalPlayersPerTeam) {
        io.to(roomCode).emit("player-sold", { player: playerData, winner: "No one" });
        state.unsoldPlayers.push(currentRaw);
      } else {
        // foreign check
        if (isForeign(room.dataset, playerData.nation)) {
          const foreignCount = winner.team.filter((p) => isForeign(room.dataset, p.nation)).length;
          if (foreignCount >= room.maxForeignPlayers) {
            io.to(roomCode).emit("player-sold", { player: playerData, winner: "No one" });
            state.unsoldPlayers.push(currentRaw);
          } else {
            // assign to winner using the captured winningBid
            const clonePlayer = JSON.parse(JSON.stringify(playerData));
            clonePlayer.price = winningBid || clonePlayer.basePrice || 0;
            winner.team.push(clonePlayer);
            winner.budget = Math.max(0, (winner.budget || 0) - (clonePlayer.price || 0));
            assigned = true;

            // persist: save only the modified player's team/budget
            const cleanTeam = winner.team.map((p) => ({
              name: p.name,
              role: p.role,
              nation: p.nation,
              price: p.price,
              basePrice: p.basePrice,
              playerStyle: p.playerStyle,
              playerType: p.playerType,
              stats: p.stats,
            }));

            await Room.findOneAndUpdate(
              { roomCode, "players.name": winner.name },
              {
                $set: {
                  "players.$.team": cleanTeam,
                  "players.$.budget": winner.budget,
                  currentPlayer: null,
                  bid: 0,
                  bidder: null,
                  timer: 0,
                },
              },
              { new: true }
            );

            io.to(roomCode).emit("player-sold", { player: playerData, winner: winnerName });
          }
        } else {
          // not foreign, safe to assign
          const clonePlayer = JSON.parse(JSON.stringify(playerData));
          clonePlayer.price = winningBid || clonePlayer.basePrice || 0;
          winner.team.push(clonePlayer);
          winner.budget = Math.max(0, (winner.budget || 0) - (clonePlayer.price || 0));
          assigned = true;

          const cleanTeam = winner.team.map((p) => ({
            name: p.name,
            role: p.role,
            nation: p.nation,
            price: p.price,
            basePrice: p.basePrice,
            playerStyle: p.playerStyle,
            playerType: p.playerType,
            stats: p.stats,
          }));

          await Room.findOneAndUpdate(
            { roomCode, "players.name": winner.name },
            {
              $set: {
                "players.$.team": cleanTeam,
                "players.$.budget": winner.budget,
                currentPlayer: null,
                bid: 0,
                bidder: null,
                timer: 0,
              },
            },
            { new: true }
          );

          io.to(roomCode).emit("player-sold", { player: playerData, winner: winnerName });
        }
      }
    } else {
      // winner not found in room -> mark unsold
      io.to(roomCode).emit("player-sold", { player: playerData, winner: "No one" });
      state.unsoldPlayers.push(currentRaw);
    }
  } else {
    // no winner => unsold
    io.to(roomCode).emit("player-sold", { player: playerData, winner: "No one" });
    state.unsoldPlayers.push(currentRaw);
  }

  // persist overall room state
  room.markModified("players");
  await room.save();

  // NOW clear in-memory auction item state (after we've used winningBid)
  state.currentBid = 0;
  state.currentBidder = null;
  state.timer = 0;
  state.notInterested = [];
  state.assigned = false;

  // check if all teams are full now
  const verifyRoom = await Room.findOne({ roomCode });
  const allTeamsFilled = verifyRoom.players.every(
    (p) =>
      Array.isArray(p.team) &&
      typeof verifyRoom.totalPlayersPerTeam === "number" &&
      p.team.length >= verifyRoom.totalPlayersPerTeam
  );

  if (allTeamsFilled) {
    verifyRoom.auctionEnded = true;
    await verifyRoom.save();
    io.to(roomCode).emit("auction-ended");
    return;
  }

  // If we still have players left in queue, schedule next after short delay
  if (state.players.length > 0) {
    setTimeout(() => sendNextPlayer(roomCode), 1200);
    return;
  }

  // If no players left but unsold exist, requeue and continue
  if (state.unsoldPlayers.length > 0) {
    state.players = [...state.unsoldPlayers];
    state.unsoldPlayers = [];
    setTimeout(() => sendNextPlayer(roomCode), 1200);
    return;
  }

  // no players left and no unsold -> auction incomplete or finished
  io.to(roomCode).emit("auction-incomplete", { message: "Auction ended but some teams are not full." });
  return;
}


/**
 * sendNextPlayer(roomCode)
 * - Uses head of queue (state.players[0]) as current candidate.
 * - Sets state.currentBid from base price and notifies clients.
 */
async function sendNextPlayer(roomCode) {
  const state = auctionState[roomCode];
  if (!state) return;
  // ensure no double-send
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  // claim work
  if (!state.players || state.players.length === 0) return;

  // current candidate is first in queue
  const rawPlayer = state.players[0];
  if (!rawPlayer) return;

  const room = await Room.findOne({ roomCode });
  if (!room) return;

  const playerData = {
    name: rawPlayer.NAME,
    team: rawPlayer.TEAM?.trim(),
    role: rawPlayer.ROLE,
    nation: rawPlayer.NATION,
    stats: rawPlayer.STATS || rawPlayer.Stats || rawPlayer.stats || {},
    playerStyle: rawPlayer.PLAYER_STYLE || rawPlayer.playerStyle || null,
    playerType: rawPlayer.PLAYER_TYPE || rawPlayer.playerType || null,
    best: rawPlayer.BEST ?? rawPlayer.best ?? null,
    bestBatting: rawPlayer.BEST_BATTING ?? rawPlayer.bestBatting ?? null,
    bestBowling: rawPlayer.BEST_BOWLING ?? rawPlayer.bestBowling ?? null,
    basePrice: rawPlayer.BASE_PRICE ?? rawPlayer.basePrice ?? 0,
  };

  // set state defaults for the item we just exposed
  state.currentBid = playerData.basePrice || 0;
  state.currentBidder = null;
  state.timer = 20;
  state.notInterested = [];
  state.assigned = false;

  // persist to DB and emit new-player
  room.currentPlayer = playerData;
  room.bid = 0;
  room.bidder = null;
  room.timer = state.timer;
  await room.save();

  io.to(roomCode).emit("new-player", {
    player: playerData,
    bid: state.currentBid,
    bidder: null,
    timer: state.timer,
  });

  // start timer which will call assignPlayer when time runs out
  startTimer(roomCode);
}

/**
 * startTimer(roomCode)
 * - Ensures a single intervalId is used per room (cleans any existing one).
 * - The timer decrements state.timer and emits timer-update. When it hits 0, it calls assignPlayer with currentBidder.
 */
function startTimer(roomCode) {
  const state = auctionState[roomCode];
  if (!state) return;

  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }

  state.intervalId = setInterval(async () => {
    const s = auctionState[roomCode];
    if (!s) {
      clearInterval(state.intervalId);
      state.intervalId = null;
      return;
    }

    s.timer -= 1;
    // clamp non-negative
    if (s.timer < 0) s.timer = 0;
    io.to(roomCode).emit("timer-update", s.timer);

    // when timer hits zero, ensure we only assign once
    if (s.timer <= 0 && !s.assigned) {
      // mark assigned to avoid double-assign from other events
      s.assigned = true;
      clearInterval(s.intervalId);
      s.intervalId = null;
      // assign current bidder (could be null -> unsold)
      await assignPlayer(roomCode, s.currentBidder);
      // assignPlayer will schedule next player if appropriate
    }
  }, 1000);
}


    //messages
    socket.on("send_message", async ({ roomId, playerName, message }) => {
      if (!roomId || !message) return;

      // Broadcast the message to everyone in the room
      io.to(roomId).emit("receive_message", {
        playerName,
        message,
        timestamp: new Date().toISOString(),
      });
    });

    // ✅ Handle Disconnect
    socket.on("disconnect", async () => {
      const room = await Room.findOne({ "players.socketId": socket.id });
      if (!room) return;

      // ✅ Only clear socketId, don't remove player
      const player = room.players.find((p) => p.socketId === socket.id);
      if (player) {
        player.socketId = null; // mark as disconnected
        await room.save();
        io.to(room.roomCode).emit("player-list", room.players);
        // console.log(
        //   `⚠️ ${player.name} disconnected but kept in room ${room.roomCode}`
        // );
      }
    });
  });
}

export default setupSocket;
