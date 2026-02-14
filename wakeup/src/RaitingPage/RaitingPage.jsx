import React, { useState, useEffect, useContext, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../AuthContext'; // Предполагается, что AuthContext существует
import styles from './RatingPage.module.css';
import defaultAvatar from '../NavBar/avatar.png'; // Предполагается, что avatar.png существует
import { useDebounce } from '../useDebounce'; // Предполагается, что useDebounce существует
import GameCard from '../components/GameCard/GameCard'; // Предполагается, что GameCard существует
import { DetailedStatsTable } from '../DetailedStatsTable/DetailedStatsTable'; // Предполагается, что DetailedStatsTable существует

const tabs = ['ТОП', 'Игры', 'Статистика'];

const TAB_MAP = {
  top: 'ТОП',
  games: 'Игры',
  stats: 'Статистика',
};

const TAB_TO_QUERY = {
  'ТОП': 'top',
  'Игры': 'games',
  'Статистика': 'stats',
};

export default function RatingPage() {
  const [activeTab, setActiveTab] = useState('ТОП');
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(false);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, token, isAdmin } = useContext(AuthContext);

  // --- Состояния для вкладки ТОП ---
  const [playersData, setPlayersData] = useState([]);
  const [totalPlayersCount, setTotalPlayersCount] = useState(0);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1); // Инициализируем currentPage здесь
  const itemsPerPage = 10; // Инициализируем itemsPerPage ДО использования

  // --- Состояния для вкладки Игры ---
  const [gamesData, setGamesData] = useState([]);
  const [totalGamesCount, setTotalGamesCount] = useState(0); // Используется для общего числа игр, не для пагинации текущей страницы
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesError, setGamesError] = useState(null);
  const [gamesCurrentPage, setGamesCurrentPage] = useState(1);
  const [gamesPerPage, setGamesPerPage] = useState(8);

  // --- Состояния для вкладки Статистика ---
  const [detailedStatsData, setDetailedStatsData] = useState([]);
  const [detailedStatsTotalCount, setDetailedStatsTotalCount] = useState(0);
  const [detailedStatsLoading, setDetailedStatsLoading] = useState(false);
  const [detailedStatsError, setDetailedStatsError] = useState(null);
  const [averagePoints, setAveragePoints] = useState(0);
  const [detailedStatsCurrentPage, setDetailedStatsCurrentPage] = useState(1);
  const detailedStatsItemsPerPage = 10;

  // --- Прочие состояния ---
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); // Предполагается, что используется где-то
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState(null);

  // Динамическое изменение gamesPerPage в зависимости от ширины экрана
  useEffect(() => {
    const updateGamesPerPage = () => {
      const width = window.innerWidth;
      if (width < 768) setGamesPerPage(4);
      else if (width < 1024) setGamesPerPage(6);
      else if (width < 1280) setGamesPerPage(8);
      // else if (width < 1920) setGamesPerPage(8); // Эта строка была избыточна
      else setGamesPerPage(8); // Устанавливаем 8 для экранов 1280+
    };
    updateGamesPerPage();
    window.addEventListener('resize', updateGamesPerPage);
    return () => window.removeEventListener('resize', updateGamesPerPage);
  }, []);

  // --- Инициализация через URL ---
  useEffect(() => {
    // Читаем активную вкладку из URL
    const tabFromQuery = searchParams.get('tab');
    if (tabFromQuery && TAB_MAP[tabFromQuery]) {
      setActiveTab(TAB_MAP[tabFromQuery]);
    }
    // Читаем текущую страницу из URL для каждой вкладки
    const pageFromQuery = parseInt(searchParams.get('page') || '1', 10);
    setCurrentPage(pageFromQuery);
    const gamesPageFromQuery = parseInt(searchParams.get('gamesPage') || '1', 10);
    setGamesCurrentPage(gamesPageFromQuery);
    const statsPageFromQuery = parseInt(searchParams.get('statsPage') || '1', 10);
    setDetailedStatsCurrentPage(statsPageFromQuery);

    // Читаем состояние из location.state, если оно есть (например, после перехода с другой страницы)
    if (location.state?.defaultTab && TAB_MAP[location.state.defaultTab]) {
      setActiveTab(TAB_MAP[location.state.defaultTab]);
    }
  }, [searchParams, location.state]);

  // --- Загрузка данных по мере необходимости ---

  // Функция для загрузки ТОП игроков
  const fetchPlayers = useCallback(async (page) => {
    setPlayersLoading(true);
    setPlayersError(null);
    try {
        const offset = (page - 1) * itemsPerPage;
        // Предполагаем, что API возвращает { players: [...], total_count: N }
        const res = await fetch(`/api/getRating?limit=${itemsPerPage}&offset=${offset}`);
        if (!res.ok) throw new Error(`Ошибка HTTP: ${res.status}`);
        const data = await res.json();
        if (data && Array.isArray(data.players)) {
            setPlayersData(data.players);
            setTotalPlayersCount(data.total_count || 0);
        } else {
            throw new Error('Некорректная структура ответа API (players)');
        }
    } catch (e) {
        setPlayersError(e.message);
        setPlayersData([]);
        setTotalPlayersCount(0); // Исправлено: должно быть totalPlayersCount
    } finally {
        setPlayersLoading(false);
    }
  }, [itemsPerPage]); // itemsPerPage может меняться, если это так

  // Функция для загрузки списка игр
  const fetchGames = useCallback(async () => {
    setGamesLoading(true);
    setGamesError(null);
    try {
      // Увеличил лимит для получения всех игр, но это может быть неоптимально для большого количества игр.
      // Если игр очень много, лучше применить пагинацию на стороне сервера.
      const res = await fetch(`/api/getGames?limit=1000&offset=0`);
      if (!res.ok) throw new Error(`Ошибка HTTP: ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.games)) {
        setGamesData(data.games);
        setTotalGamesCount(data.total_count || 0); // Общее количество игр, которое может отличаться от data.games.length
      } else {
        throw new Error('Некорректная структура ответа API (games)');
      }
    } catch (e) {
      setGamesError(e.message);
      setGamesData([]);
      setTotalGamesCount(0);
    } finally {
      setGamesLoading(false);
    }
  }, []);

  // Функция для загрузки статистики по игровым событиям
  const fetchDetailedStats = useCallback(async (eventId) => { // eventId теперь параметр
    if (!eventId) {
      console.warn("event_id is not provided for fetchDetailedStats.");
      // Можно установить ошибку или пустые данные, если eventId критичен
      setDetailedStatsData([]);
      setDetailedStatsTotalCount(0);
      setAveragePoints(0);
      return;
    }
    setDetailedStatsLoading(true);
    setDetailedStatsError(null);
    try {
      // Предполагается, что API возвращает { players: [...] }
      const res = await fetch(`/api/events/${eventId}/player-stats`);
      if (!res.ok) throw new Error(`Ошибка HTTP: ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.players)) {
        setDetailedStatsData(data.players);
        setDetailedStatsTotalCount(data.players.length); // Общее число игроков со статистикой
        const totalPointsSum = data.players.reduce((sum, player) => sum + (player.totalPoints || 0), 0);
        const average = data.players.length > 0 ? totalPointsSum / data.players.length : 0;
        setAveragePoints(average);
      } else {
        throw new Error('Некорректная структура ответа API (players)');
      }
    } catch (e) {
      setDetailedStatsError(e.message);
      setDetailedStatsData([]);
      setDetailedStatsTotalCount(0);
      setAveragePoints(0);
    } finally {
      setDetailedStatsLoading(false);
    }
  }, []);

  // Функция для загрузки локаций
  const fetchLocations = useCallback(async (eventId) => { // eventId теперь параметр
    if (!eventId) {
      console.warn("event_id is not provided for fetchLocations.");
      setLocations([]);
      return;
    }
    setLocationsLoading(true);
    setLocationsError(null);
    try {
      // Предполагается, что API возвращает { locations: [...] }
      const res = await fetch(`/api/events/${eventId}/location`);
      if (!res.ok) throw new Error(`Ошибка HTTP: ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.locations)) {
        setLocations(data.locations);
      } else {
        setLocations([]);
        throw new Error("Некорректная структура ответа API (locations)");
      }
    } catch (e) {
      setLocationsError(e.message);
      setLocations([]);
    } finally {
      setLocationsLoading(false);
    }
  }, []);

  // --- Эффекты для загрузки данных при смене вкладки или страницы ---
  const event_id = "1"; // Это значение должно быть динамическим, если возможно

  useEffect(() => {
    if (activeTab === 'ТОП') {
      fetchPlayers(currentPage);
    } else if (activeTab === 'Игры') {
      fetchGames();
    } else if (activeTab === 'Статистика') {
      fetchDetailedStats(event_id); // Передаем event_id
      fetchLocations(event_id);     // Передаем event_id
    }
  }, [activeTab, currentPage, fetchPlayers, event_id, fetchGames, fetchDetailedStats, fetchLocations]); // Добавлены феч-функции

  // --- Обработчики событий ---

  // Обработчик клика по игроку (для перехода на профиль)
  const handlePlayerClick = useCallback((playerId) => {
    if (playerId) {
      navigate(`/profile/${playerId}`);
    }
  }, [navigate]);

  // Загрузка поисковых подсказок
  useEffect(() => {
    if (debouncedSearchTerm.length > 1) {
      // Предполагаем, что API возвращает массив объектов вида { id: ..., name: ... }
      fetch(`/api/get_player_suggestions?query=${debouncedSearchTerm}`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) {
            setSuggestions(data);
            setIsSuggestionsVisible(true);
          } else {
            console.error("Unexpected data format for suggestions:", data);
            setSuggestions([]);
            setIsSuggestionsVisible(false);
          }
        })
        .catch(err => {
          console.error("Failed to fetch suggestions:", err);
          setSuggestions([]);
          setIsSuggestionsVisible(false);
        });
    } else {
      setSuggestions([]);
      setIsSuggestionsVisible(false);
    }
  }, [debouncedSearchTerm]);

  // Обработчик выбора подсказки
  const handleSuggestionClick = useCallback((name) => {
    setSearchTerm(name);
    setSuggestions([]);
    setIsSuggestionsVisible(false);
    // Возможно, стоит сразу фильтровать по этой подсказке, если это ТОП, Игры или Статистика
    // В зависимости от логики, возможно, придется вызвать соответствующий fetch или обновить state
  }, []);

  // Отображение сообщений (success/error)
  const showMessage = useCallback((message, isError = false) => {
    if (isError) {
      setErrorMessage(message);
      setSuccessMessage('');
    } else {
      setSuccessMessage(message);
      setErrorMessage('');
    }
    // Автоматическое скрытие сообщения через 5 секунд
    setTimeout(() => {
      setSuccessMessage('');
      setErrorMessage('');
    }, 5000);
  }, []);

  // Очистка кэша (если используется localStorage)
  const clearCache = useCallback(() => {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('players_') || key.startsWith('games_') || key.startsWith('detailedStats_')) {
        localStorage.removeItem(key);
      }
    });
  }, []);

  // --- Вычисление отфильтрованных и пагинированных данных ---

  // **Вкладка ТОП:**
  // filteredPlayers использует searchTerm для фильтрации ТОЛЬКО текущих загруженных playersData.
  // Если нужно искать по ВСЕМ игрокам (не только по текущей странице),
  // то нужно либо загрузить всех игроков, либо сделать запрос на бэкенд для поиска.
  // Учитывая, что fetchPlayers уже пагинирован, этот фильтр применяется к текущей странице.
  const filteredPlayers = useMemo(() =>
    playersData.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [playersData, searchTerm]
  );

  // paginatedPlayers в вашем коде просто ссылается на filteredPlayers.
  // Если fetchPlayers загружает данные уже ограниченные itemsPerPage, то этот `useMemo` не нужен.
  // Если же fetchPlayers теоретически мог бы загрузить больше, то здесь нужна была бы `.slice()`.
  // Оставляем как есть, т.к. fetchPlayers уже пагинирован.
  const paginatedPlayers = filteredPlayers;
  // const paginatedPlayers = useMemo(() =>
  //  filteredPlayers.slice(
  //    (currentPage - 1) * itemsPerPage,
  //    currentPage * itemsPerPage
  //  ),
  //  [filteredPlayers, currentPage, itemsPerPage]
  // ); // Эта версия нужна, если filteredPlayers может содержать больше, чем itemsPerPage

  // Общее количество страниц для ТОП
  const totalPages = useMemo(() =>
    Math.ceil(totalPlayersCount / itemsPerPage), // Теперь itemsPerPage инициализирована
    [totalPlayersCount, itemsPerPage]
  );

  // **Вкладка Игры:**
  const filteredGames = useMemo(() =>
    gamesData.filter(g =>
      g.players.some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (g.judge_nickname && g.judge_nickname.toLowerCase().includes(searchTerm.toLowerCase()))
    ),
    [gamesData, searchTerm]
  );

  const paginatedGames = useMemo(() =>
    filteredGames.slice(
      (gamesCurrentPage - 1) * gamesPerPage,
      gamesCurrentPage * gamesPerPage
    ),
    [filteredGames, gamesCurrentPage, gamesPerPage]
  );

  const gamesTotalPages = useMemo(() =>
    Math.ceil(filteredGames.length / gamesPerPage),
    [filteredGames.length, gamesPerPage]
  );

  // **Вкладка Статистика:**
  const filteredStats = useMemo(() =>
    detailedStatsData.filter(p => p.nickname.toLowerCase().includes(searchTerm.toLowerCase())),
    [detailedStatsData, searchTerm]
  );

  const paginatedStats = useMemo(() =>
    filteredStats.slice(
      (detailedStatsCurrentPage - 1) * detailedStatsItemsPerPage,
      detailedStatsCurrentPage * detailedStatsItemsPerPage
    ),
    [filteredStats, detailedStatsCurrentPage, detailedStatsItemsPerPage]
  );

  const detailedStatsTotalPages = useMemo(() =>
    Math.ceil(filteredStats.length / detailedStatsItemsPerPage),
    [filteredStats.length, detailedStatsItemsPerPage]
  );

  // --- Обработчики смены страниц (пагинации) ---

  // Пагинация ТОП
  const handlePageChange = useCallback((p) => {
    if (p >= 1 && p <= totalPages) {
      // Обновляем состояние компонента
      setCurrentPage(p);
      // Обновляем URL
      setSearchParams(prev => {
        const params = new URLSearchParams(prev);
        params.set('page', p.toString());
        // Добавляем tab, чтобы не потерять текущую вкладку
        if (activeTab) params.set('tab', TAB_TO_QUERY[activeTab]);
        return params;
      }, { replace: true }); // replace: true изменяет текущий URL без добавления в историю
    }
  }, [totalPages, activeTab, setSearchParams]); // Зависимости для setSearchParams

  // Пагинация Игр
  const handleGamesPageChange = useCallback((p) => {
    if (p >= 1 && p <= gamesTotalPages) {
      setGamesCurrentPage(p);
      setSearchParams(prev => {
        const params = new URLSearchParams(prev);
        params.set('gamesPage', p.toString());
        if (activeTab) params.set('tab', TAB_TO_QUERY[activeTab]);
        return params;
      }, { replace: true });
    }
  }, [gamesTotalPages, activeTab, setSearchParams]);

  // Пагинация Статистики
  const handleDetailedStatsPageChange = useCallback((p) => {
    if (p >= 1 && p <= detailedStatsTotalPages) {
      setDetailedStatsCurrentPage(p);
      setSearchParams(prev => {
        const params = new URLSearchParams(prev);
        params.set('statsPage', p.toString());
        if (activeTab) params.set('tab', TAB_TO_QUERY[activeTab]);
        return params;
      }, { replace: true });
    }
  }, [detailedStatsTotalPages, activeTab, setSearchParams]);

  // --- Обработчик смены вкладок ---
  const handleTabClick = useCallback((tab) => {
    setActiveTab(tab);
    setSearchTerm(''); // Очищаем поиск при смене вкладки
    setSuggestions([]); // Скрываем подсказки
    setIsSuggestionsVisible(false);

    // Сбрасываем текущие страницы для каждой вкладки при смене
    setCurrentPage(1);
    setGamesCurrentPage(1);
    setDetailedStatsCurrentPage(1);

    // Обновляем URL, устанавливая новую вкладку и сбрасывая страницу на '1'
    setSearchParams({ tab: TAB_TO_QUERY[tab], page: '1' }, { replace: true });
  }, [setActiveTab, setSearchTerm, setSearchParams]);


  // TODO: event_id="1" - этот ID должен быть динамическим.
  // Возможно, он приходит из пропсов, из URL, или из другого источника.
  // Если он должен быть фиксированным, то это нормально.

  // --- Обработчики действий пользователя ---

  // Создание новой игры
  const handleCreateGame = useCallback(async () => {
    setIsCreatingGame(true);
    try {
      // Генерируем случайный gameId для предотвращения коллизий.
      // Возможно, лучше генерировать на бэкенде или использовать UUID.
      const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const eventId = event_id; // Используем фиксированный event_id

      // Проверка существования ID на сервере (если это требуется)
      // await fetch(`/api/checkGameExists/${gameId}`); // Если такая проверка нужна

      // Переход на страницу создания игры
      navigate(`/Event/${eventId}/Game/${gameId}`);

    } catch (error) {
      console.error("Error creating game:", error);
      showMessage('Ошибка при попытке создать игру. Попробуйте снова.', true);
    } finally {
      setIsCreatingGame(false);
    }
  }, [navigate, showMessage, event_id]); // Добавлена зависимость event_id

  // Удаление игры
  const handleDeleteGame = useCallback(async (gameId) => {
    if (!window.confirm(`Вы уверены, что хотите удалить игру #${gameId}?`)) {
      return;
    }
    setIsDeleting(true); // Устанавливаем флаг загрузки
    try {
      const res = await fetch(`/api/deleteGame/${gameId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`, // Предполагается, что токен используется для аутентификации
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json(); // Ожидаем { message: "..." }
        showMessage(data.message || 'Игра успешно удалена.');
        clearCache(); // Очищаем кэш, если есть
        fetchGames(); // Перезагружаем список игр
      } else {
        // Попытка получить детали ошибки от сервера
        const errorData = await res.json().catch(() => ({})); // Пытаемся парсить JSON, если не получится - пустой объект
        showMessage(errorData.detail || `Ошибка при удалении игры: ${res.status}`, true);
      }
    } catch (e) {
      showMessage('Сетевая ошибка при удалении игры: ' + e.message, true);
    } finally {
      setIsDeleting(false); // Снимаем флаг загрузки
    }
  }, [token, showMessage, clearCache, fetchGames]); // Зависимости, необходимые для выполнения

  return (
    <div className={styles.pageWrapper}>
      {/* Отображение сообщений */}
      {successMessage && (
        <div className={styles.notification} style={{ backgroundColor: 'green', color: 'white' }}>
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className={styles.notification} style={{ backgroundColor: 'red', color: 'white' }}>
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

        {/* Табы */}
        <div className={styles.tabs} role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabClick(tab)}
              className={`${styles.tabBtn} ${activeTab === tab ? styles.tabActive : ''}`}
              aria-selected={activeTab === tab}
              role="tab"
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Поисковая строка и подсказки */}
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Поиск по никнейму..."
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsSuggestionsVisible(true)} // Показываем при фокусе
            // onBlur={() => setTimeout(() => setIsSuggestionsVisible(false), 200)} // Скрываем при потере фокуса (с задержкой)
          />
          {isSuggestionsVisible && suggestions.length > 0 && (
            <div className={styles.suggestionsList}>
              {suggestions.map((playerInfo) => (
                <div
                  key={playerInfo.id} // Используем уникальный ID игрока
                  className={styles.suggestionItem}
                  // onMouseDown используется, чтобы сработать ДО onBlur
                  onMouseDown={() => handleSuggestionClick(playerInfo.name)}
                >
                  {playerInfo.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Контент вкладок */}
        {activeTab === 'ТОП' && (
          <div role="tabpanel" aria-label="Рейтинг игроков">
            {playersLoading && <p>Загрузка игроков...</p>}
            {playersError && <p className={styles.errorMessage}>Ошибка: {playersError}</p>}

            {!playersLoading && !playersError && paginatedPlayers.length > 0 ? (
              <section className={styles.cardsWrapper}>
                <div className={styles.cardsHeader}>
                  <div className={styles.cardPlayerHeader}>Игрок</div>
                  {/* Заголовок для колонок клубов */}
                  <div className={styles.cardGamesHeader}>
                      <span>Кол-во игр</span>
                      <div className={styles.subHeaderGames}>
                          <span>МИЭТ</span>
                          <span>МФТИ</span>
                      </div>
                  </div>
                  <div className={styles.cardPointsHeader}>Рейтинг</div>
                </div>

                {/* Отображение карточек игроков */}
                {paginatedPlayers.map((player, index) => {
                  // Расчет ранга на основе текущей страницы и индекса
                  const rank = (currentPage - 1) * itemsPerPage + index + 1;

                  // Определение класса для цвета клуба
                  let clubColorClass = '';
                  if (player.club === 'WakeUp | MIET') clubColorClass = styles.clubMIET;
                  else if (player.club === 'WakeUp | MIPT') clubColorClass = styles.clubMIPT;
                  else if (player.club === 'Misis Mafia') clubColorClass = styles.clubMisis;
                  else if (player.club === 'Триада Менделеева') clubColorClass = styles.clubMend;

                  return (
                    <article key={player.id} className={styles.card}>
                      <div className={styles.cardPlayer}>
                        <div className={styles.avatarWrap}>
                          <img
                            src={player.photoUrl || defaultAvatar}
                            alt="avatar"
                            className={styles.avatar}
                            onError={(e) => e.target.src = defaultAvatar} // Запасной аватар при ошибке загрузки
                          />
                          <div className={styles.rankBadge} aria-label={`Место ${rank}`}>
                            {rank}
                          </div>
                        </div>
                        <div>
                          {/* Клик на имя игрока для перехода на профиль */}
                          <div className={`${styles.playerName} ${styles.clickablePlayerName}`} onClick={() => handlePlayerClick(player.id)}>
                             {player.name}
                          </div>
                          <div className={styles.playerSubtitle}>{player.club}</div>
                        </div>
                      </div>

                      <div className={styles.statsBlock}>
                          <div className={styles.statColumn}>{player.games_miet}</div>
                          <div className={styles.statColumn}>{player.games_mipt}</div>
                          <div className={`${styles.divider} ${clubColorClass}`}></div>
                          <div className={styles.cardPoints}>
                              {/* Форматирование рейтинга */}
                              {player.rating_score !== undefined ? player.rating_score.toFixed(2) : 'N/A'}
                          </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            ) : (
              !playersLoading && !playersError && <p>Нет данных для отображения.</p>
            )}

            {/* Пагинация для ТОП */}
            {totalPages > 1 && (
              <nav className={styles.pagination} aria-label="Пейджинг рейтинга">
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className={`${styles.pageBtn} ${styles.pageArrow}`} aria-label="Предыдущая страница" type="button">
                  ‹
                </button>
                {/* Генерация номеров страниц с многоточиями */}
                {(() => {
                  const pages = [];
                  let startPage = 1;
                  let endPage = totalPages;
                  // Логика для показа только соседних страниц и многоточий
                  if (totalPages > 7) {
                    startPage = Math.max(currentPage - 3, 1);
                    endPage = Math.min(startPage + 6, totalPages);
                    if (endPage - startPage < 6) { // Если край страницы близок к концу
                      startPage = Math.max(endPage - 6, 1);
                    }
                  }
                  // Отображение начального многоточия, если нужно
                  if (startPage > 1) {
                    pages.push(
                      <button key={1} onClick={() => handlePageChange(1)} className={styles.pageBtn} type="button">1</button>
                    );
                    if (startPage > 2) {
                      pages.push(<span key="start-dots" className={styles.pageDots}>...</span>);
                    }
                  }
                  // Отображение страниц в диапазоне
                  for (let p = startPage; p <= endPage; p++) {
                    const isActive = p === currentPage;
                    pages.push(
                      <button key={p} onClick={() => handlePageChange(p)} className={`${styles.pageBtn} ${isActive ? styles.pageActive : ''}`} aria-current={isActive ? 'page' : undefined} aria-label={`Страница ${p}`} type="button">
                        {p}
                      </button>
                    );
                  }
                  // Отображение конечного многоточия, если нужно
                  if (endPage < totalPages) {
                    if (endPage < totalPages - 1) {
                      pages.push(<span key="end-dots" className={styles.pageDots}>...</span>);
                    }
                    pages.push(
                      <button key={totalPages} onClick={() => handlePageChange(totalPages)} className={styles.pageBtn} type="button">
                          {totalPages}
                      </button>
                    );
                  }
                  return pages;
                })()}
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className={`${styles.pageBtn} ${styles.pageArrow}`} aria-label="Следующая страница" type="button">
                  ›
                </button>
              </nav>
            )}
          </div>
        )}

        {/* Контент вкладки Игры */}
        {activeTab === 'Игры' && (
          <div role="tabpanel" aria-label="Список игр">
            {/* Кнопка создания игры для администратора */}
            {isAdmin && (
              <div className={styles.adminActions}>
                <button onClick={handleCreateGame} className={styles.createGameBtn} type="button" disabled={isCreatingGame}>
                  {isCreatingGame ? 'Создание...' : 'Создать игру'}
                </button>
              </div>
            )}

            {gamesLoading && <p>Загрузка игр...</p>}
            {gamesError && <p className={styles.errorMessage}>Ошибка: {gamesError}</p>}

            {!gamesLoading && !gamesError && paginatedGames.length > 0 ? (
              <section className={styles.gamesGridSheet}>
                {paginatedGames.map((game, idx) => {
                  // Расчет общего номера игры (если totalGamesCount известен и корректен)
                  const totalGamesBeforeCurrentPage = (gamesCurrentPage - 1) * gamesPerPage;
                  const gameNumber = totalGamesCount - totalGamesBeforeCurrentPage - idx;

                  return (
                    <GameCard
                      key={game.id}
                      game={game}
                      gameNumber={gameNumber}
                      isAdmin={isAdmin}
                      onDelete={handleDeleteGame}
                      onEdit={(gameId, eventId) => navigate(`/Event/${eventId || event_id}/Game/${gameId}`)} // Используем event_id
                      onPlayerClick={handlePlayerClick}
                    />
                  );
                })}
              </section>
            ) : (
              !gamesLoading && !gamesError && <p>Нет данных для отображения.</p>
            )}

            {/* Пагинация для Игр */}
            {gamesTotalPages > 0 && (
              <nav className={styles.pagination} aria-label="Пейджинг игр">
                <button onClick={() => handleGamesPageChange(gamesCurrentPage - 1)} disabled={gamesCurrentPage === 1} className={`${styles.pageBtn} ${styles.pageArrow}`} type="button" aria-label="Предыдущая страница">
                  ‹
                </button>
                {/* Генерация номеров страниц */}
                {(() => {
                  const pages = [];
                  let startPage = 1;
                  let endPage = gamesTotalPages;
                   if (gamesTotalPages > 7) {
                    startPage = Math.max(gamesCurrentPage - 3, 1);
                    endPage = Math.min(startPage + 6, gamesTotalPages);
                    if (endPage - startPage < 6) {
                      startPage = Math.max(endPage - 6, 1);
                    }
                  }
                  // Отображение начального многоточия
                  if (startPage > 1) {
                    pages.push(<button key={1} onClick={() => handleGamesPageChange(1)} className={styles.pageBtn} type="button">1</button>);
                    if (startPage > 2) pages.push(<span key="start-dots" className={styles.pageDots}>...</span>);
                  }
                  // Отображение страниц в диапазоне
                  for (let p = startPage; p <= endPage; p++) {
                    const isActive = p === gamesCurrentPage;
                    pages.push(
                      <button key={p} onClick={() => handleGamesPageChange(p)} className={`${styles.pageBtn} ${isActive ? styles.pageActive : ''}`} aria-current={isActive ? 'page' : undefined} type="button" aria-label={`Страница ${p}`}>
                        {p}
                      </button>
                    );
                  }
                   // Отображение конечного многоточия
                  if (endPage < gamesTotalPages) {
                    if (endPage < gamesTotalPages - 1) pages.push(<span key="end-dots" className={styles.pageDots}>...</span>);
                    pages.push(<button key={gamesTotalPages} onClick={() => handleGamesPageChange(gamesTotalPages)} className={styles.pageBtn} type="button">{gamesTotalPages}</button>);
                  }
                  return pages;
                })()}
                <button onClick={() => handleGamesPageChange(gamesCurrentPage + 1)} disabled={gamesCurrentPage === gamesTotalPages} className={`${styles.pageBtn} ${styles.pageArrow}`} type="button" aria-label="Следующая страница">
                  ›
                </button>
              </nav>
            )}
          </div>
        )}

        {/* Контент вкладки Статистика */}
        {activeTab === 'Статистика' && (
          <section className={styles.statsWrapper} role="tabpanel" aria-label="Общая статистика">
            
            

            {/* Таблица статистики */}
            {detailedStatsLoading && <p className={styles.loadingMessage}>Загрузка статистики...</p>}
            {detailedStatsError && <p className={styles.errorMessage}>{detailedStatsError}</p>}

            {!detailedStatsLoading && !detailedStatsError && paginatedStats.length > 0 ? (
              <DetailedStatsTable
                data={paginatedStats}
                currentPage={detailedStatsCurrentPage}
                totalPages={detailedStatsTotalPages}
                locations={locations} // Передаем локации, если они нужны в таблице
                onPageChange={handleDetailedStatsPageChange}
                user={user}
                eventId={event_id} // Передаем event_id
              />
            ) : (
              !detailedStatsLoading && !detailedStatsError && <p>Нет данных для отображения.</p>
            )}

            {/* Пагинация для Статистики */}
            {detailedStatsTotalPages > 1 && (
              <nav className={styles.pagination} aria-label="Пейджинг статистики">
                <button
                  onClick={() => handleDetailedStatsPageChange(detailedStatsCurrentPage - 1)}
                  disabled={detailedStatsCurrentPage === 1}
                  className={`${styles.pageBtn} ${styles.pageArrow}`}
                  aria-label="Предыдущая страница"
                  type="button"
                >
                  ‹
                </button>
                {/* Генерация номеров страниц */}
                {(() => {
                  const pages = [];
                  let startPage = 1;
                   let endPage = detailedStatsTotalPages;
                   if (detailedStatsTotalPages > 7) {
                    startPage = Math.max(detailedStatsCurrentPage - 3, 1);
                    endPage = Math.min(startPage + 6, detailedStatsTotalPages);
                    if (endPage - startPage < 6) {
                      startPage = Math.max(endPage - 6, 1);
                    }
                  }
                  // Отображение начального многоточия
                  if (startPage > 1) {
                    pages.push(<button key={1} onClick={() => handleDetailedStatsPageChange(1)} className={styles.pageBtn} type="button">1</button>);
                    if (startPage > 2) pages.push(<span key="start-dots" className={styles.pageDots}>...</span>);
                  }
                  // Отображение страниц в диапазоне
                  for (let p = startPage; p <= endPage; p++) {
                    const isActive = p === detailedStatsCurrentPage;
                    pages.push(
                      <button
                        key={p}
                        onClick={() => handleDetailedStatsPageChange(p)}
                        className={`${styles.pageBtn} ${isActive ? styles.pageActive : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={`Страница ${p}`}
                        type="button"
                      >
                        {p}
                      </button>
                    );
                  }
                  // Отображение конечного многоточия
                  if (endPage < detailedStatsTotalPages) {
                    if (endPage < detailedStatsTotalPages - 1) pages.push(<span key="end-dots" className={styles.pageDots}>...</span>);
                    pages.push(<button key={detailedStatsTotalPages} onClick={() => handleDetailedStatsPageChange(detailedStatsTotalPages)} className={styles.pageBtn} type="button">{detailedStatsTotalPages}</button>);
                  }
                  return pages;
                })()}
                <button
                  onClick={() => handleDetailedStatsPageChange(detailedStatsCurrentPage + 1)}
                  disabled={detailedStatsCurrentPage === detailedStatsTotalPages}
                  className={`${styles.pageBtn} ${styles.pageArrow}`}
                  aria-label="Следующая страница"
                  type="button"
                >
                  ›
                </button>
              </nav>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
