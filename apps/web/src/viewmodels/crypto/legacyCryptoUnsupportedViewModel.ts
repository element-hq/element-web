/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE in the repository root for full details.
 */

import {
    BaseViewModel,
    type LegacyCryptoUnsupportedViewSnapshot,
    type LegacyCryptoUnsupportedViewModel as LegacyCryptoUnsupportedViewModelInterface,
} from "@element-hq/web-shared-components";

import SdkConfig from "../../SdkConfig";
import type { MatrixDispatcher } from "../../dispatcher/dispatcher";

/**
 * The last release that could still migrate a libolm crypto store. Users on an older session must
 * downgrade to this version to migrate, or remove the device and sign in again.
 */
export const LAST_LEGACY_CRYPTO_VERSION = "v1.12.30";

interface LegacyCryptoUnsupportedViewModelProps {
    /**
     * Dispatcher used to trigger the sign out.
     */
    dispatcher: MatrixDispatcher;
}

/**
 * ViewModel for the screen shown when the session's crypto store predates the current crypto stack
 * and cannot be migrated. The only action offered is signing out.
 */
export class LegacyCryptoUnsupportedViewModel
    extends BaseViewModel<LegacyCryptoUnsupportedViewSnapshot, LegacyCryptoUnsupportedViewModelProps>
    implements LegacyCryptoUnsupportedViewModelInterface
{
    public constructor(props: LegacyCryptoUnsupportedViewModelProps) {
        super(props, {
            brand: SdkConfig.get().brand,
            version: LAST_LEGACY_CRYPTO_VERSION,
        });
    }

    /**
     * Signs the user out. The crypto store cannot be migrated, so removing the device is the only way forward.
     */
    public onSignOutClick = (): void => {
        this.props.dispatcher.dispatch({ action: "logout" });
    };
}
