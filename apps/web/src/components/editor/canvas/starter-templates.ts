import { CUSTOM_EDGE_TYPE, CUSTOM_NODE_TYPE } from "@repo/types"
import type { CanvasFlowEdge, CanvasFlowNode } from "@/types"

/*
  Prebuilt starter designs. Plain canvas snapshots in the same node/edge shape the editor and the AI
  create, so importing one is just "replace the room's nodes and edges with these".
 */
export interface CanvasTemplate {
  id: string
  name: string
  description: string
  nodes: CanvasFlowNode[]
  edges: CanvasFlowEdge[]
}

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: "microservices",
    name: "Microservices Architecture",
    description: "API Gateway routing requests to Auth, User, and Payment services backed by Redis and PostgreSQL.",
    nodes: [
      {
        id: "api-gateway",
        type: CUSTOM_NODE_TYPE,
        position: { x: 80, y: 160 },
        style: { width: 140, height: 60 },
        data: { label: "API Gateway", color: "#10233D", textColor: "#52A8FF", shape: "pill" },
      },
      {
        id: "auth-service",
        type: CUSTOM_NODE_TYPE,
        position: { x: 320, y: 60 },
        style: { width: 130, height: 50 },
        data: { label: "Auth Service", color: "#2E1938", textColor: "#BF7AF0", shape: "rectangle" },
      },
      {
        id: "user-service",
        type: CUSTOM_NODE_TYPE,
        position: { x: 320, y: 165 },
        style: { width: 130, height: 50 },
        data: { label: "User Service", color: "#0F2E18", textColor: "#62C073", shape: "rectangle" },
      },
      {
        id: "payment-service",
        type: CUSTOM_NODE_TYPE,
        position: { x: 320, y: 270 },
        style: { width: 130, height: 50 },
        data: { label: "Payment Service", color: "#331B00", textColor: "#FF990A", shape: "rectangle" },
      },
      {
        id: "redis-cache",
        type: CUSTOM_NODE_TYPE,
        position: { x: 550, y: 60 },
        style: { width: 90, height: 80 },
        data: { label: "Redis", color: "#062822", textColor: "#0AC7B4", shape: "cylinder" },
      },
      {
        id: "postgres-db",
        type: CUSTOM_NODE_TYPE,
        position: { x: 550, y: 210 },
        style: { width: 90, height: 80 },
        data: { label: "Postgres DB", color: "#3C1618", textColor: "#FF6166", shape: "cylinder" },
      },
    ],
    edges: [
      { id: "e1", source: "api-gateway", target: "auth-service", type: CUSTOM_EDGE_TYPE, data: { label: "Verify Token" } },
      { id: "e2", source: "api-gateway", target: "user-service", type: CUSTOM_EDGE_TYPE, data: { label: "HTTP REST" } },
      { id: "e3", source: "api-gateway", target: "payment-service", type: CUSTOM_EDGE_TYPE, data: { label: "gRPC" } },
      { id: "e4", source: "auth-service", target: "redis-cache", type: CUSTOM_EDGE_TYPE, data: { label: "Session Cache" } },
      { id: "e5", source: "user-service", target: "postgres-db", type: CUSTOM_EDGE_TYPE, data: { label: "SQL Query" } },
      { id: "e6", source: "payment-service", target: "postgres-db", type: CUSTOM_EDGE_TYPE, data: { label: "Transactions" } },
    ],
  },
  {
    id: "cicd-pipeline",
    name: "CI/CD Pipeline",
    description: "Automated continuous delivery workflow from Source Control to Kubernetes Cluster deployment.",
    nodes: [
      {
        id: "git-repo",
        type: CUSTOM_NODE_TYPE,
        position: { x: 60, y: 150 },
        style: { width: 70, height: 70 },
        data: { label: "Git Repo", color: "#1F1F1F", textColor: "#EDEDED", shape: "circle" },
      },
      {
        id: "build-server",
        type: CUSTOM_NODE_TYPE,
        position: { x: 210, y: 155 },
        style: { width: 130, height: 60 },
        data: { label: "Build Runner", color: "#10233D", textColor: "#52A8FF", shape: "pill" },
      },
      {
        id: "security-scan",
        type: CUSTOM_NODE_TYPE,
        position: { x: 410, y: 70 },
        style: { width: 110, height: 70 },
        data: { label: "SAST Scan", color: "#2E1938", textColor: "#BF7AF0", shape: "hexagon" },
      },
      {
        id: "container-reg",
        type: CUSTOM_NODE_TYPE,
        position: { x: 410, y: 220 },
        style: { width: 90, height: 80 },
        data: { label: "Image Registry", color: "#0F2E18", textColor: "#62C073", shape: "cylinder" },
      },
      {
        id: "k8s-cluster",
        type: CUSTOM_NODE_TYPE,
        position: { x: 600, y: 150 },
        style: { width: 140, height: 70 },
        data: { label: "Production K8s", color: "#331B00", textColor: "#FF990A", shape: "rectangle" },
      },
    ],
    edges: [
      { id: "e1", source: "git-repo", target: "build-server", type: CUSTOM_EDGE_TYPE, data: { label: "Webhook Push" } },
      { id: "e2", source: "build-server", target: "security-scan", type: CUSTOM_EDGE_TYPE, data: { label: "Security Audit" } },
      { id: "e3", source: "build-server", target: "container-reg", type: CUSTOM_EDGE_TYPE, data: { label: "Push Image" } },
      { id: "e4", source: "container-reg", target: "k8s-cluster", type: CUSTOM_EDGE_TYPE, data: { label: "Helm Deploy" } },
    ],
  },
  {
    id: "event-driven",
    name: "Event-Driven System",
    description: "High-throughput event streaming with Apache Kafka pub/sub routing to parallel consumers and data lake.",
    nodes: [
      {
        id: "event-producer",
        type: CUSTOM_NODE_TYPE,
        position: { x: 60, y: 150 },
        style: { width: 80, height: 80 },
        data: { label: "Client Ingest", color: "#3C1618", textColor: "#FF6166", shape: "circle" },
      },
      {
        id: "kafka-bus",
        type: CUSTOM_NODE_TYPE,
        position: { x: 230, y: 155 },
        style: { width: 140, height: 70 },
        data: { label: "Kafka Event Bus", color: "#331B00", textColor: "#FF990A", shape: "pill" },
      },
      {
        id: "worker-a",
        type: CUSTOM_NODE_TYPE,
        position: { x: 450, y: 65 },
        style: { width: 130, height: 50 },
        data: { label: "Realtime Worker", color: "#10233D", textColor: "#52A8FF", shape: "rectangle" },
      },
      {
        id: "worker-b",
        type: CUSTOM_NODE_TYPE,
        position: { x: 450, y: 245 },
        style: { width: 130, height: 50 },
        data: { label: "Audit Worker", color: "#062822", textColor: "#0AC7B4", shape: "rectangle" },
      },
      {
        id: "analytics-db",
        type: CUSTOM_NODE_TYPE,
        position: { x: 660, y: 150 },
        style: { width: 90, height: 85 },
        data: { label: "Analytics Lake", color: "#2E1938", textColor: "#BF7AF0", shape: "cylinder" },
      },
    ],
    edges: [
      { id: "e1", source: "event-producer", target: "kafka-bus", type: CUSTOM_EDGE_TYPE, data: { label: "Publish Event" } },
      { id: "e2", source: "kafka-bus", target: "worker-a", type: CUSTOM_EDGE_TYPE, data: { label: "Consumer Grp 1" } },
      { id: "e3", source: "kafka-bus", target: "worker-b", type: CUSTOM_EDGE_TYPE, data: { label: "Consumer Grp 2" } },
      { id: "e4", source: "worker-a", target: "analytics-db", type: CUSTOM_EDGE_TYPE, data: { label: "Stream Write" } },
      { id: "e5", source: "worker-b", target: "analytics-db", type: CUSTOM_EDGE_TYPE, data: { label: "Batch Ingest" } },
    ],
  },
]
