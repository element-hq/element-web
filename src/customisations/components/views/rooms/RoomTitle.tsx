/*
Copyright 2025 Keypair Establishment.

SPDX-License-Identifier: GPL-3.0-or-later
Please see https://www.gnu.org/licenses/gpl-3.0.html for full license text.
*/
import React from "react";

import { Icon as EthereumIcon } from "../../../../../res/img/ethereum.svg";

interface IProps {
    name: string;
    shouldShortenAddress?: boolean;
}

const RoomTitle: React.FC<IProps> = ({ name, shouldShortenAddress = false }) => {
    const prefix = "[TG] ";

    if (name.startsWith(prefix)) {
        const [namePart, addressPart] = name.slice(prefix.length).split(" ");
        const formattedAddress = shouldShortenAddress && addressPart
            ? `${addressPart.slice(0, 6)}...${addressPart.slice(-4)}`
            : addressPart;
        const formattedName = addressPart ? `${namePart} ${formattedAddress}` : namePart;

        return (
            <>
                <EthereumIcon className="tg-icon" />
                <span dir="auto">{formattedName}</span>
            </>
        );
    }
    return <span dir="auto">{name}</span>;
};

export default RoomTitle;
