/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-control-regex */
/* eslint-disable react-hooks/rules-of-hooks */
// WikiPlayerStats.jsx
/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";

function detectName(player) {
  if (!player) return "";
  // existing common keys
  const raw =
    player.name ||
    player.NAME ||
    player.fullName ||
    player.displayName ||
    player.title ||
    player.playerName ||
    "";
  return typeof raw === "string" ? raw.trim() : "";
}

function normalizeTitle(name) {
  if (!name) return "";
  // remove weird control chars and collapse whitespace
  const cleaned = name
    .replace(/[\u0000-\u001F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";

  // If already Title Case-ish (first letter uppercase and not all upper), just return cleaned
  const words = cleaned.split(" ");
  const allUpper = cleaned === cleaned.toUpperCase();
  if (!allUpper && /^[A-Z][a-z]/.test(cleaned)) return cleaned;

  // Otherwise make Title Case (first letter upper, rest lower for each word)
  const title = words
    .map((w) =>
      // keep single-letter initials (e.g. "K."), preserve punctuation
      w.length === 1
        ? w.toUpperCase()
        : w[0].toUpperCase() + w.slice(1).toLowerCase()
    )
    .join(" ");
  return title;
}

/* Simple safe printing helper */
const safe = (v) =>
  v === null || v === undefined || v === "" ? "-" : String(v);

/* AnimatedNumber component: animates when numeric-ish values are given */
import { useMotionValue, useSpring } from "framer-motion";
function AnimatedNumber({ value, duration = 900, decimals = null }) {
  const raw = value ?? "";
  const str = String(raw).trim();

  // match numbers with optional commas and decimals
  const numericMatch = str.match(/^(-?\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d+))?$/);
  if (!numericMatch) {
    // Not a plain numeric token — just render the raw text
    return (
      <div className="text-sm font-semibold text-white tabular-nums">
        {safe(raw)}
      </div>
    );
  }

  const integerPart = numericMatch[1].replace(/,/g, "");
  const fraction = numericMatch[2] ?? null;
  const target = parseFloat(`${integerPart}${fraction ? "." + fraction : ""}`);
  const precision = decimals ?? (fraction ? fraction.length : 0);

  const mv = useMotionValue(0);
  // more springy for numbers
  const spring = useSpring(mv, { stiffness: 140, damping: 28, mass: 1 });

  const [display, setDisplay] = useState(() =>
    precision > 0 ? (0).toFixed(precision) : "0"
  );

  useEffect(() => {
    // set to 0 instantly then animate to target
    mv.set(0);
    const unsub = spring.on("change", (v) => {
      if (precision > 0) setDisplay(Number(v).toFixed(precision));
      else setDisplay(String(Math.round(v)));
    });
    // animate to target
    mv.set(target);
    return () => unsub();
  }, [target, precision, mv, spring]);

  const formatted = () => {
    if (precision > 0) {
      const parts = display.split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return parts.join(".");
    }
    return display.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  return (
    <div className="text-sm font-semibold text-white tabular-nums">
      {formatted()}
    </div>
  );
}

// Which dataset keys are "league" T20 competitions
const LEAGUE_DATASETS = new Set(["ipl", "bbl", "sa20", "cpl", "hundreds"]);

// Normalize strings
const containsAny = (str, arr) => {
  const s = (str || "").toLowerCase();
  return arr.some((a) => s.includes(a.toLowerCase()));
};

// Preferred format detectors
function isT20Table(tbl) {
  const title = (tbl.title || "").toLowerCase();
  const headers = (tbl.headers || []).join(" ").toLowerCase();
  // pivoted career tables often titled "T20I (Career)" or "T20 (Career)"
  return (
    /t20i|t20|t20 career|t20i career/.test(title) || /t20i|t20/.test(headers)
  );
}
function isODITable(tbl) {
  const title = (tbl.title || "").toLowerCase();
  const headers = (tbl.headers || []).join(" ").toLowerCase();
  return /odi|odi career/.test(title) || /odi/.test(headers);
}
function isTestTable(tbl) {
  const title = (tbl.title || "").toLowerCase();
  const headers = (tbl.headers || []).join(" ").toLowerCase();
  return /\btest\b|test career/.test(title) || /test/.test(headers);
}

// Main selector: returns an array (possibly empty or null) of chosen tables
function selectStatsForDataset(parsedStats = [], datasetKey) {
  if (!parsedStats || !parsedStats.length) return null;
  const dk = (datasetKey || "").toLowerCase().trim();

  // 1) If dataset maps explicitly to a league label, prefer exact matches (matchesDataset)
  if (dk) {
    const exactMatches = parsedStats.filter((tbl) => matchesDataset(tbl, dk));
    if (exactMatches.length) return exactMatches;
  }

  // 2) If dataset is a league (ipl/bbl/sa20/cpl/hundreds), prefer T20 career tables
  if (LEAGUE_DATASETS.has(dk)) {
    const t20s = parsedStats.filter(isT20Table);
    if (t20s.length) return t20s;

    // if none, try fuzzy header/title match for "T20" tokens
    const fuzzyT20 = parsedStats.filter((tbl) => {
      const txt = (
        tbl.title +
        " " +
        (tbl.headers || []).join(" ") +
        " " +
        (tbl.rows?.[0] ? Object.values(tbl.rows[0]).join(" ") : "")
      ).toLowerCase();
      return /t20|t20i|twenty20|ipl|big bash|bbl|sa20|caribbean premier league|cpl/.test(
        txt
      );
    });
    if (fuzzyT20.length) return fuzzyT20;

    // none found → fall through to career fallback below
  }

  // 3) If dataset explicitly requests a format, return only that format (ODI/T20/Test)
  if (dk === "odi") {
    const odi = parsedStats.filter(isODITable);
    if (odi.length) return odi;
    // try fuzzy
    const fuzzyOdi = parsedStats.filter((tbl) =>
      (tbl.title + " " + (tbl.headers || []).join(" "))
        .toLowerCase()
        .includes("odi")
    );
    if (fuzzyOdi.length) return fuzzyOdi;
  }

  if (dk === "t20" || dk === "t20i") {
    const t20 = parsedStats.filter(isT20Table);
    if (t20.length) return t20;
    const fuzzy = parsedStats.filter((tbl) =>
      (tbl.title + " " + (tbl.headers || []).join(" "))
        .toLowerCase()
        .includes("t20")
    );
    if (fuzzy.length) return fuzzy;
  }

  if (dk === "test") {
    const test = parsedStats.filter(isTestTable);
    if (test.length) return test;
    const fuzzyTest = parsedStats.filter((tbl) =>
      (tbl.title + " " + (tbl.headers || []).join(" "))
        .toLowerCase()
        .includes("test")
    );
    if (fuzzyTest.length) return fuzzyTest;
  }

  // 4) No specific matches — try to return a 'career' summary table first
  const career = parsedStats.filter((tbl) =>
    /career|career statistics|career summary|career totals/i.test(tbl.title)
  );
  if (career.length) return career;

  // 5) Try heuristic header match (has Mat/Matches and Runs etc)
  const headerHeuristic = parsedStats.filter((tbl) => {
    const headersText = (tbl.headers || []).join(" ").toLowerCase();
    return /mat|matches|runs|wkts|avg|inns|wickets/.test(headersText);
  });
  if (headerHeuristic.length) return headerHeuristic;

  // 6) final fallback: return the first parsed table
  return [parsedStats[0]];
}



function cleanText(s) {
  if (!s) return "";
  let t = String(s).trim().replace(/\s+/g, " ");

  // If it looks like a nav-list of capitalized names (many cap words), truncate early
  const tokens = t.split(/\s+/);
  const sampleTokens = tokens.slice(0, 500);
  const capWords = sampleTokens.filter(w => /^[A-Z][a-z]{1,40}$/.test(w)).length;
  if (sampleTokens.length > 200 && capWords / sampleTokens.length > 0.45) {
    t = sampleTokens.slice(0, 120).join(" ") + " …";
  }

  // Remove leading CSS/template blocks: if it starts with dot/class or has many braces early
  if (/^\s*\.[\w\-.#]/.test(t) || (t.slice(0, 200).includes("{") && t.slice(0,200).match(/{/))) {
    const prefix = t.slice(0, 2000);
    const idx = prefix.lastIndexOf("}");
    if (idx !== -1) {
      t = t.slice(idx + 1).trim();
    } else {
      // drop the first big chunk
      t = t.replace(/^[\s\S]{0,2000}/, "").trim();
    }
  }

  // Remove patterns like ".mw-parser-output ... }" if still present
  t = t.replace(/^\.*mw-parser-output[\s\S]*?}/i, "").trim();

  // final truncate for safety
  if (t.length > 1000) t = t.slice(0, 1000) + "…";

  return t || "-";
}



/* ---------- Updated parseStatsFromDocument (replace existing) ---------- */

function parseStatsFromDocument(doc) {
  // look for tables that look like career stats:
  // - caption contains 'Career' / 'Career statistics' / 'Career summary'
  // - OR header row contains common cricket stat tokens: Mat, Runs, Wkts, Inn, Avg, SR, HS
  const headerKeywords = [
    "Mat",
    "Matches",
    "Runs",
    "Wkts",
    "Wickets",
    "Inns",
    "Inn",
    "Avg",
    "SR",
    "HS",
    "Runs scored",
  ];
  let allTables = Array.from(doc.querySelectorAll("table"));
// filter out template/nav/template tables and tiny trivial tables
const candidateTables = allTables.filter(t => {
  if (!t || !t.textContent) return false;
  // skip if flagged earlier
  if (typeof doc._skipTableIfTemplate === "function" && doc._skipTableIfTemplate(t)) return false;

  const rows = t.querySelectorAll("tr").length;
  if (rows < 2) return false; // tiny tables are unlikely stats

  const cells = Array.from(t.querySelectorAll("td,th"));
  // fast heuristics: count link-only cells and numeric-like cells
  let linkOnlyCount = 0;
  let numericLikeCount = 0;
  for (let i = 0; i < Math.min(cells.length, 50); i++) {
    const c = cells[i];
    const tc = (c.textContent || "").trim();
    if (!tc) continue;
    if (c.querySelectorAll && c.querySelectorAll("a").length > 0 && tc.length < 80 && /^[A-Za-z0-9\-,\s]+$/.test(tc)) {
      linkOnlyCount++;
    }
    if (/[0-9]{1,2}\s?%?|matches|runs|wickets|avg|innings|catches|stumpings|top score|balls bowled|runs scored/.test(tc.toLowerCase())) {
      numericLikeCount++;
    }
  }

  // mostly-links -> navbox-like
  if (linkOnlyCount > (cells.length * 0.35)) return false;
  // if no numeric-like tokens AND table is huge -> skip as nav/template
  if (numericLikeCount === 0 && rows > 30) return false;

  return true;
});


  const isStatTable = (table) => {
    // caption check
    const cap = table.querySelector("caption");
    if (
      cap &&
      /career|statistics|summary|competition/i.test(cap.textContent.trim())
    )
      return true;

    // header cells check (first thead row or first tr)
    const headerRow =
      table.querySelector("thead tr") || table.querySelector("tr");
    if (!headerRow) return false;
    const headers = Array.from(headerRow.querySelectorAll("th,td")).map((th) =>
      th.textContent.trim().toLowerCase()
    );

    // 1) If header contains obvious metric tokens -> stats table
    const metricHits = headers.filter((h) =>
      [
        "mat",
        "matches",
        "runs",
        "wkts",
        "wickets",
        "inns",
        "inn",
        "avg",
        "sr",
        "hs",
        "runs scored",
        "matches/innings",
      ].some((k) => h.includes(k))
    );
    if (metricHits.length >= 2) return true;

    // 2) MATRIX detection: header contains 'competition' or many format names (Test/ODI/T20I/FC/LA)
    const formatTokens = [
      "competition",
      "format",
      "test",
      "odi",
      "t20i",
      "t20",
      "fc",
      "la",
      "first-class",
      "list a",
      "list-a",
    ];
    const formatHits = headers.filter((h) =>
      formatTokens.some((t) => h.includes(t))
    );
    if (formatHits.length >= 2) return true;

    // 3) Additional first-column heuristic: if many rows start with metric-like labels (Matches, Runs, Batting average...)
    const rows = Array.from(table.querySelectorAll("tr")).slice(1); // skip header
    let firstColMetricCount = 0;
    for (const r of rows.slice(0, 8)) {
      const c = r.querySelector("th,td");
      if (!c) continue;
      const txt = (c.textContent || "").trim().toLowerCase();
      if (
        /matches|runs|batting average|100s|50s|catches|stumpings|top score|runs scored|balls bowled|wickets|bowling average/.test(
          txt
        )
      )
        firstColMetricCount++;
    }
    if (firstColMetricCount >= 2) return true;

    return false;
  };

  // parseTable now may return an array of parsed table objects (to support pivoting)
  const parseTable = (table) => {
    // get header row (thead or first tr)
    let headerCells = Array.from(table.querySelectorAll("thead tr th"));
    if (!headerCells.length) {
      const firstRow = table.querySelector("tr");
      if (firstRow)
        headerCells = Array.from(firstRow.querySelectorAll("th,td"));
    }
    const headers = headerCells
      .map((th) => th.textContent.trim())
      .filter(Boolean);

    // gather body rows (skip header row when appropriate)
    let bodyRows = Array.from(table.querySelectorAll("tbody tr"));
    if (!bodyRows.length) {
      const allRows = Array.from(table.querySelectorAll("tr"));
      // if we used the first row as headers, drop it
      if (allRows.length > 1 && headerCells.length) bodyRows = allRows.slice(1);
      else bodyRows = allRows;
    }

    // Standardize cell text
    const rowsCells = bodyRows
      .map((tr) =>
        Array.from(tr.querySelectorAll("th,td")).map((c) =>
          c.textContent.trim().replace(/\s+/g, " ")
        )
      )
      .filter((r) => r.length > 0);

    // Heuristic: matrix table (first header cell 'Competition' or 'Format')
    const firstHeader = (headers[0] || "").toLowerCase();
    if (
      headers.length > 1 &&
      /(competition|format|team|league)/i.test(firstHeader)
    ) {
      // headers: [ 'Competition', 'ODI', 'T20I', 'FC', 'LA' ] etc.
      const formats = headers.slice(1).map((h) => h || "Unknown");

      // rowsCells are like:
      // [ ['Matches','61','106','5','98'], ['Runs scored','1983','2275','319','3048'], ... ]
      // Pivot -> create one table per format with rows = [{ Metric: 'Matches', Value: '61' }, ...]
      const pivoted = formats.map((fmt, idx) => {
        const rows = rowsCells
          .map((cells) => {
            const metric = cells[0] || `Metric`;
            const value = cells[1 + idx] ?? "";
            return { Metric: metric, Value: value };
          })
          .filter(Boolean);
        return {
          title: `${fmt} (Career)`,
          headers: ["Metric", "Value"],
          rows,
        };
      });

      // Return an array of tables (one per format)
      return pivoted;
    }

    // --- fallback: regular row-based table (headers as columns) ---
    const effectiveHeaders = headers.length
      ? headers
      : (rowsCells[0] || []).map((_, i) => `col${i}`);

    const parsed = rowsCells
      .map((cells) => {
        const obj = {};
        for (let i = 0; i < cells.length; i++) {
          const key = effectiveHeaders[i] || `col${i}`;
          obj[key] = cells[i] ?? "";
        }
        return obj;
      })
      .filter(Boolean);

    const caption = table.querySelector("caption")?.textContent?.trim() || null;
    let title = caption;
    if (!title) {
      const prev = table.previousElementSibling;
      if (prev && /h[1-6]/i.test(prev.tagName)) title = prev.textContent.trim();
    }
    if (!title) title = "Career statistics";

    // return array for consistency with pivot behavior
    return [{ title, headers: effectiveHeaders, rows: parsed }];
  };

  const stats = [];
  for (const t of candidateTables) {
    try {
      if (isStatTable(t)) {
        // parseTable may return an array; flatten into stats
        const parsedArr = parseTable(t);
        if (Array.isArray(parsedArr) && parsedArr.length)
          stats.push(...parsedArr);
      }
    } catch (e) {
      // ignore parse errors for a given table
      // optionally log: console.warn("parseStatsFromDocument table parse failed", e);
    }
  }

  return stats.length ? stats : null;
}

/**
 * parseInfoboxFromDocument(doc, datasetKey)
 *
 * datasetKey: optional string like 'ipl','bbl','odi','t20','test' etc.
 *
 * Behavior:
 * - always removes Relations and Competition rows
 * - if datasetKey is a league (ipl/bbl/sa20/cpl/hundreds) -> remove international / debut / last-* rows
 * - if datasetKey is an international format (odi, t20, t20i, test) -> keep personal info + only rows that mention that format
 */
function parseInfoboxFromDocument(doc, datasetKey = null) {
  // league set (keep in sync with LEAGUE_DATASETS)
  const leagueSet = new Set(["ipl", "bbl", "sa20", "cpl", "hundreds"]);
  const isLeague =
    !!datasetKey && leagueSet.has(datasetKey.toLowerCase().trim());
  const formatKey = (datasetKey || "").toLowerCase().trim(); // 'odi','t20','t20i','test',...

  const norm = (s) => (s || "").toString().replace(/\s+/g, " ").trim();

  // filtering regexes
  const relationsRe = /\brelations?\b/i;
  const competitionRe = /\bcompetition(s)?\b/i;
  const domesticTeamRe =
    /\b(domestic team|domestic team information|years\s*team|teams?)\b/i;
  const internationalRe =
    /\b(national|international|national side|national team|international information)\b/i;
  const debutOrLastRe = /\b(debut|last|cap|debut\(|cap\s*\d+)/i;

  // Shirt label patterns to match which shirt row corresponds to which format
  const shirtPatterns = {
    odi: [/odi/i, /\bone[- ]day\b/i],
    t20: [
      /\bt20i\b/i,
      /\bt20\b/i,
      /t20 shirt/i,
      /t20i shirt/i,
      /shirt no\.\s*\(t20/i,
    ],
    test: [/\btest\b/i, /test shirt/i],
    generic: [/shirt no/i, /shirt number/i, /shirt #/i],
  };

  // decide if a shirt label should be kept for this dataset
  function shouldKeepShirt(label) {
    const L = label.toLowerCase();
    // If formatKey present, keep only that format's shirt
    if (formatKey === "odi") {
      return shirtPatterns.odi.some((r) => r.test(L)) || /odi shirt/i.test(L);
    }
    if (formatKey === "t20" || formatKey === "t20i") {
      return shirtPatterns.t20.some((r) => r.test(L)) || /t20 shirt/i.test(L);
    }
    if (formatKey === "test") {
      return shirtPatterns.test.some((r) => r.test(L)) || /test shirt/i.test(L);
    }
    // If league dataset: prefer T20 shirt rows (T20/T20I/generic)
    if (isLeague) {
      return (
        shirtPatterns.t20.some((r) => r.test(L)) ||
        shirtPatterns.generic.some((r) => r.test(L))
      );
    }
    // No datasetKey: keep any shirt row (but still filtered by other rules)
    return (
      shirtPatterns.odi.some((r) => r.test(L)) ||
      shirtPatterns.t20.some((r) => r.test(L)) ||
      shirtPatterns.test.some((r) => r.test(L)) ||
      shirtPatterns.generic.some((r) => r.test(L))
    );
  }

  // decide whether to include a label row based on datasetKey and label text
  function includeLabel(label) {
    const L = (label || "").toString();

    // always drop relations and competition rows & domestic team rows
    if (relationsRe.test(L) || competitionRe.test(L) || domesticTeamRe.test(L))
      return false;

    // If league dataset -> hide international info (debut/last/cap/national)
    if (isLeague) {
      if (internationalRe.test(L) || debutOrLastRe.test(L)) return false;
      // For shirt numbers: only keep if it's T20/generic
      if (/shirt/i.test(L)) return shouldKeepShirt(L);
      return true;
    }

    // If specific format
    if (formatKey === "odi") {
      // Personal info allowed
      if (
        /full name|born|height|batting|bowling|role|nickname|personal information|born/i.test(
          L
        )
      )
        return true;
      // Keep ODI-specific rows (ODI debut, Last ODI, ODI shirt etc.)
      if (/\bodi\b|one[- ]day/i.test(L)) return true;
      // drop other format-specific or general international fields
      if (debutOrLastRe.test(L) || internationalRe.test(L))
        return /\bodi\b/i.test(L);
      // otherwise drop
      return false;
    }

    if (formatKey === "t20" || formatKey === "t20i") {
      if (
        /full name|born|height|batting|bowling|role|nickname|personal information|born/i.test(
          L
        )
      )
        return true;
      if (/\bt20i\b|\bt20\b|twenty ?20|ipl|big bash|bbl|sa20/.test(L))
        return true;
      if (debutOrLastRe.test(L) || internationalRe.test(L))
        return /\bt20i?\b|t20|twenty ?20/i.test(L);
      return false;
    }

    if (formatKey === "test") {
      if (
        /full name|born|height|batting|bowling|role|nickname|personal information|born/i.test(
          L
        )
      )
        return true;
      if (/\btest\b/i.test(L)) return true;
      if (debutOrLastRe.test(L) || internationalRe.test(L))
        return /\btest\b/i.test(L);
      return false;
    }

    // No datasetKey — include everything except relations/competition/domestic
    return true;
  }

  // locate infobox table
  const selectors = [
    "table.infobox",
    "table.infobox_v2",
    "table.vcard",
    "table.infobox.vevent",
    "table.infobox.biography",
    "table.infobox.biography.vcard",
    "table.wikitable.infobox",
    "aside.infobox",
    "table.table-infobox",
  ];

  let table = null;
  for (const sel of selectors) {
    table = doc.querySelector(sel);
    if (table) break;
  }

  if (!table) {
    table = Array.from(doc.querySelectorAll("table")).find((t) =>
      Array.from(t.classList).some(
        (c) => c && c.toLowerCase().includes("infobox")
      )
    );
  }
  if (!table) return null;

  const rows = [];
  for (const tr of Array.from(table.querySelectorAll("tr"))) {
    const th = tr.querySelector("th");
    const td = tr.querySelector("td");

    let label = "";
    let value = "";

   if (th && td) {
  label = cleanText(th.textContent);
  value = cleanText(td.textContent);
    } else if (td && td.querySelector("b, strong")) {
      const b = td.querySelector("b, strong");
      label = norm(b.textContent);
      const raw = td.textContent.replace(b.textContent, "").trim();
      value = raw.replace(/\s+/g, " ") || "-";
    } else {
      const tds = tr.querySelectorAll("td");
      if (tds.length >= 2) {
        label = norm(tds[0].textContent);
        value = tds[1].textContent.trim().replace(/\s+/g, " ");
      }
    }

    if (!label) continue;
    if (!includeLabel(label)) continue;

    // For shirts: if label is generic 'Shirt no.' but datasetKey requests a specific format shirt, we may want to rename the label
    // e.g., if datasetKey is 'odi' and label 'Shirt no.' exists but also 'ODI shirt no.' exists, prefer the format-specific one
    rows.push({ label, value });
  }

  // Post-process shirt rows: prefer format-specific shirt if multiple present
  // Collect shirt rows indexes
  const shirtIdxs = rows
    .map((r, i) => ({ i, l: r.label.toLowerCase() }))
    .filter((x) => /shirt|shirt no|shirt number|shirt #/.test(x.l));
  if (shirtIdxs.length > 1 && formatKey) {
    // try to find format-specific one
    let keepIdx = null;
    for (const { i, l } of shirtIdxs) {
      if (formatKey === "odi" && /odi/.test(l)) {
        keepIdx = i;
        break;
      }
      if (
        (formatKey === "t20" || formatKey === "t20i") &&
        /t20|t20i|twenty ?20|ipl|bbl|sa20/.test(l)
      ) {
        keepIdx = i;
        break;
      }
      if (formatKey === "test" && /test/.test(l)) {
        keepIdx = i;
        break;
      }
    }
    // For league, prefer t20 shirt
    if (keepIdx === null && isLeague) {
      for (const { i, l } of shirtIdxs) {
        if (/t20|t20i|ipl|bbl|sa20/.test(l)) {
          keepIdx = i;
          break;
        }
      }
    }

    if (keepIdx !== null) {
      // remove other shirt entries except keepIdx
      for (let j = rows.length - 1; j >= 0; j--) {
        if (
          /shirt|shirt no|shirt number|shirt #/i.test(rows[j].label) &&
          j !== keepIdx
        ) {
          rows.splice(j, 1);
        }
      }
    }
  }

  return rows.length ? rows : null;
}

// map datasets to likely labels that appear on Wikipedia pages
const DATASET_LABELS = {
  ipl: [
    "ipl",
    "indian premier league",
    "ipl (india)",
    "indi an premier league",
  ],
  bbl: ["bbl", "big bash", "big bash league", "big bash league (bbl)"],
  sa20: ["sa20", "sa 20", "south africa t20", "sa20 (south africa)"],
  psl: ["psl", "pakistan super league", "pakistan super league (psl)"],
  cpl: ["cpl", "caribbean premier league", "caribbean premier league (cpl)"],
  hbl: ["hbl", "hbl psl"], // add as needed
  // add more mappings you need...
};

// normalize a string for comparison
function norm(s) {
  return (s || "").toString().replace(/\s+/g, " ").trim().toLowerCase();
}

// Decide whether a parsed stats table matches the dataset
function matchesDataset(table, dataset) {
  if (!dataset) return false;
  const labels = DATASET_LABELS[dataset] || [dataset];

  // check table title
  const title = norm(table.title);
  for (const lbl of labels) {
    if (title.includes(norm(lbl))) return true;
  }

  // check headers and first column cells
  const headers = (table.headers || []).map(norm).join(" ");
  for (const lbl of labels) {
    if (headers.includes(norm(lbl))) return true;
  }

  // check row first-column values (often the leftmost column lists formats/leagues)
  if (table.rows && table.rows.length) {
    for (const r of table.rows) {
      // take first key's value
      const firstKey = Object.keys(r)[0];
      const v = norm(r[firstKey]);
      for (const lbl of labels) {
        if (v.includes(norm(lbl))) return true;
      }
    }
  }

  return false;
}

/* ----------------- NEW: pickMetricsForFormat -----------------
   Given a parsed table and the datasetKey/type, return a normalized
   small table containing only the allowed metrics (Metric / Value).
   This keeps your parsing logic intact and just trims what is shown.
----------------------------------------------------------------*/
const METRIC_SETS = {
  // canonical labels we want to show for career T20I/T20/league
  t20: [
    "competition",
    "t20i",
    "matches",
    "mat",
    "runs scored",
    "runs",
    "batting average",
    "avg",
    "100s/50s",
    "100s/50s",
    "top score",
    "balls bowled",
    "wickets",
    "wkts",
    "bowling average",
    "best bowling",
    "5 wickets in innings",
    "5w",
    "10 wickets in match",
    "10w",
    "catches/stumpings",
    "catches",
  ],
  // ODI set (similar keys)
  odi: [
    "competition",
    "matches",
    "mat",
    "runs scored",
    "runs",
    "batting average",
    "avg",
    "100s/50s",
    "top score",
    "balls bowled",
    "wickets",
    "bowling average",
    "best bowling",
    "catches/stumpings",
  ],
  // Test set
  test: [
    "competition",
    "matches",
    "mat",
    "runs scored",
    "runs",
    "batting average",
    "avg",
    "100s/50s",
    "top score",
    "balls bowled",
    "wickets",
    "bowling average",
    "best bowling",
    "catches/stumpings",
  ],
};

// helper to normalize keys (strip punctuation & lower)
function canonicalKey(k) {
  if (!k) return "";
  return k
    .toString()
    .replace(/[:\u2013\u2014–—]/g, " ")
    .replace(/[^\w\s/]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// return a normalized small table { title, headers: ['Metric','Value'], rows: [{Metric, Value}, ...] }
function pickMetricsForFormat(table, datasetKey) {
  if (!table || !table.rows || !table.rows.length) return null;

  const dk = (datasetKey || "").toLowerCase().trim();
  let wanted = METRIC_SETS.t20;
  if (dk === "odi") wanted = METRIC_SETS.odi;
  if (dk === "test") wanted = METRIC_SETS.test;
  if (LEAGUE_DATASETS.has(dk)) wanted = METRIC_SETS.t20; // leagues use t20 set

  // If datasetKey unspecified, attempt to infer from table title
  const titleLower = (table.title || "").toLowerCase();
  if (!dk) {
    if (titleLower.includes("odi")) wanted = METRIC_SETS.odi;
    else if (titleLower.includes("test")) wanted = METRIC_SETS.test;
    else wanted = METRIC_SETS.t20;
  }

  const normalizedRows = [];

  // table may already be in Metric-Value form (pivoted) or columnar
  // Try to map first column -> metric name, second column -> value
  for (const r of table.rows) {
    const firstKey = Object.keys(r)[0];
    const secondKey = Object.keys(r)[1] ?? Object.keys(r)[0];
    const rawMetric = (r[firstKey] ?? "").toString().trim();
    const rawValue = (r[secondKey] ?? "").toString().trim();

    const ck = canonicalKey(rawMetric);

    // Check if canonical metric matches any wanted token (loose contains)
    const matchesWanted = wanted.some((w) => ck.includes(canonicalKey(w)));
    if (matchesWanted) {
      // Normalize label: prefer a cleaned human label
      let label = rawMetric
        .replace(/\s+/g, " ")
        .replace(/[:\u2013\u2014]/g, " ")
        .trim();
      // Some metrics come like "100s/50s" already fine; ensure consistent casing
      if (/100s\/50s/i.test(label)) label = "100s/50s";
      if (/top\s*score/i.test(label)) label = "Top score";
      if (/balls\s*bowled/i.test(label)) label = "Balls bowled";
      if (/wickets|wkts/i.test(label)) label = "Wickets";
      if (/batting average|avg/i.test(label)) label = "Batting average";
      if (/bowling average/i.test(label)) label = "Bowling average";
      if (/best bowling|best/i.test(label)) label = "Best bowling";
      if (/catches\/stumpings|catches|stumpings/i.test(label))
        label = "Catches/stumpings";
      if (/competition/i.test(label)) label = "Competition";

      normalizedRows.push({ Metric: label, Value: rawValue || "-" });
    }
  }

  // Deduplicate keeping first occurrence of each Metric
  const seen = new Set();
  const deduped = [];
  for (const rr of normalizedRows) {
    const k = canonicalKey(rr.Metric);
    if (!seen.has(k)) {
      deduped.push(rr);
      seen.add(k);
    }
  }

  // If there are no matches but the table already looks like "Metric/Value", keep top sensible rows (fallback)
  if (!deduped.length) {
    // Try a fallback: take rows whose metric looks numeric-like or common tokens
    for (const r of table.rows.slice(0, 20)) {
      const firstKey = Object.keys(r)[0];
      const secondKey = Object.keys(r)[1] ?? Object.keys(r)[0];
      const rawMetric = (r[firstKey] ?? "").toString().trim();
      const rawValue = (r[secondKey] ?? "").toString().trim();
      const ck2 = canonicalKey(rawMetric);
      if (
        /matches|mat|runs|wickets|wkts|avg|batting average|top score|balls bowled|best bowling|catches/.test(
          ck2
        )
      ) {
        deduped.push({ Metric: rawMetric, Value: rawValue || "-" });
      }
    }
  }

  if (!deduped.length) return null;

  // Ensure the title indicates the format properly (prefer table.title)
  const outTitle = table.title || "Career statistics";

  return { title: outTitle, headers: ["Metric", "Value"], rows: deduped };
}

/* ----------------- MAIN COMPONENT ----------------- */

export default function WikiPlayerStats({
  player,
  room,
  lang = "en",
  maxEntries = 8,
}) {
  const rawName = detectName(player);
  const name = normalizeTitle(rawName).trim();
  console.log("[WikiPlayerStats] rawName:", rawName, "normalized:", name);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState(null);
  const [pageUrl, setPageUrl] = useState(null);
  const [error, setError] = useState(null);
  const [statsTables, setStatsTables] = useState(null);

  useEffect(() => {
    let ignore = false;
    const raw = rawName; // rawName is defined above
    const resolvedName = name; // normalized Title Case name

    if (!resolvedName) {
      setRows(null);
      setPageUrl(null);
      setError("Player name missing");
      return;
    }

    async function fetchPage() {
      setLoading(true);
      setError(null);
      setRows(null);
      setPageUrl(null);
      setStatsTables(null);

      const titleForUrl = resolvedName.replace(/\s+/g, "_");
      const encoded = encodeURIComponent(titleForUrl);
      const htmlUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/html/${encoded}`;

      try {
        const res = await fetch(htmlUrl, { headers: { Accept: "text/html" } });
        console.log("[WikiPlayerStats] fetch", htmlUrl, "status", res.status);

        if (!res.ok) {
          if (res.status === 404) {
            console.warn(
              "[WikiPlayerStats] HTML endpoint 404, trying summary endpoint"
            );
            const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
            const sres = await fetch(summaryUrl, {
              headers: { Accept: "application/json" },
            });
            if (sres.ok) {
              const json = await sres.json();
              if (ignore) return;
              setPageUrl(
                json.content_urls?.desktop?.page ||
                  `https://${lang}.wikipedia.org/wiki/${titleForUrl}`
              );
              const fallbackRows = [];
              if (json.description)
                fallbackRows.push({
                  label: "Description",
                  value: json.description,
                });
              if (json.extract)
                fallbackRows.push({ label: "Summary", value: json.extract });
              setRows(fallbackRows.slice(0, maxEntries));
              setStatsTables(null);
              setLoading(false);
              return;
            } else {
              throw new Error(
                `Summary endpoint failed (status ${sres.status})`
              );
            }
          }
          throw new Error(
            `Failed to load Wikipedia HTML (status ${res.status})`
          );
        }

        const html = await res.text();
        console.log("[WikiPlayerStats] html length", html.length);
        if (ignore) return;

        const parser = new DOMParser();
const doc = parser.parseFromString(html, "text/html");

// ---------- SANITIZE DOM (remove style/script/template/navboxes/comments) ----------
Array.from(doc.querySelectorAll("style, script, noscript, iframe, svg")).forEach(n => n.remove());

// common wiki template/nav selectors that inject lots of unrelated content
const REMOVE_SELECTORS = [
  ".navbox",
  ".vertical-navbox",
  ".metadata",
  ".toc",
  ".hatnote",
  ".mw-references-wrap",
  ".references",
  ".reference",
  ".reflist",
  ".sisterproject",
  ".succession-box",
  ".infobox .hlist",
  ".hlist",
  ".plainlist",
  ".mw-parser-output .hlist",
  ".mw-parser-output .plainlist",
  ".mw-parser-output .mw-empty-elt",
  ".ambox",
  ".navbox-inner",
  ".navbox-list",
  ".mw-collapsible"
];
REMOVE_SELECTORS.forEach(sel => {
  Array.from(doc.querySelectorAll(sel)).forEach(n => n.remove());
});

// remove HTML comment nodes
const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_COMMENT, null, false);
const comments = [];
while (walker.nextNode()) comments.push(walker.currentNode);
comments.forEach(c => c.parentNode && c.parentNode.removeChild(c));

// flagging helper to detect template/nav tables to skip later
doc._skipTableIfTemplate = (table) => {
  if (!table) return true;
  const cls = (table.className || "").toLowerCase();
  if (cls.includes("navbox") || cls.includes("vertical-navbox") || cls.includes("succession-box")) return true;

  const txt = (table.textContent || "").slice(0, 3000).toLowerCase();
  // if very long text but no stat-like tokens, treat as template/nav
  if (txt.length > 2000 && !/matches|runs|wickets|batting|bowling|average|innings|catches|stumpings|overs|runs scored|top score/.test(txt)) {
    return true;
  }

  // if first cell looks like nav list (many commas, or contains "(Test, ODI)" pattern), skip
  const firstCell = table.querySelector("tr td, tr th");
  if (firstCell) {
    const sample = (firstCell.textContent || "").trim();
    if ((sample.match(/,/g) || []).length > 6 || /test,?\s*odi|odi,?\s*t20/i.test(sample)) return true;
  }

  return false;
};


        // single declaration/place for datasetKey
        const datasetKey =
          room?.dataset?.toString().toLowerCase()?.trim() || null;

        // parse infobox with dataset-aware filtering (shirt rules etc.)
        const parsedRows = parseInfoboxFromDocument(doc, datasetKey);
        const parsedStats = parseStatsFromDocument(doc);

        // determine canonical URL BEFORE using it
        let canonical = null;
        const link = doc.querySelector("link[rel=canonical]");
        if (link && link.href) canonical = link.href;
        else canonical = `https://${lang}.wikipedia.org/wiki/${titleForUrl}`;

        // debug what parser returned
        console.log("[WikiPlayerStats] datasetKey:", datasetKey);
        console.log(
          "[WikiPlayerStats] parsedRows length",
          parsedRows ? parsedRows.length : 0
        );
        console.log(
          "[WikiPlayerStats] parsedStats length",
          parsedStats ? parsedStats.length : 0
        );
        if (parsedStats && parsedStats.length) {
          console.log(
            "[WikiPlayerStats] parsedStats titles:",
            parsedStats.map((s) => s.title)
          );
        }

        // set states once, in deterministic order
        setPageUrl(canonical);
        if (parsedRows && parsedRows.length)
          setRows(parsedRows.slice(0, maxEntries));
        else setRows(null);

        // select stats per dataset rules (selectStatsForDataset must exist)
        const selected = selectStatsForDataset(parsedStats, datasetKey);
        console.log(
          "[WikiPlayerStats] selected stats:",
          selected ? selected.map((s) => s.title) : null
        );

        // Apply the pickMetricsForFormat filter to each selected table so we only display the desired small set
        const filtered = (selected || [])
          .map((t) => pickMetricsForFormat(t, datasetKey))
          .filter(Boolean);

        setStatsTables(filtered);

        // If nothing found show helpful message
        if (
          (!parsedRows || !parsedRows.length) &&
          (!filtered || !filtered.length)
        ) {
          setError(
            datasetKey
              ? `No ${datasetKey.toUpperCase()} or matching career stats found on this page`
              : "No infobox or stats found on Wikipedia page"
          );
        } else {
          setError(null);
        }
      } catch (err) {
        console.error("[WikiPlayerStats] fetchPage error:", err);
        if (!ignore) {
          const msg =
            err.message && err.message.includes("Failed to load Wikipedia")
              ? err.message
              : "Error loading Wikipedia";
          setError(msg);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchPage();
    return () => {
      ignore = true;
    };
  }, [player, lang, maxEntries]);

  const headerName = name || "Unknown player";

   return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full mt-2"
    >
      {/* Grid container: stack on xs, side-by-side on sm+ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* ---------- Left: Compact Infobox (small, matches stats styling) ---------- */}
        <div className="bg-white/5 rounded-xl p-3 flex flex-col gap-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-emerald-500 truncate">Wikipedia</div>
              <div className="text-base font-semibold text-white">{headerName}</div>
            </div>
            <div className="text-right text-[12px] text-muted">
              <div className="text-[12px]">{player?.TEAM ?? player?.team ?? ""}</div>
              {pageUrl ? (
                <a
                  href={pageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"
                >
                  View on Wikipedia <ExternalLink className="w-3 h-3" />
                </a>
              ) : null}
            </div>
          </div>

          <div className="mt-1">
            {loading && (
              <div className="flex justify-center py-6">
                <span className="loading loading-spinner loading-lg text-primary"></span>
              </div>
            )}

            {!loading && error && (
              <div className="p-2 rounded-md bg-white/6 text-sm text-muted">
                {error}. You can still search Wikipedia manually.
              </div>
            )}

            {!loading && rows && (
              <div className="grid grid-cols-2 gap-2">
                {rows.map(({ label, value }) => (
                  <div
                    key={label}
                    className="bg-black/40 rounded-md px-2 py-2 flex flex-col min-h-[44px] justify-center"
                  >
                    <div className="text-sm font-semibold text-white tabular-nums">
                      {safe(value)}
                    </div>
                    <div className="text-[10px] text-muted uppercase tracking-wide mt-1">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && !rows && !error && (
              <div className="text-sm text-muted">No data available from Wikipedia infobox.</div>
            )}
          </div>

          <div className="mt-1 text-[11px] text-muted">
            <div>
              Content from Wikipedia is available under <strong>CC BY-SA 4.0</strong>.{" "}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                License
              </a>
              .
            </div>
          </div>
        </div>

        {/* ---------- Right: Stats Box (compact cards) ---------- */}
        <div className="bg-white/5 rounded-xl p-3 flex flex-col gap-3 shadow-sm">
          {!loading && statsTables && statsTables.length > 0 ? (
            <div className="w-full">
              <div className="grid grid-cols-1 gap-3">
                {statsTables.map((tbl, idx) => (
                  <div
                    key={idx}
                    className="bg-black/40 rounded-md p-3 flex flex-col gap-3"
                    aria-labelledby={`stats-${idx}`}
                  >
                    <div className="flex items-center justify-between">
                      <div id={`stats-${idx}`} className="text-sm font-semibold text-emerald-300">
                        {tbl.title}
                      </div>
                    </div>

                    <div className="w-full overflow-auto">
                      <div className="grid grid-cols-2 gap-2">
                        {tbl.rows.map((r, ridx) => {
                          const numeric =
                            /^(-?\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d+))?$/.test(
                              String(r.Value).trim()
                            );
                          return (
                            <div
                              key={ridx}
                              className="bg-white/6 rounded-md p-2 flex items-center justify-between"
                            >
                              <div className="text-[11px] text-muted">{r.Metric}</div>
                              <div className="ml-3 text-right">
                                {numeric ? (
                                  <AnimatedNumber value={r.Value} />
                                ) : (
                                  <div className="text-sm font-semibold text-white">
                                    {r.Value || "-"}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            !loading && (
              <div className="p-2 rounded-md bg-white/6 text-sm text-muted">
                No stats available.
              </div>
            )
          )}
        </div>
      </div>
    </motion.div>
  );

}
