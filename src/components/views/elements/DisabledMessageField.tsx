import { useAtom } from "jotai";
import { communityBotAtom, minimumTokenThresholdAtom } from "../../../atoms";
import { _t } from "../../../languageHandler";
import React from "react";
import { useVerifiedRoom } from "../../../hooks/useVerifiedRoom";
import { Room } from "matrix-js-sdk/src/matrix";
import { MessageButton } from "./MessageButton";

export function DisabledMessageField({ room }: { room: Room }): JSX.Element {
    const [allTokens] = useAtom(minimumTokenThresholdAtom)
    const [communityBot] = useAtom(communityBotAtom)
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
                You need at least {tokenThreshold.threshold} {tokenThreshold.symbol} to join this
                community.{ isCommunityRoom ? (
                    <>
                        <span style={{'marginLeft': '1rem', display: 'block'}}></span>
                        <MessageButton text={'Get room tokens'} member={communityBot}></MessageButton>
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
