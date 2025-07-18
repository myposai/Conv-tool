"use client"

import React from "react"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, FileSpreadsheet, Brain, Search, CheckCircle, Workflow } from "lucide-react"
import WorkflowSelectionStep from "@/components/workflow-selection-step"
import DirectUploadStep from "@/components/direct-upload-step"
import FileUploadStep from "@/components/file-upload-step"
import DataProcessingStep from "@/components/data-processing-step"
import IntentExtractionStep from "@/components/intent-extraction-step"
import VectorSearchStep from "@/components/vector-search-step"
import ResultsStep from "@/components/results-step"

const steps = [
  { id: 0, title: "Workflow", icon: Workflow, description: "Choose your workflow" },
  { id: 1, title: "Upload File", icon: Upload, description: "Upload your Excel chat file" },
  { id: 2, title: "Process Data", icon: FileSpreadsheet, description: "Restructure conversations" },
  { id: 3, title: "Extract Intents", icon: Brain, description: "Analyze customer intents" },
  { id: 4, title: "Vector Search", icon: Search, description: "Search knowledge base" },
  { id: 5, title: "Results", icon: CheckCircle, description: "Review final results" },
]

export default function IntentAnalysisApp() {
  const [currentStep, setCurrentStep] = useState(0)
  const [stepData, setStepData] = useState<Record<number, any>>({})
  const [workflowMode, setWorkflowMode] = useState<"complete" | "direct">("complete")
  const [directStartStep, setDirectStartStep] = useState<number>(1)
  const [apiConfig, setApiConfig] = useState<any>({}) // Store API config globally

  const handleStepComplete = (step: number, data: any) => {
    setStepData((prev) => ({ ...prev, [step]: data }))

    // Update API config if provided
    if (data.apiConfig) {
      setApiConfig((prev: any) => ({ ...prev, ...data.apiConfig }))
    }

    if (step === 0) {
      // Workflow selection completed
      setWorkflowMode(data.mode)
      setDirectStartStep(data.startStep)

      if (data.mode === "complete") {
        setCurrentStep(1) // Go to file upload
      } else {
        setCurrentStep(data.startStep - 0.5) // Go to direct upload step
      }
    } else if (step === -0.5) {
      // Direct upload completed, jump to the target step
      setCurrentStep(directStartStep)
    } else {
      // Normal step progression
      if (step < steps.length - 1) {
        setCurrentStep(step + 1)
      }
    }
  }

  const handleBack = () => {
    if (currentStep === directStartStep && workflowMode === "direct") {
      // Go back to direct upload
      setCurrentStep(directStartStep - 0.5)
    } else if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const renderCurrentStep = () => {
    // Handle direct upload step (fractional step numbers)
    if (currentStep === directStartStep - 0.5) {
      return (
        <DirectUploadStep
          targetStep={directStartStep}
          onComplete={(data) => handleStepComplete(-0.5, data)}
          onBack={() => setCurrentStep(0)}
        />
      )
    }

    switch (currentStep) {
      case 0:
        return <WorkflowSelectionStep onComplete={(data) => handleStepComplete(0, data)} />
      case 1:
        return (
          <FileUploadStep
            apiConfig={apiConfig}
            onComplete={(data) => handleStepComplete(1, data)}
            onBack={handleBack}
          />
        )
      case 2:
        return (
          <DataProcessingStep
            fileData={stepData[1] || stepData[-0.5]}
            apiConfig={apiConfig}
            onComplete={(data) => handleStepComplete(2, data)}
            onBack={handleBack}
          />
        )
      case 3:
        return (
          <IntentExtractionStep
            processedData={stepData[2] || stepData[-0.5]}
            apiConfig={apiConfig}
            onComplete={(data) => handleStepComplete(3, data)}
            onBack={handleBack}
            onApiConfigUpdate={(config) => setApiConfig((prev: any) => ({ ...prev, ...config }))}
          />
        )
      case 4:
        return (
          <VectorSearchStep
            intentData={stepData[3] || stepData[-0.5]}
            apiConfig={apiConfig}
            onComplete={(data) => handleStepComplete(4, data)}
            onBack={handleBack}
            onApiConfigUpdate={(config) => setApiConfig((prev: any) => ({ ...prev, ...config }))}
          />
        )
      case 5:
        return <ResultsStep searchResults={stepData[4]} onBack={handleBack} />
      default:
        return null
    }
  }

  const getCurrentStepInfo = () => {
    if (currentStep === directStartStep - 0.5) {
      return {
        title: "Upload Data",
        description: `Upload your ${directStartStep === 3 ? "processed conversations" : directStartStep === 4 ? "extracted intents" : "data"}`,
        icon: Upload,
      }
    }

    const step = steps.find((s) => s.id === currentStep)
    return (
      step || {
        id: 0,
        title: "Workflow",
        icon: Workflow,
        description: "Choose your workflow",
      }
    )
  }

  const currentStepInfo = getCurrentStepInfo()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Intent Analysis & Knowledge Base Search</h1>
          <p className="text-lg text-gray-600">Helping you find the missing information within your help center</p>
        </div>

        {/* Progress Steps - Only show after workflow selection */}
        {currentStep > 0 && (
          <div className="mb-8">
            <div className="flex justify-between items-center">
              {steps.slice(1).map((step, index) => {
                const Icon = step.icon
                const isActive = currentStep === step.id
                const isCompleted = currentStep > step.id
                const isAccessible = currentStep >= step.id || (workflowMode === "direct" && step.id >= directStartStep)

                return (
                  <div key={step.id} className="flex flex-col items-center flex-1">
                    <div
                      className={`
                      w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all
                      ${
                        isCompleted
                          ? "bg-green-500 text-white"
                          : isActive
                            ? "bg-blue-500 text-white"
                            : isAccessible
                              ? "bg-gray-300 text-gray-600"
                              : "bg-gray-200 text-gray-400"
                      }
                    `}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <div className={`font-medium text-sm ${isAccessible ? "text-gray-900" : "text-gray-400"}`}>
                        {step.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{step.description}</div>
                    </div>
                    {index < steps.slice(1).length - 1 && (
                      <div
                        className={`
                        absolute h-0.5 w-16 mt-6 ml-16 transition-all
                        ${isCompleted ? "bg-green-500" : "bg-gray-200"}
                      `}
                        style={{ transform: "translateX(50%)" }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Current Step Content */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {React.createElement(currentStepInfo.icon, { className: "w-6 h-6" })}
              {currentStep === 0 ? "Choose Workflow" : `Step ${currentStep}: ${currentStepInfo.title}`}
            </CardTitle>
            <CardDescription>{currentStepInfo.description}</CardDescription>
          </CardHeader>
          <CardContent>{renderCurrentStep()}</CardContent>
        </Card>
      </div>
    </div>
  )
}
