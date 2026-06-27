export interface Id<T> {
	equals(id: T): boolean;
	toString(): string;
}
