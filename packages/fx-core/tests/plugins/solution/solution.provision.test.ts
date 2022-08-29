// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { it } from "mocha";
import { TeamsAppSolution } from " ../../../src/plugins/solution";
import { PagedAsyncIterableIterator } from "@azure/core-paging";
import {
  ConfigFolderName,
  FxError,
  ok,
  PluginContext,
  Result,
  SolutionContext,
  Void,
  Plugin,
  AzureAccountProvider,
  SubscriptionInfo,
  IProgressHandler,
  Platform,
  UserInteraction,
  SingleSelectConfig,
  SingleSelectResult,
  MultiSelectConfig,
  MultiSelectResult,
  InputTextConfig,
  InputTextResult,
  SelectFileConfig,
  SelectFileResult,
  SelectFilesResult,
  SelectFilesConfig,
  SelectFolderResult,
  SelectFolderConfig,
  Colors,
  RunnableTask,
  TaskConfig,
  TeamsAppManifest,
  UserError,
  ProjectSettings,
  Inputs,
  TokenProvider,
  v2,
  v3,
  Ok,
  Err,
  AppPackageFolderName,
  err,
} from "@microsoft/teamsfx-api";
import * as sinon from "sinon";
import fs, { PathLike } from "fs-extra";
import {
  DEFAULT_PERMISSION_REQUEST,
  GLOBAL_CONFIG,
  REMOTE_AAD_ID,
  REMOTE_TEAMS_APP_ID,
  SolutionError,
  SOLUTION_PROVISION_SUCCEEDED,
  WEB_APPLICATION_INFO_SOURCE,
  UnauthorizedToCheckResourceGroupError,
  FailedToCheckResourceGroupExistenceError,
} from "../../../src/plugins/solution/fx-solution/constants";
import {
  FRONTEND_DOMAIN,
  FRONTEND_ENDPOINT,
  REMOTE_MANIFEST,
  MANIFEST_TEMPLATE,
} from "../../../src/plugins/resource/appstudio/constants";
import {
  HostTypeOptionAzure,
  HostTypeOptionSPFx,
} from "../../../src/plugins/solution/fx-solution/question";
import { MockedM365Provider, MockedV2Context, validManifest } from "./util";
import { AppDefinition } from "../../../src/plugins/resource/appstudio/interfaces/appDefinition";
import _ from "lodash";
import { AccessToken, GetTokenOptions, TokenCredential } from "@azure/core-auth";
import { TokenCredentialsBase, UserTokenCredentials } from "@azure/ms-rest-nodeauth";
import {
  ExportTemplateRequest,
  Provider,
  Providers,
  ProvidersGetAtTenantScopeOptionalParams,
  ProvidersGetAtTenantScopeResponse,
  ProvidersListAtTenantScopeOptionalParams,
  ProvidersListOptionalParams,
  ProvidersProviderPermissionsOptionalParams,
  ProvidersProviderPermissionsResponse,
  ProvidersRegisterAtManagementGroupScopeOptionalParams,
  ProvidersRegisterOptionalParams,
  ProvidersRegisterResponse,
  ProvidersUnregisterOptionalParams,
  ProvidersUnregisterResponse,
  ResourceGroup,
  ResourceGroupPatchable,
  ResourceGroups,
  ResourceGroupsCheckExistenceOptionalParams,
  ResourceGroupsCheckExistenceResponse,
  ResourceGroupsCreateOrUpdateOptionalParams,
  ResourceGroupsCreateOrUpdateResponse,
  ResourceGroupsDeleteOptionalParams,
  ResourceGroupsExportTemplateOptionalParams,
  ResourceGroupsExportTemplateResponse,
  ResourceGroupsGetOptionalParams,
  ResourceGroupsGetResponse,
  ResourceGroupsListOptionalParams,
  ResourceGroupsUpdateOptionalParams,
  ResourceGroupsUpdateResponse,
  ResourceManagementClient,
} from "@azure/arm-resources";
import { AppStudioClient } from "../../../src/plugins/resource/appstudio/appStudio";
import { AppStudioPluginImpl } from "../../../src/plugins/resource/appstudio/plugin";
import * as solutionUtil from "../../../src/plugins/solution/fx-solution/utils/util";
import * as uuid from "uuid";
import { ResourcePluginsV2 } from "../../../src/plugins/solution/fx-solution/ResourcePluginContainer";
import { newEnvInfo } from "../../../src";
import * as tools from "../../../src/common/tools";
import Container from "typedi";
import {
  askResourceGroupInfo,
  checkResourceGroupExistence,
} from "../../../src/plugins/solution/fx-solution/commonQuestions";
import { CoreQuestionNames } from "../../../src/core/question";
import {
  Subscription,
  SubscriptionClient,
  Subscriptions,
  SubscriptionsGetOptionalParams,
  SubscriptionsListLocationsOptionalParams,
  SubscriptionsListOptionalParams,
  Location as Location_2,
  SubscriptionsGetResponse,
} from "@azure/arm-subscriptions";
import * as msRest from "@azure/ms-rest-js";
import { ProvidersGetOptionalParams, ProvidersGetResponse } from "@azure/arm-resources";
import { TeamsAppSolutionV2 } from "../../../src/plugins/solution/fx-solution/v2/solution";
import { LocalCrypto } from "../../../src/core/crypto";
import * as arm from "../../../src/plugins/solution/fx-solution/arm";
import * as armResources from "@azure/arm-resources";
import { aadPlugin, appStudioPlugin, spfxPlugin, fehostPlugin } from "../../constants";
import { AadAppForTeamsPlugin } from "../../../src";
import * as backup from "../../../src/plugins/solution/fx-solution/utils/backupFiles";
import { resourceGroupHelper } from "../../../src/plugins/solution/fx-solution/utils/ResourceGroupHelper";
import * as manifestTemplate from "../../../src/plugins/resource/appstudio/manifestTemplate";
import { SolutionRunningState } from "../../../src/plugins/solution/fx-solution/types";
import { provisionUtils } from "../../../src/component/provisionUtils";
import * as sub from "@azure/arm-subscriptions";
import { PollerLike } from "@azure/core-lro";
import { PollOperationState } from "@azure/core-lro";

chai.use(chaiAsPromised);
const expect = chai.expect;

const aadPluginV2 = Container.get<v2.ResourcePlugin>(ResourcePluginsV2.AadPlugin);
const spfxPluginV2 = Container.get<v2.ResourcePlugin>(ResourcePluginsV2.SpfxPlugin);
const fehostPluginV2 = Container.get<v2.ResourcePlugin>(ResourcePluginsV2.FrontendPlugin);
const appStudioPluginV2 = Container.get<v2.ResourcePlugin>(ResourcePluginsV2.AppStudioPlugin);

class MockUserInteraction implements UserInteraction {
  selectOption(config: SingleSelectConfig): Promise<Result<SingleSelectResult, FxError>> {
    throw new Error("Method not implemented.");
  }
  selectOptions(config: MultiSelectConfig): Promise<Result<MultiSelectResult, FxError>> {
    throw new Error("Method not implemented.");
  }
  inputText(config: InputTextConfig): Promise<Result<InputTextResult, FxError>> {
    throw new Error("Method not implemented.");
  }
  selectFile(config: SelectFileConfig): Promise<Result<SelectFileResult, FxError>> {
    throw new Error("Method not implemented.");
  }
  selectFiles(config: SelectFilesConfig): Promise<Result<SelectFilesResult, FxError>> {
    throw new Error("Method not implemented.");
  }
  selectFolder(config: SelectFolderConfig): Promise<Result<SelectFolderResult, FxError>> {
    throw new Error("Method not implemented.");
  }

  openUrl(link: string): Promise<Result<boolean, FxError>> {
    throw new Error("Method not implemented.");
  }
  async showMessage(
    level: "info" | "warn" | "error",
    message: string,
    modal: boolean,
    ...items: string[]
  ): Promise<Result<string | undefined, FxError>>;

  async showMessage(
    level: "info" | "warn" | "error",
    message: Array<{ content: string; color: Colors }>,
    modal: boolean,
    ...items: string[]
  ): Promise<Result<string | undefined, FxError>>;

  async showMessage(
    level: "info" | "warn" | "error",
    message: string | Array<{ content: string; color: Colors }>,
    modal: boolean,
    ...items: string[]
  ): Promise<Result<string | undefined, FxError>> {
    if (modal === true) {
      return ok("Provision");
    }
    throw new Error("Method not implemented.");
  }
  createProgressBar(title: string, totalSteps: number): IProgressHandler {
    const handler: IProgressHandler = {
      start: async (detail?: string): Promise<void> => {},
      next: async (detail?: string): Promise<void> => {},
      end: async (): Promise<void> => {},
    };
    return handler;
  }
  runWithProgress<T>(
    task: RunnableTask<T>,
    config: TaskConfig,
    ...args: any
  ): Promise<Result<T, FxError>> {
    throw new Error("Method not implemented.");
  }
}

const mockedSubscriptionName = "mocked subscription id";
const mockedSubscriptionId = "mocked subscription id";
const mockedTenantId = "mocked tenant id";

class MyTokenCredential implements TokenCredential {
  async getToken(
    scopes: string | string[],
    options?: GetTokenOptions | undefined
  ): Promise<AccessToken | null> {
    return {
      token: "a.eyJ1c2VySWQiOiJ0ZXN0QHRlc3QuY29tIn0=.c",
      expiresOnTimestamp: 12345,
    };
  }
}

export class MockedAzureTokenProvider implements AzureAccountProvider {
  getIdentityCredentialAsync(showDialog?: boolean): Promise<TokenCredential> {
    return Promise.resolve(new MyTokenCredential());
  }
  signout(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  setStatusChangeCallback(
    statusChange: (
      status: string,
      token?: string,
      accountInfo?: Record<string, unknown>
    ) => Promise<void>
  ): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  setStatusChangeMap(
    name: string,
    statusChange: (
      status: string,
      token?: string,
      accountInfo?: Record<string, unknown>
    ) => Promise<void>,
    immediateCall?: boolean
  ): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  removeStatusChangeMap(name: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  async getJsonObject(showDialog?: boolean): Promise<Record<string, unknown>> {
    return {
      tid: "222",
    };
  }
  async listSubscriptions(): Promise<SubscriptionInfo[]> {
    return [
      {
        subscriptionName: mockedSubscriptionName,
        subscriptionId: mockedSubscriptionId,
        tenantId: mockedTenantId,
      },
    ];
  }
  async setSubscription(subscriptionId: string): Promise<void> {
    return;
  }
  getAccountInfo(): Record<string, string> | undefined {
    return {};
  }
  getSelectedSubscription(): Promise<SubscriptionInfo | undefined> {
    const selectedSub = {
      subscriptionId: "subscriptionId",
      tenantId: "tenantId",
      subscriptionName: "subscriptionName",
    };
    return Promise.resolve(selectedSub);
  }
}

function mockSolutionContext(): SolutionContext {
  return {
    root: ".",
    envInfo: newEnvInfo(),
    ui: new MockUserInteraction(),
    answers: { platform: Platform.VSCode },
    projectSettings: undefined,
    azureAccountProvider: new MockedAzureTokenProvider(),
    m365TokenProvider: new MockedM365Provider(),
    cryptoProvider: new LocalCrypto(""),
  };
}

function mockProvisionThatAlwaysSucceed(plugin: Plugin) {
  plugin.preProvision = async function (_ctx: PluginContext): Promise<Result<any, FxError>> {
    return ok(Void);
  };
  plugin.provision = async function (_ctx: PluginContext): Promise<Result<any, FxError>> {
    return ok(Void);
  };
  plugin.postProvision = async function (_ctx: PluginContext): Promise<Result<any, FxError>> {
    return ok(Void);
  };
}

function mockProvisionV2ThatAlwaysSucceed(plugin: v2.ResourcePlugin) {
  plugin.provisionResource = async function (): Promise<Result<Void, FxError>> {
    return ok(Void);
  };

  plugin.configureResource = async function (): Promise<Result<Void, FxError>> {
    return ok(Void);
  };
}

function mockCtxWithResourceGroupQuestions(createNew: boolean, name: string, newLocation = "") {
  const mockedCtx = mockSolutionContext();
  mockedCtx.ui!.selectOption = async (
    config: SingleSelectConfig
  ): Promise<Result<SingleSelectResult, FxError>> => {
    if (config.name === CoreQuestionNames.TargetResourceGroupName) {
      return ok({ type: "success", result: createNew ? "+ New resource group" : name });
    } else if (config.name === CoreQuestionNames.NewResourceGroupLocation) {
      return ok({ type: "success", result: newLocation });
    } else {
      throw new Error("not implemented");
    }
  };
  mockedCtx.ui!.inputText = async (
    config: InputTextConfig
  ): Promise<Result<InputTextResult, FxError>> => {
    if (config.name === CoreQuestionNames.NewResourceGroupName) {
      return ok({ type: "success", result: name });
    } else {
      throw new Error("not implemented");
    }
  };
  mockedCtx.ui!.createProgressBar = (title: string, totalSteps: number): IProgressHandler => {
    return {
      start: async (detail?: string) => {
        return;
      },
      end: async (success: boolean) => {
        return;
      },
      next: async (detail?: string) => {
        return;
      },
    };
  };
  return mockedCtx;
}

describe("provision() simple cases", () => {
  const mocker = sinon.createSandbox();

  const mockedManifest = _.cloneDeep(validManifest);
  // ignore icons for simplicity
  mockedManifest.icons.color = "";
  mockedManifest.icons.outline = "";

  const mockedAppDef: AppDefinition = {
    appName: "MyApp",
    teamsAppId: "qwertasdf",
  };

  afterEach(() => {
    mocker.restore();
  });
  it("should return error if solution state is not idle", async () => {
    const solution = new TeamsAppSolution();
    expect(solution.runningState).equal(SolutionRunningState.Idle);

    const mockedCtx = mockSolutionContext();
    solution.runningState = SolutionRunningState.ProvisionInProgress;
    let result = await solution.provision(mockedCtx);
    expect(result.isErr()).to.be.true;
    expect(result._unsafeUnwrapErr().name).equals(SolutionError.ProvisionInProgress);

    solution.runningState = SolutionRunningState.DeployInProgress;
    result = await solution.provision(mockedCtx);
    expect(result.isErr()).to.be.true;
    expect(result._unsafeUnwrapErr().name).equals(SolutionError.DeploymentInProgress);

    solution.runningState = SolutionRunningState.PublishInProgress;
    result = await solution.provision(mockedCtx);
    expect(result.isErr()).to.be.true;
    expect(result._unsafeUnwrapErr().name).equals(SolutionError.PublishInProgress);
  });

  it("should return error if manifest file is not found", async () => {
    const solution = new TeamsAppSolution();
    const mockedCtx = mockSolutionContext();
    mockedCtx.projectSettings = {
      appName: "my app",
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionSPFx.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [fehostPlugin.name],
      },
    };
    // We leverage the fact that in testing env, this is not file at `${ctx.root}/.${ConfigFolderName}/${REMOTE_MANIFEST}`
    // So we even don't need to mock fs.readJson
    const result = await solution.provision(mockedCtx);
    expect(result.isErr()).to.be.true;
  });

  it("should return false even if provisionSucceeded is true", async () => {
    const solution = new TeamsAppSolution();
    const mockedCtx = mockSolutionContext();
    mockedCtx.envInfo.state.get(GLOBAL_CONFIG)?.set(SOLUTION_PROVISION_SUCCEEDED, true);
    const result = await solution.provision(mockedCtx);
    expect(result.isOk()).to.be.false;
  });
});

describe("provision() with permission.json file missing", () => {
  const mocker = sinon.createSandbox();
  const permissionsJsonPath = "./permissions.json";

  const fileContent: Map<string, any> = new Map();
  beforeEach(() => {
    mocker.stub(fs, "writeFile").callsFake((path: number | PathLike, data: any) => {
      fileContent.set(path.toString(), data);
    });
    mocker.stub(fs, "writeJSON").callsFake((file: string, obj: any) => {
      fileContent.set(file, JSON.stringify(obj));
    });
    mocker.stub<any, any>(fs, "pathExists").withArgs(permissionsJsonPath).resolves(false);
    mocker.stub(tools, "getSPFxTenant").returns(Promise.resolve("tenant"));
  });

  afterEach(() => {
    mocker.restore();
  });

  it("should return error for Azure projects", async () => {
    const solution = new TeamsAppSolution();
    const mockedCtx = mockSolutionContext();
    mockedCtx.projectSettings = {
      appName: "my app",
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionAzure.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [fehostPlugin.name, aadPlugin.name],
      },
    };
    const result = await solution.provision(mockedCtx);
    expect(result.isErr()).to.be.true;
    expect(result._unsafeUnwrapErr().name).equals(SolutionError.MissingPermissionsJson);
  });

  it("should work for SPFx projects on happy path", async () => {
    const solution = new TeamsAppSolution();
    const mockedCtx = mockSolutionContext();
    mockedCtx.projectSettings = {
      appName: "my app",
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionSPFx.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [spfxPlugin.name],
      },
    };
    solution.doProvision = async function (_ctx: SolutionContext): Promise<Result<any, FxError>> {
      return ok(Void);
    };

    const result = await solution.provision(mockedCtx);
    expect(result.isOk()).to.be.true;
  });
});

describe("provision() happy path for SPFx projects", () => {
  const mocker = sinon.createSandbox();
  const fileContent: Map<string, any> = new Map();
  const mockedAppDef: AppDefinition = {
    appName: "MyApp",
    teamsAppId: "qwertasdf",
  };
  const mockedManifest = _.cloneDeep(validManifest);

  beforeEach(() => {
    mocker.stub(fs, "writeFile").callsFake((path: number | PathLike, data: any) => {
      fileContent.set(path.toString(), data);
    });
    mocker.stub(fs, "chmod").callsFake((path: PathLike, mode: fs.Mode) => {
      return new Promise((resolve) => resolve());
    });
    mocker.stub(fs, "writeJSON").callsFake((file: string, obj: any) => {
      fileContent.set(file, JSON.stringify(obj));
    });
    mocker.stub(fs, "readFile").resolves(Buffer.from(""));
    mocker
      .stub<any, any>(fs, "readJson")
      .withArgs(
        `./tests/plugins/resource/appstudio/spfx-resources/${AppPackageFolderName}/${MANIFEST_TEMPLATE}`
      )
      .resolves(mockedManifest);
    mocker.stub(AppStudioClient, "importApp").resolves(mockedAppDef);
    mocker.stub(manifestTemplate, "loadManifest").resolves(ok(new TeamsAppManifest()));
    mocker.stub(AppStudioPluginImpl.prototype, "buildTeamsAppPackage").resolves("");
    mocker.stub(tools, "getSPFxTenant").returns(Promise.resolve("tenant"));
  });

  afterEach(() => {
    mocker.restore();
  });

  it("should succeed if insider feature flag enabled", async () => {
    const solution = new TeamsAppSolution();
    const mockedCtx = mockSolutionContext();
    mockedCtx.root = "./tests/plugins/resource/appstudio/spfx-resources";
    mockedCtx.projectSettings = {
      appName: "my app",
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionSPFx.id,
        name: "SPFx",
        version: "1.0",
        activeResourcePlugins: [spfxPlugin.name, appStudioPlugin.name],
      },
    };

    expect(mockedCtx.envInfo.state.get(GLOBAL_CONFIG)?.get(SOLUTION_PROVISION_SUCCEEDED)).to.be
      .undefined;
    expect(mockedCtx.envInfo.state.get(GLOBAL_CONFIG)?.get(REMOTE_TEAMS_APP_ID)).to.be.undefined;
    const result = await solution.provision(mockedCtx);
    expect(result.isOk()).to.be.true;
    expect(mockedCtx.envInfo.state.get(GLOBAL_CONFIG)?.get(SOLUTION_PROVISION_SUCCEEDED)).to.be
      .true;

    expect(mockedCtx.envInfo.state.get("fx-resource-appstudio")?.get("teamsAppId")).equals(
      mockedAppDef.teamsAppId
    );
    expect(solution.runningState).equals(SolutionRunningState.Idle);
  });
});

function mockAzureProjectDeps(
  mocker: sinon.SinonSandbox,
  permissionsJsonPath: string,
  mockedManifest: typeof validManifest,
  mockedAppDef: AppDefinition
) {
  mocker.stub<any, any>(fs, "pathExists").withArgs(permissionsJsonPath).resolves(true);
  mocker
    .stub<any, any>(fs, "readJSON")
    .withArgs(permissionsJsonPath)
    .resolves(DEFAULT_PERMISSION_REQUEST);
  mocker
    .stub<any, any>(fs, "readJson")
    .withArgs(`./.${ConfigFolderName}/${REMOTE_MANIFEST}`)
    .resolves(mockedManifest);
  mocker.stub(AppStudioClient, "importApp").resolves(mockedAppDef);
  mocker.stub(solutionUtil, "getSubsriptionDisplayName").resolves(mockedSubscriptionName);
}

const mockResourceGroups1 = {
  checkExistence: async function (
    resourceGroupName: string,
    options?: ResourceGroupsCheckExistenceOptionalParams
  ): Promise<ResourceGroupsCheckExistenceResponse> {
    return {
      body: false,
    };
  },
  createOrUpdate: async function (
    resourceGroupName: string,
    parameters: ResourceGroup,
    options?: ResourceGroupsCreateOrUpdateOptionalParams
  ): Promise<ResourceGroupsCreateOrUpdateResponse> {
    return {
      name: "my_app-rg",
      location: "location",
    };
  },
};

describe("Resource group creation failed for provision() in Azure projects", () => {
  const mocker = sinon.createSandbox();
  const permissionsJsonPath = "./permissions.json";
  const mockedAppDef: AppDefinition = {
    appName: "MyApp",
    teamsAppId: "qwertasdf",
  };
  const mockedManifest = _.cloneDeep(validManifest);
  // ignore icons for simplicity
  mockedManifest.icons.color = "";
  mockedManifest.icons.outline = "";
  before(() => {
    const mockResourceManagementClient = new ResourceManagementClient(
      new MyTokenCredential(),
      "id"
    );
    mockResourceManagementClient.resourceGroups = mockResourceGroups1 as any;
    mocker.stub(armResources, "ResourceManagementClient").returns(mockResourceManagementClient);
  });

  beforeEach(() => {
    mockAzureProjectDeps(mocker, permissionsJsonPath, mockedManifest, mockedAppDef);
  });

  afterEach(() => {
    mocker.restore();
  });

  it("should return UserError if createOrUpdate throws", async () => {
    const solution = new TeamsAppSolution();
    const mockedCtx = mockSolutionContext();
    mockedCtx.projectSettings = {
      appName: "my app",
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionAzure.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [fehostPlugin.name, aadPlugin.name, appStudioPlugin.name],
      },
    };

    mockedCtx!.answers!.targetResourceGroupName = "test-new-rg";
    const result = await solution.provision(mockedCtx);
    expect(result.isErr()).to.be.true;
    expect(result._unsafeUnwrapErr() instanceof UserError).to.be.true;
    expect(result._unsafeUnwrapErr().name).equals(SolutionError.ResourceGroupNotFound);
    expect(result._unsafeUnwrapErr().message).contains(
      "please specify an existing resource group."
    );
  });
});

const mockResourceGroups2 = {
  createOrUpdate: async function (
    resourceGroupName: string,
    parameters: ResourceGroup,
    options?: ResourceGroupsCreateOrUpdateOptionalParams
  ): Promise<ResourceGroupsCreateOrUpdateResponse> {
    return {
      name: "test-rg",
      location: "location",
    };
  },
  get: async function (
    resourceGroupName: string,
    options?: ResourceGroupsGetOptionalParams
  ): Promise<ResourceGroupsGetResponse> {
    return { name: "my_app-rg", location: "West US" };
  },
};

describe("provision() happy path for Azure projects", () => {
  const mocker = sinon.createSandbox();
  const permissionsJsonPath = "./permissions.json";
  const resourceGroupName = "test-rg";

  const mockedAppDef: AppDefinition = {
    appName: "MyApp",
    teamsAppId: "qwertasdf",
  };
  const mockedManifest = _.cloneDeep(validManifest);
  // ignore icons for simplicity
  mockedManifest.icons.color = "";
  mockedManifest.icons.outline = "";
  before(() => {
    const mockResourceManagementClient = new ResourceManagementClient(
      new MyTokenCredential(),
      "id"
    );
    mockResourceManagementClient.resourceGroups = mockResourceGroups2 as any;
    mocker.stub(armResources, "ResourceManagementClient").returns(mockResourceManagementClient);
  });
  beforeEach(() => {
    mockAzureProjectDeps(mocker, permissionsJsonPath, mockedManifest, mockedAppDef);
    mocker.stub(tools, "getSPFxTenant").returns(Promise.resolve("tenant"));
  });

  afterEach(() => {
    mocker.restore();
  });

  it("should succeed if app studio returns successfully", async () => {
    const solution = new TeamsAppSolution();
    // const mockedCtx = mockSolutionContext();
    const mockNewResourceGroupName = "test-new-rg";
    const mockNewResourceGroupLocation = "West US";
    const mockedCtx = mockCtxWithResourceGroupQuestions(
      true,
      mockNewResourceGroupName,
      mockNewResourceGroupLocation
    );
    mockedCtx!.answers!.targetResourceGroupName = "test-new-rg";
    mockedCtx.projectSettings = {
      appName: "my app",
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionAzure.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [fehostPlugin.name, aadPlugin.name, appStudioPlugin.name],
      },
    };

    mockProvisionThatAlwaysSucceed(fehostPlugin);
    fehostPlugin.provision = async function (ctx: PluginContext): Promise<Result<any, FxError>> {
      ctx.config.set(FRONTEND_ENDPOINT, "http://example.com");
      ctx.config.set(FRONTEND_DOMAIN, "http://example.com");
      return ok(Void);
    };

    mockProvisionThatAlwaysSucceed(aadPlugin);
    aadPlugin.postProvision = async function (ctx: PluginContext): Promise<Result<any, FxError>> {
      ctx.config.set(REMOTE_AAD_ID, "mockedRemoteAadId");
      return ok(Void);
    };

    mockProvisionThatAlwaysSucceed(appStudioPlugin);
    appStudioPlugin.postProvision = async function (
      ctx: PluginContext
    ): Promise<Result<any, FxError>> {
      return ok(mockedAppDef.teamsAppId);
    };

    (aadPlugin as AadAppForTeamsPlugin).setApplicationInContext = function (
      ctx: PluginContext,
      _isLocalDebug?: boolean
    ): Result<any, FxError> {
      ctx.config.set(WEB_APPLICATION_INFO_SOURCE, "mockedWebApplicationInfoResouce");
      return ok(Void);
    };
    const spy = mocker.spy(aadPlugin as AadAppForTeamsPlugin, "setApplicationInContext");
    const stub = mocker.stub(arm, "deployArmTemplates");

    expect(mockedCtx.envInfo.state.get(GLOBAL_CONFIG)?.get(SOLUTION_PROVISION_SUCCEEDED)).to.be
      .undefined;
    expect(mockedCtx.envInfo.state.get(GLOBAL_CONFIG)?.get(REMOTE_TEAMS_APP_ID)).to.be.undefined;
    // mockedCtx.envInfo.state.get(GLOBAL_CONFIG)?.set("resourceGroupName", resourceGroupName);
    mockedCtx.envInfo.state.get(GLOBAL_CONFIG)?.set("subscriptionId", mockedSubscriptionId);
    mockedCtx.envInfo.state.get(GLOBAL_CONFIG)?.set("tenantId", mockedTenantId);
    mocker.stub(AppStudioPluginImpl.prototype, "getConfigForCreatingManifest" as any).returns(
      ok({
        tabEndpoint: "tabEndpoint",
        tabDomain: "tabDomain",
        aadId: uuid.v4(),
        botDomain: "botDomain",
        botId: uuid.v4(),
        webApplicationInfoResource: "webApplicationInfoResource",
      })
    );
    const result = await solution.provision(mockedCtx);
    expect(stub.called).to.be.true;
  });
});

function getMockResourceGroups(subscriptionId: string, resourceGroups: string[]) {
  return {
    list: function (
      options?: ResourceGroupsListOptionalParams
    ): PagedAsyncIterableIterator<ResourceGroup> {
      return {
        next() {
          throw new Error("Function not implemented.");
        },
        [Symbol.asyncIterator]() {
          throw new Error("Function not implemented.");
        },
        byPage: () => {
          return generator() as any;
        },
      };

      function* generator() {
        yield resourceGroups.map((name) => {
          return {
            id: `/subscriptions/${subscriptionId}/resourceGroups/${name}`,
            name: name,
            location: "East US",
            type: "Microsoft.Resources/resourceGroups",
            properties: {
              provisioningState: "Succeeded",
            },
          };
        });
      }
    },
    createOrUpdate: async function (
      resourceGroupName: string,
      parameters: ResourceGroup,
      options?: ResourceGroupsCreateOrUpdateOptionalParams
    ): Promise<ResourceGroupsCreateOrUpdateResponse> {
      return {
        name: "test-rg",
        location: "location",
      };
    },
    get: async function (
      resourceGroupName: string,
      options?: ResourceGroupsGetOptionalParams
    ): Promise<ResourceGroupsGetResponse> {
      return { name: "my_app-rg", location: "West US" };
    },
  };
}

const mockSubscriptions: Subscriptions = {
  listLocations: function (
    subscriptionId: string,
    options?: SubscriptionsListLocationsOptionalParams
  ): PagedAsyncIterableIterator<Location_2> {
    return {
      next() {
        throw new Error("Function not implemented.");
      },
      [Symbol.asyncIterator]() {
        throw new Error("Function not implemented.");
      },
      byPage: () => {
        return generator() as any;
      },
    };

    function* generator() {
      yield [
        {
          id: "location",
          subscriptionId: "3b8db46f-4298-458a-ac36-e04e7e66b68f",
          name: "location",
          displayName: "location",
        },
      ];
    }
  },
  list: function (
    options?: SubscriptionsListOptionalParams
  ): PagedAsyncIterableIterator<Subscription> {
    throw new Error("Function not implemented.");
  },
  get: function (
    subscriptionId: string,
    options?: SubscriptionsGetOptionalParams
  ): Promise<SubscriptionsGetResponse> {
    throw new Error("Function not implemented.");
  },
};

const mockProviders = {
  list: function (options?: ProvidersListOptionalParams): PagedAsyncIterableIterator<Provider> {
    return {
      next() {
        throw new Error("Function not implemented.");
      },
      [Symbol.asyncIterator]() {
        throw new Error("Function not implemented.");
      },
      byPage: () => {
        return generator() as any;
      },
    };

    function* generator() {
      yield [
        {
          id: "location",
          resourceTypes: [
            {
              resourceType: "resourceGroups",
              locations: ["location"],
            },
          ],
        },
      ];
    }
  },
  get: async function (
    resourceProviderNamespace: string,
    options?: ProvidersGetOptionalParams
  ): Promise<ProvidersGetResponse> {
    return {
      id: "location",
      resourceTypes: [
        {
          resourceType: "resourceGroups",
          locations: ["location"],
        },
      ],
    };
  },
};

describe("before provision() asking for resource group info", () => {
  const mocker = sinon.createSandbox();
  const resourceGroupsCreated = new Map<string, string>();

  before(() => {
    const mockSubscriptionClient = new SubscriptionClient(new MyTokenCredential());
    mockSubscriptionClient.subscriptions = mockSubscriptions;
    sinon.stub(sub, "SubscriptionClient").returns(mockSubscriptionClient);
  });
  beforeEach(() => {
    mocker.stub(solutionUtil, "getSubsriptionDisplayName").resolves(mockedSubscriptionName);
    mocker.stub(process, "env").get(() => {
      return { __TEAMSFX_INSIDER_PREVIEW: "true" };
    });
  });

  afterEach(() => {
    mocker.restore();
  });

  it("should create new resource group happy path", async () => {
    // Arrange
    const fakeSubscriptionId = "3b8db46f-4298-458a-ac36-e04e7e66b68f";
    const mockNewResourceGroupName = "test-new-rg";
    const mockNewResourceGroupLocation = "West US";
    const appName = "testapp";

    const mockedCtx = mockCtxWithResourceGroupQuestions(
      true,
      mockNewResourceGroupName,
      mockNewResourceGroupLocation
    );
    const mockResourceManagementClient = new ResourceManagementClient(
      new MyTokenCredential(),
      "id"
    );
    mockResourceManagementClient.resourceGroups = getMockResourceGroups(
      fakeSubscriptionId,
      []
    ) as any;
    mockResourceManagementClient.providers = mockProviders as any;
    mocker.stub(armResources, "ResourceManagementClient").returns(mockResourceManagementClient);
    mockedCtx.projectSettings = {
      appName: "my app",
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionAzure.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [],
      },
    };

    const token = await mockedCtx.azureAccountProvider?.getIdentityCredentialAsync();
    expect(token).to.exist;
    const mockRmClient = new ResourceManagementClient(token!, fakeSubscriptionId);

    // Act
    const resourceGroupInfoResult = await askResourceGroupInfo(
      mockedCtx,
      mockedCtx.azureAccountProvider!,
      mockRmClient,
      mockedCtx.answers!,
      mockedCtx.ui!,
      appName
    );

    // Assume
    expect(resourceGroupInfoResult.isOk()).to.be.true;

    const resourceGroupInfo = resourceGroupInfoResult._unsafeUnwrap();

    expect(resourceGroupInfo.createNewResourceGroup).to.be.true;
    expect(resourceGroupInfo.name).to.equal(mockNewResourceGroupName);
    expect(resourceGroupInfo.createNewResourceGroup && resourceGroupInfo.location).to.equal(
      mockNewResourceGroupLocation
    );
  });

  it("should use existing resource group happy path", async () => {
    // Arrange
    const fakeSubscriptionId = "3b8db46f-4298-458a-ac36-e04e7e66b68f";
    const mockResourceGroupName = "test-existing-rg";
    const mockResourceGroupList = ["test1", "test-existing-rg", "test2"];
    const appName = "testapp";

    const mockedCtx = mockCtxWithResourceGroupQuestions(false, mockResourceGroupName);
    const mockResourceManagementClient = new ResourceManagementClient(
      new MyTokenCredential(),
      "id"
    );
    mockResourceManagementClient.resourceGroups = getMockResourceGroups(
      fakeSubscriptionId,
      mockResourceGroupList
    ) as any;
    mockResourceManagementClient.providers = mockProviders as any;
    mocker.stub(armResources, "ResourceManagementClient").returns(mockResourceManagementClient);

    mockedCtx.projectSettings = {
      appName: "my app",
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionAzure.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [],
      },
    };

    const token = await mockedCtx.azureAccountProvider?.getIdentityCredentialAsync();
    expect(token).to.exist;
    const mockRmClient = new ResourceManagementClient(token!, fakeSubscriptionId);

    // Act
    const resourceGroupInfoResult = await askResourceGroupInfo(
      mockedCtx,
      mockedCtx.azureAccountProvider!,
      mockRmClient,
      mockedCtx.answers!,
      mockedCtx.ui!,
      appName
    );

    // Assume
    expect(resourceGroupInfoResult.isOk()).to.be.true;

    const resourceGroupInfo = resourceGroupInfoResult._unsafeUnwrap();

    expect(resourceGroupInfo.createNewResourceGroup).to.be.false;
    expect(resourceGroupInfo.name).to.equal(mockResourceGroupName);
  });

  it("should return correct error on failure when listing resource groups", async () => {
    // Arrange
    const fakeSubscriptionId = "3b8db46f-4298-458a-ac36-e04e7e66b68f";
    const mockResourceGroupName = "test-existing-rg";
    const appName = "testapp";

    const mockedCtx = mockCtxWithResourceGroupQuestions(false, mockResourceGroupName);

    const mockResourceManagementClient = new ResourceManagementClient(
      new MyTokenCredential(),
      "id"
    );
    mockResourceManagementClient.resourceGroups = mockResourceGroups1 as any;
    mocker.stub(armResources, "ResourceManagementClient").returns(mockResourceManagementClient);

    mockedCtx.projectSettings = {
      appName: "my app",
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionAzure.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [],
      },
    };

    const token = await mockedCtx.azureAccountProvider?.getIdentityCredentialAsync();
    expect(token).to.exist;
    const mockRmClient = new ResourceManagementClient(token!, fakeSubscriptionId);

    // Act
    const resourceGroupInfoResult = await askResourceGroupInfo(
      mockedCtx,
      mockedCtx.azureAccountProvider!,
      mockRmClient,
      mockedCtx.answers!,
      mockedCtx.ui!,
      appName
    );

    // Assume
    expect(resourceGroupInfoResult.isErr()).to.be.true;
    expect(resourceGroupInfoResult._unsafeUnwrapErr().name).to.equal(
      SolutionError.FailedToListResourceGroup
    );
  });

  describe("checkResourceGroupExistence", () => {
    const mockSubscriptionId = "3b8db46f-4298-458a-ac36-e04e7e66b68f";
    const mockSubscriptionName = "Test Subscription";
    const mockResourceGroupName = "mock-rg";
    let upstreamResult: Result<boolean, Error> = new Ok<boolean, Error>(true);
    let mockRmClient: ResourceManagementClient;

    function getMockResourceGroupsByUpstreamResult(upstreamResult: Result<boolean, Error>) {
      return {
        checkExistence: async function (
          resourceGroupName: string,
          options?: ResourceGroupsCheckExistenceOptionalParams
        ): Promise<ResourceGroupsCheckExistenceResponse> {
          if (upstreamResult.isOk()) {
            return {
              body: upstreamResult.value,
            } as armResources.ResourceGroupsCheckExistenceResponse;
          } else {
            throw upstreamResult.error;
          }
        },
        get: async function (
          resourceGroupName: string,
          options?: ResourceGroupsGetOptionalParams
        ): Promise<ResourceGroupsGetResponse> {
          return { name: "my_app-rg", location: "West US" };
        },
      };
    }
    beforeEach(async () => {
      const mockedCtx = mockCtxWithResourceGroupQuestions(false, mockResourceGroupName);
      const mockResourceManagementClient = new ResourceManagementClient(
        new MyTokenCredential(),
        "id"
      );
      mockResourceManagementClient.resourceGroups = getMockResourceGroupsByUpstreamResult(
        upstreamResult
      ) as any;
      mocker.stub(armResources, "ResourceManagementClient").returns(mockResourceManagementClient);
      mockedCtx.projectSettings = {
        appName: "my app",
        projectId: uuid.v4(),
        solutionSettings: {
          hostType: HostTypeOptionAzure.id,
          name: "azure",
          version: "1.0",
          activeResourcePlugins: [],
        },
      };
      const token = await mockedCtx.azureAccountProvider?.getIdentityCredentialAsync();
      expect(token).to.exist;
      mockRmClient = new ResourceManagementClient(token!, mockSubscriptionId);
    });

    it("Exists", async () => {
      // Arrange
      upstreamResult = new Ok<boolean, Error>(true);
      // Act
      const result = await checkResourceGroupExistence(
        mockRmClient,
        mockResourceGroupName,
        mockSubscriptionId,
        mockSubscriptionName
      );
      // Assert
      expect(result.isOk());
      expect(result._unsafeUnwrap()).to.be.true;
    });

    it("Not exist", async () => {
      // Arrange
      upstreamResult = new Ok<boolean, Error>(false);
      // Act
      const result = await checkResourceGroupExistence(
        mockRmClient,
        mockResourceGroupName,
        mockSubscriptionId,
        mockSubscriptionName
      );
      // Assert
      expect(result.isOk());
      expect(result._unsafeUnwrap()).to.be.false;
    });

    it("Unauthorized", async () => {
      // Arrange
      upstreamResult = new Err<boolean, Error>(
        new msRest.RestError("Unauthorized", "RestError", 403)
      );
      // Act
      const result = await checkResourceGroupExistence(
        mockRmClient,
        mockResourceGroupName,
        mockSubscriptionId,
        mockSubscriptionName
      );
      // Assert
      expect(result.isErr());
      expect(result._unsafeUnwrapErr()).instanceOf(UnauthorizedToCheckResourceGroupError);
    });

    it("Network error", async () => {
      // Arrange
      upstreamResult = new Err<boolean, Error>(new Error("MockNetworkError"));
      // Act
      const result = await checkResourceGroupExistence(
        mockRmClient,
        mockResourceGroupName,
        mockSubscriptionId,
        mockSubscriptionName
      );
      // Assert
      expect(result.isErr());
      expect(result._unsafeUnwrapErr()).instanceOf(FailedToCheckResourceGroupExistenceError);
      expect(result._unsafeUnwrapErr().message).to.contain("MockNetworkError");
    });

    it("Non-Error thrown", async () => {
      // Arrange
      upstreamResult = new Err<boolean, Error>("UnexpectedUnknownError" as unknown as Error);
      // Act
      const result = await checkResourceGroupExistence(
        mockRmClient,
        mockResourceGroupName,
        mockSubscriptionId,
        mockSubscriptionName
      );
      // Assert
      expect(result.isErr());
      expect(result._unsafeUnwrapErr()).instanceOf(FailedToCheckResourceGroupExistenceError);
      expect(result._unsafeUnwrapErr().message).to.contain("UnexpectedUnknownError");
    });
  });
});

describe("API v2 implementation", () => {
  describe("SPFx projects", () => {
    const mocker = sinon.createSandbox();

    afterEach(() => {
      mocker.restore();
    });
    it("should work on happy path", async () => {
      const projectSettings: ProjectSettings = {
        appName: "my app",
        projectId: uuid.v4(),
        solutionSettings: {
          hostType: HostTypeOptionSPFx.id,
          name: "azure",
          version: "1.0",
          activeResourcePlugins: [spfxPluginV2.name],
        },
      };
      const mockedCtx = new MockedV2Context(projectSettings);
      const mockedInputs: Inputs = {
        platform: Platform.VSCode,
        projectPath: "./",
      };
      const mockedTokenProvider: TokenProvider = {
        azureAccountProvider: new MockedAzureTokenProvider(),
        m365TokenProvider: new MockedM365Provider(),
      };
      const mockedEnvInfo: v2.EnvInfoV2 = {
        envName: "default",
        config: { manifest: { appName: { short: "test-app" } } },
        state: {},
      };
      mockProvisionV2ThatAlwaysSucceed(spfxPluginV2);
      mockProvisionV2ThatAlwaysSucceed(appStudioPluginV2);

      const solution = new TeamsAppSolutionV2();
      const result = await solution.provisionResources(
        mockedCtx,
        mockedInputs,
        mockedEnvInfo,
        mockedTokenProvider
      );
      expect(result.isOk()).equals(true);
      expect(mockedEnvInfo.state.solution.teamsAppTenantId === "tenantId");
      expect(mockedEnvInfo.state["fx-resource-appstudio"].tenantId === "tenantId");
      expect(mockedEnvInfo.state.solution.provisionSucceeded === true);
    });

    it("provision after switch Microsoft 365 account", async () => {
      const projectSettings: ProjectSettings = {
        appName: "my app",
        projectId: uuid.v4(),
        solutionSettings: {
          hostType: HostTypeOptionSPFx.id,
          name: "azure",
          version: "1.0",
          activeResourcePlugins: [spfxPluginV2.name],
        },
      };
      const mockedCtx = new MockedV2Context(projectSettings);
      mockedCtx.userInteraction = new MockUserInteraction();
      const mockedInputs: Inputs = {
        platform: Platform.VSCode,
        projectPath: "./",
      };
      const mockedTokenProvider: TokenProvider = {
        azureAccountProvider: new MockedAzureTokenProvider(),
        m365TokenProvider: new MockedM365Provider(),
      };
      const mockedEnvInfo: v2.EnvInfoV2 = {
        envName: "default",
        config: { manifest: { appName: { short: "test-app" } } },
        state: {
          "fx-resource-appstudio": { tenantId: "previousTenantId" },
          solution: { teamsAppTenantId: "previousTenantId", provisionSucceeded: true },
          "fx-resource-spfx": {},
        },
      };
      mockProvisionV2ThatAlwaysSucceed(spfxPluginV2);
      mockProvisionV2ThatAlwaysSucceed(appStudioPluginV2);
      mocker.stub(backup, "backupFiles").resolves(ok(undefined));
      mocker.stub(arm, "updateAzureParameters").resolves(ok(undefined));

      const solution = new TeamsAppSolutionV2();
      const result = await solution.provisionResources(
        mockedCtx,
        mockedInputs,
        mockedEnvInfo,
        mockedTokenProvider
      );

      expect(result.isOk()).equals(true);
      expect(mockedEnvInfo.state.solution.teamsAppTenantId).equals("tenantId");
      expect(mockedEnvInfo.state["fx-resource-appstudio"].tenantId).equals("tenantId");
      expect(mockedEnvInfo.state.solution.provisionSucceeded).equals(true);
    });

    it("provision after switch Microsoft 365 account error when backup", async () => {
      const projectSettings: ProjectSettings = {
        appName: "my app",
        projectId: uuid.v4(),
        solutionSettings: {
          hostType: HostTypeOptionSPFx.id,
          name: "azure",
          version: "1.0",
          activeResourcePlugins: [spfxPluginV2.name],
        },
      };
      const mockedCtx = new MockedV2Context(projectSettings);
      mockedCtx.userInteraction = new MockUserInteraction();
      const mockedInputs: Inputs = {
        platform: Platform.VSCode,
        projectPath: "./",
      };
      const mockedTokenProvider: TokenProvider = {
        azureAccountProvider: new MockedAzureTokenProvider(),
        m365TokenProvider: new MockedM365Provider(),
      };
      const mockedEnvInfo: v2.EnvInfoV2 = {
        envName: "default",
        config: { manifest: { appName: { short: "test-app" } } },
        state: {
          "fx-resource-appstudio": { tenantId: "previousTenantId" },
          solution: { teamsAppTenantId: "previousTenantId", provisionSucceeded: true },
          "fx-resource-spfx": {},
        },
      };
      mockProvisionV2ThatAlwaysSucceed(spfxPluginV2);
      mockProvisionV2ThatAlwaysSucceed(appStudioPluginV2);
      mocker
        .stub(backup, "backupFiles")
        .resolves(err(new UserError("solution", "error1", "error1")));

      const solution = new TeamsAppSolutionV2();
      const result = await solution.provisionResources(
        mockedCtx,
        mockedInputs,
        mockedEnvInfo,
        mockedTokenProvider
      );

      expect(result.isErr()).equals(true);
      if (result.isErr()) {
        expect(result.error.name).equal("error1");
      }
    });
  });

  describe("Azure projects", () => {
    const mocker = sinon.createSandbox();

    before(() => {
      const mockResourceManagementClient = new ResourceManagementClient(
        new MyTokenCredential(),
        "id"
      );
      mockResourceManagementClient.resourceGroups = mockResourceGroups1 as any;
      mocker.stub(armResources, "ResourceManagementClient").returns(mockResourceManagementClient);
    });
    beforeEach(() => {
      mocker
        .stub<any, any>(resourceGroupHelper, "askResourceGroupInfo")
        .callsFake(
          async (
            ctx: v2.Context,
            inputs: Inputs,
            azureAccountProvider: AzureAccountProvider,
            rmClient: ResourceManagementClient,
            defaultResourceGroupName: string
          ): Promise<Result<any, FxError>> => {
            return ok({
              createNewResourceGroup: false,
              name: "mockRG",
              location: "mockLoc",
            });
          }
        );
    });
    afterEach(() => {
      mocker.restore();
    });

    it("should work on happy path", async () => {
      const projectSettings: ProjectSettings = {
        appName: "my app",
        projectId: uuid.v4(),
        solutionSettings: {
          hostType: HostTypeOptionAzure.id,
          name: "azure",
          version: "1.0",
          activeResourcePlugins: [fehostPluginV2.name, appStudioPluginV2.name, aadPluginV2.name],
        },
      };
      const mockedCtx = new MockedV2Context(projectSettings);
      mockedCtx.userInteraction = new MockUserInteraction();
      const mockedInputs: Inputs = {
        platform: Platform.VSCode,
        projectPath: "./",
        isForUT: true,
      };
      const mockedTokenProvider: TokenProvider = {
        azureAccountProvider: new MockedAzureTokenProvider(),
        m365TokenProvider: new MockedM365Provider(),
      };
      const mockedEnvInfo: v2.EnvInfoV2 = {
        envName: "default",
        config: { manifest: { appName: { short: "test-app" } } },
        state: {},
      };
      mockProvisionV2ThatAlwaysSucceed(fehostPluginV2);
      mockProvisionV2ThatAlwaysSucceed(appStudioPluginV2);
      mockProvisionV2ThatAlwaysSucceed(aadPluginV2);

      const solution = new TeamsAppSolutionV2();
      const result = await solution.provisionResources(
        mockedCtx,
        mockedInputs,
        mockedEnvInfo,
        mockedTokenProvider
      );
      expect(result.isOk()).equals(true);
    });

    it("should not call arm deployment when there is no Azure resource to provision", async () => {
      const projectSettings: ProjectSettings = {
        appName: "my app",
        projectId: uuid.v4(),
        solutionSettings: {
          hostType: HostTypeOptionAzure.id,
          name: "azure",
          version: "1.0",
          activeResourcePlugins: [appStudioPluginV2.name, aadPluginV2.name],
        },
      };
      const mockedCtx = new MockedV2Context(projectSettings);
      mockedCtx.userInteraction = new MockUserInteraction();
      const mockedInputs: Inputs = {
        platform: Platform.VSCode,
        projectPath: "./",
        isForUT: false,
      };
      const mockedTokenProvider: TokenProvider = {
        azureAccountProvider: new MockedAzureTokenProvider(),
        m365TokenProvider: new MockedM365Provider(),
      };
      const mockedEnvInfo: v2.EnvInfoV2 = {
        envName: "default",
        config: { manifest: { appName: { short: "test-app" } } },
        state: {},
      };
      mockProvisionV2ThatAlwaysSucceed(appStudioPluginV2);
      mockProvisionV2ThatAlwaysSucceed(aadPluginV2);

      const solution = new TeamsAppSolutionV2();
      const armSpy = sinon.spy(arm, "deployArmTemplates");
      const result = await solution.provisionResources(
        mockedCtx,
        mockedInputs,
        mockedEnvInfo,
        mockedTokenProvider
      );
      chai.assert.equal(armSpy.callCount, 0);
      expect(result.isOk()).equals(true);
    });

    it("provision after switch M365 and Azure subscription", async () => {
      const projectSettings: ProjectSettings = {
        appName: "my app",
        projectId: uuid.v4(),
        solutionSettings: {
          hostType: HostTypeOptionAzure.id,
          name: "azure",
          version: "1.0",
          activeResourcePlugins: [fehostPluginV2.name, appStudioPluginV2.name, aadPluginV2.name],
        },
      };
      const mockedCtx = new MockedV2Context(projectSettings);
      mockedCtx.userInteraction = new MockUserInteraction();
      const mockedInputs: Inputs = {
        platform: Platform.VSCode,
        projectPath: "./",
        isForUT: true,
      };
      const mockedTokenProvider: TokenProvider = {
        azureAccountProvider: new MockedAzureTokenProvider(),
        m365TokenProvider: new MockedM365Provider(),
      };
      const mockedEnvInfo: v2.EnvInfoV2 = {
        envName: "default",
        config: { manifest: { appName: { short: "test-app" } } },
        state: {
          "fx-resource-appstudio": { tenantId: "previousTenantId" },
          solution: {
            teamsAppTenantId: "previousTenantId",
            provisionSucceeded: true,
            subscriptionId: "previousSubscriptionId",
            subscriptionName: "previousSubscriptionName",
            tenantId: "tenantId",
          },
          "fx-resource-spfx": {},
        },
      };
      mockProvisionV2ThatAlwaysSucceed(fehostPluginV2);
      mockProvisionV2ThatAlwaysSucceed(appStudioPluginV2);
      mockProvisionV2ThatAlwaysSucceed(aadPluginV2);
      mocker.stub(backup, "backupFiles").resolves(ok(undefined));
      mocker.stub(arm, "updateAzureParameters").resolves(ok(undefined));

      const solution = new TeamsAppSolutionV2();
      const result = await solution.provisionResources(
        mockedCtx,
        mockedInputs,
        mockedEnvInfo,
        mockedTokenProvider
      );
      expect(result.isOk()).equals(true);
      expect(mockedEnvInfo.state.solution.teamsAppTenantId).equals("tenantId");
      expect(mockedEnvInfo.state["fx-resource-appstudio"].tenantId).equals("tenantId");
      expect(mockedEnvInfo.state.solution.provisionSucceeded).equals(true);
      expect(mockedEnvInfo.state.solution.subscriptionId).equals("subscriptionId");
      expect(mockedEnvInfo.state.solution.subscriptionName).equals("subscriptionName");
    });

    it("provision after switch M365 and Azure subscription error when update Azure parameters", async () => {
      const projectSettings: ProjectSettings = {
        appName: "my app",
        projectId: uuid.v4(),
        solutionSettings: {
          hostType: HostTypeOptionAzure.id,
          name: "azure",
          version: "1.0",
          activeResourcePlugins: [fehostPluginV2.name, appStudioPluginV2.name, aadPluginV2.name],
        },
      };
      const mockedCtx = new MockedV2Context(projectSettings);
      mockedCtx.userInteraction = new MockUserInteraction();
      const mockedInputs: Inputs = {
        platform: Platform.VSCode,
        projectPath: "./",
        isForUT: true,
      };
      const mockedTokenProvider: TokenProvider = {
        azureAccountProvider: new MockedAzureTokenProvider(),
        m365TokenProvider: new MockedM365Provider(),
      };
      const mockedEnvInfo: v2.EnvInfoV2 = {
        envName: "default",
        config: { manifest: { appName: { short: "test-app" } } },
        state: {
          "fx-resource-appstudio": { tenantId: "previousTenantId" },
          solution: {
            teamsAppTenantId: "previousTenantId",
            provisionSucceeded: true,
            subscriptionId: "previousSubscriptionId",
            subscriptionName: "previousSubscriptionName",
            tenantId: "tenantId",
          },
          "fx-resource-spfx": {},
        },
      };
      mockProvisionV2ThatAlwaysSucceed(fehostPluginV2);
      mockProvisionV2ThatAlwaysSucceed(appStudioPluginV2);
      mockProvisionV2ThatAlwaysSucceed(aadPluginV2);
      mocker.stub(backup, "backupFiles").resolves(ok(undefined));
      mocker
        .stub(arm, "updateAzureParameters")
        .resolves(err(new UserError("Solution", "error1", "error1")));

      const solution = new TeamsAppSolutionV2();
      const result = await solution.provisionResources(
        mockedCtx,
        mockedInputs,
        mockedEnvInfo,
        mockedTokenProvider
      );
      expect(result.isErr()).equals(true);
      if (result.isErr()) {
        expect(result.error.source).equal("Solution");
        expect(result.error.name).equal("error1");
      }
    });
  });
});

describe("askForProvisionConsentNew", () => {
  const mocker = sinon.createSandbox();
  afterEach(() => {
    mocker.restore();
  });
  it("not switch M365 or Azure", async () => {
    // Arrange
    const projectSettings: ProjectSettings = {
      appName: "my app",
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionAzure.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [fehostPluginV2.name, appStudioPluginV2.name, aadPluginV2.name],
      },
    };
    const mockedCtx = new MockedV2Context(projectSettings);
    mockedCtx.userInteraction = new MockUserInteraction();

    const showMessageSpy = mocker
      .stub<any, any>(mockedCtx.userInteraction, "showMessage")
      .callsFake(
        async (
          level: "info" | "warn" | "error",
          message: string,
          modal: boolean,
          ...items: string[]
        ): Promise<Result<string | undefined, FxError>> => {
          return ok("Provision");
        }
      );

    const mockedAzureTokenProvider = new MockedAzureTokenProvider();

    const mockedEnvInfo: v2.EnvInfoV2 = {
      envName: "dev",
      config: { manifest: { appName: { short: "test-app" } } },
      state: {
        "fx-resource-appstudio": { tenantId: "tenantId" },
        solution: {
          teamsAppTenantId: "tenantId",
          provisionSucceeded: true,
          subscriptionId: "subscriptionId",
          subscriptionName: "subscriptionName",
          tenantId: "tenantId",
        },
        "fx-resource-spfx": {},
      },
    };
    const m365AccountName = "m365Name";

    // Act
    await provisionUtils.askForProvisionConsentNew(
      mockedCtx,
      mockedAzureTokenProvider,
      mockedEnvInfo as v3.EnvInfoV3,
      false,
      false,
      m365AccountName,
      true,
      "tenantId"
    );

    // Assert
    const expectedAccountsInfo =
      "Azure account: \nAzure subscription: subscriptionName\nMicrosoft 365 account: m365Name\n\nCost may incur according to the usage. Do you want to provision resources in dev environment using accounts listed above?";
    expect(showMessageSpy.calledOnce).equal(true);
    expect(showMessageSpy.calledWithMatch("warn", expectedAccountsInfo, true, "Provision")).equal(
      true
    );
  });

  it("switch M365 only with Azure resources", async () => {
    // Arrange
    const projectSettings: ProjectSettings = {
      appName: "my app",
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionAzure.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [fehostPluginV2.name, appStudioPluginV2.name, aadPluginV2.name],
      },
    };
    const mockedCtx = new MockedV2Context(projectSettings);
    mockedCtx.userInteraction = new MockUserInteraction();

    const showMessageSpy = mocker
      .stub<any, any>(mockedCtx.userInteraction, "showMessage")
      .callsFake(
        async (
          level: "info" | "warn" | "error",
          message: string,
          modal: boolean,
          ...items: string[]
        ): Promise<Result<string | undefined, FxError>> => {
          return ok("Provision");
        }
      );

    const mockedAzureTokenProvider = new MockedAzureTokenProvider();

    const mockedEnvInfo: v2.EnvInfoV2 = {
      envName: "dev",
      config: { manifest: { appName: { short: "test-app" } } },
      state: {
        "fx-resource-appstudio": { tenantId: "tenantId" },
        solution: {
          teamsAppTenantId: "tenantId",
          provisionSucceeded: true,
          subscriptionId: "subscriptionId",
          subscriptionName: "subscriptionName",
          tenantId: "tenantId",
        },
        "fx-resource-spfx": {},
      },
    };
    const m365AccountName = "m365Name";

    // Act
    const res = await provisionUtils.askForProvisionConsentNew(
      mockedCtx,
      mockedAzureTokenProvider,
      mockedEnvInfo as v3.EnvInfoV3,
      true,
      false,
      m365AccountName,
      true,
      "tenantId",
      "subId"
    );

    // Assert
    const expectedAccountsInfo =
      "You are now using a different Microsoft 365 tenant from what you previously used.\nAzure account: \nAzure subscription: subscriptionName\nMicrosoft 365 account: m365Name\n\nCost may incur according to the usage. Do you want to provision resources in dev environment using accounts listed above?";
    expect(showMessageSpy.calledOnce).equal(true);
    expect(
      showMessageSpy.calledWithMatch("warn", expectedAccountsInfo, true, "Provision", "Learn more")
    ).equal(true);
    expect(res.isOk()).equal(true);
  });

  it("switch Azure only", async () => {
    // Arrange
    const projectSettings: ProjectSettings = {
      appName: "my app",
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionAzure.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [fehostPluginV2.name, appStudioPluginV2.name, aadPluginV2.name],
      },
    };
    const mockedCtx = new MockedV2Context(projectSettings);
    mockedCtx.userInteraction = new MockUserInteraction();

    const showMessageSpy = mocker
      .stub<any, any>(mockedCtx.userInteraction, "showMessage")
      .callsFake(
        async (
          level: "info" | "warn" | "error",
          message: string,
          modal: boolean,
          ...items: string[]
        ): Promise<Result<string | undefined, FxError>> => {
          return ok("Provision");
        }
      );

    const mockedAzureTokenProvider = new MockedAzureTokenProvider();

    const mockedEnvInfo: v2.EnvInfoV2 = {
      envName: "dev",
      config: { manifest: { appName: { short: "test-app" } } },
      state: {
        "fx-resource-appstudio": { tenantId: "tenantId" },
        solution: {
          teamsAppTenantId: "tenantId",
          provisionSucceeded: true,
          subscriptionId: "subscriptionId",
          subscriptionName: "subscriptionName",
          tenantId: "tenantId",
        },
        "fx-resource-spfx": {},
      },
    };
    const m365AccountName = "m365Name";

    // Act
    const res = await provisionUtils.askForProvisionConsentNew(
      mockedCtx,
      mockedAzureTokenProvider,
      mockedEnvInfo as v3.EnvInfoV3,
      false,
      true,
      m365AccountName,
      true,
      "tenantId",
      "subId"
    );

    // Assert
    const expectedAccountsInfo =
      "You are now using a different Azure subscription from what you previously used.\nAzure account: \nAzure subscription: subscriptionName\nMicrosoft 365 account: m365Name\n\nCost may incur according to the usage. Do you want to provision resources in dev environment using accounts listed above?";
    expect(showMessageSpy.calledOnce).equal(true);
    expect(
      showMessageSpy.calledWithMatch("warn", expectedAccountsInfo, true, "Provision", "Learn more")
    ).equal(true);
    expect(res.isOk()).equal(true);
  });

  it("switch Azure and M365", async () => {
    // Arrange
    const projectSettings: ProjectSettings = {
      appName: "my app",
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionAzure.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [fehostPluginV2.name, appStudioPluginV2.name, aadPluginV2.name],
      },
    };
    const mockedCtx = new MockedV2Context(projectSettings);
    mockedCtx.userInteraction = new MockUserInteraction();

    const showMessageSpy = mocker
      .stub<any, any>(mockedCtx.userInteraction, "showMessage")
      .callsFake(
        async (
          level: "info" | "warn" | "error",
          message: string,
          modal: boolean,
          ...items: string[]
        ): Promise<Result<string | undefined, FxError>> => {
          return ok("Provision");
        }
      );

    const mockedAzureTokenProvider = new MockedAzureTokenProvider();

    const mockedEnvInfo: v2.EnvInfoV2 = {
      envName: "dev",
      config: { manifest: { appName: { short: "test-app" } } },
      state: {
        "fx-resource-appstudio": { tenantId: "tenantId" },
        solution: {
          teamsAppTenantId: "tenantId",
          provisionSucceeded: true,
          subscriptionId: "subscriptionId",
          subscriptionName: "subscriptionName",
          tenantId: "tenantId",
        },
        "fx-resource-spfx": {},
      },
    };
    const m365AccountName = "m365Name";

    // Act
    const res = await provisionUtils.askForProvisionConsentNew(
      mockedCtx,
      mockedAzureTokenProvider,
      mockedEnvInfo as v3.EnvInfoV3,
      true,
      true,
      m365AccountName,
      true,
      "tenantId",
      "subId"
    );

    // Assert
    const expectedAccountsInfo =
      "You are now using a different Microsoft 365 tenant and a differnt Azure subscription from what you previously used.\nAzure account: \nAzure subscription: subscriptionName\nMicrosoft 365 account: m365Name\n\nCost may incur according to the usage. Do you want to provision resources in dev environment using accounts listed above?";
    expect(showMessageSpy.calledOnce).equal(true);
    expect(
      showMessageSpy.calledWithMatch("warn", expectedAccountsInfo, true, "Provision", "Learn more")
    ).equal(true);
    expect(res.isOk()).equal(true);
  });

  it("switch M365 without Azure resources", async () => {
    // Arrange
    const projectSettings: ProjectSettings = {
      appName: "my app",
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionAzure.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [fehostPluginV2.name, appStudioPluginV2.name, aadPluginV2.name],
      },
    };
    const mockedCtx = new MockedV2Context(projectSettings);
    mockedCtx.userInteraction = new MockUserInteraction();

    const showMessageSpy = mocker
      .stub<any, any>(mockedCtx.userInteraction, "showMessage")
      .callsFake(
        async (
          level: "info" | "warn" | "error",
          message: string,
          modal: boolean,
          ...items: string[]
        ): Promise<Result<string | undefined, FxError>> => {
          return ok("Provision");
        }
      );

    const mockedAzureTokenProvider = new MockedAzureTokenProvider();

    const mockedEnvInfo: v2.EnvInfoV2 = {
      envName: "dev",
      config: { manifest: { appName: { short: "test-app" } } },
      state: {
        "fx-resource-appstudio": { tenantId: "tenantId" },
        solution: {
          teamsAppTenantId: "tenantId",
          provisionSucceeded: true,
          subscriptionId: "subscriptionId",
          subscriptionName: "subscriptionName",
          tenantId: "tenantId",
        },
        "fx-resource-spfx": {},
      },
    };
    const m365AccountName = "m365Name";

    // Act
    const res = await provisionUtils.askForProvisionConsentNew(
      mockedCtx,
      mockedAzureTokenProvider,
      mockedEnvInfo as v3.EnvInfoV3,
      true,
      false,
      m365AccountName,
      false,
      "tenantId",
      "subId"
    );

    // Assert
    const expectedAccountsInfo =
      "You are now using a different Microsoft 365 tenant from what you previously used.\nMicrosoft 365 account: m365Name\n\nDo you want to provision resources in dev environment using the account listed above?";
    expect(showMessageSpy.calledOnce).equal(true);
    expect(
      showMessageSpy.calledWithMatch("warn", expectedAccountsInfo, true, "Provision", "Learn more")
    ).equal(true);
    expect(res.isOk()).equal(true);
  });

  it("not switch M365 when spfx", async () => {
    // Arrange
    const projectSettings: ProjectSettings = {
      appName: "my app",
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionAzure.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [appStudioPluginV2.name],
      },
    };
    const mockedCtx = new MockedV2Context(projectSettings);
    const mockedAzureTokenProvider = new MockedAzureTokenProvider();

    const mockedEnvInfo: v2.EnvInfoV2 = {
      envName: "dev",
      config: { manifest: { appName: { short: "test-app" } } },
      state: {
        "fx-resource-appstudio": { tenantId: "tenantId" },
        solution: {
          teamsAppTenantId: "tenantId",
          provisionSucceeded: true,
        },
        "fx-resource-spfx": {},
      },
    };
    const m365AccountName = "m365Name";

    // Act
    const res = await provisionUtils.askForProvisionConsentNew(
      mockedCtx,
      mockedAzureTokenProvider,
      mockedEnvInfo as v3.EnvInfoV3,
      false,
      false,
      m365AccountName,
      false,
      "tenantId",
      "subId"
    );

    // Assert
    expect(res.isOk()).equal(true);
  });

  it("not switch M365 when spfx", async () => {
    // Arrange
    const projectSettings: ProjectSettings = {
      appName: "my app",
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionAzure.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [appStudioPluginV2.name],
      },
    };
    const mockedCtx = new MockedV2Context(projectSettings);
    const mockedAzureTokenProvider = new MockedAzureTokenProvider();

    const mockedEnvInfo: v2.EnvInfoV2 = {
      envName: "dev",
      config: { manifest: { appName: { short: "test-app" } } },
      state: {
        "fx-resource-appstudio": { tenantId: "tenantId" },
        solution: {
          teamsAppTenantId: "tenantId",
          provisionSucceeded: true,
        },
        "fx-resource-spfx": {},
      },
    };
    const m365AccountName = "m365Name";

    // Act
    const res = await provisionUtils.askForProvisionConsentNew(
      mockedCtx,
      mockedAzureTokenProvider,
      mockedEnvInfo as v3.EnvInfoV3,
      false,
      false,
      m365AccountName,
      false,
      "tenantId",
      "subId"
    );

    // Assert
    expect(res.isOk()).equal(true);
  });

  it("cancel", async () => {
    // Arrange
    const projectSettings: ProjectSettings = {
      appName: "my app",
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionAzure.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [fehostPluginV2.name, appStudioPluginV2.name, aadPluginV2.name],
      },
    };
    const mockedCtx = new MockedV2Context(projectSettings);
    mockedCtx.userInteraction = new MockUserInteraction();

    const showMessageSpy = mocker
      .stub<any, any>(mockedCtx.userInteraction, "showMessage")
      .callsFake(
        async (
          level: "info" | "warn" | "error",
          message: string,
          modal: boolean,
          ...items: string[]
        ): Promise<Result<string | undefined, FxError>> => {
          return ok("Cancel");
        }
      );

    const mockedAzureTokenProvider = new MockedAzureTokenProvider();

    const mockedEnvInfo: v2.EnvInfoV2 = {
      envName: "dev",
      config: { manifest: { appName: { short: "test-app" } } },
      state: {
        "fx-resource-appstudio": { tenantId: "tenantId" },
        solution: {
          teamsAppTenantId: "tenantId",
          provisionSucceeded: true,
          subscriptionId: "subscriptionId",
          subscriptionName: "subscriptionName",
          tenantId: "tenantId",
        },
        "fx-resource-spfx": {},
      },
    };
    const m365AccountName = "m365Name";

    // Act
    const res = await provisionUtils.askForProvisionConsentNew(
      mockedCtx,
      mockedAzureTokenProvider,
      mockedEnvInfo as v3.EnvInfoV3,
      true,
      false,
      m365AccountName,
      false,
      "tenantId",
      "subId"
    );

    // Assert
    expect(showMessageSpy.calledOnce).equal(true);
    expect(res.isErr()).equal(true);
  });

  it("learn more and then provision", async () => {
    // Arrange
    const projectSettings: ProjectSettings = {
      appName: "my app",
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionAzure.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [fehostPluginV2.name, appStudioPluginV2.name, aadPluginV2.name],
      },
    };
    const mockedCtx = new MockedV2Context(projectSettings);
    mockedCtx.userInteraction = new MockUserInteraction();

    const showMessageSpy = mocker
      .stub<any, any>(mockedCtx.userInteraction, "showMessage")
      .onFirstCall()
      .returns(ok("Learn more"))
      .onSecondCall()
      .returns(ok("Provision"));

    mocker.stub<any, any>(mockedCtx.userInteraction, "openUrl").returns(ok(true));

    const mockedAzureTokenProvider = new MockedAzureTokenProvider();

    const mockedEnvInfo: v2.EnvInfoV2 = {
      envName: "dev",
      config: { manifest: { appName: { short: "test-app" } } },
      state: {
        "fx-resource-appstudio": { tenantId: "tenantId" },
        solution: {
          teamsAppTenantId: "tenantId",
          provisionSucceeded: true,
          subscriptionId: "subscriptionId",
          subscriptionName: "subscriptionName",
          tenantId: "tenantId",
        },
        "fx-resource-spfx": {},
      },
    };
    const m365AccountName = "m365Name";

    // Act
    const res = await provisionUtils.askForProvisionConsentNew(
      mockedCtx,
      mockedAzureTokenProvider,
      mockedEnvInfo as v3.EnvInfoV3,
      true,
      false,
      m365AccountName,
      false,
      "tenantId",
      "subId"
    );

    // Assert
    expect(showMessageSpy.calledTwice).equal(true);
    expect(res.isOk()).equal(true);
  });
});
