/*
Copyright 2024-2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { AbstractStartedContainer, GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { MailpitClient } from "mailpit-api";

export type { MailpitClient };

/**
 * A testcontainer for Mailpit.
 *
 * Exposes port 8025.
 * Waits for listening ports.
 * Disables SMTP authentication.
 */
export class MailpitContainer extends GenericContainer {
    public constructor() {
        super("axllent/mailpit:latest");

        this.withExposedPorts(8025).withWaitStrategy(Wait.forListeningPorts()).withEnvironment({
            MP_SMTP_AUTH_ALLOW_INSECURE: "true",
            MP_SMTP_AUTH_ACCEPT_ANY: "true",
        });
    }

    /**
     * Start the Mailpit container.
     */
    public override async start(): Promise<StartedMailpitContainer> {
        return new StartedMailpitContainer(await super.start());
    }
}

/**
 * A started Mailpit container.
 */
export class StartedMailpitContainer extends AbstractStartedContainer {
    public readonly client: MailpitClient;

    public constructor(container: StartedTestContainer) {
        super(container);
        this.client = new MailpitClient(`http://${container.getHost()}:${container.getMappedPort(8025)}`);
    }

    /**
     * Get the hostname to use to connect to the Mailpit container from inside the docker network.
     */
    public get internalHost(): string {
        return "mailpit";
    }

    /**
     * Get the port to use to connect to the Mailpit container from inside the docker network.
     */
    public get internalSmtpPort(): number {
        return 1025;
    }
}
