import { useAtom } from "jotai";
import React from "react";
import { Room } from "matrix-js-sdk/src/matrix";

import { minimumTokenThresholdAtom } from "../../../atoms";
import { _t } from "../../../languageHandler";
import { useVerifiedRoom } from "../../../hooks/useVerifiedRoom";
import {  MessageCommunityBotButton } from "./MessageButton";

export function DisabledMessageField({ room }: { room: Room }): JSX.Element {
    const [allTokens] = useAtom(minimumTokenThresholdAtom)
    const { isTokenGatedRoom, isCommunityRoom,  } = useVerifiedRoom(room);

    let tokenThreshold = allTokens[room.name];
    if(!tokenThreshold) {
        const tokenName = room.name.match(/\[TG] (.*) \(ct_.*\)/)?.[1];
        if(isTokenGatedRoom && tokenName) {
            tokenThreshold = {
                threshold: "1",
                symbol: tokenName,
            }
        }
    }


    if (tokenThreshold) {
        return (
            <div key="controls_error" className="mx_MessageComposer_noperm_error">
                {_t("composer|no_perms_token_notice", tokenThreshold)}
                { isCommunityRoom ? (
                    <>
                        <span style={{'marginLeft': '1rem', display: 'block'}} />
                        <MessageCommunityBotButton text="Get room tokens" />
                    </>
                ) : null }
            </div>
        );
    }  else {
        return (
            <div key="controls_error" className="mx_MessageComposer_noperm_error">
                {_t("composer|no_perms_notice")}
            </div>
        );
    }
}
