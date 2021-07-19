// Based on https://github.com/jimmywarting/StreamSaver.js/blob/master/examples/zip-stream.js

/* global ReadableStream */

type TypedArray =
    | Int8Array
    | Uint8Array
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Uint8ClampedArray
    | Float32Array
    | Float64Array;

/**
 * 32-bit cyclic redundancy check, or CRC-32 - checksum
 */
class Crc32 {
    crc: number;
    table: any;
    constructor() {
        this.crc = -1;
        this.table = (() => {
            let i;
            let j;
            let t;
            const table = [];

            for (i = 0; i < 256; i++) {
                t = i;
                for (j = 0; j < 8; j++) {
                    t = (t & 1)
                        ? (t >>> 1) ^ 0xEDB88320
                        : t >>> 1;
                }
                table[i] = t;
            }
            return table;
        })();
    }

    append(data: TypedArray) {
        let crc = this.crc | 0;
        const table = this.table;
        for (let offset = 0, len = data.length | 0; offset < len; offset++) {
            crc = (crc >>> 8) ^ table[(crc ^ data[offset]) & 0xFF];
        }
        this.crc = crc;
    }

    get() {
        return ~this.crc;
    }
}

type DataHelper = {
    array: Uint8Array;
    view: DataView;
};

const getDataHelper = (byteLength: number): DataHelper => {
    const uint8 = new Uint8Array(byteLength);
    return {
        array: uint8,
        view: new DataView(uint8.buffer),
    };
};

type FileLike = File & {
    directory: string;
    comment: string;
    stream(): ReadableStream;
};

type ZipObj = {
    crc?: Crc32;
    uncompressedLength: number;
    compressedLength: number;
    ctrl: ReadableStreamDefaultController;
    writeFooter: Function;
    writeHeader: Function;
    reader?: ReadableStreamDefaultReader;
    offset: number;
    header?: DataHelper;
    fileLike: FileLike;
    level: number;
    directory: boolean;
};

const pump = (zipObj: ZipObj) => zipObj.reader ? zipObj.reader.read().then(chunk => {
    if (zipObj.crc) {
        if (chunk.done) return zipObj.writeFooter();
        const outputData = chunk.value;
        zipObj.crc.append(outputData);
        zipObj.uncompressedLength += outputData.length;
        zipObj.compressedLength += outputData.length;
        zipObj.ctrl.enqueue(outputData);
    } else {
        throw new Error('Missing zipObj.crc');
    }
}) : undefined;

export default function streamToZIP(underlyingSource: UnderlyingSource) {
    const files = Object.create(null);
    const filenames: string[] = [];
    const encoder = new TextEncoder();
    let offset = 0;
    let activeZipIndex = 0;
    let ctrl: ReadableStreamDefaultController;
    let activeZipObject: ZipObj;
    let closed: boolean;

    function next() {
        activeZipIndex++;
        activeZipObject = files[filenames[activeZipIndex]];
        if (activeZipObject) processNextChunk();
        else if (closed) closeZip();
    }

    const zipWriter: ReadableStreamDefaultController = {
        desiredSize: null,

        error(err) {
            console.error(err);
        },

        enqueue(fileLike: FileLike) {
            if (closed) {
                throw new TypeError(
                    "Cannot enqueue a chunk into a readable stream that is closed or has been requested to be closed",
                );
            }

            let name = fileLike.name.trim();
            const date = new Date(typeof fileLike.lastModified === 'undefined' ? Date.now() : fileLike.lastModified);

            if (fileLike.directory && !name.endsWith('/')) name += '/';
            // if file already exists, do not enqueue
            if (files[name]) return;

            const nameBuf = encoder.encode(name);
            filenames.push(name);

            const zipObject: ZipObj = files[name] = {
                level: 0,
                ctrl,
                directory: !!fileLike.directory,
                nameBuf,
                comment: encoder.encode(fileLike.comment || ''),
                compressedLength: 0,
                uncompressedLength: 0,
                offset,

                writeHeader() {
                    const header = getDataHelper(26);
                    const data = getDataHelper(30 + nameBuf.length);

                    zipObject.offset = offset;
                    zipObject.header = header;

                    if (zipObject.level !== 0 && !zipObject.directory) {
                        header.view.setUint16(4, 0x0800);
                    }

                    header.view.setUint32(0, 0x14000808);
                    header.view.setUint16(
                        6,
                        (((date.getHours() << 6) | date.getMinutes()) << 5) | (date.getSeconds() / 2),
                        true,
                    );
                    header.view.setUint16(
                        8,
                        ((((date.getFullYear() - 1980) << 4) | (date.getMonth() + 1)) << 5) |
                        date.getDate(),
                        true,
                    );
                    header.view.setUint16(22, nameBuf.length, true);
                    data.view.setUint32(0, 0x504b0304);
                    data.array.set(header.array, 4);
                    data.array.set(nameBuf, 30);
                    offset += data.array.length;
                    ctrl.enqueue(data.array);
                },

                writeFooter() {
                    const footer = getDataHelper(16);
                    footer.view.setUint32(0, 0x504b0708);

                    if (zipObject.crc && zipObject.header) {
                        zipObject.header.view.setUint32(10, zipObject.crc.get(), true);
                        zipObject.header.view.setUint32(14, zipObject.compressedLength, true);
                        zipObject.header.view.setUint32(18, zipObject.uncompressedLength, true);
                        footer.view.setUint32(4, zipObject.crc.get(), true);
                        footer.view.setUint32(8, zipObject.compressedLength, true);
                        footer.view.setUint32(12, zipObject.uncompressedLength, true);
                    }

                    ctrl.enqueue(footer.array);
                    offset += zipObject.compressedLength + 16;
                    next();
                },
                fileLike,
            };

            if (!activeZipObject) {
                activeZipObject = zipObject;
                processNextChunk();
            }
        },

        close() {
            if (closed) {
                throw new TypeError(
                    "Cannot close a readable stream that has already been requested to be closed",
                );
            }
            if (!activeZipObject) closeZip();
            closed = true;
        },
    };

    function closeZip() {
        let length = 0;
        let index = 0;
        let indexFilename: number;
        let file: any;

        for (indexFilename = 0; indexFilename < filenames.length; indexFilename++) {
            file = files[filenames[indexFilename]];
            length += 46 + file.nameBuf.length + file.comment.length;
        }
        const data = getDataHelper(length + 22);
        for (indexFilename = 0; indexFilename < filenames.length; indexFilename++) {
            file = files[filenames[indexFilename]];
            data.view.setUint32(index, 0x504b0102);
            data.view.setUint16(index + 4, 0x1400);
            data.array.set(file.header.array, index + 6);
            data.view.setUint16(index + 32, file.comment.length, true);
            if (file.directory) {
                data.view.setUint8(index + 38, 0x10);
            }
            data.view.setUint32(index + 42, file.offset, true);
            data.array.set(file.nameBuf, index + 46);
            data.array.set(file.comment, index + 46 + file.nameBuf.length);
            index += 46 + file.nameBuf.length + file.comment.length;
        }
        data.view.setUint32(index, 0x504b0506);
        data.view.setUint16(index + 8, filenames.length, true);
        data.view.setUint16(index + 10, filenames.length, true);
        data.view.setUint32(index + 12, length, true);
        data.view.setUint32(index + 16, offset, true);
        ctrl.enqueue(data.array);
        ctrl.close();
    }

    function processNextChunk() {
        if (!activeZipObject) return;
        if (activeZipObject.reader) return pump(activeZipObject);
        if (activeZipObject.fileLike.stream) {
            activeZipObject.crc = new Crc32();
            activeZipObject.reader = activeZipObject.fileLike.stream().getReader();
            activeZipObject.writeHeader();
        } else next();
    }

    return new ReadableStream({
        start: c => {
            ctrl = c;
            underlyingSource.start && Promise.resolve(underlyingSource.start(zipWriter));
        },
        pull() {
            return processNextChunk() || (
                underlyingSource.pull &&
                Promise.resolve(underlyingSource.pull(zipWriter))
            );
        },
    });
}
