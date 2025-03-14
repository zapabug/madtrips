import { config } from 'dotenv';
import { execSync } from 'child_process';

// Load environment variables
config();

// Set git configuration
try {
  execSync(`git config --global user.name "${process.env.GIT_USERNAME}"`);
  execSync(`git config --global user.email "${process.env.GIT_EMAIL}"`);
  console.log('Git configuration updated successfully');
} catch (error) {
  console.error('Error updating git configuration:', error.message);
} 