package main

import (
	"log"
	"net/http"
	"os"

	"bough/licenseserver/handler"
	"bough/licenseserver/keygen"
	"bough/licenseserver/mailer"
	"bough/licenseserver/store"
)

func main() {
	db, err := store.Open(envOr("DB_PATH", "bough-licenses.db"))
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer db.Close()

	kg := keygen.New(mustEnv("PRIVATE_KEY_HEX"))
	ml := mailer.New(mustEnv("RESEND_API_KEY"), mustEnv("FROM_EMAIL"))

	mux := http.NewServeMux()
	mux.HandleFunc("POST /webhook", handler.Webhook(kg, ml, db, mustEnv("STRIPE_WEBHOOK_SECRET")))
	mux.HandleFunc("POST /activate", handler.Activate(db))
	mux.HandleFunc("GET /revoked", handler.Revoked(kg, db))
	mux.HandleFunc("GET /health", handler.Health)

	port := envOr("PORT", "8080")
	log.Printf("Listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("required env var %s is not set", key)
	}
	return v
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
