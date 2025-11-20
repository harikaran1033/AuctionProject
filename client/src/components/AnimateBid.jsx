import { useEffect, useState } from "react";
import { useSpring } from "framer-motion";

const AnimateBid = ({ highestBid = 0, highestBidder }) => {
  // Use spring for smooth animation
  const springBid = useSpring(highestBid, { stiffness: 120, damping: 20 });

  // Local state to display formatted bid
  const [displayBid, setDisplayBid] = useState(highestBid);

  // Update displayBid whenever spring value changes
  useEffect(() => {
    const unsubscribe = springBid.on("change", (v) => setDisplayBid(v.toFixed(1)));
    return () => unsubscribe();
  }, [springBid]);

  // Update spring whenever highestBid prop changes
  useEffect(() => {
    springBid.set(highestBid);
  }, [highestBid, springBid]);

  return (
    <span className="flex gap-2 text-sm items-center text-white ">
      {displayBid} Cr - {highestBidder || "Base Price"}
    </span>
  );
};

export default AnimateBid;
