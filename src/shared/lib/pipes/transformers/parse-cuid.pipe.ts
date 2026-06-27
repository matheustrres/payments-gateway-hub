import { BadRequestException, PipeTransform } from '@nestjs/common';
import { isCuid } from '@paralleldrive/cuid2';

export class ParseCUIDPipe implements PipeTransform<string> {
	transform(value: string): string {
		if (typeof value === 'string' && !isCuid(value)) {
			throw new BadRequestException('Invalid CUID value.');
		}
		return value;
	}
}
