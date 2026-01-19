"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useTaskQueue } from "@/lib/task-queue";
import type { Task } from "@/lib/types/task";
import { useSearchParams } from "next/navigation";
import { useBatchDraftStore } from "@/app/store/batch-draft";
import { Badge } from "@/components/ui/badge";

function BatchTasksPageInner() {
  const taskQueue = useMemo(() => useTaskQueue(), []);

  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft") || "";

  const hasHydrated = useBatchDraftStore((s) => s._hasHydrated);
  const cleanupOldDrafts = useBatchDraftStore((s) => s.cleanupOldDrafts);
  const removeDraft = useBatchDraftStore((s) => s.removeDraft);
  const draft = useBatchDraftStore((s) => (draftId ? s.drafts[draftId] : undefined));

  const [query, setQuery] = useState<string>("请处理该附件");
  const [inputsJson, setInputsJson] = useState<string>("{}");

  useEffect(() => {
    if (!hasHydrated) return;
    cleanupOldDrafts();
  }, [cleanupOldDrafts, hasHydrated]);

  useEffect(() => {
    if (!draft?.inputs) return;
    setInputsJson(JSON.stringify(draft.inputs, null, 2));
  }, [draft?.id]);

  const addWorkflowTasks = () => {
    if (!draftId) {
      toast.error("缺少批量任务草稿 ID，请从聊天页面进入");
      return;
    }

    if (!draft) {
      toast.error("未找到批量任务草稿，可能已过期或被清理");
      return;
    }

    if (!draft.agentId || !draft.userId) {
      toast.error("草稿信息不完整：缺少 agentId/userId");
      return;
    }

    if (!draft.items || draft.items.length === 0) {
      toast.error("草稿中没有可执行的附件");
      return;
    }

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      toast.error("query 不能为空（用于 Chatflow 执行）");
      return;
    }

    let inputs: Record<string, any> = {};
    if (inputsJson.trim()) {
      try {
        const parsed = JSON.parse(inputsJson);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          inputs = parsed;
        } else {
          toast.error("inputs 必须是 JSON 对象");
          return;
        }
      } catch {
        toast.error("inputs JSON 格式不正确");
        return;
      }
    }

    const groupId = draft.id;
    const tasks: Task[] = [];

    for (const item of draft.items) {
      if (!item.uploadFileId) continue;
      const taskId = nanoid();
      tasks.push({
        id: taskId,
        groupId,
        type: "workflow.run",
        status: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        title: `Chatflow 运行 ${item.fileName}`,
        input: {
          mode: "chatflow",
          responseMode: "blocking",
          query: trimmedQuery,
          inputs,
          agentId: draft.agentId,
          userId: draft.userId,
          uploadFileId: item.uploadFileId,
          fileName: item.fileName,
          fileType: item.fileType,
          fileSize: item.fileSize,
          url: item.url,
        },
        progress: { totalProgress: 0 },
      });
    }

    if (tasks.length === 0) {
      toast.error("没有可执行的任务（可能缺少 uploadFileId）");
      return;
    }

    taskQueue.addTasks(tasks);
    toast.success(`已添加 ${tasks.length} 个 workflow.run 任务`);
    removeDraft(draftId);
  };

  if (!draftId) {
    return (
      <div className="container mx-auto py-8 px-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>批量任务：Dify Workflow</CardTitle>
            <CardDescription>
              请从聊天页面选择附件后进入该页面（会携带一个 draftId）。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              当前缺少 `draft` 参数。
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasHydrated && !draft) {
    return (
      <div className="container mx-auto py-8 px-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>批量任务：Dify Workflow</CardTitle>
            <CardDescription>
              草稿不存在或已过期，请返回聊天页面重新创建。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">draftId: {draftId}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>批量任务：Dify Chatflow（blocking）</CardTitle>
          <CardDescription>
            使用聊天里已上传的附件（upload_file_id）批量运行 Chatflow（/chat-messages），结果在任务中心查看。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {draft && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium">附件</div>
                <Badge variant="secondary">{draft.items.length}</Badge>
              </div>
              <div className="space-y-1">
                {draft.items.map((item) => (
                  <div
                    key={item.uploadFileId}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate">{item.fileName}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.fileType || "unknown"} · {item.uploadFileId.slice(0, 8)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-sm font-medium">query（用于 Chatflow）</div>
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="例如：请总结附件内容并输出要点"
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">inputs（JSON）</div>
            <Textarea
              value={inputsJson}
              onChange={(e) => setInputsJson(e.target.value)}
              placeholder='例如：{ "lang": "zh-CN" }'
              className="font-mono"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={addWorkflowTasks}>开始批量运行</Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!draftId) return;
                removeDraft(draftId);
                toast.success("已清除草稿");
              }}
            >
              清除草稿
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BatchTasksPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto py-8 px-4">
          <Card>
            <CardHeader>
              <CardTitle>批量任务：Dify Workflow</CardTitle>
              <CardDescription>加载中...</CardDescription>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <BatchTasksPageInner />
    </Suspense>
  );
}
