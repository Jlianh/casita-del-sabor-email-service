const express  = require('express');
const jwt      = require('jsonwebtoken');
const router   = express.Router();
const User     = require('./User.js');
const { encryptPassword, verifyPassword } = require('./authService.js');
const { requireAuth, requireRole } = require('./mnt/user-data/outputs/spice-api-final/src/middleware/auth.js');
const { sendEmailWithAttachment } = require('./emailService.js');
const { connectDB } = require('./db.js');

/**
 * POST /api/auth/login
 *
 * Body: { user: string, password: string }
 *
 * Sets JWT in httpOnly cookie and returns user info.
 */
router.post('/login', async (req, res) => {
  try {

    await connectDB();

    const { user: username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '"user" and "password" are required' });
    }

    // Find user by username field
    const found = await User.findOne({ user: username });
    if (!found) {
      // Generic message — don't reveal whether the username exists
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Decrypt stored password and compare
    const valid = verifyPassword(password, found.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Build JWT payload — never include the password
    const userRoles = Array.isArray(found.roles)
      ? found.roles
      : Array.isArray(found.role)
        ? found.role
        : found.role
          ? [found.role]
          : ['vendedor'];

    const payload = {
      _id: found._id,
      id:  found.id,
      name: found.name,
      user: found.user,
      role: userRoles,   // backward compatibility
      roles: userRoles,  // primary key for multiple roles
    };

    console.debug('[auth] JWT payload:', payload);

    const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });

    // Set httpOnly cookie for security
    const maxAge = expiresIn === '8h' ? 8 * 60 * 60 * 1000 : jwt.decode(token).exp * 1000 - Date.now();
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use HTTPS in production
      sameSite: 'none',
      secure: true,
      maxAge: maxAge
    });

    res.json({
      message: 'Login successful',
      user: payload,
    });
  } catch (err) {
    console.error('[auth] Login error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/me
 * Returns the currently logged-in user's info from the token.
 * Requires: Authorization: Bearer <token>
 */
router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

/**
 * POST /api/auth/logout
 * Clears the JWT cookie.
 */
router.post('/logout', (req, res) => {
   res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/'
  });
  res.json({ message: 'Logged out successfully' });
});

/**
 * POST /api/auth/users
 * Creates a new user. Requires admin role.
 * Body: { id: number, name: string, user: string, password: string, roles: string[] }
 * Also supports { role: 'vendedor' | 'administrador' } for compatibility.
 */
router.post('/users', requireAuth, requireRole('administrador'), async (req, res) => {
  try {
    await connectDB();
    console.log('[auth] Create user request body:', req.body);
    const { id, name, email, user, password } = req.body;
    const roleInput = req.body.roles || req.body.role;

    if (!id || !name || !email || !user || !password || !roleInput) {
      return res.status(400).json({ error: 'id, name, email, user, password, and role(s) are required' });
    }

    const roleValues = Array.isArray(roleInput) ? roleInput : [roleInput];
    const allowedRoles = ['vendedor', 'administrador'];
    const invalidRoles = roleValues.filter(r => !allowedRoles.includes(r));

    if (invalidRoles.length > 0) {
      return res.status(400).json({ error: `Invalid role(s): ${invalidRoles.join(', ')}` });
    }

    // Check if user already exists
    const existing = await User.findOne({ $or: [{ user }, { id }] });
    if (existing) {
      return res.status(409).json({ error: 'User with this username or id already exists' });
    }

    const encryptedPassword = encryptPassword(password);

    const finalRoles = Array.from(new Set(roleValues));

    const newUser = new User({
      id,
      name,
      email,
      user,
      password: encryptedPassword,
      roles: finalRoles,
    });

    await newUser.save();

    res.status(201).json({
      message: 'User created successfully',
      user: { id: newUser.id, name: newUser.name, user: newUser.user, roles: newUser.roles },
    });
  } catch (err) {
    console.error('[auth] Create user error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/auth/users/:id
 * Deletes a user by ID. Requires admin role.
 * Cannot delete the current user.
 */
router.delete('/users/:id', requireAuth, requireRole('administrador'), async (req, res) => {
  try {

    await connectDB();

    const userId = req.params.id;
    const currentUserId = req.user.id;

    // Assuming req.user is set by middleware

    if (userId === currentUserId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await User.findOneAndDelete({ id: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User deleted successfully',
      user: { id: user.id, name: user.name, user: user.user, role: user.role },
    });
  } catch (err) {
    console.error('[auth] Delete user error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/users
 * Obtiene todos los usuarios (sin contraseña)
 * Requiere rol: administrador
 */
router.get('/users', requireAuth, requireRole('administrador'), async (req, res) => {
  try {
    await connectDB();

    const users = await User.find({}, { password: 0 }); // excluye password

    res.json(users);

  } catch (err) {
    console.error('[auth] Get users error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {

    await connectDB();
    const userId = req.params.id;
    const user = await User.findOne({ id: userId });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      email: user.email
    });
  } catch (err) {
    console.error('[auth] Get user by ID error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/sendRestoreEmail', async (req, res) => {
  try {
    await connectDB();
    const { email } = req.body;
    const user = await User.findOne({ email: email });

    console.log('[auth] User found:', user);

    console.log('[auth] Send restore email request body:', req.body);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
  
  // await sendEmailWithAttachment({
  //   to: [email], 
  //   subject: `Recuperar Contraseña`,
  //   html: `<p>Hola ${user.name},</p><p>Este es el link para recuperar tu contraseña:</p><p><a href="http://localhost:4200/auth/restore/${user.id}">Recuperar Contraseña</a></p><p>Saludos,<br>El equipo de Casita del Sabor</p>`,
  // }, 'security');

  await sendEmailWithAttachment({
    to: [email], 
    subject: `Recuperar Contraseña`,
    html: `<p>Hola ${user.name},</p><p>Este es el link para recuperar tu contraseña:</p><p><a href="https://lacasitadelsabor.com/auth/restore/${user.id}">Recuperar Contraseña</a></p><p>Saludos,<br>El equipo de Casita del Sabor</p>`,
  }, 'security');

    return res.status(200).json({ message: 'Recovery email sent' });

  } catch (err) {
    console.error('[auth] Get user by username error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/restore', async (req, res) => {
  try {
    await connectDB();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '"email" and "password" are required' });
    }

    const encryptedPassword = encryptPassword(password);

    const updated = await User.findOneAndUpdate(
      { email: email },
      { password: encryptedPassword },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Password restored successfully',
      user: { id: updated.id, name: updated.name, user: updated.user, roles: updated.roles },
    });
  } catch (err) {
    console.error('[auth] Restore password error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
