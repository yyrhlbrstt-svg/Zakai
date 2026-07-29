// Zakai Mandate — reference decision implementation, Go, standard library only.
//
// Go first among the compiled languages because it is what payment and banking
// infrastructure is actually written in, and because "go run one file, no
// modules, no dependencies" is an evaluation somebody can finish before their
// coffee goes cold.
//
// The decision layer performs no cryptography. Signature verification happens
// earlier, in whatever JWT library the institution already runs, and by the
// time a claim set reaches this code its authenticity is settled. What is left
// is policy, and policy is comparisons on a map.
//
// The ordering of the checks is normative and the vectors pin it. Two rules can
// often both fire and which reason comes back is what integrators branch on. In
// particular the forbidden-scope rule precedes every temporal check: an expired
// token bearing an outward-money scope still means somebody is issuing
// forbidden mandates, which is a registry-level incident rather than a stale
// credential, and reporting "expired" would hide it behind the lesser fault.
//
// Usage:
//
//	go run zakai_decide.go --url https://zakai-3uxj.vercel.app
//	go run zakai_decide.go --file vectors.json
//
// Exits 0 when every vector passes, 1 otherwise, so it drops into CI.
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	defaultOrigin = "https://zakai-3uxj.vercel.app"
	vectorsPath   = "/api/mandate/test-vectors"
)

// Scopes no mandate may ever carry, from any issuer. Money only ever flows
// toward the principal; an agent that cannot spend is a categorically different
// risk object from one that can, and that limit is what makes these acceptable
// to a regulated institution at all.
var forbiddenScopes = map[string]bool{
	"payment:initiate": true,
	"payment:transfer": true,
	"credit:borrow":    true,
	"account:open":     true,
	"account:close":    true,
	"investment:trade": true,
}

// Whether each known scope needs the principal to confirm every individual
// exercise. Risk tier and this question are NOT the same thing —
// request:records is correspondence-tier and still standing, because asking
// somebody to confirm each request for their own records is friction with no
// safety behind it. An independent implementation got that wrong first time,
// which is why there is now a vector for it.
var perActConfirmation = map[string]bool{
	"read:accounts":     false,
	"read:transactions": false,
	"read:credit":       false,
	"read:bills":        false,
	"read:policies":     false,
	"read:payroll":      false,
	"read:tax":          false,
	"request:records":   false,
	"claim:submit":      true,
	"claim:appeal":      true,
	"dispute:charge":    true,
	"negotiate:tariff":  true,
	"contract:cancel":   true,
	"contract:switch":   true,
	"settle:receive":    true,
}

// Claims is the verified mandate payload. Temporal fields are pointers so an
// absent claim is distinguishable from a zero one — the distinction that turns
// a malformed token into an eternal mandate if you get it wrong.
type Claims struct {
	Jti    string   `json:"jti"`
	Aud    string   `json:"aud"`
	Sub    string   `json:"sub"`
	Scopes []string `json:"scopes"`
	Market string   `json:"market"`
	Nbf    *int64   `json:"nbf"`
	Exp    *int64   `json:"exp"`
}

type Request struct {
	Claims          Claims
	Action          string
	Audience        string
	Subject         string
	Market          string
	Revocation      string
	ActConfirmation string
	Now             int64
}

type Decision struct {
	Decision    string
	Reason      string
	Obligations []string
}

func (d Decision) key() string {
	if d.Reason != "" {
		return d.Decision + ":" + d.Reason
	}
	return d.Decision
}

func deny(reason string) Decision { return Decision{Decision: "deny", Reason: reason} }

// Decide answers: may this agent do this, now?
//
// Total by construction — every input yields a decision and none panics. A
// function a bank wraps in a recover() is one whose recover block will
// eventually permit something.
func Decide(r Request) Decision {
	// Structural mismatches first. "You sent this to the wrong institution" is
	// more useful to an integrator than "that scope is missing".
	if r.Claims.Aud != r.Audience {
		return deny("audience_mismatch")
	}
	if r.Subject != "" && r.Claims.Sub != r.Subject {
		return deny("subject_mismatch")
	}
	if r.Market != "" && r.Claims.Market != "" && r.Claims.Market != r.Market {
		return deny("market_mismatch")
	}

	// The categorical limit, before anything temporal. See the package comment.
	if forbiddenScopes[r.Action] {
		return deny("scope_forbidden")
	}
	for _, s := range r.Claims.Scopes {
		if forbiddenScopes[s] {
			return deny("scope_forbidden")
		}
	}

	// A missing expiry is malformed, never eternal.
	if r.Claims.Exp == nil || r.Claims.Nbf == nil {
		return deny("malformed_claims")
	}
	if r.Now < *r.Claims.Nbf {
		return deny("not_yet_valid")
	}
	if r.Now >= *r.Claims.Exp {
		return deny("expired")
	}

	perAct, known := perActConfirmation[r.Action]
	if !known {
		return deny("scope_unknown")
	}
	granted := false
	for _, s := range r.Claims.Scopes {
		if s == r.Action {
			granted = true
			break
		}
	}
	if !granted {
		return deny("scope_not_granted")
	}
	if perAct && strings.TrimSpace(r.ActConfirmation) == "" {
		return deny("act_confirmation_required")
	}

	if r.Revocation == "revoked" {
		return deny("revoked")
	}
	if r.Revocation != "active" {
		// Not a permit with a warning. An institution that cannot establish
		// revocation status has not established authority, and softening this
		// is how a revoked mandate keeps working for the one caller who never
		// checks.
		return deny("revocation_unknown")
	}

	obligations := []string{"record:" + r.Claims.Jti, "notify_principal:" + r.Action}
	if c := strings.TrimSpace(r.ActConfirmation); c != "" {
		obligations = append(obligations, "retain_confirmation:"+c)
	}
	return Decision{Decision: "permit", Obligations: obligations}
}

// ---------------------------------------------------------------------------
// Conformance runner
// ---------------------------------------------------------------------------

type vectorDoc struct {
	EvaluatedAt int64 `json:"evaluated_at_unix"`
	Vectors     []struct {
		ID              string `json:"id"`
		Pins            string `json:"pins"`
		Claims          Claims `json:"claims"`
		Action          string `json:"action"`
		Audience        string `json:"audience"`
		Subject         string `json:"subject"`
		Market          string `json:"market"`
		Revocation      string `json:"revocation"`
		ActConfirmation string `json:"act_confirmation"`
		Expect          struct {
			Decision string `json:"decision"`
			Reason   string `json:"reason"`
		} `json:"expect"`
	} `json:"vectors"`
}

func load(source string) (*vectorDoc, error) {
	var raw []byte
	var err error

	if strings.HasPrefix(source, "http://") || strings.HasPrefix(source, "https://") {
		client := &http.Client{Timeout: 30 * time.Second}
		resp, e := client.Get(strings.TrimSuffix(source, "/") + vectorsPath)
		if e != nil {
			return nil, e
		}
		defer resp.Body.Close()
		doc := &vectorDoc{}
		return doc, json.NewDecoder(resp.Body).Decode(doc)
	}

	// A local path, for CI in an environment with no outbound network — which
	// is most of the ones that would actually be evaluating this.
	if raw, err = os.ReadFile(source); err != nil {
		return nil, err
	}
	doc := &vectorDoc{}
	return doc, json.Unmarshal(raw, doc)
}

func main() {
	source := defaultOrigin
	args := os.Args[1:]
	for i := 0; i < len(args)-1; i++ {
		if args[i] == "--url" || args[i] == "--file" {
			source = args[i+1]
		}
	}

	doc, err := load(source)
	if err != nil {
		fmt.Fprintf(os.Stderr, "could not load vectors from %s: %v\n", source, err)
		os.Exit(2)
	}

	var failures []string
	for _, v := range doc.Vectors {
		expected := v.Expect.Decision
		if v.Expect.Reason != "" {
			expected += ":" + v.Expect.Reason
		}
		revocation := v.Revocation
		if revocation == "" {
			revocation = "unknown"
		}

		// Evaluated at the document's fixed instant, never the wall clock: a
		// vector checked against time.Now() is a test that passes today and
		// fails on the day somebody actually runs it.
		got := Decide(Request{
			Claims:          v.Claims,
			Action:          v.Action,
			Audience:        v.Audience,
			Subject:         v.Subject,
			Market:          v.Market,
			Revocation:      revocation,
			ActConfirmation: v.ActConfirmation,
			Now:             doc.EvaluatedAt,
		}).key()

		if got != expected {
			failures = append(failures,
				fmt.Sprintf("  %s: expected %s, got %s\n    pins: %s", v.ID, expected, got, v.Pins))
		}
	}

	if len(failures) > 0 {
		// No partial credit. One wrong answer in a trust network is one
		// participant honouring something nobody else does.
		fmt.Printf("NOT CONFORMANT — %d of %d vectors failed:\n\n", len(failures), len(doc.Vectors))
		fmt.Println(strings.Join(failures, "\n"))
		os.Exit(1)
	}

	fmt.Printf("CONFORMANT — %d/%d vectors passed.\n", len(doc.Vectors), len(doc.Vectors))
}
