// ------------------------------
// 📦 Imports (ES Module Style)
// ------------------------------
import express from "express";
import http from "http";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import setupSocket from "./socket/index.js";
import Room from "./models/Room.js";

// import path from "path";
// import { fileURLToPath } from "url";

// ------------------------------
// ⚙️ Config
// ------------------------------
dotenv.config();
const app = express();
const server = http.createServer(app);

// ✅ Fix for __dirname in ES modules
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);






app.use(express.json());
app.use(
  cors({
    origin: "*", // or specify your frontend origin
    methods: ["GET", "POST"],
    credentials: true,
  })
);





// ------------------------------
// 🏠 Room Creation Route
// ------------------------------
// ------------------------------
// 🏠 Room Creation Route (robust + idempotent)
// ------------------------------
app.post("/api/create-room", async (req, res) => {
  const {
    creator,
    roomCode: clientRoomCode,
    maxPlayers = 2,
    budget = 100,
    totalPlayersPerTeam = 11,
    maxForeignPlayers = 4,
    dataset = null,
  } = req.body;

  // basic validation
  if (!creator || !String(creator).trim()) {
    return res.status(400).json({ error: "creator (team name) is required" });
  }

  const requestedName = String(creator).trim();

  // helper to generate 5-digit code
  const makeCode = () => String(Math.floor(10000 + Math.random() * 90000));

  try {
    // 1) Try to reuse a very recent room by same creator (avoid duplicates on quick retries)
    //    We consider rooms created in the last 60 seconds as retry candidates.
    const recentWindowMs = 60 * 1000;
    const recentRoom = await Room.findOne({
      creator: { $regex: `^${requestedName}$`, $options: "i" },
      createdAt: { $gte: new Date(Date.now() - recentWindowMs) },
    });

    if (recentRoom) {
      // console.log("Reusing recent room for", requestedName, recentRoom.roomCode);
      return res.json({ ok: true, room: recentRoom });
    }

    // 2) Decide server-side code: prefer client code if provided but ensure uniqueness.
    let code = clientRoomCode && String(clientRoomCode).trim() ? String(clientRoomCode).trim() : makeCode();

    // ensure uniqueness (few retries)
    let tries = 0;
    while (tries < 8) {
      const exists = await Room.findOne({ roomCode: code });
      if (!exists) break;
      code = makeCode();
      tries++;
    }
    if (tries >= 8) {
      code = `${code}-${Date.now()}`; // fallback unique token
    }

    // 3) Build insert doc and use atomic upsert to avoid race-created duplicates
    const insertDoc = {
      roomCode: code,
      creator: requestedName,
      host: null, // will be set later when socket joins
      maxPlayers: Number(maxPlayers),
      budget: Number(budget),
      totalPlayersPerTeam: Number(totalPlayersPerTeam),
      maxForeignPlayers: Number(maxForeignPlayers),
      dataset: dataset || null,
      players: [
        {
          name: requestedName,
          socketId: null,
          team: [],
          budget: Number(budget),
        },
      ],
      createdAt: new Date(),
      auctionEnded: false,
      bid: 0,
      bidder: null,
      timer: 20,
      tradeRequests: [],
    };

    // Upsert by roomCode — if a race created the same code, we won't create a duplicate.
    // Note: If you want to guarantee there is no second doc for the same creator, you'd upsert by creator+recentWindow,
    // but here we upsert by code (unique).
    const room = await Room.findOneAndUpdate(
      { roomCode: code },
      { $setOnInsert: insertDoc },
      { upsert: true, new: true }
    );

    // console.log("✅ Room created (or returned):", room.roomCode, "creator:", requestedName);

    return res.json({ ok: true, room });
  } catch (err) {
    console.error("❌ Error creating room:", err);
    return res.status(500).json({ error: "Failed to create room" });
  }
});


// ------------------------------
// 🚪 Join Room Route
// ------------------------------
app.post("/api/join-room", async (req, res) => {
  const { roomCode, name } = req.body;
  const room = await Room.findOne({ roomCode });
  if (!room) return res.status(404).json({ error: "Room not found" });

  if (room.creator.toLowerCase() === name.toLowerCase()) {
    return res
      .status(400)
      .json({ error: "Name matches room creator — choose a different name" });
  }

  const alreadyJoined = room.players.some(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
  if (alreadyJoined) {
    return res.status(400).json({ error: "Name already taken in this room" });
  }

  room.players.push({
    name,
    socketId: null,
    team: [],
    budget: room.budget,
  });

  await room.save();
  res.json({ success: true });
});

// ------------------------------
// 🔍 Fetch Room Routes
// ------------------------------
app.get("/api/room/:roomCode", async (req, res) => {
  try {
    const room = await Room.findOne({ roomCode: req.params.roomCode });
    if (!room) return res.status(404).json({ error: "Room not found" });

    // console.log("✅ Room fetched:", room.roomCode);
    res.json(room);
  } catch (err) {
    console.error("Error fetching room:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/room/:roomCode/state", async (req, res) => {
  const room = await Room.findOne({ roomCode: req.params.roomCode });
  if (!room) return res.status(404).json({ message: "Room not found" });

  res.json({
    auctionEnded: room.auctionEnded || false,
    currentPlayer: room.currentPlayer || null,
    bid: room.bid || 0,
    bidder: room.bidder || null,
    timer: room.timer || 0,
  });
});


// ------------------------------
// ✅ Serve React build (after API routes)
// ------------------------------
// app.use(express.static(path.join(__dirname, "dist")));

// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "dist", "index.html"));
// });

// ------------------------------
// 🧩 Database + Socket Setup
// ------------------------------
const PORT = process.env.PORT

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDB connected");
    server.listen(PORT, "0.0.0.0", () => {
      // console.log("🚀 Server running on port 5000");
    });
    setupSocket(server);
  })
  .catch((err) => console.error("❌ MongoDB error:", err));
