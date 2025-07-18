"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, Key, Shield, CheckCircle, AlertTriangle, Info } from "lucide-react"

interface ApiConfigStepProps {
  onComplete: (config: any) => void
}

export default function ApiConfigStep({ onComplete }: ApiConfigStepProps) {
  const [openaiKey, setOpenaiKey] = useState("")
  const [pineconeKey, setPineconeKey] = useState("")
  const [pineconeHost, setPineconeHost] = useState("")
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)
  const [showPineconeKey, setShowPineconeKey] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateConfig = () => {
    const newErrors: Record<string, string> = {}

    if (!openaiKey) {
      newErrors.openai = "OpenAI API key is required"
    } else if (!openaiKey.startsWith("sk-")) {
      newErrors.openai = "OpenAI API key should start with 'sk-'"
    }

    if (!pineconeKey) {
      newErrors.pinecone = "Pinecone API key is required"
    }

    if (!pineconeHost) {
      newErrors.host = "Pinecone host URL is required"
    } else if (!pineconeHost.startsWith("https://")) {
      newErrors.host = "Pinecone host should be a valid HTTPS URL"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleContinue = () => {
    if (validateConfig()) {
      onComplete({
        openaiKey,
        pineconeKey,
        pineconeHost,
      })
    }
  }

  const handleSkip = () => {
    onComplete({
      openaiKey: "demo-mode",
      pineconeKey: "demo-mode",
      pineconeHost: "demo-mode",
      demoMode: true,
    })
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">API Configuration</h3>
        <p className="text-gray-600">Configure your API keys to enable full functionality</p>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Security Note:</strong> Your API keys are stored securely in your browser session and are never sent
          to our servers. They're only used to make direct API calls from your browser.
        </AlertDescription>
      </Alert>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Embedding Model:</strong> This app uses OpenAI's text-embedding-3-small model with dimensions=1024 to
          match your Pinecone index configuration.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            API Keys Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* OpenAI Configuration */}
          <div className="space-y-2">
            <Label htmlFor="openai-key">OpenAI API Key</Label>
            <div className="relative">
              <Input
                id="openai-key"
                type={showOpenaiKey ? "text" : "password"}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className={errors.openai ? "border-red-500" : ""}
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
            {errors.openai && <p className="text-sm text-red-600">{errors.openai}</p>}
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

          {/* Pinecone Configuration */}
          <div className="space-y-2">
            <Label htmlFor="pinecone-key">Pinecone API Key</Label>
            <div className="relative">
              <Input
                id="pinecone-key"
                type={showPineconeKey ? "text" : "password"}
                value={pineconeKey}
                onChange={(e) => setPineconeKey(e.target.value)}
                placeholder="pcsk_..."
                className={errors.pinecone ? "border-red-500" : ""}
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
            {errors.pinecone && <p className="text-sm text-red-600">{errors.pinecone}</p>}
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
              placeholder="https://your-index-name.svc.region.pinecone.io"
              className={errors.host ? "border-red-500" : ""}
            />
            {errors.host && <p className="text-sm text-red-600">{errors.host}</p>}
            <p className="text-xs text-gray-500">Find this URL in your Pinecone index dashboard under "Connect"</p>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleContinue} className="flex-1">
              <CheckCircle className="w-4 h-4 mr-2" />
              Continue with API Keys
            </Button>
            <Button onClick={handleSkip} variant="outline" className="flex-1">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Skip (Demo Mode)
            </Button>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Demo Mode:</strong> If you don't have API keys, you can skip this step to see the app with
              simulated data. No real API calls will be made.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
