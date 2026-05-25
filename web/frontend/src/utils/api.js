/**
 * API helper functions
 * These work with the ServerContext's api client (axios instance)
 * Usage: import { useServer } from '../contexts/ServerContext';
 *        const { api } = useServer();
 *        const res = await api.get('/domains');
 *
 * The api client is pre-configured with the active server's URL and token.
 * All API calls go directly to the VPS Agent running on the target server.
 */

// Nothing to export - all API calls use the context's api client directly
// This file is kept for reference and backward compatibility
