export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export type BetterOmit<T, K extends keyof T> = {
	[P in keyof T as Exclude<P, K>]: T[P];
};

export type Nullable<T, K extends keyof T> = Omit<T, K> & {
	[P in K]: T[P] | null;
};

/**
 * "iv:content:tag"
 */
export type EncryptedCredentials = `${string}:${string}:${string}`;

export type PaymentMetadata = Record<string, unknown> | null;

export type JwtPayload = {
	sub: string;
	email: string;
};
