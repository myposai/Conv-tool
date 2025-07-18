import type { NextRequest } from "next/server"

// Force this to run on Node.js runtime
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const { conversations, config, apiConfig } = await request.json()

    // Validate input
    if (!conversations || !Array.isArray(conversations)) {
      return Response.json({ error: "Invalid conversations data" }, { status: 400 })
    }

    // Limit batch size to prevent payload issues
    const maxBatchSize = 25
    if (conversations.length > maxBatchSize) {
      return Response.json(
        {
          error: `Batch too large. Maximum ${maxBatchSize} conversations per request. Received ${conversations.length}.`,
          maxBatchSize,
        },
        { status: 400 },
      )
    }

    console.log(`Processing batch of ${conversations.length} conversations`)

    // Check if we're in demo mode
    if (apiConfig?.demoMode) {
      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Create mock results for demo mode
      const mockResults = conversations.map((conv: any) => ({
        ConvID: conv.ConvID,
        Date: conv.Date,
        Conversation: conv.Conversation.substring(0, 100) + "...",
        Intent: `Mock intent: How do I ${["reset my password", "update my profile", "cancel my subscription", "contact support", "change my email"][Math.floor(Math.random() * 5)]}?`,
      }))

      return Response.json({
        success: true,
        message: `Intent extraction simulation successful for batch of ${conversations.length} conversations (Demo Mode)`,
        result: {
          intents: mockResults,
          totalProcessed: mockResults.length,
          successfulExtractions: mockResults.length,
          unclearIntents: 0,
          errorCount: 0,
          sample: mockResults.slice(0, 3),
        },
      })
    }

    // Real API mode - use actual OpenAI API
    if (!apiConfig?.openaiKey || apiConfig.openaiKey === "demo-mode") {
      return Response.json(
        {
          error: "OpenAI API key is not configured. Please go back and configure your API keys.",
          apiKeyConfigured: false,
        },
        { status: 500 },
      )
    }

    // Validate API key format
    if (!apiConfig.openaiKey.startsWith("sk-")) {
      return Response.json(
        {
          error: "Invalid OpenAI API key format. Key should start with 'sk-'",
          apiKeyConfigured: true,
          apiKeyFormat: "Invalid format",
        },
        { status: 500 },
      )
    }

    console.log(`Starting real intent extraction for ${conversations.length} conversations`)

    const results = []
    let successfulExtractions = 0
    let unclearIntents = 0
    let errorCount = 0

    try {
      // Create the prompt for intent extraction
      const prompt = `You are an expert at analyzing customer service conversations and extracting clear, actionable customer intents.

For each conversation below, extract the main customer intent in a clear, concise sentence. Focus on what the customer is trying to accomplish or what problem they're trying to solve. 
Each intent should be stated as a clear question rather than a message. 
For example instead of "The customer is asking how to change their password" it should be stated as "How to change my password". 
If multiple intents are identified focus on the initial question the visitor came with. Disregard the response from the agent as it might be misleading.
Always respond in English. For conversations that are in a different language try to preserve the meaning as much as possible but there is no need to translate things word for word. 

Format your response as a JSON array with objects containing "ConvID" and "Intent" fields.

Conversations:
${conversations.map((conv: any) => `ConvID: ${conv.ConvID}\nConversation:\n${conv.Conversation}\n---`).join("\n")}

Respond with only the JSON array, no additional text.`

      // Make the actual OpenAI API call
      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiConfig.openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model || "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are an expert at analyzing customer service conversations and extracting customer intents. Always respond with valid JSON.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.1,
          max_tokens: 3000,
        }),
      })

      if (!openaiResponse.ok) {
        const errorData = await openaiResponse.text()
        let parsedError = errorData
        try {
          // Try to parse as JSON for better error details
          const errorJson = JSON.parse(errorData)
          parsedError = errorJson.error?.message || errorJson.error || errorData

          // Check for specific permission errors
          if (
            errorJson.error?.message?.includes("insufficient permissions") ||
            errorJson.error?.message?.includes("model.request") ||
            openaiResponse.status === 401
          ) {
            return Response.json(
              {
                success: false,
                error:
                  "OpenAI API key permission error: Your API key doesn't have the necessary permissions to use this model.",
                details: errorJson.error?.message || "Missing required scopes or insufficient permissions",
                permissionError: true,
                status: openaiResponse.status,
              },
              { status: 403 },
            )
          }
        } catch (e) {
          // If not valid JSON, use the raw text
          console.error("Failed to parse OpenAI error:", e)
        }

        console.error(`OpenAI API error: ${openaiResponse.status} - ${parsedError}`)

        // Add error entries for this batch
        conversations.forEach((conv: any) => {
          results.push({
            ConvID: conv.ConvID,
            Date: conv.Date,
            Conversation: conv.Conversation.substring(0, 100) + "...",
            Intent: `ERROR: API call failed - ${openaiResponse.status} - ${parsedError.substring(0, 100)}`,
          })
          errorCount++
        })

        return Response.json({
          success: false,
          message: `Batch processing failed with API errors`,
          error: `OpenAI API error: ${openaiResponse.status} - ${parsedError.substring(0, 200)}`,
          result: {
            intents: results,
            totalProcessed: results.length,
            successfulExtractions,
            unclearIntents,
            errorCount,
            sample: results.slice(0, 3),
          },
        })
      }

      const openaiResult = await openaiResponse.json()
      const content = openaiResult.choices?.[0]?.message?.content

      if (!content) {
        console.error("No content in OpenAI response")
        conversations.forEach((conv: any) => {
          results.push({
            ConvID: conv.ConvID,
            Date: conv.Date,
            Conversation: conv.Conversation.substring(0, 100) + "...",
            Intent: "ERROR: No response from AI",
          })
          errorCount++
        })

        return Response.json({
          success: true,
          message: `Batch processed with no AI response`,
          result: {
            intents: results,
            totalProcessed: results.length,
            successfulExtractions,
            unclearIntents,
            errorCount,
            sample: results.slice(0, 3),
          },
        })
      }

      try {
        // Parse the JSON response - handle both string and already parsed JSON
        let extractedIntents

        // First, clean the content to remove any markdown code blocks or extra text
        let cleanedContent = content

        // Remove markdown code blocks if present
        if (cleanedContent.includes("```json")) {
          cleanedContent = cleanedContent.replace(/```json\n|\n```/g, "")
        } else if (cleanedContent.includes("```")) {
          cleanedContent = cleanedContent.replace(/```\n|\n```/g, "")
        }

        // Trim any extra text before or after the JSON
        const jsonStartIndex = cleanedContent.indexOf("[")
        const jsonEndIndex = cleanedContent.lastIndexOf("]") + 1

        if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
          cleanedContent = cleanedContent.substring(jsonStartIndex, jsonEndIndex)
        }

        // Now parse the cleaned content
        extractedIntents = JSON.parse(cleanedContent)

        if (Array.isArray(extractedIntents)) {
          extractedIntents.forEach((item: any) => {
            const originalConv = conversations.find((conv: any) => conv.ConvID === item.ConvID)
            if (originalConv && item.Intent) {
              results.push({
                ConvID: item.ConvID,
                Date: originalConv.Date,
                Conversation: originalConv.Conversation.substring(0, 100) + "...",
                Intent: item.Intent,
              })

              if (item.Intent.toLowerCase().includes("unclear") || item.Intent.toLowerCase().includes("unknown")) {
                unclearIntents++
              } else {
                successfulExtractions++
              }
            }
          })
        } else {
          throw new Error("Response is not an array")
        }
      } catch (parseError) {
        console.error("Failed to parse OpenAI response:", content)
        conversations.forEach((conv: any) => {
          results.push({
            ConvID: conv.ConvID,
            Date: conv.Date,
            Conversation: conv.Conversation.substring(0, 100) + "...",
            Intent: "ERROR: Failed to parse AI response",
          })
          errorCount++
        })
      }
    } catch (batchError) {
      console.error(`Error processing batch:`, batchError)
      conversations.forEach((conv: any) => {
        results.push({
          ConvID: conv.ConvID,
          Date: conv.Date,
          Conversation: conv.Conversation.substring(0, 100) + "...",
          Intent: `ERROR: ${batchError instanceof Error ? batchError.message : "Unknown error"}`,
        })
        errorCount++
      })
    }

    console.log(`Batch complete: ${successfulExtractions} successful, ${unclearIntents} unclear, ${errorCount} errors`)

    return Response.json({
      success: true,
      message: `Batch of ${conversations.length} conversations processed using ${config.model || "gpt-4o-mini"}`,
      result: {
        intents: results,
        totalProcessed: results.length,
        successfulExtractions,
        unclearIntents,
        errorCount,
        sample: results.slice(0, 3),
      },
    })
  } catch (error) {
    console.error("Intent extraction error:", error)

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
        details: error instanceof Error ? error.stack : "No stack trace available",
      },
      { status: 500 },
    )
  }
}
