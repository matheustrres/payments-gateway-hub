import { Injectable, UnauthorizedException } from '@nestjs/common';

import {
	AdminLoginUseCaseInput,
	AdminLoginUseCaseOutput,
} from '../dtos/admin-login.dto';

import { IUseCase } from '@/core/use-case';

import { ITokenService } from '@/modules/backoffice/application/ports/token-service.port';
import { IAdminsRepository } from '@/modules/backoffice/domain/repositories/admins.repository';

import { EnvService } from '@/shared/modules/env/env.service';
import { errorMessages } from '@/shared/utils/err-messages';

@Injectable()
export class AdminLoginUseCase implements IUseCase<
	AdminLoginUseCaseInput,
	AdminLoginUseCaseOutput
> {
	constructor(
		private readonly adminsRepository: IAdminsRepository,
		private readonly tokenService: ITokenService,
		private readonly envService: EnvService,
	) {}

	async exec({
		email,
		password,
	}: AdminLoginUseCaseInput): Promise<AdminLoginUseCaseOutput> {
		const admin = await this.adminsRepository.findByEmail(email);
		if (!admin) {
			throw new UnauthorizedException(errorMessages.auth.invalidCredentials);
		}
		const isPasswordValid = await admin.password.compare(password);
		if (!isPasswordValid) {
			throw new UnauthorizedException(errorMessages.auth.invalidCredentials);
		}
		const id = admin.id.toString();
		const token = await this.tokenService.sign(
			{
				email: admin.email,
				sub: id,
			},
			3600 * 24,
			this.envService.getKeyOrThrow('JWT_SECRET'),
		);
		return {
			admin: {
				id: id,
				name: admin.name,
				email: admin.email,
			},
			token,
		};
	}
}
