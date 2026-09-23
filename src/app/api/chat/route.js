import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createZohoLead,
  getPipelineStatus,
  getBookingStatus,
  createServiceTicket,
  updateDealFollowUp,
} from "@/components/lib/zoho";
import { SYSTEM_PROMPT } from "@/components/lib/prompts";

// --- Tools ---

const createLead = tool(
  async ({ fullName, phone, email, preferredCity, vehicleModel }) => {
    try {
      const result = await createZohoLead({
        fullName,
        phone,
        email,
        preferredCity,
        vehicleModel,
      });
      return JSON.stringify(result);
    } catch (err) {
      return JSON.stringify({
        error:
          "Couldn't reach Zoho CRM right now. Let the customer know you'll follow up.",
      });
    }
  },
  {
    name: "create_lead",
    description:
      "Create a new Lead in Zoho CRM when an unidentified visitor asks about a vehicle and shares contact details.",
    schema: z.object({
      fullName: z.string(),
      phone: z.string(),
      email: z.string(),
      preferredCity: z.string(),
      vehicleModel: z.string(),
    }),
  },
);

const getPipeline = tool(
  async ({ phoneOrDealId }) => {
    try {
      const result = await getPipelineStatus({ phoneOrDealId });
      return JSON.stringify(result);
    } catch (err) {
      return JSON.stringify({
        error:
          "Couldn't reach Zoho CRM right now. Ask the customer to try again shortly.",
      });
    }
  },
  {
    name: "get_pipeline_status",
    description:
      "Look up an existing prospect's deal status by phone number or deal ID — test drive confirmation, quotation, dealer contact.",
    schema: z.object({ phoneOrDealId: z.string() }),
  },
);

const updatePipelineFollowUp = tool(
  async ({
    dealId,
    phoneOrDealId,
    preferredCallbackTime,
    preferredCallbackChannel,
    rescheduleRequest,
    notes,
  }) => {
    try {
      // The dealId from an earlier turn isn't kept in the history,
      // so look the deal up again from the phone/Booking ID if needed
      let id = dealId;
      if (!id && phoneOrDealId) {
        const lookup = await getPipelineStatus({ phoneOrDealId });
        id = lookup.data?.[0]?.dealId;
      }
      if (!id) {
        return JSON.stringify({
          error:
            "No matching deal found. Ask the customer to re-confirm their mobile number or Booking ID.",
        });
      }

      const result = await updateDealFollowUp({
        dealId: id,
        preferredCallbackTime,
        preferredCallbackChannel,
        rescheduleRequest,
        notes,
      });
      return JSON.stringify(result);
    } catch (err) {
      return JSON.stringify({
        error:
          "Couldn't update the CRM right now. Let the customer know the dealership will follow up.",
      });
    }
  },
  {
    name: "update_pipeline_followup",
    description:
      "Update an existing Deal's follow-up preferences (callback time, callback channel) and/or log a test-drive reschedule request. Pass dealId if known from get_pipeline_status; otherwise pass the customer's mobile number or Booking ID as phoneOrDealId. Send only the fields the customer provided.",
    schema: z.object({
      dealId: z
        .string()
        .optional()
        .describe("dealId from the get_pipeline_status result, if available"),
      phoneOrDealId: z
        .string()
        .optional()
        .describe(
          "Customer's mobile number or Booking ID, used if dealId is not available",
        ),
      preferredCallbackTime: z
        .string()
        .optional()
        .describe("When to call back, e.g. 'Weekdays after 6 PM'"),
      preferredCallbackChannel: z
        .enum(["Call", "WhatsApp", "Email"])
        .optional()
        .describe("How the customer wants to be contacted"),
      rescheduleRequest: z
        .string()
        .optional()
        .describe(
          "Requested new test-drive slot, e.g. 'Saturday 27 Sep, morning'",
        ),
      notes: z.string().optional().describe("Any other follow-up request"),
    }),
  },
);

const getBooking = tool(
  async ({ bookingId }) => {
    try {
      const result = await getBookingStatus({ bookingId });
      return JSON.stringify(result);
    } catch (err) {
      return JSON.stringify({
        error:
          "Couldn't reach Zoho CRM right now. Ask the customer to try again shortly.",
      });
    }
  },
  {
    name: "get_booking_status",
    description:
      "Validate a Booking ID or phone number and return delivery/VIN allocation stage for a booked vehicle.",
    schema: z.object({ bookingId: z.string() }),
  },
);

const createServiceTicketTool = tool(
  async ({ registrationNumber, odometerReading, issue, preferredCenter }) => {
    const result = await createServiceTicket({
      registrationNumber,
      odometerReading,
      issue,
      preferredCenter,
    });
    return JSON.stringify(result);
  },
  {
    name: "create_service_ticket",
    description:
      "Create a service/complaint ticket for an existing vehicle owner.",
    schema: z.object({
      registrationNumber: z.string(),
      odometerReading: z.number(),
      issue: z.string(),
      preferredCenter: z.string(),
    }),
  },
);

const tools = [
  createLead,
  getPipeline,
  updatePipelineFollowUp,
  getBooking,
  createServiceTicketTool,
];
const toolsByName = Object.fromEntries(tools.map((t) => [t.name, t]));

const model = new ChatGoogleGenerativeAI({
  model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
}).bindTools(tools);

export async function POST(req) {
  const { messages: history } = await req.json();

  let messages = [
    new SystemMessage(SYSTEM_PROMPT),
    ...history.map((m) =>
      m.role === "user"
        ? new HumanMessage(m.content)
        : new AIMessage(m.content),
    ),
  ];

  // Multi-step tool-calling loop, capped so a bad response can't spin forever
  for (let step = 0; step < 5; step++) {
    const response = await model.invoke(messages);
    messages.push(response);

    if (!response.tool_calls || response.tool_calls.length === 0) {
      return NextResponse.json({
        role: "assistant",
        content: response.content,
      });
    }

    for (const call of response.tool_calls) {
      const result = await toolsByName[call.name].invoke(call.args);
      messages.push(
        new ToolMessage({ tool_call_id: call.id, content: result }),
      );
    }
  }

  return NextResponse.json({
    role: "assistant",
    content: "Sorry, I'm having trouble completing that — could you try again?",
  });
}
