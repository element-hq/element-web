/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { ReactNode, useEffect } from "react";
import { uniqBy } from "lodash";
import { MatrixEvent, RoomMember } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import MemberAvatar from "../avatars/MemberAvatar";
import { _t } from "../../../languageHandler";
import { useStateToggle } from "../../../hooks/useStateToggle";
import AccessibleButton from "./AccessibleButton";
import { Layout } from "../../../settings/enums/Layout";

interface IProps {
    // An array of member events to summarise
    "events": MatrixEvent[];
    // The minimum number of events needed to trigger summarisation
    "threshold"?: number;
    // Whether or not to begin with state.expanded=true
    "startExpanded"?: boolean;
    // The list of room members for which to show avatars next to the summary
    "summaryMembers"?: RoomMember[];
    // The text to show as the summary of this event list
    "summaryText"?: ReactNode;
    // An array of EventTiles to render when expanded
    "children": ReactNode[] | null;
    // Called when the event list expansion is toggled
    onToggle?(): void;
    // The layout currently used
    "layout"?: Layout;
    "data-testid"?: string;
}

const GenericEventListSummary: React.FC<IProps> = ({
    events,
    children,
    threshold = 3,
    onToggle,
    startExpanded = false,
    summaryMembers = [],
    summaryText,
    layout = Layout.Group,
    "data-testid": testId,
}) => {
    const [expanded, toggleExpanded] = useStateToggle(startExpanded);

    // Whenever expanded changes call onToggle
    useEffect(() => {
        if (onToggle) {
            onToggle();
        }
    }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

    const eventIds = events.map((e) => e.getId()).join(",");

    // If we are only given few events then just pass them through
    if (events.length < threshold) {
        return (
            <li
                className="mx_GenericEventListSummary"
                data-scroll-tokens={eventIds}
                data-expanded={true}
                data-layout={layout}
            >
                <ol className="mx_GenericEventListSummary_unstyledList">{children}</ol>
            </li>
        );
    }

    let body;
    if (expanded) {
        body = (
            <React.Fragment>
                <div className="mx_GenericEventListSummary_spacer">&nbsp;</div>
                <ol className="mx_GenericEventListSummary_unstyledList">{children}</ol>
            </React.Fragment>
        );
    } else {
        const uniqueMembers = uniqBy(
            summaryMembers.filter((member) => {
                if (!member?.getMxcAvatarUrl) {
                    logger.error(
                        "EventListSummary given null summaryMember, termites may be afoot eating event senders",
                        summaryMembers,
                    );
                    return false;
                }
                return true;
            }),
            (member) => member.getMxcAvatarUrl(),
        );
        const avatars = uniqueMembers.map((m) => <MemberAvatar key={m.userId} member={m} size="14px" />);
        body = (
            <div className="mx_EventTile_line">
                <div className="mx_EventTile_info">
                    <span className="mx_GenericEventListSummary_avatars" onClick={toggleExpanded}>
                        {avatars}
                    </span>
                    <span className="mx_TextualEvent mx_GenericEventListSummary_summary">{summaryText}</span>
                </div>
            </div>
        );
    }

    return (
        <li
            className="mx_GenericEventListSummary"
            data-scroll-tokens={eventIds}
            data-expanded={expanded + ""}
            data-layout={layout}
            data-testid={testId}
        >
            <AccessibleButton
                kind="link_inline"
                className="mx_GenericEventListSummary_toggle"
                onClick={toggleExpanded}
                aria-expanded={expanded}
            >
                {expanded ? _t("action|collapse") : _t("action|expand")}
            </AccessibleButton>
            {body}
        </li>
    );
};

export default GenericEventListSummary;
