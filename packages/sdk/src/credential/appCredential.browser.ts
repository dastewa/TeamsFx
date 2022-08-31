// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AccessToken, TokenCredential, GetTokenOptions } from "@azure/identity";
import { AuthenticationConfiguration } from "../models/configuration";
import { formatString } from "../util/utils";
import { ErrorCode, ErrorMessage, ErrorWithCode } from "../core/errors";

/**
 * Represent Microsoft 365 tenant identity, and it is usually used when user is not involved.
 *
 * @remarks
 * Only works in in server side.
 */
export class AppCredential implements TokenCredential {
  /**
   * Constructor of AppCredential.
   *
   * @remarks
   * Only works in in server side.
   */
  constructor(authConfig: AuthenticationConfiguration) {
    throw new ErrorWithCode(
      formatString(ErrorMessage.BrowserRuntimeNotSupported, "AppCredential"),
      ErrorCode.RuntimeNotSupported
    );
  }

  /**
   * Get access token for credential.
   * @param {string | string[]} scopes - The list of scopes for which the token will have access.
   * @param {string[]} resources - An optional list of resource for which to acquire the access token; only used for full trust apps.
   * @remarks
   * Only works in in server side.
   */
  async getToken(
    scopes: string | string[],
    resources?: string[],
    options?: GetTokenOptions
  ): Promise<AccessToken | null> {
    throw new ErrorWithCode(
      formatString(ErrorMessage.BrowserRuntimeNotSupported, "AppCredential"),
      ErrorCode.RuntimeNotSupported
    );
  }
}
