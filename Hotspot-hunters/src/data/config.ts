/** Browser-safe config only; private FIRMS credentials stay in the backend. */
export const apiConfig={baseUrl:import.meta.env?.VITE_API_URL?.trim().replace(/\/$/,'')||'/backend-api',timeoutMs:15000,mapLimit:5000,maxResponseBytes:16*1024*1024};
