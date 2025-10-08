import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import styles from './PlayersListPage.module.css';
import defaultAvatar from '../NavBar/avatar.png';

const PlayersListPage = () => {
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
                <section className={styles.listWrapper}>
                    <div className={styles.listHeader}>
                        <div className={styles.headerRank}>#</div>
                        <div className={styles.headerPlayer}>Игрок</div>
                        <div className={styles.headerGames}>Сыграно игр</div>
                    </div>

                    {players.map((player, index) => (
                        <NavLink to={`/profile/${player.id}`} key={player.id} className={styles.playerRow}>
                            <div className={styles.playerInfo}>
                                <div className={styles.rank}>{index + 1}</div>
                                <img src={player.avatar || defaultAvatar} alt="avatar" className={styles.avatar} />
                                <div>
                                    <div className={styles.playerName}>{player.nickname}</div>
                                    <div className={styles.playerClub}>{player.club || 'Клуб не указан'}</div>
                                </div>
                            </div>
                            <div className={styles.gameCount}>
                                {player.game_count}
                            </div>
                        </NavLink>
                    ))}
                </section>
            </main>
        </div>
    );
};

export default PlayersListPage;