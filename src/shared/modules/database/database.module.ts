import { Global, Module } from '@nestjs/common';

import { DatabaseService } from './database.service';

import { EnvModule } from '../env/env.module';

@Global()
@Module({
	imports: [EnvModule],
	providers: [DatabaseService],
	exports: [DatabaseService],
})
export class DatabaseModule {}
