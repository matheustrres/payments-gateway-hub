import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const Admin = createParamDecorator(
	(_: unknown, ctx: ExecutionContext) => {
		const request = ctx.switchToHttp().getRequest<Request>();
		return request.user as AdminPayload;
	},
);

export type AdminPayload = {
	sub: string;
	email: string;
};
