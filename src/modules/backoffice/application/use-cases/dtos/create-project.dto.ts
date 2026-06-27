import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateProjectBodyDto {
	@ApiProperty({
		type: 'string',
		required: true,
	})
	@IsString()
	@IsNotEmpty()
	name!: string;

	@ApiProperty({
		type: 'string',
		required: true,
	})
	@IsString()
	@IsNotEmpty()
	@Matches(/^https?:\/\/[^\s$.?#].[^\s]*$/gm, {
		message: 'webhookUrl must be a valid URL',
	})
	webhookUrl!: string;
}

export type CreateProjectUseCaseInput = {
	name: string;
	webhookUrl: string;
	adminId: string;
};

export type CreateProjectUseCaseOutput = {
	project: {
		id: string;
		name: string;
		isActive: boolean;
		testApiKey: string;
		liveApiKey: string;
		createdAt: Date;
		updatedAt: Date | null;
	};
};
