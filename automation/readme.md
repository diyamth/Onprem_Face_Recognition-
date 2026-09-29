# Raspberry Pi 3B+ Setup for SMG ON-prem Face Detection and Identification
 
This repository provides step-by-step instructions to set up a Raspberry Pi 3B+ from scratch, build the required hardware circuit, and deploy Python + Bash script for controlling a **three signal tower light** with relay.
 
The setup is designed for **SMG ON-prem Face Detection and Identification**.
 
---
 
## 🚀 Features
 
* Complete Raspberry Pi 3B+ setup guide
* Circuit design with **three signal tower light, relay, and 24V adapter**
* Python script (`main.py`) to control GPIO pins and data transfer through ZMQ
* Systemd service (`smg-controller.service`) for persistent background running
 
---
 
## 🛠️ Hardware Requirements
 
* Raspberry Pi 3B+ board
* MicroSD card (16GB)(We have used 64GB sandisk memory card)
* Power supply (24V)
* HDMI cable + Monitor/TV
* USB keyboard and mouse
* Female-to-female jumper wires
* 24V Adapter
* 24V three signal tower light
* Relay module (24V - 4 channel)
 
---
 
## ⚡ Setup Instructions
 
### 1. Install Raspberry Pi OS
* Flash memory card with raspberry pi OS on linux device using rpi-imager
 
```bash
sudo apt update
sudo apt install rpi-imager
```
 
* Insert SD card → run `rpi-imager`
* Select:
 
  * **OS** → Raspberry Pi OS (32-bit recommended)
  * **Storage** → Your SD card
* Click **Write**
* Insert card into Raspberry Pi
 
---
 
### 2. Circuit Development
 
Connect Raspberry Pi GPIO to **raspberry pi → relay → three signal tower light** as per the wiring diagram.
 
 
![Image (2)](https://github.com/user-attachments/assets/9c22180c-463c-47f0-8865-00ca6c1c3025)
 
 
---
 
### 3. Python & Bash Setup
 
1. Configure username, password, and WiFi.
2. Install ssh and Tailscale in Raspberry pi:
 
   ```bash
   sudo apt update
   sudo apt install -y openssh-server
   sudo systemctl enable ssh
   sudo systemctl start ssh
   ```
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```
   * It will show a URL login using gmail
   * Get Pi’s private Tailscale IP
  ```bash
   tailscale ip -4
   ```
   * How to access Pi from your laptop(install tailscale at your laptop and login with same gmail)
 
```bash
   ssh username@100.92.14.7(IP)
   ```
  * Auto-start Tailscale on boot on Raspberry pi
```bash
   sudo systemctl enable tailscaled
   ```
4. Install dependencies:
   ```bash
   sudo apt install -y python3-venv python3-pip
   python35V 2.5A, micro-USB -m venv venv --system-site-packages
   pip3 install pyzmq RPi.GPIO
   ```
5. Create folder and venv:
   ```bash
   mkdir ~/smg
   cd ~/smg
   python3 -m venv venv
   source venv/bin/activate
   ```
### 4. Systemd Service Setup
 
1. Create systemd service file:
   ```bash
   sudo nano /etc/systemd/system/smg-controller.service
   ```
   Paste service content.
 
2. Enable & start service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable smg-controller.service
   sudo systemctl start smg-controller
   ```
 
3. Useful commands:
   ```bash
   systemctl status hooter.service
   journalctl -u smg-controller -f
   sudo systemctl stop smg-controller
   sudo systemctl restart smg-controller
   ```
 
---
