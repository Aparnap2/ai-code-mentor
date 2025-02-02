'use client';
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";

export default function CodeRunner() {
  const [prompt, setPrompt] = useState('Create a matplotlib plot showing a sine wave');
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
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-4 md:p-6">
      <Card className="w-full max-w-4xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-xl">
        <CardHeader className="border-b border-gray-700">
          <CardTitle className="text-xl md:text-2xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            AI-Powered Python Execution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to achieve..."
            className="w-full p-3 bg-gray-700/50 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
            rows={4}
          />
          
          <Button 
            onClick={handleExecute} 
            disabled={loading} 
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-md transition-all duration-200 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Generate & Execute Code'}
          </Button>

          {executionResult && (
            <div className="space-y-6 animate-fade-in">
              {/* Execution Status */}
              <div className={`p-4 rounded-lg border ${
                executionResult.success 
                  ? 'bg-green-900/20 border-green-700/50 text-green-400' 
                  : 'bg-red-900/20 border-red-700/50 text-red-400'
              }`}>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    executionResult.success ? 'bg-green-400' : 'bg-red-400'
                  }`} />
                  <h3 className="font-medium">
                    {executionResult.success ? 'Execution Successful!' : 'Execution Failed'}
                  </h3>
                </div>
              </div>

              {/* Generated Code */}
              {executionResult.code && (
                <div className="rounded-lg overflow-hidden">
                  <div className="bg-gray-700/50 px-4 py-2 border-b border-gray-600">
                    <h4 className="text-gray-300 font-medium">Generated Code</h4>
                  </div>
                  <div className="bg-gray-800/50 p-4">
                    <pre className="text-sm text-green-400 overflow-x-auto">
                      <code>{executionResult.code}</code>
                    </pre>
                  </div>
                </div>
              )}

              {/* Plot Output */}
              {executionResult.plot && (
                <div className="rounded-lg overflow-hidden">
                  <div className="bg-gray-700/50 px-4 py-2 border-b border-gray-600">
                    <h4 className="text-gray-300 font-medium">Plot Output</h4>
                  </div>
                  <div className="bg-gray-800/50 p-4 flex justify-center">
                    <img 
                      src={executionResult.plot} 
                      alt="Plot output"
                      className="max-w-full h-auto rounded-lg shadow-lg"
                    />
                  </div>
                </div>
              )}

              {/* Execution Output */}
              {executionResult.output && (
                <div className="rounded-lg overflow-hidden">
                  <div className="bg-gray-700/50 px-4 py-2 border-b border-gray-600">
                    <h4 className="text-gray-300 font-medium">Execution Output</h4>
                  </div>
                  <div className="bg-gray-800/50 p-4">
                    <pre className="text-sm text-blue-300 overflow-x-auto">
                      {executionResult.output}
                    </pre>
                  </div>
                </div>
              )}

              {/* Code Explanation */}
              {executionResult.explanation && (
                <div className="rounded-lg overflow-hidden">
                  <div className="bg-gray-700/50 px-4 py-2 border-b border-gray-600">
                    <h4 className="text-gray-300 font-medium">Code Explanation</h4>
                  </div>
                  <div className="bg-gray-800/50 p-4">
                    <ReactMarkdown className="prose prose-invert max-w-none">
                      {executionResult.explanation}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}