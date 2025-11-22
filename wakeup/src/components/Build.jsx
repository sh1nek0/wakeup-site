
// Маппер русских названий в системные ключи
const normalizeRole = (roleRaw = "") => {
  if (roleRaw == null) return null;
  const r = String(roleRaw).trim().toLowerCase();

  if (["мирный", "мирная", "мир", "civil", "citizen"].includes(r)) return "citizen";
  if (["мафия", "maf", "mafia"].includes(r)) return "mafia";
  if (["дон", "don"].includes(r)) return "don";
  if (["шериф", "sheriff"].includes(r)) return "sheriff";

  return null; // неизвестная роль
};

const parseBestMove = (bmString = "") => {
  // ожидаем строку типа "3,5" или "3 5" или "3;5" и т.п.
  if (!bmString || typeof bmString !== "string") return [];
  return bmString
    .split(/[\s,;:|]+/)
    .map(s => {
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : null;
    })
    .filter(Boolean);
};

export default function buildPlayersStats(games = []) {
  const statsMap = new Map();

  if (!Array.isArray(games) || games.length === 0) return [];

  // Сначала подсчитаем общее число игр на игрока (только игры с badgeColor != null)
  const totalPlayerGames = new Map();
  for (const g of games) {
    if (g == null) continue;
    if (g.badgeColor == null) continue; // пропускаем незавершённые/без бейджа
    const players = Array.isArray(g.players) ? g.players : [];
    for (const p of players) {
      if (!p?.name) continue;
      const name = p.name.trim();
      totalPlayerGames.set(name, (totalPlayerGames.get(name) || 0) + 1);
    }
  }

  // Для CI-расчёта — счётчик X (кол-во игр с найденным чёрным в best_move)
  const playerXCounts = new Map();

  // Сортируем игры по created_at (строка ISO) — возрастание
  const sortedGames = [...games].sort((a, b) => {
    const ta = a?.created_at ? Date.parse(a.created_at) : 0;
    const tb = b?.created_at ? Date.parse(b.created_at) : 0;
    return ta - tb;
  });

  for (const game of sortedGames) {
    if (!game) continue;
    if (game.badgeColor == null) continue; // только игры с бейджем

    const players = Array.isArray(game.players) ? game.players : [];

    // определяем победившую сторону
    const winnerSide =
      game.badgeColor === "red" ? "red" :
      game.badgeColor === "black" ? "black" : null;

    // карта id -> normalized role (используется при анализе best_move по номерам)
    const playerRolesById = new Map();
    // и карта номера игрока (если best_move содержит номера) — но в твоем формате номера это индексы игроков (предположительно),
    // в любом случае мы пытаемся брать role по id/number, но если best_move содержит реальные id, это тоже поддержим.
    for (const p of players) {
      const roleNorm = p?.role ? normalizeRole(p.role) : null;
      if (p?.id != null) playerRolesById.set(p.id, roleNorm);
      if (p?.number != null) playerRolesById.set(p.number, roleNorm); // если в данных есть number
    }

    // некоторые данные могут быть в game.gameInfo или в корне
    const gameInfo = game.gameInfo || {};
    const breakdownSource = gameInfo.breakdownSource || game.breakdownSource || "none";
    const breakdownPlayerNumber = gameInfo.breakdownPlayerNumber ?? game.breakdownPlayerNumber ?? null;

    for (const player of players) {
      if (!player?.name || player.name.trim() === "") continue;
      const name = player.name.trim();

      // инициализация игрока
      if (!statsMap.has(name)) {
        statsMap.set(name, {
          name,
          id: player.id || null,
          totalPoints: 0,
          sk: 0,
          jk: 0,
          plus: 0,

          totalCi: 0,
          totalCb: 0,

          wins: { sheriff: 0, citizen: 0, mafia: 0, don: 0 },
          gamesPlayed: { sheriff: 0, citizen: 0, mafia: 0, don: 0 },
          role_plus: { sheriff: [], citizen: [], mafia: [], don: [] },
        });
      }

      const stats = statsMap.get(name);

      // общие числовые поля (если есть)
      stats.totalPoints += Number(player.sum ?? 0);
      stats.sk += Number(player.sk ?? 0);
      stats.jk += Number(player.jk ?? 0);
      stats.plus += Number(player.plus ?? 0);

      // Нормализуем роль (рус/англ)
      const role = player.role ? normalizeRole(player.role) : null;

      // best_move парсинг
      const bestMoveString = player.best_move || player.bestMove || "";
      const bestMoveNums = parseBestMove(bestMoveString);

      // является ли этот игрок "broken" (тот, на кого делается breakdown)
      const isBrokenPlayer = breakdownSource !== "none" &&
                             breakdownPlayerNumber != null &&
                             (player.id === breakdownPlayerNumber || player.number === breakdownPlayerNumber);

      // Рассчёт best_move_bonus и cb_bonus
      let best_move_bonus = 0;
      let cb_bonus = 0;

      // helper: получить роль по номеру/идентификатору из playerRolesById
      const roleOfNum = (num) => {
        // пробуем найти по id/number
        return playerRolesById.get(num) || null;
      };

      // Считаем сколько "чёрных" (mafia/don) в best_move
      const blackInBM = new Set();
      for (const n of bestMoveNums) {
        const r = roleOfNum(n);
        if (r === "mafia" || r === "don") blackInBM.add(n);
      }
      const countBlack = blackInBM.size;

      // Логика, взятая из твоего Python куска
      if (isBrokenPlayer) {
        if (role === "citizen" || role === "sheriff") {
          if (breakdownSource === "black") {
            if (countBlack > 0) cb_bonus = 0.5;
            if (countBlack === 2) best_move_bonus = 0.5;
            else if (countBlack === 3) best_move_bonus = 1.0;
          } else if (breakdownSource === "red") {
            cb_bonus = 0.5;
            if (countBlack === 1) best_move_bonus = 0.5;
            else if (countBlack === 2) best_move_bonus = 1.0;
            else if (countBlack === 3) best_move_bonus = 1.5;
          }
        } else if (role === "mafia" || role === "don") {
          cb_bonus = 0.5;
        }
      } else {
        // не broken player, обычная логика по best_move
        if (bestMoveNums.length > 0 && (role === "citizen" || role === "sheriff")) {
          if (countBlack === 2) best_move_bonus = 0.5;
          else if (countBlack === 3) best_move_bonus = 1.0;
        }
      }

      // CI-бонус (если cb_bonus == 0 и роль мирная/шериф и есть best_move)
      let ci_bonus = 0;
      if (cb_bonus === 0 && bestMoveNums.length > 0 && (role === "citizen" || role === "sheriff")) {
        const found_black = bestMoveNums.some(n => {
          const r = roleOfNum(n);
          return r === "mafia" || r === "don";
        });

        let x_before = playerXCounts.get(name) || 0;
        let current_x = x_before;
        if (found_black) {
          current_x += 1;
          playerXCounts.set(name, current_x);
        }
        const total_n = totalPlayerGames.get(name) || 0;
        if (current_x > 0 && total_n > 0) {
          const k = Math.max(0, current_x - (total_n / 10.0));
          if (k > 0) {
            ci_bonus = (k * (k + 1)) / Math.sqrt(total_n);
          }
        }
      }

      // Командный бонус (team_win)
      const team_win_bonus =
        (winnerSide === "red" && (role === "citizen" || role === "sheriff")) ||
        (winnerSide === "black" && (role === "mafia" || role === "don"))
          ? 2.5
          : 0;

      // штрафы - используем поля текущей игры player.jk и player.sk как penalty amount
      const jk_penalty = Number(player.jk ?? 0);
      const sk_penalty = Number(player.sk ?? 0);

      // итоговые очки за эту игру (округлим до 2 знаков)
      const base_sum =  best_move_bonus + cb_bonus ;
      const final_points_raw = base_sum + ci_bonus - jk_penalty - sk_penalty;
      const final_points = Math.round(final_points_raw * 100) / 100;

      // записываем/накопляем в stats
      stats.totalPoints += final_points;
      stats.sk += sk_penalty; // уже добавляли player.sk выше в общий, но оставлю текущую - в зависимости от структуры можно убрать дубль
      stats.jk += jk_penalty;
      stats.plus += Number(player.plus ?? 0);

      stats.totalCi += ci_bonus;
      stats.totalCb += cb_bonus;

      // если есть роль — обновляем role-статистику
      if (role) {
        stats.gamesPlayed[role] += 1;

        // победа определяется по winnerSide
        const isWinner =
          (winnerSide === "red" && (role === "citizen" || role === "sheriff")) ||
          (winnerSide === "black" && (role === "mafia" || role === "don"));
        if (isWinner) stats.wins[role] += 1;

        // role_plus: пушим **roleBonus** = player.plus + best_move_bonus + cb_bonus
        const roleBonus = Number(player.plus ?? 0) + best_move_bonus + cb_bonus;
        stats.role_plus[role].push(roleBonus);
      }

      // Поддержка старого формата: если в player есть wins/gamesPlayed/role_plus массива — добавим их
      if (player.wins || player.gamesPlayed || player.role_plus) {
        for (const r of ["sheriff", "citizen", "mafia", "don"]) {
          if (player.wins?.[r]) {
            stats.wins[r] += Number(player.wins[r]);
          }
          if (player.gamesPlayed?.[r]) {
            stats.gamesPlayed[r] += Number(player.gamesPlayed[r]);
          }
          if (Array.isArray(player.role_plus?.[r])) {
            stats.role_plus[r].push(...player.role_plus[r].map(x => Number(x || 0)));
          }
        }
      }
    } 
  } 

  
  return Array.from(statsMap.values());
}