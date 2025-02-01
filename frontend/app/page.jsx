'use client';
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";

export default function CodeRunner() {
  const [prompt, setPrompt] = useState('Create a Python script to calculate Fibonacci sequence');
  const [executionResult, setExecutionResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleExecute = async () => {
    setLoading(true);
    setExecutionResult(null);

    try {
      const response = await fetch('http://localhost:3001/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      
      const data = await response.json();
      setExecutionResult(data);
    } catch (error) {
      setExecutionResult({
        success: false,
        error: { type: 'Network Error', message: 'Failed to connect to the server' }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-900 text-white p-6">
      <Card className="w-full max-w-4xl bg-gray-800 border border-gray-700 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">AI-Powered Python Execution</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to achieve..."
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md text-white"
            rows={4}
          />
          
          <Button 
            onClick={handleExecute} 
            disabled={loading} 
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Processing...' : 'Generate & Execute Code'}
          </Button>

          {executionResult && (
            <div className="mt-6 space-y-6">
              {/* Execution Status */}
              <div className={`p-4 rounded-md ${
                executionResult.success ? 'bg-green-900/30' : 'bg-red-900/30'
              }`}>
                <h3 className={executionResult.success ? "text-green-400" : "text-red-400"}>
                  {executionResult.success ? 'Execution Successful!' : 'Execution Failed'}
                </h3>
              </div>

              {/* Generated Code */}
              {executionResult.code && (
                <div className="bg-gray-700 p-4 rounded-md">
                  <h4 className="text-gray-300 mb-2">Generated Code:</h4>
                  <pre className="bg-gray-800 p-3 rounded text-sm text-green-400 overflow-auto">
                    <code>{executionResult.code}</code>
                  </pre>
                </div>
              )}

              {/* Execution Output */}
              {executionResult.output && (
                <div className="bg-gray-700 p-4 rounded-md">
                  <h4 className="text-gray-300 mb-2">Execution Output:</h4>
                  <pre className="bg-gray-800 p-3 rounded text-sm text-white">
                    {executionResult.output}
                  </pre>
                </div>
              )}

              {/* Explanation */}
              {executionResult.explanation && (
                <div className="bg-gray-700 p-4 rounded-md">
                  <h4 className="text-gray-300 mb-2">Code Explanation:</h4>
                  <ReactMarkdown className="prose prose-invert text-gray-300">
                    {executionResult.explanation}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}