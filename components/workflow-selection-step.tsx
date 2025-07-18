"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Workflow, Zap, FileSpreadsheet, Brain, Search, Info, ArrowRight } from "lucide-react"

interface WorkflowSelectionStepProps {
  onComplete: (data: any) => void
}

const stepOptions = [
  {
    id: 1,
    title: "Upload & Process Data",
    description: "Start with raw chat data (Excel/CSV)",
    icon: FileSpreadsheet,
    expectedFormat: "ConvID, Date/Time, Role, Message",
    badge: "Raw Data",
  },
  {
    id: 3,
    title: "Extract Intents",
    description: "Start with processed conversations",
    icon: Brain,
    expectedFormat: "ConvID, Date, Conversation",
    badge: "Processed",
  },
  {
    id: 4,
    title: "Vector Search",
    description: "Start with extracted intents",
    icon: Search,
    expectedFormat: "ConvID, Date, Intent",
    badge: "Intents",
  },
]

export default function WorkflowSelectionStep({ onComplete }: WorkflowSelectionStepProps) {
  const [workflowMode, setWorkflowMode] = useState<"complete" | "direct">("complete")
  const [selectedStep, setSelectedStep] = useState<number>(1)

  const handleContinue = () => {
    if (workflowMode === "complete") {
      onComplete({
        mode: "complete",
        startStep: 1,
      })
    } else {
      onComplete({
        mode: "direct",
        startStep: selectedStep,
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Choose Your Workflow</h3>
        <p className="text-gray-600">Start from the beginning or jump to a specific step with your existing data</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <RadioGroup value={workflowMode} onValueChange={(value) => setWorkflowMode(value as "complete" | "direct")}>
            <div className="space-y-6">
              {/* Complete Workflow Option */}
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="complete" id="complete" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="complete" className="cursor-pointer">
                    <div className="flex items-center gap-2 mb-2">
                      <Workflow className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-lg">Complete Step-by-Step Process</span>
                      <Badge variant="secondary">Recommended</Badge>
                    </div>
                    <p className="text-gray-600 text-sm">
                      Follow the full workflow from file upload to final results. Best for first-time users or when
                      starting with raw chat data.
                    </p>
                  </Label>

                  {workflowMode === "complete" && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <div className="text-sm text-blue-800">
                        <strong>Steps included:</strong> Upload File → Process Data → Extract Intents → Vector Search →
                        Results
                      </div>
                      <div className="text-xs text-blue-600 mt-1">
                        API keys will be requested when needed for each step
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Direct Step Access Option */}
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="direct" id="direct" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="direct" className="cursor-pointer">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-5 h-5 text-purple-600" />
                      <span className="font-medium text-lg">Direct Step Access</span>
                      <Badge variant="outline">Advanced</Badge>
                    </div>
                    <p className="text-gray-600 text-sm">
                      Jump directly to a specific step if you already have processed data from a previous run.
                    </p>
                  </Label>

                  {workflowMode === "direct" && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <Label htmlFor="step-select" className="text-sm font-medium">
                          Choose starting step:
                        </Label>
                        <Select
                          value={selectedStep.toString()}
                          onValueChange={(value) => setSelectedStep(Number(value))}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {stepOptions.map((step) => (
                              <SelectItem key={step.id} value={step.id.toString()}>
                                <div className="flex items-center gap-2">
                                  <step.icon className="w-4 h-4" />
                                  {step.title}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Show selected step details */}
                      {stepOptions.map(
                        (step) =>
                          selectedStep === step.id && (
                            <div key={step.id} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                              <div className="flex items-center gap-2 mb-2">
                                <step.icon className="w-5 h-5 text-purple-600" />
                                <span className="font-medium text-purple-900">{step.title}</span>
                                <Badge variant="secondary">{step.badge}</Badge>
                              </div>
                              <p className="text-sm text-purple-800 mb-2">{step.description}</p>
                              <div className="text-xs text-purple-700">
                                <strong>Expected file format:</strong> {step.expectedFormat}
                              </div>
                              <div className="text-xs text-purple-600 mt-1">
                                You'll be prompted for the required API keys when you reach this step
                              </div>
                            </div>
                          ),
                      )}

                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Note:</strong> API keys will be requested when needed. For Intent Extraction, you'll
                          need an OpenAI API key. For Vector Search, you'll need Pinecone credentials.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleContinue} className="px-8">
          {workflowMode === "complete" ? (
            <>
              Start Complete Workflow
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          ) : (
            <>
              Jump to {stepOptions.find((s) => s.id === selectedStep)?.title}
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
