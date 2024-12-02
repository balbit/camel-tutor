#!/bin/bash

# Define default sync flags
SYNC_TS=false
SYNC_CSS=false
SYNC_ASSETS=false
SYNC_NGINX=false
SYNC_HTML=false
SYNC_QUESTIONS=false
SYNC_SERVER=false
SYNC_SEARCH=false

# If no parameters are provided, sync everything
if [ "$#" -eq 0 ]; then
    SYNC_TS=true
    SYNC_CSS=true
    SYNC_ASSETS=true
    SYNC_NGINX=true
    SYNC_HTML=true
    SYNC_QUESTIONS=true
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
            server)
                SYNC_SERVER=true
                ;;
            search)
                SYNC_SEARCH=true
                ;;
            questions)
                SYNC_QUESTIONS=true
                ;;
            q)
                SYNC_QUESTIONS=true
                ;;
            *)
                echo "Invalid option: $arg"
                echo "Usage: $0 [ts] [css] [assets] [nginx] [html] [server] [questions] [search]"
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
    rsync -avz -e "ssh -i camel-tutor-micro-key.pem" dist/src/ts/*.js ubuntu@3.128.118.239:/var/www/html/js/
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

if [ "$SYNC_QUESTIONS" = true ]; then
    echo "Syncing questions to EC2..."
    rsync -avz -e "ssh -i camel-tutor-micro-key.pem" questions/*.json ubuntu@3.128.118.239:/home/ubuntu/server/questions/
fi

if [ "$SYNC_SERVER" = true ]; then
    echo "Building the project..."
    npm run build:server

    echo "Ensuring server directory exists on EC2..."
    ssh -i camel-tutor-micro-key.pem ubuntu@3.128.118.239 "mkdir -p /home/ubuntu/server/"

    echo "Syncing compiled server files to EC2..."
    rsync -avz -e "ssh -i camel-tutor-micro-key.pem" dist-server/ ubuntu@3.128.118.239:/home/ubuntu/server/

    echo "Installing dependencies on EC2..."
    ssh -i camel-tutor-micro-key.pem ubuntu@3.128.118.239 "cd /home/ubuntu/server && npm install --production"

    echo "Restarting server on EC2..."
    ssh -i camel-tutor-micro-key.pem ubuntu@3.128.118.239 "pm2 restart camel-tutor || pm2 start /home/ubuntu/server/server.js --name camel-tutor"
fi

if [ "$SYNC_SEARCH" = true ]; then
    echo "Ensuring Python server directory exists on EC2..."
    ssh -i camel-tutor-micro-key.pem ubuntu@3.128.118.239 "mkdir -p /home/ubuntu/python-server/ && mkdir -p /home/ubuntu/python-server/index/"

    echo "Syncing Python server files to EC2..."
    rsync -avz -e "ssh -i camel-tutor-micro-key.pem" src/python-server/ ubuntu@3.128.118.239:/home/ubuntu/python-server/
    rsync -avz -e "ssh -i camel-tutor-micro-key.pem" index/ ubuntu@3.128.118.239:/home/ubuntu/python-server/index/

    echo "Installing Python dependencies on EC2..."
    ssh -i camel-tutor-micro-key.pem ubuntu@3.128.118.239 "cd /home/ubuntu/python-server && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"

    echo "Restarting Python server on EC2..."
    ssh -i camel-tutor-micro-key.pem ubuntu@3.128.118.239 "
        cd /home/ubuntu/python-server &&
        source venv/bin/activate &&
        pm2 restart python-server || pm2 start python3 --name python-server -- python-server.py
    "

    echo "Python server restarted successfully."
fi

# Sync NGINX configuration to EC2 and restart NGINX if SYNC_NGINX is true
if [ "$SYNC_NGINX" = true ]; then
    echo "Syncing NGINX configuration to EC2..."
    rsync -avz -e "ssh -i camel-tutor-micro-key.pem" nginx-camel.conf ubuntu@3.128.118.239:/etc/nginx/sites-available/camel-tutor
    echo "Restarting NGINX on EC2..."
    ssh -i camel-tutor-micro-key.pem ubuntu@3.128.118.239 "sudo systemctl restart nginx"
fi

echo "EC2 sync complete!"
