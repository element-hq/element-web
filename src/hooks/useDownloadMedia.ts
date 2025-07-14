import { parseErrorResponse } from "matrix-js-sdk/src/http-api";
import { useRef, useState, useMemo, useEffect } from "react";
import ErrorDialog from "../components/views/dialogs/ErrorDialog";
import { _t } from "../languageHandler";
import Modal from "../Modal";
import { FileDownloader } from "../utils/FileDownloader";
import { MediaEventHelper } from "../utils/MediaEventHelper";
import ModuleApi from "../modules/Api";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { logger } from "matrix-js-sdk/src/logger";

export function useDownloadMedia(url: string, fileName?: string, mxEvent?: MatrixEvent) {
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
        }
    }, [mxEvent]);

    const download = async (): Promise<void> => {
        if (loading) return;
        try {
            setLoading(true);

            if (blobRef.current) {
                return downloadBlob(blobRef.current);
            }

            const res = await fetch(url);
            if (!res.ok) {
                throw parseErrorResponse(res, await res.text());
            }

            const blob = await res.blob();
            blobRef.current = blob;

            await downloadBlob(blob);
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
