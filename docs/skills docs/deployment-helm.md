> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Kubernetes (Helm)

> Deploy Cognee on Kubernetes with Helm charts for enterprise-grade, production-ready deployments

# Kubernetes Deployment with Helm

Deploy Cognee on Kubernetes using Helm charts for enterprise-grade, production-ready deployments with full control and high availability.

<Info>
  Kubernetes deployment provides container orchestration, auto-healing, and horizontal scaling for production workloads.
</Info>

## Why Kubernetes + Helm?

<CardGroup cols={2}>
  <Card title="Enterprise Ready" icon="shield-check">
    Production-grade deployment with security, monitoring, and compliance
  </Card>

  <Card title="High Availability" icon="server">
    Multi-replica deployments with automatic failover and load balancing
  </Card>

  <Card title="Resource Management" icon="settings">
    Fine-grained control over CPU, memory, and storage allocation
  </Card>

  <Card title="GitOps Integration" icon="git-branch">
    Version-controlled infrastructure with automated deployment pipelines
  </Card>
</CardGroup>

## Prerequisites

<Steps>
  <Step title="Kubernetes Cluster">
    You need a running Kubernetes cluster:

    * **Local**: Minikube, Kind, or Docker Desktop
    * **Cloud**: GKE, EKS, AKS, or DigitalOcean Kubernetes
    * **On-premise**: Self-managed Kubernetes cluster

    <Note>
      Minimum requirements: 3 nodes, 4 CPU cores, 8GB RAM per node
    </Note>
  </Step>

  <Step title="Install Tools">
    ```bash  theme={null}
    # Install kubectl
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
    sudo install kubectl /usr/local/bin/

    # Install Helm
    curl https://get.helm.sh/helm-v3.12.0-linux-amd64.tar.gz | tar xz
    sudo mv linux-amd64/helm /usr/local/bin/

    # Verify installations
    kubectl version --client
    helm version
    ```
  </Step>

  <Step title="Configure Access">
    ```bash  theme={null}
    # Test cluster connectivity
    kubectl cluster-info
    kubectl get nodes
    ```
  </Step>
</Steps>

## Quick Deployment

<Steps>
  <Step title="Clone Repository">
    ```bash  theme={null}
    git clone https://github.com/topoteretes/cognee.git
    cd cognee
    ```
  </Step>

  <Step title="Configure Values">
    Create a `values.yaml` file to customize your deployment:

    ```yaml  theme={null}
    # values.yaml
    cognee:
      image:
        repository: cognee/cognee
        tag: latest
        pullPolicy: Always
      
      replicas: 3
      
      env:
        OPENAI_API_KEY: "your-api-key"
        POSTGRES_URL: "postgresql://user:pass@postgres:5432/cognee"
        NEO4J_URL: "bolt://neo4j:password@neo4j:7687"
        QDRANT_URL: "http://qdrant:6333"

    # Database configurations
    postgresql:
      enabled: true
      auth:
        database: cognee
        username: cognee
        password: secure-password

    neo4j:
      enabled: true
      auth:
        password: neo4j-password

    qdrant:
      enabled: true
    ```
  </Step>

  <Step title="Deploy with Helm">
    ```bash  theme={null}
    # Install the Helm chart
    helm install cognee ./deployment/helm -f values.yaml

    # Check deployment status
    kubectl get pods -l app=cognee
    kubectl get services
    ```
  </Step>

  <Step title="Verify Deployment">
    ```bash  theme={null}
    # Check pod status
    kubectl get pods

    # View logs
    kubectl logs -f deployment/cognee

    # Test connectivity
    kubectl port-forward svc/cognee 8000:8000
    curl http://localhost:8000/health
    ```
  </Step>
</Steps>

## Architecture Components

<Tabs>
  <Tab title="Application Tier">
    **Cognee Services**

    * **Cognee API**: Main application pods (3+ replicas)
    * **Worker Pods**: Background processing (auto-scaling)
    * **Load Balancer**: Service distribution and health checks
    * **Ingress**: External traffic routing with SSL termination
  </Tab>

  <Tab title="Data Tier">
    **Database Services**

    * **PostgreSQL**: Metadata and relational data (StatefulSet)
    * **Neo4j**: Graph database (StatefulSet with clustering)
    * **Qdrant**: Vector database (StatefulSet with replication)
    * **Persistent Volumes**: Durable storage for all databases
  </Tab>

  <Tab title="Infrastructure">
    **Supporting Services**

    * **ConfigMaps**: Environment configuration
    * **Secrets**: Sensitive data (API keys, passwords)
    * **NetworkPolicies**: Service-to-service communication
    * **ServiceMonitor**: Prometheus monitoring integration
  </Tab>
</Tabs>

## Production Configuration

<AccordionGroup>
  <Accordion title="High Availability Setup" defaultOpen>
    ```yaml  theme={null}
    # Production values.yaml
    cognee:
      replicas: 5
      resources:
        requests:
          cpu: 1000m
          memory: 2Gi
        limits:
          cpu: 2000m
          memory: 4Gi
      
      autoscaling:
        enabled: true
        minReplicas: 3
        maxReplicas: 20
        targetCPUUtilizationPercentage: 70

    postgresql:
      primary:
        persistence:
          size: 100Gi
          storageClass: fast-ssd
      readReplicas:
        replicaCount: 2
    ```
  </Accordion>

  <Accordion title="Security Configuration">
    ```yaml  theme={null}
    # Security settings
    securityContext:
      runAsNonRoot: true
      runAsUser: 1000
      fsGroup: 1000

    networkPolicy:
      enabled: true
      ingress:
        - from:
          - namespaceSelector:
              matchLabels:
                name: cognee-namespace

    podSecurityPolicy:
      enabled: true
    ```
  </Accordion>

  <Accordion title="Monitoring & Observability">
    ```yaml  theme={null}
    # Monitoring configuration
    monitoring:
      enabled: true
      serviceMonitor:
        enabled: true
        namespace: monitoring
      
      grafana:
        dashboards:
          enabled: true
      
      prometheus:
        rules:
          enabled: true

    logging:
      level: INFO
      format: json
      aggregation:
        enabled: true
        endpoint: "http://loki:3100"
    ```
  </Accordion>
</AccordionGroup>

## Database Management

<CardGroup cols={3}>
  <Card title="PostgreSQL" icon="database">
    **Relational Data**

    * Persistent metadata storage
    * User management and permissions
    * Pipeline state and configuration
  </Card>

  <Card title="Neo4j" icon="network">
    **Graph Database**

    * Knowledge graph relationships
    * Entity connections
    * Semantic network storage
  </Card>

  <Card title="Qdrant" icon="brain">
    **Vector Database**

    * Embeddings storage
    * Similarity search
    * Semantic retrieval
  </Card>
</CardGroup>

## Scaling & Performance

<Steps>
  <Step title="Horizontal Pod Autoscaler">
    ```bash  theme={null}
    # Enable autoscaling
    kubectl autoscale deployment cognee --cpu-percent=70 --min=3 --max=20

    # Check HPA status
    kubectl get hpa
    ```
  </Step>

  <Step title="Vertical Pod Autoscaler">
    ```yaml  theme={null}
    # VPA configuration
    apiVersion: autoscaling.k8s.io/v1
    kind: VerticalPodAutoscaler
    metadata:
      name: cognee-vpa
    spec:
      targetRef:
        apiVersion: apps/v1
        kind: Deployment
        name: cognee
      updatePolicy:
        updateMode: "Auto"
    ```
  </Step>

  <Step title="Node Autoscaling">
    Configure cluster autoscaling for dynamic node provisioning based on workload demands.
  </Step>
</Steps>

## Maintenance Operations

<AccordionGroup>
  <Accordion title="Updates & Rollbacks">
    ```bash  theme={null}
    # Update deployment
    helm upgrade cognee ./deployment/helm -f values.yaml

    # Check rollout status
    kubectl rollout status deployment/cognee

    # Rollback if needed
    helm rollback cognee 1
    ```
  </Accordion>

  <Accordion title="Backup & Recovery">
    ```bash  theme={null}
    # Database backups
    kubectl create job --from=cronjob/postgres-backup backup-$(date +%Y%m%d)

    # Persistent volume snapshots
    kubectl apply -f backup-volumesnapshot.yaml
    ```
  </Accordion>

  <Accordion title="Health Monitoring">
    ```bash  theme={null}
    # Check pod health
    kubectl describe pods -l app=cognee

    # View resource usage
    kubectl top pods
    kubectl top nodes

    # Check service endpoints
    kubectl get endpoints
    ```
  </Accordion>
</AccordionGroup>

## Troubleshooting

<Tabs>
  <Tab title="Common Issues">
    **Pod Failures**

    ```bash  theme={null}
    # Check pod status and events
    kubectl describe pod <pod-name>
    kubectl logs <pod-name> --previous

    # Resource constraints
    kubectl top pods
    kubectl describe nodes
    ```
  </Tab>

  <Tab title="Database Issues">
    **Connection Problems**

    ```bash  theme={null}
    # Test database connectivity
    kubectl exec -it <cognee-pod> -- psql $POSTGRES_URL -c "SELECT 1;"
    kubectl exec -it <neo4j-pod> -- cypher-shell -u neo4j -p password

    # Check service DNS resolution
    kubectl exec -it <pod> -- nslookup postgres
    ```
  </Tab>

  <Tab title="Performance Issues">
    **Resource Monitoring**

    ```bash  theme={null}
    # Check resource utilization
    kubectl top pods --sort-by=memory
    kubectl top nodes

    # Review HPA metrics
    kubectl describe hpa cognee
    ```
  </Tab>
</Tabs>

## Uninstalling

<Steps>
  <Step title="Remove Helm Release">
    ```bash  theme={null}
    helm uninstall cognee
    ```
  </Step>

  <Step title="Clean Up Resources">
    ```bash  theme={null}
    # Remove persistent volumes (if desired)
    kubectl delete pvc -l app=cognee

    # Remove secrets
    kubectl delete secret -l app=cognee
    ```
  </Step>
</Steps>

<Warning>
  Uninstalling will permanently delete all data unless you have backups. Ensure you have proper backup procedures in place.
</Warning>

## Next Steps

<CardGroup cols={2}>
  <Card title="Monitoring Setup" icon="bar-chart">
    **Observability Stack**

    Configure Prometheus, Grafana, and alerting for production monitoring.
  </Card>

  <Card title="CI/CD Integration" icon="git-branch">
    **GitOps Deployment**

    Set up automated deployments with ArgoCD or Flux.
  </Card>
</CardGroup>

<Card title="Need Help?" href="https://discord.gg/m63hxKsp4p" icon="discord">
  Join our community for Kubernetes deployment support and production best practices.
</Card>
