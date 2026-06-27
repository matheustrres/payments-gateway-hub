import { INestApplication } from '@nestjs/common';
import request from 'supertest';

export async function getAdminToken(app: INestApplication): Promise<string> {
	const response = await request(app.getHttpServer())
		.post('/backoffice/auth/login')
		.send({
			email: process.env['ADMIN_EMAIL'] || 'dev@idip.com.br',
			password: process.env['ADMIN_PASSWORD'] || 'z<A42$2>;F88',
		})
		.expect(201);

	return response.body.token;
}
