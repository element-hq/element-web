/*
Copyright 2024 New Vector Ltd.
Copyright 2017 Vector Creations Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

const PHONE_NUMBER_REGEXP = /^[0-9 -.]+$/;

/*
 * Do basic validation to determine if the given input could be
 * a valid phone number.
 *
 * @param {String} phoneNumber The string to validate. This could be
 *     either an international format number (MSISDN or e.164) or
 *     a national-format number.
 * @return True if the number could be a valid phone number, otherwise false.
 */
export function looksValid(phoneNumber: string): boolean {
    return PHONE_NUMBER_REGEXP.test(phoneNumber);
}

// Regional Indicator Symbol Letter A
const UNICODE_BASE = 127462 - "A".charCodeAt(0);
// Country code should be exactly 2 uppercase characters
const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;

export const getEmojiFlag = (countryCode: string): string => {
    if (!COUNTRY_CODE_REGEX.test(countryCode)) return "";
    // Rip the country code out of the emoji and use that
    return String.fromCodePoint(...countryCode.split("").map((l) => UNICODE_BASE + l.charCodeAt(0)));
};

// Use https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DisplayNames to get name
export interface PhoneNumberCountryDefinition {
    iso2: string;
    prefix: string;
}

export const COUNTRIES: PhoneNumberCountryDefinition[] = [
    {
        iso2: "GB",
        prefix: "44",
    },
    {
        iso2: "US",
        prefix: "1",
    },
    {
        iso2: "AF",
        prefix: "93",
    },
    {
        iso2: "AX",
        prefix: "358",
    },
    {
        iso2: "AL",
        prefix: "355",
    },
    {
        iso2: "DZ",
        prefix: "213",
    },
    {
        iso2: "AS",
        prefix: "1",
    },
    {
        iso2: "AD",
        prefix: "376",
    },
    {
        iso2: "AO",
        prefix: "244",
    },
    {
        iso2: "AI",
        prefix: "1",
    },
    {
        iso2: "AQ",
        prefix: "672",
    },
    {
        iso2: "AG",
        prefix: "1",
    },
    {
        iso2: "AR",
        prefix: "54",
    },
    {
        iso2: "AM",
        prefix: "374",
    },
    {
        iso2: "AW",
        prefix: "297",
    },
    {
        iso2: "AU",
        prefix: "61",
    },
    {
        iso2: "AT",
        prefix: "43",
    },
    {
        iso2: "AZ",
        prefix: "994",
    },
    {
        iso2: "BS",
        prefix: "1",
    },
    {
        iso2: "BH",
        prefix: "973",
    },
    {
        iso2: "BD",
        prefix: "880",
    },
    {
        iso2: "BB",
        prefix: "1",
    },
    {
        iso2: "BY",
        prefix: "375",
    },
    {
        iso2: "BE",
        prefix: "32",
    },
    {
        iso2: "BZ",
        prefix: "501",
    },
    {
        iso2: "BJ",
        prefix: "229",
    },
    {
        iso2: "BM",
        prefix: "1",
    },
    {
        iso2: "BT",
        prefix: "975",
    },
    {
        iso2: "BO",
        prefix: "591",
    },
    {
        iso2: "BA",
        prefix: "387",
    },
    {
        iso2: "BW",
        prefix: "267",
    },
    {
        iso2: "BV",
        prefix: "47",
    },
    {
        iso2: "BR",
        prefix: "55",
    },
    {
        iso2: "IO",
        prefix: "246",
    },
    {
        iso2: "VG",
        prefix: "1",
    },
    {
        iso2: "BN",
        prefix: "673",
    },
    {
        iso2: "BG",
        prefix: "359",
    },
    {
        iso2: "BF",
        prefix: "226",
    },
    {
        iso2: "BI",
        prefix: "257",
    },
    {
        iso2: "KH",
        prefix: "855",
    },
    {
        iso2: "CM",
        prefix: "237",
    },
    {
        iso2: "CA",
        prefix: "1",
    },
    {
        iso2: "CV",
        prefix: "238",
    },
    {
        iso2: "BQ",
        prefix: "599",
    },
    {
        iso2: "KY",
        prefix: "1",
    },
    {
        iso2: "CF",
        prefix: "236",
    },
    {
        iso2: "TD",
        prefix: "235",
    },
    {
        iso2: "CL",
        prefix: "56",
    },
    {
        iso2: "CN",
        prefix: "86",
    },
    {
        iso2: "CX",
        prefix: "61",
    },
    {
        iso2: "CC",
        prefix: "61",
    },
    {
        iso2: "CO",
        prefix: "57",
    },
    {
        iso2: "KM",
        prefix: "269",
    },
    {
        iso2: "CG",
        prefix: "242",
    },
    {
        iso2: "CD",
        prefix: "243",
    },
    {
        iso2: "CK",
        prefix: "682",
    },
    {
        iso2: "CR",
        prefix: "506",
    },
    {
        iso2: "HR",
        prefix: "385",
    },
    {
        iso2: "CU",
        prefix: "53",
    },
    {
        iso2: "CW",
        prefix: "599",
    },
    {
        iso2: "CY",
        prefix: "357",
    },
    {
        iso2: "CZ",
        prefix: "420",
    },
    {
        iso2: "CI",
        prefix: "225",
    },
    {
        iso2: "DK",
        prefix: "45",
    },
    {
        iso2: "DJ",
        prefix: "253",
    },
    {
        iso2: "DM",
        prefix: "1",
    },
    {
        iso2: "DO",
        prefix: "1",
    },
    {
        iso2: "EC",
        prefix: "593",
    },
    {
        iso2: "EG",
        prefix: "20",
    },
    {
        iso2: "SV",
        prefix: "503",
    },
    {
        iso2: "GQ",
        prefix: "240",
    },
    {
        iso2: "ER",
        prefix: "291",
    },
    {
        iso2: "EE",
        prefix: "372",
    },
    {
        iso2: "ET",
        prefix: "251",
    },
    {
        iso2: "FK",
        prefix: "500",
    },
    {
        iso2: "FO",
        prefix: "298",
    },
    {
        iso2: "FJ",
        prefix: "679",
    },
    {
        iso2: "FI",
        prefix: "358",
    },
    {
        iso2: "FR",
        prefix: "33",
    },
    {
        iso2: "GF",
        prefix: "594",
    },
    {
        iso2: "PF",
        prefix: "689",
    },
    {
        iso2: "TF",
        prefix: "262",
    },
    {
        iso2: "GA",
        prefix: "241",
    },
    {
        iso2: "GM",
        prefix: "220",
    },
    {
        iso2: "GE",
        prefix: "995",
    },
    {
        iso2: "DE",
        prefix: "49",
    },
    {
        iso2: "GH",
        prefix: "233",
    },
    {
        iso2: "GI",
        prefix: "350",
    },
    {
        iso2: "GR",
        prefix: "30",
    },
    {
        iso2: "GL",
        prefix: "299",
    },
    {
        iso2: "GD",
        prefix: "1",
    },
    {
        iso2: "GP",
        prefix: "590",
    },
    {
        iso2: "GU",
        prefix: "1",
    },
    {
        iso2: "GT",
        prefix: "502",
    },
    {
        iso2: "GG",
        prefix: "44",
    },
    {
        iso2: "GN",
        prefix: "224",
    },
    {
        iso2: "GW",
        prefix: "245",
    },
    {
        iso2: "GY",
        prefix: "592",
    },
    {
        iso2: "HT",
        prefix: "509",
    },
    {
        iso2: "HM",
        prefix: "672",
    },
    {
        iso2: "HN",
        prefix: "504",
    },
    {
        iso2: "HK",
        prefix: "852",
    },
    {
        iso2: "HU",
        prefix: "36",
    },
    {
        iso2: "IS",
        prefix: "354",
    },
    {
        iso2: "IN",
        prefix: "91",
    },
    {
        iso2: "ID",
        prefix: "62",
    },
    {
        iso2: "IR",
        prefix: "98",
    },
    {
        iso2: "IQ",
        prefix: "964",
    },
    {
        iso2: "IE",
        prefix: "353",
    },
    {
        iso2: "IM",
        prefix: "44",
    },
    {
        iso2: "IL",
        prefix: "972",
    },
    {
        iso2: "IT",
        prefix: "39",
    },
    {
        iso2: "JM",
        prefix: "1",
    },
    {
        iso2: "JP",
        prefix: "81",
    },
    {
        iso2: "JE",
        prefix: "44",
    },
    {
        iso2: "JO",
        prefix: "962",
    },
    {
        iso2: "KZ",
        prefix: "7",
    },
    {
        iso2: "KE",
        prefix: "254",
    },
    {
        iso2: "KI",
        prefix: "686",
    },
    {
        iso2: "XK",
        prefix: "383",
    },
    {
        iso2: "KW",
        prefix: "965",
    },
    {
        iso2: "KG",
        prefix: "996",
    },
    {
        iso2: "LA",
        prefix: "856",
    },
    {
        iso2: "LV",
        prefix: "371",
    },
    {
        iso2: "LB",
        prefix: "961",
    },
    {
        iso2: "LS",
        prefix: "266",
    },
    {
        iso2: "LR",
        prefix: "231",
    },
    {
        iso2: "LY",
        prefix: "218",
    },
    {
        iso2: "LI",
        prefix: "423",
    },
    {
        iso2: "LT",
        prefix: "370",
    },
    {
        iso2: "LU",
        prefix: "352",
    },
    {
        iso2: "MO",
        prefix: "853",
    },
    {
        iso2: "MK",
        prefix: "389",
    },
    {
        iso2: "MG",
        prefix: "261",
    },
    {
        iso2: "MW",
        prefix: "265",
    },
    {
        iso2: "MY",
        prefix: "60",
    },
    {
        iso2: "MV",
        prefix: "960",
    },
    {
        iso2: "ML",
        prefix: "223",
    },
    {
        iso2: "MT",
        prefix: "356",
    },
    {
        iso2: "MH",
        prefix: "692",
    },
    {
        iso2: "MQ",
        prefix: "596",
    },
    {
        iso2: "MR",
        prefix: "222",
    },
    {
        iso2: "MU",
        prefix: "230",
    },
    {
        iso2: "YT",
        prefix: "262",
    },
    {
        iso2: "MX",
        prefix: "52",
    },
    {
        iso2: "FM",
        prefix: "691",
    },
    {
        iso2: "MD",
        prefix: "373",
    },
    {
        iso2: "MC",
        prefix: "377",
    },
    {
        iso2: "MN",
        prefix: "976",
    },
    {
        iso2: "ME",
        prefix: "382",
    },
    {
        iso2: "MS",
        prefix: "1",
    },
    {
        iso2: "MA",
        prefix: "212",
    },
    {
        iso2: "MZ",
        prefix: "258",
    },
    {
        iso2: "MM",
        prefix: "95",
    },
    {
        iso2: "NA",
        prefix: "264",
    },
    {
        iso2: "NR",
        prefix: "674",
    },
    {
        iso2: "NP",
        prefix: "977",
    },
    {
        iso2: "NL",
        prefix: "31",
    },
    {
        iso2: "NC",
        prefix: "687",
    },
    {
        iso2: "NZ",
        prefix: "64",
    },
    {
        iso2: "NI",
        prefix: "505",
    },
    {
        iso2: "NE",
        prefix: "227",
    },
    {
        iso2: "NG",
        prefix: "234",
    },
    {
        iso2: "NU",
        prefix: "683",
    },
    {
        iso2: "NF",
        prefix: "672",
    },
    {
        iso2: "KP",
        prefix: "850",
    },
    {
        iso2: "MP",
        prefix: "1",
    },
    {
        iso2: "NO",
        prefix: "47",
    },
    {
        iso2: "OM",
        prefix: "968",
    },
    {
        iso2: "PK",
        prefix: "92",
    },
    {
        iso2: "PW",
        prefix: "680",
    },
    {
        iso2: "PS",
        prefix: "970",
    },
    {
        iso2: "PA",
        prefix: "507",
    },
    {
        iso2: "PG",
        prefix: "675",
    },
    {
        iso2: "PY",
        prefix: "595",
    },
    {
        iso2: "PE",
        prefix: "51",
    },
    {
        iso2: "PH",
        prefix: "63",
    },
    {
        iso2: "PN",
        prefix: "870",
    },
    {
        iso2: "PL",
        prefix: "48",
    },
    {
        iso2: "PT",
        prefix: "351",
    },
    {
        iso2: "PR",
        prefix: "1",
    },
    {
        iso2: "QA",
        prefix: "974",
    },
    {
        iso2: "RO",
        prefix: "40",
    },
    {
        iso2: "RU",
        prefix: "7",
    },
    {
        iso2: "RW",
        prefix: "250",
    },
    {
        iso2: "RE",
        prefix: "262",
    },
    {
        iso2: "WS",
        prefix: "685",
    },
    {
        iso2: "SM",
        prefix: "378",
    },
    {
        iso2: "SA",
        prefix: "966",
    },
    {
        iso2: "SN",
        prefix: "221",
    },
    {
        iso2: "RS",
        prefix: "381 p",
    },
    {
        iso2: "SC",
        prefix: "248",
    },
    {
        iso2: "SL",
        prefix: "232",
    },
    {
        iso2: "SG",
        prefix: "65",
    },
    {
        iso2: "SX",
        prefix: "1",
    },
    {
        iso2: "SK",
        prefix: "421",
    },
    {
        iso2: "SI",
        prefix: "386",
    },
    {
        iso2: "SB",
        prefix: "677",
    },
    {
        iso2: "SO",
        prefix: "252",
    },
    {
        iso2: "ZA",
        prefix: "27",
    },
    {
        iso2: "GS",
        prefix: "500",
    },
    {
        iso2: "KR",
        prefix: "82",
    },
    {
        iso2: "SS",
        prefix: "211",
    },
    {
        iso2: "ES",
        prefix: "34",
    },
    {
        iso2: "LK",
        prefix: "94",
    },
    {
        iso2: "BL",
        prefix: "590",
    },
    {
        iso2: "SH",
        prefix: "290 n",
    },
    {
        iso2: "KN",
        prefix: "1",
    },
    {
        iso2: "LC",
        prefix: "1",
    },
    {
        iso2: "MF",
        prefix: "590",
    },
    {
        iso2: "PM",
        prefix: "508",
    },
    {
        iso2: "VC",
        prefix: "1",
    },
    {
        iso2: "SD",
        prefix: "249",
    },
    {
        iso2: "SR",
        prefix: "597",
    },
    {
        iso2: "SJ",
        prefix: "47",
    },
    {
        iso2: "SZ",
        prefix: "268",
    },
    {
        iso2: "SE",
        prefix: "46",
    },
    {
        iso2: "CH",
        prefix: "41",
    },
    {
        iso2: "SY",
        prefix: "963",
    },
    {
        iso2: "ST",
        prefix: "239",
    },
    {
        iso2: "TW",
        prefix: "886",
    },
    {
        iso2: "TJ",
        prefix: "992",
    },
    {
        iso2: "TZ",
        prefix: "255",
    },
    {
        iso2: "TH",
        prefix: "66",
    },
    {
        iso2: "TL",
        prefix: "670",
    },
    {
        iso2: "TG",
        prefix: "228",
    },
    {
        iso2: "TK",
        prefix: "690",
    },
    {
        iso2: "TO",
        prefix: "676",
    },
    {
        iso2: "TT",
        prefix: "1",
    },
    {
        iso2: "TN",
        prefix: "216",
    },
    {
        iso2: "TR",
        prefix: "90",
    },
    {
        iso2: "TM",
        prefix: "993",
    },
    {
        iso2: "TC",
        prefix: "1",
    },
    {
        iso2: "TV",
        prefix: "688",
    },
    {
        iso2: "VI",
        prefix: "1",
    },
    {
        iso2: "UG",
        prefix: "256",
    },
    {
        iso2: "UA",
        prefix: "380",
    },
    {
        iso2: "AE",
        prefix: "971",
    },
    {
        iso2: "UY",
        prefix: "598",
    },
    {
        iso2: "UZ",
        prefix: "998",
    },
    {
        iso2: "VU",
        prefix: "678",
    },
    {
        iso2: "VA",
        prefix: "39",
    },
    {
        iso2: "VE",
        prefix: "58",
    },
    {
        iso2: "VN",
        prefix: "84",
    },
    {
        iso2: "WF",
        prefix: "681",
    },
    {
        iso2: "EH",
        prefix: "212",
    },
    {
        iso2: "YE",
        prefix: "967",
    },
    {
        iso2: "ZM",
        prefix: "260",
    },
    {
        iso2: "ZW",
        prefix: "263",
    },
];
