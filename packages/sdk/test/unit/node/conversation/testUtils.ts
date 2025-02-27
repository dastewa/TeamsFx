// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { IAdaptiveCard } from "adaptivecards";
import { TurnContext } from "botbuilder-core";
import { Activity, InvokeResponse, StatusCodes } from "botframework-schema";
import {
  AdaptiveCardResponse,
  CommandMessage,
  InvokeResponseErrorCode,
  MessageResponse,
  NotificationTarget,
  NotificationTargetStorage,
  NotificationTargetType,
  TeamsFxAdaptiveCardActionHandler,
  TeamsFxBotCommandHandler,
  TriggerPatterns,
} from "../../../../src/conversation/interface";
import { InvokeResponseFactory } from "../../../../src/conversation/invokeResponseFactory";

export class TestStorage implements NotificationTargetStorage {
  public items: any = {};

  read(key: string): Promise<{ [key: string]: unknown } | undefined> {
    return new Promise((resolve) => resolve(this.items[key]));
  }

  list(): Promise<{ [key: string]: unknown }[]> {
    return new Promise((resolve) =>
      resolve(Object.entries(this.items).map((entry) => entry[1] as { [key: string]: unknown }))
    );
  }

  write(key: string, object: { [key: string]: unknown }): Promise<void> {
    return new Promise((resolve) => {
      this.items[key] = object;
      resolve();
    });
  }

  delete(key: string): Promise<void> {
    return new Promise((resolve) => {
      delete this.items[key];
      resolve();
    });
  }
}

export class TestTarget implements NotificationTarget {
  public content: any;
  public type?: NotificationTargetType | undefined;
  public sendMessage(text: string): Promise<MessageResponse> {
    return new Promise((resolve) => {
      this.content = text;
      resolve({});
    });
  }
  public sendAdaptiveCard(card: unknown): Promise<MessageResponse> {
    return new Promise((resolve) => {
      this.content = card;
      resolve({});
    });
  }
}

export class TestCommandHandler implements TeamsFxBotCommandHandler {
  public readonly triggerPatterns: TriggerPatterns;

  public isInvoked: boolean = false;
  public lastReceivedMessage: CommandMessage | undefined;

  constructor(patterns: TriggerPatterns) {
    this.triggerPatterns = patterns;
  }

  async handleCommandReceived(
    context: TurnContext,
    message: CommandMessage
  ): Promise<string | Partial<Activity> | void> {
    this.isInvoked = true;
    this.lastReceivedMessage = message;
    return "Sample command response";
  }
}

export class MockCardActionHandler implements TeamsFxAdaptiveCardActionHandler {
  isInvoked: boolean = false;
  triggerVerb: string;
  adaptiveCardResponse: AdaptiveCardResponse = AdaptiveCardResponse.ReplaceForInteractor;
  invokeResponse: InvokeResponse;
  actionData: any;

  constructor(verb: string, response?: string | IAdaptiveCard) {
    this.triggerVerb = verb;
    if (!response) {
      this.invokeResponse = InvokeResponseFactory.textMessage("Your response was sent to the app");
    } else if (typeof response === "string") {
      this.invokeResponse = InvokeResponseFactory.textMessage(response);
    } else {
      this.invokeResponse = InvokeResponseFactory.adaptiveCard(response);
    }
  }

  async handleActionInvoked(context: TurnContext, actionData: any): Promise<InvokeResponse> {
    this.isInvoked = true;
    this.actionData = actionData;
    return this.invokeResponse;
  }
}

export class MockCardActionHandlerWithErrorResponse implements TeamsFxAdaptiveCardActionHandler {
  isInvoked: boolean = false;
  triggerVerb: string;
  invokeResponse: InvokeResponse;
  actionData: any;

  constructor(verb: string, errorCode: InvokeResponseErrorCode, errorMessage: string) {
    this.triggerVerb = verb;
    this.invokeResponse = InvokeResponseFactory.errorResponse(errorCode, errorMessage);
  }

  async handleActionInvoked(context: TurnContext, actionData: any): Promise<InvokeResponse> {
    this.isInvoked = true;
    this.actionData = actionData;
    return this.invokeResponse;
  }
}

export class MockContext {
  private activity: any;
  constructor(text: string) {
    this.activity = {
      text: text,
      type: "message",
      recipient: {
        id: "1",
        name: "test-bot",
      },
    };
  }

  public sendActivity(activity: any): Promise<void> {
    return new Promise((resolve) => {
      resolve();
    });
  }
}

export class MockActionInvokeContext {
  private activity: any;
  content: any;

  constructor(verb: string, data?: any) {
    this.activity = {
      type: "invoke",
      name: "adaptiveCard/action",
      value: {
        action: {
          type: "Action.Execute",
          verb: verb,
          data: data,
        },
      },
      trigger: "manual",
    };
  }

  public sendActivity(activity: any): Promise<void> {
    this.content = activity.value.body.value;
    return new Promise((resolve) => {
      resolve();
    });
  }
}
