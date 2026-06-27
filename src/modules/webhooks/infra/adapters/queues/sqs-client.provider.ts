import { SQSClient } from '@aws-sdk/client-sqs';

import { EnvService } from '@/shared/modules/env/env.service';

export const SQS_CLIENT = 'SQS_CLIENT';

export const SqsClientProvider = {
	provide: SQS_CLIENT,
	useFactory: (envService: EnvService) => {
		return new SQSClient({
			region: envService.getKeyOrThrow('AWS_REGION'),
			credentials: {
				accessKeyId: envService.getKeyOrThrow('AWS_ACCESS_KEY_ID'),
				secretAccessKey: envService.getKeyOrThrow('AWS_SECRET_ACCESS_KEY'),
			},
		});
	},
	inject: [EnvService],
};
