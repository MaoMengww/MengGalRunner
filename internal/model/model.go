package model

type Game struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Original    string `json:"original_title"`
	DirPath     string `json:"dir_path"`
	ExePath     string `json:"exe_path"`
	CoverPath   string `json:"cover_path"`
	PlayTimeSec int64  `json:"play_time_sec"`
	LastPlayed  string `json:"last_played"`
	VndbID      string `json:"vndb_id"`
	IsDeleted   bool   `json:"is_deleted"`
	Developer   string `json:"developer"`
	Summary     string `json:"summary"`
}

type AppConfig struct {
	LibraryPaths []string `json:"library_paths"`
}

type AppState struct {
	Libraries []string `json:"libraries"`
	Games     []Game   `json:"games"`
}

type GameMetadata struct {
	VndbID    string
	Name      string
	NameCN    string
	Summary   string
	Developer string
	CoverURL  string
}

type GameMetadataUpdate struct {
	Title     string `json:"title"`
	Original  string `json:"original_title"`
	ExePath   string `json:"exe_path"`
	CoverPath string `json:"cover_path"`
	VndbID    string `json:"vndb_id"`
	Developer string `json:"developer"`
	Summary   string `json:"summary"`
}
