require('dotenv').config();
const mongoose = require('mongoose');
const { sendUserResolutionCompleteMail } = require('./services/deadlineChecker');

const complaintSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  userEmail: String,
  category: String,
  location: String,
  createdAt: { type: Date, default: Date.now },
});
const Complaint = mongoose.model('Complaint', complaintSchema);

const userSchema = new mongoose.Schema({
  name: { type: String, default: "" },
  email: { type: String, unique: true, lowercase: true, trim: true },
});
const User = mongoose.model('User', userSchema);

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const complaint = await Complaint.findOne();
  if (complaint) {
    console.log("Sending email for complaint:", complaint._id);
    await sendUserResolutionCompleteMail(complaint);
    console.log("Test finished.");
  } else {
    console.log("No complaints found in DB.");
  }
  process.exit(0);
}).catch(console.error);
