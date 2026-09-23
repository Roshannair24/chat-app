import {
  createZohoLead,
  getPipelineStatus,
  getBookingStatus,
  createServiceTicket,
} from "./src/components/lib/zoho.js";
import { config } from "dotenv";
config({ path: ".env" });

// (async () => {
//   const result = await createZohoLead({
//     fullName: "test lead v1",
//     phone: "9876543210",
//     email: "rajesh.test@example.com",
//     preferredCity: "Pune",
//     vehicleModel: "Thar",
//   });
//   console.log(JSON.stringify(result, null, 2));
// })();

(async () => {
  const result = await getPipelineStatus({
    phoneOrDealId: "9999999990", // Priya Patel deal
  });
  console.log("getPipelineStatus:", JSON.stringify(result, null, 2));
})();

// (async () => {
//   const result = await getBookingStatus({
//     // bookingId: "#MAH-9922", // BRD's seed data

//     bookingId:"9999999991"
//   });

//   console.log("result");
//   console.dir({ result }, { depth: null });
// })();

// (async () => {
//   const result = await createServiceTicket({
//     registrationNumber: "MH12AB1234",
//     odometerReading: 15400,
//     issue: "Unusual noise from front brakes",
//     preferredCenter: "Pune Service Center",
//   });
//   console.log("createServiceTicket:", JSON.stringify(result, null, 2));
// })();
