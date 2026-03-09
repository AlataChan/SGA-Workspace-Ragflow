import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import BulkRevokeDialog from "@/components/admin/bulk-revoke-dialog"

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
}))

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ children }: any) => <div>{children}</div>,
}))

describe("BulkRevokeDialog", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)

        if (url === "/api/admin/departments/tree") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                companyId: "c1",
                departments: [
                  {
                    id: "d_root",
                    companyId: "c1",
                    name: "Root",
                    icon: null,
                    sortOrder: 0,
                    isActive: true,
                    parentId: null,
                    children: [
                      {
                        id: "d_child",
                        companyId: "c1",
                        name: "Child",
                        icon: null,
                        sortOrder: 0,
                        isActive: true,
                        parentId: "d_root",
                        children: [],
                      },
                    ],
                  },
                ],
              },
              message: "ok",
            }),
          } as any
        }

        if (url === "/api/admin/agents/a1/department-grants") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                agentId: "a1",
                grants: [
                  {
                    id: "g1",
                    departmentId: "d_child",
                    includeSubDepartments: true,
                    isActive: true,
                  },
                ],
              },
              message: "ok",
            }),
          } as any
        }

        throw new Error(`Unexpected fetch: ${url}`)
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("preselects active granted departments when dialog opens", async () => {
    render(
      <BulkRevokeDialog
        open={true}
        onOpenChange={vi.fn()}
        resourceType="agent"
        resourceId="a1"
        resourceName="Agent A"
      />,
    )

    expect(await screen.findByText("已选择：1 个部门")).toBeInTheDocument()
  })
})

