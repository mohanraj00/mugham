# Security boundary

Mugham has no source code yet. The planned boundaries are these:

- The renderer. Model output, tool output and document text are untrusted. They show as text and never go into markup, style or script.
- The action path. An action goes to the API of the application. That API checks the user and decides.
- The offline queue. It keeps pending actions on the device until the device reconnects.

Mugham does no sign-in and no access control. The application owns them.

Use neutral data when you report a problem. For a possible vulnerability, use GitHub private vulnerability reporting. Do not post sensitive payloads or exploit details in a public issue. No response time is promised.
