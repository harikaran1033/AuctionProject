// src/utils/players.js

export const isForeign = (dataset, nation) => {
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

export const getIncrement = (currentBid) => {
  if (currentBid >= 20) return 2;
  if (currentBid >= 10) return 1;
  return 0.5;
};
