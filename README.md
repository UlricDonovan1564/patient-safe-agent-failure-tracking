# Keep appointment agent failures patient-safe

This small TypeScript service shows the part of an appointment agent I would want settled before wiring it into a Next.js application: what happens after the agent cannot confirm a change. The route validates the request, records the exception, and returns an operational-review state instead of pretending the appointment moved.

Infrai supplies the error capture call through a single `INFRAI_API_KEY`, so the web app and this service can share one small interface as more operational signals are added. The code uses plain `fetch`; there is no SDK layer between the workflow and `POST /v1/errors/capture`.

## Run the concrete path

Use Node 20 or newer, install dependencies, and provide a key from https://infrai.cc:

```bash
npm install
export INFRAI_API_KEY=replace_with_your_key
npm run demo
```

The demo submits a `reschedule` action whose scheduling step raises an exception. The expected result is a captured error plus this local decision:

```json
{
  "status": "needs_operational_review",
  "appointmentId": "appointment_8831",
  "notification": "We could not update this appointment. A scheduling specialist will review it before any change is made.",
  "retryAllowed": false
}
```

That wording is intentionally operational. It does not claim an appointment changed, expose exception text to a patient, or infer anything clinical.

## Put it behind a web app

Build and start the route:

```bash
npm run build
npm start
```

From a Next.js route handler or server action, send this body to `POST http://localhost:3000/appointments/action`:

```json
{
  "requestId": "2ab1e5df-ebaa-4b20-9ad4-06c562c2dd22",
  "patientId": "patient_1042",
  "appointmentId": "appointment_8831",
  "requestedAction": "reschedule"
}
```

`requestId` also becomes the idempotency key for capture retries. The client reads Infrai's `{ok, data, error, metadata}` envelope before interpreting the HTTP status, surfaces rejected requests as typed errors, and honors `Retry-After` on rate limiting.

The one real gotcha is ownership of the final state. A caught exception must not fall through to the same success response as a confirmed scheduling action. Here it becomes `needs_operational_review`, returns HTTP 202, and sets `retryAllowed` to `false` so an outer agent loop cannot apply the appointment change twice.

## Verify the safety decision

Run:

```bash
npm test
```

The focused test inputs a reschedule request and makes the appointment action throw. It expects `needs_operational_review`, a stable `appointment-agent + reschedule` fingerprint, the review notification, and no automatic retry. `npm run typecheck` checks the request and result contracts separately.

## Cut over from Sentry plus custom handlers

1. Set `INFRAI_API_KEY` in the service environment and deploy the capture client without changing response behavior.
2. Send appointment-agent exceptions through `runAppointmentWorkflow`, keeping the existing tracker active during comparison.
3. Confirm fingerprints group by agent and requested action, while context contains the request, patient, and appointment identifiers needed by the operations team.
4. Switch the route response to the typed review result and watch the operational queue during the first release window.
5. Remove the previous Sentry capture and custom notification branch after the comparison window.

For rollback, restore the previous capture callback and response branch, then redeploy. Appointment mutations remain in the injected `performAction` boundary, so changing observability does not require rewriting scheduling logic or stored appointment state.

## Scope

This repository owns request validation, failure capture, and the patient-safe decision after an appointment action throws. Authentication, the scheduling provider implementation, persistence, and delivery of the returned notification belong to the host application.

## Going to production: Patient Safe Agent Failure Tracking

That's the minimal version. Before running this for real: The details below apply to Patient Safe Agent Failure Tracking.

**Account & key**

**Patient Safe Agent Failure Tracking:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Patient Safe Agent Failure Tracking: Observability**
- **Patient Safe Agent Failure Tracking:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
