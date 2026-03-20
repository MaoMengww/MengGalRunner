package scraper

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"MengGalRunner/internal/model"
)

type bangumiSearchResponse struct {
	List []struct {
		ID      int    `json:"id"`
		Name    string `json:"name"`
		NameCN  string `json:"name_cn"`
		Summary string `json:"summary"`
	} `json:"list"`
}

func FetchBangumiChineseInfo(keyword string) (model.GameMetadata, error) {
	if keyword == "" {
		return model.GameMetadata{}, errors.New("empty keyword")
	}
	client := &http.Client{Timeout: 10 * time.Second}
	searchURL := "https://api.bgm.tv/search/subject/" + url.PathEscape(keyword) + "?type=4&responseGroup=medium"

	req, err := http.NewRequest(http.MethodGet, searchURL, nil)
	if err != nil {
		return model.GameMetadata{}, err
	}
	req.Header.Set("User-Agent", UserAgent)

	resp, err := client.Do(req)
	if err != nil {
		return model.GameMetadata{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return model.GameMetadata{}, fmt.Errorf("bangumi status: %d", resp.StatusCode)
	}

	var data bangumiSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return model.GameMetadata{}, err
	}

	if len(data.List) == 0 {
		return model.GameMetadata{}, errors.New("no bangumi match")
	}

	for _, item := range data.List {
		if item.Summary != "" || item.NameCN != "" {
			return model.GameMetadata{
				Name:    item.Name,
				NameCN:  item.NameCN,
				Summary: strings.TrimSpace(item.Summary),
			}, nil
		}
	}

	return model.GameMetadata{}, errors.New("no useful content in bangumi results")
}
