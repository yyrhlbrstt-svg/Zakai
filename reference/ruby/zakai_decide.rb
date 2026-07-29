#!/usr/bin/env ruby
# frozen_string_literal: true

# Zakai Mandate — reference decision implementation, Ruby, stdlib only.
#
# The decision layer performs no cryptography. Signature verification happens
# earlier, in whatever JWT library you already run, and by the time a claim set
# reaches this code its authenticity is settled. What remains is policy, and
# policy is comparisons on a hash.
#
# The ordering of the checks is normative and the vectors pin it. Two rules can
# often both fire, and which reason comes back is what integrators branch on.
# The forbidden-scope rule precedes every temporal check: an expired token
# bearing an outward-money scope still means somebody is issuing forbidden
# mandates, which is a registry-level incident rather than a stale credential,
# and reporting "expired" would hide it behind the lesser fault.
#
#   ruby zakai_decide.rb --file vectors.json
#   ruby zakai_decide.rb --url https://zakai-3uxj.vercel.app

require 'json'
require 'net/http'
require 'uri'

DEFAULT_ORIGIN = 'https://zakai-3uxj.vercel.app'
VECTORS_PATH = '/api/mandate/test-vectors'

# Scopes no mandate may ever carry, from any issuer. Money only ever flows
# toward the principal; an agent that cannot spend is a categorically different
# risk object from one that can, and that limit is what makes these acceptable
# to a regulated institution at all.
FORBIDDEN = %w[
  payment:initiate payment:transfer credit:borrow
  account:open account:close investment:trade
  treatment:consent treatment:refuse record:alter prescription:request directive:amend
  right:waive plea:enter claim:withdraw status:surrender appeal:abandon
  employment:resign termination:accept contract:sign grievance:withdraw
  tenancy:sign tenancy:surrender possession:concede deposit:forfeit
  enrolment:withdraw sanction:accept attainment:alter
].freeze

# Refused whatever domain claims it, prefixed or bare. A limit somebody can step
# around by adding a prefix is not a limit.
def forbidden?(scope)
  return true if FORBIDDEN.include?(scope)

  head, sep, bare = scope.partition('/')
  !sep.empty? && !head.empty? && FORBIDDEN.include?(bare)
end

# Whether each known scope needs the principal to confirm every individual
# exercise. Risk tier and this question are NOT the same: request:records is
# correspondence-tier and still standing, because asking somebody to confirm
# each request for their own records is friction with no safety behind it.
PER_ACT = {
  'read:accounts' => false, 'read:transactions' => false, 'read:credit' => false,
  'read:bills' => false, 'read:policies' => false, 'read:payroll' => false,
  'read:tax' => false, 'request:records' => false,
  'claim:submit' => true, 'claim:appeal' => true, 'dispute:charge' => true,
  'negotiate:tariff' => true, 'contract:cancel' => true,
  'contract:switch' => true, 'settle:receive' => true
}.freeze

# May this agent do this, now? Total by construction: every input yields a
# decision and none raises. A method a bank wraps in a rescue is one whose
# rescue block will eventually permit something.
def decide(claims, action, audience, now:, subject: nil, market: nil,
           revocation: 'unknown', act_confirmation: nil)
  # Structural mismatches first — "you sent this to the wrong institution" is
  # more useful to an integrator than "that scope is missing".
  return %w[deny audience_mismatch] unless claims['aud'] == audience
  return %w[deny subject_mismatch] if subject && !subject.empty? && claims['sub'] != subject

  cm = claims['market']
  return %w[deny market_mismatch] if market && !market.empty? && cm && !cm.empty? && cm != market

  scopes = claims['scopes'] || []

  # The categorical limit, before anything temporal.
  return %w[deny scope_forbidden] if forbidden?(action)
  return %w[deny scope_forbidden] if scopes.any? { |s| forbidden?(s) }

  exp = claims['exp']
  nbf = claims['nbf']
  # A missing expiry is malformed, never eternal: treating its absence as "no
  # expiry" turns a broken token into the strongest possible mandate arriving
  # through the weakest possible path.
  return %w[deny malformed_claims] unless exp.is_a?(Integer) && nbf.is_a?(Integer)
  return %w[deny not_yet_valid] if now < nbf
  return %w[deny expired] if now >= exp

  return %w[deny scope_unknown] unless PER_ACT.key?(action)
  return %w[deny scope_not_granted] unless scopes.include?(action)
  if PER_ACT[action] && (act_confirmation.nil? || act_confirmation.strip.empty?)
    return %w[deny act_confirmation_required]
  end

  return %w[deny revoked] if revocation == 'revoked'
  # Not a permit with a warning. An institution that cannot establish revocation
  # status has not established authority.
  return %w[deny revocation_unknown] unless revocation == 'active'

  ['permit', nil]
end

def load_vectors(source)
  return JSON.parse(File.read(source)) unless source.start_with?('http')

  uri = URI(source.sub(%r{/+$}, '') + VECTORS_PATH)
  JSON.parse(Net::HTTP.get(uri))
end

source = DEFAULT_ORIGIN
ARGV.each_with_index { |a, i| source = ARGV[i + 1] if %w[--url --file].include?(a) }

begin
  doc = load_vectors(source)
rescue StandardError => e
  warn "could not load vectors from #{source}: #{e.message}"
  exit 2
end

now = doc['evaluated_at_unix']
failures = []

doc['vectors'].each do |v|
  expect = v['expect']
  expected = expect['reason'] ? "#{expect['decision']}:#{expect['reason']}" : expect['decision']

  # Evaluated at the document's fixed instant, never the wall clock: a vector
  # checked against Time.now is a test that passes today and fails when
  # somebody actually runs it.
  got = begin
    d, r = decide(v['claims'], v['action'], v['audience'], now: now,
                                            subject: v['subject'], market: v['market'],
                                            revocation: v['revocation'] || 'unknown',
                                            act_confirmation: v['act_confirmation'])
    r ? "#{d}:#{r}" : d
  rescue StandardError => e
    "threw:#{e.message}"
  end

  failures << "  #{v['id']}: expected #{expected}, got #{got}\n    pins: #{v['pins']}" if got != expected
end

unless failures.empty?
  # No partial credit. One wrong answer in a trust network is one participant
  # honouring something nobody else does.
  puts "NOT CONFORMANT - #{failures.size} of #{doc['vectors'].size} vectors failed:\n\n"
  puts failures.join("\n")
  exit 1
end

puts "CONFORMANT - #{doc['vectors'].size}/#{doc['vectors'].size} vectors passed."
