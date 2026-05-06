
import oci
import time
import sys
import datetime

# --- CONFIGURATION ---
CONFIG_FILE = "oci_config"  # Local file in current dir
KEYS_DIR = "oci_keys"
SSH_KEY_FILE = "oracle.key" # User's SSH public key for the instance (not API key)

# --- CONSTANTS ---
SHAPE = "VM.Standard.A1.Flex"
OCPUS = 4
MEMORY_GB = 24
DISPLAY_NAME = "goal-tracker-backend"

def load_config():
    try:
        # We assume the user pastes the config into 'oci_config' file in this directory
        # We need to fix the key_file path in that config to point to our absolute path
        with open(CONFIG_FILE, 'r') as f:
            content = f.read()
        
        # Simple parser to get dict
        config = {}
        for line in content.split('\n'):
            if "=" in line and not line.strip().startswith("#"):
                key, val = line.split('=', 1)
                config[key.strip()] = val.strip()
        
        # Update key_file to absolute path
        if 'key_file' in config:
            # If it's just a filename, prepend our keys_dir
            if not os.path.isabs(config['key_file']):
                 config['key_file'] = os.path.join(os.getcwd(), KEYS_DIR, os.path.basename(config['key_file']))
        
        # Validate critical fields
        required = ['user', 'fingerprint', 'tenancy', 'region', 'key_file']
        for r in required:
            if r not in config:
                print(f"ERROR: Config missing '{r}'")
                return None
                
        return config
    except Exception as e:
        print(f"Error loading config: {e}")
        return None

def get_ubuntu_image(compute_client, compartment_id, shape):
    print("Searching for Ubuntu 22.04 aarch64 image...")
    # List images
    images = compute_client.list_images(
        compartment_id,
        operating_system="Canonical Ubuntu",
        operating_system_version="22.04",
        shape=shape,
        sort_by="TIMECREATED",
        sort_order="DESC"
    ).data
    
    if not images:
        print("Error: No Ubuntu 22.04 image found for this shape.")
        return None
        
    print(f"Found Image: {images[0].display_name} ({images[0].id})")
    return images[0].id

def get_subnet(network_client, compartment_id):
    # Try to find an existing public subnet
    # Check VCNs first
    vcns = network_client.list_vcns(compartment_id).data
    if not vcns:
        print("Error: No VCN found. Please create a VCN and Subnet in Oracle Console first.")
        return None
        
    # Check Subnets in first VCN
    subnets = network_client.list_subnets(compartment_id, vcn_id=vcns[0].id).data
    if not subnets:
        print("Error: No Subnets found in VCN.")
        return None
        
    print(f"Using Subnet: {subnets[0].display_name}")
    return subnets[0].id

def main():
    if not os.path.exists(CONFIG_FILE):
        print(f"ERROR: '{CONFIG_FILE}' not found. Please paste your OCI Config Preview into this file.")
        return

    config = load_config()
    if not config:
        return

    # Initialize Clients
    try:
        oci.config.validate_config(config)
        compute_client = oci.core.ComputeClient(config)
        network_client = oci.core.VirtualNetworkClient(config)
        identity_client = oci.identity.IdentityClient(config)
    except Exception as e:
        print(f"Error initializing OCI clients: {e}")
        return

    # Verify ID
    user = identity_client.get_user(config['user']).data
    print(f"Authenticated as: {user.name}")
    
    compartment_id = config['tenancy'] # Usually we create in root, or ask user. Default to tenancy (root)
    
    # Get Resources
    image_id = get_ubuntu_image(compute_client, compartment_id, SHAPE)
    subnet_id = get_subnet(network_client, compartment_id)
    
    if not image_id or not subnet_id:
        print("Aborting due to missing resources.")
        return

    # Get Availability Domain
    ads = identity_client.list_availability_domains(compartment_id).data
    ad_name = ads[0].name # Hyderabad usually has 1 AD (AD-1)
    print(f"Targeting AD: {ad_name}")

    # Launch Loop
    print("\n--- STARTING RETRY LOOP ---")
    print("Press Ctrl+C to stop.")
    
    attempts = 0
    while True:
        attempts += 1
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        sys.stdout.write(f"[{timestamp}] Attempt #{attempts}: Launching... ")
        sys.stdout.flush()
        
        try:
            launch_details = oci.core.models.LaunchInstanceDetails(
                display_name=DISPLAY_NAME,
                compartment_id=compartment_id,
                availability_domain=ad_name,
                shape=SHAPE,
                shape_config=oci.core.models.LaunchInstanceShapeConfigDetails(
                    ocpus=OCPUS,
                    memory_in_gbs=MEMORY_GB
                ),
                source_details=oci.core.models.InstanceSourceViaImageDetails(
                    source_type="image",
                    image_id=image_id
                ),
                create_vnic_details=oci.core.models.CreateVnicDetails(
                    subnet_id=subnet_id,
                    assign_public_ip=True
                ),
                metadata={
                    "ssh_authorized_keys": "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJyi/3gJlTePHT8lYr/GHykbcCJ9YPTRSX3g93ZOe3Pu umbra.0004@gmail.com"
                }
            )
            
            resp = compute_client.launch_instance(launch_details)
            instance = resp.data
            print(f"\nSUCCESS!!! Instance Created: {instance.id}")
            print("Check Oracle Console immediately!")
            break
            
        except oci.exceptions.ServiceError as e:
            if e.status == 500 and "Out of capacity" in str(e):
                print("Failed (Out of Capacity). Retrying in 60s...")
            elif e.status == 429:
                print("Failed (Too Many Requests). Retrying in 60s...")
            else:
                print(f"\nError: {e.message}")
                # Don't break on all errors, but maybe pause longer
        except Exception as e:
            print(f"\nUnexpected Error: {e}")
            
        time.sleep(60)

if __name__ == "__main__":
    import os
    main()
