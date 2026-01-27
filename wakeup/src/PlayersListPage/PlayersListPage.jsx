import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import styles from './PlayersListPage.module.css';
import defaultAvatar from '../NavBar/avatar.png';
import { useDebounce } from '../useDebounce';

const PlayersListPage = () => {
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(false);
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        const fetchPlayers = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch('/api/getPlayersList');
                if (!response.ok) {
                    throw new Error('Не удалось загрузить список игроков');
                }
                const data = await response.json();
                setPlayers(data.players || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPlayers();
    }, []);

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

    const filteredPlayers = players.filter(player =>
        player.nickname.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredPlayers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedPlayers = filteredPlayers.slice(startIndex, startIndex + itemsPerPage);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    if (loading) {
        return <div className={styles.pageWrapper}><p>Загрузка игроков...</p></div>;
    }

    if (error) {
        return <div className={styles.pageWrapper}><p>Ошибка: {error}</p></div>;
    }

    return (
        <div className={styles.pageWrapper}>
            <main className={styles.main}>
                <h1 className={styles.title}>Список игроков</h1>

                <div className={styles.searchContainer}>
                    <input
                        type="text"
                        placeholder="Поиск по никнейму..."
                        className={styles.searchInput}
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
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

                <section className={styles.playersGrid}>
                    {paginatedPlayers.map((player) => {
                        
                        let cardBgClass = '';
                        if (player.club === 'WakeUp | MIET') {
                            cardBgClass = styles.bgMIET;
                        } else if (player.club === 'WakeUp | MIPT') {
                            cardBgClass = styles.bgMIPT;
                        } else if (player.club === 'Misis Mafia') {
                            cardBgClass = styles.bgMisis;
                        } else if (player.club === 'Триада Менделеева') {
                            cardBgClass = styles.bgMend;
                        } 

                        return (
                            // --- ИЗМЕНЕНИЕ: Новая структура карточки ---
                            <NavLink to={`/profile/${player.id}`} key={player.id} className={`${styles.playerCard} ${cardBgClass}`}>
                                <img src={player.photoUrl || defaultAvatar} alt="avatar" className={styles.avatar} />
                                <div className={styles.playerInfo}>
                                    <div className={styles.playerName}>{player.nickname}</div>
                                    <div className={styles.playerClub}>{player.club || 'Клуб не указан'}</div>
                                    <div className={styles.playerGames}>
                                        Игр: <strong>{player.game_count}</strong>
                                    </div>
                                </div>
                            </NavLink>
                        );
                    })}
                </section>

                {totalPages > 1 && (
                    <nav className={styles.pagination}>
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className={`${styles.pageBtn} ${styles.pageArrow}`}
                        >
                            ‹
                        </button>
                        {[...Array(totalPages)].map((_, i) => {
                            const pageNumber = i + 1;
                            return (
                                <button
                                    key={pageNumber}
                                    onClick={() => handlePageChange(pageNumber)}
                                    className={`${styles.pageBtn} ${currentPage === pageNumber ? styles.pageActive : ''}`}
                                >
                                    {pageNumber}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className={`${styles.pageBtn} ${styles.pageArrow}`}
                        >
                            ›
                        </button>
                    </nav>
                )}
            </main>
        </div>
    );
};

export default PlayersListPage;