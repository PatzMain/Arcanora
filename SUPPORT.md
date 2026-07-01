# Support

## Where to Get Help

### 📖 Read the Docs First

- **[README.md](./README.md)** — Project overview, setup, and script reference
- **[TEMPLATE.md](./TEMPLATE.md)** — Full deployment guide (local + Railway, with or without a database)
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — Architecture walkthrough and development conventions

---

## I Found a Bug

1. Check the [existing issues](https://github.com/PatzMain/Arcanora/issues) to see if it has already been reported
2. If not, [open a new issue](https://github.com/PatzMain/Arcanora/issues/new?template=bug_report.md) using the bug report template
3. Include steps to reproduce, expected behavior, and any relevant logs or screenshots

---

## I Have a Feature Request

Open a [GitHub Discussion](https://github.com/PatzMain/Arcanora/discussions) or [submit a feature request issue](https://github.com/PatzMain/Arcanora/issues/new?template=feature_request.md). Describe:

- What the feature does
- Why it belongs in an MMORPG bot
- How it fits with the existing game loop (explore → fight → craft → progress)

---

## I Found a Security Issue

**Do not open a public issue.**

Follow the steps in [SECURITY.md](./SECURITY.md) to report it privately.

---

## Common Setup Issues

### Bot not responding to slash commands

- Ensure the bot has been invited with the `applications.commands` OAuth2 scope
- Make sure `DISCORD_TOKEN` and `DISCORD_CLIENT_ID` are correctly set in your `.env`
- Check the bot logs — commands are registered per guild on startup; look for the success count log line

### Database connection errors

- Verify `DATABASE_URL` is a valid PostgreSQL connection string
- Run `npm run migrate` to ensure all migrations have been applied
- Check that your database is reachable from your host environment

### Commands not updating after changes

- Restart the bot — commands are re-registered on every startup
- Per-guild registration is instant; there is no propagation delay

### TypeScript or lint errors

```bash
npm run lint       # Check for lint errors
node node_modules/typescript/bin/tsc --noEmit  # Type-check without building
npm test           # Full pipeline: lint → tsc → vitest
```

---

## Community

For real-time support, join the community Discord server or open a [GitHub Discussion](https://github.com/PatzMain/Arcanora/discussions).
