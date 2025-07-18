import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { results, format } = await request.json()

    if (format === "csv") {
      // Convert to CSV
      const csvHeaders = ["ConvID", "Intent", "ResultID", "Score", "Category", "ArticleChunk"]
      const csvRows = results.reviewItems.map((item: any) => [
        item.ConvID,
        `"${item.Intent.replace(/"/g, '""')}"`,
        item.ResultID || "",
        item.Score || "",
        `"${(item.Category || "").replace(/"/g, '""')}"`,
        `"${(item.ArticleChunk || "").replace(/"/g, '""')}"`,
      ])

      const csvContent = [csvHeaders.join(","), ...csvRows.map((row) => row.join(","))].join("\n")

      return new Response(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="intent-analysis-results.csv"',
        },
      })
    } else {
      // Return JSON
      return new Response(JSON.stringify(results, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": 'attachment; filename="intent-analysis-results.json"',
        },
      })
    }
  } catch (error) {
    console.error("Download error:", error)
    return NextResponse.json({ error: "Download failed" }, { status: 500 })
  }
}
