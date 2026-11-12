# 0002: Agent UI protocols

Status: proposed, 2026-11-12. Issue: mohanraj00/mugham#6.

## Context

The v0.2 release adds the message envelope (mohanraj00/mugham#4) and the thread (mohanraj00/mugham#5). Before the envelope and the stream become stable, this record compares three open protocols for agent UI: A2UI, AG-UI and MCP Apps. For each protocol, the record decides one of these: adopt, map with an adapter, or no support.

The record compares four topics:

1. The envelope: the identity of a message, its actor and its parts.
2. The component declaration: who declares the components that an agent can fill.
3. The actions: who names the tool, and how the result comes back.
4. The stream: how a partial message and its end come to the kit.

The owner gave a direction in the issue. This record checks each fact of that direction against the specifications below.

## Specifications read

The record used these versions on 2026-11-12:

| Protocol | Version | Status | Source |
|---|---|---|---|
| AG-UI | Protocol 1.0. Package `@ag-ui/core` 1.0.4, in the release of 2026-11-05 | Stable | <https://docs.ag-ui.com/concepts/events>, <https://docs.ag-ui.com/sdk/js/core/events>, <https://github.com/ag-ui-protocol/ag-ui/releases> |
| A2UI | v1.0, last update 2026-06-08. The previous version is v0.9.1 | Current. v0.9.1 is closed | <https://a2ui.org/specification/v1.0-a2ui/>, <https://a2ui.org/specification/v0.9.1-a2ui/>, <https://github.com/a2ui-project/a2ui> |
| MCP Apps | `2026-01-26`, extension id `io.modelcontextprotocol/ui` (SEP-1865) | Stable | <https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx>, <https://modelcontextprotocol.io/extensions/apps> |

## The protocols

### AG-UI

AG-UI is a stream of typed events between an agent and a user interface. It does not define a transport. Each event has `type`, and optionally `timestamp`, `rawEvent` and `metadata`. The event types of 1.0 are in these groups:

- Run: `RUN_STARTED`, `RUN_FINISHED`, `RUN_ERROR`, `STEP_STARTED`, `STEP_FINISHED`.
- Text message: `TEXT_MESSAGE_START`, `TEXT_MESSAGE_CONTENT`, `TEXT_MESSAGE_END`, and `TEXT_MESSAGE_CHUNK`.
- Tool call: `TOOL_CALL_START`, `TOOL_CALL_ARGS`, `TOOL_CALL_END`, `TOOL_CALL_RESULT`, and `TOOL_CALL_CHUNK`.
- State: `STATE_SNAPSHOT`, `STATE_DELTA` (JSON Patch, RFC 6902), `MESSAGES_SNAPSHOT`.
- Activity: `ACTIVITY_SNAPSHOT`, `ACTIVITY_DELTA`.
- Reasoning: `REASONING_START`, `REASONING_MESSAGE_START`, `REASONING_MESSAGE_CONTENT`, `REASONING_MESSAGE_END`, `REASONING_MESSAGE_CHUNK`, `REASONING_END`, `REASONING_ENCRYPTED_VALUE`.
- Subagent: `SUBAGENT_STARTED`, `SUBAGENT_FINISHED`, `SUBAGENT_ERROR`.
- Special: `RAW`, `CUSTOM`.

A text message has a `messageId` and a `role`. The roles are `developer`, `system`, `assistant`, `user`, `tool`, `reasoning` and `activity`. A message has no actor id and no name. An activity message carries content for the interface only. AG-UI does not send it back to the agent. AG-UI defines no components. It refers to A2UI and MCP Apps through separate middleware packages.

### A2UI

A2UI sends declarative JSON for a surface. The messages from the agent in v1.0 are `createSurface`, `updateComponents`, `updateDataModel` and `deleteSurface`, and the function messages `callRendererFunction` and `agentFunctionResponse`. The components are a flat list with id references. A field binds to the data model with a JSON Pointer (RFC 6901).

The client declares the catalogs that it supports, with `supportedCatalogIds`. The agent must use only components from such a catalog. Thus the client controls the set of components.

An action goes from the client to the agent with `name`, `surfaceId`, `sourceComponentId`, `timestamp` and `context`. The agent writes the action name into its own component JSON. Thus the model selects the action name. The catalog does not limit it. A2UI has no receipt for an action. A2UI never sends executable code. A text value can contain simple Markdown. A2UI names AG-UI as its standard transport binding. A message has no actor id.

### MCP Apps

An MCP server declares a UI resource with a `ui://` URI and the MIME type `text/html;profile=mcp-app`. A tool links to the resource with `_meta.ui.resourceUri`. The content is an HTML document with script. The host must show it in a sandboxed iframe, on a different origin for a web host, with a content security policy from `_meta.ui.csp`. The app and the host talk with JSON-RPC over `postMessage`, for example `ui/initialize`, `ui/notifications/tool-input`, `ui/notifications/tool-result`, `ui/message` and `tools/call`. The version `2026-01-26` supports only HTML. Other content types are reserved for later extensions.

The MCP server declares the HTML before the tool call, as a template. The specification does not describe HTML from the model.

## Comparison

| Topic | Mugham fill (format 1) | AG-UI 1.0 | A2UI v1.0 | MCP Apps 2026-01-26 |
|---|---|---|---|---|
| Envelope and actor | Each message has an actor type and an actor id (principle 3) | `messageId` and `role`. No actor id | `surfaceId`. No actor id | No message envelope. A tool result and a resource |
| Component declaration | A contract file for each component. The kit refuses an undeclared component | None | A catalog that the client declares. The agent sends the component tree | None. The server sends HTML |
| Content type | Data that the contract accepts. Text shows as text | Text deltas and JSON | Declarative JSON. Text can have Markdown | HTML with script |
| Action | The application binds the tool name in code. A fill names no tool | Tool calls from the agent | The agent writes the action name | The app calls `tools/call`. The host can ask for consent |
| Receipt | Done only after the receipt of the API | `TOOL_CALL_RESULT` from the agent | None | `ui/notifications/tool-result` |
| Stream | None in format 1 | Start, content and end events for each message. Run events | Ordered messages for each surface | Partial tool input only |

## Facts of the owner direction

1. **The native format is the mugham fill (format 1).** Confirmed. No protocol has a contract for each component with a refusal of an undeclared component. Principle 1 needs that contract.
2. **The thread stream uses the AG-UI event shapes, if they fit.** Confirmed. The start, content and end events give the partial state of principle 6. AG-UI has no actor id, so the envelope adds one. The section "Stream events" gives the exact types.
3. **A2UI goes through an adapter, because the application binds the tool and a model cannot select it.** Confirmed. In A2UI the agent writes the action name, and A2UI has no receipt.
4. **MCP Apps has no support, because it sends an HTML resource and a model never sends markup.** The decision is confirmed, but the reason needs a correction. The MCP server sends the HTML as a declared template. The model does not write it. The correct reasons are these:
   - The content is HTML with script. Principle 1 accepts only declared components with data that a contract accepts. A UI resource has no contract.
   - Principle 5 keeps content as data and never puts it into markup or script. To show an MCP App, the kit must run third-party script.
   - The host of an MCP App must run a sandbox proxy on a different origin and must enforce a content security policy. That is the job of an application host, not of a UI kit. Mugham has no host shell.
   - Source: the sections "UI Resource Format", "Predeclared Resources vs. Inline Embedding" and "Iframe Sandboxing" of <https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx>.

## Decision

| Protocol | Decision | Reason |
|---|---|---|
| Mugham fill | Native format | Principles 1, 4 and 5 need a contract for each component, a bound tool and a receipt |
| AG-UI 1.0 | Adopt the event shapes for the thread stream | The events fit the partial and final states. AG-UI is transport neutral and has no component model to conflict with the catalog |
| A2UI v1.0 | Map with an adapter | The client catalog is similar to the mugham catalog. But the model selects the action name, and A2UI has no receipt |
| MCP Apps 2026-01-26 | No support | The content is HTML with script, with no contract. The kit never runs it (principles 1 and 5) |

An application that needs MCP Apps can show the app in its own sandboxed host, outside the thread. Mugham does not help with that host.

### Stream events

The thread stream accepts only these AG-UI 1.0 event types in v0.2. Each event has the field names of AG-UI 1.0.

| Event type | Fields that the kit reads | Effect in the thread |
|---|---|---|
| `RUN_STARTED` | `threadId`, `runId` | Starts a run. The kit shows the run as active |
| `RUN_FINISHED` | `threadId`, `runId` | Ends the run. Each message that has no `TEXT_MESSAGE_END` stays partial |
| `RUN_ERROR` | `message`, `code` | Ends the run with an error. Each open message stays partial and shows the error as text |
| `TEXT_MESSAGE_START` | `messageId`, `role`, `metadata.mugham.actor` | Opens a message. The kit marks it as partial |
| `TEXT_MESSAGE_CONTENT` | `messageId`, `delta` | Adds the delta to the message as text |
| `TEXT_MESSAGE_END` | `messageId` | Marks the message as final |
| `ACTIVITY_SNAPSHOT` | `messageId`, `activityType`, `content`, `replace`, `metadata.mugham.actor` | If `activityType` is `mugham.fill`, the content is a fill. The kit validates the full fill, then shows the component or the refusal |

The thread ignores each other event type in v0.2 and does not change a state. These types are for a later decision:

- `TEXT_MESSAGE_CHUNK` and `TOOL_CALL_CHUNK`. The SDK enum of `@ag-ui/core` 1.0.4 does not list them.
- `TOOL_CALL_START`, `TOOL_CALL_ARGS`, `TOOL_CALL_END`, `TOOL_CALL_RESULT`. These are tool calls of the agent, not mugham actions.
- `ACTIVITY_DELTA`. A patch can make a fill that the contract does not accept. The kit validates only a full fill.
- `STATE_SNAPSHOT`, `STATE_DELTA`, `MESSAGES_SNAPSHOT`, `STEP_STARTED`, `STEP_FINISHED`, the reasoning events, the subagent events, `RAW` and `CUSTOM`.

### The actor

AG-UI has no actor id, and the role `user` does not tell one person from a different person. Thus each event that opens a message carries the actor in `metadata.mugham.actor`, with an actor type and an actor id. The `metadata` field is part of the AG-UI base event, so the event stays valid AG-UI.

The application sets the actor. The kit never takes the actor from the AG-UI `role`. If an event has no actor, the kit refuses the message and shows the refusal. An adapter for a plain AG-UI agent adds the actor of that agent, from the configuration of the application.

### Actions and receipts

A mugham action does not go through the AG-UI stream. The kit sends the action to the API of the application, and the response of that API is the receipt. A `TOOL_CALL_RESULT` event is never a receipt. The AG-UI interrupt outcome of `RUN_FINISHED` is not used in v0.2. An approval from a person is a mugham action with a receipt.

### The A2UI adapter

The adapter is a later issue. It maps an A2UI surface to fills:

- The application gives a map from each A2UI component type to a contract in the catalog. The adapter refuses each component type that the map does not have.
- The adapter resolves each JSON Pointer binding before it makes the fill. The fill contains only data.
- The application gives a map from each A2UI action name to an action binding of the application. The adapter refuses each action name that the map does not have. Thus the model cannot select a tool.
- The adapter shows Markdown in a text value as plain text.
- The adapter is plain JavaScript in the kit, with no dependency, as principle 2 says.

## Changes to the envelope contract (mohanraj00/mugham#4)

1. Each message has `actor` with an actor type (`human`, `agent` or `system`) and an actor id. In the stream, the actor is in `metadata.mugham.actor` of `TEXT_MESSAGE_START` and `ACTIVITY_SNAPSHOT`. A message with no actor is refused.
2. The message id of the envelope is the AG-UI `messageId`. The thread id is `threadId`, and the run id is `runId`.
3. The stream is the list of AG-UI 1.0 event types in the section "Stream events". The events keep the AG-UI field names. The kit ignores other event types.
4. A component part is an `ACTIVITY_SNAPSHOT` with `activityType` equal to `mugham.fill`. Its `content` has `format` (the fill format number) and `fill`. The kit validates each full snapshot. `ACTIVITY_DELTA` is not accepted.
5. The end marker of a message is `TEXT_MESSAGE_END`. The end of a run is `RUN_FINISHED` or `RUN_ERROR`. A message with no end marker stays partial and never shows as final.
6. The order of the parts is the order of the events. The transport must keep the order. The kit defines no transport.
7. A text delta is text. The kit never reads it as Markdown or markup.
8. The envelope schema names the AG-UI version that it maps: 1.0.

## Changes to format 1 (mohanraj00/mugham#35)

1. The application binding keeps the tool name. A fill names no tool and no action. Do not move a tool name into a fill, because the A2UI adapter depends on this rule. Format 2 removes the `actions` block of a contract and the `actions` list of a fill, because they had no effect.
2. The receipt is the response of the application API. It is not an AG-UI `TOOL_CALL_RESULT`. The reference in the receipt shows as text, as #35 says.
3. The confirm step is in the application binding, not in a fill. A2UI has no confirm step, so the adapter cannot remove one.
4. The fill gets no surface id and no message id. The envelope holds these ids.
5. If #35 removes a part of format 1, the format number changes. The envelope part names the format number, as item 4 of the envelope list says.
