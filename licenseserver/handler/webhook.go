package handler

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"bough/licenseserver/keygen"
	"bough/licenseserver/mailer"
	"bough/licenseserver/store"

	"github.com/stripe/stripe-go/v78"
	stripewh "github.com/stripe/stripe-go/v78/webhook"
)

// Webhook returns an http.HandlerFunc that processes Stripe webhook events.
// It verifies the Stripe signature before processing any event.
func Webhook(kg *keygen.KeyGen, ml mailer.MailerInterface, db *store.DB, secret string) http.HandlerFunc {
	return webhookHandler(kg, ml, db, secret, true)
}

// WebhookForTest returns a handler that skips Stripe signature verification.
// Only available in test builds — never use in production.
func WebhookForTest(kg *keygen.KeyGen, ml mailer.MailerInterface, db *store.DB) http.HandlerFunc {
	return webhookHandler(kg, ml, db, "", false)
}

func webhookHandler(kg *keygen.KeyGen, ml mailer.MailerInterface, db *store.DB, secret string, verifySig bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(io.LimitReader(r.Body, 65536))
		if err != nil {
			http.Error(w, "read error", http.StatusBadRequest)
			return
		}

		var event stripe.Event
		if verifySig {
			event, err = stripewh.ConstructEvent(body, r.Header.Get("Stripe-Signature"), secret)
			if err != nil {
				log.Printf("webhook signature invalid: %v", err)
				http.Error(w, "invalid signature", http.StatusBadRequest)
				return
			}
		} else {
			if err := json.Unmarshal(body, &event); err != nil {
				http.Error(w, "parse error", http.StatusBadRequest)
				return
			}
		}

		switch event.Type {

		case "checkout.session.completed":
			var session stripe.CheckoutSession
			if err := json.Unmarshal(event.Data.Raw, &session); err != nil {
				http.Error(w, "parse error", http.StatusBadRequest)
				return
			}
			email := session.CustomerDetails.Email
			if email == "" {
				log.Printf("checkout.session.completed: no email in session %s", session.ID)
				w.WriteHeader(http.StatusOK)
				return
			}

			key, rawPayload, sigHex, err := kg.Generate(email, "indie", "perpetual")
			if err != nil {
				log.Printf("keygen failed for %s: %v", email, err)
				http.Error(w, "keygen error", http.StatusInternalServerError)
				return
			}

			if err := db.SaveIssuedKey(key, email, session.ID, rawPayload, sigHex); err != nil {
				log.Printf("db.SaveIssuedKey failed for %s: %v", email, err)
				// Non-fatal: still send the key.
			}

			if err := ml.SendLicenseKey(email, key); err != nil {
				log.Printf("mailer failed for %s: %v", email, err)
				http.Error(w, "mail error", http.StatusInternalServerError)
				return
			}
			log.Printf("license key issued and sent to %s", email)

		case "charge.refunded":
			var charge stripe.Charge
			if err := json.Unmarshal(event.Data.Raw, &charge); err == nil {
				if err := db.RevokeByPaymentID(charge.ID); err != nil {
					log.Printf("revoke on refund failed for charge %s: %v", charge.ID, err)
				} else {
					log.Printf("key revoked on refund for charge %s", charge.ID)
				}
			}

		case "charge.dispute.created":
			var dispute stripe.Dispute
			if err := json.Unmarshal(event.Data.Raw, &dispute); err == nil {
				if err := db.RevokeByPaymentID(dispute.Charge.ID); err != nil {
					log.Printf("revoke on dispute failed for charge %s: %v", dispute.Charge.ID, err)
				} else {
					log.Printf("key revoked on chargeback for charge %s", dispute.Charge.ID)
				}
			}

		case "charge.dispute.closed":
			var dispute stripe.Dispute
			if err := json.Unmarshal(event.Data.Raw, &dispute); err == nil {
				if dispute.Status == "won" {
					if err := db.UnrevokeByPaymentID(dispute.Charge.ID); err != nil {
						log.Printf("unrevoke failed for charge %s: %v", dispute.Charge.ID, err)
					} else {
						log.Printf("key restored after winning dispute for charge %s", dispute.Charge.ID)
					}
				}
			}
		}

		w.WriteHeader(http.StatusOK)
	}
}
