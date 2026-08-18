# MatrixVTT Setup Guide

This guide details local development and the supported runtime modes: widget mode via Element and standalone mode.

> Just want to run or join a game on a hosted instance? You do not need anything on this page. See [Running Your First Game](./guide/gm-quickstart.md).

## Local Development

```bash
npm install
npm run dev
```

Endpoints:
- `http://localhost:5173/`: Widget entrypoint
- `http://localhost:5173/app.html`: Standalone entrypoint

## Standalone Mode

Standalone mode is a static browser client interacting directly with Matrix Client-Server APIs. It lacks a custom backend and offline support.

Execution flow:
1. Access `app.html`.
2. Authenticate with a Matrix homeserver.
3. Select or create a room.
4. Initialize the VTT and share state with widget users in the room.

Operational characteristics:
- Authentication state persists locally across browser restarts, following the same client-side storage model as Element Web.
- Recent room metadata is cached locally.
- Signing out clears the stored credentials from the browser.

## Widget Mode

Widget mode executes within an iframe in a Matrix client (e.g., Element), utilizing Matrix widget APIs.

### Widget Registration

Step by step in Element:
1. Open the game room and confirm your account has moderator power level there (Room settings, Roles & Permissions).
2. Type the `/addwidget` command below into the message composer and send it.
3. Element shows the widget pinned in the room; each user approves the widget's permission prompt on first load.

Local testing (Element):
```text
/addwidget https://localhost:5173/matrixvtt/?matrix_user_id=$matrix_user_id&matrix_room_id=$matrix_room_id
```

Production deployment:
```text
/addwidget https://your-host.example/matrixvtt/?matrix_user_id=$matrix_user_id&matrix_room_id=$matrix_room_id
```

Configuration notes:
- The widget URL requires HTTPS.
- Both `matrix_room_id` and `matrix_user_id` parameters are mandatory for state resolution and CORS compliance.
- Explicit pathing (e.g., `/mvtt/index.html`) is required if the server rewrites the bare path.
- Room permissions govern widget addition.

## Matrix Requirements

MatrixVTT prerequisites:
- Reachable homeserver.
- Accessible room.
- Moderator or administrator privileges for state modification.

## Local Homeserver Configuration

Synapse deployment via Podman:

```bash
mkdir -p ~/matrix-synapse/data
podman run -it --rm \
  -v ~/matrix-synapse/data:/data \
  -e SYNAPSE_SERVER_NAME=localhost \
  -e SYNAPSE_REPORT_STATS=no \
  docker.io/matrixdotorg/synapse:latest generate
```

Enable registration in `homeserver.yaml`, then execute:

```bash
podman run -d \
  --name synapse \
  -p 8008:8008 \
  -v ~/matrix-synapse/data:/data \
  docker.io/matrixdotorg/synapse:latest
```

User provisioning:

```bash
podman exec -it synapse \
  register_new_matrix_user http://localhost:8008 -c /data/homeserver.yaml -a
```

## Element Configuration

Hosted Element:
- Enable widgets.
- Approve the custom widget prompt during initialization.

Self-hosted Element:
- Whitelist the widget host in the Element widget configuration.

## Troubleshooting

### User ID Resolution Failure
Append `?userId=$matrix_user_id` to the widget URL. Required for homeservers restricting OpenID discovery via CORS or policy.

### Standalone Authentication Persistence
Authentication persists across browser restarts until sign-out. Use Sign out (or Factory reset) to remove stored credentials from the browser. Room lists are retained locally.

### Session Initialization Failure
Session creation requires room-state write capabilities. Ensure the account possesses moderator or administrator privileges.

## Production Deployment

MatrixVTT compiles to static files for deployment (e.g., GitHub Pages). No application backend is required.

### Build Commands

```sh
npm ci                  # Clean dependency installation
npm run check           # Lint, type validation, testing
npm run build           # Compile static assets to dist/
npm run size            # Validate bundle size constraints
```

Reference `docs/RELEASE-CHECKLIST.md` for pre-launch validation and `docs/SECURITY-NOTES.md` for audit documentation.

### Runtime Requirements

- Node.js: >= 22.x.
- Browsers: Current Chromium, Firefox, WebKit. Legacy browsers lacking ES2022 module support are incompatible.

### Base Path Configuration

The default build targets `/matrixvtt/`. Override via environment variable:

```sh
VITE_BASE=/ npm run build              # Root domain
VITE_BASE=/myrepo/ npm run build       # Custom path
```

### Validation Procedures

Browser automation via Playwright is documented in `tests/smoke/static-build.test.js`.

Manual Matrix integration validation:
1. Initialize standalone mode (`app.html`) in two distinct browser engines.
2. Authenticate with separate identities.
3. Access a shared staging room.
4. Client 1: Modify state (e.g., token placement). Verify Client 2 synchronizes within one interval.
5. Client 2: Modify shared state. Verify Client 1 synchronizes without rate-limit queues.
