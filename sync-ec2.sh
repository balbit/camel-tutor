#!/bin/bash

# Define default sync flags
SYNC_TS=false
SYNC_CSS=false
SYNC_ASSETS=false
SYNC_NGINX=false
SYNC_HTML=false

# If no parameters are provided, sync everything
if [ "$#" -eq 0 ]; then
    SYNC_TS=true
    SYNC_CSS=true
    SYNC_ASSETS=true
    SYNC_NGINX=true
    SYNC_HTML=true
else
    # Parse arguments to set sync flags
    for arg in "$@"; do
        case $arg in
            ts)
                SYNC_TS=true
                ;;
            css)
                SYNC_CSS=true
                ;;
            assets)
                SYNC_ASSETS=true
                ;;
            nginx)
                SYNC_NGINX=true
                ;;
            html)
                SYNC_HTML=true
                ;;
            *)
                echo "Invalid option: $arg"
                echo "Usage: $0 [ts] [css] [assets] [nginx] [html]"
                exit 1
                ;;
        esac
    done
fi

# Compile TypeScript files to JavaScript and sync if SYNC_TS is true
if [ "$SYNC_TS" = true ]; then
    echo "Compiling TypeScript files..."
    npx tsc
    echo "Syncing JavaScript files to EC2..."
    rsync -avz -e "ssh -i camel-tutor-micro-key.pem" dist/*.js ubuntu@3.128.118.239:/var/www/html/js/
fi

# Sync CSS files to EC2 if SYNC_CSS is true
if [ "$SYNC_CSS" = true ]; then
    echo "Syncing CSS files to EC2..."
    rsync -avz -e "ssh -i camel-tutor-micro-key.pem" src/css/*.css ubuntu@3.128.118.239:/var/www/html/js/
fi

# Sync assets to EC2 if SYNC_ASSETS is true
if [ "$SYNC_ASSETS" = true ]; then
    echo "Syncing assets to EC2..."
    rsync -avz -e "ssh -i camel-tutor-micro-key.pem" src/assets/* ubuntu@3.128.118.239:/var/www/html/js/
fi

if [ "$SYNC_HTML" = true ]; then
    echo "Syncing HTML files to EC2..."
    rsync -avz -e "ssh -i camel-tutor-micro-key.pem" src/html/* ubuntu@3.128.118.239:/var/www/html/
fi

# Sync NGINX configuration to EC2 and restart NGINX if SYNC_NGINX is true
if [ "$SYNC_NGINX" = true ]; then
    echo "Syncing NGINX configuration to EC2..."
    rsync -avz -e "ssh -i camel-tutor-micro-key.pem" nginx-camel.conf ubuntu@3.128.118.239:/etc/nginx/sites-available/camel-tutor
    echo "Restarting NGINX on EC2..."
    ssh -i camel-tutor-micro-key.pem ubuntu@3.128.118.239 "sudo systemctl restart nginx"
fi

echo "EC2 sync complete!"
