const bcrypt = require('bcryptjs');

async function generatePasswordHash() {
  const password = 'sga0303';
  const saltRounds = 12;
  
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('Password:', password);
    console.log('Hash:', hash);
    
    // 验证哈希
    const isValid = await bcrypt.compare(password, hash);
    console.log('Verification:', isValid);
  } catch (error) {
    console.error('Error:', error);
  }
}

generatePasswordHash();
