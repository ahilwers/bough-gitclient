package mailer

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

// Mailer sends transactional emails via the Resend API (https://resend.com).
type Mailer struct {
	apiKey   string
	fromAddr string
}

// New creates a Mailer with the given Resend API key and From address.
func New(apiKey, fromAddr string) *Mailer {
	return &Mailer{apiKey: apiKey, fromAddr: fromAddr}
}

// SendLicenseKey emails the license key to the purchaser.
func (m *Mailer) SendLicenseKey(toEmail, licenseKey string) error {
	body := map[string]any{
		"from":    m.fromAddr,
		"to":      []string{toEmail},
		"subject": "Your Bough License Key",
		"html": fmt.Sprintf(`<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:540px;margin:40px auto;color:#1d1d1f">
  <h2 style="margin-bottom:8px">Thank you for purchasing Bough!</h2>
  <p>Here is your license key:</p>
  <pre style="font-size:18px;letter-spacing:2px;padding:16px;background:#f5f5f5;
              border-radius:8px;word-break:break-all">%s</pre>
  <p><strong>To activate:</strong></p>
  <ol>
    <li>Open Bough</li>
    <li>Go to <strong>Bough → License</strong></li>
    <li>Paste your key and click <strong>Activate</strong></li>
  </ol>
  <p>Your license covers 2 machines (e.g. work + personal computer).</p>
  <p>If you need help, reply to this email.</p>
</body>
</html>`, licenseKey),
	}

	data, _ := json.Marshal(body)
	req, err := http.NewRequest(http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("build resend request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+m.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("resend request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("resend returned HTTP %d", resp.StatusCode)
	}
	return nil
}

// MailerInterface allows tests to inject a mock mailer.
type MailerInterface interface {
	SendLicenseKey(to, key string) error
}
