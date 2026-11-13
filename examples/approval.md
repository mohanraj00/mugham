# Approval example

The page [approval.html](approval.html) lists the open decisions as cards. Each card shows the evidence of its decision. A person approves or rejects a decision with an action button.

## Run the example

1. Start the fixture API from the root of the repository:

   ```sh
   python3 -B tools/approval_server.py
   ```

2. Open `http://127.0.0.1:8766/examples/approval.html`.

The fixture API uses the Python standard library only. It serves synthetic decisions and the files of the kit.

## The action path

1. The page binds the tool `approval.approve` or `approval.reject` and the argument `decision_id` to each button.
2. A click sends the request to `POST /api/actions`. The button shows `Pending`.
3. The API decides and gives a receipt. The button shows `Done` only after a receipt with `ok` set to `true` comes back.
4. A receipt with `ok` set to `false` shows as an error with the message of the API. A second action on a decision gets this refusal.
5. The page reads the decision again from `GET /api/decisions/<id>`, and the card shows the new status.

The page keeps no approval state of its own. The fixture API owns the state of each decision.

## Use a real service

A real workflow service can take the place of the fixture API through its own HTTP API. The service owns its decisions, its users and its sign-in. To connect a service, change the `call` function in [approval.js](approval.js) to the paths of that API. Each receipt must have the `id` of its request, `ok`, and an optional `message` and `reference`.
