import { appointmentRequestSchema, runAppointmentWorkflow } from "./appointment_workflow.js";

const request = appointmentRequestSchema.parse({
  requestId: crypto.randomUUID(),
  patientId: "patient_1042",
  appointmentId: "appointment_8831",
  requestedAction: "reschedule",
});

const result = await runAppointmentWorkflow(request, async () => {
  throw new Error("Scheduling agent produced no confirmed time slot");
});

console.log(JSON.stringify(result, null, 2));
