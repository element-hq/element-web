// Run a web server capable of dumping bug reports sent by Riot.
// Requires Go 1.5+
// Usage:   go run rageshake.go PORT
// Example: go run rageshake.go 8080
package main

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

var maxPayloadSize = 1024 * 1024 * 55 // 55 MB

type LogEntry struct {
	ID    string `json:"id"`
	Lines string `json:"lines"`
}

type Payload struct {
	Text      string     `json:"text"`
	Version   string     `json:"version"`
	UserAgent string     `json:"user_agent"`
	Logs      []LogEntry `json:"logs"`
}

func respond(code int, w http.ResponseWriter) {
	w.WriteHeader(code)
	w.Write([]byte("{}"))
}

func gzipAndSave(data []byte, dirname, fpath string) error {
	_ = os.MkdirAll(filepath.Join("bugs", dirname), os.ModePerm)
	fpath = filepath.Join("bugs", dirname, fpath)

	if _, err := os.Stat(fpath); err == nil {
		return fmt.Errorf("file already exists") // the user can just retry
	}
	var b bytes.Buffer
	gz := gzip.NewWriter(&b)
	if _, err := gz.Write(data); err != nil {
		return err
	}
	if err := gz.Flush(); err != nil {
		return err
	}
	if err := gz.Close(); err != nil {
		return err
	}
	if err := ioutil.WriteFile(fpath, b.Bytes(), 0644); err != nil {
		return err
	}
	return nil
}

func main() {
	http.HandleFunc("/api/submit", func(w http.ResponseWriter, req *http.Request) {
		if req.Method != "POST" && req.Method != "OPTIONS" {
			respond(405, w)
			return
		}
		// Set CORS
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
		if req.Method == "OPTIONS" {
			respond(200, w)
			return
		}
		if length, err := strconv.Atoi(req.Header.Get("Content-Length")); err != nil || length > maxPayloadSize {
			respond(413, w)
			return
		}
		var p Payload
		if err := json.NewDecoder(req.Body).Decode(&p); err != nil {
			respond(400, w)
			return
		}
		// Dump bug report to disk as form:
		//  "bugreport-20170115-112233.log.gz" => user text, version, user agent, # logs
		//  "bugreport-20170115-112233-0.log.gz" => most recent log
		//  "bugreport-20170115-112233-1.log.gz" => ...
		//  "bugreport-20170115-112233-N.log.gz" => oldest log
		t := time.Now().UTC()
		prefix := t.Format("2006-01-02/150405")
		summary := fmt.Sprintf(
			"%s\n\nNumber of logs: %d\nVersion: %s\nUser-Agent: %s\n", p.Text, len(p.Logs), p.Version, p.UserAgent,
		)
		if err := gzipAndSave([]byte(summary), prefix, "details.log.gz"); err != nil {
			respond(500, w)
			return
		}
		for i, log := range p.Logs {
			if err := gzipAndSave([]byte(log.Lines), prefix, fmt.Sprintf("logs-%d.log.gz", i)); err != nil {
				respond(500, w)
				return // TODO: Rollback?
			}
		}
		respond(200, w)
	})

	// Make sure bugs directory exists
	_ = os.Mkdir("bugs", os.ModePerm)

	port := os.Args[1]
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
