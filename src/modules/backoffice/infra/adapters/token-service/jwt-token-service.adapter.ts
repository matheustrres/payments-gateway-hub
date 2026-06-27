import { Injectable, UnauthorizedException } from '@nestjs/common';
import { decode, sign, verify } from 'jsonwebtoken';

import { JwtPayload } from '@/core/types';

import { ITokenService } from '@/modules/backoffice/application/ports/token-service.port';

@Injectable()
export class JwtTokenServiceAdapter implements ITokenService {
	decode(token: string): JwtPayload {
		const payload = decode(token);
		if (!payload) throw new UnauthorizedException();
		return JSON.parse(JSON.stringify(payload)) as JwtPayload;
	}

	async sign(
		payload: JwtPayload,
		expiresIn: number,
		key: string,
	): Promise<string> {
		return sign(payload, key, {
			expiresIn,
		});
	}

	verify(token: string, key: string): boolean {
		try {
			verify(token, key, { ignoreExpiration: false });
			return true;
		} catch (error) {
			return false;
		}
	}
}
