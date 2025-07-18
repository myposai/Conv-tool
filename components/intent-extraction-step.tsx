"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CheckCircle,
  AlertCircle,
  Brain,
  ArrowLeft,
  Play,
  Pause,
  Key,
  AlertTriangle,
  Download,
  Eye,
  EyeOff,
  Info,
} from "lucide-react"

interface IntentExtractionStepProps {
  processedData: any
  apiConfig: any
  onComplete: (data: any) => void
  onBack: () => void
  onApiConfigUpdate: (config: any) => void
}

export default function IntentExtractionStep({
  processedData,
  apiConfig,
  onComplete,
  onBack,
  onApiConfigUpdate,
}: IntentExtractionStepProps) {
  const [extracting, setExtracting] = useState(false)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentBatch, setCurrentBatch] = useState(0)
  const [totalBatches, setTotalBatches] = useState(0)
  const [processedCount, setProcessedCount] = useState(0)
  const [extractedData, setExtractedData] = useState<any>(null)
  const [error, setError] = useState<string>("")
  const [preview, setPreview] = useState<any[]>([])
  const [statusMessage, setStatusMessage] = useState<string>("")
  const [stats, setStats] = useState({ successful: 0, unclear: 0, errors: 0 })

  // Configuration
  const [model, setModel] = useState("gpt-3.5-turbo") // Changed default to gpt-3.5-turbo
  const [batchSize, setBatchSize] = useState(10)
  const [retryLimit, setRetryLimit] = useState(3)

  const [showApiConfig, setShowApiConfig] = useState(false)
  const [openaiKey, setOpenaiKey] = useState(apiConfig?.openaiKey || "")
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)
  const [apiKeyError, setApiKeyError] = useState<string>("")

  // Check if OpenAI API key is configured
  const needsApiConfig = !apiConfig?.openaiKey || apiConfig.openaiKey === "demo-mode"

  // Show API config if needed and not already shown
  useEffect(() => {
    if (needsApiConfig && !showApiConfig) {
      setShowApiConfig(true)
    }
  }, [needsApiConfig, showApiConfig])

  const startExtraction = async () => {
    setExtracting(true)
    setPaused(false)
    setProgress(0)
    setCurrentBatch(0)
    setProcessedCount(0)
    setError("")
    setApiKeyError("")
    setPreview([])
    setStats({ successful: 0, unclear: 0, errors: 0 })

    try {
      const conversations = processedData.conversations
      const totalConversations = conversations.length
      const calculatedTotalBatches = Math.ceil(totalConversations / batchSize)
      setTotalBatches(calculatedTotalBatches)

      const allResults: any[] = []
      let successfulExtractions = 0
      let unclearIntents = 0
      let errorCount = 0

      // Process conversations in batches
      for (let i = 0; i < totalConversations && !paused; i += batchSize) {
        const batchNumber = Math.floor(i / batchSize) + 1
        setCurrentBatch(batchNumber)

        const batch = conversations.slice(i, i + batchSize)
        setStatusMessage(`Processing batch ${batchNumber}/${calculatedTotalBatches} (${batch.length} conversations)...`)

        try {
          const response = await fetch("/api/extract-intents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversations: batch,
              config: {
                model,
                batchSize: batch.length, // Process all in this batch at once
                retryLimit,
              },
              apiConfig,
            }),
          })

          const result = await response.json()

          if (!response.ok || !result.success) {
            // Check for permission errors
            if (result.permissionError || (result.error && result.error.includes("permission"))) {
              setApiKeyError(
                result.error ||
                  "Your OpenAI API key doesn't have the necessary permissions to use this model. Please update your API key or try a different model.",
              )
              setShowApiConfig(true)
              throw new Error(result.error || "API key permission error")
            }

            throw new Error(result.error || `Batch ${batchNumber} failed: ${response.statusText}`)
          }

          if (result.result?.intents) {
            // Add results from this batch
            allResults.push(...result.result.intents)

            // Update stats
            successfulExtractions += result.result.successfulExtractions || 0
            unclearIntents += result.result.unclearIntents || 0
            errorCount += result.result.errorCount || 0

            // Update preview with latest results
            const latestResults = result.result.intents.slice(-3)
            setPreview((prev) => [...prev.slice(-2), ...latestResults].slice(-5))

            setStatusMessage(`Batch ${batchNumber}/${calculatedTotalBatches} completed successfully`)
          } else {
            throw new Error(result.error || `Batch ${batchNumber} returned no results`)
          }
        } catch (batchError) {
          console.error(`Error in batch ${batchNumber}:`, batchError)

          // If it's a permission error, stop processing
          if (apiKeyError) {
            setPaused(true)
            setExtracting(false)
            return
          }

          // Add error entries for failed batch
          batch.forEach((conv: any) => {
            allResults.push({
              ConvID: conv.ConvID,
              Date: conv.Date,
              Conversation: conv.Conversation.substring(0, 100) + "...",
              Intent: `ERROR: Batch ${batchNumber} failed - ${batchError instanceof Error ? batchError.message : "Unknown error"}`,
            })
            errorCount++
          })

          setStatusMessage(`Batch ${batchNumber}/${calculatedTotalBatches} failed - continuing with next batch`)
        }

        // Update progress and stats
        const newProcessedCount = Math.min(i + batchSize, totalConversations)
        setProcessedCount(newProcessedCount)
        setProgress((newProcessedCount / totalConversations) * 100)
        setStats({ successful: successfulExtractions, unclear: unclearIntents, errors: errorCount })

        // Small delay between batches to avoid overwhelming the API
        if (i + batchSize < totalConversations) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }

      if (!paused) {
        setStatusMessage("Intent extraction completed!")
        setExtractedData({
          intents: allResults,
          totalProcessed: allResults.length,
          successfulExtractions,
          unclearIntents,
          errorCount,
          sample: allResults.slice(0, 5),
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed")
      setStatusMessage("Extraction failed")
    } finally {
      if (!paused) {
        setExtracting(false)
      }
    }
  }

  const pauseExtraction = () => {
    setPaused(true)
    setExtracting(false)
    setStatusMessage("Extraction paused")
  }

  const resumeExtraction = () => {
    setPaused(false)
    startExtraction()
  }

  const updateApiKey = () => {
    if (openaiKey && openaiKey.startsWith("sk-")) {
      onApiConfigUpdate({ openaiKey })
      setApiKeyError("")
      setShowApiConfig(false)
    } else {
      setApiKeyError("Invalid API key format. Key should start with 'sk-'")
    }
  }

  const downloadIntentsCSV = () => {
    if (!extractedData?.intents) return

    // Create CSV headers
    const headers = ["ConvID", "Date", "Intent", "Status"]

    // Create CSV rows
    const rows = extractedData.intents.map((item: any) => {
      const status = item.Intent.startsWith("ERROR:")
        ? "Error"
        : item.Intent.toLowerCase().includes("unclear")
          ? "Unclear"
          : "Success"

      return [
        item.ConvID,
        item.Date || "",
        `"${item.Intent.replace(/"/g, '""')}"`, // Escape quotes in CSV
        status,
      ]
    })

    // Combine headers and rows
    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `extracted-intents-${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  const handleNext = () => {
    if (extractedData) {
      onComplete(extractedData)
    }
  }

  return (
    <div className="space-y-6">
      {(showApiConfig || apiKeyError) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              OpenAI API Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {apiKeyError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>API Key Error:</strong> {apiKeyError}
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>OpenAI API Key Required:</strong> To extract intents from conversations, you need to provide
                your OpenAI API key with the proper permissions.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="openai-key">OpenAI API Key</Label>
              <div className="relative">
                <Input
                  id="openai-key"
                  type={showOpenaiKey ? "text" : "password"}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                >
                  {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Get your API key from{" "}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  className="text-blue-600 hover:underline"
                  rel="noreferrer"
                >
                  OpenAI Platform
                </a>
              </p>
            </div>

            {apiKeyError && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Permission Issue:</strong> Your API key needs the "model.request" scope. Make sure:
                  <br />• You have the correct role in your organization (Writer or Owner)
                  <br />• Your API key is not restricted or has the necessary scopes
                  <br />• You have sufficient credits in your OpenAI account
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button onClick={updateApiKey} disabled={!openaiKey || !openaiKey.startsWith("sk-")} className="flex-1">
                <CheckCircle className="w-4 h-4 mr-2" />
                Update API Key
              </Button>
              <Button
                onClick={() => {
                  onApiConfigUpdate({ openaiKey: "demo-mode", demoMode: true })
                  setShowApiConfig(false)
                  setApiKeyError("")
                }}
                variant="outline"
                className="flex-1"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Use Demo Mode
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Extract Customer Intents</h3>
        <p className="text-gray-600">Using AI to analyze conversations and extract clear customer intents</p>
      </div>

      {/* API Key Status Check */}
      <Alert>
        <Key className="h-4 w-4" />
        <AlertDescription>
          {apiConfig?.demoMode ? (
            <span>
              <strong>Demo Mode:</strong> Running with simulated API responses. No real API calls will be made.
            </span>
          ) : (
            <span>
              <strong>API Configuration:</strong> Using your configured OpenAI API key for processing{" "}
              {processedData.totalConversations} conversations in batches of {batchSize}.
            </span>
          )}
        </AlertDescription>
      </Alert>

      {!extractedData && !extracting && !paused && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="model">AI Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Recommended)</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini (Better but may require higher permissions)</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o (Most accurate, requires higher permissions)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="batch-size">Batch Size</Label>
                <Select value={batchSize.toString()} onValueChange={(value) => setBatchSize(Number(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 conversations per batch</SelectItem>
                    <SelectItem value="10">10 conversations per batch</SelectItem>
                    <SelectItem value="15">15 conversations per batch</SelectItem>
                    <SelectItem value="20">20 conversations per batch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="retry-limit">Retry Limit</Label>
              <Input
                id="retry-limit"
                type="number"
                value={retryLimit}
                onChange={(e) => setRetryLimit(Number(e.target.value))}
                min={1}
                max={5}
              />
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="font-medium text-blue-900">Ready to Process</div>
              <div className="text-sm text-blue-700 mt-1">
                {processedData.totalConversations} conversations will be processed in{" "}
                {Math.ceil(processedData.totalConversations / batchSize)} batches using {model}
              </div>
              {!apiConfig?.demoMode && (
                <div className="text-xs text-blue-600 mt-2">
                  Estimated cost: ~$
                  {(processedData.totalConversations * 0.001 * (model.includes("gpt-4") ? 5 : 1)).toFixed(2)} USD
                </div>
              )}
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {apiConfig?.demoMode ? (
                  <span>
                    <strong>Demo Mode:</strong> This will simulate intent extraction without using the OpenAI API.
                  </span>
                ) : (
                  <span>
                    <strong>Live Mode:</strong> Processing will be done in batches to handle large datasets efficiently.
                  </span>
                )}
              </AlertDescription>
            </Alert>

            <Button onClick={startExtraction} className="w-full">
              <Play className="w-4 h-4 mr-2" />
              Start Intent Extraction {apiConfig?.demoMode ? "(Demo)" : ""}
            </Button>
          </CardContent>
        </Card>
      )}

      {(extracting || paused) && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-lg font-medium">{paused ? "Extraction Paused" : "Extracting intents..."}</div>
                <Button variant="outline" size="sm" onClick={paused ? resumeExtraction : pauseExtraction}>
                  {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  {paused ? "Resume" : "Pause"}
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>
                    Progress: {processedCount}/{processedData.totalConversations} conversations
                  </span>
                  <span>
                    Batch: {currentBatch}/{totalBatches}
                  </span>
                </div>
                <Progress value={progress} className="w-full" />
                <div className="text-center text-sm text-gray-500">{progress.toFixed(1)}% complete</div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">{stats.successful}</div>
                  <div className="text-green-800">Successful</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-yellow-600">{stats.unclear}</div>
                  <div className="text-yellow-800">Unclear</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600">{stats.errors}</div>
                  <div className="text-red-800">Errors</div>
                </div>
              </div>

              {statusMessage && <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{statusMessage}</div>}

              {preview.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Recent Results:</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {preview.map((item, idx) => (
                      <div key={idx} className="bg-gray-50 p-2 rounded text-sm">
                        <div className="font-medium">ConvID: {item.ConvID}</div>
                        <div className={`text-xs ${item.Intent.includes("ERROR") ? "text-red-600" : "text-gray-600"}`}>
                          {item.Intent}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {error && !apiKeyError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Error:</strong> {error}
            <br />
            <span className="text-xs mt-1 block">
              {apiConfig?.demoMode
                ? "Demo mode error - this shouldn't happen."
                : "You can pause and resume extraction, or adjust batch size and try again."}
            </span>
          </AlertDescription>
        </Alert>
      )}

      {extractedData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Intent Extraction Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{extractedData.totalProcessed}</div>
                  <div className="text-sm text-blue-800">Processed</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{extractedData.successfulExtractions}</div>
                  <div className="text-sm text-green-800">Successful</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{extractedData.unclearIntents}</div>
                  <div className="text-sm text-yellow-800">Unclear</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{extractedData.errorCount || 0}</div>
                  <div className="text-sm text-red-800">Errors</div>
                </div>
              </div>

              <div className="flex justify-center">
                <Button onClick={downloadIntentsCSV} variant="outline" className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Download Intents CSV
                </Button>
              </div>

              <div>
                <h4 className="font-medium mb-2">Sample Extracted Intents:</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {extractedData.sample?.slice(0, 5).map((item: any, idx: number) => (
                    <div key={idx} className="bg-gray-50 p-3 rounded text-sm">
                      <div className="font-medium text-green-700">{item.Intent}</div>
                      <div className="text-xs text-gray-500 mt-1">ConvID: {item.ConvID}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {extractedData && (
          <Button onClick={handleNext} className="px-8">
            Next: Search Knowledge Base
          </Button>
        )}
      </div>
    </div>
  )
}
