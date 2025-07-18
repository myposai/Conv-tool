"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, FileSpreadsheet, AlertCircle, ArrowLeft } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface FileUploadStepProps {
  apiConfig: any
  onComplete: (data: any) => void
  onBack: () => void
}

export default function FileUploadStep({ apiConfig, onComplete, onBack }: FileUploadStepProps) {
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string>("")

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

  const validateAndSetFile = (file: File) => {
    const validTypes = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"]

    if (!validTypes.includes(file.type)) {
      setError("Please upload an Excel file (.xlsx or .xls)")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      setError("File size must be less than 10MB")
      return
    }

    setFile(file)
  }

  const handleNext = () => {
    if (file) {
      onComplete({ file, fileName: file.name, fileSize: file.size })
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Upload Your Chat Data</h3>
        <p className="text-gray-600">
          Upload an Excel file containing chat conversations with columns: ConvID, Date/Time, Role, Message
        </p>
      </div>

      {apiConfig?.demoMode && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Demo Mode:</strong> You're running in demo mode. The app will work with simulated data and API
            responses.
          </AlertDescription>
        </Alert>
      )}

      <Card
        className={`
          border-2 border-dashed transition-all cursor-pointer
          ${dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
          ${file ? "border-green-500 bg-green-50" : ""}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <CardContent className="p-8 text-center">
          <input type="file" accept=".xlsx,.xls" onChange={handleFileInput} className="hidden" id="file-upload" />

          {!file ? (
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <div className="text-lg font-medium text-gray-700 mb-2">Drop your Excel file here or click to browse</div>
              <div className="text-sm text-gray-500">Supports .xlsx and .xls files up to 10MB</div>
            </label>
          ) : (
            <div className="flex items-center justify-center space-x-3">
              <FileSpreadsheet className="w-8 h-8 text-green-600" />
              <div>
                <div className="font-medium text-gray-900">{file.name}</div>
                <div className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
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
          Back
        </Button>

        <Button onClick={handleNext} disabled={!file} className="px-8">
          Next: Process Data
        </Button>
      </div>
    </div>
  )
}
