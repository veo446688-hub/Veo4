'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Play, Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function TestPage() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  const handleProcessJob = async () => {
    setIsProcessing(true)
    setResult(null)
    setLogs(['Starting manual job processing...'])

    try {
      addLog('Sending request to /api/test/process-job')
      
      const response = await fetch('/api/test/process-job', {
        method: 'POST',
      })

      addLog(`Response status: ${response.status}`)
      
      const data = await response.json()
      addLog(`Response received: ${JSON.stringify(data, null, 2)}`)
      
      setResult(data)
      
      if (data.success) {
        addLog('✅ Job processed successfully!')
      } else {
        addLog(`❌ Job processing failed: ${data.error}`)
      }
    } catch (error) {
      addLog(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClearLogs = () => {
    setLogs([])
    setResult(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-8">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Video Job Processing Test</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Manually trigger video processing to debug cron job issues
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5" />
                Process Queued Job
              </CardTitle>
              <CardDescription>
                This will process the oldest queued job manually (without cron)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Button
                  onClick={handleProcessJob}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Process Next Job
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClearLogs}
                  disabled={isProcessing}
                >
                  Clear Logs
                </Button>
              </div>

              {result && (
                <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900' : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'}`}>
                  <div className="flex items-start gap-3">
                    {result.success ? (
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`font-semibold ${result.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                        {result.success ? 'Success!' : 'Error!'}
                      </p>
                      <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">
                        {result.success 
                          ? `Job ${result.jobId} processed. Video URL: ${result.videoUrl}`
                          : result.error
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Logs</CardTitle>
              <CardDescription>Real-time processing logs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-900 dark:bg-black rounded-lg p-4 font-mono text-sm max-h-96 overflow-y-auto">
                {logs.length === 0 ? (
                  <p className="text-slate-500">No logs yet. Click "Process Next Job" to start.</p>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="text-slate-300 mb-1 whitespace-pre-wrap break-words">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
