import { describe, expect, it } from "vitest"
import { parseMdmDataArray } from "@/lib/mdm/client"

describe("parseMdmDataArray", () => {
  it("returns array as-is", () => {
    expect(parseMdmDataArray([{ a: 1 }])).toEqual([{ a: 1 }])
  })

  it("parses JSON string array", () => {
    expect(parseMdmDataArray('[{"id":1},{"id":2}]')).toEqual([{ id: 1 }, { id: 2 }])
  })

  it("returns empty array for empty string", () => {
    expect(parseMdmDataArray("")).toEqual([])
    expect(parseMdmDataArray("   ")).toEqual([])
  })

  it("returns empty array for non-array JSON", () => {
    expect(parseMdmDataArray('{"id":1}')).toEqual([])
  })

  it("returns empty array for non-parseable string", () => {
    expect(() => parseMdmDataArray("[")).toThrow()
  })
})

