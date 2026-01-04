const webpush = require('web-push');
const fs = require('fs');

const keys = webpush.generateVAPIDKeys();

console.log('===== VAPID KEYS =====');
console.log('Public Key Length:', keys.publicKey.length);
console.log('Private Key Length:', keys.privateKey.length);
console.log('');
console.log('PUBLIC_KEY=' + keys.publicKey);
console.log('');
console.log('PRIVATE_KEY=' + keys.privateKey);

// Also save to file
fs.writeFileSync('vapid-keys.txt', 
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY=' + keys.publicKey + '\n' + 
  'VAPID_PRIVATE_KEY=' + keys.privateKey + '\n'
);
console.log('');
console.log('Keys saved to vapid-keys.txt');
