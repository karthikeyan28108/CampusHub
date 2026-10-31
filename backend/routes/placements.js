import express from 'express';
import Placement from '../models/Placement.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/placements
// @desc    Create a new placement drive listing (Admin only)
router.post('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      companyName,
      jobRole,
      description,
      eligibility,
      departments,
      minimumCGPA,
      backlogRequirement,
      salary,
      location,
      applicationLink,
      deadline,
      requiredSkills,
      selectionProcess
    } = req.body;

    const placement = await Placement.create({
      companyName,
      jobRole,
      description,
      eligibility,
      departments: Array.isArray(departments) ? departments : [departments],
      minimumCGPA: Number(minimumCGPA) || 0,
      backlogRequirement: backlogRequirement === 'true' || backlogRequirement === true,
      salary,
      location,
      applicationLink,
      deadline,
      requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : (requiredSkills ? requiredSkills.split(',').map(s => s.trim()) : []),
      selectionProcess,
      createdBy: req.user.id
    });

    const populatedPlacement = await Placement.findById(placement._id).populate('createdBy', 'name role email');

    res.status(201).json({
      status: 'success',
      placement: populatedPlacement
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   PUT /api/placements/:id
// @desc    Edit a placement listing (Admin only)
router.put('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      companyName,
      jobRole,
      description,
      eligibility,
      departments,
      minimumCGPA,
      backlogRequirement,
      salary,
      location,
      applicationLink,
      deadline,
      requiredSkills,
      selectionProcess,
      status
    } = req.body;

    const placement = await Placement.findById(req.params.id);
    if (!placement) {
      return res.status(404).json({
        status: 'error',
        message: 'Placement listing not found'
      });
    }

    // Update fields
    if (companyName) placement.companyName = companyName;
    if (jobRole) placement.jobRole = jobRole;
    if (description) placement.description = description;
    if (eligibility) placement.eligibility = eligibility;
    if (departments) placement.departments = Array.isArray(departments) ? departments : [departments];
    if (minimumCGPA !== undefined) placement.minimumCGPA = Number(minimumCGPA);
    if (backlogRequirement !== undefined) placement.backlogRequirement = backlogRequirement === 'true' || backlogRequirement === true;
    if (salary) placement.salary = salary;
    if (location) placement.location = location;
    if (applicationLink) placement.applicationLink = applicationLink;
    if (deadline) placement.deadline = deadline;
    if (requiredSkills) placement.requiredSkills = Array.isArray(requiredSkills) ? requiredSkills : requiredSkills.split(',').map(s => s.trim());
    if (selectionProcess) placement.selectionProcess = selectionProcess;
    if (status) placement.status = status;

    await placement.save();
    
    const populatedPlacement = await Placement.findById(placement._id).populate('createdBy', 'name role email');

    res.json({
      status: 'success',
      placement: populatedPlacement
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   DELETE /api/placements/:id
// @desc    Delete a placement listing (Admin only)
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const placement = await Placement.findById(req.params.id);
    if (!placement) {
      return res.status(404).json({
        status: 'error',
        message: 'Placement listing not found'
      });
    }

    await placement.deleteOne();

    res.json({
      status: 'success',
      message: 'Placement drive listing deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   GET /api/placements
// @desc    Get all placement listings with filtering
router.get('/', verifyToken, async (req, res) => {
  try {
    const { department, search, status } = req.query;
    
    const filter = {};
    
    // Status filter (Open by default if not specified, or show all if requested)
    if (status) {
      if (status !== 'All') {
        filter.status = status;
      }
    } else {
      filter.status = 'Open';
    }

    // Filter by department (checks if the department string is inside the departments array)
    if (department) {
      filter.departments = department;
    }

    // Search query on companyName or jobRole
    if (search) {
      filter.$or = [
        { companyName: new RegExp(search, 'i') },
        { jobRole: new RegExp(search, 'i') }
      ];
    }

    const placements = await Placement.find(filter)
      .populate('createdBy', 'name role email')
      .sort({ createdAt: -1 });

    res.json({
      status: 'success',
      count: placements.length,
      placements
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   GET /api/placements/:id
// @desc    Get details of a single placement
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const placement = await Placement.findById(req.params.id).populate('createdBy', 'name role email');
    if (!placement) {
      return res.status(404).json({
        status: 'error',
        message: 'Placement listing not found'
      });
    }

    res.json({
      status: 'success',
      placement
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

export default router;
