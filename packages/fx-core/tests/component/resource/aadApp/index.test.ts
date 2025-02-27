// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { InputsWithProjectPath, Platform, ProjectSettingsV3 } from "@microsoft/teamsfx-api";
import { assert } from "chai";
import "mocha";
import { createSandbox } from "sinon";
import * as utils from "../../../../src/component/utils";
import { MockTools, randomAppName } from "../../../core/utils";
import "../../../../src/component/core";
import path from "path";
import * as os from "os";
import { convertContext } from "../../../../src/component/resource/aadApp/utils";
import { setTools } from "../../../../src/core/globalVars";
import { newEnvInfoV3 } from "../../../../src/core/environment";

describe("aadApp utils", () => {
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
  beforeEach(() => {
    context.envInfo = newEnvInfoV3();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("utils", () => {
    context.envInfo!.config = {
      auth: {
        frontendDomain: "xxx.com",
      },
    };
    const inputs: InputsWithProjectPath = {
      projectPath: projectPath,
      platform: Platform.VSCode,
      language: "typescript",
      "app-name": appName,
    };

    const res = convertContext(context, inputs);
    assert.isDefined(res.envInfo.config);
    assert.isDefined(res.envInfo.config.auth);
    assert.isDefined(res.root);
  });
});
