import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Observable } from 'rxjs';

export abstract class IHttpRequestingService {
	abstract get<T = any>(
		url: string,
		config?: AxiosRequestConfig,
	): Observable<AxiosResponse<T>>;
	abstract post<T = any>(
		url: string,
		data?: any,
		config?: AxiosRequestConfig,
	): Observable<AxiosResponse<T>>;
	abstract put<T = any>(
		url: string,
		data?: any,
		config?: AxiosRequestConfig,
	): Observable<AxiosResponse<T>>;
	abstract delete<T = any>(
		url: string,
		config?: AxiosRequestConfig,
	): Observable<AxiosResponse<T>>;
}
