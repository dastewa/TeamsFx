// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";

import { UserError, ok } from "@microsoft/teamsfx-api";
import fs from "fs-extra";
import * as path from "path";

import * as tools from "../../../src/common/tools";
import { LocalEnvManager } from "../../../src/common/local/localEnvManager";
import { DepsType } from "../../../src/common/deps-checker/depsChecker";
import sinon from "sinon";
import mockedEnv, { RestoreFn } from "mocked-env";
import { environmentManager } from "../../../src";

chai.use(chaiAsPromised);

describe("LocalEnvManager", () => {
  const projectSettings0 = {
    appName: "unit-test0",
    projectId: "11111111-1111-1111-1111-111111111111",
    version: "2.0.0",
    programmingLanguage: "javascript",
  };
  const localSettings0 = {
    teamsApp: {
      tenantId: "22222222-2222-2222-2222-222222222222",
      teamsAppId: "33333333-3333-3333-3333-333333333333",
    },
    auth: {
      clientId: "44444444-4444-4444-4444-444444444444",
      // encrypted text: "password-placeholder"
      clientSecret:
        "crypto_025d3c0a85c31e192ff0d8b8d0c9f44e3d5044fa95e642ce6c46d8ee5c4e2ad6b90c3ab385589e7c0d52862898efea47433586f4a14c9f899a7769b3ec73eff372161bbe4b98eb8ba928d58a4ad942bfc880585fe0de737c2f3e5d1a0509e844a4adaf55fa8dd0ecd1e6b3f52dc9812cf6bebb0e",
    },
    frontend: {
      tabDomain: "localhost",
      tabEndpoint: "https://localhost:53000",
    },
  };
  const projectPath = path.resolve(__dirname, "data");
  const configFolder = path.resolve(projectPath, ".fx/configs");
  const localEnvManager = new LocalEnvManager();

  beforeEach(() => {
    fs.ensureDirSync(path.resolve(__dirname, "data"));
  });

  describe("getProjectSettings()", () => {
    const sandbox = sinon.createSandbox();
    let files: Record<string, any> = {};

    beforeEach(() => {
      files = {};
      sandbox.restore();
      sandbox.stub(fs, "pathExists").callsFake(async (file: string) => {
        return Promise.resolve(files[path.resolve(file)] !== undefined);
      });
      sandbox.stub(fs, "writeFile").callsFake(async (file: fs.PathLike | number, data: any) => {
        files[path.resolve(file as string)] = data;
        return Promise.resolve();
      });
      sandbox.stub(fs, "readJson").callsFake(async (file: string) => {
        return Promise.resolve(JSON.parse(files[path.resolve(file)]));
      });
      sandbox.stub(tools, "waitSeconds").resolves();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("happy path", async () => {
      await fs.writeFile(
        path.resolve(configFolder, "projectSettings.json"),
        JSON.stringify(projectSettings0)
      );

      const projectSettings = await localEnvManager.getProjectSettings(projectPath);

      chai.assert.isDefined(projectSettings);
      chai.assert.equal(projectSettings.appName, "unit-test0");
      chai.assert.equal(projectSettings.projectId, "11111111-1111-1111-1111-111111111111");
      chai.assert.equal(projectSettings.version, "2.0.0");
      chai.assert.equal(projectSettings.programmingLanguage, "javascript");
    });

    it("missing field", async () => {
      await fs.writeFile(path.resolve(configFolder, "projectSettings.json"), "{}");

      const projectSettings = await localEnvManager.getProjectSettings(projectPath);

      chai.assert.isDefined(projectSettings);
      chai.assert.isUndefined(projectSettings.appName);
      chai.assert.isDefined(projectSettings.projectId);
    });

    it("missing file", async () => {
      let error: UserError | undefined = undefined;
      try {
        await localEnvManager.getProjectSettings(projectPath);
      } catch (e: any) {
        error = e as UserError;
      }

      chai.assert.isDefined(error);
      chai.assert.equal(error!.name, "FileNotFoundError");
    });
  });

  describe("getLocalSettings()", () => {
    const sandbox = sinon.createSandbox();
    let files: Record<string, any> = {};

    beforeEach(() => {
      files = {};
      sandbox.restore();
      sandbox.stub(fs, "pathExists").callsFake(async (file: string) => {
        return Promise.resolve(files[path.resolve(file)] !== undefined);
      });
      sandbox.stub(fs, "writeFile").callsFake(async (file: fs.PathLike | number, data: any) => {
        files[path.resolve(file as string)] = data;
        return Promise.resolve();
      });
      sandbox.stub(fs, "readJson").callsFake(async (file: string) => {
        return Promise.resolve(JSON.parse(files[path.resolve(file)]));
      });
      sandbox.stub(tools, "waitSeconds").resolves();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("happy path", async () => {
      await fs.writeFile(
        path.resolve(configFolder, "projectSettings.json"),
        JSON.stringify(projectSettings0)
      );
      await fs.writeFile(
        path.resolve(configFolder, "localSettings.json"),
        JSON.stringify(localSettings0)
      );

      const projectSettings = await localEnvManager.getProjectSettings(projectPath);
      const localSettings = await localEnvManager.getLocalSettings(projectPath, {
        projectId: projectSettings.projectId,
      });

      chai.assert.isDefined(localSettings);
      chai.assert.isDefined(localSettings!.teamsApp);
      chai.assert.equal(localSettings!.teamsApp.tenantId, "22222222-2222-2222-2222-222222222222");
      chai.assert.equal(localSettings!.teamsApp.teamsAppId, "33333333-3333-3333-3333-333333333333");
      chai.assert.isDefined(localSettings!.auth);
      chai.assert.equal(localSettings!.auth.clientId, "44444444-4444-4444-4444-444444444444");
      chai.assert.equal(localSettings!.auth.clientSecret, "password-placeholder");
      chai.assert.isDefined(localSettings!.frontend);
      chai.assert.equal(localSettings!.frontend.tabDomain, "localhost");
      chai.assert.equal(localSettings!.frontend.tabEndpoint, "https://localhost:53000");
    });

    it("missing field", async () => {
      await fs.writeFile(
        path.resolve(configFolder, "projectSettings.json"),
        JSON.stringify(projectSettings0)
      );
      await fs.writeFile(path.resolve(configFolder, "localSettings.json"), "{}");

      const projectSettings = await localEnvManager.getProjectSettings(projectPath);
      const localSettings = await localEnvManager.getLocalSettings(projectPath, {
        projectId: projectSettings.projectId,
      });

      chai.assert.isDefined(localSettings);
      chai.assert.isUndefined(localSettings!.teamsApp);
    });

    it("missing file", async () => {
      await fs.writeFile(
        path.resolve(configFolder, "projectSettings.json"),
        JSON.stringify(projectSettings0)
      );

      const projectSettings = await localEnvManager.getProjectSettings(projectPath);
      const localSettings = await localEnvManager.getLocalSettings(projectPath, {
        projectId: projectSettings.projectId,
      });

      chai.assert.isUndefined(localSettings);
    });
  });

  const testData: {
    message: string;
    solutionSettings: any;
    pluginSettings?: any;
    depsTypes: DepsType[];
  }[] = [
    {
      message: "tab",
      solutionSettings: {
        name: "fx-solution-azure",
        hostType: "Azure",
        capabilities: ["Tab"],
        activeResourcePlugins: ["fx-resource-simple-auth"],
      },
      depsTypes: [DepsType.AzureNode, DepsType.Dotnet],
    },
    {
      message: "tab without simple auth",
      solutionSettings: {
        name: "fx-solution-azure",
        hostType: "Azure",
        capabilities: ["Tab"],
      },
      depsTypes: [DepsType.AzureNode],
    },
    {
      message: "tab + function",
      solutionSettings: {
        name: "fx-solution-azure",
        hostType: "Azure",
        capabilities: ["Tab"],
        azureResources: ["function"],
        activeResourcePlugins: ["fx-resource-simple-auth"],
      },
      depsTypes: [DepsType.FunctionNode, DepsType.Dotnet, DepsType.FuncCoreTools],
    },
    {
      message: "bot",
      solutionSettings: {
        name: "fx-solution-azure",
        hostType: "Azure",
        capabilities: ["Bot"],
      },
      depsTypes: [DepsType.AzureNode, DepsType.Ngrok],
    },
    {
      message: "tab + bot",
      solutionSettings: {
        name: "fx-solution-azure",
        hostType: "Azure",
        capabilities: ["Tab", "Bot"],
        activeResourcePlugins: ["fx-resource-simple-auth"],
      },
      depsTypes: [DepsType.AzureNode, DepsType.Dotnet, DepsType.Ngrok],
    },
    {
      message: "tab + bot + function",
      solutionSettings: {
        name: "fx-solution-azure",
        hostType: "Azure",
        capabilities: ["Tab", "Bot", "MessagingExtension"],
        azureResources: ["function"],
        activeResourcePlugins: ["fx-resource-simple-auth"],
      },
      depsTypes: [DepsType.FunctionNode, DepsType.Dotnet, DepsType.Ngrok, DepsType.FuncCoreTools],
    },
    {
      message: "spfx",
      solutionSettings: {
        name: "fx-solution-azure",
        hostType: "SPFx",
      },
      depsTypes: [DepsType.SpfxNode],
    },
    {
      message: "azure functions hosted bot",
      solutionSettings: {
        name: "fx-solution-azure",
        hostType: "Azure",
        capabilities: ["Bot"],
      },
      pluginSettings: {
        "fx-resource-bot": {
          "host-type": "azure-functions",
        },
      },
      depsTypes: [DepsType.FunctionNode, DepsType.FuncCoreTools, DepsType.Ngrok],
    },
    {
      message: "app service hosted bot",
      solutionSettings: {
        name: "fx-solution-azure",
        hostType: "Azure",
        capabilities: ["Bot"],
      },
      pluginSettings: {
        "fx-resource-bot": {
          "host-type": "app-service",
        },
      },
      depsTypes: [DepsType.AzureNode, DepsType.Ngrok],
    },
  ];

  describe("getActiveDependencies()", () => {
    const sandbox = sinon.createSandbox();
    let mockedEnvRestore: RestoreFn;

    beforeEach(() => {
      sandbox.restore();
      mockedEnvRestore = mockedEnv({ TEAMSFX_APIV3: "false" });
    });

    afterEach(() => {
      sandbox.restore();
      mockedEnvRestore();
    });

    testData.forEach((data) => {
      it(data.message, async () => {
        const projectSettings = {
          appName: "",
          projectId: "",
          solutionSettings: data.solutionSettings,
          pluginSettings: data.pluginSettings,
        };
        const result = localEnvManager.getActiveDependencies(projectSettings);
        chai.assert.sameDeepMembers(data.depsTypes, result);
      });
    });
  });

  describe("getPortsFromProject()", () => {
    const sandbox = sinon.createSandbox();
    afterEach(() => {
      sandbox.restore();
    });
    it("tab + bot", async () => {
      const projectSettings = {
        appName: "",
        projectId: "",
        programmingLanguage: "javascript",
        solutionSettings: {
          name: "fx-solution-azure",
          hostType: "Azure",
          capabilities: ["Tab", "Bot"],
        },
      };

      const ports = await localEnvManager.getPortsFromProject(projectPath, projectSettings);
      chai.assert.sameMembers(
        ports,
        [53000, 3978, 9239],
        `Expected [53000, 3978, 9239], actual ${ports}`
      );
    });
  });

  describe("getLocalEnvInfo()", () => {
    const sandbox = sinon.createSandbox();
    let mockedEnvRestore: RestoreFn;

    beforeEach(() => {
      sandbox.restore();
      mockedEnvRestore = mockedEnv({ TEAMSFX_APIV3: "true" });
    });

    afterEach(() => {
      sandbox.restore();
      mockedEnvRestore();
    });

    it("getLocalEnvInfo() happy path", async () => {
      sandbox.stub(environmentManager, "loadEnvInfo").resolves(
        ok({
          envName: "local",
          config: {},
          state: { solution: { key: "value" } },
        })
      );
      const res = await localEnvManager.getLocalEnvInfo(projectPath, { projectId: "123" });
      chai.assert.isDefined(res);
      chai.assert.deepEqual(res, {
        envName: "local",
        config: {},
        state: { solution: { key: "value" } },
      });
    });
  });

  describe("getNgrokTunnelConfig()", () => {
    const sandbox = sinon.createSandbox();
    let files: Record<string, any> = {};

    beforeEach(() => {
      files = {};
      sandbox.restore();
      sandbox.stub(fs, "pathExists").callsFake(async (file: string) => {
        return Promise.resolve(files[path.resolve(file)] !== undefined);
      });
      sandbox.stub(fs, "writeFile").callsFake(async (file: fs.PathLike | number, data: any) => {
        files[path.resolve(file as string)] = data;
        return Promise.resolve();
      });
      sandbox.stub(fs, "readFile").callsFake(async (file: fs.PathLike | number, options?: any) => {
        return Promise.resolve(files[path.resolve(file as string)]);
      });
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("getNgrokTunnelConfig() happy path", async () => {
      const ngrokConfigFilePath = path.join(configFolder, "ngrok.yml");
      await fs.writeFile(ngrokConfigFilePath, "tunnels:\n  bot:\n     addr: 53000\n");
      const res = await localEnvManager.getNgrokTunnelConfig(ngrokConfigFilePath);
      chai.assert.sameDeepOrderedMembers([...res.entries()], [["bot", "53000"]]);
    });

    it("empty result", async () => {
      const ngrokConfigFilePath = path.join(configFolder, "ngrok.yml");
      await fs.writeFile(ngrokConfigFilePath, "");
      const res = await localEnvManager.getNgrokTunnelConfig(ngrokConfigFilePath);
      chai.assert.equal(res.size, 0);
    });

    it("error schema", async () => {
      const ngrokConfigFilePath = path.join(configFolder, "ngrok.yml");
      await fs.writeFile(ngrokConfigFilePath, "tunnels:\nbot\n-\n");
      await chai
        .expect(localEnvManager.getNgrokTunnelConfig(ngrokConfigFilePath))
        .to.be.rejectedWith();
    });
  });
});
