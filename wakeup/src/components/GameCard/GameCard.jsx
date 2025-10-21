import React from 'react';
import styles from './GameCard.module.css';
import RoleIcon from '../../RoleIcon/RoleIcon';
import { useNavigate } from 'react-router-dom';

function GameCard({ game, isAdmin, onDelete, onEdit, onPlayerClick, gameNumber }) {
    const navigate = useNavigate();
    
    const tableNumber = game.tableNumber;
    
    const rows = Array.from({ length: 10 }, (_, i) => game.players?.[i] || {});
    
    const gameDate = game.date || (game.created_at ? new Date(game.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

    let resultColorClass = '';
    if (game.badgeColor === 'red') resultColorClass = styles.resRed;
    else if (game.badgeColor === 'black') resultColorClass = styles.resBlack;
    else resultColorClass = styles.resGray;

    let locationColorClass = '';
    if (game.location === 'МФТИ') locationColorClass = styles.locMIPT;
    else if (game.location === 'МИЭТ') locationColorClass = styles.locMIET;

    const title = game.roundNumber 
        ? `Раунд ${game.roundNumber} (Стол: ${game.tableNumber})`
        : `Игра #${gameNumber || game.id.slice(-4)}`;

    const breakdownSource = game.gameInfo?.breakdownSource;
    const breakdownPlayerNumber = game.gameInfo?.breakdownPlayerNumber;

    return (
        <article className={styles.sheetCard}>
            <div className={styles.sheetMeta}>
                <div className={`${styles.sheetLocation} ${locationColorClass}`}>{game.location || ''}</div>
                {tableNumber ? (
                    <div className={styles.sheetTableNumber}>Стол #{tableNumber}</div>
                ) : (
                    <div></div>
                )}
                <div className={styles.sheetJudge}>
                    {game.judge_id ? (
                        <span className={styles.clickableName} onClick={() => onPlayerClick(game.judge_id)}>
                            {game.judge_nickname || 'Не указан'}
                        </span>
                    ) : (
                        game.judge_nickname || 'Не указан'
                    )}
                </div>
            </div>
            <div className={styles.sheetTop}>
                <span className={styles.sheetTitle}>{title}</span>
                <div className={`${styles.sheetSlashTop} ${locationColorClass}`} />
                <time className={styles.sheetDate}>{gameDate}</time>
            </div>
            <div className={styles.sheetTableWrap}>
                <table className={styles.sheetTable}>
                    <thead>
                        <tr><th>№</th><th>Игрок</th><th>Роль</th><th>Очки</th></tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => {
                            const playerNumber = i + 1;
                            const hasBestMove = row.best_move && String(row.best_move).trim() !== '';
                            
                            let rowClass = '';

                            const isBrokenPlayer = 
                                (breakdownSource === 'red' || breakdownSource === 'black') &&
                                breakdownPlayerNumber === playerNumber;

                            const isBestMoveNotBroken = hasBestMove && !isBrokenPlayer;

                            if (isBrokenPlayer) {
                                rowClass = styles.brokenPlayerRow;
                            } else if (isBestMoveNotBroken) {
                                rowClass = styles.bestMoveRow;
                            }

                            return (
                                <tr key={`${game.id}-${i}`} className={rowClass}>
                                    <td>{i + 1}</td>
                                    <td className={styles.nameP}>
                                        <span className={styles.clickableNameInTable} onClick={() => onPlayerClick(row.id)}>
                                            {row.name || ''}
                                        </span>
                                    </td>
                                    <td><RoleIcon role={row.role || ''} /></td>
                                    <td>
                                        {typeof row.points === 'number' ? row.points.toFixed(2) : (typeof row.sum === 'number' ? row.sum.toFixed(2) : '')}
                                        {row.best_move && (
                                            <span className={styles.bestMoveText}>
                                                {' '}(ЛХ: {row.best_move})
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className={styles.sheetBottom}>
                <span className={styles.sheetBottomLeft}>Результат</span>
                <div className={`${styles.sheetSlashBottom} ${resultColorClass}`} />
                <span className={styles.sheetBottomRight}>
                    {game.badgeColor ? (game.badgeColor === 'red' ? 'Победа мирных' : 'Победа мафии') : 'Не сыграна'}
                </span>
            </div>
            <div className={styles.sheetActions}>
                <button onClick={() => navigate(`/Event/${game.event_id || '1'}/Game/${game.id}?mode=view`)} className={styles.sheetViewBtn}>Посмотреть</button>
                {isAdmin && (
                    <>
                        <button onClick={() => onEdit(game.id, game.event_id)} className={styles.sheetEditBtn}>Редактировать</button>
                        <button onClick={() => onDelete(game.id)} className={styles.sheetDeleteBtn}>Удалить</button>
                    </>
                )}
            </div>
        </article>
    );
}

export default GameCard;