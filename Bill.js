const mongoose = require('mongoose');

const billSchema = new mongoose.Schema(
  {
    id:       { type: String, required: true },
    date:     { type: Date, required: true },
    remisionSerial: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Bill', billSchema);
