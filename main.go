package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gorilla/mux"
)

func main() {
	r := mux.NewRouter()

	// Health check
	r.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	}).Methods("GET")

	// API to list images in /static/images
	r.HandleFunc("/api/images", func(w http.ResponseWriter, r *http.Request) {
		files, err := os.ReadDir("./static/images") // Correct folder path
		if err != nil {
			http.Error(w, "Failed to read images", http.StatusInternalServerError)
			return
		}
		var images []map[string]string
		for _, f := range files {
			if !f.IsDir() {
				ext := filepath.Ext(f.Name())
				if ext == ".jpg" || ext == ".jpeg" || ext == ".png" {
					// Manually specify correct labels here
					var correctLabel string
					switch f.Name() {
					case "damageddd.jpg":
						correctLabel = "not usable"
					case "damageddd2.png":
						correctLabel = "not usable"
					case "damageddd3.png":
						correctLabel = "not usable"
					case "jackettt.jpeg":
						correctLabel = "usable"
					case "jackettt2.jpeg":
						correctLabel = "usable"
					case "panttts.jpg":
						correctLabel = "usable"
					case "shirttt.jpg":
						correctLabel = "usable"
					}

					images = append(images, map[string]string{
						"image": "images/" + f.Name(),
						"label": correctLabel,
					})
				}
			}
		}
		json.NewEncoder(w).Encode(images)
	}).Methods("GET")

	// Serve static files (so /quiz.html works)
	fs := http.FileServer(http.Dir("./static"))
	r.PathPrefix("/").Handler(fs)

	// Start the server
	addr := ":" + envOrDefault("PORT", "8080")
	log.Printf("Server running at http://localhost%v", addr)
	log.Fatal(http.ListenAndServe(addr, r))
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
