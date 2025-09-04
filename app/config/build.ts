import { DEFAULT_INPUT_TEMPLATE } from "../constant";

export const getBuildConfig = () => {
  // 检查是否在服务器端
  if (typeof process === "undefined" || typeof window !== "undefined") {
    // 客户端返回默认配置
    return {
      version: "v1.0.0",
      commitDate: "unknown",
      commitHash: "unknown",
      buildMode: "standalone",
      isApp: false,
    };
  }

  const buildMode = process.env.BUILD_MODE ?? "standalone";
  const isApp = !!process.env.BUILD_APP;
  const version = "v1.0.0"; // 默认版本，不依赖tauri配置

  const commitInfo = (() => {
    try {
      const childProcess = require("child_process");
      const commitDate: string = childProcess
        .execSync('git log -1 --format="%at000" --date=unix')
        .toString()
        .trim();
      const commitHash: string = childProcess
        .execSync('git log --pretty=format:"%H" -n 1')
        .toString()
        .trim();

      return { commitDate, commitHash };
    } catch (e) {
      console.error("[Build Config] No git or not from git repo.");
      return {
        commitDate: "unknown",
        commitHash: "unknown",
      };
    }
  })();

  return {
    version,
    ...commitInfo,
    buildMode,
    isApp,
    template: process.env.DEFAULT_INPUT_TEMPLATE ?? DEFAULT_INPUT_TEMPLATE,
  };
};

export type BuildConfig = ReturnType<typeof getBuildConfig>;
