import { JwtPayload } from '@/core/types';

export abstract class ITokenService {
	abstract decode(token: string): JwtPayload;
	abstract sign(
		payload: JwtPayload,
		expiresIn: number,
		key: string,
	): Promise<string>;
	abstract verify(token: string, key: string): boolean;
}
