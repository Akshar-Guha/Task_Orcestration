# 🦅 Oracle Cloud Deployment Guide (2025 UI)

Step-by-step guide with **exact button names and locations** for the current Oracle Cloud Console.

---

## � Phase 1: Create Oracle Cloud Account

1. Go to: **https://www.oracle.com/cloud/free/**
2. Click **"Start for free"**
3. Fill in:
   - Email → Your email
   - Country → India (or your country)
   - First/Last name
4. Verify email (check inbox, click link)
5. Set password (must be complex)
6. **Home Region**: Select **India South (Hyderabad)** or closest to you
   > ⚠️ You cannot change this later!
7. Add payment method (credit/debit card for verification only - you won't be charged)
8. Complete signup

---

## 🖥️ Phase 2: Create the Virtual Machine

### Step 2.1: Navigate to Instances
1. Log in at: **https://cloud.oracle.com/**
2. Click the **☰ hamburger menu** (3 horizontal lines, top-left corner)
3. Scroll down, click **Compute**
4. Click **Instances**

### Step 2.2: Click Create Instance
1. Click the blue **"Create instance"** button

### Step 2.3: Name Your Instance
1. Under **"Name"**: Type `goal-tracker-backend`
2. **Compartment**: Leave as default (root)

### Step 2.4: Placement (Skip)
- Leave defaults, no changes needed

### Step 2.5: Image and Shape (IMPORTANT!)

This is the most important section.

**Change the Operating System:**
1. Find the **"Image and shape"** section
2. Click **"Edit"** (right side of section header)
3. Click **"Change image"**
4. In the popup:
   - Find **"Canonical Ubuntu"** in the list
   - Click it to expand
   - Select **"Canonical Ubuntu 22.04"**
   - Check the box next to it
5. Click **"Select image"** (bottom right)

**Change the Shape (Get the FREE powerful one):**
1. Still in Image and shape, click **"Change shape"**
2. In the popup:
   - **Instance type**: Click **"Virtual machine"** (should be selected)
   - **Shape series**: Click **"Ampere"** (ARM processor - this is FREE tier!)
   - You'll see **"VM.Standard.A1.Flex"** appear
   - **Number of OCPUs**: Drag slider to **4**
   - **Amount of memory (GB)**: Drag slider to **24**
   > 📝 This gives you 4 CPUs and 24GB RAM - completely free forever!
3. Click **"Select shape"**

### Step 2.6: Networking

1. Find **"Primary VNIC information"** section
2. For **"Virtual cloud network"**:
   - If empty, click **"Create new virtual cloud network"**
   - Name: `goal-tracker-vcn`
3. For **"Subnet"**:
   - If empty, click **"Create new public subnet"**
   - Name: `goal-tracker-subnet`
4. **IMPORTANT**: Check ✅ **"Assign a public IPv4 address"**
   > Without this, you can't connect to the server!

### Step 2.7: SSH Keys (Your Password File)

1. Find **"Add SSH keys"** section
2. Select **"Generate a key pair for me"**
3. Click **"Save private key"** → A `.key` file downloads
4. Click **"Save public key"** → A `.pub` file downloads (optional backup)
5. **KEEP THESE FILES SAFE!** Move to: `C:\Users\YourName\.ssh\`
   > ⚠️ If you lose the private key, you lose access forever!

### Step 2.8: Boot Volume (Optional)

1. Find **"Boot volume"** section
2. You can increase **"Boot volume size (GB)"** to `100` or `200` if needed
   > Free tier allows up to 200GB total

### Step 2.9: Create!

1. Scroll to bottom
2. Click blue **"Create"** button
3. Wait 2-5 minutes for status to change from **🟡 PROVISIONING** to **🟢 RUNNING**

### Step 2.10: Get Your IP Address

1. Once RUNNING, look at the right side under **"Instance access"**
2. Find **"Public IP address"**: e.g., `129.154.xxx.xxx`
3. **Copy this IP** - you'll need it everywhere!

---

## 🔓 Phase 3: Open Firewall Ports

Your server blocks all internet traffic by default. Let's open the doors.

### Step 3.1: Go to Security List
1. On the Instance page, scroll down to **"Primary VNIC"** section
2. Click on the **Subnet** name (blue link like `subnet-2024...`)
3. On the Subnet page, find **"Security Lists"**
4. Click on the security list (like `Default Security List for goal-tracker-vcn`)

### Step 3.2: Add Ingress Rules
1. Click **"Add Ingress Rules"**
2. Fill in:
   
   | Field | Value |
   |-------|-------|
   | Source Type | CIDR |
   | Source CIDR | `0.0.0.0/0` |
   | IP Protocol | TCP |
   | Destination Port Range | `80,443,11434,42110` |
   | Description | Web, Ollama, Khoj |

3. Click **"Add Ingress Rules"**

> **What these ports do:**
> - 80: HTTP (web)
> - 443: HTTPS (secure web)
> - 11434: Ollama (AI model server)
> - 42110: Khoj (search engine)

---

## 💻 Phase 4: Connect to Your Server

### Windows Users (PowerShell)

1. Open **PowerShell** (search in Start menu)
2. Navigate to your key folder:
   ```powershell
   cd C:\Users\YourName\.ssh
   ```
3. Fix permissions on key file (required once):
   ```powershell
   icacls oracle.key /reset
   icacls oracle.key /grant:r "$($env:USERNAME):R"
   icacls oracle.key /inheritance:r
   ```
4. Connect:
   ```powershell
   ssh -i oracle.key ubuntu@YOUR_IP_ADDRESS
   ```
   Replace `YOUR_IP_ADDRESS` with the IP you copied earlier.

5. Type `yes` when asked about fingerprint
6. You're in when you see: `ubuntu@goal-tracker-backend:~$`

---

## 🛠️ Phase 5: Install Everything on Server

Copy-paste these commands into your terminal. Wait for each to finish before running the next.

### 5.1: Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 5.2: Install Required Packages
```bash
sudo apt install -y curl wget git python3-pip python3-venv nginx iptables-persistent
```
> Press Enter for any prompts about saving iptables rules

### 5.3: Open Linux Firewall
```bash
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 11434 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 42110 -j ACCEPT
sudo netfilter-persistent save
```

---

## 🤖 Phase 6: Install Ollama (AI Engine)

### 6.1: Install Ollama
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### 6.2: Download AI Models
```bash
ollama pull qwen2.5:7b
ollama pull nomic-embed-text
```
> This takes 10-20 minutes depending on internet speed

### 6.3: Make Ollama Listen on All Networks
```bash
sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo tee /etc/systemd/system/ollama.service.d/override.conf > /dev/null <<EOF
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_ORIGINS=*"
EOF
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

### 6.4: Test Ollama
Open your browser: `http://YOUR_IP:11434`

You should see: **"Ollama is running"**

---

## 🔍 Phase 7: Install Khoj (Search Engine)

### 7.1: Setup Python Environment
```bash
mkdir -p ~/khoj && cd ~/khoj
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install khoj-assistant
```

### 7.2: Create Auto-Start Service
```bash
sudo tee /etc/systemd/system/khoj.service > /dev/null <<EOF
[Unit]
Description=Khoj Search Engine
After=network.target ollama.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/khoj
ExecStart=/home/ubuntu/khoj/venv/bin/khoj --host 0.0.0.0 --port 42110
Restart=always
RestartSec=10
Environment="KHOJ_TELEMETRY_DISABLE=true"

[Install]
WantedBy=multi-user.target
EOF
```

### 7.3: Start Khoj
```bash
sudo systemctl daemon-reload
sudo systemctl enable khoj
sudo systemctl start khoj
```

### 7.4: Test Khoj
Open your browser: `http://YOUR_IP:42110`

You should see the Khoj web interface.

---

## 🔗 Phase 8: Update Your App Configuration

### Local Development (.env.local)
```env
OLLAMA_BASE_URL=http://YOUR_IP:11434
KHOJ_BASE_URL=http://YOUR_IP:42110
```

### Vercel Production
1. Go to: **https://vercel.com/dashboard**
2. Click your project
3. Go to **Settings** → **Environment Variables**
4. Update:
   - `OLLAMA_BASE_URL` = `http://YOUR_IP:11434`
   - `KHOJ_BASE_URL` = `http://YOUR_IP:42110`
5. Redeploy your app

---

## ✅ Phase 9: Verify Everything Works

| Service | Test URL | Expected Result |
|---------|----------|-----------------|
| Ollama | `http://YOUR_IP:11434` | "Ollama is running" |
| Khoj | `http://YOUR_IP:42110` | Khoj web interface |
| AI Test | `http://YOUR_IP:11434/api/tags` | JSON with model list |

---

## 🔧 Useful Commands

```bash
# Check if services are running
sudo systemctl status ollama
sudo systemctl status khoj

# View logs
sudo journalctl -u ollama -f
sudo journalctl -u khoj -f

# Restart services
sudo systemctl restart ollama
sudo systemctl restart khoj
```

---

## 💰 Cost Summary

| Resource | Oracle Free Tier |
|----------|------------------|
| 4 OCPU + 24GB RAM | ✅ FREE |
| 200GB Storage | ✅ FREE |
| 10TB/month Transfer | ✅ FREE |
| Public IP | ✅ FREE |

**Total: $0/month forever** (as long as you use Ampere A1 shape)
