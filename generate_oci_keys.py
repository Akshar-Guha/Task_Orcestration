
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
import os

# Create directory
keys_dir = os.path.join(os.getcwd(), 'oci_keys')
if not os.path.exists(keys_dir):
    os.makedirs(keys_dir)

print(f"Generating keys in {keys_dir}...")

# Generate private key
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
)

# Serialize private key
pem_private = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.TraditionalOpenSSL,
    encryption_algorithm=serialization.NoEncryption()
)

# Generate public key
public_key = private_key.public_key()
pem_public = public_key.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo
)

# Save Private Key
private_key_path = os.path.join(keys_dir, 'oci_api_key.pem')
with open(private_key_path, 'wb') as f:
    f.write(pem_private)

# Save Public Key
public_key_path = os.path.join(keys_dir, 'oci_api_key_public.pem')
with open(public_key_path, 'wb') as f:
    f.write(pem_public)

print("SUCCESS: Keys generated.")
print(f"Private Key: {private_key_path}")
print(f"Public Key: {public_key_path}")

print("\n=== COPY THIS PUBLIC KEY BELOW ===")
print(pem_public.decode('utf-8'))
print("==================================")
