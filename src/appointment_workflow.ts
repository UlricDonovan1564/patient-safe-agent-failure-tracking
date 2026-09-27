import { z } from "zod";
import { infrai } from "./infrai_errors.js";

export const appointmentRequestSchema = z.object({
  requestId: z.string().uuid(),
  patientId: z.string().min(1),
  appointmentId: z.string().min(1),
  requestedAction: z.enum(["confirm", "reschedule", "cancel"]),
});

export type AppointmentRequest = z.infer<typeof appointmentRequestSchema>;

export type WorkflowResult =
  | { status: "completed"; appointmentId: string }
  | {
      status: "needs_operational_review";
      appointmentId: string;
      notification: string;
      retryAllowed: false;
    };

export type AppointmentAction = (request: AppointmentRequest) => Promise<void>;

function exceptionText(error: unknown): string {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`;
  return String(error);
}

export async function runAppointmentWorkflow(
  request: AppointmentRequest,
  performAction: AppointmentAction,
  captureFailure: typeof infrai.errors.capture = infrai.errors.capture,
): Promise<WorkflowResult> {
  try {
    await performAction(request);
    return { status: "completed", appointmentId: request.appointmentId };
  } catch (error) {
    await captureFailure(
      {
        title: `appointment-agent/${request.requestedAction} failed`,
        message: error instanceof Error ? error.message : "Appointment action failed",
        level: "error",
        fingerprint: ["appointment-agent", request.requestedAction],
        exception: exceptionText(error),
        context: {
          requestId: request.requestId,
          patientId: request.patientId,
          appointmentId: request.appointmentId,
          requestedAction: request.requestedAction,
        },
      },
      request.requestId,
    );

    return {
      status: "needs_operational_review",
      appointmentId: request.appointmentId,
      notification: "We could not update this appointment. A scheduling specialist will review it before any change is made.",
      retryAllowed: false,
    };
  }
}
