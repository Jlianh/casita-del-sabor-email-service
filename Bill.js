const mongoose = require('mongoose');

const billSchema = new mongoose.Schema(
  {
    _id:      { type: String, required: true },
    date:     { type: Date, required: true },
    serial:  { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Bill', billSchema);
