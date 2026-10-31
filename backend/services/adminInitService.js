import User from '../models/User.js';

/**
 * Initializes and guarantees the existence of exactly ONE system administrator.
 * Designated credentials:
 *   Email / Username: admin@campushub.edu.com
 *   Initial Password: Admin@CampusHub#2026!
 * 
 * If the admin changes their password (via Forgot Password or account update),
 * this function preserves their updated password without overwriting it.
 */
export const initializeSingleAdmin = async () => {
  try {
    const adminEmail = 'admin@campushub.edu.com'.toLowerCase();
    const defaultPassword = 'Admin@CampusHub#2026!';

    // Find the designated admin by email
    let designatedAdmin = await User.findOne({ email: adminEmail });

    if (designatedAdmin) {
      if (designatedAdmin.role !== 'admin') {
        designatedAdmin.role = 'admin';
        await designatedAdmin.save();
      }
      console.log(`[Admin] Verified single admin account: ${adminEmail}`);
    } else {
      // Create the primary designated admin
      designatedAdmin = await User.create({
        name: 'System Administrator',
        email: adminEmail,
        password: defaultPassword,
        role: 'admin',
        department: 'Administration',
        isActive: true
      });
      console.log(`[Admin] Single Admin account created successfully!`);
      console.log(`[Admin] Username/Email: ${adminEmail}`);
      console.log(`[Admin] Initial Password: ${defaultPassword}`);
    }

    // Strict 1-Admin Policy: Ensure no other user holds the 'admin' role
    const otherAdmins = await User.find({
      role: 'admin',
      email: { $ne: adminEmail }
    });

    if (otherAdmins.length > 0) {
      console.log(`[Admin] Demoting ${otherAdmins.length} unauthorized admin accounts to uphold single-admin policy.`);
      await User.updateMany(
        { role: 'admin', email: { $ne: adminEmail } },
        { $set: { role: 'student' } }
      );
    }
  } catch (error) {
    console.error('[Admin] Error initializing single admin account:', error.message);
  }
};

