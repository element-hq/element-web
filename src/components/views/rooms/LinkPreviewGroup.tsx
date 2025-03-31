/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useContext } from "react";
import { type MatrixEvent, MatrixError, type IPreviewUrlResponse, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import CloseIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";

import { useStateToggle } from "../../../hooks/useStateToggle";
import LinkPreviewWidget from "./LinkPreviewWidget";
import AccessibleButton from "../elements/AccessibleButton";
import { _t } from "../../../languageHandler";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo";

const INITIAL_NUM_PREVIEWS = 2;

interface IProps {
    links: string[]; // the URLs to be previewed
    mxEvent: MatrixEvent; // the Event associated with the preview
    onCancelClick(): void; // called when the preview's cancel ('hide') button is clicked
}

const LinkPreviewGroup: React.FC<IProps> = ({ links, mxEvent, onCancelClick }) => {
    const cli = useContext(MatrixClientContext);
    const [expanded, toggleExpanded] = useStateToggle();

    const ts = mxEvent.getTs();
    const previews = useAsyncMemo<[string, IPreviewUrlResponse][]>(
        async () => {
            return fetchPreviews(cli, links, ts);
        },
        [links, ts],
        [],
    );

    const showPreviews = expanded ? previews : previews.slice(0, INITIAL_NUM_PREVIEWS);

    let toggleButton: JSX.Element | undefined;
    if (previews.length > INITIAL_NUM_PREVIEWS) {
        toggleButton = (
            <AccessibleButton onClick={toggleExpanded}>
                {expanded
                    ? _t("action|collapse")
                    : _t("timeline|url_preview|show_n_more", { count: previews.length - showPreviews.length })}
            </AccessibleButton>
        );
    }

    return (
        <div className="mx_LinkPreviewGroup">
            {showPreviews.map(([link, preview], i) => (
                <LinkPreviewWidget key={link} link={link} preview={preview} mxEvent={mxEvent}>
                    {i === 0 ? (
                        <AccessibleButton
                            className="mx_LinkPreviewGroup_hide"
                            onClick={onCancelClick}
                            aria-label={_t("timeline|url_preview|close")}
                        >
                            <CloseIcon width="20px" height="20px" />
                        </AccessibleButton>
                    ) : undefined}
                </LinkPreviewWidget>
            ))}
            {toggleButton}
        </div>
    );
};

const fetchPreviews = (cli: MatrixClient, links: string[], ts: number): Promise<[string, IPreviewUrlResponse][]> => {
    return Promise.all<[string, IPreviewUrlResponse] | void>(
        links.map(async (link): Promise<[string, IPreviewUrlResponse] | undefined> => {
            try {
                const preview = await cli.getUrlPreview(link, ts);
                // Ensure at least one of the rendered fields is truthy
                if (
                    preview?.["og:image"]?.startsWith("mxc://") ||
                    !!preview?.["og:description"] ||
                    !!preview?.["og:title"]
                ) {
                    return [link, preview];
                }
            } catch (error) {
                if (error instanceof MatrixError && error.httpStatus === 404) {
                    // Quieten 404 Not found errors, not all URLs can have a preview generated
                    logger.debug("Failed to get URL preview: ", error);
                } else {
                    logger.error("Failed to get URL preview: ", error);
                }
            }
        }),
    ).then((a) => a.filter(Boolean)) as Promise<[string, IPreviewUrlResponse][]>;
};

export default LinkPreviewGroup;
