/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { useContext, useEffect } from "react";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { IPreviewUrlResponse, MatrixClient } from "matrix-js-sdk/src/client";
import { logger } from "matrix-js-sdk/src/logger";

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
    onHeightChanged?(): void; // called when the preview's contents has loaded
}

const LinkPreviewGroup: React.FC<IProps> = ({ links, mxEvent, onCancelClick, onHeightChanged }) => {
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

    useEffect(() => {
        onHeightChanged?.();
    }, [onHeightChanged, expanded, previews]);

    const showPreviews = expanded ? previews : previews.slice(0, INITIAL_NUM_PREVIEWS);

    let toggleButton: JSX.Element | undefined;
    if (previews.length > INITIAL_NUM_PREVIEWS) {
        toggleButton = (
            <AccessibleButton onClick={toggleExpanded}>
                {expanded
                    ? _t("Collapse")
                    : _t("Show %(count)s other previews", { count: previews.length - showPreviews.length })}
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
                            aria-label={_t("Close preview")}
                        >
                            <img
                                className="mx_filterFlipColor"
                                alt=""
                                role="presentation"
                                src={require("../../../../res/img/cancel.svg").default}
                                width="18"
                                height="18"
                            />
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
                if (preview && Object.keys(preview).length > 0) {
                    return [link, preview];
                }
            } catch (error) {
                logger.error("Failed to get URL preview: " + error);
            }
        }),
    ).then((a) => a.filter(Boolean)) as Promise<[string, IPreviewUrlResponse][]>;
};

export default LinkPreviewGroup;
