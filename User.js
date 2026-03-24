const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    id:       { type: String, required: true },
    name:     { type: String, required: true },
    user:     { type: String, required: true },
    password: { type: String, required: true }, // AES-256 encrypted
    // support multiple roles per user (presented as roles array)
    roles:    { type: [String], enum: ['vendedor', 'administrador'], required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
