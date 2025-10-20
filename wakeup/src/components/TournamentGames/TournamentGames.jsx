
import React, { useMemo } from 'react';
import GameCard from '../GameCard/GameCard';
import styles from './TournamentGames.module.css';

function TournamentGames({ games, isAdmin, onDelete, onEdit, onPlayerClick }) {
    const groupedGames = useMemo(() => {
        if (!games) return {};
        const sortedGames = [...games].sort((a, b) => a.id.localeCompare(b.id));
        return sortedGames.reduce((acc, game) => {
            const match = game.id.match(/_r(\d+)/);
            if (match) {
                const round = `Раунд ${match[1]}`;
                if (!acc[round]) acc[round] = [];
                acc[round].push({ ...game, table: game.id.match(/_t(\d+)/)?.[1] });
            } else {
                if (!acc['Прочие игры']) acc['Прочие игры'] = [];
                acc['Прочие игры'].push(game);
            }
            return acc;
        }, {});
    }, [games]);

    return (
        <div className={styles.roundsContainer}>
            {Object.keys(groupedGames).map(round => (
                <div key={round} className={styles.roundGroup}>
                    <h3 className={styles.roundTitle}>{round}</h3>
                    <div className={styles.gamesGridSheet}>
                        {groupedGames[round].map(game => (
                            <GameCard
                                key={game.id}
                                game={game}
                                isAdmin={isAdmin}
                                onDelete={onDelete}
                                onEdit={onEdit}
                                onPlayerClick={onPlayerClick}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default TournamentGames;
