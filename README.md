<img width="3840" height="1977" alt="image" src="https://github.com/user-attachments/assets/fb2e07b7-cc17-40e4-9969-ffaa63ff1224" />


# MatrixVTT

MatrixVTT is a virtual tabletop application utilizing Matrix room state for real-time multiplayer synchronization and persistent campaign storage.

## Architecture & Deployment

The application operates as a dual-mode static web client:
- **Widget Mode (`index.html`)**: Executes within a compatible Matrix client (e.g., Element) using Matrix Widget APIs.
- **Standalone Mode (`app.html`)**: Operates directly in the browser, authenticating against Matrix Client-Server APIs.

Both modes read and write the identical Matrix event model. The Matrix room serves as the authoritative backend.

## Features

- **Matrix Sync**: Real-time state and timeline event synchronization.
- **Rules Engine**: System-agnostic JSON ruleset processing.
- **Map & Tactical**: Shared canvas supporting tokens, fog of war, and initiative.
- **State Bounding**: Positional entity ID reuse (`tok-1`, etc.) to mitigate state bloat.

## Development

```bash
npm install
npm run dev
npm test
```

### Git Hooks

Husky manages two hooks:
- **pre-commit**: Executes `lint-staged`, type checks, and static analysis.
- **pre-push**: Executes the complete test suite.

### Production Build

```bash
npm run build
```

## Documentation

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Bridge Contract: [docs/BRIDGE-CONTRACT.md](docs/BRIDGE-CONTRACT.md)
- Matrix Integration: [docs/MATRIX-INTEGRATION.md](docs/MATRIX-INTEGRATION.md)

## License

GNU Affero General Public License v3.0 (AGPL-3.0-only). See [LICENSE](LICENSE).
