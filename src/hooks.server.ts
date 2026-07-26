import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// 1. Handle CORS Preflight (OPTIONS)
	if (event.request.method === 'OPTIONS') {
		return new Response(null, {
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-upload-token, content-length',
				'Access-Control-Max-Age': '86400'
			}
		});
	}

	// 2. Process the actual request
	const response = await resolve(event);

	// 3. Append CORS headers to responses for API and Upload routes
	if (event.url.pathname.startsWith('/api') || event.url.pathname.startsWith('/upload')) {
		response.headers.set('Access-Control-Allow-Origin', '*');
		response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
		response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-upload-token, content-length');
	}

	return response;
};
