import React, { useEffect, useState, useRef } from "react";
import CCC_prew from "../EventPrew/Rock.png";
import logo from "../images/CCC.jpg";
import sheriff from "../images/gameIcon/Sheriff.png";
import Don from "../images/gameIcon/Don.png";
import Golos from "../images/gameIcon/Golos.png";
import Strelba from "../images/gameIcon/Strelba.png";
import styles from "./gameWidget.module.css";



const SLOTS = 5;
const NEUTRAL_GRAY = "#6b7280";
const MAX_FOULS = 4;

/* ========= Утилиты ========= */

function extractNumbersFromAny(val, addNumber) {
  if (val == null) return;
  if (typeof val === "number" && Number.isFinite(val)) return addNumber(val);
  if (typeof val === "string") {
    const matches = val.match(/\d+/g);
    if (matches) matches.forEach((d) => addNumber(Number(d)));
    return;
  }
  if (Array.isArray(val)) return val.forEach((v) => extractNumbersFromAny(v, addNumber));
  if (typeof val === "object") Object.values(val).forEach((v) => extractNumbersFromAny(v, addNumber));
}

function extractDisplayTokensFromAny(val, addToken) {
  if (val == null) return;
  if (typeof val === "number" && Number.isFinite(val)) return addToken(val);
  if (typeof val === "string") {
    const digits = val.match(/\d+/g);
    if (digits && digits.length) digits.forEach((d) => addToken(Number(d)));
    else if (val.trim() === "-" || val.trim() === "—") addToken("-");
    return;
  }
  if (Array.isArray(val)) return val.forEach((v) => extractDisplayTokensFromAny(v, addToken));
  if (typeof val === "object") Object.values(val).forEach((v) => extractDisplayTokensFromAny(v, addToken));
}

function getDayNode(results, dayKey) {
  if (!results || typeof results !== "object") return null;
  if (dayKey && Object.prototype.hasOwnProperty.call(results, dayKey)) return results[dayKey];
  return results;
}

function dayIndex(k) {
  const m = String(k).match(/\d+/);
  return m ? Number(m[0]) : Infinity;
}

function hasDayPartitions(obj) {
  if (!obj || typeof obj !== "object") return false;
  return Object.keys(obj).some((k) => /\d+/.test(k));
}

function extractNumbersAtKeys(node, keys, addNumber) {
  if (!node || typeof node !== "object") return;
  keys.forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(node, k)) extractNumbersFromAny(node[k], addNumber);
  });
}

function getNumbersUpToDayByKeys(results, currentDayKey, keys, minId = 1, maxId = 100) {
  const out = new Set();
  const addNumber = (n) => {
    if (Number.isFinite(n) && n >= minId && n <= maxId) out.add(n);
  };
  if (!results || typeof results !== "object") return [];
  const curIdx = dayIndex(currentDayKey || "");
  if (hasDayPartitions(results)) {
    for (const k of Object.keys(results)) {
      if (dayIndex(k) <= curIdx) {
        const node = results[k];
        if (!keys?.length) extractNumbersFromAny(node, addNumber);
        else extractNumbersAtKeys(node, keys, addNumber);
      }
    }
  } else {
    if (!keys?.length) extractNumbersFromAny(results, addNumber);
    else extractNumbersAtKeys(results, keys, addNumber);
  }
  return Array.from(out).sort((a, b) => a - b);
}

function getDisplayTokensForDay(results, dayKey) {
  const tokens = [];
  const node = getDayNode(results, dayKey);
  if (!node) return [];
  extractDisplayTokensFromAny(node, (t) => tokens.push(t));
  return tokens;
}

function tokensToSlots(tokens, slots = SLOTS) {
  if (tokens.length <= slots) return tokens;
  return [...tokens.slice(0, slots - 1), `+${tokens.length - (slots - 1)}`];
}

function getRoleColor(role) {
  switch ((role || "").toLowerCase()) {
    case "мирный": return { background: "red", color: "white" };
    case "мафия": return { background: "black", color: "white" };
    case "дон": return { background: "gray", color: "white" };
    case "шериф": return { background: "#ffb700", color: "black" };
    default: return { background: "#444", color: "white" };
  }
}

/* ========= Компонент ========= */

const GameWidget = () => {
  const [gameData, setGameData] = useState(null);
  const [photos, setPhotos] = useState({}); // Добавлено для хранения фото по nickname
  const storageKeyRef = useRef(null);

useEffect(() => {
  const pathParts = window.location.pathname.split("/").filter(Boolean);

  let event = null;
  let game = null;

  // --- EVENT ---
  // event_xxxxx  или просто число
  event =
    pathParts.find((p) => /^event_[A-Za-z0-9]+$/.test(p)) ||
    pathParts.find((p) => /^\d+$/.test(p));

  // --- GAME ---
  // 1) game_XXXX
  // 2) event_XXXX_YYYY  (расширенная форма — это ИГРА)
  game =
    pathParts.find((p) => /^game_[A-Za-z0-9_]+$/.test(p)) ||
    pathParts.find((p) => /^event_[A-Za-z0-9]+_[A-Za-z0-9_]+$/.test(p));

  if (!event || !game) {
    console.error("Не удалось определить event/game", { event, game, pathParts });
    return;
  }

  storageKeyRef.current = `gameData-${event}-${game}`;
  const storageKey = storageKeyRef.current;

  const load = () => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setGameData(parsed);
    } catch (err) {
      console.error("Ошибка парсинга localStorage:", err);
    }
  };

  load();
  window.addEventListener("storage", load);
  const interval = setInterval(load, 2000);

  return () => {
    window.removeEventListener("storage", load);
    clearInterval(interval);
  };
}, []);



  // Добавлено: загрузка фото по nickname
  useEffect(() => {
    if (gameData && gameData.players) {
      const nicknames = new Set(
        gameData.players
          .map((p) => p.name)
          .filter((n) => n && n.trim())
          .map((n) => n.trim())
      );
      nicknames.forEach(async (nickname) => {
        try {
          const res = await fetch(`/api/getUserPhoto/${encodeURIComponent(nickname)}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const photoUrl = data.photoUrl;
          if (photoUrl) {
            setPhotos((prev) => ({ ...prev, [nickname]: photoUrl }));
          }
        } catch (err) {
          console.error(`Ошибка загрузки фото для ${nickname}:`, err);
        }
      });
    }
  }, [gameData]);

  if (!gameData)
    return <div className={styles.loading}>Загрузка данных игры...</div>;

  const players = (gameData.players || []).map((p, i) => ({
    id: p.id ?? i + 1,
    name: p.name && p.name.trim() ? p.name : `Игрок ${i + 1}`,
    fouls: p.fouls ?? 0,
    role: p.role?.trim()?.toLowerCase() || "неизвестно",
    sk: p.sk ?? 0,
    jk: p.jk ?? 0,
    best_move: p.best_move ?? "",
    plus: p.plus ?? 0,
  }));

  const maxId = players.length ? Math.max(...players.map((p) => Number(p.id) || 0)) : 10;
  const playerIndex = Object.fromEntries(players.map((p) => [Number(p.id), p]));
  const gi = gameData.gameInfo || {};
  const dayKey = gameData.currentDay || null;

  const votingDisplay = tokensToSlots(getDisplayTokensForDay(gi.votingResults || {}, dayKey));
  const shootingDisplay = tokensToSlots(getDisplayTokensForDay(gi.shootingResults || {}, dayKey));
  const sheriffDisplay = tokensToSlots(getDisplayTokensForDay(gi.sheriffResults || {}, dayKey));
  const donDisplay = tokensToSlots(getDisplayTokensForDay(gi.donResults || {}, dayKey));

  const VOTE_OUT_KEYS = ["votes", "result", "out", "lynch", "lynched", "votedOut", "eliminated"];
  const NIGHT_KILL_KEYS = ["result", "killed", "shot", "dead"];
  const votedOutSet = new Set(getNumbersUpToDayByKeys(gi.votingResults || {}, dayKey, VOTE_OUT_KEYS, 1, maxId));
  const shotSet = new Set(getNumbersUpToDayByKeys(gi.shootingResults || {}, dayKey, NIGHT_KILL_KEYS, 1, maxId));

  // === Цвета квадратов по роли ===
  const getSquareColorsByContent = (content) => {
    const str = content == null ? "" : String(content).trim();
    if (str === "" || str === "-" || str === "—" || str.startsWith("+")) {
      return { background: NEUTRAL_GRAY, color: "#fff" };
    }
    let num = null;
    if (typeof content === "number") num = content;
    else if (/^\d+$/.test(str)) num = Number(str);
    if (num != null && playerIndex[num]) {
      return getRoleColor(playerIndex[num].role);
    }
    return { background: NEUTRAL_GRAY, color: "#fff" };
  };

  // === Фолы ===
  const renderFouls = (count) => {
    const n = Math.max(0, Math.min(MAX_FOULS, Number(count) || 0));
    return (
      <div className={styles.foulsRow}>
        {Array.from({ length: MAX_FOULS }).map((_, i) => (
          <div
            key={i}
            className={`${styles.foulCapsule} ${i < n ? styles.foulCapsuleFilled : ""}`}
          />
        ))}
      </div>
    );
  };

  // === JK / SK карточки ===
  const renderPenaltyCards = (sk, jk) => {
    const cards = [];
    for (let i = 0; i < sk; i++) cards.push("gray");
    for (let i = 0; i < jk; i++) cards.push("yellow");
    return (
      <div className={styles.penaltyCardsRow}>
        {cards.map((t, i) => (
          <div
            key={i}
            className={`${styles.penaltyCard} ${
              t === "yellow" ? styles.penaltyCardYellow : styles.penaltyCardGray
            }`}
          />
        ))}
      </div>
    );
  };

  // === Рендер строки с иконкой и квадратами ===
  const renderIconRow = (iconSrc, tokens, side) => (
    <div className={styles.row}>
      {side === "left" && (
        <div className={styles.icon}>
          <img src={iconSrc} alt="" className={styles.iconImage} />
        </div>
      )}
      <div className={styles.squares}>
        {tokens.map((val, i) => {
          const style = getSquareColorsByContent(val);
          return (
            <div
              key={i}
              className={styles.square}
              style={{
                background: style.background,
                color: style.color,
                fontWeight: 700,
              }}
            >
              {val}
            </div>
          );
        })}
      </div>
      {side === "right" && (
        <div className={styles.icon}>
          <img src={iconSrc} alt="" className={styles.iconImage} />
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.fullScreenContainer}>
      {/* Верхняя панель */}
      <div className={styles.topPanel}>
        <div className={styles.iconColumn}>
          {renderIconRow(sheriff, sheriffDisplay, "left")}
          {renderIconRow(Don, donDisplay, "left")}
        </div>

        <div className={styles.centerInfo}>
          <div className={styles.tableTitle}>Стол 1</div>
          <div className={styles.gameRound}>
            {gameData.currentDay || "День ?"} · {gameData.currentPhase || "фаза ?"}
          </div>
          {gi.judgeNickname && <div className={styles.judge}>Судья: {gi.judgeNickname}</div>}
        </div>

        <div className={styles.iconColumn}>
          {renderIconRow(Golos, votingDisplay, "right")}
          {renderIconRow(Strelba, shootingDisplay, "right")}
        </div>
      </div>

      {/* Игроки */}
      <div className={styles.cardsSection}>
        <img src={logo} alt="Logo" className={styles.logo} />
        <div className={styles.cardsContainer}>
          {players.map((player) => {
            const roleStyle = getRoleColor(player.role);
            const idNum = Number(player.id);
            const isFolded = votedOutSet.has(idNum) || shotSet.has(idNum);
            const hasBestMove = player.best_move && String(player.best_move).trim() !== "";
            const photoUrl = photos[player.name] || CCC_prew; // Используем загруженное фото или заглушку

            return (
              <div
                key={player.id}
                className={`${styles.playerCard} ${isFolded ? styles.folded : ""} ${
                  player.fouls > 0 ? styles.hasFouls : ""
                }`}
              >
                {/* === Прямоугольник над карточкой с best_move === */}
                {hasBestMove && (
                  <div className={styles.bestMoveBox}>
                    {String(player.best_move)
                      .split(/[,\s]+/) // поддержка "3 4 5" или "3,4,5"
                      .filter(Boolean)
                      .map((token, i) => (
                        <div key={i} className={styles.bestMoveItem}>
                          {token}
                        </div>
                      ))}
                  </div>
                )}

                {renderPenaltyCards(player.sk, player.jk)}

                {!isFolded && <img src={photoUrl} alt="Player" className={styles.image} />}

                <div className={styles.bottomSection}>
                  <div
                    className={styles.bottomBar}
                    style={{
                      backgroundColor: roleStyle.background,
                      color: roleStyle.color,
                    }}
                  >
                    <div className={styles.playerNumber}>{player.id}</div>
                    <div className={styles.dividerLine}></div>
                    <div className={styles.playerName}>{player.name}</div>
                  </div>
                  {renderFouls(player.fouls)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GameWidget;
