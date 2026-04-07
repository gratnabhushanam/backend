const { User, Sloka } = require('../models');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const mockContentStore = require('../utils/mockContentStore');

// Mock in-memory database for when MySQL is unavailable
let mockUsers = [];
let nextUserId = 1;
let isMockModeActive = false;

// In-memory OTP store for registration verification
const pendingRegistrations = new Map();
const pendingPasswordResets = new Map();
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 10);
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60);
const ALLOW_OTP_PREVIEW = String(process.env.ALLOW_OTP_PREVIEW || 'false').toLowerCase() === 'true';
const IS_PRODUCTION = String(process.env.NODE_ENV || 'development').toLowerCase() === 'production';
const CAN_USE_OTP_PREVIEW = ALLOW_OTP_PREVIEW || !IS_PRODUCTION;

const ADMIN_NAME = process.env.ADMIN_NAME || 'Gita Admin';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

const normalizeUserSettings = (incomingSettings = {}, currentSettings = {}) => {
  const base = {
    notifications: true,
    privacy: 'public',
    interests: [],
    ...(currentSettings || {}),
  };

  if (!incomingSettings || typeof incomingSettings !== 'object') {
    return base;
  }

  if (Object.prototype.hasOwnProperty.call(incomingSettings, 'notifications')) {
    base.notifications = Boolean(incomingSettings.notifications);
  }

  if (Object.prototype.hasOwnProperty.call(incomingSettings, 'privacy')) {
    const normalizedPrivacy = String(incomingSettings.privacy || '').trim().toLowerCase();
    base.privacy = normalizedPrivacy === 'private' ? 'private' : 'public';
  }

  if (Object.prototype.hasOwnProperty.call(incomingSettings, 'interests')) {
    const raw = Array.isArray(incomingSettings.interests) ? incomingSettings.interests : [];
    const uniqueInterests = Array.from(
      new Set(
        raw
          .map((interest) => String(interest || '').trim())
          .filter(Boolean)
      )
    ).slice(0, 20);
    base.interests = uniqueInterests;
  }

  return base;
};

const createOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const getOtpExpiryTime = () => Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000;

const getEmailAuthConfig = () => {
  const user = String(process.env.EMAIL_USER || process.env.GMAIL_USER || '').trim();
  const pass = String(process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  return { user, pass };
};

const isEmailTransportConfigured = () => {
  const { user, pass } = getEmailAuthConfig();
  return Boolean(user && pass);
};

const buildTransporter = () => nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: getEmailAuthConfig().user,
    pass: getEmailAuthConfig().pass,
  },
});

const getEmailFailureMessage = (error) => {
  const authRejected = error && (error.code === 'EAUTH' || error.responseCode === 535);
  const smtpNetworkBlocked = error && (
    error.code === 'ESOCKET' ||
    error.code === 'ENETUNREACH' ||
    error.code === 'ETIMEDOUT' ||
    error.code === 'ECONNREFUSED'
  );

  if (authRejected) {
    return 'Gmail rejected EMAIL_PASS. Use a Gmail App Password.';
  }

  if (smtpNetworkBlocked) {
    return 'SMTP network unreachable from server. Check internet/firewall.';
  }

  return 'Email delivery failed.';
};

exports.getEmailHealth = async (req, res) => {
  const { user } = getEmailAuthConfig();

  if (!isEmailTransportConfigured()) {
    return res.status(200).json({
      configured: false,
      reachable: false,
      mode: 'preview',
      smtpUser: user || null,
      message: 'Email service is not configured. Set EMAIL_USER and EMAIL_PASS.',
    });
  }

  try {
    const transporter = buildTransporter();
    await transporter.verify();

    return res.status(200).json({
      configured: true,
      reachable: true,
      mode: 'live',
      smtpUser: user,
      message: 'SMTP is reachable. OTP emails should be delivered.',
    });
  } catch (error) {
    return res.status(200).json({
      configured: true,
      reachable: false,
      mode: 'preview',
      smtpUser: user,
      errorCode: error.code || null,
      message: getEmailFailureMessage(error),
    });
  }
};

const sendOtpEmail = async ({ email, name, otp }) => {
  const isConfigured = isEmailTransportConfigured();

  if (!IS_PRODUCTION) {
    return {
      delivered: false,
      devPreview: true,
      otp,
      message: 'OTP generated locally for testing. Enter the code below to verify and complete account creation.',
    };
  }

  // If no email config, return dev preview immediately
  if (!isConfigured) {
    return {
      delivered: false,
      devPreview: CAN_USE_OTP_PREVIEW,
      otp,
      message: 'Email service is not configured. Set EMAIL_USER and EMAIL_PASS.',
    };
  }

  // Try to send real email
  try {
    const transporter = buildTransporter();
    const { user } = getEmailAuthConfig();
    await transporter.sendMail({
      from: `${process.env.EMAIL_FROM_NAME || 'Gita Wisdom'} <${user}>`,
      to: email,
      subject: 'Your Gita Wisdom OTP Code',
      text: `Hare Krishna ${name || ''}, your OTP is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
      html: `<div style="font-family:Arial,sans-serif;background:#08111f;color:#fef3c7;padding:24px;border-radius:12px;border:1px solid #d4a12d;max-width:520px;"><h2 style="margin:0 0 12px;color:#f5d06f;">Gita Wisdom Account Verification</h2><p style="margin:0 0 16px;line-height:1.5;">Hare Krishna ${name || ''}, use this OTP to verify your account.</p><div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#ffffff;margin:10px 0 18px;">${otp}</div><p style="margin:0;color:#fcd34d;">This OTP expires in ${OTP_EXPIRY_MINUTES} minutes.</p></div>`,
    });
    return { delivered: true, devPreview: false };
  } catch (error) {
    return {
      delivered: false,
      devPreview: CAN_USE_OTP_PREVIEW,
      otp,
      message: getEmailFailureMessage(error),
    };
  }
};

const ensureMockAdminUser = () => {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.warn('Admin credentials missing in env. Set ADMIN_EMAIL and ADMIN_PASSWORD.');
    return;
  }

  const normalizedAdminEmail = normalizeEmail(ADMIN_EMAIL);
  const existingAdmin = mockUsers.find((u) => normalizeEmail(u.email) === normalizedAdminEmail || u.role === 'admin');
  if (existingAdmin) {
    existingAdmin.name = ADMIN_NAME;
    existingAdmin.email = normalizedAdminEmail;
    existingAdmin.password = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    existingAdmin.role = 'admin';
    existingAdmin.updatedAt = new Date().toISOString();
    return;
  }

  const adminUser = {
    id: nextUserId++,
    name: ADMIN_NAME,
    email: normalizedAdminEmail,
    password: bcrypt.hashSync(ADMIN_PASSWORD, 10),
    role: 'admin',
    language: 'telugu',
    streak: 0,
    profilePicture: null,
    settings: { notifications: true, privacy: 'public', interests: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  mockUsers.push(adminUser);
  console.log('Mock admin user created:', normalizedAdminEmail);
};

const ensurePersistentAdminUser = async () => {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.warn('Admin credentials missing in env. Set ADMIN_EMAIL and ADMIN_PASSWORD.');
    return;
  }

  const normalizedAdminEmail = normalizeEmail(ADMIN_EMAIL);

  const existing = await User.findOne({ where: { email: normalizedAdminEmail } });
  if (existing) {
    existing.name = ADMIN_NAME;
    existing.role = 'admin';
    existing.password = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await existing.save();
    return;
  }

  const anyAdmin = await User.findOne({ where: { role: 'admin' } });
  if (anyAdmin) {
    anyAdmin.name = ADMIN_NAME;
    anyAdmin.email = normalizedAdminEmail;
    anyAdmin.role = 'admin';
    anyAdmin.password = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await anyAdmin.save();
    return;
  }

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await User.create({
    name: ADMIN_NAME,
    email: normalizedAdminEmail,
    password: hashedPassword,
    role: 'admin',
  });

  console.log('Admin user bootstrapped:', normalizedAdminEmail);
};

// Set mock mode
const setMockMode = (value) => {
  isMockModeActive = value;
  console.log('Mock mode:', isMockModeActive ? 'ENABLED' : 'DISABLED');
  if (isMockModeActive) {
    ensureMockAdminUser();
  }
};

const isMockMode = () => isMockModeActive;

module.exports.setMockMode = setMockMode;
module.exports.isMockMode = isMockMode;

const getMockUserById = (id) => mockUsers.find((u) => Number(u.id) === Number(id));
module.exports.getMockUserById = getMockUserById;

const initializeAdminCredentials = async () => {
  if (isMockMode()) {
    ensureMockAdminUser();
    return;
  }
  await ensurePersistentAdminUser();
};

module.exports.initializeAdminCredentials = initializeAdminCredentials;

// Register step 1: create OTP challenge, send email, do not create user yet.
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const safeEmail = normalizeEmail(email);

    if (!name || !safeEmail || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    let userExists;
    if (isMockMode()) {
      userExists = mockUsers.find((u) => normalizeEmail(u.email) === safeEmail);
    } else {
      userExists = await User.findOne({ where: { email: safeEmail } });
    }

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const otp = createOtp();
    const now = Date.now();

    pendingRegistrations.set(safeEmail, {
      name,
      email: safeEmail,
      password: hashedPassword,
      otp,
      expiresAt: getOtpExpiryTime(),
      attempts: 0,
      resendAvailableAt: now + OTP_RESEND_COOLDOWN_SECONDS * 1000,
    });

    try {
      const deliveryResult = await sendOtpEmail({ email: safeEmail, name, otp });

      if (deliveryResult?.devPreview) {
        return res.status(200).json({
          message: deliveryResult.message || 'OTP generated locally for testing. Enter the code below to verify and complete account creation.',
          email: safeEmail,
          otpPreview: deliveryResult.otp,
          retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
        });
      }

      if (!deliveryResult?.delivered) {
        pendingRegistrations.delete(safeEmail);
        return res.status(503).json({ message: deliveryResult?.message || 'Failed to deliver OTP email. Please try again later.' });
      }
    } catch (mailError) {
      pendingRegistrations.delete(safeEmail);
      return res.status(502).json({
        message: 'Failed to send OTP email. Check Gmail app password and try again.',
        error: mailError.message,
      });
    }

    const response = {
      message: 'OTP sent to your email. Please verify to complete account creation.',
      email: safeEmail,
      retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    };

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Optional endpoint to resend OTP for existing pending registration
exports.resendRegistrationOtp = async (req, res) => {
  try {
    const safeEmail = normalizeEmail(req.body.email);
    if (!safeEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const pending = pendingRegistrations.get(safeEmail);
    if (!pending) {
      return res.status(404).json({ message: 'No pending registration found for this email' });
    }

    const now = Date.now();
    if (Number(pending.resendAvailableAt || 0) > now) {
      const retryAfterSeconds = Math.ceil((Number(pending.resendAvailableAt) - now) / 1000);
      return res.status(429).json({
        message: `Please wait ${retryAfterSeconds} seconds before requesting a new OTP. For security, OTP can be resent once per minute.`,
        retryAfterSeconds,
      });
    }

    const otp = createOtp();
    pending.otp = otp;
    pending.expiresAt = getOtpExpiryTime();
    pending.attempts = 0;
    pending.resendAvailableAt = now + OTP_RESEND_COOLDOWN_SECONDS * 1000;
    pendingRegistrations.set(safeEmail, pending);

    try {
      const deliveryResult = await sendOtpEmail({ email: safeEmail, name: pending.name, otp });

      if (deliveryResult?.devPreview) {
        return res.status(200).json({
          message: deliveryResult.message || 'OTP generated locally for testing.',
          email: safeEmail,
          otpPreview: deliveryResult.otp,
          retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
        });
      }

      if (!deliveryResult?.delivered) {
        return res.status(503).json({ message: deliveryResult?.message || 'Failed to deliver OTP email. Please try again later.' });
      }
    } catch (mailError) {
      return res.status(502).json({
        message: 'Failed to resend OTP email. Check Gmail app password and try again.',
        error: mailError.message,
      });
    }

    const response = {
      message: 'A new OTP has been sent',
      email: safeEmail,
      retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    };

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Register step 2: verify OTP and create user account
exports.verifyRegistrationOtp = async (req, res) => {
  try {
    const safeEmail = normalizeEmail(req.body.email);
    const providedOtp = String(req.body.otp || '').trim();

    if (!safeEmail || !providedOtp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const pending = pendingRegistrations.get(safeEmail);
    if (!pending) {
      return res.status(404).json({ message: 'No pending registration found. Please register again.' });
    }

    if (pending.expiresAt < Date.now()) {
      pendingRegistrations.delete(safeEmail);
      return res.status(400).json({ message: 'OTP expired. Please request a new OTP.' });
    }

    if (pending.attempts >= OTP_MAX_ATTEMPTS) {
      pendingRegistrations.delete(safeEmail);
      return res.status(429).json({ message: 'Too many invalid attempts. Please register again.' });
    }

    if (pending.otp !== providedOtp) {
      pending.attempts += 1;
      pendingRegistrations.set(safeEmail, pending);
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    let user;
    if (isMockMode()) {
      const existingMock = mockUsers.find((u) => normalizeEmail(u.email) === safeEmail);
      if (existingMock) {
        pendingRegistrations.delete(safeEmail);
        return res.status(400).json({ message: 'User already exists' });
      }

      user = {
        id: nextUserId++,
        name: pending.name,
        email: pending.email,
        password: pending.password,
        role: 'user',
        language: 'telugu',
        streak: 0,
        profilePicture: null,
        settings: { notifications: true, privacy: 'public', interests: [] },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockUsers.push(user);
    } else {
      const existing = await User.findOne({ where: { email: safeEmail } });
      if (existing) {
        pendingRegistrations.delete(safeEmail);
        return res.status(400).json({ message: 'User already exists' });
      }

      user = await User.create({
        name: pending.name,
        email: pending.email,
        password: pending.password,
      });
    }

    pendingRegistrations.delete(safeEmail);

    return res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      language: user.language,
      settings: user.settings,
      token: generateToken(user.id),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Forgot password step 1: send OTP
exports.requestPasswordResetOtp = async (req, res) => {
  try {
    const safeEmail = normalizeEmail(req.body.email);
    if (!safeEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    let existingUser;
    if (isMockMode()) {
      existingUser = mockUsers.find((u) => normalizeEmail(u.email) === safeEmail);
    } else {
      existingUser = await User.findOne({ where: { email: safeEmail } });
    }

    if (!existingUser) {
      return res.status(404).json({ message: 'No account found with this email' });
    }

    const existingResetRequest = pendingPasswordResets.get(safeEmail);
    const now = Date.now();
    if (existingResetRequest && Number(existingResetRequest.resendAvailableAt || 0) > now) {
      const retryAfterSeconds = Math.ceil((Number(existingResetRequest.resendAvailableAt) - now) / 1000);
      return res.status(429).json({
        message: `Please wait ${retryAfterSeconds} seconds before requesting a new OTP. For security, OTP can be resent once per minute.`,
        retryAfterSeconds,
      });
    }

    const otp = createOtp();
    pendingPasswordResets.set(safeEmail, {
      otp,
      expiresAt: getOtpExpiryTime(),
      attempts: 0,
      resendAvailableAt: now + OTP_RESEND_COOLDOWN_SECONDS * 1000,
    });

    const deliveryResult = await sendOtpEmail({
      email: safeEmail,
      name: existingUser.name,
      otp,
    });

    if (deliveryResult?.devPreview) {
      return res.status(200).json({
        message: deliveryResult.message || 'OTP generated locally for testing.',
        email: safeEmail,
        otpPreview: deliveryResult.otp,
        retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      });
    }

    if (!deliveryResult?.delivered) {
      pendingPasswordResets.delete(safeEmail);
      return res.status(503).json({ message: deliveryResult?.message || 'Failed to deliver OTP email. Please try again later.' });
    }

    return res.status(200).json({
      message: 'OTP sent to your email',
      email: safeEmail,
      retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Forgot password step 2: verify OTP and set new password
exports.verifyPasswordResetOtp = async (req, res) => {
  try {
    const safeEmail = normalizeEmail(req.body.email);
    const providedOtp = String(req.body.otp || '').trim();
    const newPassword = String(req.body.newPassword || '').trim();

    if (!safeEmail || !providedOtp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    const pending = pendingPasswordResets.get(safeEmail);
    if (!pending) {
      return res.status(404).json({ message: 'No pending password reset found. Request OTP again.' });
    }

    if (pending.expiresAt < Date.now()) {
      pendingPasswordResets.delete(safeEmail);
      return res.status(400).json({ message: 'OTP expired. Request a new OTP.' });
    }

    if (pending.attempts >= OTP_MAX_ATTEMPTS) {
      pendingPasswordResets.delete(safeEmail);
      return res.status(429).json({ message: 'Too many invalid attempts. Request OTP again.' });
    }

    if (pending.otp !== providedOtp) {
      pending.attempts += 1;
      pendingPasswordResets.set(safeEmail, pending);
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    if (isMockMode()) {
      const target = mockUsers.find((u) => normalizeEmail(u.email) === safeEmail);
      if (!target) {
        pendingPasswordResets.delete(safeEmail);
        return res.status(404).json({ message: 'User not found' });
      }
      target.password = hashedPassword;
      target.updatedAt = new Date().toISOString();
      pendingPasswordResets.delete(safeEmail);
      return res.json({ message: 'Password reset successful' });
    }

    const target = await User.findOne({ where: { email: safeEmail } });
    if (!target) {
      pendingPasswordResets.delete(safeEmail);
      return res.status(404).json({ message: 'User not found' });
    }

    target.password = hashedPassword;
    await target.save();
    pendingPasswordResets.delete(safeEmail);
    return res.json({ message: 'Password reset successful' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Login user
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    let user;

    if (isMockMode()) {
      user = mockUsers.find((u) => normalizeEmail(u.email) === normalizeEmail(email));
    } else {
      user = await User.findOne({ where: { email: normalizeEmail(email) } });
    }

    if (user && (await bcrypt.compare(password, user.password))) {
      const now = new Date();
      if (user.lastActive) {
        const lastActiveDate = new Date(user.lastActive);
        const timeDiff = Math.abs(now - lastActiveDate);
        const diffDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          user.streak += 1;
        } else if (diffDays > 1) {
          user.streak = 1;
        }
      } else {
        user.streak = 1;
      }
      user.lastActive = now;

      if (!isMockMode()) {
        await user.save();
      }

      return res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        language: user.language,
        streak: user.streak,
        settings: user.settings,
        token: generateToken(user.id),
      });
    }

    return res.status(401).json({ message: 'Invalid email or password' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Update user streak on sloka view
exports.updateStreak = async (req, res) => {
  try {
    if (isMockMode()) {
      const user = getMockUserById(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const now = new Date();
      if (user.lastActive) {
        const lastActiveDate = new Date(user.lastActive);
        const isSameDay = now.toDateString() === lastActiveDate.toDateString();

        if (!isSameDay) {
          const diffTime = Math.abs(now - lastActiveDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          user.streak = diffDays === 1 ? (user.streak || 0) + 1 : 1;
          user.lastActive = now.toISOString();
        }
      } else {
        user.streak = 1;
        user.lastActive = now.toISOString();
      }

      return res.json({ streak: user.streak, lastActive: user.lastActive });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const now = new Date();
    if (user.lastActive) {
      const lastActiveDate = new Date(user.lastActive);
      const isSameDay = now.toDateString() === lastActiveDate.toDateString();

      if (!isSameDay) {
        const diffTime = Math.abs(now - lastActiveDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          user.streak += 1;
        } else {
          user.streak = 1;
        }
        user.lastActive = now;
        await user.save();
      }
    } else {
      user.streak = 1;
      user.lastActive = now;
      await user.save();
    }

    return res.json({ streak: user.streak, lastActive: user.lastActive });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Get user profile
exports.getUserProfile = async (req, res) => {
  try {
    if (isMockMode()) {
      const user = getMockUserById(req.user.id);
      if (user) {
        const { password, ...safeUser } = user;
        return res.json({
          ...safeUser,
          bookmarkedSlokas: Array.isArray(user.bookmarkedSlokas) ? user.bookmarkedSlokas : [],
        });
      }
      return res.status(404).json({ message: 'User not found' });
    }

    const user = await User.findByPk(req.user.id, {
      include: [{ model: Sloka, as: 'bookmarkedSlokas' }],
    });
    if (user) {
      return res.json(user);
    }
    return res.status(404).json({ message: 'User not found' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Update user profile/settings
exports.updateUserProfile = async (req, res) => {
  try {
    if (isMockMode()) {
      const user = getMockUserById(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      user.bio = req.body.bio || user.bio;
      user.profilePicture = req.body.profilePicture || user.profilePicture;
      if (req.body.settings) {
        user.settings = normalizeUserSettings(req.body.settings, user.settings);
      }
      user.updatedAt = new Date().toISOString();

      if (req.body.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(req.body.password, salt);
      }

      return res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        profilePicture: user.profilePicture,
        settings: user.settings,
        role: user.role,
        token: generateToken(user.id),
      });
    }

    const user = await User.findByPk(req.user.id);
    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      user.bio = req.body.bio || user.bio;
      user.profilePicture = req.body.profilePicture || user.profilePicture;

      if (req.body.settings) {
        user.settings = normalizeUserSettings(req.body.settings, user.settings);
      }

      if (req.body.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(req.body.password, salt);
      }

      const updatedUser = await user.save();
      return res.json({
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        bio: updatedUser.bio,
        profilePicture: updatedUser.profilePicture,
        settings: updatedUser.settings,
        role: updatedUser.role,
        token: generateToken(updatedUser.id),
      });
    }

    return res.status(404).json({ message: 'User not found' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Bookmark a sloka
exports.toggleBookmark = async (req, res) => {
  try {
    if (isMockMode()) {
      const slokaId = Number(req.body.slokaId);
      if (!slokaId) {
        return res.status(400).json({ message: 'Valid slokaId is required' });
      }

      const user = getMockUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (!Array.isArray(user.bookmarkedSlokas)) {
        user.bookmarkedSlokas = [];
      }

      const existingIndex = user.bookmarkedSlokas.findIndex((id) => Number(id) === slokaId);
      const isBookmarked = existingIndex !== -1;

      if (isBookmarked) {
        user.bookmarkedSlokas.splice(existingIndex, 1);
      } else {
        user.bookmarkedSlokas.push(slokaId);
      }

      user.updatedAt = new Date().toISOString();

      return res.json({
        message: isBookmarked ? 'Bookmark removed' : 'Bookmark added',
        bookmarks: user.bookmarkedSlokas,
      });
    }

    const { slokaId } = req.body;
    const user = await User.findByPk(req.user.id);

    if (user) {
      const isBookmarked = await user.hasBookmarkedSloka(slokaId);
      if (isBookmarked) {
        await user.removeBookmarkedSloka(slokaId);
      } else {
        await user.addBookmarkedSloka(slokaId);
      }
      const updatedUser = await User.findByPk(req.user.id, {
        include: [{ model: require('../models/Sloka'), as: 'bookmarkedSlokas' }],
      });
      return res.json({ message: isBookmarked ? 'Bookmark removed' : 'Bookmark added', bookmarks: updatedUser.bookmarkedSlokas });
    }
    return res.status(404).json({ message: 'User not found' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Get all users (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    if (isMockMode()) {
      const users = [...mockUsers]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .map(({ password, ...safeUser }) => safeUser);
      return res.json(users);
    }

    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
    });
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Delete a user account (Admin only)
exports.deleteUserByAdmin = async (req, res) => {
  try {
    const targetUserId = Number(req.params.id);
    if (!targetUserId) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    if (Number(req.user.id) === targetUserId) {
      return res.status(400).json({ message: 'You cannot delete your own admin account' });
    }

    if (isMockMode()) {
      const target = mockUsers.find((u) => Number(u.id) === targetUserId);
      if (!target) return res.status(404).json({ message: 'User not found' });
      if (target.role === 'admin') {
        return res.status(403).json({ message: 'Admin account deletion is blocked' });
      }

      mockUsers = mockUsers.filter((u) => Number(u.id) !== targetUserId);
      return res.json({ message: 'User deleted successfully' });
    }

    const target = await User.findByPk(targetUserId);
    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (target.role === 'admin') {
      return res.status(403).json({ message: 'Admin account deletion is blocked' });
    }

    await target.destroy();
    return res.json({ message: 'User deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Get stats (Admin only)
exports.getStats = async (req, res) => {
  try {
    if (isMockMode()) {
      const counts = mockContentStore.getCounts();
      const recentUsers = [...mockUsers]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 5)
        .map((u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt || new Date().toISOString() }));

      return res.json({
        totalUsers: mockUsers.length,
        totalMovies: counts.totalMovies,
        totalStories: counts.totalStories,
        totalVideos: counts.totalVideos,
        recentUsers,
      });
    }

    const userCount = await User.count();
    const movieCount = await require('../models/Movie').count();
    const storyCount = await require('../models/Story').count();
    const videoCount = await require('../models/Video').count();

    const recentUsers = await User.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'name', 'email', 'createdAt'],
    });

    return res.json({
      totalUsers: userCount,
      totalMovies: movieCount,
      totalStories: storyCount,
      totalVideos: videoCount,
      recentUsers,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Public community profiles (only users with public privacy)
exports.getCommunityProfiles = async (req, res) => {
  try {
    if (isMockMode()) {
      const community = mockUsers
        .filter((user) => user.role !== 'admin')
        .filter((user) => String(user?.settings?.privacy || 'public') === 'public')
        .map((user) => ({
          id: user.id,
          name: user.name,
          bio: user.bio || '',
          profilePicture: user.profilePicture || null,
          streak: user.streak || 0,
          benefits: user.benefits || { points: 0, badges: [] },
          settings: {
            privacy: 'public',
            interests: Array.isArray(user?.settings?.interests) ? user.settings.interests : [],
          },
        }));

      return res.json(community);
    }

    const users = await User.findAll({
      where: { role: 'user' },
      attributes: ['id', 'name', 'bio', 'profilePicture', 'streak', 'benefits', 'settings'],
      order: [['createdAt', 'DESC']],
    });

    const community = users
      .filter((user) => String(user?.settings?.privacy || 'public') === 'public')
      .map((user) => ({
        id: user.id,
        name: user.name,
        bio: user.bio || '',
        profilePicture: user.profilePicture || null,
        streak: user.streak || 0,
        benefits: user.benefits || { points: 0, badges: [] },
        settings: {
          privacy: 'public',
          interests: Array.isArray(user?.settings?.interests) ? user.settings.interests : [],
        },
      }));

    return res.json(community);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};