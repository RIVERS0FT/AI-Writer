import type {
  Chapter,
  ChapterVersion,
  Character,
  GenerationJob,
  GenerationOutput,
  NovelProject,
  OutlineNode,
  TokenUsageRecord,
  UsageSummary,
  Volume,
  WorldEntry,
  WritingStep,
} from "@ai-writer/core";
import type {
  ConnectionTestResult,
  GenerationStreamEvent,
  ModelProfile,
  ProviderConfig,
  ProviderRuntimeRequest,
} from "@ai-writer/providers";
import type {
  CreateChapterInput,
  CreateChapterVersionInput,
  CreateCharacterInput,
  CreateGenerationJobInput,
  CreateOutlineNodeInput,
  CreateProjectInput,
  CreateVolumeInput,
  CreateWorldEntryInput,
  CreateWritingStepInput,
  RecordTokenUsageInput,
  UpdateChapterContentInput,
  UpdateChapterMetadataInput,
  UpdateCharacterInput,
  UpdateGenerationJobInput,
  UpdateOutlineNodeInput,
  UpdateVolumeInput,
  UpdateWorldEntryInput,
  UpdateWritingStepInput,
} from "@ai-writer/schemas";

export interface RuntimeInfo {
  name: string;
  version: string;
  platform: "native" | "web";
  os?: string;
  arch?: string;
}

export interface ProjectRepository {
  list(): Promise<NovelProject[]>;
  create(input: CreateProjectInput): Promise<NovelProject>;
}

export interface ContentRepository {
  listVolumes(projectId: string): Promise<Volume[]>;
  createVolume(input: CreateVolumeInput): Promise<Volume>;
  updateVolume(input: UpdateVolumeInput): Promise<Volume>;
  deleteVolume(id: string): Promise<void>;
  restoreVolume(id: string): Promise<Volume>;
  listChapters(projectId: string): Promise<Chapter[]>;
  getChapter(id: string): Promise<Chapter | undefined>;
  createChapter(input: CreateChapterInput): Promise<Chapter>;
  updateChapter(input: UpdateChapterMetadataInput): Promise<Chapter>;
  deleteChapter(id: string): Promise<void>;
  restoreChapter(id: string): Promise<Chapter>;
  saveChapterContent(input: UpdateChapterContentInput): Promise<Chapter>;
  createChapterVersion(input: CreateChapterVersionInput): Promise<ChapterVersion>;
  listChapterVersions(chapterId: string): Promise<ChapterVersion[]>;
  restoreChapterVersion(versionId: string): Promise<Chapter>;
}

export interface KnowledgeRepository {
  listCharacters(projectId: string): Promise<Character[]>;
  createCharacter(input: CreateCharacterInput): Promise<Character>;
  updateCharacter(input: UpdateCharacterInput): Promise<Character>;
  deleteCharacter(id: string): Promise<void>;
  listWorldEntries(projectId: string): Promise<WorldEntry[]>;
  createWorldEntry(input: CreateWorldEntryInput): Promise<WorldEntry>;
  updateWorldEntry(input: UpdateWorldEntryInput): Promise<WorldEntry>;
  deleteWorldEntry(id: string): Promise<void>;
  listOutlineNodes(projectId: string): Promise<OutlineNode[]>;
  createOutlineNode(input: CreateOutlineNodeInput): Promise<OutlineNode>;
  updateOutlineNode(input: UpdateOutlineNodeInput): Promise<OutlineNode>;
  deleteOutlineNode(id: string): Promise<void>;
}

export type CreateGenerationJobRequest = Omit<
  CreateGenerationJobInput,
  "instruction" | "pipelineVersion" | "promptSetVersion" | "options"
> &
  Partial<
    Pick<
      CreateGenerationJobInput,
      "instruction" | "pipelineVersion" | "promptSetVersion" | "options"
    >
  >;

export interface GenerationJobRepository {
  listRecent(projectId: string, limit?: number): Promise<GenerationJob[]>;
  create(input: CreateGenerationJobRequest): Promise<GenerationJob>;
  update(id: string, input: UpdateGenerationJobInput): Promise<GenerationJob>;
  replaceOutput(jobId: string, content: string): Promise<GenerationOutput>;
  getOutput(jobId: string): Promise<GenerationOutput | undefined>;
  markInterrupted(projectId: string): Promise<number>;
}

export interface WritingRepository {
  listSteps(jobId: string): Promise<WritingStep[]>;
  createStep(input: CreateWritingStepInput): Promise<WritingStep>;
  updateStep(id: string, input: UpdateWritingStepInput): Promise<WritingStep>;
}

export interface UsageRepository {
  recordRequest(input: RecordTokenUsageInput): Promise<TokenUsageRecord>;
  listForJob(jobId: string): Promise<TokenUsageRecord[]>;
  summarizeTask(jobId: string): Promise<UsageSummary>;
  summarizeChapter(chapterId: string): Promise<UsageSummary>;
  summarizeProject(projectId: string): Promise<UsageSummary>;
  summarizeModel(modelProfileId: string): Promise<UsageSummary>;
}

export interface ProviderRepository {
  listProviders(): Promise<ProviderConfig[]>;
  saveProvider(config: ProviderConfig): Promise<ProviderConfig>;
  deleteProvider(id: string): Promise<void>;
  listModelProfiles(providerConfigId: string): Promise<ModelProfile[]>;
  saveModelProfile(profile: ModelProfile): Promise<ModelProfile>;
  deleteModelProfile(id: string): Promise<void>;
}

export interface SecureStorageService {
  unlock(password: string): Promise<void>;
  isUnlocked(): boolean;
  setSecret(key: string, value: string): Promise<void>;
  getSecret(key: string): Promise<string | null>;
  removeSecret(key: string): Promise<void>;
}

export interface ProviderRuntimeService {
  testConnection(provider: ProviderConfig): Promise<ConnectionTestResult>;
  generate(
    request: ProviderRuntimeRequest,
    onEvent: (event: GenerationStreamEvent) => void,
  ): Promise<void>;
  cancel(taskId: string): Promise<boolean>;
}

export interface PlatformService {
  runtime: RuntimeInfo;
  projects: ProjectRepository;
  contents: ContentRepository;
  knowledge?: KnowledgeRepository | undefined;
  generationJobs: GenerationJobRepository;
  writing: WritingRepository;
  usage: UsageRepository;
  providers: ProviderRepository;
  secureStorage: SecureStorageService;
  providerRuntime: ProviderRuntimeService;
}
