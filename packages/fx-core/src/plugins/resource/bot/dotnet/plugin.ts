// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AzureSolutionSettings, PluginContext } from "@microsoft/teamsfx-api";
import path from "path";
import { getTemplatesFolder } from "../../../../folder";
import { Bicep, ConstantString } from "../../../../common/constants";
import { getActivatedV2ResourcePlugins } from "../../../solution/fx-solution/ResourcePluginContainer";
import { NamedArmResourcePluginAdaptor } from "../../../solution/fx-solution/v2/adaptor";
import { Logger } from "../logger";
import { Messages } from "../resources/messages";
import { FxResult, FxBotPluginResultFactory as ResultFactory } from "../result";
import { generateBicepFromFile, isAADEnabled } from "../../../../common/tools";
import { ArmTemplateResult } from "../../../../common/armInterface";
import fs from "fs-extra";
import { PathInfo, RegularExpr } from "./constants";
import { TeamsBotImpl } from "../plugin";
import { FileIOError } from "./errors";
import { PluginNames } from "../../../solution/fx-solution/constants";
import { PluginAAD, PluginBot } from "../resources/strings";
import appSettingsWithSSO from "./appSettings/appSettingsWithSSO.json";

// Extends TeamsBotImpl to reuse provision method
export class DotnetBotImpl extends TeamsBotImpl {
  public async generateArmTemplates(ctx: PluginContext): Promise<FxResult> {
    Logger.info(Messages.GeneratingArmTemplatesBot);
    const plugins = getActivatedV2ResourcePlugins(ctx.projectSettings!).map(
      (p) => new NamedArmResourcePluginAdaptor(p)
    );
    const pluginCtx = { plugins: plugins.map((obj) => obj.name) };
    const bicepTemplateDir = path.join(getTemplatesFolder(), PathInfo.BicepTemplateRelativeDir);
    const provisionOrchestration = await generateBicepFromFile(
      path.join(bicepTemplateDir, Bicep.ProvisionFileName),
      pluginCtx
    );
    const provisionModules = await generateBicepFromFile(
      path.join(bicepTemplateDir, PathInfo.ProvisionModuleTemplateFileName),
      pluginCtx
    );

    const result: ArmTemplateResult = {
      Provision: {
        Orchestration: provisionOrchestration,
        Modules: { botservice: provisionModules },
      },
      Parameters: JSON.parse(
        await fs.readFile(
          path.join(bicepTemplateDir, Bicep.ParameterFileName),
          ConstantString.UTF8Encoding
        )
      ),
    };

    Logger.info(Messages.SuccessfullyGenerateArmTemplatesBot);
    return ResultFactory.Success(result);
  }

  public async postLocalDebug(context: PluginContext): Promise<FxResult> {
    await super.postLocalDebug(context);
    const appSettingsPath = path.join(context.root, PathInfo.appSettingDevelopment);
    try {
      let appSettings: string;
      const includeAad = isAADEnabled(
        context.projectSettings!.solutionSettings as AzureSolutionSettings
      );
      if (await fs.pathExists(appSettingsPath)) {
        appSettings = await fs.readFile(appSettingsPath, "utf-8");
      } else {
        // if appsetting file not exist, generate a new one
        // TODO(qidon): load content from resource file or template
        appSettings = includeAad
          ? JSON.stringify(appSettingsWithSSO, null, "\t")
          : '\
{\r\n\
  "Logging": {\r\n\
    "LogLevel": {\r\n\
      "Default": "Information",\r\n\
      "Microsoft": "Warning",\r\n\
      "Microsoft.Hosting.Lifetime": "Information"\r\n\
    }\r\n\
  },\r\n\
  "AllowedHosts": "*",\r\n\
  "BOT_ID": "$botId$",\r\n\
  "BOT_PASSWORD": "$bot-password$"\r\n\
}\r\n';
      }

      const botId = context.envInfo.state.get(PluginNames.BOT)?.get(PluginBot.BOT_ID);
      const botPassword = context.envInfo.state.get(PluginNames.BOT)?.get(PluginBot.BOT_PASSWORD);
      if (!botId && !botPassword) {
        Logger.warning("Bot id and password are empty");
        return ResultFactory.Success();
      }
      if (botId) {
        appSettings = appSettings.replace(RegularExpr.botId, botId);
      }
      if (botPassword) {
        appSettings = appSettings.replace(RegularExpr.botPassword, botPassword);
      }
      if (includeAad) {
        const clientId = context.envInfo.state.get(PluginNames.AAD)?.get(PluginAAD.CLIENT_ID);
        const clientSecret = context.envInfo.state
          .get(PluginNames.AAD)
          ?.get(PluginAAD.CLIENT_SECRET);
        const tenantId = context.envInfo.state.get(PluginNames.AAD)?.get(PluginAAD.TENANT_ID);
        const oauthAuthority = `${context.envInfo.state
          .get(PluginNames.AAD)
          ?.get(PluginAAD.OAUTH_AUTHORITY)}/${tenantId}`;
        const applicationIdUri = context.envInfo.state
          .get(PluginNames.AAD)
          ?.get(PluginAAD.APPLICATION_ID_URIS);
        const initiateLoginEndpoint = `${context.envInfo.state
          .get(PluginNames.BOT)
          ?.get(PluginBot.SITE_ENDPOINT)}/bot-auth-start`;

        if (clientId) {
          appSettings = appSettings.replace(RegularExpr.clientId, clientId);
        }
        if (clientSecret) {
          appSettings = appSettings.replace(RegularExpr.clientSecret, clientSecret);
        }
        if (oauthAuthority) {
          appSettings = appSettings.replace(RegularExpr.oauthAuthority, oauthAuthority);
        }
        if (applicationIdUri) {
          appSettings = appSettings.replace(RegularExpr.applicationIdUri, applicationIdUri);
        }
        if (initiateLoginEndpoint) {
          appSettings = appSettings.replace(
            RegularExpr.initiateLoginEndpoint,
            initiateLoginEndpoint
          );
        }
      }
      await fs.writeFile(appSettingsPath, appSettings, "utf-8");
    } catch (error) {
      throw new FileIOError(appSettingsPath);
    }
    return ResultFactory.Success();
  }

  // Overwrite below lifecycle for dotnet scenario
  public async updateArmTemplates(ctx: PluginContext): Promise<FxResult> {
    return ResultFactory.Success({} as ArmTemplateResult);
  }

  public async scaffold(context: PluginContext): Promise<FxResult> {
    return ResultFactory.Success();
  }

  public async preDeploy(ctx: PluginContext): Promise<FxResult> {
    return ResultFactory.Success();
  }

  public async deploy(ctx: PluginContext): Promise<FxResult> {
    return ResultFactory.Success();
  }
}
