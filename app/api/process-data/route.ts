import type { NextRequest } from "next/server"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 })
    }

    // Import XLSX dynamically to avoid bundling issues
    const XLSX = await import("xlsx")

    // Read Excel file
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "buffer" })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet)

    console.log("Raw data sample:", data.slice(0, 3))

    // Process data similar to the Python script
    const processedData = data.map((row: any, index: number) => {
      let dateTime: Date
      let date: string

      try {
        // Handle various date formats
        const dateValue = row["Date/Time"]

        if (!dateValue) {
          dateTime = new Date()
          date = dateTime.toISOString().split("T")[0]
        } else if (typeof dateValue === "number") {
          // Excel serial date number
          dateTime = new Date((dateValue - 25569) * 86400 * 1000)
          date = dateTime.toISOString().split("T")[0]
        } else if (typeof dateValue === "string") {
          dateTime = new Date(dateValue)
          if (isNaN(dateTime.getTime())) {
            // Try common date formats
            const formats = [
              dateValue.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, "$3-$1-$2"),
              dateValue.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, "$3-$2-$1"),
              dateValue.replace(/(\d{4})-(\d{1,2})-(\d{1,2})/, "$1-$2-$3"),
            ]

            for (const format of formats) {
              dateTime = new Date(format)
              if (!isNaN(dateTime.getTime())) break
            }

            if (isNaN(dateTime.getTime())) {
              console.warn(`Invalid date at row ${index}: ${dateValue}`)
              dateTime = new Date()
            }
          }
          date = dateTime.toISOString().split("T")[0]
        } else if (dateValue instanceof Date) {
          dateTime = dateValue
          date = dateTime.toISOString().split("T")[0]
        } else {
          dateTime = new Date()
          date = dateTime.toISOString().split("T")[0]
        }
      } catch (error) {
        console.warn(`Date parsing error at row ${index}:`, error)
        dateTime = new Date()
        date = dateTime.toISOString().split("T")[0]
      }

      return {
        ConvID: row.ConvID || `conv_${index}`,
        DateTime: dateTime,
        Date: date,
        Role: (row.Role || "").toString().trim(),
        Message: (row.Message || "").toString().trim(),
      }
    })

    // Sort by ConvID and DateTime
    processedData.sort((a, b) => {
      const convIdA = typeof a.ConvID === "number" ? a.ConvID : Number.parseInt(String(a.ConvID)) || 0
      const convIdB = typeof b.ConvID === "number" ? b.ConvID : Number.parseInt(String(b.ConvID)) || 0

      if (convIdA !== convIdB) {
        return convIdA - convIdB
      }
      return a.DateTime.getTime() - b.DateTime.getTime()
    })

    // Group by ConvID and build conversations
    const conversationMap = new Map()

    processedData.forEach((row) => {
      const convId = row.ConvID

      if (!conversationMap.has(convId)) {
        conversationMap.set(convId, {
          ConvID: convId,
          Date: row.Date,
          messages: [],
          rawEntries: [],
        })
      }

      const conversation = conversationMap.get(convId)

      // Only add non-empty messages
      if (row.Role && row.Message) {
        const entry = `${row.Role}: ${row.Message}`
        conversation.messages.push(entry)
        conversation.rawEntries.push({
          Role: row.Role,
          Message: row.Message,
          DateTime: row.DateTime,
        })
      }
    })

    // Convert to final format with proper conversation text
    const conversations = Array.from(conversationMap.values())
      .filter((conv) => conv.messages.length > 0) // Only keep conversations with actual messages
      .map((conv) => ({
        ConvID: conv.ConvID,
        Date: conv.Date,
        Conversation: conv.messages.join("\n"),
        MessageCount: conv.messages.length,
        RawEntries: conv.rawEntries,
      }))

    console.log("Processed conversations sample:", conversations.slice(0, 2))

    // Calculate statistics
    const dates = conversations.map((r) => new Date(r.Date)).sort((a, b) => a.getTime() - b.getTime())
    const dateRange =
      dates.length > 0
        ? `${dates[0].toISOString().split("T")[0]} to ${dates[dates.length - 1].toISOString().split("T")[0]}`
        : "No dates found"

    const totalMessages = conversations.reduce((sum, conv) => sum + conv.MessageCount, 0)
    const avgMessagesPerConv = conversations.length > 0 ? (totalMessages / conversations.length).toFixed(1) : "0"

    return Response.json({
      success: true,
      conversations,
      totalConversations: conversations.length,
      totalMessages,
      avgMessagesPerConv,
      dateRange,
      uniqueConvIds: conversationMap.size,
      preview: conversations.slice(0, 20), // First 20 for preview
    })
  } catch (error) {
    console.error("Processing error details:", error)

    let errorMessage = "Failed to process file"
    let errorDetails = "Unknown error"

    if (error instanceof Error) {
      errorDetails = error.message
      if (error.message.includes("Invalid time value")) {
        errorMessage = "Invalid date format in the Excel file. Please check the Date/Time column format."
      } else if (error.message.includes("ConvID")) {
        errorMessage = "Invalid ConvID format. Please ensure ConvID column contains valid identifiers."
      } else if (error.message.includes("Cannot read properties")) {
        errorMessage =
          "Invalid Excel file format. Please ensure the file has the required columns: ConvID, Date/Time, Role, Message."
      } else {
        errorMessage = `Processing error: ${error.message}`
      }
    }

    // Always return a proper JSON response
    return Response.json(
      {
        success: false,
        error: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
