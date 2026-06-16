package drive

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

var (
	clientID     string
	clientSecret string
	refreshToken string
	RootFolderID string
	initialized  bool

	mu          sync.Mutex
	cachedToken string
	tokenExpiry time.Time
)

func Init() error {
	clientID = os.Getenv("GOOGLE_DRIVE_CLIENT_ID")
	clientSecret = os.Getenv("GOOGLE_DRIVE_CLIENT_SECRET")
	refreshToken = os.Getenv("GOOGLE_DRIVE_REFRESH_TOKEN")
	RootFolderID = os.Getenv("GOOGLE_DRIVE_ROOT_FOLDER_ID")

	if clientID == "" || clientSecret == "" || refreshToken == "" || RootFolderID == "" {
		return fmt.Errorf("missing one or more GOOGLE_DRIVE_* env vars")
	}
	initialized = true
	return nil
}

func Enabled() bool { return initialized }

func accessToken() (string, error) {
	mu.Lock()
	defer mu.Unlock()

	if cachedToken != "" && time.Now().Before(tokenExpiry) {
		return cachedToken, nil
	}

	resp, err := http.PostForm("https://oauth2.googleapis.com/token", url.Values{
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"refresh_token": {refreshToken},
		"grant_type":    {"refresh_token"},
	})
	if err != nil {
		return "", fmt.Errorf("token request: %w", err)
	}
	defer resp.Body.Close()

	var tr struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tr); err != nil {
		return "", fmt.Errorf("decode token response: %w", err)
	}
	if tr.Error != "" {
		return "", fmt.Errorf("OAuth2 token error: %s — %s", tr.Error, tr.ErrorDesc)
	}
	if tr.AccessToken == "" {
		return "", fmt.Errorf("got empty access token")
	}

	cachedToken = tr.AccessToken
	tokenExpiry = time.Now().Add(time.Duration(tr.ExpiresIn-60) * time.Second)
	return cachedToken, nil
}

func doGet(rawURL string) (*http.Response, error) {
	tok, err := accessToken()
	if err != nil {
		return nil, err
	}
	req, _ := http.NewRequest("GET", rawURL, nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	return http.DefaultClient.Do(req)
}

func doPostJSON(rawURL string, body interface{}) (*http.Response, error) {
	tok, err := accessToken()
	if err != nil {
		return nil, err
	}
	var buf bytes.Buffer
	json.NewEncoder(&buf).Encode(body)
	req, _ := http.NewRequest("POST", rawURL, &buf)
	req.Header.Set("Authorization", "Bearer "+tok)
	req.Header.Set("Content-Type", "application/json")
	return http.DefaultClient.Do(req)
}

// GetOrCreateFolder returns the Drive folder ID for the given name under parentID,
// creating it if it does not exist.
func GetOrCreateFolder(parentID, name string) (string, error) {
	escaped := strings.ReplaceAll(name, "'", "\\'")
	q := fmt.Sprintf(
		"name='%s' and mimeType='application/vnd.google-apps.folder' and '%s' in parents and trashed=false",
		escaped, parentID,
	)
	resp, err := doGet("https://www.googleapis.com/drive/v3/files?fields=files(id)&q=" + url.QueryEscape(q))
	if err != nil {
		return "", fmt.Errorf("search folder: %w", err)
	}
	defer resp.Body.Close()

	var list struct {
		Files []struct {
			ID string `json:"id"`
		} `json:"files"`
	}
	json.NewDecoder(resp.Body).Decode(&list)
	if len(list.Files) > 0 {
		return list.Files[0].ID, nil
	}

	resp, err = doPostJSON("https://www.googleapis.com/drive/v3/files?fields=id", map[string]interface{}{
		"name":     name,
		"mimeType": "application/vnd.google-apps.folder",
		"parents":  []string{parentID},
	})
	if err != nil {
		return "", fmt.Errorf("create folder: %w", err)
	}
	defer resp.Body.Close()

	var created struct {
		ID string `json:"id"`
	}
	json.NewDecoder(resp.Body).Decode(&created)
	if created.ID == "" {
		return "", fmt.Errorf("create folder %q: empty ID in response", name)
	}
	return created.ID, nil
}

// UploadFile uploads content to the given Drive folder and returns the file ID
// and the web view link.
func UploadFile(folderID, fileName string, content io.Reader, mimeType string) (fileID, webViewLink string, err error) {
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	tok, err := accessToken()
	if err != nil {
		return "", "", err
	}

	var fileBuf bytes.Buffer
	if _, err := io.Copy(&fileBuf, content); err != nil {
		return "", "", fmt.Errorf("buffer file content: %w", err)
	}

	var body bytes.Buffer
	w := multipart.NewWriter(&body)

	mh := make(textproto.MIMEHeader)
	mh.Set("Content-Type", "application/json; charset=UTF-8")
	metaPart, _ := w.CreatePart(mh)
	json.NewEncoder(metaPart).Encode(map[string]interface{}{
		"name":    fileName,
		"parents": []string{folderID},
	})

	fh := make(textproto.MIMEHeader)
	fh.Set("Content-Type", mimeType)
	filePart, _ := w.CreatePart(fh)
	fileBuf.WriteTo(filePart)
	w.Close()

	req, _ := http.NewRequest(
		"POST",
		"https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
		&body,
	)
	req.Header.Set("Authorization", "Bearer "+tok)
	req.Header.Set("Content-Type", "multipart/related; boundary="+w.Boundary())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("upload request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("Drive upload error status=%d body=%s", resp.StatusCode, string(respBody))
		return "", "", fmt.Errorf("Drive returned HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		ID          string `json:"id"`
		WebViewLink string `json:"webViewLink"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", "", fmt.Errorf("decode upload response: %w", err)
	}
	if result.ID == "" {
		return "", "", fmt.Errorf("empty file ID in response: %s", string(respBody))
	}
	return result.ID, result.WebViewLink, nil
}

// DeleteFile permanently deletes a file from Drive by its ID.
func DeleteFile(fileID string) error {
	tok, err := accessToken()
	if err != nil {
		return err
	}
	req, _ := http.NewRequest("DELETE", "https://www.googleapis.com/drive/v3/files/"+fileID, nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}
