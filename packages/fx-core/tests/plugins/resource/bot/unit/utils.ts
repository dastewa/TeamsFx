// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import {
  ConfigMap,
  LogProvider,
  PluginContext,
  LogLevel,
  Platform,
  Inputs,
  AzureSolutionSettings,
  TelemetryReporter,
  CryptoProvider,
  TokenRequest,
} from "@microsoft/teamsfx-api";
import { ResourceGroups } from "@azure/arm-resources";
import { ServiceClientCredentials } from "@azure/ms-rest-js";

import * as utils from "../../../../../src/plugins/resource/bot/utils/common";
import {
  PluginAAD,
  PluginSolution,
  PluginLocalDebug,
  PluginBot,
} from "../../../../../src/plugins/resource/bot/resources/strings";
import {
  Colors,
  FxError,
  InputTextConfig,
  InputTextResult,
  IProgressHandler,
  MultiSelectConfig,
  MultiSelectResult,
  ok,
  Result,
  RunnableTask,
  SelectFileConfig,
  SelectFileResult,
  SelectFilesConfig,
  SelectFilesResult,
  SelectFolderConfig,
  SelectFolderResult,
  SingleSelectConfig,
  SingleSelectResult,
  TaskConfig,
  UserInteraction,
} from "@microsoft/teamsfx-api";
import { newEnvInfo } from "../../../../../src";
import { LocalCrypto } from "../../../../../src/core/crypto";
import faker from "faker";
import sinon from "sinon";
import { Context } from "@microsoft/teamsfx-api/build/v2";
import { QuestionNames } from "../../../../../src/plugins/resource/bot/constants";
import { FunctionsHttpTriggerOptionItem } from "../../../../../src/plugins/resource/bot/question";
import { PluginActRoles } from "../../../../../src/plugins/resource/bot/enums/pluginActRoles";
import {
  AzureSolutionQuestionNames,
  BotScenario,
} from "../../../../../src/plugins/solution/fx-solution/question";
import { ResourcePlugins } from "../../../../../src/common/constants";
import { TokenCredential, AccessToken, GetTokenOptions } from "@azure/core-http";

export class MockUserInteraction implements UserInteraction {
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
    return ok("default");
  }
  createProgressBar(title: string, totalSteps: number): IProgressHandler {
    const handler: IProgressHandler = {
      start: async (detail?: string): Promise<void> => {},
      next: async (detail?: string): Promise<void> => {},
      end: async (): Promise<void> => {},
    };
    return handler;
  }
  async runWithProgress<T>(
    task: RunnableTask<T>,
    config: TaskConfig,
    ...args: any
  ): Promise<Result<T, FxError>> {
    return task.run(args);
  }
}

export function generateFakeDialog(): UserInteraction {
  return new MockUserInteraction();
}
export function generateFakeServiceClientCredentials(): ServiceClientCredentials {
  return {
    signRequest: (anything) => {
      return Promise.resolve(anything);
    },
  };
}

export class MyTokenCredential implements TokenCredential {
  async getToken(
    scopes: string | string[],
    options?: GetTokenOptions | undefined
  ): Promise<AccessToken | null> {
    return {
      token: "a.eyJ1c2VySWQiOiJ0ZXN0QHRlc3QuY29tIn0=.c",
      expiresOnTimestamp: 1234,
    };
  }
}

export function generateFakeLogProvider(): LogProvider {
  return {
    info: (message: string | Array<any>) => {
      return Promise.resolve(true);
    },
    log: (logLevel: LogLevel, message: string) => {
      return Promise.resolve(true);
    },
    trace: (message: string) => {
      return Promise.resolve(true);
    },
    debug: (message: string) => {
      return Promise.resolve(true);
    },
    error: (message: string) => {
      return Promise.resolve(true);
    },
    warning: (message: string) => {
      return Promise.resolve(true);
    },
    fatal: (message: string) => {
      return Promise.resolve(true);
    },
  };
}

export function newPluginContext(): PluginContext {
  return {
    root: "",
    envInfo: newEnvInfo(
      undefined,
      undefined,
      new Map<string, Map<string, string>>([
        [
          PluginAAD.PLUGIN_NAME,
          new Map<string, string>([
            [PluginAAD.CLIENT_ID, utils.genUUID()],
            [PluginAAD.CLIENT_SECRET, utils.genUUID()],
            [PluginAAD.APPLICATION_ID_URIS, "anything"],
            [PluginAAD.CLIENT_ID, "anything"],
            [PluginAAD.CLIENT_SECRET, "anything"],
          ]),
        ],
        [
          PluginSolution.PLUGIN_NAME,
          new Map<string, string>([
            [PluginSolution.LOCATION, "Central US"],
            [PluginSolution.RESOURCE_GROUP_NAME, "anything"],
            [PluginSolution.M365_TENANT_ID, "anything"],
            [PluginSolution.SUBSCRIPTION_ID, "subscriptionId"],
          ]),
        ],
        [
          PluginLocalDebug.PLUGIN_NAME,
          new Map<string, string>([[PluginLocalDebug.LOCAL_BOT_ENDPOINT, "anything"]]),
        ],
      ])
    ),
    config: new ConfigMap(),
    answers: { platform: Platform.VSCode },
    projectSettings: {
      appName: "My App",
      projectId: utils.genUUID(),
      solutionSettings: {
        name: "AnyName",
        version: "0.0.1",
        capabilities: ["Bot"],
      },
    },
    cryptoProvider: new LocalCrypto(""),
    m365TokenProvider: {
      getAccessToken: (tokenRequest: TokenRequest) => {
        return Promise.resolve(ok("fakeToken"));
      },
      getJsonObject: (tokenRequest: TokenRequest) => {
        return Promise.resolve(ok({}));
      },
      getStatus: (tokenRequest: TokenRequest) => {
        return Promise.resolve(ok({ status: "SignedIn" }));
      },
      removeStatusChangeMap: (name: string) => {
        return Promise.resolve(ok(true));
      },
      setStatusChangeMap: (
        name: string,
        tokenRequest: TokenRequest,
        statusChange: (
          status: string,
          token?: string,
          accountInfo?: Record<string, unknown>
        ) => Promise<void>,
        immediateCall?: boolean
      ) => {
        return Promise.resolve(ok(true));
      },
    },
    azureAccountProvider: {
      getIdentityCredentialAsync: (showDialog?: boolean) => {
        return Promise.resolve(undefined);
      },
      signout: () => {
        return Promise.resolve(true);
      },
      setStatusChangeMap: (name: string, anything) => {
        return Promise.resolve(true);
      },
      removeStatusChangeMap: (name: string) => {
        return Promise.resolve(true);
      },
      getJsonObject: (showDialog?: boolean) => {
        return Promise.resolve(undefined);
      },
      setSubscription: (subsId: string) => {
        return Promise.resolve();
      },
      listSubscriptions: () => {
        return Promise.resolve([]);
      },
      getAccountInfo: () => {
        return {};
      },
      getSelectedSubscription: () => {
        return Promise.resolve({
          subscriptionId: "subscriptionId",
          tenantId: "tenantId",
          subscriptionName: "subscriptionName",
        });
      },
    },
    localSettings: {
      bot: new ConfigMap(),
      teamsApp: new ConfigMap(),
      auth: new ConfigMap(),
      frontend: new ConfigMap(),
      backend: new ConfigMap(),
    },
  };
}

export function newPluginContextV2(): Context {
  return {
    userInteraction: {} as UserInteraction,
    logProvider: {} as LogProvider,
    telemetryReporter: {} as TelemetryReporter,
    cryptoProvider: {} as CryptoProvider,
    projectSetting: {
      appName: "test-app",
      projectId: "project-id",
      programmingLanguage: "javascript",
      solutionSettings: {
        name: "test-solution",
        capabilities: [PluginActRoles.Bot],
        hostType: "azure-functions",
        azureResources: [],
        activeResourcePlugins: [ResourcePlugins.Aad, ResourcePlugins.Bot],
      } as AzureSolutionSettings,
      pluginSettings: {
        [ResourcePlugins.Bot]: {
          [PluginBot.HOST_TYPE]: "azure-functions",
        },
      },
    },
  };
}

export function newInputV2(): Inputs {
  return {
    platform: Platform.VSCode,
    env: "test",
    projectPath: "test-app",
    [QuestionNames.BOT_HOST_TYPE_TRIGGER]: [FunctionsHttpTriggerOptionItem.id],
    [AzureSolutionQuestionNames.Scenarios]: [BotScenario.NotificationBot],
  };
}

export function genTomorrow(): number {
  return Date.now() + 24 * 60 * 60 * 1000;
}

export function genYesterday(): number {
  return Date.now() - 24 * 60 * 60 * 1000;
}
