// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  InputsWithProjectPath,
  err,
  Platform,
  ProjectSettingsV3,
  TeamsAppManifest,
  UserError,
} from "@microsoft/teamsfx-api";
import { assert } from "chai";
import "mocha";
import { createSandbox } from "sinon";
import * as utils from "../../../src/component/utils";
import { setTools } from "../../../src/core/globalVars";
import { MockTools, randomAppName } from "../../core/utils";
import "../../../src/component/core";
import { canAddSso } from "../../../src/component/feature/sso";
import path from "path";
import Container from "typedi";
import { ComponentNames } from "../../../src/component/constants";
import * as os from "os";
import * as telemetry from "../../../src/core/telemetry";

describe("SSO can add in project", () => {
  const sandbox = createSandbox();
  const tools = new MockTools();
  setTools(tools);
  const appName = `unittest${randomAppName()}`;
  const context = utils.createContextV3();
  const basicProjectSetting: ProjectSettingsV3 = {
    appName: "",
    projectId: "",
    programmingLanguage: "typescript",
    components: [],
  };
  context.projectSetting = basicProjectSetting;
  beforeEach(() => {});

  afterEach(() => {
    sandbox.restore();
  });

  it("should AddSso in tab-sso project without sso component", async () => {
    const projectSetting: ProjectSettingsV3 = {
      ...basicProjectSetting,
      components: [
        {
          name: "teams-tab",
          hosting: "azure-storage",
          deploy: true,
          provision: true,
          build: true,
          folder: "tabs",
          sso: true,
        },
      ],
    };
    const res = await canAddSso(projectSetting);
    assert.isTrue(res);
  });

  it("shouldn't AddSso in tab-sso project with sso", async () => {
    const projectSetting: ProjectSettingsV3 = {
      ...basicProjectSetting,
      components: [
        {
          name: "teams-tab",
          hosting: "azure-storage",
          deploy: true,
          provision: true,
          build: true,
          folder: "tabs",
          sso: true,
        },
        {
          name: "aad-app",
          provision: true,
          deploy: true,
        },
      ],
    };
    const res = await canAddSso(projectSetting);
    assert.isFalse(res);
  });

  it("shouldn't AddSso in me project", async () => {
    const projectSetting: ProjectSettingsV3 = {
      ...basicProjectSetting,
      components: [
        {
          name: "teams-bot",
          hosting: "azure-web-app",
          deploy: true,
          capabilities: ["message-extension"],
          build: true,
          folder: "bot",
        },
        {
          name: "aad-app",
          provision: true,
          deploy: true,
        },
      ],
    };
    const res = await canAddSso(projectSetting);
    assert.isFalse(res);
  });

  it("shouldn't AddSso in bot project with function", async () => {
    const projectSetting: ProjectSettingsV3 = {
      ...basicProjectSetting,
      components: [
        {
          name: "teams-bot",
          hosting: "azure-function",
          deploy: true,
          capabilities: ["message-extension"],
          build: true,
          folder: "bot",
        },
        {
          name: "aad-app",
          provision: true,
          deploy: true,
        },
      ],
    };
    const res = await canAddSso(projectSetting);
    assert.isFalse(res);
  });
});

describe("SSO feature", () => {
  const sandbox = createSandbox();
  const tools = new MockTools();
  setTools(tools);
  const appName = `unittest${randomAppName()}`;
  const projectPath = path.join(os.homedir(), "TeamsApps", appName);
  const context = utils.createContextV3();
  const projectSetting: ProjectSettingsV3 = {
    appName: "",
    projectId: "",
    programmingLanguage: "typescript",
    components: [
      {
        name: "teams-tab",
        hosting: "azure-storage",
        deploy: true,
        provision: true,
        build: true,
        folder: "tabs",
      },
    ],
  };
  context.projectSetting = projectSetting;
  const manifest = {} as TeamsAppManifest;
  beforeEach(() => {
    sandbox.stub(telemetry, "sendErrorTelemetryThenReturnError").returns(
      new UserError({
        name: "mock error",
        message: "mock error message",
        displayMessage: "error message",
        source: "mocked source",
      })
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("add sso with generateManifest failed", async () => {
    const aadComponent = Container.get(ComponentNames.AadApp) as any;
    sandbox.stub(aadComponent, "generateManifest").resolves(err(undefined));

    const inputs: InputsWithProjectPath = {
      projectPath: projectPath,
      platform: Platform.VSCode,
      language: "typescript",
      "app-name": appName,
    };

    const component = Container.get(ComponentNames.SSO) as any;
    const ssoRes = await component.add(context, inputs);
    assert.isTrue(ssoRes.isErr());
  });

  it("add sso with generateBicep failed", async () => {
    const aadComponent = Container.get(ComponentNames.AadApp) as any;
    sandbox.stub(aadComponent, "generateBicep").resolves(err(undefined));

    const inputs: InputsWithProjectPath = {
      projectPath: projectPath,
      platform: Platform.VSCode,
      language: "typescript",
      "app-name": appName,
    };

    const component = Container.get(ComponentNames.SSO) as any;
    const ssoRes = await component.add(context, inputs);
    assert.isTrue(ssoRes.isErr());
  });

  it("add sso with generateAuthFiles failed", async () => {
    const aadComponent = Container.get(ComponentNames.AadApp) as any;
    sandbox.stub(aadComponent, "generateAuthFiles").resolves(err(undefined));

    const inputs: InputsWithProjectPath = {
      projectPath: projectPath,
      platform: Platform.VSCode,
      language: "typescript",
      "app-name": appName,
    };

    const component = Container.get(ComponentNames.SSO) as any;
    const ssoRes = await component.add(context, inputs);
    assert.isTrue(ssoRes.isErr());
  });

  it("add sso with generateAuthFiles failed", async () => {
    const aadComponent = Container.get(ComponentNames.AadApp) as any;
    sandbox.stub(aadComponent, "generateAuthFiles").resolves(err(undefined));

    const inputs: InputsWithProjectPath = {
      projectPath: projectPath,
      platform: Platform.VSCode,
      language: "typescript",
      "app-name": appName,
    };

    const component = Container.get(ComponentNames.SSO) as any;
    const ssoRes = await component.add(context, inputs);
    assert.isTrue(ssoRes.isErr());
  });

  it("add sso with appManifest failed", async () => {
    const appManifestComponent = Container.get(ComponentNames.AppManifest) as any;
    sandbox.stub(appManifestComponent, "addCapability").resolves(err(undefined));

    const inputs: InputsWithProjectPath = {
      projectPath: projectPath,
      platform: Platform.VSCode,
      language: "typescript",
      "app-name": appName,
    };

    const component = Container.get(ComponentNames.SSO) as any;
    const ssoRes = await component.add(context, inputs);
    assert.isTrue(ssoRes.isErr());
  });
});
