"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, FileSpreadsheet, AlertCircle, ArrowLeft, CheckCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

interface DirectUploadStepProps {
  targetStep: number
  onComplete: (data: any) => void
  onBack: () => void
}

const stepFormats = {
  1: {
    title: "Raw Chat Data",
    description: "Upload Excel/CSV with raw chat conversations",
    expectedColumns: ["ConvID", "Date/Time", "Role", "Message"],
    sampleData: [
      { ConvID: "conv_001", "Date/Time": "2024-01-15", Role: "Customer", Message: "I need help with my password" },
      { ConvID: "conv_001", "Date/Time": "2024-01-15", Role: "Agent", Message: "I can help you reset your password" },
    ],
  },
  3: {
    title: "Processed Conversations",
    description: "Upload CSV with grouped conversations",
    expectedColumns: ["ConvID", "Date", "Conversation"],
    sampleData: [
      {
        ConvID: "conv_001",
        Date: "2024-01-15",
        Conversation: "Customer: I need help with my password\nAgent: I can help you reset your password",
      },
    ],
  },
  4: {
    title: "Extracted Intents",
    description: "Upload CSV with extracted customer intents",
    expectedColumns: ["ConvID", "Date", "Intent"],
    sampleData: [{ ConvID: "conv_001", Date: "2024-01-15", Intent: "How to reset my password" }],
  },
}

export default function DirectUploadStep({ targetStep, onComplete, onBack }: DirectUploadStepProps) {
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string>("")
  const [processing, setProcessing] = useState(false)
  const [validationResult, setValidationResult] = useState<any>(null)

  const stepFormat = stepFormats[targetStep as keyof typeof stepFormats]

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    setError("")

    const files = e.dataTransfer.files
    if (files && files[0]) {
      validateAndSetFile(files[0])
    }
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("")
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0])
    }
  }

  const validateAndSetFile = async (file: File) => {
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ]

    if (!validTypes.includes(file.type) && !file.name.endsWith(".csv")) {
      setError("Please upload an Excel file (.xlsx, .xls) or CSV file (.csv)")
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      // 50MB limit
      setError("File size must be less than 50MB")
      return
    }

    setFile(file)
    await validateFileFormat(file)
  }

  const validateFileFormat = async (file: File) => {
    setProcessing(true)
    try {
      let data: any[] = []

      if (file.name.endsWith(".csv")) {
        // Parse CSV
        const text = await file.text()
        const lines = text.split("\n").filter((line) => line.trim())
        if (lines.length < 2) {
          throw new Error("CSV file must have at least a header row and one data row")
        }

        const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))
        data = lines.slice(1).map((line) => {
          const values = line.split(",").map((v) => v.trim().replace(/"/g, ""))
          const row: any = {}
          headers.forEach((header, index) => {
            row[header] = values[index] || ""
          })
          return row
        })
      } else {
        // Parse Excel
        const XLSX = await import("xlsx")
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: "buffer" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        data = XLSX.utils.sheet_to_json(worksheet)
      }

      // Validate columns
      if (data.length === 0) {
        throw new Error("File appears to be empty")
      }

      const fileColumns = Object.keys(data[0])
      const missingColumns = stepFormat.expectedColumns.filter(
        (col) =>
          !fileColumns.some(
            (fileCol) =>
              fileCol.toLowerCase().includes(col.toLowerCase()) || col.toLowerCase().includes(fileCol.toLowerCase()),
          ),
      )

      if (missingColumns.length > 0) {
        throw new Error(
          `Missing required columns: ${missingColumns.join(", ")}. Found columns: ${fileColumns.join(", ")}`,
        )
      }

      setValidationResult({
        success: true,
        rowCount: data.length,
        columns: fileColumns,
        preview: data.slice(0, 3),
        data: data,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to validate file format")
      setValidationResult(null)
    } finally {
      setProcessing(false)
    }
  }

  const handleNext = () => {
    if (validationResult?.data) {
      // Transform data based on target step
      let transformedData

      if (targetStep === 1) {
        // For step 1, pass the raw data to be processed
        transformedData = { file, fileName: file!.name, fileSize: file!.size }
      } else if (targetStep === 3) {
        // For step 3, format as processed conversations
        transformedData = {
          conversations: validationResult.data,
          totalConversations: validationResult.data.length,
          totalMessages: validationResult.data.reduce(
            (sum: number, conv: any) => sum + (conv.Conversation ? conv.Conversation.split("\n").length : 0),
            0,
          ),
          dateRange: "Uploaded data",
        }
      } else if (targetStep === 4) {
        // For step 4, format as extracted intents
        transformedData = {
          intents: validationResult.data,
          totalProcessed: validationResult.data.length,
          successfulExtractions: validationResult.data.filter(
            (item: any) => item.Intent && !item.Intent.startsWith("ERROR:"),
          ).length,
          unclearIntents: validationResult.data.filter(
            (item: any) => item.Intent && item.Intent.toLowerCase().includes("unclear"),
          ).length,
          errorCount: validationResult.data.filter((item: any) => item.Intent && item.Intent.startsWith("ERROR:"))
            .length,
        }
      }

      onComplete(transformedData)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Upload {stepFormat.title}</h3>
        <p className="text-gray-600">{stepFormat.description}</p>
      </div>

      {/* Expected Format Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expected File Format</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <strong>Required columns:</strong>
              <div className="flex gap-2 mt-1">
                {stepFormat.expectedColumns.map((col) => (
                  <Badge key={col} variant="outline">
                    {col}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <strong>Sample data:</strong>
              <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono overflow-x-auto">
                <pre>{JSON.stringify(stepFormat.sampleData[0], null, 2)}</pre>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Upload Area */}
      <Card
        className={`
          border-2 border-dashed transition-all cursor-pointer
          ${dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
          ${validationResult?.success ? "border-green-500 bg-green-50" : ""}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <CardContent className="p-8 text-center">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileInput} className="hidden" id="file-upload" />

          {!file ? (
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <div className="text-lg font-medium text-gray-700 mb-2">Drop your file here or click to browse</div>
              <div className="text-sm text-gray-500">Supports .xlsx, .xls, and .csv files up to 50MB</div>
            </label>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-3">
                <FileSpreadsheet className="w-8 h-8 text-green-600" />
                <div>
                  <div className="font-medium text-gray-900">{file.name}</div>
                  <div className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                </div>
              </div>

              {processing && <div className="text-sm text-blue-600">Validating file format...</div>}

              {validationResult?.success && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">File validated successfully!</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Found {validationResult.rowCount} rows with columns: {validationResult.columns.join(", ")}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Workflow Selection
        </Button>

        <Button onClick={handleNext} disabled={!validationResult?.success} className="px-8">
          Continue to Step {targetStep === 1 ? 2 : targetStep + 1}
        </Button>
      </div>
    </div>
  )
}
