/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import React, { type ReactElement, useMemo } from "react";
import classNames from "classnames";
import { DownloadIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { type MediaEventHelper } from "../../../utils/MediaEventHelper";
import { RovingAccessibleButton } from "../../../accessibility/RovingTabIndex";
import Spinner from "../elements/Spinner";
import { _t } from "../../../languageHandler";
import { useDownloadMedia } from "../../../hooks/useDownloadMedia";

interface IProps {
    mxEvent: MatrixEvent;

    // XXX: It can take a cycle or two for the MessageActionBar to have all the props/setup
    // required to get us a MediaEventHelper, so we use a getter function instead to prod for
    // one.
    mediaEventHelperGet: () => MediaEventHelper | undefined;
}

function useButtonTitle(loading: boolean, isEncrypted: boolean): string {
    if (!loading) return _t("action|download");

    return isEncrypted ? _t("timeline|download_action_decrypting") : _t("timeline|download_action_downloading");
}

export default function DownloadActionButton({ mxEvent, mediaEventHelperGet }: IProps): ReactElement | null {
    const mediaEventHelper = useMemo(() => mediaEventHelperGet(), [mediaEventHelperGet]);
    const downloadUrl = mediaEventHelper?.media.srcHttp ?? "";
    const fileName = mediaEventHelper?.fileName;

    const { download, loading, canDownload } = useDownloadMedia(downloadUrl, fileName, mxEvent);

    const buttonTitle = useButtonTitle(loading, mediaEventHelper?.media.isEncrypted ?? false);

    if (!canDownload) return null;

    const spinner = loading ? <Spinner w={18} h={18} /> : undefined;
    const classes = classNames({
        mx_MessageActionBar_iconButton: true,
        mx_MessageActionBar_downloadButton: true,
        mx_MessageActionBar_downloadSpinnerButton: !!spinner,
    });

    return (
        <RovingAccessibleButton
            className={classes}
            title={buttonTitle}
            onClick={download}
            disabled={loading}
            placement="left"
        >
            <DownloadIcon />
            {spinner}
        </RovingAccessibleButton>
    );
}
