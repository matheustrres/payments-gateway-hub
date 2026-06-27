declare namespace Express {
	export interface Request {
		user: {
			sub: string;
			email: string;
		};
		project?: {
			id: string;
			name: string;
			isProduction: boolean;
		};
		authType?: 'admin' | 'project';
	}
}
