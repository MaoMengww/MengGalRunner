package scanner

import (
	"os"
	"path/filepath"
	"strings"

	"MengGalRunner/internal/model"

	"github.com/google/uuid"
)

func Scan(libraryPaths []string, existingGames []model.Game) ([]model.Game, error) {
	indexByExe := make(map[string]int)
	for i := range existingGames {
		exeKey := normalizeExeKey(existingGames[i].ExePath)
		if exeKey == "" {
			continue
		}
		indexByExe[exeKey] = i
	}

	foundExes := make(map[string]struct{})
	games := append([]model.Game(nil), existingGames...)

	for _, root := range libraryPaths {
		err := filepath.WalkDir(root, func(path string, d os.DirEntry, walkErr error) error {
			if walkErr != nil {
				return nil
			}
			if !d.IsDir() {
				return nil
			}
			exePath, ok := PickMainExe(path)
			if !ok {
				return nil
			}
			exePath = filepath.Clean(exePath)
			key := normalizeExeKey(exePath)
			foundExes[key] = struct{}{}
			title := filepath.Base(path)

			if _, exists := indexByExe[key]; exists {
				return nil
			}

			games = append(games, model.Game{
				ID:          uuid.NewString(),
				Title:       title,
				Original:    title,
				DirPath:     filepath.Clean(path),
				ExePath:     exePath,
				PlayTimeSec: 0,
				IsDeleted:   false,
			})
			indexByExe[key] = len(games) - 1
			return nil
		})
		if err != nil {
			return nil, err
		}
	}

	// Remove records in managed roots whose startup executable no longer exists.
	filtered := make([]model.Game, 0, len(games))
	for i := range games {
		if !InRoots(games[i].DirPath, libraryPaths) {
			filtered = append(filtered, games[i])
			continue
		}

		exeKey := normalizeExeKey(games[i].ExePath)
		if exeKey == "" {
			continue
		}
		if _, ok := foundExes[exeKey]; ok {
			filtered = append(filtered, games[i])
		}
	}

	return filtered, nil
}

func normalizeExeKey(path string) string {
	return strings.ToLower(filepath.Clean(strings.TrimSpace(path)))
}

func PickMainExe(dir string) (string, bool) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return "", false
	}
	var bestPath string
	var bestSize int64 = -1
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		nameLower := strings.ToLower(entry.Name())
		if !strings.HasSuffix(nameLower, ".exe") {
			continue
		}
		// Skip common non-game exes
		if strings.HasPrefix(nameLower, "unins") ||
			strings.HasPrefix(nameLower, "setup") ||
			strings.HasPrefix(nameLower, "config") ||
			strings.HasPrefix(nameLower, "redist") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		if info.Size() > bestSize {
			bestSize = info.Size()
			bestPath = filepath.Join(dir, entry.Name())
		}
	}
	if bestPath == "" {
		return "", false
	}
	return bestPath, true
}

func InRoots(path string, roots []string) bool {
	cleanPath := strings.ToLower(filepath.Clean(path))
	for _, root := range roots {
		cleanRoot := strings.ToLower(filepath.Clean(root))
		if cleanPath == cleanRoot || strings.HasPrefix(cleanPath, cleanRoot+string(os.PathSeparator)) {
			return true
		}
	}
	return false
}
