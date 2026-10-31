import express from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import Event from '../models/Event.js';
import Payment from '../models/Payment.js';
import EventRegistration from '../models/EventRegistration.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { cleanupExpiredEvents, isEventExpired } from '../services/eventCleanupService.js';

const router = express.Router();

// Helper to check if Razorpay is configured
const getRazorpayInstance = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  
  if (keyId && keySecret && 
      keyId !== 'your_razorpay_key_id_here' && 
      keySecret !== 'your_razorpay_key_secret_here') {
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return null;
};


// @route   POST /api/events
// @desc    Create a new event (Faculty/Admin only)
router.post('/', verifyToken, requireRole('faculty', 'admin'), async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      organizer,
      venue,
      eventDate,
      startTime,
      endTime,
      registrationDeadline,
      maxParticipants,
      image,
      isPaid,
      registrationFee,
      rules,
      contactInformation
    } = req.body;

    const event = await Event.create({
      title,
      description,
      category,
      organizer,
      venue,
      eventDate,
      startTime,
      endTime,
      registrationDeadline,
      maxParticipants: Number(maxParticipants) || 0,
      image,
      isPaid: isPaid === 'true' || isPaid === true,
      registrationFee: isPaid ? Number(registrationFee) || 0 : 0,
      rules,
      contactInformation,
      createdBy: req.user.id
    });

    const populatedEvent = await Event.findById(event._id).populate('createdBy', 'name role email');

    res.status(201).json({
      status: 'success',
      event: populatedEvent
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   GET /api/events
// @desc    Get all active, non-expired events with search and filters
router.get('/', verifyToken, async (req, res) => {
  try {
    // Run background cleanup asynchronously to keep database updated
    cleanupExpiredEvents().catch(err => console.error('[EventCleanup] Async check failed:', err.message));

    const { search, category, isPaid } = req.query;

    const filter = { status: 'Active' };

    if (category) filter.category = category;
    
    if (isPaid === 'true') {
      filter.isPaid = true;
    } else if (isPaid === 'false') {
      filter.isPaid = false;
    }

    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    const eventsList = await Event.find(filter)
      .populate('createdBy', 'name role email')
      .sort({ eventDate: 1 });

    // Exclude any events that have concluded
    const activeEvents = eventsList.filter(evt => !isEventExpired(evt));

    res.json({
      status: 'success',
      count: activeEvents.length,
      events: activeEvents
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   POST /api/events/cleanup
// @desc    Manually trigger cleanup of expired events (Faculty/Admin only)
router.post('/cleanup', verifyToken, requireRole('faculty', 'admin'), async (req, res) => {
  try {
    const { hardDelete, deleteUnregistered } = req.body;
    const result = await cleanupExpiredEvents({
      hardDelete: hardDelete === true,
      deleteUnregistered: deleteUnregistered !== false
    });

    res.json({
      status: 'success',
      message: 'Expired events cleanup completed.',
      result
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   GET /api/events/registrations/my
// @desc    Get current user's registered events log
router.get('/registrations/my', verifyToken, async (req, res) => {
  try {
    const registrations = await EventRegistration.find({ user: req.user.id })
      .populate('event')
      .populate('payment')
      .sort({ registeredAt: -1 });

    res.json({
      status: 'success',
      registrations
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   GET /api/events/registrations/all
// @desc    Get all registered users across events (Admin & Faculty only)
router.get('/registrations/all', verifyToken, requireRole('admin', 'faculty'), async (req, res) => {
  try {
    const { eventId } = req.query;
    const filter = {};
    if (eventId) {
      filter.event = eventId;
    }

    const rawRegistrations = await EventRegistration.find(filter)
      .populate('user', 'name email registerNumber department year section role')
      .populate('event', 'title category eventDate venue isPaid registrationFee status')
      .populate('payment', 'amount status razorpayOrderId razorpayPaymentId createdAt')
      .sort({ registeredAt: -1, createdAt: -1 });

    // Ensure only populated, valid records are returned
    const registrations = rawRegistrations.filter(r => r.user && r.event);

    res.json({
      status: 'success',
      count: registrations.length,
      registrations
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Middleware to restrict event registration actions strictly to students
const requireStudent = (req, res, next) => {
  if (req.user?.role !== 'student') {
    return res.status(403).json({
      status: 'error',
      message: 'Only students can register for events'
    });
  }
  next();
};

// @route   POST /api/events/register/free/:eventId
// @desc    Direct registration for a free event (Students only)
router.post('/register/free/:eventId', verifyToken, requireStudent, async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ status: 'error', message: 'Event not found' });
    }

    if (event.isPaid) {
      return res.status(400).json({ status: 'error', message: 'This event is paid. Please complete payment.' });
    }

    if (new Date() > new Date(event.registrationDeadline)) {
      return res.status(400).json({ status: 'error', message: 'Registration deadline has passed' });
    }

    // Check if already registered
    const existingReg = await EventRegistration.findOne({ event: eventId, user: req.user.id });
    if (existingReg) {
      return res.status(400).json({ status: 'error', message: 'You have already registered for this event.' });
    }

    // Create registration
    const registration = await EventRegistration.create({
      event: eventId,
      user: req.user.id,
      registrationStatus: 'Confirmed'
    });

    res.status(201).json({
      status: 'success',
      message: 'Registered successfully!',
      registration
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   POST /api/events/register/pay-order/:eventId
// @desc    Create Razorpay Order for a paid event (Students only)
router.post('/register/pay-order/:eventId', verifyToken, requireStudent, async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ status: 'error', message: 'Event not found' });
    }

    if (!event.isPaid) {
      return res.status(400).json({ status: 'error', message: 'This is a free event.' });
    }

    // Check if already registered/confirmed
    const existingReg = await EventRegistration.findOne({ event: eventId, user: req.user.id });
    if (existingReg && existingReg.registrationStatus === 'Confirmed') {
      return res.status(400).json({ status: 'error', message: 'You are already registered.' });
    }

    const amountInPaise = Math.round(event.registrationFee * 100);
    const currency = 'INR';

    let orderId = '';
    const razorpay = getRazorpayInstance();

    if (razorpay) {
      // Create actual Razorpay Order using SDK
      const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency,
        receipt: `event_rec_${eventId.toString().slice(-4)}_${req.user.id.toString().slice(-4)}`
      });
      orderId = order.id;
    } else {
      // Fallback: Generate mock order ID
      orderId = `mock_order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }

    // Create Payment log record
    const payment = await Payment.create({
      user: req.user.id,
      event: eventId,
      razorpayOrderId: orderId,
      amount: event.registrationFee,
      currency,
      status: 'Pending'
    });

    // Create / Update pending registration log
    await EventRegistration.findOneAndUpdate(
      { event: eventId, user: req.user.id },
      { registrationStatus: 'Pending', payment: payment._id },
      { upsert: true, new: true }
    );

    res.json({
      status: 'success',
      isMock: !razorpay,
      keyId: process.env.RAZORPAY_KEY_ID || 'mock_key_id',
      orderId,
      amount: amountInPaise,
      currency,
      eventName: event.title,
      userName: req.user.name,
      userEmail: req.user.email
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   POST /api/events/register/verify-payment
// @desc    Verify Razorpay signature server-side (Students only)
router.post('/register/verify-payment', verifyToken, requireStudent, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, eventId } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !eventId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing payment signature verification parameters'
      });
    }

    const razorpay = getRazorpayInstance();
    let isSignatureValid = false;

    if (razorpay) {
      // Cryptographic signature check for actual Razorpay integration
      const body = razorpayOrderId + '|' + razorpayPaymentId;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

      isSignatureValid = (expectedSignature === razorpaySignature);
    } else {
      // Mock gateway validation: check signature matches simulated format
      const mockSignature = `mock_sig_for_${razorpayOrderId}`;
      isSignatureValid = (mockSignature === razorpaySignature);
    }

    if (!isSignatureValid) {
      // Mark payment as Failed
      await Payment.findOneAndUpdate(
        { razorpayOrderId },
        { status: 'Failed', razorpayPaymentId, razorpaySignature }
      );
      return res.status(400).json({
        status: 'error',
        message: 'Payment verification failed: invalid signature.'
      });
    }

    // Success paths: update payment logs
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId },
      { status: 'Completed', razorpayPaymentId, razorpaySignature },
      { new: true }
    );

    // Confirm student event registration log
    const registration = await EventRegistration.findOneAndUpdate(
      { event: eventId, user: req.user.id },
      { registrationStatus: 'Confirmed', payment: payment._id },
      { new: true }
    );

    res.json({
      status: 'success',
      message: 'Payment verified and registration confirmed!',
      registration
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   DELETE /api/events/:id
// @desc    Delete event listing (Faculty/Admin only)
router.delete('/:id', verifyToken, requireRole('faculty', 'admin'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ status: 'error', message: 'Event not found' });
    }

    await event.deleteOne();
    res.json({ status: 'success', message: 'Event deleted successfully.' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

export default router;
