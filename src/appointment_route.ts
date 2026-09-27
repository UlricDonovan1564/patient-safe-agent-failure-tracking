import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import {
  appointmentRequestSchema,
  runAppointmentWorkflow,
  type AppointmentAction,
} from "./appointment_workflow.js";
import { InfraiError } from "./infrai_errors.js";

const performAppointmentAction: AppointmentAction = async () => {
  return;
};

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Buffer | string>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/appointments/action") {
    sendJson(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const input = appointmentRequestSchema.parse(await readJson(request));
    const result = await runAppointmentWorkflow(input, performAppointmentAction);
    sendJson(response, result.status === "completed" ? 200 : 202, result);
  } catch (error) {
    if (error instanceof ZodError) {
      sendJson(response, 400, { error: "Invalid appointment request", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      sendJson(response, error.status >= 400 && error.status < 500 ? error.status : 503, {
        error: error.code,
      });
      return;
    }
    sendJson(response, 500, { error: "Request could not be processed" });
  }
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => console.log(`Appointment route listening on http://localhost:${port}`));
}
