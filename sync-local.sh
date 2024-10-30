#!/bin/bash

# Compile TypeScript files to JavaScript
npx tsc

# Sync JavaScript files to NGINX static file directory
sudo cp dist/*.js /usr/local/var/www/js/

# Sync NGINX configuration
sudo cp nginx.conf /opt/homebrew/etc/nginx/nginx.conf

# Restart NGINX
sudo nginx -s reload

echo "Local sync and NGINX restart complete!"
