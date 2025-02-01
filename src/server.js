import fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import Docker from 'dockerode';
import { HfInference } from '@huggingface/inference';
import fs from 'fs';
import path from 'path';

const app = fastify({ logger: true });
const docker = new Docker();
const hf = new HfInference(process.env.HF_TOKEN);

// Configure CORS with proper OPTIONS handling
app.register(fastifyCors, {
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true,
  preflightContinue: true,
  optionsSuccessStatus: 204
});

// Add OPTIONS handler for the execute endpoint
app.options('/execute', async (request, reply) => {
  reply.send();
});

// Security and error patterns
const DANGEROUS_PATTERNS = {
  system: /(os\.system|subprocess\.run|subprocess\.Popen|exec|eval)/,
  file: /(open\(.*[wa].*\)|write|file\.|pathlib)/,
  network: /(socket|requests|urllib|http|ftp)/,
  execution: /(exec|eval|compile|__import__)/,
  input: /(input|raw_input)/,
  shell: /(sh|bash|shell|command)/,
  imports: /__import__/,
  env: /environ/
};

const ALLOWED_MODULES = new Set([
  'math', 'random', 'datetime', 'collections', 
  'itertools', 'functools', 'string', 're',
  'json', 'csv', 'typing', 'enum'
]);

const ALLOWED_BUILTINS = new Set([
  'abs', 'all', 'any', 'bin', 'bool', 'chr', 'dict', 
  'dir', 'divmod', 'enumerate', 'filter', 'float', 
  'format', 'frozenset', 'hash', 'hex', 'int', 'isinstance',
  'issubclass', 'len', 'list', 'map', 'max', 'min', 'next',
  'oct', 'ord', 'pow', 'print', 'range', 'repr', 'reversed',
  'round', 'set', 'slice', 'sorted', 'str', 'sum', 'tuple',
  'type', 'zip', 'lru_cache'  // Added lru_cache
]);

// Enhanced error patterns
const ERROR_PATTERNS = {
  syntax: /SyntaxError: (.*)/,
  import: /ModuleNotFoundError: No module named '(.*)'/,
  name: /NameError: name '(.*)' is not defined/,
  type: /TypeError: (.*)/,
  value: /ValueError: (.*)/,
  eof: /EOFError: EOF when reading a line/,
  memory: /MemoryError/,
  recursion: /RecursionError: (.*)/,
  assertion: /AssertionError: (.*)/,
  attribute: /AttributeError: (.*)/,
  index: /IndexError: (.*)/,
  key: /KeyError: (.*)/,
  zero_division: /ZeroDivisionError: (.*)/
};

// Create temporary directory for Python output
const tmpDir = path.join(process.cwd(), 'tmp', 'python_output');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

/**
 * Enhanced code security validation
 */
/**
 * Enhanced code security validation
 */
function validatePythonCode(code) {
  // Check for dangerous patterns
  for (const [category, pattern] of Object.entries(DANGEROUS_PATTERNS)) {
    if (pattern.test(code)) {
      throw new Error(`Dangerous ${category} operation detected`);
    }
  }

  // Validate imports
  const importMatches = code.matchAll(/(?:import|from)\s+([a-zA-Z0-9_.]+)/g);
  for (const match of importMatches) {
    const module = match[1].split('.')[0];
    if (!ALLOWED_MODULES.has(module)) {
      throw new Error(`Unauthorized module: ${module}`);
    }
  }

  // Parse function definitions and decorators
  const functionDefs = new Set(
    Array.from(code.matchAll(/(?:def\s+([a-zA-Z_][a-zA-Z0-9_]*)|@([a-zA-Z_][a-zA-Z0-9_]*))/g))
      .flatMap(match => [match[1], match[2]].filter(Boolean))
  );

  // Check for builtin function calls while allowing custom function definitions
  const builtinMatches = code.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g);
  for (const match of builtinMatches) {
    const func = match[1];
    
    // Skip if it's a defined function, decorator, or allowed builtin
    if (functionDefs.has(func) || 
        ALLOWED_BUILTINS.has(func) || 
        /^[A-Z]/.test(func)) {  // Allow class instantiation
      continue;
    }

    // Additional check for math functions
    if (code.includes('import math') && func.startsWith('math.')) {
      continue;
    }

    // Additional check for other allowed module functions
    const modulePrefix = Array.from(ALLOWED_MODULES).find(module => 
      func.startsWith(`${module}.`)
    );
    if (modulePrefix && code.includes(`import ${modulePrefix}`)) {
      continue;
    }

    // If not a defined function or allowed builtin, raise error
    throw new Error(`Unauthorized function: ${func}`);
  }

  return true;
}
/**
 * Enhanced code sanitization
 */
function sanitizePythonCode(text) {
  // Remove markdown code blocks if present
  const codeBlock = text.match(/```python([\s\S]*?)```/);
  const cleanCode = codeBlock ? codeBlock[1] : text;
  
  // Basic cleanup
  const sanitized = cleanCode
    .trim()
    .replace(/^\s*#!/, '# !') // Prevent shebang
    .replace(/\r\n/g, '\n');  // Normalize line endings
    
  // Validate the sanitized code
  validatePythonCode(sanitized);
  
  return sanitized;
}

/**
 * Generate Python code with enhanced validation
 */
async function generatePythonCode(prompt) {
  try {
    const response = await hf.textGeneration({
      model: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      inputs: `Create a secure Python 3.11 script for: "${prompt}"\n\n`
             + `Requirements:\n`
             + '- Use only these modules: math, random, datetime, collections, itertools, functools, string, re, json, csv\n'
             + '- Custom functions and decorators (e.g., @lru_cache) are allowed\n'
             + '- Never use input(), file operations, or system calls\n'
             + '- Add proper error handling\n'
             + '- Return pure Python code without comments or explanations',
      parameters: { temperature: 0.2, max_new_tokens: 600 }
    });

    return sanitizePythonCode(response.generated_text);
  } catch (error) {
    app.log.error(`Code generation failed: ${error}`);
    throw new Error('Failed to generate valid code');
  }
}

/**
 * Secure Docker execution with resource limits
 */
async function executePython(code, timeout = 5000) {
  const container = await docker.createContainer({
    Image: 'ide-docker-py-python-executor',
    Cmd: ['python', '-c', code],
    Env: ['PYTHONUNBUFFERED=1', 'MAX_MEMORY=100MB'],
    StopTimeout: 10,
    HostConfig: {
      AutoRemove: true,
      ReadonlyRootfs: true,
      Memory: 100 * 1024 * 1024,
      MemorySwap: 200 * 1024 * 1024,
      CpuPeriod: 100000,
      CpuQuota: 50000,
      NetworkMode: 'none',
      SecurityOpt: ['no-new-privileges'],
      CapDrop: ['ALL']
    }
  });

  try {
    const output = await new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        container.stop();
        reject(new Error('Execution timeout (5s exceeded)'));
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

    return {
      success: !/Traceback|Error/.test(output),
      output: output.trim(),
      files: []
    };
  } finally {
    await container.stop().catch(() => {});
  }
}

/**
 * Enhanced error analysis
 */
function analyzeError(output) {
  // Check for specific error patterns
  for (const [type, pattern] of Object.entries(ERROR_PATTERNS)) {
    const match = output.match(pattern);
    if (match) {
      return {
        type,
        message: match[1] || output,
        fatal: ['syntax', 'import', 'eof', 'memory', 'recursion'].includes(type)
      };
    }
  }
  
  // Check for generic errors
  if (output.includes('Traceback')) {
    return { type: 'runtime', message: output, fatal: false };
  }
  
  return { type: 'unknown', message: output, fatal: false };
}

/**
 * AI-powered debugging with safety checks
 */
async function debugPythonCode(code, error) {
  try {
    const response = await hf.textGeneration({
      model: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      inputs: `Fix this Python code:\n\`\`\`python\n${code}\n\`\`\`\n\n`
             + `Error: ${error.message}\n`
             + `Requirements:\n`
             + '- Only use allowed modules: math, random, datetime, collections, itertools, functools, string, re, json, csv\n'
             + '- Never use input(), file operations, or system calls\n'
             + '- Preserve original functionality\n'
             + '- Add proper error handling',
      parameters: { temperature: 0.3, max_new_tokens: 600 }
    });

    const fixedCode = sanitizePythonCode(response.generated_text);
    
    // Validate the fix
    if (fixedCode === code) {
      throw new Error('No improvement in fixed code');
    }
    
    return fixedCode;
  } catch (error) {
    app.log.error(`Debugging failed: ${error}`);
    return null;
  }
}

/**
 * Main execution endpoint with enhanced validation and error handling
 */
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
          parameters: { temperature: 0.2, max_new_tokens: 400 }
        });

        return reply.send({
          success: true,
          code: currentCode,
          output: result.output,
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

// Health check endpoint
app.get('/health', async (request, reply) => {
  try {
    await docker.ping();
    await hf.textGeneration({
      model: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      inputs: 'test',
      parameters: { max_new_tokens: 1 }
    });
    return reply.send({ status: 'healthy' });
  } catch (error) {
    return reply.code(503).send({ 
      status: 'unhealthy',
      error: error.message 
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