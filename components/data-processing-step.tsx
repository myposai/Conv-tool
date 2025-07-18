"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, FileSpreadsheet, ArrowLeft, Eye, MessageSquare, Calendar, Hash } from "lucide-react"

interface DataProcessingStepProps {
  fileData: any
  apiConfig: any
  onComplete: (data: any) => void
  onBack: () => void
}

export default function DataProcessingStep({ fileData, apiConfig, onComplete, onBack }: DataProcessingStepProps) {
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [processedData, setProcessedData] = useState<any>(null)
  const [error, setError] = useState<string>("")
  const [previewOffset, setPreviewOffset] = useState(0)
  const [showPreview, setShowPreview] = useState(false)

  const processFile = async () => {
    setProcessing(true)
    setProgress(0)
    setError("")

    try {
      const formData = new FormData()
      formData.append("file", fileData.file)

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch("/api/process-data", {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)

      // Handle response properly
      if (!response.ok) {
        const errorText = await response.text()
        try {
          // Try to parse as JSON
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.error || `Processing failed: ${response.statusText}`)
        } catch (parseError) {
          // If not valid JSON, use the raw text
          throw new Error(`Server error: ${errorText.substring(0, 200)}...`)
        }
      }

      // Parse the JSON response
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || "Processing failed")
      }

      // Add API config to the result so it gets passed through
      result.apiConfig = apiConfig

      setProcessedData(result)
      setShowPreview(true)
    } catch (err) {
      console.error("Processing error:", err)
      setError(err instanceof Error ? err.message : "Processing failed")
    } finally {
      setProcessing(false)
    }
  }

  const loadMorePreview = () => {
    setPreviewOffset((prev) => prev + 20)
  }

  const getCurrentPreview = () => {
    if (!processedData?.conversations) return []
    return processedData.conversations.slice(previewOffset, previewOffset + 20)
  }

  const hasMorePreview = () => {
    if (!processedData?.conversations) return false
    return previewOffset + 20 < processedData.conversations.length
  }

  const handleNext = () => {
    if (processedData) {
      onComplete(processedData)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Process Chat Data</h3>
        <p className="text-gray-600">
          Restructuring conversations from individual messages to complete conversation threads
        </p>
      </div>

      {apiConfig?.demoMode && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Demo Mode:</strong> Data processing works the same in both demo and live modes.
          </AlertDescription>
        </Alert>
      )}

      {!processedData && !processing && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              File Ready for Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="font-medium">File: {fileData.fileName}</div>
                <div className="text-sm text-gray-600">Size: {(fileData.fileSize / 1024 / 1024).toFixed(2)} MB</div>
              </div>

              <div className="text-sm text-gray-600">
                <strong>Processing will:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Parse timestamps and extract dates</li>
                  <li>Sort messages chronologically within conversations</li>
                  <li>Group messages by ConvID into complete conversations</li>
                  <li>Format as "role: message" entries</li>
                  <li>Provide detailed preview with pagination</li>
                </ul>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Expected columns:</strong> ConvID, Date/Time, Role, Message. Make sure your Excel file has
                  these column headers.
                </AlertDescription>
              </Alert>

              <Button onClick={processFile} className="w-full">
                Start Processing
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {processing && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="text-lg font-medium">Processing your data...</div>
              <Progress value={progress} className="w-full" />
              <div className="text-sm text-gray-600">{progress}% complete</div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Error:</strong> {error}
            <br />
            <span className="text-xs mt-1 block">
              Please check that your Excel file has the correct format with columns: ConvID, Date/Time, Role, Message
            </span>
          </AlertDescription>
        </Alert>
      )}

      {processedData && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Processing Complete
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Hash className="w-4 h-4 text-blue-600" />
                      <div className="text-2xl font-bold text-blue-600">{processedData.totalConversations}</div>
                    </div>
                    <div className="text-sm text-blue-800">Conversations</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="w-4 h-4 text-green-600" />
                      <div className="text-2xl font-bold text-green-600">{processedData.totalMessages}</div>
                    </div>
                    <div className="text-sm text-green-800">Total Messages</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Eye className="w-4 h-4 text-purple-600" />
                      <div className="text-2xl font-bold text-purple-600">{processedData.avgMessagesPerConv}</div>
                    </div>
                    <div className="text-sm text-purple-800">Avg per Conv</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-orange-600" />
                      <div className="text-xs font-bold text-orange-600">{processedData.dateRange}</div>
                    </div>
                    <div className="text-sm text-orange-800">Date Range</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {showPreview && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Conversation Preview</span>
                  <span className="text-sm font-normal text-gray-500">
                    Showing {previewOffset + 1}-{Math.min(previewOffset + 20, processedData.totalConversations)} of{" "}
                    {processedData.totalConversations}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {getCurrentPreview().map((conv: any, idx: number) => (
                    <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-center mb-2">
                        <div className="font-medium text-gray-900">ConvID: {conv.ConvID}</div>
                        <div className="flex gap-4 text-sm text-gray-500">
                          <span>Date: {conv.Date}</span>
                          <span>Messages: {conv.MessageCount}</span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-700 bg-white p-3 rounded border max-h-32 overflow-y-auto">
                        {conv.Conversation.split("\n").map((line: string, lineIdx: number) => (
                          <div key={lineIdx} className="mb-1">
                            {line.includes(":") ? (
                              <>
                                <span className="font-medium text-blue-600">{line.split(":")[0]}:</span>
                                <span className="ml-1">{line.split(":").slice(1).join(":")}</span>
                              </>
                            ) : (
                              line
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {hasMorePreview() && (
                  <div className="text-center mt-4">
                    <Button variant="outline" onClick={loadMorePreview}>
                      Load Next 20 Conversations
                    </Button>
                  </div>
                )}

                {!hasMorePreview() && processedData.totalConversations > 20 && (
                  <div className="text-center mt-4 text-sm text-gray-500">All conversations loaded</div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {processedData && (
          <Button onClick={handleNext} className="px-8">
            Next: Extract Intents
          </Button>
        )}
      </div>
    </div>
  )
}
