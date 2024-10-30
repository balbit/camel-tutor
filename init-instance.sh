#!/bin/bash

# Update package list and upgrade packages
sudo apt update && sudo apt upgrade -y

# Install NGINX
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Install Node.js, npm, and Express globally
curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g express
sudo npm install -g ws

# Install opam (OCaml package manager)
sudo apt install -y opam

# Initialize opam and create the initial environment
opam init -y --bare
# Adjust shell environment
eval $(opam env)

# Install the specific OCaml version required
opam switch create 5.2.0
eval $(opam env)

# Install essential OCaml libraries: core, core_bench, and utop
opam install -y core core_bench utop

# Set up `utop` interactive environment for OCaml
cat <<EOF > ~/.ocamlinit
#require "core.top";;
#require "ppx_jane";;
open Base;;
EOF

# Final check: display installed versions
echo "NGINX Version:"
nginx -v

echo "Node.js Version:"
node -v

echo "npm Version:"
npm -v

echo "Express Version:"
npm list -g express

echo "OCaml Version:"
ocaml -version

echo "Opam Version:"
opam --version

echo "Setup Complete!"