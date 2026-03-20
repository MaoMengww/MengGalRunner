package main

import (
	"context"
	"fmt"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"

	"MengGalRunner/internal/launcher"
	"MengGalRunner/internal/model"
	"MengGalRunner/internal/scanner"
	"MengGalRunner/internal/scraper"
	"MengGalRunner/internal/storage"
)

// App struct
type App struct {
	ctx     context.Context
	storage *storage.Manager
	mu      sync.Mutex
}

func (a *App) loadGames() ([]model.Game, error) {
	return a.storage.LoadGames()
}

func (a *App) saveGames(games []model.Game) error {
	return a.storage.SaveGames(games)
}

func findGameIndex(games []model.Game, id string) int {
	for i := range games {
		if games[i].ID == id {
			return i
		}
	}
	return -1
}

// NewApp creates a new App application struct
func NewApp() *App {
	sm, err := storage.NewManager()
	if err != nil {
		panic(err)
	}
	return &App{
		storage: sm,
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// GetState returns the current application state
func (a *App) GetState(includeDeleted bool) (model.AppState, error) {
	cfg, err := a.storage.LoadConfig()
	if err != nil {
		return model.AppState{}, err
	}
	games, err := a.loadGames()
	if err != nil {
		return model.AppState{}, err
	}

	if !includeDeleted {
		filtered := make([]model.Game, 0)
		for _, g := range games {
			if !g.IsDeleted {
				filtered = append(filtered, g)
			}
		}
		games = filtered
	}

	slices.SortFunc(games, func(a, b model.Game) int {
		return strings.Compare(strings.ToLower(a.Title), strings.ToLower(b.Title))
	})

	return model.AppState{
		Libraries: cfg.LibraryPaths,
		Games:     games,
	}, nil
}

// AddLibrary adds a new library path
func (a *App) AddLibrary(dir string) error {
	cfg, err := a.storage.LoadConfig()
	if err != nil {
		return err
	}

	cleanPath := filepath.Clean(strings.TrimSpace(dir))
	for _, p := range cfg.LibraryPaths {
		if strings.EqualFold(p, cleanPath) {
			return nil
		}
	}

	cfg.LibraryPaths = append(cfg.LibraryPaths, cleanPath)
	return a.storage.SaveConfig(cfg)
}

// RemoveLibrary removes a library path
func (a *App) RemoveLibrary(dir string) error {
	cfg, err := a.storage.LoadConfig()
	if err != nil {
		return err
	}

	cleanPath := filepath.Clean(strings.TrimSpace(dir))
	newPaths := make([]string, 0)
	for _, p := range cfg.LibraryPaths {
		if !strings.EqualFold(p, cleanPath) {
			newPaths = append(newPaths, p)
		}
	}

	cfg.LibraryPaths = newPaths
	return a.storage.SaveConfig(cfg)
}

// ScanLibraries scans all library paths for games
func (a *App) ScanLibraries() ([]model.Game, error) {
	cfg, err := a.storage.LoadConfig()
	if err != nil {
		return nil, err
	}
	games, err := a.storage.LoadGames()
	if err != nil {
		return nil, err
	}

	newGames, err := scanner.Scan(cfg.LibraryPaths, games)
	if err != nil {
		return nil, err
	}

	if err := a.saveGames(newGames); err != nil {
		return nil, err
	}

	return newGames, nil
}

func buildScrapeKeyword(g model.Game) string {
	keyword := strings.TrimSpace(g.Title)
	if keyword == "" {
		keyword = filepath.Base(g.DirPath)
	}

	reClean := regexp.MustCompile(`(?:\[.*?\]|【.*?】|\(.*?\)|（.*?）)`)
	keyword = reClean.ReplaceAllString(keyword, "")
	return strings.TrimSpace(keyword)
}

func scrapeMetadataByKeyword(keyword string) (model.GameMetadata, error) {
	if keyword == "" {
		return model.GameMetadata{}, fmt.Errorf("invalid keyword")
	}

	meta, err := scraper.FetchVNDBMetadata(keyword)
	if err != nil {
		return model.GameMetadata{}, fmt.Errorf("VNDB search failed: %v", err)
	}

	bgmMeta, err := scraper.FetchBangumiChineseInfo(meta.Name)
	if err == nil {
		if bgmMeta.NameCN != "" {
			meta.NameCN = bgmMeta.NameCN
		}
		if bgmMeta.Summary != "" {
			meta.Summary = bgmMeta.Summary
		}
	} else {
		bgmMeta, err = scraper.FetchBangumiChineseInfo(meta.NameCN)
		if err == nil {
			if bgmMeta.NameCN != "" {
				meta.NameCN = bgmMeta.NameCN
			}
			if bgmMeta.Summary != "" {
				meta.Summary = bgmMeta.Summary
			}
		}
	}

	return meta, nil
}

func (a *App) scrapeMetadataIntoGame(g *model.Game) error {
	keyword := buildScrapeKeyword(*g)
	meta, err := scrapeMetadataByKeyword(keyword)
	if err != nil {
		return err
	}

	g.Title = meta.NameCN
	g.Original = meta.Name
	g.Summary = meta.Summary
	g.Developer = meta.Developer
	g.VndbID = meta.VndbID
	g.CoverPath = meta.CoverURL
	return nil
}

// SetGameDeleted marks a game as hidden or visible.
func (a *App) SetGameDeleted(id string, deleted bool) error {
	games, err := a.loadGames()
	if err != nil {
		return err
	}

	idx := findGameIndex(games, id)
	if idx == -1 {
		return fmt.Errorf("game not found")
	}

	games[idx].IsDeleted = deleted
	return a.saveGames(games)
}

// DeleteGame permanently removes a game record.
func (a *App) DeleteGame(id string) error {
	games, err := a.loadGames()
	if err != nil {
		return err
	}

	idx := findGameIndex(games, id)
	if idx == -1 {
		return fmt.Errorf("game not found")
	}

	games = append(games[:idx], games[idx+1:]...)
	return a.saveGames(games)
}

// UpdateGameMetadata updates user-editable metadata for a game.
func (a *App) UpdateGameMetadata(id string, update model.GameMetadataUpdate) (model.Game, error) {
	games, err := a.loadGames()
	if err != nil {
		return model.Game{}, err
	}

	idx := findGameIndex(games, id)
	if idx == -1 {
		return model.Game{}, fmt.Errorf("game not found")
	}

	title := strings.TrimSpace(update.Title)
	if title == "" {
		title = games[idx].Title
	}

	games[idx].Title = title
	games[idx].Original = strings.TrimSpace(update.Original)
	games[idx].ExePath = strings.TrimSpace(update.ExePath)
	games[idx].CoverPath = strings.TrimSpace(update.CoverPath)
	games[idx].VndbID = strings.TrimSpace(update.VndbID)
	games[idx].Developer = strings.TrimSpace(update.Developer)
	games[idx].Summary = strings.TrimSpace(update.Summary)

	if err := a.saveGames(games); err != nil {
		return model.Game{}, err
	}
	return games[idx], nil
}

// LaunchGame starts a game and tracks its play time
func (a *App) LaunchGame(id string) error {
	games, err := a.loadGames()
	if err != nil {
		return err
	}

	idx := findGameIndex(games, id)
	if idx == -1 {
		return fmt.Errorf("game not found")
	}

	g := games[idx]
	err = launcher.Launch(g, func(duration int64) {
		a.mu.Lock()
		defer a.mu.Unlock()
		latestGames, _ := a.loadGames()
		latestIdx := findGameIndex(latestGames, id)
		if latestIdx != -1 {
			latestGames[latestIdx].PlayTimeSec += duration
			_ = a.saveGames(latestGames)
		}
	})

	if err != nil {
		return err
	}

	games[idx].LastPlayed = time.Now().UTC().Format(time.RFC3339)
	return a.saveGames(games)
}

// ScrapeMetadataForGame grabs metadata from VNDB and Bangumi
func (a *App) ScrapeMetadataForGame(id string) (model.Game, error) {
	games, err := a.loadGames()
	if err != nil {
		return model.Game{}, err
	}

	idx := findGameIndex(games, id)
	if idx == -1 {
		return model.Game{}, fmt.Errorf("game not found")
	}

	if err := a.scrapeMetadataIntoGame(&games[idx]); err != nil {
		return model.Game{}, err
	}

	if err := a.saveGames(games); err != nil {
		return model.Game{}, err
	}

	return games[idx], nil
}
