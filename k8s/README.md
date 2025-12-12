# Element Web - Kubernetes Deployment

This directory contains Kubernetes manifests for deploying Element Web to Amazon EKS.

## Files

- **deployment.yaml**: Deployment configuration with 1 replica, resource limits, and health checks
- **service.yaml**: ClusterIP service exposing port 80
- **ingress.yaml**: ALB Ingress with HTTPS and health check configuration

## Deployment

### Automated Deployment (Recommended)

Use GitHub Actions workflow:

```bash
# Go to GitHub Actions tab in clap-element-web repository
# Run: "Clap - Build and Deploy to EKS"
# Select environment: dev / staging / production
```

The workflow will:
1. Build and push Docker image to ECR
2. Update EKS deployment with new image
3. Wait for rollout to complete
4. Provision ALB via AWS Load Balancer Controller

**Note**: DNS configuration (Route 53/Cloudflare) is a separate step and requires manual action or additional automation after ALB is provisioned.

### Manual Deployment

If you need to deploy manually:

```bash
# 1. Configure kubectl
aws eks update-kubeconfig --region ap-northeast-2 --name clap-eks-dev

# 2. Create namespace
kubectl create namespace clap

# 3. Replace environment placeholders
sed -i "s/ENV_TAG/dev/g" deployment.yaml
sed -i "s/ENV/dev/g" ingress.yaml

# 4. Apply manifests
kubectl apply -f deployment.yaml -n clap
kubectl apply -f service.yaml -n clap
kubectl apply -f ingress.yaml -n clap

# 5. Check deployment status
kubectl rollout status deployment/element-web -n clap
kubectl get pods -l app=element-web -n clap

# 6. Get ALB endpoint
kubectl get ingress element-web -n clap
```

## Configuration

### Environment Variables

The deployment uses the following environment variables:

- `ELEMENT_WEB_PORT`: HTTP port (default: 80)

### Resource Limits

- **Requests**: 250m CPU, 512Mi memory
- **Limits**: 500m CPU, 1Gi memory

### Health Checks

- **Liveness Probe**: GET /config.json every 30s
- **Readiness Probe**: GET /config.json every 10s

## Access

After deployment, Element Web is accessible at:

- **Dev**: [app.dev.clap.ac](https://app.dev.clap.ac)
- **Staging**: [app.staging.clap.ac](https://app.staging.clap.ac)
- **Production**: [app.clap.ac](https://app.clap.ac)

## Troubleshooting

### Check pod logs
```bash
kubectl logs -l app=element-web -n clap --tail=100 -f
```

### Check pod status
```bash
kubectl describe pod -l app=element-web -n clap
```

### Check ingress
```bash
kubectl describe ingress element-web -n clap
```

### Check ALB in AWS Console
```bash
aws elbv2 describe-load-balancers --region ap-northeast-2 \
  --query "LoadBalancers[?contains(LoadBalancerName, 'clap-eks-dev')].{Name:LoadBalancerName,DNS:DNSName,State:State.Code}"
```

## Rollback

To rollback to previous version:

```bash
# View deployment history
kubectl rollout history deployment/element-web -n clap

# Rollback to previous revision
kubectl rollout undo deployment/element-web -n clap

# Rollback to specific revision
kubectl rollout undo deployment/element-web -n clap --to-revision=2
```

## ECS to EKS Migration

Migration strategy depends on current environment:

### Option A: Direct Cutover (if ECS not currently in use)

1. **Stop ECS Service**
   - Scale down Element Web ECS service to 0 tasks
   - Verify no traffic to ECS ALB

2. **Deploy to EKS**
   - Run GitHub Actions workflow: "Clap - Build and Deploy to EKS"
   - Wait for ALB provisioning (2-3 minutes)
   - Verify health checks passing

3. **Update DNS**
   - Add Cloudflare/Route 53 record: `app.dev.clap.ac` → EKS ALB DNS
   - Wait for DNS propagation (1-5 minutes)

4. **Verify and Monitor**
   - Test application accessibility
   - Monitor metrics for 24-48 hours
   - Decommission ECS resources after confirmation

**Rollback**: Update DNS back to ECS ALB, scale ECS service back to desired count

### Option B: Blue/Green with Weighted Routing (if ECS in production)

1. **Deploy EKS (Green)**
   - Deploy to EKS without changing DNS
   - Verify EKS ALB and health checks
   - ECS (Blue) continues serving production traffic

2. **Configure Weighted Routing (Route 53)**
   - Create weighted routing policy for domain
   - Start: ECS 90%, EKS 10%
   - Monitor error rates, latency, and logs

3. **Progressive Traffic Shift**
   - After 1 hour: ECS 50%, EKS 50%
   - Monitor metrics and error rates
   - After 2 hours: ECS 10%, EKS 90%
   - Continue monitoring

4. **Complete Migration**
   - Final: ECS 0%, EKS 100%
   - Remove weighted policy, point directly to EKS ALB
   - Monitor for 24-48 hours

5. **Cleanup**
   - Scale ECS service to 0
   - Decommission ECS resources after confirmation

**Rollback at any stage**:
- Immediately shift weight back to ECS (e.g., ECS 100%, EKS 0%)
- Monitor recovery
- Investigate and fix EKS issues before retry

**Monitoring Metrics**:
- HTTP 5xx error rate < 0.1%
- P95 latency similar to ECS baseline
- Health check success rate > 99%
