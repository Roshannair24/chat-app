let cachedToken = null;
let tokenExpiresAt = 0;
let apiDomain = null;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return { token: cachedToken, domain: apiDomain };
  }

  const accountsDomain =
    process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.com";
  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token",
  });

  const res = await fetch(`${accountsDomain}/oauth/v2/token?${params}`, {
    method: "POST",
  });
  const data = await res.json();

  if (!data.access_token) {
    throw new Error(`Zoho token refresh failed: ${JSON.stringify(data)}`);
  }

  cachedToken = data.access_token;
  apiDomain = data.api_domain;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000; // refresh 60s early, to be safe

  return { token: cachedToken, domain: apiDomain };
}

async function zohoRequest(path, method = "GET", body) {
  const { token, domain } = await getAccessToken();

  const res = await fetch(`${domain}/crm/v8/${path}`, {
    method,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Zoho search returns 204 with an empty body when there are no matches
  if (res.status === 204) {
    return { data: [] };
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Zoho API error (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function createZohoLead({
  fullName,
  phone,
  email,
  preferredCity,
  vehicleModel,
}) {
  const [firstName, ...rest] = fullName.trim().split(" ");
  const lastName = rest.join(" ") || firstName;

  return zohoRequest("Leads", "POST", {
    data: [
      {
        First_Name: firstName,
        Last_Name: lastName,
        Phone: phone,
        Email: email,
        City: preferredCity,
        Vehicle_Modal_of_Interest: vehicleModel, // the custom field you created earlier
      },
    ],
  });
}

// async function getPipelineStatus({ phoneOrDealId }) {
//   const criteria = `(Mobile:equals:${phoneOrDealId})`;
//   console.log({phoneOrDealId})
//   return zohoRequest(`Deals/search?criteria=${encodeURIComponent(criteria)}`);
// }

// async function getPipelineStatus({ phoneOrDealId }) {
//   const value = String(phoneOrDealId).trim().replace(/^#/, ""); // "#MAH-9921" -> "MAH-9921"

//   // 1. Try Booking ID first
//   const byBookingId = await zohoRequest(
//     `Deals/search?criteria=${encodeURIComponent(`(Booking_ID:equals:${value})`)}`
//   );
//   if (byBookingId.data?.length) return byBookingId;

//   // 2. Nothing found, so fall back to Mobile
//   return zohoRequest(
//     `Deals/search?criteria=${encodeURIComponent(`(Mobile:equals:${value})`)}`
//   );
// }



function formatDeal(d) {
  return {
    dealId: d.id,
    customerName: d.Account_Name?.name ?? null,
    mobile: d.Mobile ?? null,
    stage: d.Stage ?? null,
    vehicleModel: d.Vehicle_Modal ?? null,
    testDrive: {
      scheduledOn: d.Test_Drive_Scheduled_On ?? null, // date only, no time
      status: d.Test_Drive_Status ?? null,
    },
    quotation: {
      amount: d.Quotation_Amount ?? null,
    },
    dealer: {
      dealershipName: d.Dealership_Name ?? null,
      dealerName: d.Dealer_Name ?? null,
      dealerPhone: d.Dealer_Phone ?? null,
    },
    followUp: {
      preferredCallbackTime: d.Preferred_Callback_Time ?? null,
      preferredCallbackChannel: d.Preferred_Callback_Channel ?? null,
      nextStep: d.Next_Step ?? null,
    },
  };
}

async function getPipelineStatus({ phoneOrDealId }) {
  const value = String(phoneOrDealId).trim().replace(/^#/, ""); // "#MAH-9921" -> "MAH-9921"

  // 1. Try Booking ID first
  const byBookingId = await zohoRequest(
    `Deals/search?criteria=${encodeURIComponent(`(Booking_ID:equals:${value})`)}`,
  );
  if (byBookingId.data?.length) return { data: byBookingId.data.map(formatDeal) };

  // 2. Nothing found, so fall back to Mobile
  const byMobile = await zohoRequest(
    `Deals/search?criteria=${encodeURIComponent(`(Mobile:equals:${value})`)}`,
  );
  if (byMobile.data?.length) return { data: byMobile.data.map(formatDeal) };

  return { data: [] };
}

async function getBookingStatus({ bookingId }) {
  const value = String(bookingId).trim();

  // 1. Try Booking ID first
  const criteria = `(Booking_ID:equals:${value})`;

  const byBookingId = await zohoRequest(
    `Deals/search?criteria=${encodeURIComponent(criteria)}`,
  );

  if (byBookingId.data?.length) return byBookingId;

  // 2. Nothing found, so fall back to Mobile
  const byMobile = await zohoRequest(
    `Deals/search?criteria=${encodeURIComponent(`(Mobile:equals:${value})`)}`,
  );

  if (byMobile.data?.length) return byMobile;

  return { data: [] };
}

async function createServiceTicket({
  registrationNumber,
  odometerReading,
  issue,
  preferredCenter,
}) {
  return zohoRequest("Cases", "POST", {
    data: [
      {
        Subject: `${issue} — ${registrationNumber}`,
        Registration_Number: registrationNumber,
        Odometer_Reading: odometerReading,
        Preferred_Service_Center: preferredCenter,
      },
    ],
  });
}


async function updateDealFollowUp({
  dealId,
  preferredCallbackTime,
  preferredCallbackChannel,
  rescheduleRequest,
  notes,
}) {
  const nextStep = [
    rescheduleRequest && `Test drive reschedule requested: ${rescheduleRequest}`,
    preferredCallbackTime && `Call back: ${preferredCallbackTime}`,
    preferredCallbackChannel && `Via: ${preferredCallbackChannel}`,
    notes,
  ]
    .filter(Boolean)
    .join(" | ");

  const record = { id: dealId };
  if (preferredCallbackTime) record.Preferred_Callback_Time = preferredCallbackTime;
  if (preferredCallbackChannel) record.Preferred_Callback_Channel = preferredCallbackChannel;
  if (nextStep) record.Next_Step = nextStep;

  const res = await zohoRequest("Deals", "PUT", { data: [record] });

  // Zoho can return HTTP 200 while the individual record failed
  const result = res.data?.[0];
  if (result?.status !== "success") {
    throw new Error(`Deal update failed: ${JSON.stringify(result)}`);
  }

  // Add a Note so the change shows on the Deal's timeline
  if (nextStep) {
    await zohoRequest(`Deals/${dealId}/Notes`, "POST", {
      data: [
        {
          Note_Title: "Follow-up updated via AI assistant",
          Note_Content: nextStep,
        },
      ],
    });
  }

  return { data: [{ dealId, updated: record }] };
}

export {
  createZohoLead,
  getPipelineStatus,
  getBookingStatus,
  createServiceTicket,
  updateDealFollowUp,
};
