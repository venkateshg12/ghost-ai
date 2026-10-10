import { generateText } from "ai";
import type { ChatHistoryItem } from "@repo/types";
import { attemptsFor, getProviderChain } from "./providers";
import { runWithFallback, type RunMeta } from "./runWithFallback";
import type { TokenUsage } from "./design";
import { describeGraph, type FlowGraph } from "./graph";

const SYSTEM_PROMPT = `You are a principal software architect. From a system design diagram (nodes and edges)
and the team's conversation, write a complete technical specification in Markdown.

Use exactly these top-level sections:
1. Executive Summary
2. System Architecture Overview
3. Component Breakdown (one subsection per component: responsibility, interfaces, data owned)
4. Data Flow & Interfaces (walk the edges; name protocols and payloads)
5. Data Models
6. Security, Reliability & Scaling
7. Deployment & Operations
8. Open Questions

Ground every statement in the diagram. Where the diagram is silent, say so in Open Questions rather
than inventing components. Output Markdown only, starting with a single "#" title.`;

interface SpecInput {
    projectName: string;
    graph: FlowGraph;
    chatHistory: ChatHistoryItem[];
}

export interface SpecResult {
    markdown: string;
    meta: RunMeta;
    usage: TokenUsage;
}

const OFFLINE_META: RunMeta = {
    provider: "offline",
    modelId: "deterministic",
    label: "Offline generator",
    latencyMs: 0,
    fellBack: false,
    attempts: [],
};

// A real spec is long; a few lines means the model gave up or was cut off.
const MIN_SPEC_CHARS = 400;

// Specs are far longer than design plans, so each attempt gets twice the usual time.
const SPEC_TIMEOUT_SCALE = 2;

export const generateSpecMarkdown = async (input: SpecInput, options: { signal?: AbortSignal } = {}): Promise<SpecResult> => {
    const chain = getProviderChain();
    if (chain.length === 0) return { markdown: fallbackSpecMarkdown(input), meta: OFFLINE_META, usage: {} };

    const conversation = input.chatHistory.length
        ? input.chatHistory.map((item) => `${item.role}: ${item.content}`).join("\n")
        : "(no conversation)";

    const { value, meta } = await runWithFallback(
        attemptsFor(
            async (provider, signal) => {
                const { text, usage } = await generateText({
                    model: provider.model,
                    system: SYSTEM_PROMPT,
                    prompt: `Project: ${input.projectName}\n\n${describeGraph(input.graph)}\n\nConversation:\n${conversation}`,
                    providerOptions: provider.providerOptions,
                    abortSignal: signal,
                    maxRetries: 0,
                    temperature: 0.3,
                    maxOutputTokens: 8000,
                });
                return { markdown: text.trim(), usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens } };
            },
            chain,
            SPEC_TIMEOUT_SCALE
        ),
        {
            signal: options.signal,
            validate: ({ markdown }) => {
                if (markdown.length < MIN_SPEC_CHARS) throw new Error("The spec came back too short");
            },
        }
    );

    return { markdown: value.markdown, meta, usage: value.usage };
};

/*
  Deterministic spec built straight from the graph, used when no Gemini key is configured. It is
  plainer than a model's, but it is accurate: it only states what the canvas contains.
 */
export const fallbackSpecMarkdown = ({ projectName, graph }: SpecInput): string => {
    const labels = new Map(graph.nodes.map((node) => [node.id, node.data?.label || node.id]));
    const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const components = graph.nodes.length
        ? graph.nodes
              .map((node) => {
                  const label = node.data?.label || node.id;
                  const outgoing = graph.edges.filter((edge) => edge.source === node.id);
                  const incoming = graph.edges.filter((edge) => edge.target === node.id);
                  return [
                      `### ${label}`,
                      `- **Kind:** ${node.data?.shape ?? "rectangle"}`,
                      `- **Receives from:** ${incoming.map((edge) => labels.get(edge.source)).join(", ") || "nothing on the diagram"}`,
                      `- **Sends to:** ${outgoing.map((edge) => labels.get(edge.target)).join(", ") || "nothing on the diagram"}`,
                  ].join("\n");
              })
              .join("\n\n")
        : "_The canvas has no components yet._";

    const flows = graph.edges.length
        ? graph.edges
              .map((edge) => `- **${labels.get(edge.source) ?? edge.source} → ${labels.get(edge.target) ?? edge.target}**${edge.data?.label ? ` — ${edge.data.label}` : ""}`)
              .join("\n")
        : "_No connections are drawn yet._";

    return `# ${projectName} — Technical Specification

**Generated:** ${date}
**Topology:** ${graph.nodes.length} components, ${graph.edges.length} connections

> Offline draft generated from the canvas alone. Set GOOGLE_GENERATIVE_AI_API_KEY on the server for a full AI-written specification.

## 1. Executive Summary

This document describes the system drawn on the "${projectName}" canvas: its components, how they communicate, and what remains to be decided.

## 2. System Architecture Overview

The design consists of ${graph.nodes.length} components connected by ${graph.edges.length} directed connections.

## 3. Component Breakdown

${components}

## 4. Data Flow & Interfaces

${flows}

## 5. Data Models

Not specified on the diagram.

## 6. Security, Reliability & Scaling

Not specified on the diagram.

## 7. Deployment & Operations

Not specified on the diagram.

## 8. Open Questions

- Which components own persistent data, and what are their schemas?
- What are the authentication boundaries between components?
- What are the availability and latency targets?
`;
};
