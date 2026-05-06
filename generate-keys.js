const webpush = require('web-push');

const keys = webpush.generateVAPIDKeys();

console.log('===== VAPID KEYS =====');
console.log('Public Key Length:', keys.publicKey.length);
console.log('Private Key Length:', keys.privateKey.length);
console.log('');
console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('');
console.log('Store these in environment variables only.');
