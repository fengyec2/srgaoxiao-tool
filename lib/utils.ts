// Utility functions for the application

/**
 * Sets CORS headers for Vercel Functions
 */
export function setCorsHeaders(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * Handles OPTIONS request for CORS preflight
 */
export function handleOptionsRequest(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.status(200).end();
    return true;
  }
  return false;
}

/**
 * Validates required parameters
 */
export function validateRequired(params: Record<string, any>, required: string[]): string | null {
  for (const param of required) {
    if (!params[param] || (typeof params[param] === 'string' && params[param].trim() === '')) {
      return `${param} 不能为空`;
    }
  }
  return null;
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(error: any, statusCode = 500) {
  console.error('Error:', error);
  
  return {
    statusCode,
    body: JSON.stringify({
      error: error.message || '服务器内部错误',
      timestamp: new Date().toISOString()
    })
  };
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse(data: any, statusCode = 200) {
  return {
    statusCode,
    body: JSON.stringify(data)
  };
}