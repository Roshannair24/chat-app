import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { NextResponse } from "next/server";
import { z } from "zod";





// --- Tools ---

const createLead = tool(
  async ({ fullName, phone, email, preferredCity, vehicleModel }) => {
    // TODO: replace with your real Zoho REST call
    return JSON.stringify({ status: "created", module: "Leads", fullName, vehicleModel });
  },
  {
    name: "create_lead",
    description: "Create a new Lead in Zoho CRM when an unidentified visitor asks about a vehicle and shares contact details.",
    schema: z.object({
      fullName: z.string(),
      phone: z.string(),
      email: z.string(),
      preferredCity: z.string(),
      vehicleModel: z.string(),
    }),
  }
);



export async function POST(req) {


     return NextResponse.json({ role: "assistant", content: "Sorry, I'm having trouble completing that — could you try again?" });
}