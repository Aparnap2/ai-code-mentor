import Docker from "dockerode";
import { HfInference } from "@huggingface/inference";
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";

class CodeInterpreter {
  constructor(chatId, language = "python") {
    this.chatId = chatId;
    this.language = language;
    this.docker = new Docker();
    this.hfInference = new HfInference(process.env.HF_TOKEN);
    this.duckDuckGo = new DuckDuckGoSearch();
  }

  async executeCode(code, timeout = 30000) {
    let container;
    try {
      container = await this.docker.createContainer({
        Image: "python:3.9-slim",
        Tty: false,
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        OpenStdin: true,
        StdinOnce: true,
        HostConfig: {
          Memory: 512 * 1024 * 1024,
          MemorySwap: 512 * 1024 * 1024,
          NetworkMode: 'none',
          AutoRemove: true
        },
        Cmd: ["python", "-c", code],
      });

      await container.start();

      const stream = await container.logs({ 
        follow: true, 
        stdout: true, 
        stderr: true 
      });

      const output = await new Promise((resolve, reject) => {
        let result = '';
        stream.on('data', chunk => result += chunk);
        stream.on('end', () => resolve(result));
        stream.on('error', reject);
        
        setTimeout(() => {
          container.stop();
          reject(new Error('Execution timeout'));
        }, timeout);
      });

      return output.trim();
    } catch (error) {
      console.error("Error executing AI-generated code:", error);
      throw new Error(`Code execution failed: ${error.message}`);
    } finally {
      if (container) {
        await container.remove().catch((err) => 
          console.warn("Error removing container:", err)
        );
      }
    }
  }

  async classifyOutput(output) {
    try {
      const result = await this.hfInference.textClassification({
        model: "Qwen/Qwen2.5-Coder-2.5B-Instruct",
        inputs: output,
      });
      return result[0]?.label || "Unknown";
    } catch (error) {
      console.error("Error classifying output:", error);
      return "Classification failed";
    }
  }

  async searchDocumentation(query) {
    try {
      console.log(`🔍 Searching DuckDuckGo for: ${query}`);
      const searchResults = await this.duckDuckGo.run(query);
      console.log("📄 Documentation retrieved:", searchResults);
      return searchResults;
    } catch (error) {
      console.error("Error fetching documentation:", error);
      return ["Error fetching documentation"];
    }
  }

  async debugCode(code, desiredOutcome) {
    const maxIterations = 10;
    let iteration = 0;
    let currentOutcome;

    try {
      while (iteration < maxIterations) {
        console.log(`Iteration ${iteration + 1}: Executing code...`);
        const output = await this.executeCode(code);

        console.log("Classifying output using Hugging Face Inference API...");
        currentOutcome = await this.classifyOutput(output);
        console.log("Current outcome:", currentOutcome);

        if (currentOutcome === desiredOutcome) {
          console.log("✅ Desired outcome achieved!");
          return currentOutcome;
        }

        console.log("🔧 Improving code...");
        // Replace this with actual improvement logic
        code = `# AI-improved version\n${code}`;

        console.log("🔍 Searching relevant documentation with DuckDuckGo...");
        const documentation = await this.searchDocumentation(
          `fix ${this.language} code: ${desiredOutcome}`
        );

        iteration++;
      }

      console.warn("⚠️ Max iterations reached without achieving the desired outcome.");
      return currentOutcome;
    } catch (error) {
      console.error("❌ Error during debugging:", error);
      throw new Error("Debugging process failed");
    }
  }
}

export default CodeInterpreter;