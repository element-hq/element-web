import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Room } from "matrix-js-sdk/src/models/room";

export abstract class Exporter {
    constructor(protected res: MatrixEvent[], protected room: Room) {}
    abstract export(): Promise<Blob>;
}
