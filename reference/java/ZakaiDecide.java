/*
 * Zakai Mandate — reference decision implementation, Java, JDK only.
 *
 * Java because core banking is written in it, and because a single file that
 * runs with `java ZakaiDecide.java` — no Maven, no Gradle, no dependency to get
 * through review — is an evaluation somebody can finish in an afternoon rather
 * than a sprint.
 *
 * The decision layer performs no cryptography. Signature verification happens
 * earlier, in whatever JWT library the institution already runs, and by the
 * time a claim set reaches this code its authenticity is settled. What remains
 * is policy, and policy is comparisons on a map. The minimal JSON reader below
 * exists only so this file has no dependencies at all; in production you would
 * hand these values in from your own parser and delete it.
 *
 * The ordering of the checks is normative and the vectors pin it. Two rules can
 * often both fire, and which reason comes back is what integrators branch on.
 * The forbidden-scope rule precedes every temporal check: an expired token
 * bearing an outward-money scope still means somebody is issuing forbidden
 * mandates, which is a registry-level incident rather than a stale credential,
 * and reporting "expired" would hide it behind the lesser fault.
 *
 * Usage:
 *   java ZakaiDecide.java --file vectors.json
 *   java ZakaiDecide.java --url https://zakai-3uxj.vercel.app
 *
 * Exits 0 when every vector passes, 1 otherwise.
 */

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.*;

public class ZakaiDecide {

    static final String DEFAULT_ORIGIN = "https://zakai-3uxj.vercel.app";
    static final String VECTORS_PATH = "/api/mandate/test-vectors";

    /*
     * Scopes no mandate may ever carry, from any issuer. Money only ever flows
     * toward the principal; an agent that cannot spend is a categorically
     * different risk object from one that can, and that limit is what makes
     * these acceptable to a regulated institution at all.
     */
    static final Set<String> FORBIDDEN = Set.of(
            "payment:initiate", "payment:transfer", "credit:borrow",
            "account:open", "account:close", "investment:trade",
            "treatment:consent",
            "treatment:refuse",
            "record:alter",
            "prescription:request",
            "directive:amend",
            "right:waive",
            "plea:enter",
            "claim:withdraw",
            "status:surrender",
            "appeal:abandon",
            "employment:resign",
            "termination:accept",
            "contract:sign",
            "grievance:withdraw",
            "tenancy:sign",
            "tenancy:surrender",
            "possession:concede",
            "deposit:forfeit",
            "enrolment:withdraw",
            "sanction:accept",
            "attainment:alter");

    /**
     * Refused whatever domain claims it, prefixed or bare. A limit somebody can
     * step around by adding a prefix is not a limit.
     */
    static boolean isForbidden(String scope) {
        if (FORBIDDEN.contains(scope)) return true;
        int i = scope.indexOf('/');
        return i > 0 && FORBIDDEN.contains(scope.substring(i + 1));
    }

    /*
     * Whether each known scope needs the principal to confirm every individual
     * exercise. Risk tier and this question are NOT the same thing:
     * request:records is correspondence-tier and still standing, because asking
     * somebody to confirm each request for their own records is friction with
     * no safety behind it.
     */
    static final Map<String, Boolean> PER_ACT = Map.ofEntries(
            Map.entry("read:accounts", false),
            Map.entry("read:transactions", false),
            Map.entry("read:credit", false),
            Map.entry("read:bills", false),
            Map.entry("read:policies", false),
            Map.entry("read:payroll", false),
            Map.entry("read:tax", false),
            Map.entry("request:records", false),
            Map.entry("claim:submit", true),
            Map.entry("claim:appeal", true),
            Map.entry("dispute:charge", true),
            Map.entry("negotiate:tariff", true),
            Map.entry("contract:cancel", true),
            Map.entry("contract:switch", true),
            Map.entry("settle:receive", true));

    record Decision(String decision, String reason) {
        String key() { return reason == null ? decision : decision + ":" + reason; }
    }

    static Decision deny(String reason) { return new Decision("deny", reason); }

    /**
     * May this agent do this, now?
     *
     * Total by construction — every input yields a decision and none throws. A
     * method a bank wraps in a try/catch is one whose catch block will
     * eventually permit something.
     *
     * @param exp null when the claim is absent, which is malformed and never
     *            eternal: treating a missing expiry as "no expiry" turns a
     *            broken token into the strongest possible mandate arriving
     *            through the weakest possible path.
     */
    @SuppressWarnings("unchecked")
    static Decision decide(Map<String, Object> claims, String action, String audience,
                           long now, String subject, String market,
                           String revocation, String actConfirmation) {

        // Structural mismatches first. "You sent this to the wrong institution"
        // is more useful to an integrator than "that scope is missing".
        if (!Objects.equals(claims.get("aud"), audience)) return deny("audience_mismatch");
        if (subject != null && !subject.isEmpty() && !Objects.equals(claims.get("sub"), subject))
            return deny("subject_mismatch");
        String claimMarket = (String) claims.get("market");
        if (market != null && !market.isEmpty() && claimMarket != null && !claimMarket.isEmpty()
                && !claimMarket.equals(market)) return deny("market_mismatch");

        List<String> scopes = (List<String>) claims.getOrDefault("scopes", List.of());

        // The categorical limit, before anything temporal. See the file comment.
        if (isForbidden(action)) return deny("scope_forbidden");
        for (String s : scopes) if (isForbidden(s)) return deny("scope_forbidden");

        Object exp = claims.get("exp"), nbf = claims.get("nbf");
        if (!(exp instanceof Number) || !(nbf instanceof Number)) return deny("malformed_claims");
        if (now < ((Number) nbf).longValue()) return deny("not_yet_valid");
        if (now >= ((Number) exp).longValue()) return deny("expired");

        Boolean perAct = PER_ACT.get(action);
        if (perAct == null) return deny("scope_unknown");
        if (!scopes.contains(action)) return deny("scope_not_granted");
        if (perAct && (actConfirmation == null || actConfirmation.isBlank()))
            return deny("act_confirmation_required");

        if ("revoked".equals(revocation)) return deny("revoked");
        // Not a permit with a warning. An institution that cannot establish
        // revocation status has not established authority.
        if (!"active".equals(revocation)) return deny("revocation_unknown");

        return new Decision("permit", null);
    }

    // -----------------------------------------------------------------------
    // Conformance runner
    // -----------------------------------------------------------------------

    @SuppressWarnings("unchecked")
    public static void main(String[] args) throws Exception {
        String source = DEFAULT_ORIGIN;
        for (int i = 0; i < args.length - 1; i++)
            if (args[i].equals("--url") || args[i].equals("--file")) source = args[i + 1];

        String raw;
        try {
            raw = source.startsWith("http") ? fetch(source) : Files.readString(Path.of(source));
        } catch (IOException e) {
            System.err.println("could not load vectors from " + source + ": " + e.getMessage());
            System.exit(2);
            return;
        }

        Map<String, Object> doc = (Map<String, Object>) Json.parse(raw);
        long now = ((Number) doc.get("evaluated_at_unix")).longValue();
        List<Object> vectors = (List<Object>) doc.get("vectors");

        List<String> failures = new ArrayList<>();
        for (Object o : vectors) {
            Map<String, Object> v = (Map<String, Object>) o;
            Map<String, Object> expect = (Map<String, Object>) v.get("expect");
            String reason = (String) expect.get("reason");
            String expected = reason == null ? (String) expect.get("decision")
                    : expect.get("decision") + ":" + reason;

            String revocation = (String) v.getOrDefault("revocation", "unknown");
            String got;
            try {
                // Evaluated at the document's fixed instant, never the wall
                // clock: a vector checked against System.currentTimeMillis() is
                // a test that passes today and fails when somebody runs it.
                got = decide((Map<String, Object>) v.get("claims"),
                        (String) v.get("action"), (String) v.get("audience"), now,
                        (String) v.get("subject"), (String) v.get("market"),
                        revocation == null ? "unknown" : revocation,
                        (String) v.get("act_confirmation")).key();
            } catch (RuntimeException e) {
                // A throw is a failure, not a crash of the harness.
                got = "threw:" + e;
            }

            if (!got.equals(expected))
                failures.add("  " + v.get("id") + ": expected " + expected + ", got " + got
                        + "\n    pins: " + v.get("pins"));
        }

        if (!failures.isEmpty()) {
            // No partial credit. One wrong answer in a trust network is one
            // participant honouring something nobody else does.
            System.out.printf("NOT CONFORMANT - %d of %d vectors failed:%n%n",
                    failures.size(), vectors.size());
            failures.forEach(System.out::println);
            System.exit(1);
        }
        System.out.printf("CONFORMANT - %d/%d vectors passed.%n", vectors.size(), vectors.size());
    }

    static String fetch(String origin) throws Exception {
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();
        HttpRequest req = HttpRequest.newBuilder(
                URI.create(origin.replaceAll("/+$", "") + VECTORS_PATH)).GET().build();
        return client.send(req, HttpResponse.BodyHandlers.ofString()).body();
    }

    /**
     * A minimal JSON reader, present only so this file has no dependencies.
     * In production you already have Jackson or Gson — hand the parsed values
     * to decide() and delete this class.
     */
    static final class Json {
        private final String s; private int i;
        private Json(String s) { this.s = s; }
        static Object parse(String s) { Json p = new Json(s); p.ws(); return p.value(); }
        private void ws() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }
        private Object value() {
            char c = s.charAt(i);
            if (c == '{') return object();
            if (c == '[') return array();
            if (c == '"') return string();
            if (s.startsWith("true", i)) { i += 4; return Boolean.TRUE; }
            if (s.startsWith("false", i)) { i += 5; return Boolean.FALSE; }
            if (s.startsWith("null", i)) { i += 4; return null; }
            return number();
        }
        private Map<String, Object> object() {
            Map<String, Object> m = new LinkedHashMap<>(); i++; ws();
            if (s.charAt(i) == '}') { i++; return m; }
            while (true) {
                ws(); String k = string(); ws(); i++; ws();
                m.put(k, value()); ws();
                if (s.charAt(i) == ',') { i++; continue; }
                i++; return m;
            }
        }
        private List<Object> array() {
            List<Object> l = new ArrayList<>(); i++; ws();
            if (s.charAt(i) == ']') { i++; return l; }
            while (true) {
                ws(); l.add(value()); ws();
                if (s.charAt(i) == ',') { i++; continue; }
                i++; return l;
            }
        }
        private String string() {
            StringBuilder b = new StringBuilder(); i++;
            while (s.charAt(i) != '"') {
                char c = s.charAt(i++);
                if (c == '\\') {
                    char e = s.charAt(i++);
                    switch (e) {
                        case 'n' -> b.append('\n');
                        case 't' -> b.append('\t');
                        case 'r' -> b.append('\r');
                        case 'b' -> b.append('\b');
                        case 'f' -> b.append('\f');
                        case 'u' -> { b.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; }
                        default -> b.append(e);
                    }
                } else b.append(c);
            }
            i++; return b.toString();
        }
        private Number number() {
            int start = i;
            while (i < s.length() && "-+.eE0123456789".indexOf(s.charAt(i)) >= 0) i++;
            String n = s.substring(start, i);
            return n.contains(".") || n.contains("e") || n.contains("E")
                    ? Double.parseDouble(n) : Long.parseLong(n);
        }
    }
}
