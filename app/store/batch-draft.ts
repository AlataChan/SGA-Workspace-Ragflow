import { createPersistStore } from "@/app/utils/store";

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_DRAFTS = 50;

export type BatchWorkflowDraftItem = {
  uploadFileId: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  url?: string;
};

export type BatchWorkflowDraft = {
  id: string;
  agentId: string;
  userId: string;
  items: BatchWorkflowDraftItem[];
  inputs?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
};

export type BatchDraftStoreState = {
  drafts: Record<string, BatchWorkflowDraft>;
};

export type BatchDraftStoreMethods = {
  upsertDraft: (draft: BatchWorkflowDraft) => void;
  removeDraft: (draftId: string) => void;
  clearDrafts: () => void;
  getDraft: (draftId: string) => BatchWorkflowDraft | undefined;
  cleanupOldDrafts: () => void;
};

export const useBatchDraftStore = createPersistStore<
  BatchDraftStoreState,
  BatchDraftStoreMethods
>(
  {
    drafts: {},
  },
  (set, get) => ({
    upsertDraft(draft) {
      const now = Date.now();
      const normalized: BatchWorkflowDraft = {
        ...draft,
        createdAt: draft.createdAt ?? now,
        updatedAt: draft.updatedAt ?? now,
      };

      set((state) => ({
        drafts: {
          ...state.drafts,
          [normalized.id]: normalized,
        },
      }));
    },

    removeDraft(draftId) {
      set((state) => {
        const next = { ...state.drafts };
        delete next[draftId];
        return { drafts: next };
      });
    },

    clearDrafts() {
      set(() => ({ drafts: {} }));
    },

    getDraft(draftId) {
      return get().drafts[draftId];
    },

    cleanupOldDrafts() {
      const now = Date.now();
      set((state) => {
        const entries = Object.entries(state.drafts).filter(([, draft]) => {
          return now - draft.updatedAt <= DRAFT_TTL_MS;
        });

        if (entries.length <= MAX_DRAFTS) {
          return { drafts: Object.fromEntries(entries) };
        }

        entries.sort((a, b) => a[1].updatedAt - b[1].updatedAt);
        const kept = entries.slice(entries.length - MAX_DRAFTS);
        return { drafts: Object.fromEntries(kept) };
      });
    },
  }),
  {
    name: "batch-draft-store",
    version: 1,
  },
);

