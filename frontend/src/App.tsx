import { useEffect, useMemo, useState } from 'react';
import './App.css';
import {
    AddLibrary,
    DeleteGame,
    GetState,
    LaunchGame,
    RemoveLibrary,
    ScanLibraries,
    ScrapeMetadataForGame,
    SetGameDeleted,
    UpdateGameMetadata,
} from "../wailsjs/go/main/App";

type Game = {
    id: string
    title: string
    original_title: string
    dir_path: string
    exe_path: string
    cover_path: string
    play_time_sec: number
    last_played: string
    vndb_id: string
    is_deleted: boolean
    developer: string
    summary: string
}

type AppState = {
    libraries: string[]
    games: Game[]
}

type EditDraft = {
    title: string
    original_title: string
    exe_path: string
    cover_path: string
    vndb_id: string
    developer: string
    summary: string
}

const demoState: AppState = {
    libraries: ['X:\\Games'],
    games: [
        {
            id: 'demo-1',
            title: '示例游戏（预览模式）',
            original_title: 'Demo Game',
            dir_path: 'X:\\Games\\Demo',
            exe_path: 'X:\\Games\\Demo\\game.exe',
            cover_path: '',
            play_time_sec: 3600,
            last_played: new Date().toISOString(),
            vndb_id: "v12345",
            is_deleted: false,
            developer: 'MengGalRunner',
            summary: '当前是前端预览模式，未连接 Wails 后端。'
        }
    ]
};

const createEditDraft = (game: Game | null): EditDraft => ({
    title: game?.title ?? '',
    original_title: game?.original_title ?? '',
    exe_path: game?.exe_path ?? '',
    cover_path: game?.cover_path ?? '',
    vndb_id: game?.vndb_id ?? '',
    developer: game?.developer ?? '',
    summary: game?.summary ?? '',
});

function App() {
    const [state, setState] = useState<AppState>({ libraries: [], games: [] });
    const [selectedGameId, setSelectedGameId] = useState<string>('');
    const [newLibraryPath, setNewLibraryPath] = useState('');
    const [query, setQuery] = useState('');
    const [showDeleted, setShowDeleted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorText, setErrorText] = useState('');
    const [deleteReadyId, setDeleteReadyId] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState('');
    const [deleteMode, setDeleteMode] = useState<'hide' | 'delete' | 'restore' | ''>('');
    const [panelMode, setPanelMode] = useState<'view' | 'edit'>('view');
    const [editDraft, setEditDraft] = useState<EditDraft>(createEditDraft(null));
    const isWailsRuntime = typeof window !== 'undefined' && Boolean((window as any).go?.main?.App);

    const selectedGame = useMemo(
        () => state.games.find((item) => item.id === selectedGameId) ?? null,
        [state.games, selectedGameId]
    );

    const filteredGames = useMemo(() => {
        const input = query.trim().toLowerCase();
        return state.games.filter((item) => {
            if (!showDeleted && item.is_deleted) {
                return false;
            }
            if (!input) {
                return true;
            }
            return item.title.toLowerCase().includes(input) || item.dir_path.toLowerCase().includes(input);
        });
    }, [state.games, query, showDeleted]);

    const resetDeleteFlow = () => {
        setDeleteReadyId('');
        setDeleteConfirmId('');
        setDeleteMode('');
    };

    const loadState = async (currentShowDeleted: boolean) => {
        if (!isWailsRuntime) {
            const result = currentShowDeleted ? demoState : {
                libraries: demoState.libraries,
                games: demoState.games.filter((item) => !item.is_deleted)
            };
            setState(result);
            setSelectedGameId((prev) => result.games.find((item) => item.id === prev)?.id ?? result.games[0]?.id ?? '');
            return;
        }
        const result = await GetState(currentShowDeleted);
        const nextState = result as AppState;
        setState(nextState);
        setSelectedGameId((prev) => nextState.games.find((item) => item.id === prev)?.id ?? nextState.games[0]?.id ?? '');
    };

    useEffect(() => {
        setLoading(true);
        loadState(showDeleted)
            .catch((err) => setErrorText(String(err)))
            .finally(() => {
                if (!isWailsRuntime) {
                    setErrorText('');
                }
            })
            .finally(() => setLoading(false));
    }, [showDeleted, isWailsRuntime]);

    useEffect(() => {
        if (deleteReadyId && !state.games.some((item) => item.id === deleteReadyId)) {
            resetDeleteFlow();
        }
    }, [deleteReadyId, state.games]);

    useEffect(() => {
        setEditDraft(createEditDraft(selectedGame));
        setPanelMode('view');
    }, [selectedGameId]);

    const onAddLibrary = async () => {
        const path = newLibraryPath.trim();
        if (!path) {
            return;
        }
        if (!isWailsRuntime) {
            setErrorText('预览模式下不可修改目录，请使用 wails dev 运行桌面版');
            return;
        }
        setLoading(true);
        setErrorText('');
        try {
            await AddLibrary(path);
            setNewLibraryPath('');
            await loadState(showDeleted);
        } catch (err) {
            setErrorText(String(err));
        } finally {
            setLoading(false);
        }
    };

    const onRemoveLibrary = async (path: string) => {
        if (!isWailsRuntime) {
            setErrorText('预览模式下不可移除目录，请使用 wails dev 运行桌面版');
            return;
        }
        setLoading(true);
        setErrorText('');
        try {
            await RemoveLibrary(path);
            await loadState(showDeleted);
        } catch (err) {
            setErrorText(String(err));
        } finally {
            setLoading(false);
        }
    };

    const onScan = async () => {
        if (!isWailsRuntime) {
            setErrorText('预览模式下不可扫描目录，请使用 wails dev 运行桌面版');
            return;
        }
        setLoading(true);
        setErrorText('');
        try {
            await ScanLibraries();
            await loadState(showDeleted);
        } catch (err) {
            setErrorText(String(err));
        } finally {
            setLoading(false);
        }
    };

    const onLaunch = async () => {
        if (!selectedGameId) {
            return;
        }
        if (!isWailsRuntime) {
            setErrorText('预览模式下不可启动游戏，请使用 wails dev 运行桌面版');
            return;
        }
        setLoading(true);
        setErrorText('');
        try {
            await LaunchGame(selectedGameId);
            await loadState(showDeleted);
        } catch (err) {
            setErrorText(String(err));
        } finally {
            setLoading(false);
        }
    };

    const onRestoreSelected = async () => {
        if (!selectedGame) {
            return;
        }
        if (!isWailsRuntime) {
            setErrorText('预览模式下不可恢复游戏，请使用 wails dev 运行桌面版');
            return;
        }
        setLoading(true);
        setErrorText('');
        try {
            await SetGameDeleted(selectedGame.id, false);
            resetDeleteFlow();
            await loadState(showDeleted);
        } catch (err) {
            setErrorText(String(err));
        } finally {
            setLoading(false);
        }
    };

    const onScrapeBangumi = async () => {
        if (!selectedGame) {
            return;
        }
        if (!isWailsRuntime) {
            setErrorText('预览模式下不可抓取，请使用 wails dev 运行桌面版');
            return;
        }
        setLoading(true);
        setErrorText('');
        try {
            await ScrapeMetadataForGame(selectedGame.id);
            await loadState(showDeleted);
        } catch (err) {
            setErrorText(String(err));
        } finally {
            setLoading(false);
        }
    };

    const onStartEdit = () => {
        if (!selectedGame) {
            return;
        }
        resetDeleteFlow();
        setEditDraft(createEditDraft(selectedGame));
        setPanelMode('edit');
    };

    const onCancelEdit = () => {
        setEditDraft(createEditDraft(selectedGame));
        setPanelMode('view');
    };

    const onSaveEdit = async () => {
        if (!selectedGame) {
            return;
        }

        const payload = {
            title: editDraft.title.trim() || selectedGame.title,
            original_title: editDraft.original_title.trim(),
            exe_path: editDraft.exe_path.trim(),
            cover_path: editDraft.cover_path.trim(),
            vndb_id: editDraft.vndb_id.trim(),
            developer: editDraft.developer.trim(),
            summary: editDraft.summary.trim(),
        };

        if (!isWailsRuntime) {
            const updatedGame = {
                ...selectedGame,
                title: payload.title,
                original_title: payload.original_title,
                exe_path: payload.exe_path,
                cover_path: payload.cover_path,
                vndb_id: payload.vndb_id,
                developer: payload.developer,
                summary: payload.summary,
            };
            setState((prev) => ({
                ...prev,
                games: prev.games.map((item) => item.id === updatedGame.id ? updatedGame : item),
            }));
            setEditDraft(createEditDraft(updatedGame));
            setPanelMode('view');
            return;
        }

        setLoading(true);
        setErrorText('');
        try {
            await UpdateGameMetadata(selectedGame.id, payload);
            await loadState(showDeleted);
            setPanelMode('view');
        } catch (err) {
            setErrorText(String(err));
        } finally {
            setLoading(false);
        }
    };

    const onArmDelete = (game: Game) => {
        if (panelMode === 'edit') {
            return;
        }
        setSelectedGameId(game.id);
        setDeleteReadyId(game.id);
        setDeleteConfirmId('');
        setDeleteMode('');
    };

    const onConfirmDelete = async (game: Game) => {
        if (!isWailsRuntime) {
            const actionText = deleteMode === 'delete' ? '删除' : deleteMode === 'restore' ? '取消隐藏' : '隐藏';
            setErrorText(`预览模式下不可${actionText}游戏，请使用 wails dev 运行桌面版`);
            return;
        }
        setLoading(true);
        setErrorText('');
        try {
            if (deleteMode === 'delete') {
                await DeleteGame(game.id);
            } else if (deleteMode === 'restore') {
                await SetGameDeleted(game.id, false);
            } else {
                await SetGameDeleted(game.id, true);
            }
            resetDeleteFlow();
            await loadState(showDeleted);
        } catch (err) {
            setErrorText(String(err));
        } finally {
            setLoading(false);
        }
    };

    const playTimeText = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours} 小时 ${mins} 分`;
    };

    const bgImageStyle = selectedGame?.cover_path ? { backgroundImage: `url(${selectedGame.cover_path})` } : {};
    const selectedGameAccent = selectedGame?.title?.slice(0, 1) ?? 'MG';

    return (
        <div className="layout">
            <div className="bg-blur" style={bgImageStyle}></div>
            <div className="bg-overlay"></div>

            <aside className="sidebar">
                <div className="sidebar-header">
                    <h1>MengGalRunner</h1>
                </div>

                <div className="sidebar-scroll">
                    <div className="library-actions panel-block">
                        <div className="section-title">游戏库</div>
                        <input
                            className="input"
                            value={newLibraryPath}
                            onChange={(e) => setNewLibraryPath(e.target.value)}
                            placeholder="输入库目录，例如 X:\\Games"
                        />
                        <button className="btn btn-accent" onClick={onAddLibrary} disabled={loading}>添加目录</button>
                    </div>

                    <div className="library-list panel-block">
                        {state.libraries.map((path) => (
                            <div className="library-item" key={path}>
                                <span>{path}</span>
                                <button className="btn-link" onClick={() => onRemoveLibrary(path)}>移除</button>
                            </div>
                        ))}
                    </div>

                    <div className="search-box panel-block">
                        <div className="section-title">快速筛选</div>
                        <input
                            className="input"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="搜索游戏名或路径"
                        />
                        <label className="checkbox-label">
                            <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
                            显示已隐藏游戏
                        </label>
                        <button className="btn" onClick={onScan} disabled={loading}>扫描库目录</button>
                    </div>

                    <div className="game-list-header">
                        <div className="section-title">游戏列表</div>
                        <span>{filteredGames.length} 项</span>
                    </div>

                    <div className="game-list">
                        {filteredGames.map((game) => {
                            const isActive = selectedGameId === game.id;
                            const isDeleteReady = deleteReadyId === game.id;
                            const isDeleteConfirm = deleteConfirmId === game.id;
                            const currentDeleteMode = isDeleteReady ? deleteMode : '';

                            return (
                                <div
                                    key={game.id}
                                    className={`game-item ${isActive ? 'active' : ''} ${game.is_deleted ? 'deleted' : ''} ${isDeleteReady ? 'delete-ready' : ''} ${isDeleteConfirm ? 'delete-confirm' : ''}`}
                                    onClick={() => {
                                        setSelectedGameId(game.id);
                                        if (deleteReadyId && deleteReadyId !== game.id) {
                                            resetDeleteFlow();
                                        }
                                    }}
                                    onContextMenu={(event) => {
                                        event.preventDefault();
                                        onArmDelete(game);
                                    }}
                                >
                                    {game.cover_path ? (
                                        <img src={game.cover_path} alt="cover" className="game-item-cover" />
                                    ) : (
                                        <div className="game-item-cover game-item-cover-fallback">{game.title.slice(0, 1)}</div>
                                    )}
                                    <div className="game-item-info">
                                        <div className="game-title">{game.title}</div>
                                        {game.original_title !== game.title && (
                                            <div className="game-sub">{game.original_title}</div>
                                        )}
                                        <div className="game-meta-row">
                                            <span>{playTimeText(game.play_time_sec)}</span>
                                            {game.is_deleted && <span className="meta-warning">已隐藏</span>}
                                        </div>
                                    </div>

                                    {isDeleteReady && !game.is_deleted && (
                                        <div className="game-item-delete-panel" onClick={(event) => event.stopPropagation()}>
                                            {!isDeleteConfirm ? (
                                                <>
                                                    <span className="delete-tip">右键操作</span>
                                                    <div className="delete-choice-actions">
                                                        <button
                                                            className="delete-cancel-btn"
                                                            onClick={() => {
                                                                setDeleteMode('hide');
                                                                setDeleteConfirmId(game.id);
                                                            }}
                                                            disabled={loading}
                                                        >
                                                            隐藏
                                                        </button>
                                                        <button
                                                            className="delete-action"
                                                            onClick={() => {
                                                                setDeleteMode('delete');
                                                                setDeleteConfirmId(game.id);
                                                            }}
                                                            disabled={loading}
                                                        >
                                                            删除
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                <span className="delete-tip">{currentDeleteMode === 'delete' ? '确认彻底删除这个游戏？' : currentDeleteMode === 'restore' ? '确认取消隐藏这个游戏？' : '确认隐藏这个游戏？'}</span>
                                                <div className="delete-confirm-actions">
                                                    <button
                                                        className="delete-confirm-btn"
                                                            onClick={() => onConfirmDelete(game)}
                                                            disabled={loading}
                                                        >
                                                            确认
                                                        </button>
                                                        <button
                                                            className="delete-cancel-btn"
                                                            onClick={resetDeleteFlow}
                                                            disabled={loading}
                                                        >
                                                            取消
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    {isDeleteReady && game.is_deleted && (
                                        <div className="game-item-delete-panel" onClick={(event) => event.stopPropagation()}>
                                            {!isDeleteConfirm ? (
                                                <>
                                                    <span className="delete-tip">右键操作</span>
                                                    <div className="delete-choice-actions">
                                                        <button
                                                            className="delete-cancel-btn"
                                                            onClick={() => {
                                                                setDeleteMode('restore');
                                                                setDeleteConfirmId(game.id);
                                                            }}
                                                            disabled={loading}
                                                        >
                                                            取消隐藏
                                                        </button>
                                                        <button
                                                            className="delete-action"
                                                            onClick={() => {
                                                                setDeleteMode('delete');
                                                                setDeleteConfirmId(game.id);
                                                            }}
                                                            disabled={loading}
                                                        >
                                                            删除
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="delete-tip">{currentDeleteMode === 'delete' ? '确认彻底删除这个游戏？' : '确认取消隐藏这个游戏？'}</span>
                                                    <div className="delete-confirm-actions">
                                                        <button
                                                            className="delete-confirm-btn"
                                                            onClick={() => onConfirmDelete(game)}
                                                            disabled={loading}
                                                        >
                                                            确认
                                                        </button>
                                                        <button
                                                            className="delete-cancel-btn"
                                                            onClick={resetDeleteFlow}
                                                            disabled={loading}
                                                        >
                                                            取消
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </aside>

            <main className="main-panel">
                {selectedGame ? (
                    panelMode === 'edit' ? (
                        <div className="editor-shell">
                            <div className="editor-topbar">
                                <button className="back-button" onClick={onCancelEdit}>返回</button>
                                <div className="editor-topbar-text">
                                    <h2>修改游戏资料</h2>
                                </div>
                            </div>

                            <div className="editor-card">
                                <div className="editor-preview">
                                    <div className="editor-cover-frame">
                                        {editDraft.cover_path ? (
                                            <img src={editDraft.cover_path} alt="cover preview" className="editor-cover-image" />
                                        ) : (
                                            <div className="editor-cover-fallback">{selectedGameAccent}</div>
                                        )}
                                    </div>
                                    <div className="editor-preview-meta">
                                        <div className="preview-title">{editDraft.title || selectedGame.title}</div>
                                        {editDraft.original_title && (
                                            <div className="preview-subtitle">{editDraft.original_title}</div>
                                        )}
                                        <div className="preview-note">目录：{selectedGame.dir_path}</div>
                                    </div>
                                </div>

                                <div className="editor-form">
                                    <label className="field">
                                        <span>游戏名称</span>
                                        <input
                                            className="input"
                                            value={editDraft.title}
                                            onChange={(e) => setEditDraft((prev) => ({ ...prev, title: e.target.value }))}
                                        />
                                    </label>
                                    <label className="field">
                                        <span>原名</span>
                                        <input
                                            className="input"
                                            value={editDraft.original_title}
                                            onChange={(e) => setEditDraft((prev) => ({ ...prev, original_title: e.target.value }))}
                                        />
                                    </label>
                                    <label className="field">
                                        <span>开发商</span>
                                        <input
                                            className="input"
                                            value={editDraft.developer}
                                            onChange={(e) => setEditDraft((prev) => ({ ...prev, developer: e.target.value }))}
                                        />
                                    </label>
                                    <label className="field">
                                        <span>启动路径</span>
                                        <input
                                            className="input"
                                            value={editDraft.exe_path}
                                            onChange={(e) => setEditDraft((prev) => ({ ...prev, exe_path: e.target.value }))}
                                        />
                                    </label>
                                    <label className="field">
                                        <span>封面路径 / URL</span>
                                        <input
                                            className="input"
                                            value={editDraft.cover_path}
                                            onChange={(e) => setEditDraft((prev) => ({ ...prev, cover_path: e.target.value }))}
                                        />
                                    </label>
                                    <label className="field">
                                        <span>VNDB ID</span>
                                        <input
                                            className="input"
                                            value={editDraft.vndb_id}
                                            onChange={(e) => setEditDraft((prev) => ({ ...prev, vndb_id: e.target.value }))}
                                        />
                                    </label>
                                    <label className="field field-full">
                                        <span>简介</span>
                                        <textarea
                                            className="input textarea"
                                            value={editDraft.summary}
                                            onChange={(e) => setEditDraft((prev) => ({ ...prev, summary: e.target.value }))}
                                        />
                                    </label>

                                    <div className="editor-actions">
                                        <button className="btn" onClick={onCancelEdit} disabled={loading}>取消</button>
                                        <button className="btn btn-accent" onClick={onSaveEdit} disabled={loading}>保存修改</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="detail-shell">
                            <div className="detail-topbar">
                                <div className="detail-topbar-text">
                                    <h2>{selectedGame.title}</h2>
                                    {selectedGame.original_title && selectedGame.original_title !== selectedGame.title && (
                                        <p>{selectedGame.original_title}</p>
                                    )}
                                </div>
                                <button className="btn" onClick={onStartEdit} disabled={loading}>编辑</button>
                            </div>

                            <div className="detail-card">
                                <div className="detail-media">
                                    <div className={`detail-media-surface ${selectedGame.cover_path ? '' : 'no-cover'}`}>
                                        {selectedGame.cover_path ? (
                                            <img src={selectedGame.cover_path} alt="cover" className="detail-cover-image" />
                                        ) : (
                                            <div className="detail-cover-fallback">{selectedGameAccent}</div>
                                        )}
                                    </div>
                                </div>

                                <div className="detail-info">
                                    <div className="detail-tags">
                                        {selectedGame.developer && <span className="tag soft-tag">开发商 {selectedGame.developer}</span>}
                                        <span className="tag soft-tag">游玩 {playTimeText(selectedGame.play_time_sec)}</span>
                                        {selectedGame.vndb_id && <span className="tag soft-tag">{selectedGame.vndb_id}</span>}
                                    </div>

                                    <div className="detail-summary">
                                        {selectedGame.summary || '暂无简介'}
                                    </div>

                                    <div className="detail-paths">
                                        <div className="path-card">
                                            <span>目录</span>
                                            <p>{selectedGame.dir_path}</p>
                                        </div>
                                        <div className="path-card">
                                            <span>启动路径</span>
                                            <p>{selectedGame.exe_path}</p>
                                        </div>
                                    </div>

                                    <div className="detail-actions">
                                        <button className="btn-primary start-btn" onClick={onLaunch} disabled={loading || selectedGame.is_deleted}>
                                            开始游戏
                                        </button>
                                        <button className="btn" onClick={onScrapeBangumi} disabled={loading || selectedGame.is_deleted}>
                                            重新抓取
                                        </button>
                                        {selectedGame.is_deleted && (
                                            <button className="btn btn-accent" onClick={onRestoreSelected} disabled={loading}>
                                                取消隐藏
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                ) : (
                    <div className="empty-state">
                        <div className="empty-icon">GAL</div>
                        <p>添加目录并扫描，开始整理你的游戏收藏。</p>
                    </div>
                )}

                <div className="status-line">
                    {loading ? '处理中...' : '就绪'}
                    {!isWailsRuntime ? ' | 当前为前端预览模式' : ''}
                    {errorText ? ` | 错误：${errorText}` : ''}
                </div>
            </main>
        </div>
    );
}

export default App;
