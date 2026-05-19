export const appOrigins: string[] = [
	process.env.API_URL,
	process.env.ADMIN_URL,
	process.env.STORE_URL,
	process.env.LANDING_URL,
].filter((x): x is string => !!x);
