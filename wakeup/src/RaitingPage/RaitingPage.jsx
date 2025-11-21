import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import styles from './RatingPage.module.css';
import defaultAvatar from '../NavBar/avatar.png';
import { useDebounce } from '../useDebounce';
import GameCard from '../components/GameCard/GameCard';

const tabs = ['Общий рейтинг', 'Игры', 'Статистика'];

const baseURL = ""

export default function RatingPage() {
  const [activeTab, setActiveTab] = useState('Общий рейтинг');
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(false);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [gamesCurrentPage, setGamesCurrentPage] = useState(1);
  const gamesPerPage = 10;

  const [detailedStatsCurrentPage, setDetailedStatsCurrentPage] = useState(1);
  const detailedStatsItemsPerPage = 10;

  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, token, isAdmin } = useContext(AuthContext);

  const [playersData, setPlayersData] = useState([]);
  const [totalPlayersCount, setTotalPlayersCount] = useState(0);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState(null);

  const [gamesData, setGamesData] = useState([]);
  const [totalGamesCount, setTotalGamesCount] = useState(0);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesError, setGamesError] = useState(null);

  const [detailedStatsData, setDetailedStatsData] = useState([]);
  const [detailedStatsTotalCount, setDetailedStatsTotalCount] = useState(0);
  const [detailedStatsLoading, setDetailedStatsLoading] = useState(false);
  const [detailedStatsError, setDetailedStatsError] = useState(null);
  const [averagePoints, setAveragePoints] = useState(0);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingGame, setIsCreatingGame] = useState(false);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handlePlayerClick = (playerId) => {
    if (playerId) {
      navigate(`/profile/${playerId}`);
    }
  };

  useEffect(() => {
    if (location.state?.defaultTab) {
      setActiveTab(location.state.defaultTab);
    }
  }, [location.state]);

  useEffect(() => {
    if (debouncedSearchTerm.length > 1) {
        fetch(`/api/get_player_suggestions?query=${debouncedSearchTerm}`)
            .then(res => res.json())
            .then(data => setSuggestions(data))
            .catch(err => console.error("Failed to fetch suggestions:", err));
    } else {
        setSuggestions([]);
    }
  }, [debouncedSearchTerm]);

  const handleSuggestionClick = (name) => {
    setSearchTerm(name);
    setSuggestions([]);
    setIsSuggestionsVisible(false);
  };

  const showMessage = (message, isError = false) => {
    if (isError) {
      setErrorMessage(message);
      setSuccessMessage('');
    } else {
      setSuccessMessage(message);
      setErrorMessage('');
    }
    setTimeout(() => {
      setSuccessMessage('');
      setErrorMessage('');
    }, 5000);
  };

  const clearCache = () => {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('players_') || key.startsWith('games_') || key.startsWith('detailedStats_')) {
        localStorage.removeItem(key);
      }
    });
  };

  const fetchPlayers = async (page) => {
    setPlayersLoading(true);
    setPlayersError(null);
    try {
        const offset = (page - 1) * itemsPerPage;
        const res = await fetch(baseURL + `/api/getRating?limit=${itemsPerPage}&offset=${offset}`);
        if (!res.ok) throw new Error(`Ошибка HTTP: ${res.status}`);
        const data = await res.json();
        if (data && Array.isArray(data.players)) {
            setPlayersData(data.players);
            setTotalPlayersCount(data.total_count || 0);
        } else {
            throw new Error('Некорректная структура ответа (players)');
        }
    } catch (e) {
        setPlayersError(e.message);
        setPlayersData([]);
        setTotalPlayersCount(0);
    } finally {
        setPlayersLoading(false);
    }
  };

  const fetchGames = async () => {
    setGamesLoading(true);
    setGamesError(null);
    try {
      const res = await fetch(`/api/getGames?limit=1000&offset=0`);
      if (!res.ok) throw new Error(`Ошибка HTTP: ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.games)) {
        setGamesData(data.games);
        setTotalGamesCount(data.total_count || 0);
      } else {
        throw new Error('Некорректная структура ответа (games)');
      }
    } catch (e) {
      setGamesError(e.message);
      setGamesData([]);
      setTotalGamesCount(0);
    } finally {
      setGamesLoading(false);
    }
  };

  const fetchDetailedStats = async () => {
    setDetailedStatsLoading(true);
    setDetailedStatsError(null);
    try {
      const res = await fetch(`/api/getDetailedStats?limit=1000&offset=0`);
      if (!res.ok) throw new Error(`Ошибка HTTP: ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.players)) {
        setDetailedStatsData(data.players);
        console.log(data.players)
        
        setDetailedStatsTotalCount(data.total_count || 0);
        setAveragePoints(data.average_points || 0);
      } else {
        throw new Error('Некорректная структура ответа (players)');
      }
    } catch (e) {
      setDetailedStatsError(e.message);
      setDetailedStatsData([]);
      setDetailedStatsTotalCount(0);
      setAveragePoints(0);
    } finally {
      setDetailedStatsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'Общий рейтинг') {
        fetchPlayers(currentPage);
    } else if (activeTab === 'Игры') {
        fetchGames();
    } else if (activeTab === 'Статистика') {
        fetchDetailedStats();
    }
  }, [activeTab, currentPage]);

  const filteredPlayers = playersData.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const paginatedPlayers = filteredPlayers;
  const totalPages = Math.ceil(totalPlayersCount / itemsPerPage);


  const filteredGames = gamesData.filter(g => 
    g.players.some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (g.judge_nickname && g.judge_nickname.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const paginatedGames = filteredGames.slice((gamesCurrentPage - 1) * gamesPerPage, gamesCurrentPage * gamesPerPage);
  const gamesTotalPages = Math.ceil(filteredGames.length / gamesPerPage);

  const filteredStats = detailedStatsData.filter(p => p.nickname.toLowerCase().includes(searchTerm.toLowerCase()));
  const paginatedStats = filteredStats.slice((detailedStatsCurrentPage - 1) * detailedStatsItemsPerPage, detailedStatsCurrentPage * detailedStatsItemsPerPage);
  const detailedStatsTotalPages = Math.ceil(filteredStats.length / detailedStatsItemsPerPage);

  const handlePageChange = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); };
  const handleGamesPageChange = (p) => { if (p >= 1 && p <= gamesTotalPages) setGamesCurrentPage(p); };
  const handleDetailedStatsPageChange = (p) => { if (p >= 1 && p <= detailedStatsTotalPages) setDetailedStatsCurrentPage(p); };

  const handleCreateGame = async () => {
    setIsCreatingGame(true);
    try {
      let attempts = 0;
      const maxAttempts = 10;
      while (attempts < maxAttempts) {
        const eventId = '1';
        const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const response = await fetch(`/api/checkGameExists/${gameId}`);
        if (!response.ok) {
          showMessage('Ошибка проверки ID игры на сервере.', true);
          return;
        }
        const data = await response.json();

        if (!data.exists) {
          navigate(`/Event/${eventId}/Game/${gameId}`);
          return;
        }
        
        attempts++;
      }
      showMessage('Не удалось сгенерировать уникальный ID для игры. Попробуйте еще раз.', true);
    } catch (error) {
      showMessage('Ошибка сети при создании игры: ' + error.message, true);
    } finally {
      setIsCreatingGame(false);
    }
  };

  const handleDeleteGame = async (gameId) => {
    if (!window.confirm(`Вы уверены, что хотите удалить игру #${gameId}?`)) {
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/deleteGame/${gameId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        showMessage(data.message || 'Игра удалена.');
        clearCache();
        fetchGames();
      } else {
        const errorData = await res.json().catch(() => ({}));
        showMessage(errorData.detail || 'Ошибка при удалении игры.', true);
      }
    } catch (e) {
      showMessage('Ошибка сети: ' + e.message, true);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={styles.pageWrapper}>
      {successMessage && (
        <div
          className={styles.notification}
          style={{ backgroundColor: 'green', color: 'white' }}
        >
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div
          className={styles.notification}
          style={{ backgroundColor: 'red', color: 'white' }}
        >
          {errorMessage}
        </div>
      )}

      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Рейтинг</h1>
          <p className={styles.heroText}>
            Рейтинг в студенческой мафии — это числовой показатель силы игрока, который вычисляется
            по специальной математической формуле на основе его результатов в турнирных играх.
            Если просто, рейтинг — это ваш «уровень навыка» в глазах сообщества. Он объективно
            отражает вашу способность выигрывать и влиять на исход игры.
          </p>
        </section>

        <div className={styles.tabs} role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${styles.tabBtn} ${
                activeTab === tab ? styles.tabActive : ''
              }`}
              aria-selected={activeTab === tab}
              role="tab"
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
        
        <div className={styles.searchContainer}>
            <input
                type="text"
                placeholder="Поиск по никнейму..."
                className={styles.searchInput}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setIsSuggestionsVisible(true)}
                onBlur={() => setTimeout(() => setIsSuggestionsVisible(false), 200)}
            />
            {isSuggestionsVisible && suggestions.length > 0 && (
                <div className={styles.suggestionsList}>
                    {suggestions.map((name, index) => (
                        <div
                            key={index}
                            className={styles.suggestionItem}
                            onMouseDown={() => handleSuggestionClick(name)}
                        >
                            {name}
                        </div>
                    ))}
                </div>
            )}
        </div>

        {activeTab === 'Общий рейтинг' && (
          <>
            {playersLoading && <p>Загрузка игроков...</p>}
            {playersError && <p>Ошибка: {playersError}</p>}

            {!playersLoading && !playersError && (
              <>
                <section
                  className={styles.cardsWrapper}
                  role="tabpanel"
                  aria-label="Рейтинг игроков"
                >
                  <div className={styles.cardsHeader}>
                    <div className={styles.cardPlayerHeader}>Игрок</div>
                    <div className={styles.cardGamesHeader}>
                        <span>Количество игр</span>
                        <div className={styles.subHeaderGames}>
                            <span>МИЭТ</span>
                            <span>МФТИ</span>
                        </div>
                    </div>
                    <div className={styles.cardPointsHeader}>Рейтинг</div>
                  </div>

                  {paginatedPlayers.map((player, index) => {
                    const rank = (currentPage - 1) * itemsPerPage + index + 1;
                    
                    let clubColorClass = '';
                    if (player.club === 'WakeUp | MIET') {
                      clubColorClass = styles.clubMIET;
                    } else if (player.club === 'WakeUp | MIPT') {
                      clubColorClass = styles.clubMIPT;
                    }

                    return (
                      <article key={`${rank}-${index}`} className={styles.card}>
                        <div className={styles.cardPlayer}>
                          <div className={styles.avatarWrap}>
                            <img
                              src={player.photoUrl || defaultAvatar}
                              alt="avatar"
                              className={styles.avatar}
                            />
                            <div
                              className={styles.rankBadge}
                              aria-label={`Место ${rank}`}
                            >
                              {rank}
                            </div>
                          </div>
                          <div>
                            <div className={`${styles.playerName} ${styles.clickablePlayerName}`} onClick={() => handlePlayerClick(player.id)}>
                               {player.name}
                            </div> 
                            <div className={styles.playerSubtitle}>
                              {player.club}
                            </div>
                          </div>
                        </div>
                        
                        <div className={styles.statsBlock}>
                            <div className={styles.statColumn}>{player.games_miet}</div>
                            <div className={styles.statColumn}>{player.games_mipt}</div>
                            <div className={`${styles.divider} ${clubColorClass}`}></div>
                            <div className={styles.cardPoints}>
                                {player.rating_score.toFixed(2)}
                            </div>
                        </div>
                      </article>
                    );
                  })}
                </section>

                {totalPages > 1 && (
                  <nav
                    className={styles.pagination}
                    aria-label="Пейджинг рейтинга"
                  >
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`${styles.pageBtn} ${styles.pageArrow}`}
                      aria-label="Предыдущая страница"
                      type="button"
                    >
                      ‹
                    </button>
                    {[...Array(totalPages)].map((_, i) => {
                      const p = i + 1;
                      const isActive = p === currentPage;
                      return (
                        <button
                          key={p}
                          onClick={() => handlePageChange(p)}
                          className={`${styles.pageBtn} ${
                            isActive ? styles.pageActive : ''
                          }`}
                          aria-current={isActive ? 'page' : undefined}
                          aria-label={`Страница ${p}`}
                          type="button"
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`${styles.pageBtn} ${styles.pageArrow}`}
                      aria-label="Следующая страница"
                      type="button"
                    >
                      ›
                    </button>
                  </nav>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'Игры' && (
          <div>
            {isAdmin && (
              <div className={styles.adminActions}>
                <button
                  onClick={handleCreateGame}
                  className={styles.createGameBtn}
                  type="button"
                  disabled={isCreatingGame}
                >
                  {isCreatingGame ? 'Создание...' : 'Создать игру'}
                </button>
              </div>
            )}

            {gamesLoading && <p>Загрузка игр...</p>}
            {gamesError && <p>Ошибка: {gamesError}</p>}

            {!gamesLoading && !gamesError && (
              <>
                <section
                  className={styles.gamesGridSheet}
                  role="tabpanel"
                  aria-label="Список игр"
                >
                  {paginatedGames.map((game, idx) => {
                    const gameNumber = totalGamesCount - ((gamesCurrentPage - 1) * gamesPerPage) - idx;
                    return (
                      <GameCard
                        key={game.id}
                        game={game}
                        gameNumber={gameNumber}
                        isAdmin={isAdmin}
                        onDelete={handleDeleteGame}
                        onEdit={(gameId, eventId) => navigate(`/Event/${eventId || '1'}/Game/${gameId}`)}
                        onPlayerClick={handlePlayerClick}
                      />
                    );
                  })}
                </section>

                {gamesTotalPages > 0 && (
                  <nav
                    className={styles.pagination}
                    aria-label="Пейджинг игр"
                  >
                    <button
                      onClick={() =>
                        handleGamesPageChange(gamesCurrentPage - 1)
                      }
                      disabled={gamesCurrentPage === 1}
                      className={`${styles.pageBtn} ${styles.pageArrow}`}
                      type="button"
                      aria-label="Предыдущая страница"
                    >
                      ‹
                    </button>
                    {[...Array(gamesTotalPages)].map((_, i) => {
                      const p = i + 1;
                      const isActive = p === gamesCurrentPage;
                      return (
                        <button
                          key={p}
                          onClick={() => handleGamesPageChange(p)}
                          className={`${styles.pageBtn} ${
                            isActive ? styles.pageActive : ''
                          }`}
                          aria-current={isActive ? 'page' : undefined}
                          type="button"
                          aria-label={`Страница ${p}`}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={() =>
                        handleGamesPageChange(gamesCurrentPage + 1)
                      }
                      disabled={gamesCurrentPage === gamesTotalPages}
                      className={`${styles.pageBtn} ${styles.pageArrow}`}
                      type="button"
                      aria-label="Следующая страница"
                    >
                      ›
                    </button>
                  </nav>
                )}
              </>
            )}
          </div>
        )}
        {activeTab === 'Статистика' && (
          <section
            className={styles.statsWrapper}
            role="tabpanel"
            aria-label="Общая статистика"
          >
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <h3 className={styles.statTitle}>Кол-во игр</h3>
                <p className={styles.statValue}>{totalGamesCount}</p>
              </div>
              <div className={styles.statItem}>
                <h3 className={styles.statTitle}>Кол-во игроков</h3>
                <p className={styles.statValue}>{detailedStatsTotalCount}</p>
              </div>
              <div className={styles.statItem}>
                <h3 className={styles.statTitle}>Средний балл</h3>
                <p className={styles.statValue}>{averagePoints.toFixed(2)}</p>
              </div>
              <div className={styles.statItem}>
                <h3 className={styles.statTitle}>Лучший игрок</h3>
                <p className={styles.statValue}>
                  {detailedStatsData.length > 0
                    ? (detailedStatsData[0].nickname.length > 10
                        ? detailedStatsData[0].nickname.slice(0, 10) + '...'
                        : detailedStatsData[0].nickname)
                    : '-'}
                </p>
              </div>
            </div>

            <DetailedStatsTable
              data={paginatedStats}
              currentPage={detailedStatsCurrentPage}
              totalPages={detailedStatsTotalPages}
              onPageChange={handleDetailedStatsPageChange}
              user={user}
            />
          </section>
        )}
      </main>
    </div>
  );
}

function DetailedStatsTable({ data, currentPage, totalPages, onPageChange, user }) {
  const navigate = useNavigate();

  const handlePlayerClick = (playerId) => {
    if (playerId) {
      navigate(`/profile/${playerId}`);
    }
  };

  // Функция для ролевых блоков (остаётся как раньше: П/И, Ср, МАКС по plus)
  const renderRoleStats = (wins = 0, games = 0, bonuses, colorClass) => {
    let avgBonus = '0.0';
    let maxBonus = '0.0';

    if (Array.isArray(bonuses) && bonuses.length > 0) {
      const sum = bonuses.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
      avgBonus = (sum / bonuses.length).toFixed(1);
      maxBonus = Math.max(...bonuses.map(val => parseFloat(val) || 0)).toFixed(1);
    } else if (typeof bonuses === 'number') {
      // Fallback, если bonuses — число (не используется для новой структуры)
      const bonusValue = parseFloat(bonuses) || 0;
      avgBonus = bonusValue.toFixed(1);
      maxBonus = bonusValue.toFixed(1);
    }

    return (
      <>
        <td className={`${styles.roleCell} ${colorClass}`}>
          {wins || 0}/{games || 0}
        </td>
        <td className={`${styles.roleCell} ${colorClass}`}>{avgBonus}</td>
        <td className={`${styles.roleCell} ${colorClass}`}>{maxBonus}</td>
      </>
    );
  };

  // Убрали глобальный hasRating, теперь логика для каждого игрока
  const mainColCount = 8;  // # + Игрок + 6 основных колонок
  const roleColCount = 12;  // 4 роли по 3 колонки каждая (Шериф, Мирн., Мафия, Дон)

  return (
    <>
      <div className={styles.tableWrapper}>
        <table className={styles.detailedStatsTable}>
          <thead>
            {/* Единая строка заголовков: основные + плоские подзаголовки ролей (без "Роли" и без subHeaderRow) */}
            <tr>
              <th>#</th>
              <th>Игрок</th>
              <th>Рейтинг/Сумма баллов для рейтинга/турниров</th>  {/* 1 */}
              <th>Винрейт (Побед/Игр)</th>  {/* 2 */}
              <th>Допы Ср./Сумма</th>  {/* 3 */}
              <th>Ci сумма (кол-во ПУ эфф./всего)</th>  {/* 4 */}
              <th>Cb сумма</th>  {/* 5 */}
              <th>Штрафы сумма (СК/ЖК/ППК)</th>  {/* 6 */}
              {/* Плоские th для ролей (подзаголовки, сдвинутые на 1 уровень — без группировки) */}
              <th className={`${styles.roleSheriff} ${styles.roleSubHeader}`}>Шериф П/И</th>
              <th className={`${styles.roleSheriff} ${styles.roleSubHeader}`}>Шериф Ср</th>
              <th className={`${styles.roleSheriff} ${styles.roleSubHeader}`}>Шериф МАКС</th>

              <th className={`${styles.roleCitizen} ${styles.roleSubHeader}`}>Мирн. П/И</th>
              <th className={`${styles.roleCitizen} ${styles.roleSubHeader}`}>Мирн. Ср</th>
              <th className={`${styles.roleCitizen} ${styles.roleSubHeader}`}>Мирн. МАКС</th>

              <th className={`${styles.roleMafia} ${styles.roleSubHeader}`}>Мафия П/И</th>
              <th className={`${styles.roleMafia} ${styles.roleSubHeader}`}>Мафия Ср</th>
              <th className={`${styles.roleMafia} ${styles.roleSubHeader}`}>Мафия МАКС</th>

              <th className={`${styles.roleDon} ${styles.roleSubHeader}`}>Дон П/И</th>
              <th className={`${styles.roleDon} ${styles.roleSubHeader}`}>Дон Ср</th>
              <th className={`${styles.roleDon} ${styles.roleSubHeader}`}>Дон МАКС</th>
            </tr>
          </thead>

          <tbody>
            {Array.isArray(data) &&
              data.map((p, i) => {
                const rank = (currentPage - 1) * 10 + i + 1;
                const totalGames = p.gamesPlayed?.total || 0;
                const totalWins = p.wins?.total || 0;
                const totalBonuses = parseFloat(p.bonuses) || 0;  // Сумма допов
                const avgBonuses = totalGames > 0 ? (totalBonuses / totalGames).toFixed(2) : '0.00';
                const totalCi = parseFloat(p.total_ci_bonus) || 0;
                const totalCb = parseFloat(p.total_cb_bonus) || 0;
                // Штрафы: предполагаем наличие полей p.total_sk_penalty, p.total_jk_penalty, p.total_ppk_penalty (или lh_penalty)
                // Для breakdown: p.sk_count, p.jk_count, p.ppk_count (нужно добавить в эндпоинт, если нет)
                // Пока используем placeholders; в реальности — из данных (например, count = penalty / penalty_per_incident)
                const skPenalty = parseFloat(p.total_sk_penalty) || 0;
                const jkPenalty = parseFloat(p.total_jk_penalty) || 0;
                const ppkPenalty = parseFloat(p.total_ppk_penalty) || 0;  // Или p.total_lh_penalty, если это оно
                const totalPenalties = -(skPenalty + jkPenalty + ppkPenalty);  // Отрицательная сумма
                const skCount = p.sk_count || Math.round(skPenalty / 2.5);  // Пример: если СК=2.5 за штуку; адаптировать!
                const jkCount = p.jk_count || Math.round(jkPenalty / 1.0);  // Пример
                const ppkCount = p.ppk_count || 0;  // Fallback
                // Ci breakdown: предполагаем p.ci_eff_pu (эфф. ПУ) и p.pu (всего ПУ)
                const ciEff = p.ci_eff_pu || 5;  // Placeholder; нужно из данных
                const totalPu = p.pu || 6;  // Из существующих данных

                // Винрейт: % (wins/games)
                const winrate = totalGames > 0 ? `${(totalWins / totalGames * 100).toFixed(0)}% (${totalWins}/${totalGames})` : '0% (0/0)';

                // Новая логика для колонки Рейтинг/Сумма: показывать рейтинг только если totalPoints переданы, иначе не показывать.
                // Если totalPoints переданы, показывать сумму, и если rating_score есть, добавлять рейтинг.
                const hasPoints = p.totalPoints !== undefined;
                const hasRating = p.rating_score !== undefined;
                let ratingOrPointsValue = '';
                if (hasPoints) {
                  ratingOrPointsValue = (parseFloat(p.totalPoints) || 0).toFixed(2);
                  if (hasRating) {
                    ratingOrPointsValue += ' / ' + (parseFloat(p.rating_score) || 0).toFixed(2);
                  }
                }

                return (
                  <tr
                    key={p.nickname}
                    className={p.nickname === user?.nickname ? styles.currentUserRow : ''}
                  >
                    <td>{rank}</td>
                    <td>
                      <span
                        className={styles.clickableName}
                        onClick={() => handlePlayerClick(p.id)}
                        title={p.nickname}
                      >
                        {p.nickname && p.nickname.length > 10
                          ? p.nickname.slice(0, 10) + '...'
                          : p.nickname}
                      </span>
                    </td>
                    {/* 1. Рейтинг или Сумма (новая логика: сумма если totalPoints есть, и рейтинг если оба) */}
                    <td>{ratingOrPointsValue}</td>
                    {/* 2. Винрейт */}
                    <td>{winrate}</td>
                    {/* 3. Допы Ср./Сумма */}
                    <td>{`${avgBonuses}/${totalBonuses.toFixed(2)}`}</td>
                    {/* 4. Ci сумма (ПУ эфф./всего) */}
                    <td>{`${totalCi.toFixed(1)} (${ciEff}/${totalPu})`}</td>
                    {/* 5. Cb сумма */}
                    <td>{totalCb.toFixed(1)}</td>
                    {/* 6. Штрафы сумма (СК/ЖК/ППК) */}
                    <td>{`${totalPenalties.toFixed(2)} (${skCount}/${jkCount}/${ppkCount})`}</td>

                    {/* Ролевые блоки (плоские 3 td для каждой роли) */}
                    {/* Шериф */}
                    {renderRoleStats(
                      p.wins?.sheriff || 0,
                      p.gamesPlayed?.sheriff || 0,
                      p.role_plus?.sheriff || [],
                      styles.roleSheriff
                    )}
                    {/* Мирн. */}
                    {renderRoleStats(
                      p.wins?.citizen || 0,
                      p.gamesPlayed?.citizen || 0,
                      p.role_plus?.citizen || [],
                      styles.roleCitizen
                    )}
                    {/* Мафия */}
                    {renderRoleStats(
                      p.wins?.mafia || 0,
                      p.gamesPlayed?.mafia || 0,
                      p.role_plus?.mafia || [],
                      styles.roleMafia
                    )}
                    {/* Дон */}
                    {renderRoleStats(
                      p.wins?.don || 0,
                      p.gamesPlayed?.don || 0,
                      p.role_plus?.don || [],
                      styles.roleDon
                    )}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {totalPages > 0 && (
        <nav
          className={`${styles.pagination} ${styles.detailedPagination}`}
          aria-label="Пейджинг детальной статистики"
        >
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`${styles.pageBtn} ${styles.pageArrow}`}
            aria-label="Предыдущая страница"
            type="button"
          >
            ‹
          </button>

          {[...Array(totalPages)].map((_, i) => {
            const p = i + 1;
            const isActive = p === currentPage;
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`${styles.pageBtn} ${isActive ? styles.pageActive : ''}`}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`Страница ${p}`}
                type="button"
              >
                {p}
              </button>
            );
          })}

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`${styles.pageBtn} ${styles.pageArrow}`}
            aria-label="Следующая страница"
            type="button"
          >
            ›
          </button>
        </nav>
      )}
    </>
  );
}



export {DetailedStatsTable}