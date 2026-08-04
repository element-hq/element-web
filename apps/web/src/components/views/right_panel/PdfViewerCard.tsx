/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX, useEffect, useMemo, useState } from "react";
import BaseCard from "./BaseCard";

import { _t } from "../../../languageHandler";
import { MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo";
import Spinner from "../elements/Spinner";
import ErrorIcon from "@vector-im/compound-design-tokens/assets/web/icons/error-solid";

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

    const [url, setUrl] = useState<string | null>(null);

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

    let card: JSX.Element;

    if (navigator.pdfViewerEnabled) {
        if (url === null)
            card = (
                <div className="mx_PdfViewerCard_Spinner">
                    <Spinner />
                </div>
            );
        else card = <iframe src={url} title={_t("right_panel|pdf_viewer|title")} sandbox=""></iframe>;
    } else {
        card = (
            <div className="mx_PdfViewerCard_Error">
                <ErrorIcon className="mx_PdfViewerCard_Error_Icon" />
                <div>{_t("right_panel|pdf_viewer|browser_not_supported")}</div>
            </div>
        );
    }

    return (
        <BaseCard
            header={_t("right_panel|pdf_viewer|title")}
            className="mx_PdfViewerCard"
            onClose={onClose}
            withoutScrollContainer
        >
            {card}
        </BaseCard>
    );
}
