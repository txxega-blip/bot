apt update && apt full-upgrade -y
apt install kali-tools-top10 -y
echo "deb http://http.kali.org/kali kali-rolling main contrib non-free non-free-firmware" > /etc/apt/sources.list.d/kali.list
wget -q -O - https://archive.kali.org/archive-key.asc | gpg --dearmor > /etc/apt/trusted.gpg.d/kali.gpg
wget -q -O - https://archive.kali.org/archive-key.asc | gpg --dearmor > /etc/apt/trusted.gpg.d/kali.gpg
