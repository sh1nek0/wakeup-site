// Маппер русских названий в системные ключи
const normalizeRole = (roleRaw = "") => {
  const r = roleRaw.toString().trim().toLowerCase();

  if (["мирный", "мирная", "мир", "civil", "citizen"].includes(r)) return "citizen";
  if (["мафия", "maf", "mafia"].includes(r)) return "mafia";
  if (["дон", "don"].includes(r)) return "don";
  if (["шериф", "sheriff"].includes(r)) return "sheriff";

  return null;
};

export default function buildPlayersStats(games = []) {
  const statsMap = new Map();

  for (const game of games) {
    if (game.badgeColor == null) continue;
    if (!Array.isArray(game.players)) continue;

    // Определяем победившую сторону
    const winnerSide =
      game.badgeColor === "red" ? "red" :
      game.badgeColor === "black" ? "black" :
      null;

    for (const player of game.players) {
      if (!player?.name?.trim()) continue;
      const key = player.name.trim();

      // создаём новый объект игрока
      if (!statsMap.has(key)) {
        statsMap.set(key, {
          name: key,
          id: player.id || null,

          totalPoints: 0,
          sk: 0,
          jk: 0,
          plus: 0,

          totalCi: 0,
          totalCb: 0,

          wins:       { sheriff: 0, citizen: 0, mafia: 0, don: 0 },
          gamesPlayed:{ sheriff: 0, citizen: 0, mafia: 0, don: 0 },
          role_plus:  { sheriff: [], citizen: [], mafia: [], don: [] },
        });
      }

      const stats = statsMap.get(key);

      // ----------- Общие суммы ----------
      stats.totalPoints += Number(player.sum || 0);
      stats.sk          += Number(player.sk || 0);
      stats.jk          += Number(player.jk || 0);
      stats.plus        += Number(player.plus || 0);

      stats.totalCi     += Number(player.totalCi || 0);
      stats.totalCb     += Number(player.totalCb || 0);

      // ----------- Роль игрока ----------
      const role = player.role ? normalizeRole(player.role) : null;

      if (role) {
        // игры сыграны
        stats.gamesPlayed[role] += 1;

        // победа
        const isWinner =
          (winnerSide === "red"   && (role === "citizen" || role === "sheriff")) ||
          (winnerSide === "black" && (role === "mafia"   || role === "don"));

        if (isWinner) {
          stats.wins[role] += 1;
        }

        // ----------- role_plus создаём здесь! ----------
        // Добавляем бонус игрока в массив его роли
        const bonus = Number(player.plus || 0);
        stats.role_plus[role].push(bonus);
      }

      // ----------- Старый формат поддерживаем ----------
      if (player.wins || player.gamesPlayed || player.role_plus) {
        for (const r of ["sheriff", "citizen", "mafia", "don"]) {

          if (player.wins?.[r]) {
            stats.wins[r] += Number(player.wins[r]);
          }

          if (player.gamesPlayed?.[r]) {
            stats.gamesPlayed[r] += Number(player.gamesPlayed[r]);
          }

          if (Array.isArray(player.role_plus?.[r])) {
            stats.role_plus[r].push(...player.role_plus[r]);
          }
        }
      }
    }
  }

  return Array.from(statsMap.values());
}
