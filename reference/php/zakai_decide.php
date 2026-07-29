#!/usr/bin/env php
<?php
/**
 * Zakai Mandate — reference decision implementation, PHP, no dependencies.
 *
 * PHP is here because a great deal of the utility, telco and municipal billing
 * software that a consumer agent will actually be writing to is written in it,
 * and those are the counterparties least likely to accept a new Composer
 * package to evaluate an idea.
 *
 * The decision layer performs no cryptography. Signature verification happens
 * earlier, in whatever JWT library you already run; by the time a claim set
 * reaches this code its authenticity is settled, and what remains is policy.
 *
 * The ordering of the checks is normative and the vectors pin it. The
 * forbidden-scope rule precedes every temporal check: an expired token bearing
 * an outward-money scope still means somebody is issuing forbidden mandates,
 * which is a registry-level incident rather than a stale credential, and
 * reporting "expired" would hide it behind the lesser fault.
 *
 *   php zakai_decide.php --file vectors.json
 *   php zakai_decide.php --url https://zakai-3uxj.vercel.app
 */

declare(strict_types=1);

const DEFAULT_ORIGIN = 'https://zakai-3uxj.vercel.app';
const VECTORS_PATH = '/api/mandate/test-vectors';

/**
 * Scopes no mandate may ever carry, from any issuer. Money only ever flows
 * toward the principal; an agent that cannot spend is a categorically different
 * risk object from one that can, and that limit is what makes these acceptable
 * to a regulated institution at all.
 */
const FORBIDDEN = [
    'payment:initiate', 'payment:transfer', 'credit:borrow',
    'account:open', 'account:close', 'investment:trade',
    'treatment:consent', 'treatment:refuse', 'record:alter', 'prescription:request', 'directive:amend', 'right:waive', 'plea:enter', 'claim:withdraw', 'status:surrender', 'appeal:abandon', 'employment:resign', 'termination:accept', 'contract:sign', 'grievance:withdraw', 'tenancy:sign', 'tenancy:surrender', 'possession:concede', 'deposit:forfeit', 'enrolment:withdraw', 'sanction:accept', 'attainment:alter',
];

/**
 * Refused whatever domain claims it, prefixed or bare. A limit somebody can step
 * around by adding a prefix is not a limit.
 */
function isForbidden(string $scope): bool
{
    if (in_array($scope, FORBIDDEN, true)) return true;
    $i = strpos($scope, '/');
    return $i !== false && $i > 0 && in_array(substr($scope, $i + 1), FORBIDDEN, true);
}

/**
 * Whether each known scope needs the principal to confirm every individual
 * exercise. Risk tier and this question are NOT the same: request:records is
 * correspondence-tier and still standing, because asking somebody to confirm
 * each request for their own records is friction with no safety behind it.
 */
const PER_ACT = [
    'read:accounts' => false, 'read:transactions' => false, 'read:credit' => false,
    'read:bills' => false, 'read:policies' => false, 'read:payroll' => false,
    'read:tax' => false, 'request:records' => false,
    'claim:submit' => true, 'claim:appeal' => true, 'dispute:charge' => true,
    'negotiate:tariff' => true, 'contract:cancel' => true,
    'contract:switch' => true, 'settle:receive' => true,
];

/**
 * May this agent do this, now?
 *
 * Total by construction: every input yields a decision and none throws. A
 * function a bank wraps in a try/catch is one whose catch block will eventually
 * permit something.
 *
 * @return array{0:string,1:?string} decision, reason
 */
function decide(
    array $claims,
    string $action,
    string $audience,
    int $now,
    ?string $subject = null,
    ?string $market = null,
    string $revocation = 'unknown',
    ?string $actConfirmation = null
): array {
    // Structural mismatches first — "you sent this to the wrong institution" is
    // more useful to an integrator than "that scope is missing".
    if (($claims['aud'] ?? null) !== $audience) return ['deny', 'audience_mismatch'];
    if ($subject !== null && $subject !== '' && ($claims['sub'] ?? null) !== $subject) {
        return ['deny', 'subject_mismatch'];
    }
    $cm = $claims['market'] ?? null;
    if ($market !== null && $market !== '' && $cm !== null && $cm !== '' && $cm !== $market) {
        return ['deny', 'market_mismatch'];
    }

    $scopes = $claims['scopes'] ?? [];

    // The categorical limit, before anything temporal.
    if (isForbidden($action)) return ['deny', 'scope_forbidden'];
    foreach ($scopes as $s) {
        if (isForbidden($s)) return ['deny', 'scope_forbidden'];
    }

    $exp = $claims['exp'] ?? null;
    $nbf = $claims['nbf'] ?? null;
    // A missing expiry is malformed, never eternal: treating its absence as
    // "no expiry" turns a broken token into the strongest possible mandate
    // arriving through the weakest possible path.
    if (!is_int($exp) || !is_int($nbf)) return ['deny', 'malformed_claims'];
    if ($now < $nbf) return ['deny', 'not_yet_valid'];
    if ($now >= $exp) return ['deny', 'expired'];

    if (!array_key_exists($action, PER_ACT)) return ['deny', 'scope_unknown'];
    if (!in_array($action, $scopes, true)) return ['deny', 'scope_not_granted'];
    if (PER_ACT[$action] && trim((string) $actConfirmation) === '') {
        return ['deny', 'act_confirmation_required'];
    }

    if ($revocation === 'revoked') return ['deny', 'revoked'];
    // Not a permit with a warning. An institution that cannot establish
    // revocation status has not established authority.
    if ($revocation !== 'active') return ['deny', 'revocation_unknown'];

    return ['permit', null];
}

// ---------------------------------------------------------------------------

$source = DEFAULT_ORIGIN;
foreach ($argv as $i => $arg) {
    if (($arg === '--url' || $arg === '--file') && isset($argv[$i + 1])) $source = $argv[$i + 1];
}

$raw = str_starts_with($source, 'http')
    ? @file_get_contents(rtrim($source, '/') . VECTORS_PATH)
    : @file_get_contents($source);

if ($raw === false) {
    fwrite(STDERR, "could not load vectors from $source\n");
    exit(2);
}

$doc = json_decode($raw, true);
$now = (int) $doc['evaluated_at_unix'];
$failures = [];

foreach ($doc['vectors'] as $v) {
    $expect = $v['expect'];
    $expected = isset($expect['reason'])
        ? $expect['decision'] . ':' . $expect['reason']
        : $expect['decision'];

    // Evaluated at the document's fixed instant, never the wall clock: a vector
    // checked against time() is a test that passes today and fails when
    // somebody actually runs it.
    try {
        [$d, $r] = decide(
            $v['claims'], $v['action'], $v['audience'], $now,
            $v['subject'] ?? null, $v['market'] ?? null,
            $v['revocation'] ?? 'unknown', $v['act_confirmation'] ?? null
        );
        $got = $r !== null ? "$d:$r" : $d;
    } catch (Throwable $e) {
        $got = 'threw:' . $e->getMessage();
    }

    if ($got !== $expected) {
        $failures[] = "  {$v['id']}: expected $expected, got $got\n    pins: {$v['pins']}";
    }
}

$total = count($doc['vectors']);
if ($failures) {
    // No partial credit. One wrong answer in a trust network is one participant
    // honouring something nobody else does.
    printf("NOT CONFORMANT - %d of %d vectors failed:\n\n", count($failures), $total);
    echo implode("\n", $failures), "\n";
    exit(1);
}

printf("CONFORMANT - %d/%d vectors passed.\n", $total, $total);
