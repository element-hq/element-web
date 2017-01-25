// Run a web server capable of dumping bug reports sent by Riot.
// Requires Go 1.5+
// Usage:   go run rageshake.go PORT
// Example: go run rageshake.go 8080
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
)

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

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, req *http.Request) {
		if req.Method != "POST" && req.Method != "OPTIONS" {
			w.WriteHeader(405)
			return
		}
        // Set CORS
        w.Header().Set("Access-Control-Allow-Origin", "*")
        w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        w.Header().Set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
        if req.Method == "OPTIONS" {
            return;
        }
		var p Payload
		if err := json.NewDecoder(req.Body).Decode(&p); err != nil {
			w.WriteHeader(400)
			w.Write([]byte("Body is not JSON"))
			return
		}
        // Dump bug report to disk
		fmt.Println(p)

	})

	port := os.Args[1]
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
