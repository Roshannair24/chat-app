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

async function getPipelineStatus({ phoneOrDealId }) {
  const criteria = `(Mobile:equals:${phoneOrDealId})`;
  return zohoRequest(`Deals/search?criteria=${encodeURIComponent(criteria)}`);
}

async function getBookingStatus({ bookingIdOrPhone }) {
  const criteria = `(Booking_ID:equals:${bookingIdOrPhone})`;
  return zohoRequest(`Deals/search?criteria=${encodeURIComponent(criteria)}`);
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

export {
  createZohoLead,
  getPipelineStatus,
  getBookingStatus,
  createServiceTicket,
};
