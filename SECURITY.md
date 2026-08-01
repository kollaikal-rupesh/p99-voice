# Security Policy

## Reporting a vulnerability

Please do not open public issues for security vulnerabilities.

Use GitHub's private vulnerability reporting: go to the repository's
**Security** tab → **Report a vulnerability**. We aim to respond within a
few business days.

## Scope notes

- The local runtime (`p99-runtime`) is a development server. It binds
  `127.0.0.1` by default and has no authentication — do not expose it to
  untrusted networks without TLS and auth in front.
- `@p99labs/voice` runs in the browser; treat any API key shipped to the
  browser as public.
