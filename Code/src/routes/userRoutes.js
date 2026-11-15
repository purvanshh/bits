const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} = require('../services/userService');
const { authenticate, authorize } = require('../middleware/auth');

// Public
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, phone, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'name, email and password are required' });
    }
    const { user, token } = await registerUser({ name, email, password, phone, role });
    res.status(201).json({ success: true, data: { user, token } });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { user, token } = await loginUser(req.body);
    res.json({ success: true, data: { user, token } });
  } catch (err) {
    next(err);
  }
});

// Protected
router.get('/me', authenticate, async (req, res) => {
  res.json({ success: true, data: req.user });
});

// Admin only
router.get('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const users = await getAllUsers();
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const user = await updateUser(req.params.id, req.body);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    await deleteUser(req.params.id);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
