#!/usr/bin/env bash
# Runs the dev server over HTTPS on the LAN so a phone on the same Wi-Fi can
# use it, camera included (getUserMedia needs a secure context, which plain
# http over a LAN IP isn't). macOS only: relies on Bonjour (`<name>.local`)
# and `ipconfig`. See "Testing on a phone" in README.md.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "$(uname)" != "Darwin" ]]; then
  echo "dev:lan: macOS only (uses scutil/ipconfig to find the Bonjour name and LAN IP)." >&2
  exit 1
fi

HOST="$(scutil --get LocalHostName | tr '[:upper:]' '[:lower:]').local"
IP="$(ipconfig getifaddr en0 || true)"
if [[ -z "$IP" ]]; then
  echo "dev:lan: no IPv4 address on en0 — is Wi-Fi connected?" >&2
  exit 1
fi
PORT="${PORT:-3000}"

CERT_DIR=.certs
CA_KEY="$CERT_DIR/ca-key.pem"
CA_CERT="$CERT_DIR/hyllan-dev-ca.pem"
KEY="$CERT_DIR/key.pem"
CERT="$CERT_DIR/cert.pem"

# The leaf is reissued whenever it's missing, near expiry, or doesn't cover
# the current hostname/IP (e.g. a new DHCP lease). The CA is kept as long as
# it's valid, so a phone that already trusts it keeps working.
leaf_is_current() {
  [[ -f "$KEY" && -f "$CERT" && -f "$CA_CERT" ]] || return 1
  openssl x509 -in "$CERT" -noout -checkend 86400 >/dev/null || return 1
  local sans
  sans="$(openssl x509 -in "$CERT" -noout -text)"
  grep -qE "DNS:$HOST(,|$)" <<<"$sans" && grep -qE "IP Address:$IP(,|$)" <<<"$sans"
}

ca_is_current() {
  [[ -f "$CA_KEY" && -f "$CA_CERT" ]] &&
    openssl x509 -in "$CA_CERT" -noout -checkend 86400 >/dev/null
}

if ! leaf_is_current; then
  mkdir -p "$CERT_DIR"
  chmod 700 "$CERT_DIR"

  if ! ca_is_current; then
    echo "dev:lan: creating local CA in $CERT_DIR/"
    cat >"$CERT_DIR/ca.ext" <<EOF
[req]
distinguished_name = dn
x509_extensions = v3_ca
prompt = no
[dn]
CN = Hyllan Dev CA
[v3_ca]
basicConstraints = critical,CA:TRUE
keyUsage = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
EOF
    openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 825 \
      -keyout "$CA_KEY" -out "$CA_CERT" -config "$CERT_DIR/ca.ext" 2>/dev/null
    # Phones recognise .crt as an installable certificate.
    cp "$CA_CERT" "$CERT_DIR/hyllan-dev-ca.crt"
  fi

  echo "dev:lan: issuing certificate for $HOST, localhost, $IP, 127.0.0.1"
  cat >"$CERT_DIR/leaf.ext" <<EOF
basicConstraints = CA:FALSE
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = DNS:$HOST,DNS:localhost,IP:$IP,IP:127.0.0.1
EOF
  openssl req -newkey rsa:2048 -nodes -sha256 -subj "/CN=$HOST" \
    -keyout "$KEY" -out "$CERT_DIR/leaf.csr" 2>/dev/null
  # 397 days: iOS rejects TLS server certificates valid for longer.
  openssl x509 -req -sha256 -days 397 -in "$CERT_DIR/leaf.csr" \
    -CA "$CA_CERT" -CAkey "$CA_KEY" -CAcreateserial \
    -extfile "$CERT_DIR/leaf.ext" -out "$CERT" 2>/dev/null
  chmod 600 "$CA_KEY" "$KEY"
fi

cat <<EOF

  Open on your phone:  https://$HOST:$PORT
  CA to trust once:    $PWD/$CERT_DIR/hyllan-dev-ca.crt
  (see "Testing on a phone" in README.md)

EOF

# The browser bundle's auth origin must be reachable from the phone, so it's
# the LAN origin rather than .env's localhost. Server-side auth calls go
# straight to GoTrue instead of back through this self-signed HTTPS server
# (src/lib/supabase/internal-fetch.ts).
export NEXT_PUBLIC_SUPABASE_URL="https://$HOST:$PORT"
export GOTRUE_API_INTERNAL_URL="http://localhost:9999"

exec npx next dev --hostname 0.0.0.0 --port "$PORT" \
  --experimental-https \
  --experimental-https-key "$KEY" \
  --experimental-https-cert "$CERT"
