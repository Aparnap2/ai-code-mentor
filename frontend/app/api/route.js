export const executePythonCode = async (code) => {
    try {
      const response = await fetch('http://localhost:3001/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          //'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN}`
        },
        body: JSON.stringify({ code })
      });
  
      if (!response.ok) throw new Error('Execution failed');
      return await response.json();
    } catch (error) {
      return { error: error.message };
    }
  };