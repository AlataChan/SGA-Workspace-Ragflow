"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import KnowledgeGraphView from "@/components/temp-kb/knowledge-graph-view";
import TempKbPanel from "@/components/temp-kb/temp-kb-panel";
import { stripRagflowInlineReferenceMarkers } from "@/lib/ragflow-utils";
import { splitThinkTags } from "@/lib/thinking";
import { toast } from "sonner";
import { Eye, Loader2, Network, PanelRight } from "lucide-react";

type BuildState = "idle" | "running" | "done";

export default function KnowledgeGraphActions(props: {
  content: string;
  sourceMessageId: string;
  agentId?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { content, sourceMessageId, agentId, disabled, className } = props;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"preview" | "full">("preview");
  const [buildState, setBuildState] = useState<BuildState>("idle");

  const pollIntervalRef = useRef<number | null>(null);
  const pollTimeoutRef = useRef<number | null>(null);

  const cleanedContent = useMemo(() => {
    const { answer } = splitThinkTags(content);
    return stripRagflowInlineReferenceMarkers(answer).trim();
  }, [content]);

  const clearPollTimers = () => {
    if (pollIntervalRef.current !== null) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollTimeoutRef.current !== null) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearPollTimers();
  }, []);

  useEffect(() => {
    if (!isDialogOpen) {
      setDialogMode("preview");
    }
  }, [isDialogOpen]);

  const getAuthToken = () => {
    const token = localStorage.getItem("auth-token");
    if (!token) throw new Error("未登录");
    return token;
  };

  const saveChunkOnce = async () => {
    const token = getAuthToken();

    const response = await fetch("/api/temp-kb/chunks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        content: cleanedContent,
        sourceMessageId,
        sourceType: "assistant_reply",
        agentId,
      }),
    });

    const result = await response.json();
    if (!result?.success || !result?.data?.chunkId) {
      throw new Error(result?.error || "保存失败");
    }

    window.dispatchEvent(
      new CustomEvent("temp-kb-chunk-saved", {
        detail: { chunkId: result.data.chunkId },
      }),
    );

    return result.data.chunkId as string;
  };

  const triggerBuildGraph = async () => {
    const token = getAuthToken();

    const response = await fetch("/api/temp-kb/graph", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await response.json();
    if (!result?.success) {
      throw new Error(result?.error || "触发构建失败");
    }
  };

  const pollBuildStatus = async () => {
    const token = getAuthToken();

    const response = await fetch("/api/temp-kb/graph/status", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await response.json();
    if (!result?.success || !result?.data?.status) return { done: false };

    if (result.data.status === "completed") return { done: true, ok: true };
    if (result.data.status === "failed") return { done: true, ok: false };
    return { done: false };
  };

  const handleGenerateGraph = async () => {
    if (disabled || buildState === "running" || !cleanedContent) return;

    setBuildState("running");
    clearPollTimers();

    try {
      await saveChunkOnce();
      await triggerBuildGraph();

      pollIntervalRef.current = window.setInterval(async () => {
        try {
          const status = await pollBuildStatus();
          if (status.done) {
            clearPollTimers();
            if (status.ok) {
              setBuildState("done");
              toast.success("图谱生成成功");
            } else {
              setBuildState("idle");
              toast.error("图谱生成失败");
            }
          }
        } catch {
          // ignore transient polling errors
        }
      }, 3000);

      pollTimeoutRef.current = window.setTimeout(() => {
        clearPollTimers();
        setBuildState("idle");
        toast.error("图谱生成超时，请稍后查看");
      }, 300000);
    } catch (e) {
      clearPollTimers();
      setBuildState("idle");
      toast.error(e instanceof Error ? e.message : "生成图谱失败");
    }
  };

  return (
    <>
      <div className={cn("flex items-center gap-1", className)}>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={handleGenerateGraph}
          disabled={disabled || buildState === "running" || !cleanedContent}
        >
          {buildState === "running" ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Network className="h-3.5 w-3.5 mr-1" />
          )}
          {buildState === "running" ? "生成中..." : "生成图谱"}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setIsDialogOpen(true)}
          disabled={disabled || buildState === "running"}
        >
          <Eye className="h-3.5 w-3.5 mr-1" />
          查看图谱
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl h-[86vh] flex flex-col bg-card border border-border p-0">
          <DialogHeader className="flex-shrink-0 px-5 pt-4 pb-2">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="text-foreground">
                {dialogMode === "preview" ? "知识图谱预览" : "我的知识库"}
              </DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setDialogMode((prev) => (prev === "preview" ? "full" : "preview"))
                }
              >
                <PanelRight className="h-4 w-4 mr-2" />
                {dialogMode === "preview" ? "打开完整模块" : "返回预览"}
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-hidden px-5 pb-4">
            {dialogMode === "preview" ? (
              <KnowledgeGraphView height={560} />
            ) : (
              <TempKbPanel className="border-0 shadow-none h-full" compact defaultTab="graph" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
