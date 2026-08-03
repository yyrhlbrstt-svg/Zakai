// Zakai Settlement — reference adjudication, Go, standard library only.
//
// Companion to zakai_decide.go and the Python settlement reference. Banks and
// PSPs evaluate Go first; a settlement layer that only speaks TypeScript and
// Python is one a risk committee can dismiss as "vendor language."
//
// Canonicalisation is spelled out explicitly. Two implementations that
// serialise the same object differently compute different hashes and reject
// each other's valid chains. Verdict agreement from disagreeing hashes is
// agreement about nothing.
//
//	go run zakai_settle.go --url https://zakai-3uxj.vercel.app
//	go run zakai_settle.go --file settlement-vectors.json
//
// Exit 0 when every vector and every hash fixture passes, 1 otherwise.
package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	defaultOrigin = "https://zakai-3uxj.vercel.app"
	vectorsPath   = "/api/settlement/test-vectors"
)

// canonical serialises so two implementations produce identical bytes.
// Rules: object keys sorted by code unit; absent fields omitted; no
// insignificant whitespace; arrays keep order; integral floats emit as ints.
func canonical(value any) (string, error) {
	switch v := value.(type) {
	case nil:
		return "null", nil
	case bool:
		if v {
			return "true", nil
		}
		return "false", nil
	case json.Number:
		// Prefer integer form when the number is integral.
		if i, err := v.Int64(); err == nil {
			return strconv.FormatInt(i, 10), nil
		}
		f, err := v.Float64()
		if err != nil {
			return "", err
		}
		if f == float64(int64(f)) {
			return strconv.FormatInt(int64(f), 10), nil
		}
		b, err := json.Marshal(f)
		return string(b), err
	case float64:
		if v == float64(int64(v)) {
			return strconv.FormatInt(int64(v), 10), nil
		}
		b, err := json.Marshal(v)
		return string(b), err
	case int:
		return strconv.Itoa(v), nil
	case int64:
		return strconv.FormatInt(v, 10), nil
	case string:
		b, err := json.Marshal(v)
		return string(b), err
	case []any:
		parts := make([]string, len(v))
		for i, item := range v {
			s, err := canonical(item)
			if err != nil {
				return "", err
			}
			parts[i] = s
		}
		return "[" + strings.Join(parts, ",") + "]", nil
	case map[string]any:
		keys := make([]string, 0, len(v))
		for k := range v {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		parts := make([]string, 0, len(keys))
		for _, k := range keys {
			ks, err := json.Marshal(k)
			if err != nil {
				return "", err
			}
			vs, err := canonical(v[k])
			if err != nil {
				return "", err
			}
			parts = append(parts, string(ks)+":"+vs)
		}
		return "{" + strings.Join(parts, ",") + "}", nil
	default:
		return "", fmt.Errorf("cannot canonicalise %T", value)
	}
}

func hashRecord(record any) (string, error) {
	s, err := canonical(record)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256([]byte(s))
	return fmt.Sprintf("%x", sum), nil
}

type verdict struct {
	Verdict      string `json:"verdict"`
	Burden       string `json:"burden"`
	SettledMinor int64  `json:"settledMinor"`
}

func asMap(v any) map[string]any {
	m, _ := v.(map[string]any)
	return m
}

func asString(v any) string {
	s, _ := v.(string)
	return s
}

func asInt64(v any) (int64, bool) {
	switch n := v.(type) {
	case json.Number:
		i, err := n.Int64()
		return i, err == nil
	case float64:
		if n == float64(int64(n)) {
			return int64(n), true
		}
		return 0, false
	case int64:
		return n, true
	case int:
		return int64(n), true
	default:
		return 0, false
	}
}

func stringSlice(v any) []string {
	arr, ok := v.([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(arr))
	for _, item := range arr {
		if s, ok := item.(string); ok {
			out = append(out, s)
		}
	}
	return out
}

func containsString(hay []string, needle string) bool {
	for _, s := range hay {
		if s == needle {
			return true
		}
	}
	return false
}

func adjudicate(chain map[string]any, now int64) verdict {
	_ = now
	mandate := asMap(chain["mandate"])
	decision := asMap(chain["decision"])
	outcome := asMap(chain["outcome"])

	if outcome != nil && decision == nil {
		return verdict{Verdict: "unauthorized", Burden: "institution"}
	}
	if decision == nil {
		return verdict{Verdict: "indeterminate", Burden: "none"}
	}

	if asString(decision["mandateJti"]) != asString(mandate["jti"]) {
		return verdict{Verdict: "broken_chain", Burden: "institution"}
	}
	if asString(decision["prevHash"]) != asString(mandate["hash"]) {
		return verdict{Verdict: "broken_chain", Burden: "institution"}
	}

	if asString(decision["decision"]) == "deny" {
		if outcome != nil && asString(outcome["result"]) != "refused" {
			return verdict{Verdict: "unauthorized", Burden: "institution"}
		}
		return verdict{Verdict: "refused_with_reason", Burden: "none"}
	}

	at, atOk := asInt64(decision["at"])
	nbf, _ := asInt64(mandate["nbf"])
	exp, _ := asInt64(mandate["exp"])
	if !atOk || at < nbf || at >= exp {
		return verdict{Verdict: "outside_mandate_window", Burden: "institution"}
	}
	if !containsString(stringSlice(mandate["scopes"]), asString(decision["action"])) {
		return verdict{Verdict: "exceeded_scope", Burden: "institution"}
	}

	if outcome == nil {
		return verdict{Verdict: "authorized_not_performed", Burden: "institution"}
	}

	decHash, err := hashRecord(decision)
	if err != nil || asString(outcome["prevHash"]) != decHash {
		return verdict{Verdict: "broken_chain", Burden: "institution"}
	}
	if asString(outcome["action"]) != asString(decision["action"]) {
		return verdict{Verdict: "exceeded_scope", Burden: "institution"}
	}
	outAt, outOk := asInt64(outcome["at"])
	if !outOk || outAt < at {
		return verdict{Verdict: "broken_chain", Burden: "institution"}
	}
	if outAt >= exp {
		return verdict{Verdict: "outside_mandate_window", Burden: "institution"}
	}

	if asString(outcome["result"]) == "refused" {
		return verdict{Verdict: "refused_with_reason", Burden: "none"}
	}

	amountRaw := outcome["amountMinor"]
	if amountRaw == nil {
		amountRaw = float64(0)
	}
	amount, amountOk := asInt64(amountRaw)
	if !amountOk || amount < 0 {
		return verdict{Verdict: "indeterminate", Burden: "institution"}
	}

	return verdict{Verdict: "performed_as_authorized", Burden: "none", SettledMinor: amount}
}

type settleDoc struct {
	EvaluatedAtUnix int64 `json:"evaluated_at_unix"`
	Canonicalisation struct {
		Fixtures []struct {
			Record any    `json:"record"`
			SHA256 string `json:"sha256"`
		} `json:"fixtures"`
	} `json:"canonicalisation"`
	Vectors []struct {
		ID     string         `json:"id"`
		Pins   string         `json:"pins"`
		Chain  map[string]any `json:"chain"`
		Expect struct {
			Verdict      string `json:"verdict"`
			Burden       string `json:"burden"`
			SettledMinor int64  `json:"settledMinor"`
		} `json:"expect"`
	} `json:"vectors"`
}

func load(source string) (*settleDoc, error) {
	var r io.Reader
	if strings.HasPrefix(source, "http://") || strings.HasPrefix(source, "https://") {
		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Get(strings.TrimSuffix(source, "/") + vectorsPath)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		r = resp.Body
	} else {
		f, err := os.Open(source)
		if err != nil {
			return nil, err
		}
		defer f.Close()
		r = f
	}

	dec := json.NewDecoder(r)
	dec.UseNumber()
	doc := &settleDoc{}
	if err := dec.Decode(doc); err != nil {
		return nil, err
	}
	return doc, nil
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

	var hashFailures []string
	for _, fixture := range doc.Canonicalisation.Fixtures {
		got, err := hashRecord(fixture.Record)
		if err != nil {
			hashFailures = append(hashFailures, fmt.Sprintf("  canonical hash error: %v", err))
			continue
		}
		if got != fixture.SHA256 {
			hashFailures = append(hashFailures,
				fmt.Sprintf("  canonical hash mismatch\n    expected %s\n    got      %s", fixture.SHA256, got))
		}
	}
	if len(hashFailures) > 0 {
		fmt.Println("NOT CONFORMANT - canonicalisation differs:\n")
		fmt.Println(strings.Join(hashFailures, "\n"))
		os.Exit(1)
	}

	now := doc.EvaluatedAtUnix
	var failures []string
	for _, v := range doc.Vectors {
		expected := fmt.Sprintf("%s/%s/%d", v.Expect.Verdict, v.Expect.Burden, v.Expect.SettledMinor)
		gotObj := adjudicate(v.Chain, now)
		got := fmt.Sprintf("%s/%s/%d", gotObj.Verdict, gotObj.Burden, gotObj.SettledMinor)
		if got != expected {
			failures = append(failures,
				fmt.Sprintf("  %s: expected %s, got %s\n    pins: %s", v.ID, expected, got, v.Pins))
		}
	}

	total := len(doc.Vectors)
	if len(failures) > 0 {
		fmt.Printf("NOT CONFORMANT - %d of %d vectors failed:\n\n", len(failures), total)
		fmt.Println(strings.Join(failures, "\n"))
		os.Exit(1)
	}

	fmt.Printf("CONFORMANT - %d/%d vectors and %d hash fixtures passed.\n",
		total, total, len(doc.Canonicalisation.Fixtures))
}
