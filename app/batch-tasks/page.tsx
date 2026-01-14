"use client";

import { useMemo, useState } from "react";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useTaskQueue } from "@/lib/task-queue";
import type { Task } from "@/lib/types/task";

export default function BatchTasksPage() {
  const taskQueue = useMemo(() => useTaskQueue(), []);

  const [files, setFiles] = useState<File[]>([]);
  const [inputsJson, setInputsJson] = useState<string>("{}");

  const addWorkflowTasks = () => {
    if (files.length === 0) {
      toast.error("请先选择文件");
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

    const groupId = nanoid();
    const tasks: Task[] = [];
    const runtimeFiles: Record<string, File> = {};

    for (const file of files) {
      const taskId = nanoid();
      tasks.push({
        id: taskId,
        groupId,
        type: "workflow.run",
        status: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        title: `Workflow 运行 ${file.name}`,
        input: {
          responseMode: "blocking",
          inputs,
          fileName: file.name,
          fileType: file.type,
        },
        progress: { totalProgress: 0 },
      });
      runtimeFiles[taskId] = file;
    }

    taskQueue.addTasks(tasks, runtimeFiles);
    toast.success(`已添加 ${tasks.length} 个 workflow.run 任务`);
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>批量任务：Dify Workflow（blocking）</CardTitle>
          <CardDescription>
            选择多个 PDF/Markdown 文件，前端按文件逐个调用 `/api/dify/workflows/run`，结果在任务中心查看。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">文件</div>
            <input
              type="file"
              multiple
              accept=".pdf,.md,.markdown,.txt"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            {files.length > 0 && (
              <div className="text-xs text-muted-foreground">
                已选择 {files.length} 个文件
              </div>
            )}
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
            <Button variant="outline" onClick={() => setFiles([])}>
              清空文件
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

