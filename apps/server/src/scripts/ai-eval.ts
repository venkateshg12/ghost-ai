import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { generateDesignPlan, getProviderChain } from "../utils/ai";

/*
  Compares the configured AI providers on the same design prompts, one provider at a time (no fallback), so
  the numbers describe each model rather than the chain. Run with:

    pnpm --filter server ai:eval                 # every configured provider, all prompts
    pnpm --filter server ai:eval -- --prompts 3  # first three prompts only
    pnpm --filter server ai:eval -- --write      # also save docs/ai-eval.md

  This is how the primary model was chosen, and how to re-choose it when a catalogue changes.
 */
const PROMPTS = [
    "Design an e-commerce backend with payments, search and notifications",
    "Create a real-time chat application architecture with presence and message history",
    "Build a URL shortener that handles 10k redirects per second",
    "Design a CI/CD pipeline from commit to Kubernetes deployment",
    "Design a video streaming platform with upload, transcoding and a CDN",
    "Design an IoT telemetry platform ingesting events from a million devices",
];

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
};

interface Row {
    provider: string;
    model: string;
    prompt: string;
    outcome: "ok" | "rejected" | "error";
    seconds: number;
    nodes: number;
    edges: number;
    edgeValidity: number;
    tokens: number;
    note: string;
}

const percent = (n: number) => `${Math.round(n * 100)}%`;

const main = async () => {
    const chain = getProviderChain();
    if (chain.length === 0) {
        console.error("No AI provider is configured (set NVIDIA_API_KEY and/or GOOGLE_GENERATIVE_AI_API_KEY).");
        process.exit(1);
    }
    const count = Math.min(PROMPTS.length, Number(value("prompts")) || PROMPTS.length);
    const prompts = PROMPTS.slice(0, count);
    const rows: Row[] = [];

    for (const provider of chain) {
        for (const prompt of prompts) {
            const startedAt = Date.now();
            process.stdout.write(`${provider.label.padEnd(20)} ${prompt.slice(0, 50).padEnd(52)}`);
            try {
                const result = await generateDesignPlan(prompt, { nodes: [], edges: [] }, { chain: [provider] });
                const operations = result.plan.operations;
                const nodes = operations.filter((op) => op.type === "add_node").length;
                const edges = operations.filter((op) => op.type === "add_edge").length;
                const droppedEdges = result.dropped.filter((reason) => /edge/.test(reason)).length;
                const row: Row = {
                    provider: provider.provider,
                    model: provider.modelId,
                    prompt,
                    outcome: "ok",
                    seconds: (Date.now() - startedAt) / 1000,
                    nodes,
                    edges,
                    edgeValidity: edges + droppedEdges === 0 ? 0 : edges / (edges + droppedEdges),
                    tokens: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
                    note: result.meta.attempts.length > 1 ? `${result.meta.attempts.length} attempts` : "",
                };
                rows.push(row);
                console.log(`ok   ${row.seconds.toFixed(1)}s  ${nodes} nodes / ${edges} edges`);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                const rejected = /components|connections|None of the proposed/.test(message);
                rows.push({ provider: provider.provider, model: provider.modelId, prompt, outcome: rejected ? "rejected" : "error", seconds: (Date.now() - startedAt) / 1000, nodes: 0, edges: 0, edgeValidity: 0, tokens: 0, note: message.slice(0, 80) });
                console.log(`${rejected ? "rejected" : "error "} ${message.slice(0, 80)}`);
            }
        }
    }

    // One summary line per provider.
    const lines = [
        "| Provider | Model | Success | Avg latency | Avg nodes | Avg edges | Edge validity | Avg tokens |",
        "|---|---|---|---|---|---|---|---|",
    ];
    for (const provider of chain) {
        const mine = rows.filter((row) => row.provider === provider.provider);
        const ok = mine.filter((row) => row.outcome === "ok");
        const avg = (pick: (row: Row) => number) => (ok.length ? ok.reduce((sum, row) => sum + pick(row), 0) / ok.length : 0);
        lines.push(
            `| ${provider.provider} | ${provider.modelId} | ${ok.length}/${mine.length} | ${ok.length ? avg((row) => row.seconds).toFixed(1) + "s" : "—"} | ${ok.length ? avg((row) => row.nodes).toFixed(1) : "—"} | ${ok.length ? avg((row) => row.edges).toFixed(1) : "—"} | ${ok.length ? percent(avg((row) => row.edgeValidity)) : "—"} | ${ok.length ? Math.round(avg((row) => row.tokens)) : "—"} |`
        );
    }
    const table = lines.join("\n");
    console.log(`\n${table}\n`);

    if (flag("write")) {
        const file = path.resolve(process.cwd(), "../../docs/ai-eval.md");
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const body = [
            "# AI provider evaluation",
            "",
            `Generated ${new Date().toISOString().slice(0, 10)} by \`pnpm --filter server ai:eval\`. ${prompts.length} design prompts, each provider on its own (no fallback), empty canvas.`,
            "",
            "*Success* means the plan passed the quality gate (see `planQuality.ts`). *Edge validity* is the share of proposed connections that pointed at real nodes before repair.",
            "",
            table,
            "",
            "## Prompts",
            "",
            ...prompts.map((prompt) => `- ${prompt}`),
            "",
            "## Per-run results",
            "",
            "| Provider | Prompt | Outcome | Latency | Nodes | Edges | Note |",
            "|---|---|---|---|---|---|---|",
            ...rows.map((row) => `| ${row.provider} | ${row.prompt.slice(0, 48)}… | ${row.outcome} | ${row.seconds.toFixed(1)}s | ${row.nodes} | ${row.edges} | ${row.note} |`),
            "",
        ].join("\n");
        fs.writeFileSync(file, body);
        console.log(`Saved ${file}`);
    }
    process.exit(0);
};

void main();
