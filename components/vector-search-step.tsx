"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  CheckCircle,
  AlertCircle,
  Search,
  ArrowLeft,
  Database,
  Eye,
  EyeOff,
  Key,
  AlertTriangle,
  Info,
} from "lucide-react"

interface VectorSearchStepProps {
  intentData: any
  apiConfig: any
  onComplete: (data: any) => void
  onBack: () => void
  onApiConfigUpdate: (config: any) => void
}

export default function VectorSearchStep({
  intentData,
  apiConfig,
  onComplete,
  onBack,
  onApiConfigUpdate,
}: VectorSearchStepProps) {
  const [searching, setSearching] = useState(false)
  const [progress, setProgress] = useState(0)
  const [searchResults, setSearchResults] = useState<any>(null)
  const [error, setError] = useState<string>("")
  const [preview, setPreview] = useState<any[]>([])

  // Configuration
  const [searchType, setSearchType] = useState<"text" | "vector">("text")
  const [topK, setTopK] = useState(1)
  const [threshold, setThreshold] = useState(0.49)
  const [namespace, setNamespace] = useState("")

  const [showApiConfig, setShowApiConfig] = useState(false)
  const [pineconeKey, setPineconeKey] = useState(apiConfig?.pineconeKey || "")
  const [pineconeHost, setPineconeHost] = useState(
    apiConfig?.pineconeHost || "https://zendesk-articles-c4gy2k4.svc.aped-4627-b74a.pinecone.io",
  )
  const [showPineconeKey, setShowPineconeKey] = useState(false)

  // Check if Pinecone API credentials are configured
  const needsApiConfig = !apiConfig?.pineconeKey || !apiConfig?.pineconeHost || apiConfig.pineconeKey === "demo-mode"

  // Show API config if needed and not already shown
  useEffect(() => {
    if (needsApiConfig && !showApiConfig) {
      setShowApiConfig(true)
    }
  }, [needsApiConfig, showApiConfig])

  const startSearch = async () => {
    setSearching(true)
    setProgress(0)
    setError("")
    setPreview([])

    try {
      const response = await fetch("/api/vector-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intents: intentData.intents,
          config: {
            searchType,
            topK,
            threshold,
            namespace,
          },
          apiConfig,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Search API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        })

        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.error || `Search failed: ${response.statusText}`)
        } catch (parseError) {
          throw new Error(`Server error (${response.status}): ${errorText}`)
        }
      }

      const result = await response.json()

      // Simulate progress for better UX
      for (let i = 0; i <= 100; i += 10) {
        setProgress(i)
        await new Promise((resolve) => setTimeout(resolve, 200))
      }

      setSearchResults(result.results)
      setPreview(result.results.reviewItems?.slice(0, 3) || [])
    } catch (err) {
      console.error("Search error:", err)
      setError(err instanceof Error ? err.message : "Search failed")
    } finally {
      setSearching(false)
    }
  }

  const handleNext = () => {
    if (searchResults) {
      onComplete(searchResults)
    }
  }

  return (
    <div className="space-y-6">
      {showApiConfig && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Pinecone API Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Pinecone Credentials Required:</strong> To search your knowledge base, you need to provide your
                Pinecone API key. Make sure your API key has access to the zendesk-articles index.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="pinecone-key">Pinecone API Key</Label>
              <div className="relative">
                <Input
                  id="pinecone-key"
                  type={showPineconeKey ? "text" : "password"}
                  value={pineconeKey}
                  onChange={(e) => setPineconeKey(e.target.value)}
                  placeholder="pcsk_..."
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPineconeKey(!showPineconeKey)}
                >
                  {showPineconeKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Get your API key from{" "}
                <a
                  href="https://app.pinecone.io/"
                  target="_blank"
                  className="text-blue-600 hover:underline"
                  rel="noreferrer"
                >
                  Pinecone Console
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pinecone-host">Pinecone Index Host URL</Label>
              <Input
                id="pinecone-host"
                type="text"
                value={pineconeHost}
                onChange={(e) => setPineconeHost(e.target.value)}
                placeholder="https://zendesk-articles-c4gy2k4.svc.aped-4627-b74a.pinecone.io"
                disabled
              />
              <p className="text-xs text-gray-500">Pre-configured for zendesk-articles index</p>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-sm text-blue-800">
                <strong>Index Schema:</strong>
                <br />• Fields: _id, article (text content), title, locale
                <br />• Integrated embedding model for text search
                <br />• Default namespace handling
              </div>
            </div>

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>403 Forbidden Error:</strong> This usually means:
                <br />• Your API key doesn't have access to the zendesk-articles index
                <br />• The API key is incorrect or expired
                <br />• The index is in a different project/environment
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  if (pineconeKey) {
                    onApiConfigUpdate({ pineconeKey, pineconeHost })
                    setShowApiConfig(false)
                  }
                }}
                disabled={!pineconeKey}
                className="flex-1"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Configure API Key
              </Button>
              <Button
                onClick={() => {
                  onApiConfigUpdate({
                    pineconeKey: "demo-mode",
                    pineconeHost: "demo-mode",
                    demoMode: true,
                  })
                  setShowApiConfig(false)
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
        <h3 className="text-lg font-semibold mb-2">Search Knowledge Base</h3>
        <p className="text-gray-600">
          Find gaps in your knowledge base by searching extracted intents against the zendesk-articles index
        </p>
      </div>

      {!searchResults && !searching && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Search Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="top-k">Top K Results</Label>
                <Input
                  id="top-k"
                  type="number"
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  min={1}
                  max={10}
                />
              </div>

              <div>
                <Label htmlFor="threshold">Score Threshold</Label>
                <Input
                  id="threshold"
                  type="number"
                  step="0.01"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  min={0}
                  max={1}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="namespace">Pinecone Namespace</Label>
              <Input
                id="namespace"
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
                placeholder="Leave empty for default namespace"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty for default namespace. The app will try both "__default__" and empty string approaches.
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="font-medium text-blue-900">Ready to Search</div>
              <div className="text-sm text-blue-700 mt-1">
                {intentData.successfulExtractions} intents will be searched against the zendesk-articles index
              </div>
              <div className="text-xs text-blue-600 mt-2">
                Results below threshold ({threshold}) will be flagged for review
              </div>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {apiConfig?.demoMode ? (
                  <span>
                    <strong>Demo Mode:</strong> Vector search will use simulated data without making real API calls.
                  </span>
                ) : (
                  <span>
                    <strong>Live Mode:</strong> Searching the 'article' field (text content) with title and locale
                    metadata.
                  </span>
                )}
              </AlertDescription>
            </Alert>

            <Button onClick={startSearch} className="w-full">
              <Search className="w-4 h-4 mr-2" />
              Start Knowledge Base Search {apiConfig?.demoMode ? "(Demo)" : ""}
            </Button>
          </CardContent>
        </Card>
      )}

      {searching && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="text-lg font-medium">
                Searching zendesk-articles index...
                {apiConfig?.demoMode ? " (Demo Mode)" : " (Live Mode)"}
              </div>

              <Progress value={progress} className="w-full" />

              <div className="text-sm text-gray-600">
                {progress.toFixed(1)}% complete • Threshold: {threshold}
              </div>

              {preview.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Recent Matches:</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {preview.slice(-3).map((item, idx) => (
                      <div key={idx} className="bg-gray-50 p-2 rounded text-sm">
                        <div className="flex justify-between items-start">
                          <div className="font-medium truncate">{item.Intent}</div>
                          <div
                            className={`text-xs px-2 py-1 rounded ${
                              item.Score < threshold ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                            }`}
                          >
                            {item.Score?.toFixed(3)}
                          </div>
                        </div>
                        <div className="text-gray-600 text-xs mt-1 truncate">{item.Category}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
              {error.includes("403") ? (
                <>
                  This is likely an API key permissions issue. Please verify:
                  <br />• Your API key has access to the zendesk-articles index
                  <br />• The API key is from the correct Pinecone project
                  <br />• The index exists and is accessible
                </>
              ) : (
                "Check the browser console for detailed error information."
              )}
            </span>
          </AlertDescription>
        </Alert>
      )}

      {searchResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Knowledge Base Search Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{searchResults.totalSearched}</div>
                  <div className="text-sm text-blue-800">Intents Searched</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{searchResults.highConfidenceMatches}</div>
                  <div className="text-sm text-green-800">High Confidence</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{searchResults.lowConfidenceMatches}</div>
                  <div className="text-sm text-red-800">Needs Review</div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Low Confidence Matches (Need Review):</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {searchResults.reviewItems?.slice(0, 5).map((item: any, idx: number) => (
                    <div key={idx} className="bg-red-50 border border-red-200 p-3 rounded text-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium text-red-900">{item.Intent}</div>
                        <div className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded">
                          Score: {item.Score?.toFixed(3)}
                        </div>
                      </div>
                      <div className="text-red-700 text-xs">Best Match: {item.Category}</div>
                      <div className="text-red-600 text-xs mt-1 truncate">
                        {item.ArticleChunk?.substring(0, 100)}...
                      </div>
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

        {searchResults && (
          <Button onClick={handleNext} className="px-8">
            View Results
          </Button>
        )}
      </div>
    </div>
  )
}
