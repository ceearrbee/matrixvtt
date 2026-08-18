# Architecture

MatrixVTT operates as a static web application utilizing Matrix rooms as the backend data store.

## Runtime Modes

- **Widget Mode**: Initializes via `src/app.js`. Managed by `WidgetManager` to interface with host clients.
- **Standalone Mode**: Initializes via `src/app-client.js`. Managed by `ClientManager` to authenticate directly with Matrix CS APIs.

Both modes implement the Shared Bridge Contract to ensure compatibility across `StateManager`, `UIController`, and `ChatIntegrator`.

## Data Flow

`User Action -> UI Shell -> StateManager -> Matrix Event -> Homeserver -> Client Sync -> UI Refresh`

## State Management

- **Event Storage**: Campaign state persists entirely within Matrix room events.
- **Signals**: Domain state is managed via `@preact/signals`.
- **Side Effects**: Managed through signal `effect()` subscriptions.
- **Tombstoning**: Positional IDs (`tok-1`, etc.) limit state growth by overwriting prior state events.

## Module Boundaries

- `src/state/StateManager.js`: Coordinates domain state, event application, and sync rules.
- `src/ui/ui-methods.js` & `src/ui/App.jsx`: Compose the Preact UI shell and manage feature orchestration.
- `src/map-renderer.js`: Handles canvas rendering and token interaction.
- `src/engine/`: Provides the system-agnostic JSON-AST formula evaluator and rules engine.

## Trust Boundaries

- Matrix determines state persistence and access control (via Power Levels).
- Standalone authentication tokens persist in `localStorage` (the same trust model Element Web uses) so a login survives browser restarts; logout clears them. The tradeoff: any script running on the origin could read the token, which the strict CSP and zero third-party script policy exist to prevent.
- Map interactions are pointer-dependent; accessibility features are primarily implemented in the DOM shell.
