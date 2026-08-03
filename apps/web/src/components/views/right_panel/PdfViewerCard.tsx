import React, { JSX, useEffect, useMemo, useState } from "react";
import BaseCard from "./BaseCard";

import { _t } from "../../../languageHandler";
import { MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo";
import Spinner from "../elements/Spinner";

interface Props {
    eventId: string;
    onClose: () => void;
    room: Room;
}

export function PdfViewerCard({ eventId, onClose, room }: Props): JSX.Element | null {
    const mxEvent = useAsyncMemo(async () => {
        const client = room.client;
        const event = new MatrixEvent(await client.fetchRoomEvent(room.roomId, eventId));
        await client.decryptEventIfNeeded(event, { emit: false });
        return event;
    }, [room, eventId]);

    const helper = useMemo(
        () => (mxEvent && MediaEventHelper.isEligible(mxEvent) ? new MediaEventHelper(mxEvent) : undefined),
        [mxEvent],
    );

    useEffect(() => () => helper && helper.destroy());

    let [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (helper === undefined) return setUrl(null);

        let cancelled = false;
        let objectUrl: string;

        helper.sourceBlob.value.then((blob) => {
            if (cancelled) {
                return;
            }

            objectUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
            setUrl(objectUrl);
        });

        return () => {
            cancelled = true;
            URL.revokeObjectURL(objectUrl);
        };
    }, [helper]);

    return (
        <BaseCard
            header={_t("right_panel|pdf_viewer_title")}
            className="mx_PdfViewerCard"
            onClose={onClose}
            withoutScrollContainer
        >
            {url === null ? (
                <div className="mx_PdfViewerCard_Spinner">
                    <Spinner />
                </div>
            ) : (
                <iframe src={url}></iframe>
            )}
        </BaseCard>
    );
}
