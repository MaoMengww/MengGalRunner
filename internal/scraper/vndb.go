package scraper

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"MengGalRunner/internal/model"
)

const UserAgent = "MengGalRunner-Agent/1.0 (https://github.com/maomengww/MengGalRunner)"

type vndbSearchRequest struct {
	Filters []interface{} `json:"filters"`
	Fields  string        `json:"fields"`
}

type vndbSearchResponse struct {
	Results []vndbSubject `json:"results"`
}

type vndbSubject struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	AltTitle    string `json:"alttitle"`
	Description string `json:"description"`
	Developers  []struct {
		Name string `json:"name"`
	} `json:"developers"`
	Image struct {
		URL string `json:"url"`
	} `json:"image"`
}

func FetchVNDBMetadata(keyword string) (model.GameMetadata, error) {
	client := &http.Client{Timeout: 12 * time.Second}
	reqBody, _ := json.Marshal(vndbSearchRequest{
		Filters: []interface{}{"search", "=", keyword},
		Fields:  "id, title, alttitle, description, developers.name, image.url",
	})

	req, err := http.NewRequest(http.MethodPost, "https://api.vndb.org/kana/vn", bytes.NewBuffer(reqBody))
	if err != nil {
		return model.GameMetadata{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", UserAgent)

	resp, err := client.Do(req)
	if err != nil {
		return model.GameMetadata{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return model.GameMetadata{}, fmt.Errorf("VNDB search failed: %d", resp.StatusCode)
	}

	var searchData vndbSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchData); err != nil {
		return model.GameMetadata{}, err
	}

	if len(searchData.Results) == 0 {
		return model.GameMetadata{}, errors.New("no VNDB results found")
	}

	best := searchData.Results[0]

	// Clean description BBCode
	reURL := regexp.MustCompile(`\[url(?:=.*?)?\](.*?)\[/url\]`)
	desc := reURL.ReplaceAllString(best.Description, "$1")
	reTag := regexp.MustCompile(`\[/?(?:b|i|u|s|spoiler)\]`)
	desc = reTag.ReplaceAllString(desc, "")

	devs := make([]string, 0, len(best.Developers))
	for _, d := range best.Developers {
		devs = append(devs, d.Name)
	}

	titleCN := best.AltTitle
	if titleCN == "" {
		titleCN = best.Title
	}

	return model.GameMetadata{
		VndbID:    best.ID,
		Name:      best.Title,
		NameCN:    titleCN,
		Summary:   strings.TrimSpace(desc),
		Developer: strings.Join(devs, ", "),
		CoverURL:  best.Image.URL,
	}, nil
}
