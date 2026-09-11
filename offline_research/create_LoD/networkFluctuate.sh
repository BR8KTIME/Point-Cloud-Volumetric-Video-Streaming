#!/bin/bash

IFACE="enp6s0"

sleep 3
echo "Begin"

# 1. SETUP: Clean old rules and create the root handle
# (We silence errors just in case there were no rules to delete)
sudo tc qdisc del dev enp6s0 root 2> /dev/null
sudo tc qdisc add dev enp6s0 root handle 1: htb default 1

sudo tc class add dev enp6s0 parent 1: classid 1:1 htb rate 200mbit
echo "Network Initialized: 200 Mbps"
    
sleep 4

# Simulate the bottleneck
echo "📉 CRASHING Network -> 100 Mbps"
# Note: We use 'replace' or 'change' to update the existing rule
sudo tc class change dev enp6s0 parent 1: classid 1:1 htb rate 100mbit
# Optional: You can add 'netem' here for packet loss if you want extra difficulty
# sudo tc qdisc add dev $IFACE parent 1:1 handle 10: netem delay 100ms loss 2%

sleep 4

# Simulate the bottleneck
echo "📉 CRASHING Network -> 60 Mbps"
# Note: We use 'replace' or 'change' to update the existing rule
sudo tc class change dev enp6s0 parent 1: classid 1:1 htb rate 60mbit
# Optional: You can add 'netem' here for packet loss if you want extra difficulty
# sudo tc qdisc add dev $IFACE parent 1:1 handle 10: netem delay 100ms loss 2%

sleep 4

# Simulate the bottleneck
echo "📉 CRASHING Network -> 30 Mbps"
# Note: We use 'replace' or 'change' to update the existing rule
sudo tc class change dev enp6s0 parent 1: classid 1:1 htb rate 30mbit
# Optional: You can add 'netem' here for packet loss if you want extra difficulty
# sudo tc qdisc add dev $IFACE parent 1:1 handle 10: netem delay 100ms loss 2%

sleep 4

echo "📈 RECOVERING Network -> 90 Mbps"
# Remove the netem loss rule if you added it above
# sudo tc qdisc del dev $IFACE parent 1:1 2> /dev/null
sudo tc class change dev enp6s0 parent 1: classid 1:1 htb rate 90mbit

sleep 4

echo "📈 RECOVERING Network -> 160 Mbps"
# Remove the netem loss rule if you added it above
# sudo tc qdisc del dev $IFACE parent 1:1 2> /dev/null
sudo tc class change dev enp6s0 parent 1: classid 1:1 htb rate 160mbit

sleep 4

echo "📈 RECOVERING Network -> 200 Mbps"
# Remove the netem loss rule if you added it above
# sudo tc qdisc del dev $IFACE parent 1:1 2> /dev/null
sudo tc class change dev enp6s0 parent 1: classid 1:1 htb rate 200mbit

sleep 10

# 5. CLEANUP
echo "🏁 TEST COMPLETE. Resetting network."
sudo tc qdisc del dev enp6s0 root
