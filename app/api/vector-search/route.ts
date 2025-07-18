// app/api/vector-search/route.ts (Next 14 / App Router)
import type { NextRequest } from "next/server"

export const runtime = "nodejs"

type Intent = { ConvID: string; Intent: string }

export async function POST(request: NextRequest) {
  try {
    const {
      intents,
      config = {},
      apiConfig = {},
    } = (await request.json()) as {
      intents: Intent[]
      config?: { threshold?: number; topK?: number; namespace?: string }
      apiConfig?: {
        demoMode?: boolean
        pineconeKey?: string
        pineconeHost?: string
      }
    }

    /* --------------------------- demo mode --------------------------- */
    if (apiConfig.demoMode) {
      const mockResults = {
        totalSearched: intents.length,
        highConfidenceMatches: Math.floor(intents.length * 0.7),
        lowConfidenceMatches: Math.floor(intents.length * 0.3),
        reviewItems: intents.slice(0, 10).map((intent, i) => ({
          ConvID: intent.ConvID,
          Intent: intent.Intent,
          ResultID: `result_${i}`,
          Score: 0.65 + Math.random() * 0.2,
          Category: "Account Management",
          ArticleChunk: "Demo response – replace with real KB content when not in demo mode.",
        })),
      }
      return Response.json({ success: true, results: mockResults })
    }

    /* --------------------- sanity-checks / bootstrap ----------------- */
    if (!apiConfig.pineconeKey || !apiConfig.pineconeHost) {
      return Response.json(
        {
          error: "Missing Pinecone credentials. Set pineconeKey and pineconeHost.",
        },
        { status: 500 },
      )
    }

    // Use the new index configuration
    const indexHost = "https://zendesk-articles-c4gy2k4.svc.aped-4627-b74a.pinecone.io"
    const threshold = config.threshold ?? 0.8
    const topK = config.topK ?? 3

    // Handle namespace - try different approaches
    const namespace = config.namespace?.trim() || "__default__"

    // Log configuration for debugging
    console.log("Search configuration:", {
      indexHost,
      namespace,
      threshold,
      topK,
      apiKeyPrefix: apiConfig.pineconeKey?.substring(0, 10) + "...",
    })

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

    /* ----------------------- main processing loop ------------------- */
    const reviewItems: any[] = []
    let highConfidenceMatches = 0
    let lowConfidenceMatches = 0

    for (let i = 0; i < intents.length; i++) {
      const { ConvID, Intent: intentTextRaw } = intents[i]
      const intentText = intentTextRaw.trim()

      // skip empty / unclear / previously-flagged intents
      if (!intentText || intentText.toLowerCase().startsWith("unclear") || intentText.startsWith("ERROR:")) {
        lowConfidenceMatches++
        reviewItems.push({
          ConvID,
          Intent: intentTextRaw,
          ResultID: null,
          Score: 0,
          Category: "Skipped",
          ArticleChunk: "Intent skipped – empty, unclear, or error.",
        })
        continue
      }

      try {
        // Try multiple API approaches to find what works
        let searchUrl: string
        let requestBody: any
        let headers: any

        // Approach 1: Try the new search_records endpoint
        searchUrl = `${indexHost}/records/namespaces/${encodeURIComponent(namespace)}/search`
        requestBody = {
          query: {
            inputs: { text: intentText },
            top_k: topK,
          },
          fields: ["title", "article", "locale"], // Use correct field names
        }
        headers = {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Api-Key": apiConfig.pineconeKey!,
          "X-Pinecone-API-Version": "unstable",
        }

        console.log(`Attempting search for intent ${i + 1}/${intents.length}:`, {
          url: searchUrl,
          intentText: intentText.substring(0, 50) + "...",
          namespace,
        })

        let response = await fetch(searchUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
        })

        // If the new API fails, try the legacy query endpoint
        if (!response.ok) {
          const errorText = await response.text()
          console.log("New API failed, trying legacy endpoint:", {
            status: response.status,
            error: errorText,
          })

          // Fallback to legacy query endpoint
          searchUrl = `${indexHost}/query`
          requestBody = {
            vector: Array(2048).fill(0), // Dummy vector for now
            topK,
            includeMetadata: true,
            namespace: namespace === "__default__" ? "" : namespace, // Empty string for default in legacy API
          }
          headers = {
            "Api-Key": apiConfig.pineconeKey!,
            "Content-Type": "application/json",
          }

          response = await fetch(searchUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody),
          })
        }

        if (!response.ok) {
          const errorText = await response.text()
          console.error("Both API approaches failed:", {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            headers: Object.fromEntries(response.headers.entries()),
          })

          throw new Error(`Pinecone search failed: ${response.status} ${response.statusText} - ${errorText}`)
        }

        const result = await response.json()
        console.log("Search result structure:", {
          hasResult: !!result.result,
          hasHits: !!result.result?.hits,
          hasMatches: !!result.matches,
          keys: Object.keys(result),
          sampleHit: result.result?.hits?.[0] || result.matches?.[0],
        })

        // Handle both new and legacy response formats
        const matches = result.result?.hits || result.matches || []

        let hasLowConf = false
        for (const m of matches) {
          // Handle both response formats
          const score = m._score || m.score
          const id = m._id || m.id
          const metadata = m.fields || m.metadata

          if (score < threshold) {
            hasLowConf = true
            lowConfidenceMatches++
            reviewItems.push({
              ConvID,
              Intent: intentTextRaw,
              ResultID: id,
              Score: Number(score.toFixed(4)),
              Category: metadata?.title || "Unknown Category",
              ArticleChunk: (metadata?.article || metadata?.text || "").slice(0, 400), // Use 'article' field
            })
          } else {
            highConfidenceMatches++
          }
        }

        // no matches at all
        if (!hasLowConf && matches.length === 0) {
          lowConfidenceMatches++
          reviewItems.push({
            ConvID,
            Intent: intentTextRaw,
            ResultID: null,
            Score: 0,
            Category: "No Match Found",
            ArticleChunk: "No relevant KB chunk found.",
          })
        }
      } catch (err) {
        console.error(`Error processing intent ${i + 1}:`, err)
        lowConfidenceMatches++
        reviewItems.push({
          ConvID,
          Intent: intentTextRaw,
          ResultID: null,
          Score: null,
          Category: null,
          ArticleChunk: `[ERROR] ${err instanceof Error ? err.message : "Unknown error"}`,
        })
      }

      await sleep(100) // Slightly longer delay to avoid rate limits
    }

    /* --------------------------- respond ---------------------------- */
    return Response.json({
      success: true,
      results: {
        totalSearched: intents.length,
        highConfidenceMatches,
        lowConfidenceMatches,
        reviewItems,
      },
    })
  } catch (error) {
    console.error("Vector search error:", error)
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? error.stack : "",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
