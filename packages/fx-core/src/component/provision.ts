// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ResourceManagementClient } from "@azure/arm-resources";
import {
  AzureAccountProvider,
  EnvConfigFileNameTemplate,
  EnvNamePlaceholder,
  err,
  FxError,
  M365TokenProvider,
  ok,
  Platform,
  Result,
  SubscriptionInfo,
  SystemError,
  TokenProvider,
  UserError,
  v2,
  v3,
  Void,
} from "@microsoft/teamsfx-api";
import { snakeCase } from "lodash";
import { v4 as uuidv4 } from "uuid";
import { getDefaultString, getLocalizedString } from "../common/localizeUtils";
import { CustomizeResourceGroupType, TelemetryEvent, TelemetryProperty } from "../common/telemetry";
import { AppStudioScopes, getHashedEnv } from "../common/tools";
import { convertToAlphanumericOnly } from "../common/utils";
import {
  FillInAzureConfigsResult,
  ProvisionSubscriptionCheckResult,
} from "../plugins/solution/fx-solution/constants";
import {
  resourceGroupHelper,
  ResourceGroupInfo,
} from "../plugins/solution/fx-solution/utils/ResourceGroupHelper";
import { ComponentNames, V1PluginNames } from "./constants";

/**
 * make sure subscription is correct before provision
 *
 */
export async function checkProvisionSubscriptionWhenSwitchAccountEnabled(
  ctx: v2.Context,
  envInfo: v3.EnvInfoV3,
  azureAccountProvider: AzureAccountProvider
): Promise<Result<ProvisionSubscriptionCheckResult, FxError>> {
  const subscriptionIdInConfig: string | undefined = envInfo.config.azure?.subscriptionId;
  const subscriptionNameInConfig: string | undefined =
    envInfo.config.azure?.subscriptionName || subscriptionIdInConfig;
  const subscriptionIdInState: string | undefined = envInfo.state.solution.subscriptionId;
  const subscriptionNameInState: string | undefined =
    envInfo.state.solution.subscriptionName || subscriptionIdInState;

  const subscriptionInAccount = await azureAccountProvider.getSelectedSubscription(true);

  if (!subscriptionIdInState && !subscriptionIdInConfig) {
    if (!subscriptionInAccount) {
      return err(new UserError("core", "SubscriptionNotFound", "Failed to select subscription"));
    } else {
      updateEnvInfoSubscription(envInfo, subscriptionInAccount);
      ctx.logProvider.info(`[core] checkAzureSubscription pass!`);
      return ok({ hasSwitchedSubscription: false });
    }
  }

  // make sure the user is logged in
  await azureAccountProvider.getAccountCredentialAsync(true);
  // verify valid subscription (permission)
  const subscriptions = await azureAccountProvider.listSubscriptions();

  if (subscriptionIdInConfig) {
    const targetConfigSubInfo = subscriptions.find(
      (item) => item.subscriptionId === subscriptionIdInConfig
    );

    if (!targetConfigSubInfo) {
      return err(
        new UserError(
          "core",
          "SubscriptionNotFound",
          `The subscription '${subscriptionIdInConfig}'(${subscriptionNameInConfig}) for '${
            envInfo.envName
          }' environment is not found in the current account, please use the right Azure account or check the '${EnvConfigFileNameTemplate.replace(
            EnvNamePlaceholder,
            envInfo.envName
          )}' file.`
        )
      );
    } else {
      return compareWithStateSubscription(
        ctx,
        envInfo,
        targetConfigSubInfo,
        subscriptionIdInState,
        subscriptionNameInState,
        azureAccountProvider
      );
    }
  } else {
    const targetStateSubInfo = subscriptions.find(
      (item) => item.subscriptionId === subscriptionIdInState
    );

    if (!subscriptionInAccount) {
      if (targetStateSubInfo) {
        updateEnvInfoSubscription(envInfo, targetStateSubInfo);
        ctx.logProvider.info(`[core] checkAzureSubscription pass!`);
        return ok({ hasSwitchedSubscription: false });
      } else {
        return err(
          new UserError(
            "core",
            "SubscriptionNotFound",
            `The subscription '${subscriptionIdInState}'(${subscriptionNameInState}) for '${envInfo.envName}' environment is not found in the current account, please use the right Azure account.`
          )
        );
      }
    } else {
      return compareWithStateSubscription(
        ctx,
        envInfo,
        subscriptionInAccount,
        subscriptionIdInState,
        subscriptionNameInState,
        azureAccountProvider
      );
    }
  }
}

function updateEnvInfoSubscription(envInfo: v3.EnvInfoV3, subscriptionInfo: SubscriptionInfo) {
  envInfo.state.solution.subscriptionId = subscriptionInfo.subscriptionId;
  envInfo.state.solution.subscriptionName = subscriptionInfo.subscriptionName;
  envInfo.state.solution.tenantId = subscriptionInfo.tenantId;
}

async function compareWithStateSubscription(
  ctx: v2.Context,
  envInfo: v3.EnvInfoV3,
  targetSubscriptionInfo: SubscriptionInfo,
  subscriptionInStateId: string | undefined,
  subscriptionInStateName: string | undefined,
  azureAccountProvider: AzureAccountProvider
): Promise<Result<ProvisionSubscriptionCheckResult, FxError>> {
  const hasSwitchedSubscription =
    !!subscriptionInStateId && targetSubscriptionInfo.subscriptionId !== subscriptionInStateId;
  if (hasSwitchedSubscription) {
    updateEnvInfoSubscription(envInfo, targetSubscriptionInfo);
    clearEnvInfoStateResource(envInfo);

    ctx.logProvider.info(`[core] checkAzureSubscription pass!`);
    return ok({ hasSwitchedSubscription: true });
  } else {
    updateEnvInfoSubscription(envInfo, targetSubscriptionInfo);
    ctx.logProvider.info(`[core] checkAzureSubscription pass!`);
    return ok({ hasSwitchedSubscription: false });
  }
}

// clear resources related info in envInfo so that we could provision successfully using new sub.
function clearEnvInfoStateResource(envInfo: v3.EnvInfoV3): void {
  envInfo.state.solution.resourceGroupName = "";
  envInfo.state.solution.resourceNameSuffix = "";

  const keysToClear = [
    V1PluginNames.bot,
    V1PluginNames.frontend,
    V1PluginNames.function,
    V1PluginNames.identity,
    V1PluginNames.keyVault,
    V1PluginNames.sql,
    V1PluginNames.simpleAuth,
    ComponentNames.TeamsBot,
    ComponentNames.TeamsTab,
    ComponentNames.TeamsApi,
    ComponentNames.Identity,
    ComponentNames.KeyVault,
    ComponentNames.AzureSQL,
  ];

  const keysToModify = [V1PluginNames.apim, ComponentNames.APIM];
  const keys = Object.keys(envInfo.state);
  for (const key of keys) {
    if (keysToClear.includes(key)) {
      delete envInfo.state[key];
    }

    if (keysToModify.includes(key)) {
      delete envInfo.state[key]["serviceResourceId"];
    }
  }
}

/**
 * Asks common questions and puts the answers in the global namespace of SolutionConfig
 *
 */
export async function fillInAzureConfigs(
  ctx: v2.Context,
  inputs: v2.InputsWithProjectPath,
  envInfo: v3.EnvInfoV3,
  tokenProvider: TokenProvider
): Promise<Result<FillInAzureConfigsResult, FxError>> {
  //1. check subscriptionId
  ctx.telemetryReporter?.sendTelemetryEvent(
    TelemetryEvent.CheckSubscriptionStart,
    inputs.env ? { [TelemetryProperty.Env]: getHashedEnv(inputs.env) } : {}
  );

  const subscriptionResult = await checkProvisionSubscriptionWhenSwitchAccountEnabled(
    ctx,
    envInfo,
    tokenProvider.azureAccountProvider
  );

  if (subscriptionResult.isErr()) {
    return err(subscriptionResult.error);
  }

  ctx.telemetryReporter?.sendTelemetryEvent(TelemetryEvent.CheckSubscription, {
    [TelemetryProperty.Env]: !inputs.env ? "" : getHashedEnv(inputs.env),
    [TelemetryProperty.HasSwitchedSubscription]:
      subscriptionResult.value.hasSwitchedSubscription.toString(),
  });

  // Note setSubscription here will change the token returned by getAccountCredentialAsync according to the subscription selected.
  // So getting azureToken needs to precede setSubscription.
  const azureToken = await tokenProvider.azureAccountProvider.getAccountCredentialAsync();
  if (azureToken === undefined) {
    return err(
      new UserError("core", "NotLoginToAzure", "Login to Azure using the Azure Account extension")
    );
  }

  //2. check resource group
  ctx.telemetryReporter?.sendTelemetryEvent(
    TelemetryEvent.CheckResourceGroupStart,
    inputs.env ? { [TelemetryProperty.Env]: getHashedEnv(inputs.env) } : {}
  );

  const rmClient = new ResourceManagementClient(azureToken, envInfo.state.solution.subscriptionId);

  // Resource group info precedence are:
  //   0. ctx.answers, for VS targetResourceGroupName and targetResourceLocationName to create a new rg
  //   1. ctx.answers, for CLI --resource-group argument, only support existing resource group
  //   2. env config (config.{envName}.json), for user customization, only support existing resource group
  //   3. states (state.{envName}.json), for re-provision
  //   4. asking user with a popup
  const resourceGroupNameFromEnvConfig = envInfo.config.azure?.resourceGroupName;
  const resourceGroupNameFromState = envInfo.state.solution.resourceGroupName;
  const resourceGroupLocationFromState = envInfo.state.solution.location;
  const appName = convertToAlphanumericOnly(ctx.projectSetting.appName);
  const defaultResourceGroupName = `${snakeCase(appName)}${"-" + envInfo.envName}-rg`;
  let resourceGroupInfo: ResourceGroupInfo;
  const telemetryProperties: { [key: string]: string } = {};
  if (inputs.env) {
    telemetryProperties[TelemetryProperty.Env] = getHashedEnv(inputs.env);
  }

  if (inputs.targetResourceGroupName) {
    const getRes = await resourceGroupHelper.getResourceGroupInfo(
      inputs.targetResourceGroupName,
      rmClient
    );
    if (getRes.isErr()) {
      // support vs to create a new resource group
      if (inputs.platform === Platform.VS && inputs.targetResourceLocationName) {
        resourceGroupInfo = {
          createNewResourceGroup: true,
          name: inputs.targetResourceGroupName,
          location: inputs.targetResourceLocationName,
        };
      } else return err(getRes.error);
    } else {
      if (!getRes.value) {
        // Currently we do not support creating resource group from command line arguments
        return err(
          new UserError(
            "core",
            "ResourceGroupNotFound",
            `Resource group '${inputs.targetResourceGroupName}' does not exist, please specify an existing resource group.`
          )
        );
      }
      telemetryProperties[TelemetryProperty.CustomizeResourceGroupType] =
        CustomizeResourceGroupType.CommandLine;
      resourceGroupInfo = getRes.value;
    }
  } else if (resourceGroupNameFromEnvConfig) {
    const resourceGroupName = resourceGroupNameFromEnvConfig;
    const getRes = await resourceGroupHelper.getResourceGroupInfo(resourceGroupName, rmClient);
    if (getRes.isErr()) return err(getRes.error);
    if (!getRes.value) {
      // Currently we do not support creating resource group by input config, so just throw an error.
      const envFile = EnvConfigFileNameTemplate.replace(EnvNamePlaceholder, inputs.envName);
      return err(
        new UserError(
          "core",
          "ResourceGroupNotFound",
          `Resource group '${resourceGroupName}' does not exist, please check your '${envFile}' file.`
        )
      );
    }
    telemetryProperties[TelemetryProperty.CustomizeResourceGroupType] =
      CustomizeResourceGroupType.EnvConfig;
    resourceGroupInfo = getRes.value;
  } else if (resourceGroupNameFromState && resourceGroupLocationFromState) {
    const checkRes = await resourceGroupHelper.checkResourceGroupExistence(
      resourceGroupNameFromState,
      rmClient
    );
    if (checkRes.isErr()) {
      return err(checkRes.error);
    }
    const exist = checkRes.value;
    resourceGroupInfo = {
      createNewResourceGroup: !exist,
      name: resourceGroupNameFromState,
      location: resourceGroupLocationFromState,
    };
    telemetryProperties[TelemetryProperty.CustomizeResourceGroupType] =
      CustomizeResourceGroupType.EnvState;
  } else {
    const resourceGroupInfoResult = await resourceGroupHelper.askResourceGroupInfo(
      ctx,
      inputs,
      tokenProvider.azureAccountProvider,
      rmClient,
      defaultResourceGroupName
    );
    if (resourceGroupInfoResult.isErr()) {
      return err(resourceGroupInfoResult.error);
    }

    resourceGroupInfo = resourceGroupInfoResult.value;
    if (resourceGroupInfo.createNewResourceGroup) {
      if (resourceGroupInfo.name === defaultResourceGroupName) {
        telemetryProperties[TelemetryProperty.CustomizeResourceGroupType] =
          CustomizeResourceGroupType.InteractiveCreateDefault;
      } else {
        telemetryProperties[TelemetryProperty.CustomizeResourceGroupType] =
          CustomizeResourceGroupType.InteractiveCreateCustomized;
      }
    } else {
      telemetryProperties[TelemetryProperty.CustomizeResourceGroupType] =
        CustomizeResourceGroupType.InteractiveUseExisting;
    }
  }

  ctx.telemetryReporter?.sendTelemetryEvent(TelemetryEvent.CheckResourceGroup, telemetryProperties);

  envInfo.state.solution.needCreateResourceGroup = resourceGroupInfo.createNewResourceGroup;
  envInfo.state.solution.resourceGroupName = resourceGroupInfo.name;
  envInfo.state.solution.location = resourceGroupInfo.location;
  ctx.logProvider?.info(`[core] check resource group pass!`);
  ctx.logProvider?.info(`[core] check teamsAppTenantId pass!`);

  //resourceNameSuffix
  const resourceNameSuffix =
    (envInfo.config.azure?.resourceNameSuffix as string) ||
    envInfo.state.solution.resourceNameSuffix ||
    uuidv4().substr(0, 6);
  envInfo.state.solution.resourceNameSuffix = resourceNameSuffix;
  ctx.logProvider?.info(`[core] check resourceNameSuffix pass!`);
  return ok({ hasSwitchedSubscription: subscriptionResult.value.hasSwitchedSubscription });
}

export async function askForDeployConsent(
  ctx: v2.Context,
  azureAccountProvider: AzureAccountProvider,
  envInfo: v3.EnvInfoV3
): Promise<Result<Void, FxError>> {
  const azureToken = await azureAccountProvider.getAccountCredentialAsync();

  // Only Azure project requires this confirm dialog
  const username = (azureToken as any).username || "";
  const subscriptionId = envInfo.state.solution?.subscriptionId || "";
  const subscriptionName = envInfo.state.solution?.subscriptionName || "";
  const msg = getLocalizedString(
    "core.deploy.confirmEnvNotice",
    envInfo.envName,
    username,
    subscriptionName ? subscriptionName : subscriptionId
  );
  const deployOption = "Deploy";
  const result = await ctx.userInteraction.showMessage("warn", msg, true, deployOption);
  const choice = result?.isOk() ? result.value : undefined;

  if (choice === deployOption) {
    return ok(Void);
  }
  return err(new UserError("core", "UserCancel", "UserCancel"));
}

export async function askForProvisionConsent(
  ctx: v2.Context,
  azureAccountProvider: AzureAccountProvider,
  envInfo: v3.EnvInfoV3
): Promise<Result<Void, FxError>> {
  const azureToken = await azureAccountProvider.getAccountCredentialAsync();

  // Only Azure project requires this confirm dialog
  const username = (azureToken as any).username || "";
  const subscriptionId = envInfo.state.solution?.subscriptionId || "";
  const subscriptionName = envInfo.state.solution?.subscriptionName || "";
  const msgNew = getLocalizedString(
    "core.provision.confirmEnvNotice",
    envInfo.envName,
    username,
    subscriptionName ? subscriptionName : subscriptionId
  );
  const confirmRes = await ctx.userInteraction.showMessage("warn", msgNew, true, "Provision");
  const confirm = confirmRes?.isOk() ? confirmRes.value : undefined;

  if (confirm !== "Provision") {
    if (confirm === "Pricing calculator") {
      ctx.userInteraction.openUrl("https://azure.microsoft.com/en-us/pricing/calculator/");
    }
    return err(new UserError("core", "CancelProvision", "CancelProvision"));
  }
  return ok(Void);
}
interface M365TenantRes {
  tenantIdInToken: string;
  tenantUserName: string;
}

export async function getM365TenantId(
  m365TokenProvider: M365TokenProvider
): Promise<Result<M365TenantRes, FxError>> {
  // Just to trigger M365 login before the concurrent execution of localDebug.
  // Because concurrent execution of localDebug may getAccessToken() concurrently, which
  // causes 2 M365 logins before the token caching in common lib takes effect.
  const appStudioTokenRes = await m365TokenProvider.getAccessToken({ scopes: AppStudioScopes });
  if (appStudioTokenRes.isErr()) {
    return err(appStudioTokenRes.error);
  }
  const appStudioTokenJsonRes = await m365TokenProvider.getJsonObject({ scopes: AppStudioScopes });
  const appStudioTokenJson = appStudioTokenJsonRes.isOk() ? appStudioTokenJsonRes.value : undefined;
  if (appStudioTokenJson === undefined) {
    return err(
      new SystemError(
        "core",
        "NoAppStudioToken",
        getDefaultString("error.NoAppStudioToken"),
        getLocalizedString("error.NoAppStudioToken")
      )
    );
  }
  const tenantIdInToken = (appStudioTokenJson as any).tid;
  const tenantUserName = (appStudioTokenJson as any).upn;
  if (!tenantIdInToken || !(typeof tenantIdInToken === "string")) {
    return err(
      new SystemError(
        "core",
        "NoTeamsAppTenantId",
        getDefaultString("error.NoTeamsAppTenantId"),
        getLocalizedString("error.NoTeamsAppTenantId")
      )
    );
  }
  return ok({ tenantIdInToken, tenantUserName });
}
