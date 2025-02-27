// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
"use strict";

import { cloneDeep } from "lodash";
import * as path from "path";
import * as util from "util";

import {
  assembleError,
  CryptoProvider,
  err,
  FxError,
  LogProvider,
  M365TokenProvider,
  ok,
  ProjectSettingsV3,
  Result,
  TelemetryReporter,
  UserInteraction,
  v3,
} from "@microsoft/teamsfx-api";

import { AppStudioScopes, GraphScopes } from "../../common/tools";
import { convertToAlphanumericOnly } from "../../common/utils";
import { LocalCrypto } from "../../core/crypto";
import { environmentManager } from "../../core/environment";
import { loadProjectSettingsByProjectPath } from "../../core/middleware/projectSettingsLoader";
import { AADRegistration } from "../../plugins/resource/bot/aadRegistration";
import { AppStudio } from "../../plugins/resource/bot/appStudio/appStudio";
import { IBotRegistration } from "../../plugins/resource/bot/appStudio/interfaces/IBotRegistration";
import { MaxLengths } from "../../plugins/resource/bot/constants";
import { PluginLocalDebug } from "../../plugins/resource/bot/resources/strings";
import { genUUID } from "../../plugins/resource/bot/utils/common";
import { ResourceNameFactory } from "../../plugins/resource/bot/utils/resourceNameFactory";
import { ComponentNames } from "../constants";
import { DebugAction } from "./common";
import {
  BotMessagingEndpointMissingError,
  errorSource,
  InvalidExistingBotArgsError,
} from "./error";
import { LocalEnvKeys, LocalEnvProvider } from "./localEnvProvider";

const botDebugMessages = {
  validatingArgs: "Validating the arguments ...",
  registeringAAD: "Registering an AAD app for bot ...",
  registeringBot: "Registering a bot in bot framework developer portal ...",
  updatingBotMessagingEndpoint: "Updating the bot messaging endpoint ...",
  savingStates: "Saving the states for bot ...",
  settingEnvs: "Setting the environment variables for bot ...",
  AADRegistered: "AAD app is registered",
  useExistingAAD: "Skip registering AAD app but use the existing AAD app from args",
  AADAlreadyRegistered: "Skip registering AAD app as it has already been registered before",
  botRegistered: "Bot is registered",
  botAlreadyRegistered: "Skip registering bot as it has already been registered before",
  botMessagingEndpointUpdated: "Bot messaging endpoint is updated to %s",
  statesSaved: "The states for bot are saved in %s",
  envsSet: "The environment variables for bot are set in %s",
};

export interface BotDebugArgs {
  botId?: string;
  botPassword?: string;
  botMessagingEndpoint?: string;
}

export class BotDebugHandler {
  private readonly projectPath: string;
  private args: BotDebugArgs;
  private readonly m365TokenProvider: M365TokenProvider;
  private readonly logger?: LogProvider;
  private readonly telemetry?: TelemetryReporter;
  private readonly ui?: UserInteraction;

  private existing = false;

  private projectSettingsV3?: ProjectSettingsV3;
  private cryptoProvider?: CryptoProvider;
  private envInfoV3?: v3.EnvInfoV3;

  constructor(
    projectPath: string,
    args: BotDebugArgs,
    m365TokenProvider: M365TokenProvider,
    logger?: LogProvider,
    telemetry?: TelemetryReporter,
    ui?: UserInteraction
  ) {
    this.projectPath = projectPath;
    this.args = args;
    this.m365TokenProvider = m365TokenProvider;
    this.logger = logger;
    this.telemetry = telemetry;
    this.ui = ui;
  }

  public getActions(): DebugAction[] {
    const actions: DebugAction[] = [];
    actions.push({
      startMessage: botDebugMessages.validatingArgs,
      run: this.validateArgs.bind(this),
    });
    actions.push({
      startMessage: botDebugMessages.registeringAAD,
      run: this.registerAAD.bind(this),
    });
    actions.push({
      startMessage: botDebugMessages.registeringBot,
      run: this.registerBot.bind(this),
    });
    actions.push({
      startMessage: botDebugMessages.updatingBotMessagingEndpoint,
      run: this.updateBotMessagingEndpoint.bind(this),
    });
    actions.push({
      startMessage: botDebugMessages.savingStates,
      run: this.saveStates.bind(this),
    });
    actions.push({
      startMessage: botDebugMessages.settingEnvs,
      run: this.setEnvs.bind(this),
    });
    return actions;
  }

  private async validateArgs(): Promise<Result<string[], FxError>> {
    // TODO: allow botPassword to be set in other places (like env) instead of tasks.json
    if (this.args.botId && this.args.botPassword) {
      this.existing = true;
    } else if (this.args.botId || this.args.botPassword) {
      return err(InvalidExistingBotArgsError());
    }

    if (!this.args.botMessagingEndpoint || this.args.botMessagingEndpoint.trim().length === 0) {
      return err(BotMessagingEndpointMissingError());
    }

    this.args.botMessagingEndpoint = this.args.botMessagingEndpoint.trim();

    return ok([]);
  }

  private async registerAAD(): Promise<Result<string[], FxError>> {
    try {
      const projectSettingsResult = await loadProjectSettingsByProjectPath(this.projectPath, true);
      if (projectSettingsResult.isErr()) {
        return err(projectSettingsResult.error);
      }
      this.projectSettingsV3 = projectSettingsResult.value as ProjectSettingsV3;

      this.cryptoProvider = new LocalCrypto(this.projectSettingsV3.projectId);

      const envInfoResult = await environmentManager.loadEnvInfo(
        this.projectPath,
        this.cryptoProvider,
        environmentManager.getLocalEnvName(),
        true
      );
      if (envInfoResult.isErr()) {
        return err(envInfoResult.error);
      }
      this.envInfoV3 = envInfoResult.value;
      this.envInfoV3.state[ComponentNames.TeamsBot] =
        this.envInfoV3.state[ComponentNames.TeamsBot] || {};

      if (this.existing) {
        // use existing bot
        // set botId, botPassword from args to state
        this.envInfoV3.state[ComponentNames.TeamsBot].botId = this.args.botId;
        this.envInfoV3.state[ComponentNames.TeamsBot].botPassword = this.args.botPassword;

        return ok([botDebugMessages.useExistingAAD]);
      } else if (
        this.envInfoV3.state[ComponentNames.TeamsBot].botId &&
        this.envInfoV3.state[ComponentNames.TeamsBot].botPassword
      ) {
        // AAD already registered
        return ok([botDebugMessages.AADAlreadyRegistered]);
      } else {
        // not using existing bot and AAD not yet registered
        const tokenResult = await this.m365TokenProvider.getAccessToken({
          scopes: GraphScopes,
        });
        if (tokenResult.isErr()) {
          return err(tokenResult.error);
        }

        const displayName = ResourceNameFactory.createCommonName(
          genUUID(),
          this.projectSettingsV3.appName,
          MaxLengths.AAD_DISPLAY_NAME
        );
        const botAuthCredential = await AADRegistration.registerAADAppAndGetSecretByGraph(
          tokenResult.value,
          displayName
        );

        // set objectId, botId, botPassword to state
        this.envInfoV3.state[ComponentNames.TeamsBot].objectId = botAuthCredential.objectId;
        this.envInfoV3.state[ComponentNames.TeamsBot].botId = botAuthCredential.clientId;
        this.envInfoV3.state[ComponentNames.TeamsBot].botPassword = botAuthCredential.clientSecret;

        return ok([botDebugMessages.AADRegistered]);
      }
    } catch (error: unknown) {
      return err(assembleError(error, errorSource));
    }
  }

  private async registerBot(): Promise<Result<string[], FxError>> {
    try {
      const tokenResult = await this.m365TokenProvider.getAccessToken({
        scopes: AppStudioScopes,
      });
      if (tokenResult.isErr()) {
        return err(tokenResult.error);
      }

      const result = await AppStudio.getBotRegistration(
        tokenResult.value,
        this.envInfoV3!.state[ComponentNames.TeamsBot].botId
      );
      if (result) {
        return ok([botDebugMessages.botAlreadyRegistered]);
      }

      const botReg: IBotRegistration = {
        botId: this.envInfoV3!.state[ComponentNames.TeamsBot].botId,
        name:
          convertToAlphanumericOnly(this.projectSettingsV3!.appName) +
          PluginLocalDebug.LOCAL_DEBUG_SUFFIX,
        description: "",
        iconUrl: "",
        messagingEndpoint: "",
        callingEndpoint: "",
      };

      await AppStudio.createBotRegistration(tokenResult.value, botReg);

      return ok([botDebugMessages.botRegistered]);
    } catch (error: unknown) {
      return err(assembleError(error, errorSource));
    }
  }

  private async updateBotMessagingEndpoint(): Promise<Result<string[], FxError>> {
    try {
      // set validDomain, domain, siteEndpoint from args to state
      const url = new URL(this.args.botMessagingEndpoint!);
      this.envInfoV3!.state[ComponentNames.TeamsBot].validDomain = url.hostname;
      this.envInfoV3!.state[ComponentNames.TeamsBot].domain = url.hostname;
      this.envInfoV3!.state[ComponentNames.TeamsBot].siteEndpoint = url.origin;

      const tokenResult = await this.m365TokenProvider.getAccessToken({
        scopes: AppStudioScopes,
      });
      if (tokenResult.isErr()) {
        return err(tokenResult.error);
      }

      await AppStudio.updateMessageEndpoint(
        tokenResult.value,
        this.envInfoV3!.state[ComponentNames.TeamsBot].botId,
        this.args.botMessagingEndpoint!
      );

      return ok([
        util.format(botDebugMessages.botMessagingEndpointUpdated, this.args.botMessagingEndpoint),
      ]);
    } catch (error: unknown) {
      return err(assembleError(error, errorSource));
    }
  }

  private async saveStates(): Promise<Result<string[], FxError>> {
    try {
      const statePath = await environmentManager.writeEnvState(
        cloneDeep(this.envInfoV3!.state),
        this.projectPath,
        this.cryptoProvider!,
        environmentManager.getLocalEnvName(),
        true
      );
      if (statePath.isErr()) {
        return err(statePath.error);
      }

      return ok([util.format(botDebugMessages.statesSaved, path.normalize(statePath.value))]);
    } catch (error: unknown) {
      return err(assembleError(error, errorSource));
    }
  }

  private async setEnvs(): Promise<Result<string[], FxError>> {
    try {
      const localEnvProvider = new LocalEnvProvider(this.projectPath);
      const botEnvs = await localEnvProvider.loadBotLocalEnvs();

      botEnvs.template[LocalEnvKeys.bot.template.BotId] =
        this.envInfoV3!.state[ComponentNames.TeamsBot].botId;
      botEnvs.template[LocalEnvKeys.bot.template.BotPassword] =
        this.envInfoV3!.state[ComponentNames.TeamsBot].botPassword;

      const envPath = await localEnvProvider.saveBotLocalEnvs(botEnvs);

      return ok([util.format(botDebugMessages.envsSet, path.normalize(envPath))]);
    } catch (error: unknown) {
      return err(assembleError(error, errorSource));
    }
  }
}
