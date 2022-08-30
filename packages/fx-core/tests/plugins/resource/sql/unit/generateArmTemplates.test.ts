import "mocha";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { TestHelper } from "../helper";
import { SqlPlugin } from "../../../../../src/plugins/resource/sql";
import * as dotenv from "dotenv";
import { AzureSolutionSettings, Inputs, Platform, PluginContext } from "@microsoft/teamsfx-api";
import * as faker from "faker";
import * as sinon from "sinon";
import fs from "fs-extra";
import * as path from "path";
import {
  ConstantString,
  mockSolutionGenerateArmTemplates,
  mockSolutionUpdateArmTemplates,
  ResourcePlugins,
} from "../../util";
import {
  HostTypeOptionAzure,
  TabOptionItem,
} from "../../../../../src/plugins/solution/fx-solution/question";
import * as tools from "../../../../../src/common/tools";

chai.use(chaiAsPromised);

dotenv.config();

describe("generateArmTemplates", () => {
  let sqlPlugin: SqlPlugin;
  let pluginContext: PluginContext;

  before(async () => {});

  beforeEach(async () => {
    sqlPlugin = new SqlPlugin();
    pluginContext = await TestHelper.pluginContext();
  });

  afterEach(() => {
    sinon.restore();
  });

  it("generate arm templates", async function () {
    const activeResourcePlugins = [ResourcePlugins.AzureSQL];
    pluginContext.projectSettings!.solutionSettings = {
      name: "test_solution",
      version: "1.0.0",
      hostType: HostTypeOptionAzure.id,
      activeResourcePlugins: activeResourcePlugins,
    } as AzureSolutionSettings;
    const result = await sqlPlugin.generateArmTemplates(pluginContext);

    // Assert
    const testModuleFileName = "sqlProvision.result.bicep";
    const mockedSolutionDataContext = {
      Plugins: {
        "fx-resource-azure-sql": {
          Provision: {
            azureSql: {
              path: `./${testModuleFileName}`,
            },
          },
        },
      },
    };
    chai.assert.isTrue(result.isOk());
    if (result.isOk()) {
      const expectedResult = mockSolutionGenerateArmTemplates(
        mockedSolutionDataContext,
        result.value
      );

      const expectedBicepFileDirectory = path.join(__dirname, "expectedBicepFiles");
      const expectedModuleFilePath = path.join(expectedBicepFileDirectory, testModuleFileName);
      const moduleFile = await fs.readFile(expectedModuleFilePath, ConstantString.UTF8Encoding);

      chai.assert.strictEqual(expectedResult.Provision!.Modules!.azureSql, moduleFile);
      const expectedModuleSnippetFilePath = path.join(
        expectedBicepFileDirectory,
        "provision.result.bicep"
      );
      const OrchestrationProvisionFile = await fs.readFile(
        expectedModuleSnippetFilePath,
        ConstantString.UTF8Encoding
      );
      chai.assert.strictEqual(expectedResult.Provision!.Orchestration, OrchestrationProvisionFile);
      chai.assert.isNotNull(expectedResult.Reference);
      chai.assert.strictEqual(
        JSON.stringify(expectedResult.Parameters, undefined, 2),
        fs.readFileSync(
          path.join(expectedBicepFileDirectory, "parameters.json"),
          ConstantString.UTF8Encoding
        )
      );
    }
  });

  it("Update arm templates", async function () {
    const activeResourcePlugins = [ResourcePlugins.AzureSQL];
    pluginContext.projectSettings!.solutionSettings = {
      hostType: HostTypeOptionAzure.id,
      name: "test_solution",
      version: "1.0.0",
      activeResourcePlugins: activeResourcePlugins,
    } as AzureSolutionSettings;
    const result = await sqlPlugin.updateArmTemplates(pluginContext);

    chai.assert.isTrue(result.isOk());
    if (result.isOk()) {
      chai.assert.strictEqual(
        result.value.Reference!.sqlResourceId,
        "provisionOutputs.azureSqlOutput.value.sqlResourceId"
      );
      chai.assert.strictEqual(
        result.value.Reference!.sqlEndpoint,
        "provisionOutputs.azureSqlOutput.value.sqlEndpoint"
      );
      chai.assert.strictEqual(
        result.value.Reference!.databaseName,
        "provisionOutputs.azureSqlOutput.value.databaseName"
      );
      chai.assert.notExists(result.value.Provision);
      chai.assert.notExists(result.value.Configuration);
      chai.assert.notExists(result.value.Parameters);
    }
  });

  it("generate multiple database templates", async function () {
    sinon.stub(tools, "getUuid").returns("00000000-0000-0000-0000-000000000000");

    const activeResourcePlugins = [ResourcePlugins.AzureSQL];
    pluginContext.projectSettings!.solutionSettings = {
      name: "test_solution",
      version: "1.0.0",
      hostType: HostTypeOptionAzure.id,
      activeResourcePlugins: activeResourcePlugins,
    } as AzureSolutionSettings;
    pluginContext.answers = { existingResources: [ResourcePlugins.AzureSQL] } as Inputs;
    const result = await sqlPlugin.generateArmTemplates(pluginContext);

    // Assert
    const testModuleFileName = "newDatabase.orchestration.result.bicep";
    const mockedSolutionDataContext = {
      Plugins: {
        "fx-resource-azure-sql": {
          Provision: {
            azureSql: {
              path: `./${testModuleFileName}`,
            },
          },
        },
      },
    };
    chai.assert.isTrue(result.isOk());
    if (result.isOk()) {
      const expectedResult = mockSolutionGenerateArmTemplates(
        mockedSolutionDataContext,
        result.value
      );

      const expectedBicepFileDirectory = path.join(__dirname, "expectedBicepFiles");
      const expectedModuleFilePath = path.join(expectedBicepFileDirectory, testModuleFileName);
      const moduleFile = await fs.readFile(expectedModuleFilePath, ConstantString.UTF8Encoding);

      chai.assert.strictEqual(expectedResult.Provision!.Modules!.azureSql, moduleFile);
      const expectedModuleSnippetFilePath = path.join(
        expectedBicepFileDirectory,
        "newDatabaseProvision.result.bicep"
      );
      const OrchestrationProvisionFile = await fs.readFile(
        expectedModuleSnippetFilePath,
        ConstantString.UTF8Encoding
      );
      chai.assert.strictEqual(expectedResult.Provision!.Orchestration, OrchestrationProvisionFile);
      chai.assert.isNotNull(expectedResult.Reference);
    }
  });
});
