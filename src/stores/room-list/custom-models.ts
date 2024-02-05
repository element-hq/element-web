import { DefaultTagID } from "matrix-react-sdk/src/stores/room-list/models";

export enum SuperheroTagID {
    CommunityRooms = "CommunityRooms",
}

export type CustomTagID = string | DefaultTagID | SuperheroTagID;
