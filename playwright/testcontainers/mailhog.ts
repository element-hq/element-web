/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { AbstractStartedContainer, GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import mailhog from "mailhog";

export class MailhogContainer extends GenericContainer {
    constructor() {
        super("mailhog/mailhog:latest");

        this.withExposedPorts(8025).withWaitStrategy(Wait.forListeningPorts());
    }

    public override async start(): Promise<StartedMailhogContainer> {
        return new StartedMailhogContainer(await super.start());
    }
}

export class StartedMailhogContainer extends AbstractStartedContainer {
    public readonly client: mailhog.API;

    constructor(container: StartedTestContainer) {
        super(container);
        this.client = mailhog({ host: container.getHost(), port: container.getMappedPort(8025) });
    }
}
