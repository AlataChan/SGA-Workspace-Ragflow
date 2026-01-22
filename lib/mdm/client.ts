import { z } from "zod"

export const mdmCompanyConfigSchema = z.object({
  baseUrl: z.string().url(),
  systemCode: z.string().min(1),
  tenantId: z.string().min(1).optional(),
  pageSize: z.number().int().min(1).max(500).optional(),
})

export type MdmCompanyConfig = z.infer<typeof mdmCompanyConfigSchema>

export interface MdmClientConfig extends MdmCompanyConfig {
  token: string
  timeoutMs?: number
}

export interface MdmQueryListMdByConditionsParams {
  gdCode: string
  conditionInfo: Record<string, unknown>
  pageIndex: number
  pageSize: number
  returnJson?: 0 | 1
  returnSubEntityCodeList?: string[]
}

export interface MdmPageInfo {
  pageIndex?: number
  pageSize?: number
  pageCount?: number
  totalCount?: number
}

export interface MdmQueryListMdByConditionsResponse<T> {
  pageInfo?: MdmPageInfo
  data?: T[] | string
  [key: string]: unknown
}

export function parseMdmDataArray<T>(data: unknown): T[] {
  if (!data) return []
  if (Array.isArray(data)) return data as T[]
  if (typeof data === "string") {
    const trimmed = data.trim()
    if (!trimmed) return []
    const parsed = JSON.parse(trimmed) as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : []
  }
  return []
}

export async function queryListMdByConditions<T>(
  config: MdmClientConfig,
  params: MdmQueryListMdByConditionsParams,
): Promise<MdmQueryListMdByConditionsResponse<T>> {
  const url = new URL("queryListMdByConditions", config.baseUrl).toString()

  const headers: Record<string, string> = {
    "content-type": "application/json",
    mdmtoken: config.token,
  }
  if (config.tenantId) headers.tenantid = config.tenantId

  const body = {
    systemCode: config.systemCode,
    gdCode: params.gdCode,
    returnJson: params.returnJson ?? 1,
    conditionInfo: params.conditionInfo,
    pageIndex: params.pageIndex,
    pageSize: params.pageSize,
    returnSubEntityCodeList: params.returnSubEntityCodeList ?? ["*"],
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeoutMs ?? 30_000),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(
      `MDM 请求失败: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`,
    )
  }

  return (await response.json()) as MdmQueryListMdByConditionsResponse<T>
}

