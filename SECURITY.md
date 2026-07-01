# Security Policy

## Supported Versions

Only the latest release on the `main` branch is actively maintained and receives security updates.

| Branch | Supported |
|--------|-----------|
| `main` (latest) | ✅ Yes |
| Older commits | ❌ No |

---

## Reporting a Vulnerability

If you discover a security vulnerability in Arcanora, **please do not open a public GitHub issue.**

Instead, report it privately so it can be assessed and patched before any public disclosure.

### How to Report

1. **Open a GitHub Security Advisory** via the [Security tab](https://github.com/PatzMain/Arcanora/security/advisories/new) in this repository
2. Alternatively, contact the maintainer directly through Discord

### What to Include

Please provide as much detail as possible:

- A clear description of the vulnerability
- Steps to reproduce the issue
- The potential impact (e.g., data exposure, privilege escalation, economy exploit)
- Any suggested mitigations or fixes if you have them

---

## Scope

The following are considered in-scope security issues:

- **Token exposure** — bot token or database credentials leaked in logs, error messages, or responses
- **Privilege escalation** — a player executing admin commands without `Administrator` permission
- **Data manipulation** — bypassing game logic to modify gold, level, inventory, or quest state illegitimately
- **Player data exposure** — accessing another player's private data through the bot
- **Cross-player interaction abuse** — hijacking another player's buttons or select menus (component ownership bypass)

The following are **out of scope**:

- Theoretical attacks with no practical exploit path
- Issues in third-party dependencies (report those upstream)
- Discord's own platform vulnerabilities

---

## Response Timeline

| Stage | Target Time |
|---|---|
| Acknowledgement | Within 48 hours |
| Initial assessment | Within 5 business days |
| Patch release | Depends on severity |

We appreciate responsible disclosure and will credit reporters in the fix commit unless anonymity is requested.
