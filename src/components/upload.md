# Upload

`mu-upload` takes files from a person. Its contract is [catalog/upload.json](../../catalog/upload.json). A person picks files with the file picker or drops them on the control. The application binds the tool, the accepted types, the size limit and the file count. The control checks each file before a request. The application sends each file with its own transport and gives a receipt for each file.

```js
import { define } from './src/components/index.js';
import { deliverReceipt } from './src/actions/action.js';
define();
const upload = document.createElement('mu-upload');
upload.actor = { type: 'agent', id: 'agent-desk' };
upload.action = { tool: 'ticket.attach', arguments: { ticket_id: 'T-2041' }, label: 'Attach receipts to ticket T-2041',
  accept: ['application/pdf', '.pdf'], max_size: 2000000, max_files: 3 };
upload.fill = fill;
upload.addEventListener('mu-upload', (event) => deliverReceipt(upload, event.detail, () => sendToTheApi(event.detail)));
```

## Data

| Field | Content |
|---|---|
| `label` | Necessary. The name of the control, 1 to 80 code points. |
| `help` | Optional. A help text, 1 to 200 code points. |
| `accept` | Optional. The accepted types, 20 entries maximum. |
| `max_size` | Optional. The size limit of one file in bytes, from 1 to 1000000000. |
| `max_files` | Optional. The file count, from 1 to 20. |

A fill asks for an upload. It gives the label and the help text, and they show as text. A fill has no tool, no target and no address.

The label names the target of the upload, and a person cannot see the tool or the fixed arguments. Thus the application also gives the label in the binding, and the element refuses a fill with a different label. This is the same rule as the label of an action button. Thus a fill cannot show `Attach a photo` on a control that sends the files to a ticket. The help text is text of the author of the fill, and the control shows that author.

A fill cannot set a limit. The contract declares `accept`, `max_size` and `max_files`, so a fill can repeat the limits of the application. The element refuses a fill that gives a different value. The limits that a person reads always come from the binding.

## Binding

The application binds the upload with the `action` property, like a tool. The binding has these keys:

| Key | Content |
|---|---|
| `tool` | The tool name. |
| `arguments` | Optional. The fixed arguments, for example the ticket. A bound argument cannot have the name `name`, `size` or `type`. |
| `label` | The label of the control, 1 to 80 code points. It names the target. The element refuses a fill with a different label. |
| `accept` | 1 to 20 media types or file extensions in lower case, for example `application/pdf` and `.pdf`. |
| `max_size` | The size limit of one file in bytes, from 1 to 1000000000. |
| `max_files` | The file count, from 1 to 20. |

The element refuses a binding with a different key. With no binding, the state is `disabled`. The control shows `This upload is not available.` and takes no file. A new binding removes each file of the old binding.

## Checks before a request

The control checks each file when a person picks it or drops it. It uses only the name, the media type and the size that the browser gives. A file that fails a check does not go into the list, and no request has it. The status text gives the name of the file and the reason:

| Check | Reason |
|---|---|
| The list is full. | `Too many files. The limit is 3 files.` |
| The type is not accepted. | `This file type is not accepted. Accepted types: application/pdf, .pdf.` |
| The file is larger than the limit. | `This file is larger than the limit of 2 MB.` |
| The same file is in the list. | `This file is already in the list.` |

A file that is done stays in the list, so it counts for the file count. A new binding starts a new list.

A file agrees with the accepted types if its media type is in the list and its name ends with an extension of the list. Each of the two rules applies only if the list has an entry of that kind.

Caution: do these checks again in the API. The browser gives the media type from the name of the file, and a page can send any request. The control helps the person. The API decides.

## File content

The kit never reads the content of a file. It makes no preview, for a known type or for an unknown type, and it makes no object address for a file. The name of a file shows as text. A file name with markup makes no element.

The kit sends no data. The request has the `File` object, and only the code of the application reads it or sends it.

## Request and receipt

Each file shows its name, its size and its state. The Upload button sends one `mu-upload` event for each file that waits:

```js
{ id: '…', key: '…', tool: 'ticket.attach', arguments: { name: 'receipt-a.pdf', size: 613, type: 'application/pdf', ticket_id: 'T-2041' }, file }
```

The application sends the file, then gives the receipt to `upload.receipt()`. The receipt must have the key of the pending upload, the id of one of its tries, or both. If it has both, both must match. The value of `ok` must be `true` or `false`. If present, `message` and `reference` must be text, with 200 and 80 characters maximum. After the control accepts the receipt, it sends a `mu-receipt` event with the id of the last try, `name`, `size`, `ok`, `message` and `reference`.

| File state | Text | Condition |
|---|---|---|
| pending | `Pending` | The file is in the list, and no request has it. A person can remove it. |
| uploading | `Uploading` | The request waits for its receipt. A person cannot remove the file. |
| stalled | `Pending: No receipt came back.` | The time limit passed. The file has a Retry button and a Cancel button. |
| done | `Done` | A receipt with `ok` set to `true` came back. The reference of the receipt shows below. |
| not done | `Not done` | A receipt with `ok` set to `false` came back. The message of the receipt shows. A person can send the file again or remove it. |

`Done` shows only after a valid receipt with `ok: true`. For an invalid receipt, `receipt()` gives `false`. When no valid receipt comes back in `upload.patience` milliseconds, the file changes to `stalled`. The default is 30000 milliseconds. The upload still accepts a valid receipt while the file is stalled.

Retry sends only that file in a new `mu-upload` event. The id changes and the key stays the same. Send the key to the service as the idempotency key. Cancel returns the file to `Pending` and shows that the result of the upload is unknown. A person can remove the file or start a new upload with a new key. The control ignores each receipt of the canceled upload. Use the application's transport for each file. The offline queue refuses a request with a file.

In a thread, the application gives the binding with `bind`. The thread gives each request to `perform`, with the file, and gives the receipt to the control.

## Keyboard

The control has the role `group` and the name of its label. The file list has the name `Files`.

| Key | Result |
|---|---|
| Tab, Shift+Tab | Move between Choose files, the available buttons of each file and Upload. |
| Enter, Space | Open the file picker or use the selected button. |

The names of Remove, Retry and Cancel include the file name. After retry, the focus moves to Upload. After cancel, the focus moves to the Remove button of that file. After a person removes a file, the focus moves to the Remove button of the next file, or to Choose files. A polite status region tells the number of files in each state and each reason. Drag and drop is an addition for a pointer. The file picker does the same task with a keyboard.

## States

| State | Result |
|---|---|
| `default` | The control takes files. No request waits. |
| `disabled` | The control has no binding. It takes no file. |
| `pending` | One or more files wait for a receipt. |
| `done` | Each file of the list is done. |
| `error` | One or more files are not done. |
| `refused` | A status notice gives the reason as text. The element keeps no data. |

[examples/forms/upload.html](../../examples/forms/upload.html) attaches synthetic PDF receipts to a ticket. Its fixture API, `tools/upload_server.py`, decides each file again and keeps the files in memory only. [tests/browser/upload.js](../../tests/browser/upload.js) checks each state, each key and each refusal in the four media modes.
