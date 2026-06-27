import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { AxiosHttpRequestingService } from './axios/axios-http-requesting.service';
import { IHttpRequestingService } from './requesting.interface';

@Module({
	imports: [HttpModule],
	providers: [
		{
			provide: IHttpRequestingService,
			useClass: AxiosHttpRequestingService,
		},
	],
	exports: [IHttpRequestingService],
})
export class HttpRequestingModule {}
