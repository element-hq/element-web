/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Watchable, type AccountDataApi as IAccountDataApi } from "@element-hq/element-web-module-api";
import { ClientEvent, type MatrixEvent, type MatrixClient } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../MatrixClientPeg";

export class AccountDataApi implements IAccountDataApi {
    public get(eventType: string): Watchable<unknown> {
        const cli = MatrixClientPeg.safeGet();
        return new AccountDataWatchable(cli, eventType);
    }

    public async set(eventType: string, content: any): Promise<void> {
        const cli = MatrixClientPeg.safeGet();
        //@ts-expect-error: JS-SDK accepts known event-types, intentionally allow arbitrary types.
        await cli.setAccountData(eventType, content);
    }

    public async delete(eventType: string): Promise<void> {
        const cli = MatrixClientPeg.safeGet();
        //@ts-expect-error: JS-SDK accepts known event-types, intentionally allow arbitrary types.
        await cli.deleteAccountData(eventType);
    }
}

class AccountDataWatchable extends Watchable<unknown> {
    public constructor(
        private cli: MatrixClient,
        private eventType: string,
    ) {
        //@ts-expect-error: JS-SDK accepts known event-types, intentionally allow arbitrary types.
        super(cli.getAccountData(eventType)?.getContent());
    }

    private onAccountData = (event: MatrixEvent): void => {
        if (event.getType() === this.eventType) {
            this.value = event.getContent();
        }
    };

    protected onFirstWatch(): void {
        this.cli.on(ClientEvent.AccountData, this.onAccountData);
    }

    protected onLastWatch(): void {
        this.cli.off(ClientEvent.AccountData, this.onAccountData);
    }
}
