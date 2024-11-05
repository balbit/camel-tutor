#!/bin/bash

# Compile TypeScript files to JavaScript
npx tsc

# Sync JavaScript files to NGINX static file directory
sudo cp dist/src/ts/*.js /usr/local/var/www/js/
sudo cp src/css/* /usr/local/var/www/js/
sudo cp src/assets/* /usr/local/var/www/js/
sudo cp src/html/* /usr/local/var/www/

# Sync NGINX configuration
sudo cp nginx.conf /opt/homebrew/etc/nginx/nginx.conf

# Restart NGINX
sudo nginx -s reload

echo "Local sync and NGINX restart complete!"
