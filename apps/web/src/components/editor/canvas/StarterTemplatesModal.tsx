"use client"

import { useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CANVAS_TEMPLATES, type CanvasTemplate } from "./starter-templates"
import { LayoutTemplate, ArrowRight } from "lucide-react"
import { useTheme } from "@/lib/theme"
import { themedNodeColors } from "@/lib/nodeTheme"

interface StarterTemplatesModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (template: CanvasTemplate) => void
}

function TemplatePreview({ template }: { template: CanvasTemplate }) {
  const { resolved: theme } = useTheme()
  const svgWidth = 280
  const svgHeight = 140

  const { minX, maxX, minY, maxY } = useMemo(() => {
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    template.nodes.forEach((node) => {
      const w = Number(node.style?.width) || 100
      const h = Number(node.style?.height) || 50
      if (node.position.x < minX) minX = node.position.x
      if (node.position.x + w > maxX) maxX = node.position.x + w
      if (node.position.y < minY) minY = node.position.y
      if (node.position.y + h > maxY) maxY = node.position.y + h
    })

    return { minX, maxX, minY, maxY }
  }, [template])

  const graphW = Math.max(1, maxX - minX)
  const graphH = Math.max(1, maxY - minY)
  const scale = Math.min((svgWidth - 40) / graphW, (svgHeight - 40) / graphH)

  const nodePosMap = useMemo(() => {
    const map = new Map<string, { cx: number; cy: number; x: number; y: number; w: number; h: number }>()
    template.nodes.forEach((n) => {
      const w = (Number(n.style?.width) || 100) * scale
      const h = (Number(n.style?.height) || 50) * scale
      const x = (n.position.x - minX) * scale + (svgWidth - graphW * scale) / 2
      const y = (n.position.y - minY) * scale + (svgHeight - graphH * scale) / 2
      map.set(n.id, { x, y, w, h, cx: x + w / 2, cy: y + h / 2 })
    })
    return map
  }, [template, minX, minY, scale, graphW, graphH])

  return (
    <div className="w-full h-[140px] bg-base/90 rounded-xl border border-surface-border-subtle overflow-hidden relative flex items-center justify-center p-2">
      <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full select-none">
        {/* Render Edges */}
        {template.edges.map((edge) => {
          const source = nodePosMap.get(edge.source)
          const target = nodePosMap.get(edge.target)
          if (!source || !target) return null
          return (
            <line
              key={edge.id}
              x1={source.cx}
              y1={source.cy}
              x2={target.cx}
              y2={target.cy}
              stroke="var(--canvas-edge)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              opacity="0.8"
            />
          )
        })}

        {/* Render Nodes */}
        {template.nodes.map((node) => {
          const pos = nodePosMap.get(node.id)
          if (!pos) return null
          const { bg: fillColor, text: strokeColor } = themedNodeColors(
            node.data.color || "#1F1F1F",
            node.data.textColor || "#EDEDED",
            theme
          )

          return (
            <g key={node.id}>
              {node.data.shape === "circle" ? (
                <ellipse
                  cx={pos.cx}
                  cy={pos.cy}
                  rx={pos.w / 2}
                  ry={pos.h / 2}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth="1.2"
                />
              ) : node.data.shape === "pill" ? (
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={pos.w}
                  height={pos.h}
                  rx={pos.h / 2}
                  ry={pos.h / 2}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth="1.2"
                />
              ) : (
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={pos.w}
                  height={pos.h}
                  rx="4"
                  ry="4"
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth="1.2"
                />
              )}
              <text
                x={pos.cx}
                y={pos.cy + 3}
                fill={strokeColor}
                fontSize="8"
                fontWeight="600"
                fontFamily="monospace"
                textAnchor="middle"
                className="pointer-events-none"
              >
                {node.data.label.length > 12 ? `${node.data.label.slice(0, 10)}…` : node.data.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function StarterTemplatesModal({
  isOpen,
  onClose,
  onImport,
}: StarterTemplatesModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-elevated border-surface-border rounded-3xl p-6 shadow-2xl text-copy-primary sm:max-w-3xl">
        <DialogHeader className="pb-4 border-b border-surface-border-subtle">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-dim text-brand border border-brand/20">
              <LayoutTemplate className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-mono font-bold tracking-tight text-brand">
                Starter System Templates
              </DialogTitle>
              <DialogDescription className="text-xs text-copy-muted">
                Choose a pre-built architecture diagram to load directly onto your canvas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Template Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
          {CANVAS_TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              className="group flex flex-col bg-surface border border-surface-border-subtle hover:border-brand/50 rounded-2xl p-3 transition-all duration-200 hover:shadow-xl relative"
            >
              {/* Preview */}
              <TemplatePreview template={tmpl} />

              {/* Title & Description */}
              <div className="flex-1 py-3 space-y-1">
                <h4 className="text-sm font-semibold font-mono text-copy-primary group-hover:text-brand transition-colors">
                  {tmpl.name}
                </h4>
                <p className="text-xs text-copy-muted leading-relaxed line-clamp-3">
                  {tmpl.description}
                </p>
              </div>

              {/* Action Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onImport(tmpl)
                  onClose()
                }}
                className="w-full mt-2 h-8 text-xs font-mono gap-1.5 border-surface-border-subtle hover:bg-brand hover:text-primary-foreground hover:border-brand transition-all cursor-pointer"
              >
                <span>Import Diagram</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
