import { useAtom } from "jotai";
import React, { ReactElement } from "react";

import { minimumTokenThresholdAtom } from "../../../atoms";
import { _t } from "../../../languageHandler";
import { cleanRoomName } from "../../../hooks/useVerifiedRoom";

export function CommunityRoomPeekMessage({ roomName }: { roomName: string }): ReactElement {
    const [allTokens] = useAtom(minimumTokenThresholdAtom)
    const cleanedRoomName = cleanRoomName(roomName);

    const tokenThreshold = allTokens[cleanedRoomName];

    return (
        <h3>{_t("room|no_peek_join_prompt_community", { roomName: cleanedRoomName })} {
            tokenThreshold ? (_t('room|no_peek_join_prompt_community_threshold', tokenThreshold)) : ''
        }</h3>
    );
}
