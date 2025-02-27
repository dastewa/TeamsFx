// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as chai from "chai";
import { Context } from "@microsoft/teamsfx-api/build/v2";
import { Inputs } from "@microsoft/teamsfx-api";
import { newInputV2, newPluginContextV2 } from "../utils";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {
  AzureSolutionQuestionNames,
  BotOptionItem,
  CommandAndResponseOptionItem,
  M365SearchAppOptionItem,
  MessageExtensionNewUIItem,
  NotificationOptionItem,
  WorkflowOptionItem,
} from "../../../../../../src";
import {
  QuestionNames,
  TemplateProjectsScenarios,
} from "../../../../../../src/plugins/resource/bot/constants";
import {
  AppServiceOptionItem,
  AppServiceOptionItemForVS,
  FunctionsHttpTriggerOptionItem,
  FunctionsTimerTriggerOptionItem,
  FunctionsHttpAndTimerTriggerOptionItem,
} from "../../../../../../src/plugins/resource/bot/question";
import { fillInSolutionSettings } from "../../../../../../src/plugins/solution/fx-solution/v2/utils";
import {
  decideTemplateScenarios,
  resolveBotCapabilities,
} from "../../../../../../src/plugins/resource/bot/v2/common";
import { BotCapabilities } from "../../../../../../src/plugins/resource/bot/resources/strings";

const fs = require("fs-extra");

describe("Bot Plugin v2", () => {
  let context: Context;
  let inputs: Inputs;

  describe("decide template scenario", () => {
    beforeEach(() => {
      context = newPluginContextV2();
      inputs = newInputV2();
      inputs[QuestionNames.BOT_HOST_TYPE_TRIGGER] = undefined;
      inputs[AzureSolutionQuestionNames.Scenarios] = undefined;
    });

    it("scenario for restify notification bot", async () => {
      inputs[AzureSolutionQuestionNames.Capabilities] = [NotificationOptionItem.id];
      inputs[QuestionNames.BOT_HOST_TYPE_TRIGGER] = AppServiceOptionItem.id;
      fillInSolutionSettings(context.projectSetting, inputs);
      const templateScenarios = decideTemplateScenarios(context, inputs);
      chai.assert.equal(templateScenarios.size, 1);
      chai.assert.isTrue(
        templateScenarios.has(TemplateProjectsScenarios.NOTIFICATION_RESTIFY_SCENARIO_NAME)
      );
    });

    it("scenario for webapi notification bot", async () => {
      inputs[AzureSolutionQuestionNames.Capabilities] = [NotificationOptionItem.id];
      inputs[QuestionNames.BOT_HOST_TYPE_TRIGGER] = AppServiceOptionItemForVS.id;
      fillInSolutionSettings(context.projectSetting, inputs);
      const templateScenarios = decideTemplateScenarios(context, inputs);
      chai.assert.equal(templateScenarios.size, 1);
      chai.assert.isTrue(
        templateScenarios.has(TemplateProjectsScenarios.NOTIFICATION_WEBAPI_SCENARIO_NAME)
      );
    });

    it("scenario for http-functions notification bot", async () => {
      inputs[AzureSolutionQuestionNames.Capabilities] = [NotificationOptionItem.id];
      inputs[QuestionNames.BOT_HOST_TYPE_TRIGGER] = FunctionsHttpTriggerOptionItem.id;
      fillInSolutionSettings(context.projectSetting, inputs);
      const templateScenarios = decideTemplateScenarios(context, inputs);
      chai.assert.equal(templateScenarios.size, 2);
      chai.assert.isTrue(
        templateScenarios.has(
          TemplateProjectsScenarios.NOTIFICATION_FUNCTION_TRIGGER_HTTP_SCENARIO_NAME
        )
      );
      chai.assert.isTrue(
        templateScenarios.has(TemplateProjectsScenarios.NOTIFICATION_FUNCTION_BASE_SCENARIO_NAME)
      );
    });

    it("scenario for timer-functions notification bot", async () => {
      inputs[AzureSolutionQuestionNames.Capabilities] = [NotificationOptionItem.id];
      inputs[QuestionNames.BOT_HOST_TYPE_TRIGGER] = FunctionsTimerTriggerOptionItem.id;
      fillInSolutionSettings(context.projectSetting, inputs);
      const templateScenarios = decideTemplateScenarios(context, inputs);
      chai.assert.equal(templateScenarios.size, 2);
      chai.assert.isTrue(
        templateScenarios.has(
          TemplateProjectsScenarios.NOTIFICATION_FUNCTION_TRIGGER_TIMER_SCENARIO_NAME
        )
      );
      chai.assert.isTrue(
        templateScenarios.has(TemplateProjectsScenarios.NOTIFICATION_FUNCTION_BASE_SCENARIO_NAME)
      );
    });

    it("scenario for http-functions and timer-functions notification bot", async () => {
      inputs[AzureSolutionQuestionNames.Capabilities] = [NotificationOptionItem.id];
      inputs[QuestionNames.BOT_HOST_TYPE_TRIGGER] = FunctionsHttpAndTimerTriggerOptionItem.id;
      fillInSolutionSettings(context.projectSetting, inputs);
      const templateScenarios = decideTemplateScenarios(context, inputs);
      chai.assert.equal(templateScenarios.size, 3);
      chai.assert.isTrue(
        templateScenarios.has(
          TemplateProjectsScenarios.NOTIFICATION_FUNCTION_TRIGGER_HTTP_SCENARIO_NAME
        )
      );
      chai.assert.isTrue(
        templateScenarios.has(
          TemplateProjectsScenarios.NOTIFICATION_FUNCTION_TRIGGER_TIMER_SCENARIO_NAME
        )
      );
      chai.assert.isTrue(
        templateScenarios.has(TemplateProjectsScenarios.NOTIFICATION_FUNCTION_BASE_SCENARIO_NAME)
      );
    });

    it("scenario for command and response bot", async () => {
      inputs[AzureSolutionQuestionNames.Capabilities] = [CommandAndResponseOptionItem.id];
      fillInSolutionSettings(context.projectSetting, inputs);
      const templateScenarios = decideTemplateScenarios(context, inputs);
      chai.assert.equal(templateScenarios.size, 1);
      chai.assert.isTrue(
        templateScenarios.has(TemplateProjectsScenarios.COMMAND_AND_RESPONSE_SCENARIO_NAME)
      );
    });

    it("scenario for workflow bot", async () => {
      inputs[AzureSolutionQuestionNames.Capabilities] = [WorkflowOptionItem.id];
      fillInSolutionSettings(context.projectSetting, inputs);
      const templateScenarios = decideTemplateScenarios(context, inputs);
      chai.assert.equal(templateScenarios.size, 1);
      chai.assert.isTrue(templateScenarios.has(TemplateProjectsScenarios.WORKFLOW_SCENARIO_NAME));
    });

    it("scenario for default bot", async () => {
      inputs[AzureSolutionQuestionNames.Capabilities] = [BotOptionItem.id];
      fillInSolutionSettings(context.projectSetting, inputs);
      const templateScenarios = decideTemplateScenarios(context, inputs);
      chai.assert.equal(templateScenarios.size, 1);
      chai.assert.isTrue(templateScenarios.has(TemplateProjectsScenarios.DEFAULT_SCENARIO_NAME));
    });

    it("scenario for message extension", async () => {
      inputs[AzureSolutionQuestionNames.Capabilities] = [MessageExtensionNewUIItem.id];
      fillInSolutionSettings(context.projectSetting, inputs);
      const templateScenarios = decideTemplateScenarios(context, inputs);
      chai.assert.equal(templateScenarios.size, 1);
      chai.assert.isTrue(templateScenarios.has(TemplateProjectsScenarios.DEFAULT_SCENARIO_NAME));
    });

    it("scenario for M365 search based message extension", async () => {
      inputs[AzureSolutionQuestionNames.Capabilities] = [M365SearchAppOptionItem.id];
      context.projectSetting.isM365 = true;
      inputs.isM365 = true;
      fillInSolutionSettings(context.projectSetting, inputs);
      const templateScenarios = decideTemplateScenarios(context, inputs);
      chai.assert.equal(templateScenarios.size, 1);
      chai.assert.isTrue(templateScenarios.has(TemplateProjectsScenarios.M365_SCENARIO_NAME));
    });
  });

  describe("resolve bot capabilities", () => {
    beforeEach(() => {
      context = newPluginContextV2();
      inputs = newInputV2();
      inputs[QuestionNames.BOT_HOST_TYPE_TRIGGER] = undefined;
      inputs[AzureSolutionQuestionNames.Scenarios] = undefined;
    });

    it("bot capabilities for restify notification bot", async () => {
      inputs[AzureSolutionQuestionNames.Capabilities] = [NotificationOptionItem.id];
      inputs[QuestionNames.BOT_HOST_TYPE_TRIGGER] = [AppServiceOptionItem.id];
      fillInSolutionSettings(context.projectSetting, inputs);
      const botCapabilities = resolveBotCapabilities(inputs);
      chai.assert.equal(botCapabilities.length, 1);
      chai.assert.isTrue(botCapabilities.includes(BotCapabilities.NOTIFICATION));
    });

    it("bot capabilities for command and response bot", async () => {
      inputs[AzureSolutionQuestionNames.Capabilities] = [CommandAndResponseOptionItem.id];
      fillInSolutionSettings(context.projectSetting, inputs);
      const botCapabilities = resolveBotCapabilities(inputs);
      chai.assert.equal(botCapabilities.length, 1);
      chai.assert.isTrue(botCapabilities.includes(BotCapabilities.COMMAND_AND_RESPONSE));
    });

    it("bot capabilities for workflow bot", async () => {
      inputs[AzureSolutionQuestionNames.Capabilities] = [WorkflowOptionItem.id];
      fillInSolutionSettings(context.projectSetting, inputs);
      const botCapabilities = resolveBotCapabilities(inputs);
      chai.assert.equal(botCapabilities.length, 1);
      chai.assert.isTrue(botCapabilities.includes(BotCapabilities.WORKFLOW));
    });

    it("bot capabilities for default bot", async () => {
      inputs[AzureSolutionQuestionNames.Capabilities] = [BotOptionItem.id];
      fillInSolutionSettings(context.projectSetting, inputs);
      const botCapabilities = resolveBotCapabilities(inputs);
      chai.assert.equal(botCapabilities.length, 1);
      chai.assert.isTrue(botCapabilities.includes(BotCapabilities.BOT));
    });

    it("bot capabilities for message extension", async () => {
      inputs[AzureSolutionQuestionNames.Capabilities] = [MessageExtensionNewUIItem.id];
      fillInSolutionSettings(context.projectSetting, inputs);
      const botCapabilities = resolveBotCapabilities(inputs);
      chai.assert.equal(botCapabilities.length, 1);
      chai.assert.isTrue(botCapabilities.includes(BotCapabilities.MESSAGE_EXTENSION));
    });

    it("bot capabilities for M365 search based message extension", async () => {
      inputs[AzureSolutionQuestionNames.Capabilities] = [M365SearchAppOptionItem.id];
      context.projectSetting.isM365 = true;
      inputs.isM365 = true;
      fillInSolutionSettings(context.projectSetting, inputs);
      const botCapabilities = resolveBotCapabilities(inputs);
      chai.assert.equal(botCapabilities.length, 1);
      chai.assert.isTrue(botCapabilities.includes(BotCapabilities.M365_SEARCH_APP));
    });
  });
});
