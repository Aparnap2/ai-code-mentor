import fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import Docker from 'dockerode';
import { HfInference } from '@huggingface/inference';
import fs from 'fs';
import path from 'path';

const app = fastify({ logger: true });
const docker = new Docker();
const hf = new HfInference(process.env.HF_TOKEN);

// Configure CORS
app.register(fastifyCors, {
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true,
  preflightContinue: true,
  optionsSuccessStatus: 204
});

// Create directories for outputs
const tmpDir = path.join(process.cwd(), 'tmp');
const plotsDir = path.join(tmpDir, 'plots');
const outputsDir = path.join(tmpDir, 'outputs');

[plotsDir, outputsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

function sanitizePythonCode(text) {
  const codeBlock = text.match(/```python([\s\S]*?)```/);
  return codeBlock ? codeBlock[1].trim() : text.trim();
}

// Modified to handle plotting code
function preparePythonCode(code) {
  // Add imports for plotting
  const imports = `
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import os
import sys
import io
import base64
from pathlib import Path
`;

  // Add plot saving code
  const plotSaving = `
# Save any existing plots
if plt.get_fignums():
    plt.savefig('/app/output/plot.png')
    plt.close('all')
    print("PLOT_SAVED=/app/output/plot.png")
`;

  return `${imports}\n${code}\n${plotSaving}`;
}

async function generatePythonCode(prompt) {
  try {
    const response = await hf.textGeneration({
      model: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      inputs: `Write Python 3.11 code for: "${prompt}"\n\n` +
             `If this involves plotting, use matplotlib. Return only the Python code without explanations.`,
      parameters: { temperature: 0.2, max_new_tokens: 1000 }
    });

    return sanitizePythonCode(response.generated_text);
  } catch (error) {
    app.log.error(`Code generation failed: ${error}`);
    throw new Error('Failed to generate code');
  }
}

async function executePython(code, timeout = 15000) {
  // Create unique output directory for this execution
  const execId = Date.now().toString();
  const execOutputDir = path.join(outputsDir, execId);
  fs.mkdirSync(execOutputDir);

  const container = await docker.createContainer({
    Image: 'ide-docker-py-python-executor',
    Cmd: ['python', '-c', preparePythonCode(code)],
    StopTimeout: 10,
    HostConfig: {
      AutoRemove: true,
      Memory: 200 * 1024 * 1024, // 200MB limit
      NetworkMode: 'none',
      SecurityOpt: ['no-new-privileges'],
      Binds: [`${execOutputDir}:/app/output:rw`], // Mount output directory
    },
    WorkingDir: '/app/output'
  });

  try {
    const output = await new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        container.stop();
        reject(new Error('Execution timeout (15s exceeded)'));
      }, timeout);

      await container.start();
      const stream = await container.logs({ 
        follow: true, 
        stdout: true, 
        stderr: true 
      });

      let result = '';
      stream.on('data', chunk => result += chunk);
      stream.on('end', () => {
        clearTimeout(timeoutId);
        resolve(result);
      });
      stream.on('error', reject);
    });

    // Check for plot output
    const plotMatch = output.toString().match(/PLOT_SAVED=(.*)/);
    let plotPath = null;
    let plotData = null;

    if (plotMatch) {
      const containerPlotPath = plotMatch[1];
      const localPlotPath = path.join(execOutputDir, 'plot.png');
      
      if (fs.existsSync(localPlotPath)) {
        plotData = fs.readFileSync(localPlotPath).toString('base64');
        plotPath = `data:image/png;base64,${plotData}`;
      }
    }

    return {
      success: !/Traceback|Error/.test(output),
      output: output.replace(/PLOT_SAVED=.*\n?/g, '').trim(),
      plot: plotPath,
      files: []
    };
  } finally {
    await container.stop().catch(() => {});
    // Cleanup output directory after delay
    setTimeout(() => {
      fs.rmSync(execOutputDir, { recursive: true, force: true });
    }, 1000);
  }
}

// Rest of the code remains the same until the execute endpoint

app.post('/execute', async (request, reply) => {
  const { prompt, maxAttempts = 5 } = request.body;
  
  if (!prompt || typeof prompt !== 'string' || prompt.length > 500) {
    return reply.code(400).send({ error: 'Invalid prompt format' });
  }

  let attempt = 0;
  let history = [];
  let currentCode = null;

  try {
    while (attempt < maxAttempts) {
      attempt++;
      
      currentCode = await generatePythonCode(prompt);
      history.push({ type: 'generation', code: currentCode });

      const result = await executePython(currentCode);
      
      if (result.success) {
        const explanation = await hf.textGeneration({
          model: 'Qwen/Qwen2.5-Coder-32B-Instruct',
          inputs: `Explain this Python script to a beginner:\n\`\`\`python\n${currentCode}\n\`\`\``,
          parameters: { temperature: 0.2, max_new_tokens: 1000 }
        });

        return reply.send({
          success: true,
          code: currentCode,
          output: result.output,
          plot: result.plot, // Include plot data in response
          explanation: explanation.generated_text.trim(),
          attempts: attempt,
          debugHistory: history
        });
      }

      const errorAnalysis = analyzeError(result.output);
      history.push({ error: errorAnalysis, attempt });
      
      if (errorAnalysis.fatal) {
        throw new Error(`Fatal error: ${errorAnalysis.type}`);
      }

      const fixedCode = await debugPythonCode(currentCode, errorAnalysis);
      if (!fixedCode) break;
      currentCode = fixedCode;
    }

    return reply.send({
      success: false,
      error: 'Maximum attempts reached',
      finalCode: currentCode,
      debugHistory: history
    });

  } catch (error) {
    app.log.error(`Execution failed: ${error.stack}`);
    return reply.code(500).send({
      error: 'Execution failed',
      details: error.message,
      ...(currentCode && { code: currentCode }),
      debugHistory: history
    });
  }
});

// Start server
const start = async () => {
  try {
    await app.listen({ port: 3001, host: '0.0.0.0' });
    console.log('🚀 Execution service ready at http://localhost:3001');
  } catch (err) {
    console.error('Server startup failed:', err);
    process.exit(1);
  }
};

start();