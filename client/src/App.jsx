/* eslint-disable no-unused-vars */
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Home from "./pages/Home.jsx";
import CreateRoom from "./pages/CreateRoom.jsx";
import JoinRoom from "./pages/JoinRoom.jsx";
import RoomLobby from "./pages/RoomLobby.jsx";
import AuctionRoom from "./pages/AuctionRoom.jsx";
import TeamSquad from "./pages/TeamSquad.jsx";
import React from "react";
// import ThemeProvider from "./components/ThemeProvider.jsx";
// import ThemeToggle from "./components/ThemeToggle.jsx";
import socket from "./socket";

if (!socket.__tradeHandlersInstalled) {
  socket.on("trade:created", (data) => {
    // console.log("GLOBAL trade:created", data);
    // show a toast, or increment unread counter (your AllTeamsModal can still maintain state)
    // e.g. dispatch Redux or update global state so modal picks it up
  });

  socket.on("trade:updated", (data) => {
    // console.log("GLOBAL trade:updated", data);
  });

  socket.__tradeHandlersInstalled = true;
}


// 🎞 Wrapper for smooth fade-slide transitions per route
function PageWrapper({ children }) {
  const location = useLocation();

  return (
    <motion.div
      key={location.pathname} // ✅ ensures clean unmount/remount
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className="min-h-screen"
    >
      {children}
    </motion.div>
  );
}

// 🎬 Handles route-based animations safely
function AnimatedRoutes() {
  const location = useLocation();
   
  return (
    <AnimatePresence mode="wait"> {/* ✅ changed from "wait" to avoid timing mismatch */}
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageWrapper><Home /></PageWrapper>} />
        <Route path="/create" element={<PageWrapper><CreateRoom /></PageWrapper>} />
        <Route path="/join" element={<PageWrapper><JoinRoom /></PageWrapper>} />
        <Route path="/room/:roomCode" element={<PageWrapper><RoomLobby /></PageWrapper>} />
        <Route path="/auction/:roomCode" element={<PageWrapper><AuctionRoom /></PageWrapper>} />
        <Route path="/team" element={<PageWrapper><TeamSquad /></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  );
}

// 🧱 Simple error boundary (optional for safety)
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return <div className="text-center mt-10 text-red-500">Something went wrong 😢</div>;
    }
    return this.props.children;
  }
}

function App() {
  return (
    <Router>
      <ErrorBoundary>
        
        {/* <ThemeProvider />
        <ThemeToggle /> */}
        <AnimatedRoutes />
      </ErrorBoundary>
    </Router>
  );
}

export default App;
