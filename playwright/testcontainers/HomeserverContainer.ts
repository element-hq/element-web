/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type AbstractStartedContainer, type GenericContainer } from "testcontainers";
import { type APIRequestContext, type TestInfo } from "@playwright/test";

import { type HomeserverInstance } from "../plugins/homeserver";
import { type StartedMatrixAuthenticationServiceContainer } from "./mas.ts";

export interface HomeserverContainer<Config> extends GenericContainer {
    withConfigField(key: string, value: any): this;
    withConfig(config: Partial<Config>): this;
    withMatrixAuthenticationService(mas?: StartedMatrixAuthenticationServiceContainer): this;
    start(): Promise<StartedHomeserverContainer>;
}

export interface StartedHomeserverContainer extends AbstractStartedContainer, HomeserverInstance {
    setRequest(request: APIRequestContext): void;
    onTestFinished(testInfo: TestInfo): Promise<void>;
}
