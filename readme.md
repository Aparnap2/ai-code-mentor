# 🛠️ AI-Powered Python Code Execution

## 📌 Project Overview
This project provides a **secure AI-powered Python code execution environment**. Users can input natural language prompts, and the system:
1. Uses **Hugging Face LLM** to generate Python code.
2. **Executes the code in a secure Docker container**.
3. **Debugs errors & iterates until correct output**.
4. **Explains the generated code**.

### 🚀 Features:
✅ **LLM-Generated Python Code** (Using Hugging Face API)
✅ **Secure Execution with Docker** (Prevents system access)
✅ **Automated Debugging & Fixes** (Iterates until correct output)
✅ **Explains Code & Optimizations**
✅ **Full-Stack Integration** (Fastify backend, Next.js frontend)

---

## 🏗️ Project Structure
```
ide-docker-py/
│── frontend/            # Next.js frontend (React + Tailwind CSS)
│── python-secure/       # Dockerized Python execution environment
│   ├── Dockerfile      # Defines secure Python execution container
│   ├── requirements.txt # Minimal dependencies (if needed)
│   ├── safe_executor.py # Executes AI-generated Python code securely
│── src/                # Fastify backend for LLM & execution
│   ├── server.js       # Main backend API (LLM + Docker execution)
│   ├── config.js       # Configuration settings
│   ├── codeExecutor.js # Handles Python code execution in Docker
│── docker-compose.yml  # Containerized setup for easy deployment
│── package.json        # Backend dependencies
│── README.md           # Project documentation
```

---

## 🔧 Installation & Setup
### **1️⃣ Clone the Repository**
```sh
git clone https://github.com/your-repo/ide-docker-py.git
cd ide-docker-py
```

### **2️⃣ Install Backend Dependencies**
```sh
pnpm install  # Install Fastify & Hugging Face SDK
```

### **3️⃣ Set Hugging Face API Key**
```sh
export HF_TOKEN="your_huggingface_api_key"
```

### **4️⃣ Build & Run Docker Environment**
```sh
cd python-secure
docker build -t secure-python-executor .
```

### **5️⃣ Start Backend Server**
```sh
cd src
pnpm start
```

### **6️⃣ Start Frontend**
```sh
cd frontend
pnpm dev
```

---

## 🖥️ How It Works
1️⃣ **User provides a natural language prompt** (e.g., "Write a Python script to sort a list").  
2️⃣ **LLM (Hugging Face API) generates Python code.**  
3️⃣ **Code runs inside a secure Docker container.**  
4️⃣ **If errors occur, AI fixes the code & retries execution.**  
5️⃣ **The system returns the output & explains the code.**  

---

## 🐳 Docker Execution
### **Building & Running the Secure Python Container**
```sh
cd python-secure
docker build -t secure-python-executor .
docker run --rm secure-python-executor
```
### **Stopping Containers**
```sh
docker stop secure-python-executor
```

---

## 📜 API Endpoints
### **🔹 Generate & Execute Code**
**POST** `/execute`
```json
{
  "prompt": "Create a Python script to calculate Fibonacci numbers"
}
```
📤 **Response**:
```json
{
  "success": true,
  "iterations": 1,
  "code": "def fibonacci(n): ...",
  "output": "0 1 1 2 3 5 ...",
  "explanation": "This script calculates Fibonacci numbers..."
}
```

---

## 🤝 Contributing
🚀 Feel free to **fork this repository** and submit pull requests!  

---

## ⚖️ License
This project is open-source under the **MIT License**.

