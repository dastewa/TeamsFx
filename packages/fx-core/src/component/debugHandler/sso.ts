// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
"use strict";

import { cloneDeep } from "lodash";
import * as path from "path";
import * as util from "util";
import { v4 as uuidv4 } from "uuid";

import {
  AppPackageFolderName,
  assembleError,
  BuildFolderName,
  ConfigMap,
  CryptoProvider,
  EnvConfig,
  EnvInfo,
  err,
  FxError,
  LogProvider,
  M365TokenProvider,
  ok,
  PluginContext,
  ProjectSettingsV3,
  Result,
  TelemetryReporter,
  UserInteraction,
  v3,
} from "@microsoft/teamsfx-api";

import { ProjectSettingsHelper } from "../../common/local/projectSettingsHelper";
import { hasSQL } from "../../common/projectSettingsHelperV3";
import { TelemetryEvent } from "../../common/telemetry";
import { getAllowedAppIds, objectToMap } from "../../common/tools";
import { LocalCrypto } from "../../core/crypto";
import { environmentManager } from "../../core/environment";
import { loadProjectSettingsByProjectPath } from "../../core/middleware/projectSettingsLoader";
import { AadAppClient } from "../../plugins/resource/aad/aadAppClient";
import { AadAppManifestManager } from "../../plugins/resource/aad/aadAppManifestManager";
import { Constants } from "../../plugins/resource/aad/constants";
import { ProvisionConfig } from "../../plugins/resource/aad/utils/configs";
import { TokenProvider } from "../../plugins/resource/aad/utils/tokenProvider";
import { ComponentNames } from "../constants";
import { convertEnvStateV3ToV2 } from "../migrate";
import { DebugAction } from "./common";
import { errorSource, InvalidSSODebugArgsError } from "./error";
import { LocalEnvKeys, LocalEnvProvider } from "./localEnvProvider";

const ssoDebugMessages = {
  validatingArgs: "Validating the arguments ...",
  registeringAAD: "Registering an AAD app for SSO ...",
  configuringAAD: "Configuring AAD app for SSO ...",
  buildingAndSavingAADManifest: "Building and saving AAD manifest ...",
  savingStates: "Saving the states for SSO ...",
  settingEnvs: "Setting the environment variables for SSO ...",
  AADRegistered: "AAD app is registered",
  useExistingAAD: "Skip registering AAD app but use the existing AAD app from args",
  AADAlreadyRegistered: "Skip registering AAD app as it has already been registered before",
  AADConfigured: "AAD app is configured",
  AADManifestSaved: "AAD app manifest is saved in %s",
  statesSaved: "The states for SSO are saved in %s",
  tabEnvsSet: "The SSO environment variables for Tab are set in %s",
  botEnvsSet: "The SSO environment variables for bot are set in %s",
  backendEnvsSet: "The SSO environment variables for backend are set in %s",
};

export interface SSODebugArgs {
  objectId?: string;
  clientId?: string;
  clientSecret?: string;
  accessAsUserScopeId?: string;
}

export class SSODebugHandler {
  private readonly projectPath: string;
  private args: SSODebugArgs;
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
    args: SSODebugArgs,
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
      startMessage: ssoDebugMessages.validatingArgs,
      run: this.validateArgs.bind(this),
    });
    actions.push({
      startMessage: ssoDebugMessages.registeringAAD,
      run: this.registerAAD.bind(this),
    });
    actions.push({
      startMessage: ssoDebugMessages.configuringAAD,
      run: this.configureAAD.bind(this),
    });
    actions.push({
      startMessage: ssoDebugMessages.buildingAndSavingAADManifest,
      run: this.buildAndSaveAADManifest.bind(this),
    });
    actions.push({
      startMessage: ssoDebugMessages.savingStates,
      run: this.saveStates.bind(this),
    });
    actions.push({
      startMessage: ssoDebugMessages.settingEnvs,
      run: this.setEnvs.bind(this),
    });
    return actions;
  }

  private async validateArgs(): Promise<Result<string[], FxError>> {
    // TODO: allow clientSecret to be set in other places (like env) instead of tasks.json
    if (this.args.objectId && this.args.clientId && this.args.clientSecret) {
      this.existing = true;
    } else if (this.args.objectId || this.args.clientId || this.args.clientSecret) {
      return err(InvalidSSODebugArgsError());
    }
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
      this.envInfoV3.state[ComponentNames.AadApp] =
        this.envInfoV3.state[ComponentNames.AadApp] || {};

      // use existing AAD
      if (this.existing) {
        // set objectId, clientId, clientSecret, oauth2PermissionScopeId from args to state
        this.envInfoV3.state[ComponentNames.AadApp].objectId = this.args.objectId;
        this.envInfoV3.state[ComponentNames.AadApp].clientId = this.args.clientId;
        this.envInfoV3.state[ComponentNames.AadApp].clientSecret = this.args.clientSecret;
        this.envInfoV3.state[ComponentNames.AadApp].oauth2PermissionScopeId =
          this.args.accessAsUserScopeId || uuidv4();

        return ok([ssoDebugMessages.useExistingAAD]);
      }

      // set oauth2PermissionScopeId to state
      this.envInfoV3.state[ComponentNames.AadApp].oauth2PermissionScopeId =
        this.envInfoV3.state[ComponentNames.AadApp].oauth2PermissionScopeId || uuidv4();

      // AAD already registered
      if (
        this.envInfoV3.state[ComponentNames.AadApp].objectId &&
        this.envInfoV3.state[ComponentNames.AadApp].clientId
      ) {
        if (!this.envInfoV3.state[ComponentNames.AadApp].clientSecret) {
          await TokenProvider.init({
            m365: this.m365TokenProvider,
          });

          const config = new ProvisionConfig(true, false);
          config.objectId = this.envInfoV3.state[ComponentNames.AadApp].objectId;
          config.clientId = this.envInfoV3.state[ComponentNames.AadApp].clientId;
          await AadAppClient.createAadAppSecret(TelemetryEvent.DebugSetUpSSO, config);

          // set clientSecret to state
          this.envInfoV3.state[ComponentNames.AadApp].clientSecret = config.password;
        }

        return ok([ssoDebugMessages.AADAlreadyRegistered]);
      }

      await TokenProvider.init({
        m365: this.m365TokenProvider,
      });

      const context = this.constructPluginContext(this.envInfoV3, this.cryptoProvider);
      const manifest = await AadAppManifestManager.loadAadManifest(context);

      const config = new ProvisionConfig(true, false);
      await AadAppClient.createAadAppUsingManifest(TelemetryEvent.DebugSetUpSSO, manifest, config);
      await AadAppClient.createAadAppSecret(TelemetryEvent.DebugSetUpSSO, config);

      // set objectId, clientId, clientSecret to state
      this.envInfoV3.state[ComponentNames.AadApp].objectId = config.objectId;
      this.envInfoV3.state[ComponentNames.AadApp].clientId = config.clientId;
      this.envInfoV3.state[ComponentNames.AadApp].clientSecret = config.password;

      return ok([ssoDebugMessages.AADRegistered]);
    } catch (error: unknown) {
      return err(assembleError(error, errorSource));
    }
  }

  private async configureAAD(): Promise<Result<string[], FxError>> {
    try {
      // set applicationIdUris to state
      let applicationIdUri = "api://";
      if (ProjectSettingsHelper.includeFrontend(this.projectSettingsV3)) {
        applicationIdUri += "localhost/";
        if (!ProjectSettingsHelper.includeBot(this.projectSettingsV3)) {
          applicationIdUri += this.envInfoV3!.state[ComponentNames.AadApp].clientId;
        }
      }
      if (ProjectSettingsHelper.includeBot(this.projectSettingsV3)) {
        applicationIdUri += `botid-${this.envInfoV3!.state[ComponentNames.TeamsBot].botId}`;
      }
      this.envInfoV3!.state[ComponentNames.AadApp].applicationIdUris = applicationIdUri;

      // set frontendEndpoint to state
      if (ProjectSettingsHelper.includeFrontend(this.projectSettingsV3)) {
        this.envInfoV3!.state[ComponentNames.AadApp].frontendEndpoint = "https://localhost";
      }

      // set botId, botEndpoint to state
      if (ProjectSettingsHelper.includeBot(this.projectSettingsV3)) {
        this.envInfoV3!.state[ComponentNames.AadApp].botId =
          this.envInfoV3!.state[ComponentNames.TeamsBot].botId;
        this.envInfoV3!.state[ComponentNames.AadApp].botEndpoint =
          this.envInfoV3!.state[ComponentNames.TeamsBot].siteEndpoint;
      }

      await TokenProvider.init({
        m365: this.m365TokenProvider,
      });

      // set tenantId, oauthHost, oauthAuthority to state
      this.envInfoV3!.state[ComponentNames.AadApp].tenantId = TokenProvider.tenantId;
      this.envInfoV3!.state[ComponentNames.AadApp].oauthHost = Constants.oauthAuthorityPrefix;
      this.envInfoV3!.state[
        ComponentNames.AadApp
      ].oauthAuthority = `${Constants.oauthAuthorityPrefix}/${TokenProvider.tenantId}`;

      const context = this.constructPluginContext(this.envInfoV3!, this.cryptoProvider!);
      const manifest = await AadAppManifestManager.loadAadManifest(context);
      await AadAppClient.updateAadAppUsingManifest(TelemetryEvent.DebugSetUpSSO, manifest, false);

      return ok([ssoDebugMessages.AADConfigured]);
    } catch (error: unknown) {
      return err(assembleError(error, errorSource));
    }
  }

  private async buildAndSaveAADManifest(): Promise<Result<string[], FxError>> {
    try {
      const context = this.constructPluginContext(this.envInfoV3!, this.cryptoProvider!);
      const manifest = await AadAppManifestManager.loadAadManifest(context);
      await AadAppManifestManager.writeManifestFileToBuildFolder(manifest, context);

      const aadManifestPath = `${context.root}/${BuildFolderName}/${AppPackageFolderName}/aad.${context.envInfo.envName}.json`;
      return ok([util.format(ssoDebugMessages.AADManifestSaved, path.normalize(aadManifestPath))]);
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

      return ok([util.format(ssoDebugMessages.statesSaved, path.normalize(statePath.value))]);
    } catch (error: unknown) {
      return err(assembleError(error, errorSource));
    }
  }

  private async setEnvs(): Promise<Result<string[], FxError>> {
    try {
      const messages: string[] = [];

      const localEnvProvider = new LocalEnvProvider(this.projectPath);
      if (ProjectSettingsHelper.includeFrontend(this.projectSettingsV3)) {
        const frontendEnvs = await localEnvProvider.loadFrontendLocalEnvs();

        frontendEnvs.teamsfx[LocalEnvKeys.frontend.teamsfx.ClientId] =
          this.envInfoV3!.state[ComponentNames.AadApp].clientId;
        frontendEnvs.teamsfx[LocalEnvKeys.frontend.teamsfx.LoginUrl] = `${
          this.envInfoV3!.state[ComponentNames.TeamsTab].endpoint
        }/auth-start.html`;

        if (ProjectSettingsHelper.includeBackend(this.projectSettingsV3)) {
          frontendEnvs.teamsfx[LocalEnvKeys.frontend.teamsfx.FuncEndpoint] =
            frontendEnvs.teamsfx[LocalEnvKeys.frontend.teamsfx.FuncEndpoint] ||
            "http://localhost:7071";
          frontendEnvs.teamsfx[LocalEnvKeys.frontend.teamsfx.FuncName] = this.projectSettingsV3!
            .defaultFunctionName as string;
        }

        const envPath = await localEnvProvider.saveFrontendLocalEnvs(frontendEnvs);
        messages.push(util.format(ssoDebugMessages.tabEnvsSet, path.normalize(envPath)));
      }
      if (ProjectSettingsHelper.includeBackend(this.projectSettingsV3)) {
        const backendEnvs = await localEnvProvider.loadBackendLocalEnvs();

        backendEnvs.teamsfx[LocalEnvKeys.backend.teamsfx.ClientId] =
          this.envInfoV3!.state[ComponentNames.AadApp].clientId;
        backendEnvs.teamsfx[LocalEnvKeys.backend.teamsfx.ClientSecret] =
          this.envInfoV3!.state[ComponentNames.AadApp].clientSecret;
        backendEnvs.teamsfx[LocalEnvKeys.backend.teamsfx.TenantId] =
          this.envInfoV3!.state[ComponentNames.AadApp].tenantId;
        backendEnvs.teamsfx[LocalEnvKeys.backend.teamsfx.AuthorityHost] =
          this.envInfoV3!.state[ComponentNames.AadApp].oauthHost;
        backendEnvs.teamsfx[LocalEnvKeys.backend.teamsfx.AllowedAppIds] =
          getAllowedAppIds().join(";");

        if (hasSQL(this.projectSettingsV3!)) {
          backendEnvs.teamsfx[LocalEnvKeys.backend.teamsfx.SqlEndpoint] =
            backendEnvs.teamsfx[LocalEnvKeys.backend.teamsfx.SqlEndpoint] || "";
          backendEnvs.teamsfx[LocalEnvKeys.backend.teamsfx.SqlUserName] =
            backendEnvs.teamsfx[LocalEnvKeys.backend.teamsfx.SqlUserName] || "";
          backendEnvs.teamsfx[LocalEnvKeys.backend.teamsfx.SqlPassword] =
            backendEnvs.teamsfx[LocalEnvKeys.backend.teamsfx.SqlPassword] || "";
          backendEnvs.teamsfx[LocalEnvKeys.backend.teamsfx.SqlDbName] =
            backendEnvs.teamsfx[LocalEnvKeys.backend.teamsfx.SqlDbName] || "";
          backendEnvs.teamsfx[LocalEnvKeys.backend.teamsfx.SqlIdentityId] =
            backendEnvs.teamsfx[LocalEnvKeys.backend.teamsfx.SqlIdentityId] || "";
        }

        const envPath = await localEnvProvider.saveBackendLocalEnvs(backendEnvs);

        messages.push(util.format(ssoDebugMessages.backendEnvsSet, path.normalize(envPath)));
      }
      if (ProjectSettingsHelper.includeBot(this.projectSettingsV3)) {
        const botEnvs = await localEnvProvider.loadBotLocalEnvs();

        botEnvs.teamsfx[LocalEnvKeys.bot.teamsfx.ClientId] =
          this.envInfoV3!.state[ComponentNames.AadApp].clientId;
        botEnvs.teamsfx[LocalEnvKeys.bot.teamsfx.ClientSecret] =
          this.envInfoV3!.state[ComponentNames.AadApp].clientSecret;
        botEnvs.teamsfx[LocalEnvKeys.bot.teamsfx.TenantId] =
          this.envInfoV3!.state[ComponentNames.AadApp].tenantId;
        botEnvs.teamsfx[LocalEnvKeys.bot.teamsfx.AuthorityHost] =
          this.envInfoV3!.state[ComponentNames.AadApp].oauthHost;
        botEnvs.teamsfx[LocalEnvKeys.bot.teamsfx.LoginEndpoint] = `${
          this.envInfoV3!.state[ComponentNames.AadApp].botEndpoint
        }/auth-start.html`;
        botEnvs.teamsfx[LocalEnvKeys.bot.teamsfx.ApplicationIdUri] =
          this.envInfoV3!.state[ComponentNames.AadApp].applicationIdUris;

        if (ProjectSettingsHelper.includeBackend(this.projectSettingsV3)) {
          botEnvs.teamsfx[LocalEnvKeys.bot.teamsfx.ApiEndpoint] =
            botEnvs.teamsfx[LocalEnvKeys.bot.teamsfx.ApiEndpoint] || "http://localhost:7071";
        }

        if (hasSQL(this.projectSettingsV3!)) {
          botEnvs.teamsfx[LocalEnvKeys.bot.teamsfx.SqlEndpoint] =
            botEnvs.teamsfx[LocalEnvKeys.bot.teamsfx.SqlEndpoint] || "";
          botEnvs.teamsfx[LocalEnvKeys.bot.teamsfx.SqlUserName] =
            botEnvs.teamsfx[LocalEnvKeys.bot.teamsfx.SqlUserName] || "";
          botEnvs.teamsfx[LocalEnvKeys.bot.teamsfx.SqlPassword] =
            botEnvs.teamsfx[LocalEnvKeys.bot.teamsfx.SqlPassword] || "";
          botEnvs.teamsfx[LocalEnvKeys.bot.teamsfx.SqlDbName] =
            botEnvs.teamsfx[LocalEnvKeys.bot.teamsfx.SqlDbName] || "";
          botEnvs.teamsfx[LocalEnvKeys.bot.teamsfx.SqlIdentityId] =
            botEnvs.teamsfx[LocalEnvKeys.bot.teamsfx.SqlIdentityId] || "";
        }

        const envPath = await localEnvProvider.saveBotLocalEnvs(botEnvs);
        messages.push(util.format(ssoDebugMessages.botEnvsSet, path.normalize(envPath)));
      }

      return ok(messages);
    } catch (error: unknown) {
      return err(assembleError(error, errorSource));
    }
  }

  private constructPluginContext(
    envInfoV3: v3.EnvInfoV3,
    cryptoProvider: CryptoProvider
  ): PluginContext {
    const envInfo: EnvInfo = {
      envName: envInfoV3.envName,
      config: envInfoV3.config as EnvConfig,
      state: objectToMap(convertEnvStateV3ToV2(envInfoV3.state)),
    };
    const context: PluginContext = {
      root: this.projectPath,
      logProvider: this.logger,
      telemetryReporter: this.telemetry,
      ui: this.ui,
      cryptoProvider,
      envInfo: envInfo,
      config: new ConfigMap(),
    };

    return context;
  }
}
