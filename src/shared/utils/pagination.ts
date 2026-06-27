import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

export type PaginationParams = {
	skip?: number;
	limit?: number;
	sortOrder?: 'asc' | 'desc';
};

export type PaginationMeta = {
	currentPage: number;
	totalPages: number;
	totalItems: number;
	itemsPerPage: number;
};

export type PaginatedResponse<T> = {
	pagination: PaginationMeta;
	data: T[];
};

export class PaginationQueryDto {
	@ApiProperty({
		type: 'number',
		required: false,
		example: 10,
		description: 'Número de itens por página (padrão: 10)',
	})
	@IsInt({ message: 'O limite deve ser um número inteiro.' })
	@IsOptional()
	@Transform(({ value }) => parseInt(value))
	limit = 10;

	@ApiProperty({
		type: 'number',
		required: false,
		example: 1,
		description: 'Número da página atual (padrão: 1)',
	})
	@IsInt({ message: 'A página deve ser um número inteiro.' })
	@IsOptional()
	@Transform(({ value }) => parseInt(value))
	page = 1;

	@ApiProperty({
		type: 'number',
		required: false,
		example: 0,
		description: 'Número de itens a serem pulados (padrão: 0)',
	})
	@IsInt({
		message: 'O número de itens a serem pulados deve ser um número inteiro.',
	})
	@IsOptional()
	@Transform(({ value }) => parseInt(value))
	skip = 0;
}

export class PaginationHelper {
	static calcSkip(page: number, limit: number): number {
		return (page - 1) * limit;
	}

	static calcTotalPages(totalItems: number, limit: number): number {
		return Math.ceil(totalItems / limit);
	}

	static buildPaginationMeta(
		page: number,
		limit: number,
		totalItems: number,
	): PaginationMeta {
		return {
			currentPage: page,
			totalPages: this.calcTotalPages(totalItems, limit),
			totalItems,
			itemsPerPage: limit,
		};
	}
}
