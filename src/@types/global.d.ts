/*
Copyright 2020-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import "matrix-react-sdk/src/@types/global"; // load matrix-react-sdk's type extensions first
import type { Renderer } from "react-dom";
import type { logger } from "matrix-js-sdk/src/logger";

type ElectronChannel =
    | "app_onAction"
    | "before-quit"
    | "check_updates"
    | "install_update"
    | "ipcCall"
    | "ipcReply"
    | "loudNotification"
    | "preferences"
    | "seshat"
    | "seshatReply"
    | "setBadgeCount"
    | "update-downloaded"
    | "userDownloadCompleted"
    | "userDownloadAction"
    | "openDesktopCapturerSourcePicker"
    | "userAccessToken"
    | "serverSupportedVersions";

declare global {
    interface Window {
        mxSendRageshake: (text: string, withLogs?: boolean) => void;
        matrixLogger: typeof logger;
        matrixChat: ReturnType<Renderer>;

        // electron-only
        electron?: Electron;

        // opera-only
        opera?: any;

        // https://developer.mozilla.org/en-US/docs/Web/API/InstallTrigger
        InstallTrigger: any;
    }

    interface Electron {
        on(channel: ElectronChannel, listener: (event: Event, ...args: any[]) => void): void;
        send(channel: ElectronChannel, ...args: any[]): void;
    }
}

// add method which is missing from the node typing
declare module "url" {
    interface Url {
        format(): string;
    }
}
