import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Observable } from 'rxjs';

import { IHttpRequestingService } from '../requesting.interface';

@Injectable()
export class AxiosHttpRequestingService implements IHttpRequestingService {
	constructor(private readonly httpService: HttpService) {}

	get<T = any>(
		url: string,
		config?: AxiosRequestConfig,
	): Observable<AxiosResponse<T>> {
		return this.httpService.get<T>(url, config);
	}

	post<T = any>(
		url: string,
		data?: any,
		config?: AxiosRequestConfig,
	): Observable<AxiosResponse<T>> {
		return this.httpService.post<T>(url, data, config);
	}

	put<T = any>(
		url: string,
		data?: any,
		config?: AxiosRequestConfig,
	): Observable<AxiosResponse<T>> {
		return this.httpService.put<T>(url, data, config);
	}

	delete<T = any>(
		url: string,
		config?: AxiosRequestConfig,
	): Observable<AxiosResponse<T>> {
		return this.httpService.delete<T>(url, config);
	}
}
