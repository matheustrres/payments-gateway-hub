import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export type AdminLoginUseCaseInput = {
	email: string;
	password: string;
};
export type AdminLoginUseCaseOutput = {
	admin: {
		id: string;
		name: string;
		email: string;
	};
	token: string;
};

export class AdminLoginBodyDto implements AdminLoginUseCaseInput {
	@ApiProperty({
		type: 'string',
		required: true,
		example: 'dev@idip.com.br',
	})
	@IsEmail()
	@IsNotEmpty()
	email!: string;

	@ApiProperty({
		type: 'string',
		required: true,
		example: 'z<A42$2>;F88',
	})
	@IsString()
	@IsNotEmpty()
	password!: string;
}
