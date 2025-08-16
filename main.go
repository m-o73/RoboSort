package main

import (
	"log"
	"net/http"
	"os"
)

func main() {
	// Serve files in ./static at /
	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/", fs)

	// Health check
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	addr := ":" + envOrDefault("PORT", "8080")
	log.Printf("Server listening on http://localhost%v ...", addr)
	log.Printf("Note: Camera access requires HTTPS in browsers. For local dev, use http://localhost%v", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
