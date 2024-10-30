#!/bin/bash

# Compile TypeScript files to JavaScript
npx tsc

# Sync JavaScript files to EC2
rsync -avz -e "ssh -i camel-tutor-micro-key.pem" dist/*.js ubuntu@3.128.118.239:/var/www/html/js/

# Sync NGINX configuration file to EC2
rsync -avz -e "ssh -i camel-tutor-micro-key.pem" nginx-camel.conf ubuntu@3.128.118.239:/etc/nginx/sites-available/camel-tutor

# Restart NGINX on EC2
ssh -i camel-tutor-micro-key.pem ubuntu@3.128.118.239 "sudo systemctl restart nginx"

echo "EC2 sync and NGINX restart complete!"
