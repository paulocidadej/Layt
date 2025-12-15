# SOF OCR Deploy Steps (AWS ECR/ECS or EC2)

Updated image is already pushed to ECR: `516466084656.dkr.ecr.eu-north-1.amazonaws.com/zouheir/sof-ocr:latest`.

## Build & Push (from local/mac)
```bash
# Authenticate to ECR
aws ecr get-login-password --region eu-north-1 \
  | docker login --username AWS --password-stdin 516466084656.dkr.ecr.eu-north-1.amazonaws.com

# Build from the SOF-EXTRACT folder that contains the Dockerfile
docker build -t sof-ocr:latest \
  -f "/Users/zoudrh/Desktop/Maritime Voyage/SOF-EXTRACT/Dockerfile" \
  "/Users/zoudrh/Desktop/Maritime Voyage/SOF-EXTRACT"

# Tag and push to ECR
docker tag sof-ocr:latest 516466084656.dkr.ecr.eu-north-1.amazonaws.com/zouheir/sof-ocr:latest
docker push 516466084656.dkr.ecr.eu-north-1.amazonaws.com/zouheir/sof-ocr:latest
```

## Redeploy on EC2 (if running directly on a host)
```bash
ssh <ec2-host>
aws ecr get-login-password --region eu-north-1 \
  | docker login --username AWS --password-stdin 516466084656.dkr.ecr.eu-north-1.amazonaws.com

docker pull 516466084656.dkr.ecr.eu-north-1.amazonaws.com/zouheir/sof-ocr:latest
docker stop sof-ocr || true
docker rm sof-ocr || true

# Point --env-file to your existing OCR env file with SOF_* tunables
docker run -d --name sof-ocr -p 8000:8000 --restart unless-stopped \
  --env-file /path/to/ocr.env \
  516466084656.dkr.ecr.eu-north-1.amazonaws.com/zouheir/sof-ocr:latest
```

## Redeploy on ECS (managed)
Console steps (from the ECS service page):
1) Click the task definition link for the service (e.g., `ocr:3`).
2) Click **Create new revision** and set the container image to `516466084656.dkr.ecr.eu-north-1.amazonaws.com/zouheir/sof-ocr:latest`.
3) Keep port 8000 and all existing env vars (SOF_OCR_DPI, SOF_MAX_SECONDS, SOF_MAX_PDF_PAGES, SOF_PADDLE_THREADS, CORS origins).
4) Save the new revision (e.g., `ocr:4`).
5) Go back to the service, click **Update**, choose the new task definition revision, and deploy (rolling update).

## ALB / Target Group Health Checks (common 502 fix)
- Target group: set Health check path to `/health`, protocol HTTP, port = traffic port (8000).
- Ensure the task definition exposes container port 8000 and the service/target group points to that port.
- Security groups: ALB SG allows inbound 80 from clients; task ENI SG allows inbound 8000 from the ALB SG.
- After updating, wait for targets to show **healthy** (draining = old task shutting down). Only one task should remain and stay healthy.

## AWS CloudShell commands (no placeholders)
Force a new deployment on ECS to pick up the latest image/health endpoint:
```bash
aws ecs update-service \
  --cluster OCR \
  --service ocr-service-qu9kzscy \
  --force-new-deployment
```

## ECR connectivity (avoid timeouts pulling images)
If tasks cannot reach ECR, either:
- Ensure the service only uses the private subnets with NAT routes: `subnet-0a297c25f1fe3e612` and `subnet-0779f8b1e02bc908d` (remove `subnet-0a92611cdd9053273` from the service network config), then redeploy.
- Or add VPC endpoints for ECR and S3:
```bash
# ECR API
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-0b90354817269a8ec \
  --service-name com.amazonaws.eu-north-1.ecr.api \
  --vpc-endpoint-type Interface \
  --subnet-ids subnet-0a297c25f1fe3e612 subnet-0779f8b1e02bc908d \
  --security-group-ids sg-0923c68c0c42bb5fb \
  --private-dns-enabled

# ECR Docker (registry)
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-0b90354817269a8ec \
  --service-name com.amazonaws.eu-north-1.ecr.dkr \
  --vpc-endpoint-type Interface \
  --subnet-ids subnet-0a297c25f1fe3e612 subnet-0779f8b1e02bc908d \
  --security-group-ids sg-0923c68c0c42bb5fb \
  --private-dns-enabled

# S3 (gateway) for ECR layer pulls
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-0b90354817269a8ec \
  --service-name com.amazonaws.eu-north-1.s3 \
  --route-table-ids rtb-088c8cb2e34570203 rtb-08e67093a29ddb456
```

Update ECS service to use only NAT-routed subnets (run in CloudShell):
```bash
aws ecs update-service \
  --cluster OCR \
  --service ocr-service-qu9kzscy \
  --network-configuration '{
    "awsvpcConfiguration": {
      "subnets": [
        "subnet-0a297c25f1fe3e612",
        "subnet-0779f8b1e02bc908d"
      ],
      "securityGroups": ["sg-0923c68c0c42bb5fb"],
      "assignPublicIp": "DISABLED"
    }
  }' \
  --force-new-deployment
```

SG rules required for ECR/Textract (allow 443):
```bash
# Inbound 443 from the task/endpoint SG itself
aws ec2 authorize-security-group-ingress \
  --group-id sg-0923c68c0c42bb5fb \
  --protocol tcp --port 443 --source-group sg-0923c68c0c42bb5fb || true

# Outbound allow all (simplest)
aws ec2 authorize-security-group-egress \
  --group-id sg-0923c68c0c42bb5fb \
  --protocol -1 --port all --cidr 0.0.0.0/0 || true
```

## CloudWatch log group (must exist)
Create the log group `/ecs/ocr` once per region:
```bash
aws logs create-log-group --log-group-name /ecs/ocr --region eu-north-1 || true
aws logs put-retention-policy --log-group-name /ecs/ocr --retention-in-days 14 --region eu-north-1
```

Allow ALB SG to reach task SG on 8000 (replace sg-ALBID with your ALB SG ID):
```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-0923c68c0c42bb5fb \
  --protocol tcp --port 8000 --source-group sg-0923c68c0c42bb5fb
```

Remove inbound HTTP/80 on the task SG (not needed):
```bash
aws ec2 revoke-security-group-ingress \
  --group-id sg-0923c68c0c42bb5fb \
  --protocol tcp --port 80 --cidr 0.0.0.0/0
```

Tail ECS task logs (adjust log group if different):
```bash
aws logs tail /ecs/ocr --since 15m
```

# Notes
- Dockerfile now pre-downloads PaddleOCR models during build to avoid startup downloads (stabilizes health checks).
- Textract optional backend: set `USE_TEXTRACT=true` and `TEXTRACT_REGION=eu-north-1` (or your AWS region) on the OCR service to use Amazon Textract instead of PaddleOCR for PDFs.
- ALB and task security group: `sg-0923c68c0c42bb5fb` (used by both ALB and tasks). Inbound TCP 8000 should allow from this SG; HTTP/80 inbound on the task SG is not needed. Health check path is `/health` on traffic port 8000.
- ECR image: `516466084656.dkr.ecr.eu-north-1.amazonaws.com/zouheir/sof-ocr:latest`
- ALB subnets must be public (IGW route + map-public-ip). Use `subnet-0a92611cdd9053273` (1a) and the new public `subnet-0ec07187ebfa600a7` (1b) for the ALB; keep ECS tasks in the private/NAT subnets `subnet-0a297c25f1fe3e612`, `subnet-0779f8b1e02bc908d`.

## Update your app to use the service
- If fronted by an ALB/private DNS, keep the same host; otherwise set `SOF_OCR_ENDPOINT` in the Next.js app to the reachable URL (e.g., `http://<host>:8000/extract`).

## Textract setup (no placeholders)
Set env vars on the ECS task:
- `USE_TEXTRACT=true`
- `TEXTRACT_REGION=eu-north-1`

Task role for Textract:
```bash
# Create the task role
aws iam create-role \
  --role-name ocr-textract-task-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "Service": "ecs-tasks.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach Textract permissions (full)
aws iam attach-role-policy \
  --role-name ocr-textract-task-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonTextractFullAccess
```

Register a new task definition revision with the task role (requires jq):
```bash
TD=$(aws ecs describe-services --cluster OCR --services ocr-service-qu9kzscy --query 'services[0].taskDefinition' --output text)

NEW_TD=$(aws ecs register-task-definition \
  --cli-input-json "$(aws ecs describe-task-definition \
    --task-definition $TD \
    --query 'taskDefinition' \
    --output json \
    | jq 'del(.status, .taskDefinitionArn, .requiresAttributes, .compatibilities, .revision, .registeredAt, .registeredBy)
      | .taskRoleArn = \"arn:aws:iam::516466084656:role/ocr-textract-task-role\"' )" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo "New TD: $NEW_TD"
```

Update the service to use the new task definition:
```bash
aws ecs update-service \
  --cluster OCR \
  --service ocr-service-qu9kzscy \
  --task-definition "$NEW_TD" \
  --force-new-deployment
```

## Textract VPC endpoint (no NAT needed) — using your VPC and subnets
Create an interface endpoint so tasks can reach Textract privately:
```bash
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-0b90354817269a8ec \
  --service-name com.amazonaws.eu-north-1.textract \
  --vpc-endpoint-type Interface \
  --subnet-ids subnet-0a92611cdd9053273 subnet-0a297c25f1fe3e612 subnet-0779f8b1e02bc908d \
  --security-group-ids sg-0923c68c0c42bb5fb \
  --private-dns-enabled
```

After creating the endpoint, redeploy the service (Textract env vars already set):
```bash
aws ecs update-service \
  --cluster OCR \
  --service ocr-service-qu9kzscy \
  --force-new-deployment
```

## NAT Gateway for Textract egress (region eu-north-1)
If the Textract VPC endpoint is not available, add internet egress via a NAT in this VPC.

Use CloudShell step-by-step (no placeholders):
```bash
VPC_ID=vpc-0b90354817269a8ec
PRIVATE_SUBNETS=("subnet-0a92611cdd9053273" "subnet-0a297c25f1fe3e612" "subnet-0779f8b1e02bc908d")
PUBLIC_SUBNET="subnet-0a92611cdd9053273"   # re-use this subnet as public for NAT

# 1) Ensure an Internet Gateway exists; create/attach if missing
IGW_ID=$(aws ec2 describe-internet-gateways --filters Name=attachment.vpc-id,Values=$VPC_ID --query 'InternetGateways[0].InternetGatewayId' --output text)
if [ "$IGW_ID" = "None" ] || [ -z "$IGW_ID" ]; then
  IGW_ID=$(aws ec2 create-internet-gateway --query 'InternetGateway.InternetGatewayId' --output text)
  aws ec2 attach-internet-gateway --internet-gateway-id "$IGW_ID" --vpc-id "$VPC_ID"
fi
echo "IGW: $IGW_ID"

# 2) Make PUBLIC_SUBNET public: enable public IPs and route to IGW
aws ec2 modify-subnet-attribute --subnet-id "$PUBLIC_SUBNET" --map-public-ip-on-launch
RTB_PUBLIC=$(aws ec2 create-route-table --vpc-id "$VPC_ID" --query 'RouteTable.RouteTableId' --output text)
aws ec2 create-route --route-table-id "$RTB_PUBLIC" --destination-cidr-block 0.0.0.0/0 --gateway-id "$IGW_ID"
aws ec2 associate-route-table --route-table-id "$RTB_PUBLIC" --subnet-id "$PUBLIC_SUBNET"
echo "Public RT: $RTB_PUBLIC"

# 3) Create NAT in the public subnet
EIP_ALLOC=$(aws ec2 allocate-address --domain vpc --query 'AllocationId' --output text)
echo "EIP: $EIP_ALLOC"
NAT_ID=$(aws ec2 create-nat-gateway --subnet-id "$PUBLIC_SUBNET" --allocation-id "$EIP_ALLOC" --query 'NatGateway.NatGatewayId' --output text)
echo "NAT: $NAT_ID"
aws ec2 wait nat-gateway-available --nat-gateway-ids "$NAT_ID"

# 4) Point each private subnet's route table default route to the NAT
for SN in "${PRIVATE_SUBNETS[@]}"; do
  RT_ID=$(aws ec2 describe-route-tables --filters Name=association.subnet-id,Values="$SN" --query 'RouteTables[0].RouteTableId' --output text)
  echo "Subnet $SN -> route table $RT_ID"
  if ! aws ec2 replace-route --route-table-id "$RT_ID" --destination-cidr-block 0.0.0.0/0 --nat-gateway-id "$NAT_ID" 2>/dev/null; then
    aws ec2 create-route --route-table-id "$RT_ID" --destination-cidr-block 0.0.0.0/0 --nat-gateway-id "$NAT_ID"
  fi
done

echo "NAT egress configured."
```

Then redeploy ECS:
```bash
aws ecs update-service \
  --cluster OCR \
  --service ocr-service-qu9kzscy \
  --force-new-deployment
```
