/*Not to be reviewed now*/
// class fileCheckSum {
//     protected CRC32: number;
//     public table: any[];
//     constructor() {
//         this.CRC32 = -1
//     }

//     protected append(data: any[]) {
//         let crc = this.CRC32 | 0;
//         const table = this.table;
//         for (let offset = 0, len = data.length | 0; offset < len; offset++) {
//             crc = (crc >>> 8) ^ table[(crc ^ data[offset]) & 0xFF]
//         }
//         this.CRC32 = crc
//     }
// }
