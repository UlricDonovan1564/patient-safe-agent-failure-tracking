import assert from "node:assert/strict";
import test from "node:test";
import { runAppointmentWorkflow, type AppointmentRequest } from "../src/appointment_workflow.js";

test("holds the appointment for review after an agent failure", async () => {
  const input: AppointmentRequest = {
    requestId: "2ab1e5df-ebaa-4b20-9ad4-06c562c2dd22",
    patientId: "patient_1042",
    appointmentId: "appointment_8831",
    requestedAction: "reschedule",
  };
  let capturedFingerprint: string[] | undefined;

  const result = await runAppointmentWorkflow(
    input,
    async () => {
      throw new Error("No confirmed time slot");
    },
    async (exception) => {
      capturedFingerprint = exception.fingerprint;
      return { error_group_id: "group_1" };
    },
  );

  assert.equal(result.status, "needs_operational_review");
  assert.deepEqual(capturedFingerprint, ["appointment-agent", "reschedule"]);
  if (result.status === "needs_operational_review") {
    assert.equal(result.retryAllowed, false);
    assert.match(result.notification, /scheduling specialist will review/);
  }
});
