# Shared Bridge Contract

MatrixVTT abstracts Matrix communication through a unified bridge contract. This interface is implemented by `WidgetManager` for Widget Mode and `ClientManager` for Standalone Mode.

## Interface

The `widgetManager` instance exposes the following properties and methods to the UI and State layers.

### Properties

| Property | Type | Description |
| :--- | :--- | :--- |
| `userId` | `string` | Matrix user ID. |
| `roomId` | `string` | Matrix room ID. |
| `userIdResolved` | `boolean` | Verification status of user identity. |
| `isAppClient` | `boolean` | `true` for Standalone Mode; `false` for Widget Mode. |
| `accessToken` | `string \| null` | Matrix access token (Standalone Mode). |
| `homeserver` | `string \| null` | Matrix homeserver URL (Standalone Mode). |
| `rateLimitedUntil` | `number` | Epoch ms until API requests resume. |
| `lastRetryAfterMs` | `number \| null` | Delay specified by the last 429 HTTP response. |

### Methods

- `init(): Promise<void>`: Initializes the bridge.
- `getApi(): object`: Returns the state event subscription adapter (`WidgetApi` or `MatrixApiAdapter`).
- `sendStateEvent(type, stateKey, content): Promise<object>`: Dispatches a Matrix state event.
- `sendRoomEvent(type, content): Promise<object>`: Dispatches a Matrix timeline event.
- `canEditRoomState(): Promise<boolean>`: Validates Power Level (>= 50) for state modification.
- `getUserPowerLevel(): Promise<number>`: Retrieves the user's Power Level.
- `getRoomMembers(): Promise<Array<{userId, displayname}>>`: Retrieves joined members.
- `setDisplayName(name): Promise<void>`: Updates the user's display name.
- `uploadMedia(file): Promise<string>`: Uploads a file to the Matrix media repository, returning the `mxc://` URI.
- `destroy(): void`: Terminates bridge connections and removes listeners.

## Implementations

- **WidgetManager**: Proxies Matrix Widget API requests to the host client.
- **ClientManager**: Directly interfaces with the Matrix CS API and implements `/sync` loop pagination.
