"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Download, Search, AlertTriangle, CheckCircle } from "lucide-react"

interface ResultsStepProps {
  searchResults: any
  onBack: () => void
}

export default function ResultsStep({ searchResults, onBack }: ResultsStepProps) {
  const [filter, setFilter] = useState("")
  const [selectedTab, setSelectedTab] = useState("review")

  const filteredReviewItems =
    searchResults.reviewItems?.filter(
      (item: any) =>
        item.Intent.toLowerCase().includes(filter.toLowerCase()) ||
        item.Category?.toLowerCase().includes(filter.toLowerCase()),
    ) || []

  const downloadResults = async (type: "csv" | "json") => {
    try {
      const response = await fetch("/api/download-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          results: searchResults,
          format: type,
        }),
      })

      if (!response.ok) throw new Error("Download failed")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `intent-analysis-results.${type}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Download failed:", error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Analysis Complete</h3>
        <p className="text-gray-600">Review your results and identify knowledge base gaps</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{searchResults.totalSearched}</div>
            <div className="text-sm text-gray-600">Total Intents</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{searchResults.highConfidenceMatches}</div>
            <div className="text-sm text-gray-600">Well Covered</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{searchResults.lowConfidenceMatches}</div>
            <div className="text-sm text-gray-600">Need Review</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {((searchResults.lowConfidenceMatches / searchResults.totalSearched) * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Gap Rate</div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 justify-center">
        <Button onClick={() => downloadResults("csv")} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Download CSV
        </Button>
        <Button onClick={() => downloadResults("json")} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Download JSON
        </Button>
      </div>

      {/* Results Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="review" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Needs Review ({searchResults.lowConfidenceMatches})
          </TabsTrigger>
          <TabsTrigger value="covered" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Well Covered ({searchResults.highConfidenceMatches})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <Input
              placeholder="Filter by intent or category..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="max-w-md"
            />
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredReviewItems.map((item: any, idx: number) => (
              <Card key={idx} className="border-l-4 border-l-red-500">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium text-gray-900">{item.Intent}</div>
                    <Badge variant="destructive">Score: {item.Score?.toFixed(3)}</Badge>
                  </div>

                  <div className="text-sm text-gray-600 mb-2">
                    <strong>ConvID:</strong> {item.ConvID}
                  </div>

                  <div className="text-sm text-gray-600 mb-2">
                    <strong>Best Match:</strong> {item.Category || "No category"}
                  </div>

                  {item.ArticleChunk && (
                    <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded mt-2">
                      <strong>Article Excerpt:</strong>
                      <br />
                      {item.ArticleChunk.substring(0, 200)}
                      {item.ArticleChunk.length > 200 && "..."}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredReviewItems.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {filter ? "No items match your filter" : "No items need review"}
            </div>
          )}
        </TabsContent>

        <TabsContent value="covered" className="space-y-4">
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Great Coverage!</h3>
            <p className="text-gray-600">
              {searchResults.highConfidenceMatches} intents were well-matched in your knowledge base. These represent
              topics your help center already covers effectively.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
              <div>
                <div className="font-medium">Review Low-Confidence Matches</div>
                <div className="text-sm text-gray-600">
                  {searchResults.lowConfidenceMatches} intents scored below your threshold. These may represent gaps in
                  your knowledge base or areas needing better content.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div>
                <div className="font-medium">Create New Articles</div>
                <div className="text-sm text-gray-600">
                  Consider creating help center articles for the most common low-confidence intents.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <div className="font-medium">Improve Existing Content</div>
                <div className="text-sm text-gray-600">
                  Some low scores might indicate existing articles need better keywords or clearer explanations.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-start">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Search
        </Button>
      </div>
    </div>
  )
}
