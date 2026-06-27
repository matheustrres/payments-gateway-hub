import { CreateProjectUseCase } from '@/modules/backoffice/application/use-cases/create-project/create-project.use-case';
import { IProjectsRepository } from '@/modules/backoffice/domain/repositories/projects.repository';

import { errorMessages } from '@/shared/utils/err-messages';

import { createProjectsRepositoryMock } from '#/data/mocks/repositories/projects.repository';

describe(CreateProjectUseCase.name, () => {
	let sut: CreateProjectUseCase;
	let projectsRepository: IProjectsRepository;

	beforeEach(() => {
		projectsRepository = createProjectsRepositoryMock();
		sut = new CreateProjectUseCase(projectsRepository);
	});

	it('should throw if project name is already taken', async () => {
		vi.spyOn(projectsRepository, 'existsByName').mockResolvedValueOnce(true);
		await expect(
			sut.exec({
				adminId: 'admin-id-123',
				name: 'Existing Project',
				webhookUrl: 'https://example.com/webhook',
			}),
		).rejects.toThrowError(errorMessages.projects.nameAlreadyTaken);
		expect(projectsRepository.existsByName).toHaveBeenCalledWith(
			'Existing Project',
		);
	});

	it('should create a new project successfully', async () => {
		vi.spyOn(projectsRepository, 'existsByName').mockResolvedValueOnce(false);
		vi.spyOn(projectsRepository, 'insertOne');
		const result = await sut.exec({
			adminId: 'admin-id-123',
			name: 'New Project',
			webhookUrl: 'https://example.com/webhook',
		});
		expect(projectsRepository.existsByName).toHaveBeenCalledWith('New Project');
		expect(projectsRepository.insertOne).toHaveBeenCalled();
		expect(result.project).toEqual({
			id: expect.any(String),
			name: 'New Project',
			isActive: true,
			testApiKey: expect.any(String),
			liveApiKey: expect.any(String),
			createdAt: expect.any(Date),
			updatedAt: null,
		});
		expect(result.project.testApiKey).toMatch(/^sk_test_[a-f0-9]{48}$/);
		expect(result.project.liveApiKey).toMatch(/^sk_live_[a-f0-9]{48}$/);
	});
});
