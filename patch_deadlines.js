const mongoose = require("mongoose");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const complaintSchema = new mongoose.Schema({
    urgency: String,
    deadlineAt: Date,
    status: String,
    isEscalated: Boolean
  }, { strict: false });
  const Complaint = mongoose.model("Complaint", complaintSchema);
  
  // Find escalated complaints
  const complaints = await Complaint.find({ status: { $nin: ["Resolved"] }, isEscalated: true });
  let count = 0;
  const now = Date.now();
  for (const c of complaints) {
      // Force them to 24 hours from now to properly restart the cycle!
      c.deadlineAt = new Date(now + 24 * 60 * 60 * 1000); 
      c.urgency = "Low";
      await c.save();
      count++;
  }
  console.log(`✅ Fixed ${count} escalated complaints, giving them a full 24-hour cycle.`);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
