import sys
import resource
import ast

# Set resource limits
resource.setrlimit(resource.RLIMIT_CPU, (5, 5))  # 5 seconds CPU
resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))  # 512MB
resource.setrlimit(resource.RLIMIT_FSIZE, (1024 * 1024, 1024 * 1024))  # 1MB

# Validate AST before execution
def validate_code(code):
    try:
        ast.parse(code)
        return True
    except SyntaxError:
        return False

if __name__ == "__main__":
    try:
        code = sys.stdin.read()
        if not validate_code(code):
            raise RuntimeError("Invalid syntax detected")
            
        exec(code, {'__builtins__': {}})
    except Exception as e:
        print(f"Execution failed: {str(e)}")
        sys.exit(1)