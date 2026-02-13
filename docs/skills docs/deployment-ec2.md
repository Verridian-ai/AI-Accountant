> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# EC2 Deployment

> Deploy Cognee on Amazon EC2 for traditional cloud server deployments with custom configurations

# EC2 Deployment

Deploy Cognee on Amazon EC2 for traditional cloud server deployments with full control over the infrastructure and custom configurations.

<Info>
  EC2 deployment is ideal for organizations that need direct server access, custom networking, or integration with existing AWS infrastructure.
</Info>

## Why EC2?

<CardGroup cols={2}>
  <Card title="Full Control" icon="settings">
    Complete control over server configuration, networking, and security
  </Card>

  <Card title="AWS Integration" icon="aws">
    Native integration with AWS services like RDS, S3, and VPC
  </Card>

  <Card title="Cost Predictable" icon="dollar-sign">
    Fixed costs with reserved instances and predictable billing
  </Card>

  <Card title="Custom Networking" icon="network">
    Advanced networking configurations and security groups
  </Card>
</CardGroup>

## Prerequisites

<Steps>
  <Step title="AWS Account">
    * Active AWS account with EC2 permissions
    * AWS CLI installed and configured
    * Key pair created for SSH access
  </Step>

  <Step title="Network Setup">
    * VPC with public/private subnets
    * Security groups configured for HTTP/HTTPS traffic
    * Internet Gateway for public access
  </Step>

  <Step title="Domain & SSL">
    * Domain name (optional but recommended)
    * SSL certificate (Let's Encrypt or AWS Certificate Manager)
  </Step>
</Steps>

## Instance Configuration

<Tabs>
  <Tab title="Development">
    **Small Scale Setup**

    * **Instance Type**: `t3.medium` (2 vCPU, 4GB RAM)
    * **Storage**: 20GB GP3 SSD
    * **OS**: Ubuntu 22.04 LTS
    * **Databases**: Local SQLite, embedded vector DB
  </Tab>

  <Tab title="Production">
    **Production Ready**

    * **Instance Type**: `m5.xlarge` (4 vCPU, 16GB RAM)
    * **Storage**: 100GB GP3 SSD + EBS volumes for data
    * **OS**: Ubuntu 22.04 LTS
    * **Databases**: External RDS, managed vector DB
  </Tab>

  <Tab title="High Performance">
    **Large Scale Processing**

    * **Instance Type**: `c5.4xlarge` (16 vCPU, 32GB RAM)
    * **Storage**: 500GB GP3 SSD + dedicated EBS volumes
    * **OS**: Ubuntu 22.04 LTS
    * **Databases**: Multi-AZ RDS, clustered databases
  </Tab>
</Tabs>

## Quick Deployment

<Steps>
  <Step title="Launch EC2 Instance">
    ```bash  theme={null}
    # Using AWS CLI
    aws ec2 run-instances \
      --image-id ami-0c02fb55956c7d316 \
      --instance-type t3.medium \
      --key-name your-key-pair \
      --security-group-ids sg-12345678 \
      --subnet-id subnet-12345678 \
      --block-device-mappings '[{
        "DeviceName": "/dev/sda1",
        "Ebs": {
          "VolumeSize": 20,
          "VolumeType": "gp3"
        }
      }]' \
      --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=cognee-server}]'
    ```

    <Note>
      Replace the AMI ID, security group, and subnet with your specific values.
    </Note>
  </Step>

  <Step title="Connect to Instance">
    ```bash  theme={null}
    # Get instance public IP
    aws ec2 describe-instances --filters "Name=tag:Name,Values=cognee-server" \
      --query 'Reservations[*].Instances[*].PublicIpAddress'

    # SSH into the instance
    ssh -i /path/to/your-key.pem ubuntu@YOUR-INSTANCE-IP
    ```
  </Step>

  <Step title="Install Dependencies">
    ```bash  theme={null}
    # Update system
    sudo apt update && sudo apt upgrade -y

    # Install Python and pip
    sudo apt install python3 python3-pip python3-venv git curl -y

    # Install uv for faster Python package management
    curl -LsSf https://astral.sh/uv/install.sh | sh
    source $HOME/.cargo/env
    ```
  </Step>

  <Step title="Deploy Cognee">
    ```bash  theme={null}
    # Clone repository
    git clone https://github.com/topoteretes/cognee.git
    cd cognee

    # Run automated setup script
    chmod +x deployment/setup_ubuntu_instance.sh
    source deployment/setup_ubuntu_instance.sh
    ```
  </Step>
</Steps>

## Manual Setup Process

<AccordionGroup>
  <Accordion title="Environment Setup" defaultOpen>
    ```bash  theme={null}
    # Create virtual environment
    python3 -m venv cognee-env
    source cognee-env/bin/activate

    # Install Cognee with all dependencies
    uv sync --dev --all-extras --reinstall

    # Set up environment variables
    cat > .env << EOF
    OPENAI_API_KEY=your-openai-api-key
    POSTGRES_URL=postgresql://user:pass@localhost:5432/cognee
    NEO4J_URL=bolt://neo4j:password@localhost:7687
    QDRANT_URL=http://localhost:6333
    COGNEE_HOST=0.0.0.0
    COGNEE_PORT=8000
    EOF
    ```
  </Accordion>

  <Accordion title="Database Installation">
    ```bash  theme={null}
    # Install PostgreSQL
    sudo apt install postgresql postgresql-contrib -y
    sudo -u postgres createuser --interactive cognee
    sudo -u postgres createdb cognee

    # Install Neo4j
    wget -O - https://debian.neo4j.com/neotechnology.gpg.key | sudo apt-key add -
    echo 'deb https://debian.neo4j.com stable 4.4' | sudo tee /etc/apt/sources.list.d/neo4j.list
    sudo apt update && sudo apt install neo4j -y

    # Install and configure Qdrant
    docker run -d --name qdrant -p 6333:6333 qdrant/qdrant
    ```
  </Accordion>

  <Accordion title="Service Configuration">
    ```bash  theme={null}
    # Create systemd service
    sudo tee /etc/systemd/system/cognee.service << EOF
    [Unit]
    Description=Cognee Knowledge Graph Service
    After=network.target postgresql.service neo4j.service

    [Service]
    Type=simple
    User=ubuntu
    WorkingDirectory=/home/ubuntu/cognee
    Environment=PATH=/home/ubuntu/cognee/cognee-env/bin
    ExecStart=/home/ubuntu/cognee/cognee-env/bin/python -m cognee.api.server
    Restart=always
    RestartSec=10

    [Install]
    WantedBy=multi-user.target
    EOF

    # Enable and start service
    sudo systemctl daemon-reload
    sudo systemctl enable cognee
    sudo systemctl start cognee
    ```
  </Accordion>
</AccordionGroup>

## AWS Service Integration

<CardGroup cols={2}>
  <Card title="RDS Integration" icon="database">
    **Managed PostgreSQL**

    ```bash  theme={null}
    # Connect to RDS instance
    POSTGRES_URL=postgresql://user:pass@your-rds-endpoint:5432/cognee
    ```
  </Card>

  <Card title="S3 Storage" icon="hard-drive">
    **Object Storage**

    ```bash  theme={null}
    # Configure S3 for file storage
    AWS_S3_BUCKET=your-cognee-bucket
    AWS_ACCESS_KEY_ID=your-access-key
    AWS_SECRET_ACCESS_KEY=your-secret-key
    ```
  </Card>
</CardGroup>

## Security Configuration

<Steps>
  <Step title="Security Groups">
    ```bash  theme={null}
    # Create security group
    aws ec2 create-security-group \
      --group-name cognee-sg \
      --description "Security group for Cognee server"

    # Allow SSH (port 22)
    aws ec2 authorize-security-group-ingress \
      --group-id sg-12345678 \
      --protocol tcp \
      --port 22 \
      --cidr 0.0.0.0/0

    # Allow HTTP/HTTPS (ports 80/443)
    aws ec2 authorize-security-group-ingress \
      --group-id sg-12345678 \
      --protocol tcp \
      --port 80 \
      --cidr 0.0.0.0/0

    aws ec2 authorize-security-group-ingress \
      --group-id sg-12345678 \
      --protocol tcp \
      --port 443 \
      --cidr 0.0.0.0/0
    ```
  </Step>

  <Step title="SSL/TLS Setup">
    ```bash  theme={null}
    # Install Nginx
    sudo apt install nginx certbot python3-certbot-nginx -y

    # Configure Nginx reverse proxy
    sudo tee /etc/nginx/sites-available/cognee << EOF
    server {
        listen 80;
        server_name your-domain.com;
        
        location / {
            proxy_pass http://localhost:8000;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
        }
    }
    EOF

    # Enable site and get SSL certificate
    sudo ln -s /etc/nginx/sites-available/cognee /etc/nginx/sites-enabled/
    sudo certbot --nginx -d your-domain.com
    ```
  </Step>

  <Step title="Firewall Configuration">
    ```bash  theme={null}
    # Configure UFW firewall
    sudo ufw allow OpenSSH
    sudo ufw allow 'Nginx Full'
    sudo ufw --force enable
    ```
  </Step>
</Steps>

## Monitoring & Maintenance

<Tabs>
  <Tab title="System Monitoring">
    ```bash  theme={null}
    # Install monitoring tools
    sudo apt install htop iotop nethogs -y

    # Check system resources
    htop
    df -h
    free -m

    # Monitor Cognee service
    sudo systemctl status cognee
    sudo journalctl -u cognee -f
    ```
  </Tab>

  <Tab title="Log Management">
    ```bash  theme={null}
    # Configure log rotation
    sudo tee /etc/logrotate.d/cognee << EOF
    /home/ubuntu/cognee/logs/*.log {
        daily
        rotate 30
        compress
        delaycompress
        missingok
        notifempty
        create 0644 ubuntu ubuntu
    }
    EOF
    ```
  </Tab>

  <Tab title="Backup Strategy">
    ```bash  theme={null}
    # Create backup script
    cat > backup.sh << EOF
    #!/bin/bash

    # Database backup
    pg_dump cognee > /backup/cognee-$(date +%Y%m%d).sql

    # Upload to S3
    aws s3 cp /backup/cognee-$(date +%Y%m%d).sql s3://your-backup-bucket/

    # Clean old backups
    find /backup -name "cognee-*.sql" -mtime +7 -delete
    EOF

    # Schedule with cron
    echo "0 2 * * * /home/ubuntu/backup.sh" | crontab -
    ```
  </Tab>
</Tabs>

## Scaling & Performance

<AccordionGroup>
  <Accordion title="Vertical Scaling">
    ```bash  theme={null}
    # Stop instance
    aws ec2 stop-instances --instance-ids i-1234567890abcdef0

    # Change instance type
    aws ec2 modify-instance-attribute \
      --instance-id i-1234567890abcdef0 \
      --instance-type Value=m5.xlarge

    # Start instance
    aws ec2 start-instances --instance-ids i-1234567890abcdef0
    ```
  </Accordion>

  <Accordion title="Load Balancing">
    ```bash  theme={null}
    # Create Application Load Balancer
    aws elbv2 create-load-balancer \
      --name cognee-alb \
      --subnets subnet-12345678 subnet-87654321 \
      --security-groups sg-12345678

    # Create target group
    aws elbv2 create-target-group \
      --name cognee-targets \
      --protocol HTTP \
      --port 8000 \
      --vpc-id vpc-12345678
    ```
  </Accordion>

  <Accordion title="Auto Scaling">
    ```bash  theme={null}
    # Create launch template
    aws ec2 create-launch-template \
      --launch-template-name cognee-template \
      --launch-template-data '{
        "ImageId": "ami-0c02fb55956c7d316",
        "InstanceType": "t3.medium",
        "KeyName": "your-key-pair",
        "SecurityGroupIds": ["sg-12345678"],
        "UserData": "base64-encoded-startup-script"
      }'
    ```
  </Accordion>
</AccordionGroup>

## Troubleshooting

<Tabs>
  <Tab title="Common Issues">
    **Service Won't Start**

    ```bash  theme={null}
    # Check service status
    sudo systemctl status cognee
    sudo journalctl -u cognee --no-pager

    # Check port availability
    sudo netstat -tlnp | grep :8000

    # Verify environment variables
    cat .env
    ```
  </Tab>

  <Tab title="Database Issues">
    **Connection Problems**

    ```bash  theme={null}
    # Test PostgreSQL connection
    psql -h localhost -U cognee -d cognee -c "SELECT 1;"

    # Check Neo4j status
    sudo systemctl status neo4j
    curl http://localhost:7474

    # Verify Qdrant
    curl http://localhost:6333/collections
    ```
  </Tab>

  <Tab title="Performance Issues">
    **Resource Monitoring**

    ```bash  theme={null}
    # Check CPU and memory usage
    top
    free -m

    # Monitor disk I/O
    iotop

    # Check network connections
    ss -tuln
    ```
  </Tab>
</Tabs>

## Cost Optimization

<CardGroup cols={2}>
  <Card title="Reserved Instances" icon="dollar-sign">
    **Save up to 75%**

    Purchase reserved instances for predictable workloads to reduce costs significantly.
  </Card>

  <Card title="Spot Instances" icon="trending-down">
    **Development/Testing**

    Use spot instances for non-critical workloads to save up to 90% on compute costs.
  </Card>
</CardGroup>

<Tip>
  Use AWS Cost Explorer to monitor your EC2 spending and optimize instance types based on actual usage patterns.
</Tip>

## Next Steps

<CardGroup cols={2}>
  <Card title="High Availability" icon="shield">
    **Multi-AZ Setup**

    Deploy across multiple availability zones for improved resilience.
  </Card>

  <Card title="Monitoring Stack" icon="bar-chart">
    **CloudWatch Integration**

    Set up comprehensive monitoring with CloudWatch and custom metrics.
  </Card>
</CardGroup>

<Card title="Need Help?" href="https://discord.gg/m63hxKsp4p" icon="discord">
  Join our community for EC2 deployment support and AWS best practices.
</Card>
