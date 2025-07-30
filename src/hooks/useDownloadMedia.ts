/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { parseErrorResponse } from "matrix-js-sdk/src/matrix";
import { useRef, useState, useMemo, useEffect } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import ErrorDialog from "../components/views/dialogs/ErrorDialog";
import { _t } from "../languageHandler";
import Modal from "../Modal";
import { FileDownloader } from "../utils/FileDownloader";
import { MediaEventHelper } from "../utils/MediaEventHelper";
import ModuleApi from "../modules/Api";

export interface UseDownloadMediaReturn {
    download: () => Promise<void>;
    loading: boolean;
    canDownload: boolean;
}

export function useDownloadMedia(url: string, fileName?: string, mxEvent?: MatrixEvent): UseDownloadMediaReturn {
    const downloader = useRef(new FileDownloader()).current;
    const blobRef = useRef<Blob>(null);
    const [loading, setLoading] = useState(false);
    const [canDownload, setCanDownload] = useState<boolean>(true);

    const mediaEventHelper = useMemo(() => (mxEvent ? new MediaEventHelper(mxEvent) : undefined), [mxEvent]);

    useEffect(() => {
        if (!mxEvent) return;

        const hints = ModuleApi.customComponents.getHintsForMessage(mxEvent);
        if (hints?.allowDownloadingMedia) {
            setCanDownload(false);
            hints
                .allowDownloadingMedia()
                .then(setCanDownload)
                .catch((err: any) => {
                    logger.error(`Failed to check media download permission for ${mxEvent.event.event_id}`, err);

                    setCanDownload(false);
                });
        } else {
            setCanDownload(true);
        }
    }, [mxEvent]);

    const download = async (): Promise<void> => {
        if (loading) return;
        try {
            setLoading(true);

            if (blobRef.current) {
                return downloadBlob(blobRef.current);
            }

            // We must download via the mediaEventHelper if given as the file may need decryption.
            if (mediaEventHelper) {
                blobRef.current = await mediaEventHelper.sourceBlob.value;
            } else {
                const res = await fetch(url);
                if (!res.ok) {
                    throw parseErrorResponse(res, await res.text());
                }

                blobRef.current = await res.blob();
            }

            await downloadBlob(blobRef.current);
        } catch (e) {
            showError(e);
        }
    };

    const downloadBlob = async (blob: Blob): Promise<void> => {
        await downloader.download({
            blob,
            name: mediaEventHelper?.fileName ?? fileName ?? _t("common|image"),
        });
        setLoading(false);
    };

    const showError = (e: unknown): void => {
        Modal.createDialog(ErrorDialog, {
            title: _t("timeline|download_failed"),
            description: `${_t("timeline|download_failed_description")}\n\n${String(e)}`,
        });
        setLoading(false);
    };

    return { download, loading, canDownload };
}
