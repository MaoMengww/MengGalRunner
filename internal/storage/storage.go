package storage

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"

	"MengGalRunner/internal/model"
)

type Manager struct {
	dataDir    string
	gamesFile  string
	configFile string
	mu         sync.RWMutex
}

func NewManager() (*Manager, error) {
	userCfgDir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	dataDir := filepath.Join(userCfgDir, "MengGalRunner")
	legacyDir := filepath.Join(userCfgDir, "MengGal")
	if _, err := os.Stat(dataDir); errors.Is(err, os.ErrNotExist) {
		if _, legacyErr := os.Stat(legacyDir); legacyErr == nil {
			if err := os.Rename(legacyDir, dataDir); err != nil && !errors.Is(err, os.ErrNotExist) {
				return nil, err
			}
		}
	}
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}

	m := &Manager{
		dataDir:    dataDir,
		gamesFile:  filepath.Join(dataDir, "games.json"),
		configFile: filepath.Join(dataDir, "config.json"),
	}

	if err := m.initFiles(); err != nil {
		return nil, err
	}

	return m, nil
}

func (m *Manager) initFiles() error {
	if _, err := os.Stat(m.configFile); errors.Is(err, os.ErrNotExist) {
		if err := m.SaveConfig(model.AppConfig{LibraryPaths: []string{}}); err != nil {
			return err
		}
	}
	if _, err := os.Stat(m.gamesFile); errors.Is(err, os.ErrNotExist) {
		if err := m.SaveGames([]model.Game{}); err != nil {
			return err
		}
	}
	return nil
}

func (m *Manager) LoadConfig() (model.AppConfig, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	content, err := os.ReadFile(m.configFile)
	if err != nil {
		return model.AppConfig{}, err
	}
	var cfg model.AppConfig
	if len(content) == 0 {
		return model.AppConfig{LibraryPaths: []string{}}, nil
	}
	if err := json.Unmarshal(content, &cfg); err != nil {
		return model.AppConfig{}, err
	}
	if cfg.LibraryPaths == nil {
		cfg.LibraryPaths = []string{}
	}
	return cfg, nil
}

func (m *Manager) SaveConfig(cfg model.AppConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return writeFileAtomic(m.configFile, data, 0644)
}

func (m *Manager) LoadGames() ([]model.Game, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	content, err := os.ReadFile(m.gamesFile)
	if err != nil {
		return nil, err
	}
	if len(content) == 0 {
		return []model.Game{}, nil
	}
	var games []model.Game
	if err := json.Unmarshal(content, &games); err != nil {
		return nil, err
	}
	if games == nil {
		return []model.Game{}, nil
	}
	return games, nil
}

func (m *Manager) SaveGames(games []model.Game) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	data, err := json.MarshalIndent(games, "", "  ")
	if err != nil {
		return err
	}
	return writeFileAtomic(m.gamesFile, data, 0644)
}

func writeFileAtomic(target string, data []byte, mode os.FileMode) error {
	tmp := target + ".tmp"
	if err := os.WriteFile(tmp, data, mode); err != nil {
		return err
	}
	return os.Rename(tmp, target)
}
