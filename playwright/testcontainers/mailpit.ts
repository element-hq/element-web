/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { AbstractStartedContainer, GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { MailpitClient } from "mailpit-api";

export class MailhogContainer extends GenericContainer {
    constructor() {
        super("axllent/mailpit:latest");

        this.withExposedPorts(8025).withWaitStrategy(Wait.forListeningPorts()).withEnvironment({
            MP_SMTP_AUTH_ALLOW_INSECURE: "true",
            MP_SMTP_AUTH_ACCEPT_ANY: "true",
        });
    }

    public override async start(): Promise<StartedMailhogContainer> {
        return new StartedMailhogContainer(await super.start());
    }
}

export class StartedMailhogContainer extends AbstractStartedContainer {
    public readonly client: MailpitClient;

    constructor(container: StartedTestContainer) {
        super(container);
        this.client = new MailpitClient(`http://${container.getHost()}:${container.getMappedPort(8025)}`);
    }
}
