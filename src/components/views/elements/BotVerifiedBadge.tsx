import React from "react";

import { useVerifiedBot } from "../../../hooks/useVerifiedBot";

export interface UserVerifiedBadgeProps {
    userId: string;
}

export const BotVerifiedBadge = ({ userId }: UserVerifiedBadgeProps): JSX.Element => {
    const isVerifiedBot = useVerifiedBot(userId);

    return (
        <>
            {isVerifiedBot && (
                <div
                    style={{
                        color: "rgba(30, 203, 172, 1)",
                        fontWeight: 700,
                        fontSize: "10px",
                        backgroundColor: "rgba(30, 203, 172, 0.2)",
                        padding: "2px 4px",
                        borderRadius: "15px",
                        marginLeft: "15px",
                    }}
                >
                    Verified Bot
                </div>
            )}
        </>
    );
};
