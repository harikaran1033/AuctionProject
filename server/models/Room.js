import mongoose from "mongoose";

// playerStatsSchema, playerSchema unchanged
const playerStatsSchema = new mongoose.Schema({
  name: String,
  role: String,
  team: String,
  nation: String,
  price: { type: Number, default: 0 },
  stats: {
    Batting: {
      M: Number,
      I: Number,
      R: Number,
      Avg: Number,
      SR: Number
    },
    Bowling: {
      I: Number,
      W: Number,
      Avg: Number,
      Econ: Number
    }
  }
}, { _id: false });

const playerSchema = new mongoose.Schema({
  name: String,
  socketId: String,
  joinedAt: { type: Date, default: Date.now },
  team: { type: [playerStatsSchema], default: [] },
  budget: Number
});

// trade request sub-schema
const tradeRequestSchema = new mongoose.Schema({
  _id: { type: String },            // uuid or hex id
  from: String,                     // requester name
  to: String,                       // owner name
  playerRequested: { type: Object },// minimal player object { name, role, nation, price }
  offeredPlayer: { type: Object, default: null }, // optional
  cashOffered: { type: Number, default: 0 },
  status: { type: String, enum: ["pending","accepted","declined","cancelled"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null }
}, { _id: false });

// Main room schema
const RoomSchema = new mongoose.Schema({
  roomCode: String,
  creator: String,
  maxPlayers: Number,
  budget: Number,
  totalPlayersPerTeam: { type: Number, required: true },
  maxForeignPlayers: { type: Number, required: true },
  players: [playerSchema],
  dataset: String,
  currentPlayer: {
    name: String,
    team: String,
    role: String,
    nation: String,
    price: Number,
    stats: {
      Batting: {
        M: Number,
        I: Number,
        R: Number,
        Avg: Number,
        SR: Number
      },
      Bowling: {
        I: Number,
        W: Number,
        Avg: Number,
        Econ: Number
      }
    }
  },
  bid: { type: Number, default: 0 },
  bidder: { type: String, default: null },
  timer: { type: Number, default: 20 },
  auctionEnded: { type: Boolean, default: false },
  tradeRequests: { type: [tradeRequestSchema], default: [] }, // <<< NEW
  createdAt: { type: Date, default: Date.now, expires: 86400 }
});


RoomSchema.index({ roomCode: 1 }, { unique: true });

export default mongoose.model("Room", RoomSchema);
