#!/bin/bash

# Configuration variables
REMOTE_HOST="ubuntu@3.128.118.239"
REMOTE_PATH="/home/ubuntu/docker"
DOCKERFILE_PATH="./src/docker/Dockerfile"
KEY_PATH="camel-tutor-micro-key.pem"
IMAGE_NAME="ocaml-utop"

# Step 1: Copy Dockerfile to remote server
echo "Syncing Dockerfile to EC2..."
rsync -avz -e "ssh -i $KEY_PATH" $DOCKERFILE_PATH $REMOTE_HOST:$REMOTE_PATH/Dockerfile

# Step 2: Prompt for confirmation to build the image on remote
read -p "Dockerfile synced. Do you want to build the Docker image on the remote server? (y/n): " confirm

if [ "$confirm" == "y" ]; then
    echo "Building Docker image on EC2..."
    ssh -i $KEY_PATH $REMOTE_HOST "cd $REMOTE_PATH && sudo docker build -t $IMAGE_NAME ."
    echo "Docker image '$IMAGE_NAME' built on remote server."
else
    echo "Build canceled by user."
fi
