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

// --- Tools ---

const createLead = tool(
  async ({ fullName, phone, email, preferredCity, vehicleModel }) => {
    // TODO: replace with your real Zoho REST call
    return JSON.stringify({
      status: "created",
      module: "Leads",
      fullName,
      vehicleModel,
    });
  },
  {
    name: "create_lead",
    description:
      "Create a new Lead in Zoho CRM when an unidentified visitor asks about a vehicle and shares contact details.",
    schema: z.object({
      fullName: z.string(),
    //   phone: z.string(),
    //   email: z.string(),
    //   preferredCity: z.string(),
      vehicleModel: z.string(),
    }),
  },
);

const tools = [createLead];
const toolsByName = Object.fromEntries(tools.map((t) => [t.name, t]));

const model = new ChatGoogleGenerativeAI({
  model: "gemini-3.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
}).bindTools(tools);

const SYSTEM_PROMPT = `You are ABC Motors' assistant. Handle four situations: new vehicle inquiries (use create_lead), pipeline/test-drive status checks (use get_pipeline_status), booking/delivery checks (use get_booking_status), and service requests from existing owners (use create_service_ticket). Be concise, professional, and use accurate automotive terminology.`;

export async function POST(req) {
  const { messages: history } = await req.json();


  console.log({history})

  let messages = [
  new SystemMessage(SYSTEM_PROMPT),
  ...history.map((m) =>
    m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
  ),
];



  // Multi-step tool-calling loop, capped so a bad response can't spin forever
  for (let step = 0; step < 5; step++) {
    const response = await model.invoke(messages);
    messages.push(response);

    if (!response.tool_calls || response.tool_calls.length === 0) {
      return NextResponse.json({ role: "assistant", content: response.content });
    }

    for (const call of response.tool_calls) {
      const result = await toolsByName[call.name].invoke(call.args);
      messages.push(new ToolMessage({ tool_call_id: call.id, content: result }));
    }
  }

  return NextResponse.json({
    role: "assistant",
    content: "Sorry, I'm having trouble completing that — could you try again?",
  });
}
