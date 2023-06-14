/*
Copyright 2017 Vector Creations Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { _td } from "./languageHandler";

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

export interface PhoneNumberCountryDefinition {
    iso2: string;
    name: string;
    prefix: string;
}

export const COUNTRIES: PhoneNumberCountryDefinition[] = [
    {
        iso2: "GB",
        name: _td("United Kingdom"),
        prefix: "44",
    },
    {
        iso2: "US",
        name: _td("United States"),
        prefix: "1",
    },
    {
        iso2: "AF",
        name: _td("Afghanistan"),
        prefix: "93",
    },
    {
        iso2: "AX",
        name: _td("\u00c5land Islands"),
        prefix: "358",
    },
    {
        iso2: "AL",
        name: _td("Albania"),
        prefix: "355",
    },
    {
        iso2: "DZ",
        name: _td("Algeria"),
        prefix: "213",
    },
    {
        iso2: "AS",
        name: _td("American Samoa"),
        prefix: "1",
    },
    {
        iso2: "AD",
        name: _td("Andorra"),
        prefix: "376",
    },
    {
        iso2: "AO",
        name: _td("Angola"),
        prefix: "244",
    },
    {
        iso2: "AI",
        name: _td("Anguilla"),
        prefix: "1",
    },
    {
        iso2: "AQ",
        name: _td("Antarctica"),
        prefix: "672",
    },
    {
        iso2: "AG",
        name: _td("Antigua & Barbuda"),
        prefix: "1",
    },
    {
        iso2: "AR",
        name: _td("Argentina"),
        prefix: "54",
    },
    {
        iso2: "AM",
        name: _td("Armenia"),
        prefix: "374",
    },
    {
        iso2: "AW",
        name: _td("Aruba"),
        prefix: "297",
    },
    {
        iso2: "AU",
        name: _td("Australia"),
        prefix: "61",
    },
    {
        iso2: "AT",
        name: _td("Austria"),
        prefix: "43",
    },
    {
        iso2: "AZ",
        name: _td("Azerbaijan"),
        prefix: "994",
    },
    {
        iso2: "BS",
        name: _td("Bahamas"),
        prefix: "1",
    },
    {
        iso2: "BH",
        name: _td("Bahrain"),
        prefix: "973",
    },
    {
        iso2: "BD",
        name: _td("Bangladesh"),
        prefix: "880",
    },
    {
        iso2: "BB",
        name: _td("Barbados"),
        prefix: "1",
    },
    {
        iso2: "BY",
        name: _td("Belarus"),
        prefix: "375",
    },
    {
        iso2: "BE",
        name: _td("Belgium"),
        prefix: "32",
    },
    {
        iso2: "BZ",
        name: _td("Belize"),
        prefix: "501",
    },
    {
        iso2: "BJ",
        name: _td("Benin"),
        prefix: "229",
    },
    {
        iso2: "BM",
        name: _td("Bermuda"),
        prefix: "1",
    },
    {
        iso2: "BT",
        name: _td("Bhutan"),
        prefix: "975",
    },
    {
        iso2: "BO",
        name: _td("Bolivia"),
        prefix: "591",
    },
    {
        iso2: "BA",
        name: _td("Bosnia"),
        prefix: "387",
    },
    {
        iso2: "BW",
        name: _td("Botswana"),
        prefix: "267",
    },
    {
        iso2: "BV",
        name: _td("Bouvet Island"),
        prefix: "47",
    },
    {
        iso2: "BR",
        name: _td("Brazil"),
        prefix: "55",
    },
    {
        iso2: "IO",
        name: _td("British Indian Ocean Territory"),
        prefix: "246",
    },
    {
        iso2: "VG",
        name: _td("British Virgin Islands"),
        prefix: "1",
    },
    {
        iso2: "BN",
        name: _td("Brunei"),
        prefix: "673",
    },
    {
        iso2: "BG",
        name: _td("Bulgaria"),
        prefix: "359",
    },
    {
        iso2: "BF",
        name: _td("Burkina Faso"),
        prefix: "226",
    },
    {
        iso2: "BI",
        name: _td("Burundi"),
        prefix: "257",
    },
    {
        iso2: "KH",
        name: _td("Cambodia"),
        prefix: "855",
    },
    {
        iso2: "CM",
        name: _td("Cameroon"),
        prefix: "237",
    },
    {
        iso2: "CA",
        name: _td("Canada"),
        prefix: "1",
    },
    {
        iso2: "CV",
        name: _td("Cape Verde"),
        prefix: "238",
    },
    {
        iso2: "BQ",
        name: _td("Caribbean Netherlands"),
        prefix: "599",
    },
    {
        iso2: "KY",
        name: _td("Cayman Islands"),
        prefix: "1",
    },
    {
        iso2: "CF",
        name: _td("Central African Republic"),
        prefix: "236",
    },
    {
        iso2: "TD",
        name: _td("Chad"),
        prefix: "235",
    },
    {
        iso2: "CL",
        name: _td("Chile"),
        prefix: "56",
    },
    {
        iso2: "CN",
        name: _td("China"),
        prefix: "86",
    },
    {
        iso2: "CX",
        name: _td("Christmas Island"),
        prefix: "61",
    },
    {
        iso2: "CC",
        name: _td("Cocos (Keeling) Islands"),
        prefix: "61",
    },
    {
        iso2: "CO",
        name: _td("Colombia"),
        prefix: "57",
    },
    {
        iso2: "KM",
        name: _td("Comoros"),
        prefix: "269",
    },
    {
        iso2: "CG",
        name: _td("Congo - Brazzaville"),
        prefix: "242",
    },
    {
        iso2: "CD",
        name: _td("Congo - Kinshasa"),
        prefix: "243",
    },
    {
        iso2: "CK",
        name: _td("Cook Islands"),
        prefix: "682",
    },
    {
        iso2: "CR",
        name: _td("Costa Rica"),
        prefix: "506",
    },
    {
        iso2: "HR",
        name: _td("Croatia"),
        prefix: "385",
    },
    {
        iso2: "CU",
        name: _td("Cuba"),
        prefix: "53",
    },
    {
        iso2: "CW",
        name: _td("Cura\u00e7ao"),
        prefix: "599",
    },
    {
        iso2: "CY",
        name: _td("Cyprus"),
        prefix: "357",
    },
    {
        iso2: "CZ",
        name: _td("Czech Republic"),
        prefix: "420",
    },
    {
        iso2: "CI",
        name: _td("C\u00f4te d\u2019Ivoire"),
        prefix: "225",
    },
    {
        iso2: "DK",
        name: _td("Denmark"),
        prefix: "45",
    },
    {
        iso2: "DJ",
        name: _td("Djibouti"),
        prefix: "253",
    },
    {
        iso2: "DM",
        name: _td("Dominica"),
        prefix: "1",
    },
    {
        iso2: "DO",
        name: _td("Dominican Republic"),
        prefix: "1",
    },
    {
        iso2: "EC",
        name: _td("Ecuador"),
        prefix: "593",
    },
    {
        iso2: "EG",
        name: _td("Egypt"),
        prefix: "20",
    },
    {
        iso2: "SV",
        name: _td("El Salvador"),
        prefix: "503",
    },
    {
        iso2: "GQ",
        name: _td("Equatorial Guinea"),
        prefix: "240",
    },
    {
        iso2: "ER",
        name: _td("Eritrea"),
        prefix: "291",
    },
    {
        iso2: "EE",
        name: _td("Estonia"),
        prefix: "372",
    },
    {
        iso2: "ET",
        name: _td("Ethiopia"),
        prefix: "251",
    },
    {
        iso2: "FK",
        name: _td("Falkland Islands"),
        prefix: "500",
    },
    {
        iso2: "FO",
        name: _td("Faroe Islands"),
        prefix: "298",
    },
    {
        iso2: "FJ",
        name: _td("Fiji"),
        prefix: "679",
    },
    {
        iso2: "FI",
        name: _td("Finland"),
        prefix: "358",
    },
    {
        iso2: "FR",
        name: _td("France"),
        prefix: "33",
    },
    {
        iso2: "GF",
        name: _td("French Guiana"),
        prefix: "594",
    },
    {
        iso2: "PF",
        name: _td("French Polynesia"),
        prefix: "689",
    },
    {
        iso2: "TF",
        name: _td("French Southern Territories"),
        prefix: "262",
    },
    {
        iso2: "GA",
        name: _td("Gabon"),
        prefix: "241",
    },
    {
        iso2: "GM",
        name: _td("Gambia"),
        prefix: "220",
    },
    {
        iso2: "GE",
        name: _td("Georgia"),
        prefix: "995",
    },
    {
        iso2: "DE",
        name: _td("Germany"),
        prefix: "49",
    },
    {
        iso2: "GH",
        name: _td("Ghana"),
        prefix: "233",
    },
    {
        iso2: "GI",
        name: _td("Gibraltar"),
        prefix: "350",
    },
    {
        iso2: "GR",
        name: _td("Greece"),
        prefix: "30",
    },
    {
        iso2: "GL",
        name: _td("Greenland"),
        prefix: "299",
    },
    {
        iso2: "GD",
        name: _td("Grenada"),
        prefix: "1",
    },
    {
        iso2: "GP",
        name: _td("Guadeloupe"),
        prefix: "590",
    },
    {
        iso2: "GU",
        name: _td("Guam"),
        prefix: "1",
    },
    {
        iso2: "GT",
        name: _td("Guatemala"),
        prefix: "502",
    },
    {
        iso2: "GG",
        name: _td("Guernsey"),
        prefix: "44",
    },
    {
        iso2: "GN",
        name: _td("Guinea"),
        prefix: "224",
    },
    {
        iso2: "GW",
        name: _td("Guinea-Bissau"),
        prefix: "245",
    },
    {
        iso2: "GY",
        name: _td("Guyana"),
        prefix: "592",
    },
    {
        iso2: "HT",
        name: _td("Haiti"),
        prefix: "509",
    },
    {
        iso2: "HM",
        name: _td("Heard & McDonald Islands"),
        prefix: "672",
    },
    {
        iso2: "HN",
        name: _td("Honduras"),
        prefix: "504",
    },
    {
        iso2: "HK",
        name: _td("Hong Kong"),
        prefix: "852",
    },
    {
        iso2: "HU",
        name: _td("Hungary"),
        prefix: "36",
    },
    {
        iso2: "IS",
        name: _td("Iceland"),
        prefix: "354",
    },
    {
        iso2: "IN",
        name: _td("India"),
        prefix: "91",
    },
    {
        iso2: "ID",
        name: _td("Indonesia"),
        prefix: "62",
    },
    {
        iso2: "IR",
        name: _td("Iran"),
        prefix: "98",
    },
    {
        iso2: "IQ",
        name: _td("Iraq"),
        prefix: "964",
    },
    {
        iso2: "IE",
        name: _td("Ireland"),
        prefix: "353",
    },
    {
        iso2: "IM",
        name: _td("Isle of Man"),
        prefix: "44",
    },
    {
        iso2: "IL",
        name: _td("Israel"),
        prefix: "972",
    },
    {
        iso2: "IT",
        name: _td("Italy"),
        prefix: "39",
    },
    {
        iso2: "JM",
        name: _td("Jamaica"),
        prefix: "1",
    },
    {
        iso2: "JP",
        name: _td("Japan"),
        prefix: "81",
    },
    {
        iso2: "JE",
        name: _td("Jersey"),
        prefix: "44",
    },
    {
        iso2: "JO",
        name: _td("Jordan"),
        prefix: "962",
    },
    {
        iso2: "KZ",
        name: _td("Kazakhstan"),
        prefix: "7",
    },
    {
        iso2: "KE",
        name: _td("Kenya"),
        prefix: "254",
    },
    {
        iso2: "KI",
        name: _td("Kiribati"),
        prefix: "686",
    },
    {
        iso2: "XK",
        name: _td("Kosovo"),
        prefix: "383",
    },
    {
        iso2: "KW",
        name: _td("Kuwait"),
        prefix: "965",
    },
    {
        iso2: "KG",
        name: _td("Kyrgyzstan"),
        prefix: "996",
    },
    {
        iso2: "LA",
        name: _td("Laos"),
        prefix: "856",
    },
    {
        iso2: "LV",
        name: _td("Latvia"),
        prefix: "371",
    },
    {
        iso2: "LB",
        name: _td("Lebanon"),
        prefix: "961",
    },
    {
        iso2: "LS",
        name: _td("Lesotho"),
        prefix: "266",
    },
    {
        iso2: "LR",
        name: _td("Liberia"),
        prefix: "231",
    },
    {
        iso2: "LY",
        name: _td("Libya"),
        prefix: "218",
    },
    {
        iso2: "LI",
        name: _td("Liechtenstein"),
        prefix: "423",
    },
    {
        iso2: "LT",
        name: _td("Lithuania"),
        prefix: "370",
    },
    {
        iso2: "LU",
        name: _td("Luxembourg"),
        prefix: "352",
    },
    {
        iso2: "MO",
        name: _td("Macau"),
        prefix: "853",
    },
    {
        iso2: "MK",
        name: _td("Macedonia"),
        prefix: "389",
    },
    {
        iso2: "MG",
        name: _td("Madagascar"),
        prefix: "261",
    },
    {
        iso2: "MW",
        name: _td("Malawi"),
        prefix: "265",
    },
    {
        iso2: "MY",
        name: _td("Malaysia"),
        prefix: "60",
    },
    {
        iso2: "MV",
        name: _td("Maldives"),
        prefix: "960",
    },
    {
        iso2: "ML",
        name: _td("Mali"),
        prefix: "223",
    },
    {
        iso2: "MT",
        name: _td("Malta"),
        prefix: "356",
    },
    {
        iso2: "MH",
        name: _td("Marshall Islands"),
        prefix: "692",
    },
    {
        iso2: "MQ",
        name: _td("Martinique"),
        prefix: "596",
    },
    {
        iso2: "MR",
        name: _td("Mauritania"),
        prefix: "222",
    },
    {
        iso2: "MU",
        name: _td("Mauritius"),
        prefix: "230",
    },
    {
        iso2: "YT",
        name: _td("Mayotte"),
        prefix: "262",
    },
    {
        iso2: "MX",
        name: _td("Mexico"),
        prefix: "52",
    },
    {
        iso2: "FM",
        name: _td("Micronesia"),
        prefix: "691",
    },
    {
        iso2: "MD",
        name: _td("Moldova"),
        prefix: "373",
    },
    {
        iso2: "MC",
        name: _td("Monaco"),
        prefix: "377",
    },
    {
        iso2: "MN",
        name: _td("Mongolia"),
        prefix: "976",
    },
    {
        iso2: "ME",
        name: _td("Montenegro"),
        prefix: "382",
    },
    {
        iso2: "MS",
        name: _td("Montserrat"),
        prefix: "1",
    },
    {
        iso2: "MA",
        name: _td("Morocco"),
        prefix: "212",
    },
    {
        iso2: "MZ",
        name: _td("Mozambique"),
        prefix: "258",
    },
    {
        iso2: "MM",
        name: _td("Myanmar"),
        prefix: "95",
    },
    {
        iso2: "NA",
        name: _td("Namibia"),
        prefix: "264",
    },
    {
        iso2: "NR",
        name: _td("Nauru"),
        prefix: "674",
    },
    {
        iso2: "NP",
        name: _td("Nepal"),
        prefix: "977",
    },
    {
        iso2: "NL",
        name: _td("Netherlands"),
        prefix: "31",
    },
    {
        iso2: "NC",
        name: _td("New Caledonia"),
        prefix: "687",
    },
    {
        iso2: "NZ",
        name: _td("New Zealand"),
        prefix: "64",
    },
    {
        iso2: "NI",
        name: _td("Nicaragua"),
        prefix: "505",
    },
    {
        iso2: "NE",
        name: _td("Niger"),
        prefix: "227",
    },
    {
        iso2: "NG",
        name: _td("Nigeria"),
        prefix: "234",
    },
    {
        iso2: "NU",
        name: _td("Niue"),
        prefix: "683",
    },
    {
        iso2: "NF",
        name: _td("Norfolk Island"),
        prefix: "672",
    },
    {
        iso2: "KP",
        name: _td("North Korea"),
        prefix: "850",
    },
    {
        iso2: "MP",
        name: _td("Northern Mariana Islands"),
        prefix: "1",
    },
    {
        iso2: "NO",
        name: _td("Norway"),
        prefix: "47",
    },
    {
        iso2: "OM",
        name: _td("Oman"),
        prefix: "968",
    },
    {
        iso2: "PK",
        name: _td("Pakistan"),
        prefix: "92",
    },
    {
        iso2: "PW",
        name: _td("Palau"),
        prefix: "680",
    },
    {
        iso2: "PS",
        name: _td("Palestine"),
        prefix: "970",
    },
    {
        iso2: "PA",
        name: _td("Panama"),
        prefix: "507",
    },
    {
        iso2: "PG",
        name: _td("Papua New Guinea"),
        prefix: "675",
    },
    {
        iso2: "PY",
        name: _td("Paraguay"),
        prefix: "595",
    },
    {
        iso2: "PE",
        name: _td("Peru"),
        prefix: "51",
    },
    {
        iso2: "PH",
        name: _td("Philippines"),
        prefix: "63",
    },
    {
        iso2: "PN",
        name: _td("Pitcairn Islands"),
        prefix: "870",
    },
    {
        iso2: "PL",
        name: _td("Poland"),
        prefix: "48",
    },
    {
        iso2: "PT",
        name: _td("Portugal"),
        prefix: "351",
    },
    {
        iso2: "PR",
        name: _td("Puerto Rico"),
        prefix: "1",
    },
    {
        iso2: "QA",
        name: _td("Qatar"),
        prefix: "974",
    },
    {
        iso2: "RO",
        name: _td("Romania"),
        prefix: "40",
    },
    {
        iso2: "RU",
        name: _td("Russia"),
        prefix: "7",
    },
    {
        iso2: "RW",
        name: _td("Rwanda"),
        prefix: "250",
    },
    {
        iso2: "RE",
        name: _td("R\u00e9union"),
        prefix: "262",
    },
    {
        iso2: "WS",
        name: _td("Samoa"),
        prefix: "685",
    },
    {
        iso2: "SM",
        name: _td("San Marino"),
        prefix: "378",
    },
    {
        iso2: "SA",
        name: _td("Saudi Arabia"),
        prefix: "966",
    },
    {
        iso2: "SN",
        name: _td("Senegal"),
        prefix: "221",
    },
    {
        iso2: "RS",
        name: _td("Serbia"),
        prefix: "381 p",
    },
    {
        iso2: "SC",
        name: _td("Seychelles"),
        prefix: "248",
    },
    {
        iso2: "SL",
        name: _td("Sierra Leone"),
        prefix: "232",
    },
    {
        iso2: "SG",
        name: _td("Singapore"),
        prefix: "65",
    },
    {
        iso2: "SX",
        name: _td("Sint Maarten"),
        prefix: "1",
    },
    {
        iso2: "SK",
        name: _td("Slovakia"),
        prefix: "421",
    },
    {
        iso2: "SI",
        name: _td("Slovenia"),
        prefix: "386",
    },
    {
        iso2: "SB",
        name: _td("Solomon Islands"),
        prefix: "677",
    },
    {
        iso2: "SO",
        name: _td("Somalia"),
        prefix: "252",
    },
    {
        iso2: "ZA",
        name: _td("South Africa"),
        prefix: "27",
    },
    {
        iso2: "GS",
        name: _td("South Georgia & South Sandwich Islands"),
        prefix: "500",
    },
    {
        iso2: "KR",
        name: _td("South Korea"),
        prefix: "82",
    },
    {
        iso2: "SS",
        name: _td("South Sudan"),
        prefix: "211",
    },
    {
        iso2: "ES",
        name: _td("Spain"),
        prefix: "34",
    },
    {
        iso2: "LK",
        name: _td("Sri Lanka"),
        prefix: "94",
    },
    {
        iso2: "BL",
        name: _td("St. Barth\u00e9lemy"),
        prefix: "590",
    },
    {
        iso2: "SH",
        name: _td("St. Helena"),
        prefix: "290 n",
    },
    {
        iso2: "KN",
        name: _td("St. Kitts & Nevis"),
        prefix: "1",
    },
    {
        iso2: "LC",
        name: _td("St. Lucia"),
        prefix: "1",
    },
    {
        iso2: "MF",
        name: _td("St. Martin"),
        prefix: "590",
    },
    {
        iso2: "PM",
        name: _td("St. Pierre & Miquelon"),
        prefix: "508",
    },
    {
        iso2: "VC",
        name: _td("St. Vincent & Grenadines"),
        prefix: "1",
    },
    {
        iso2: "SD",
        name: _td("Sudan"),
        prefix: "249",
    },
    {
        iso2: "SR",
        name: _td("Suriname"),
        prefix: "597",
    },
    {
        iso2: "SJ",
        name: _td("Svalbard & Jan Mayen"),
        prefix: "47",
    },
    {
        iso2: "SZ",
        name: _td("Swaziland"),
        prefix: "268",
    },
    {
        iso2: "SE",
        name: _td("Sweden"),
        prefix: "46",
    },
    {
        iso2: "CH",
        name: _td("Switzerland"),
        prefix: "41",
    },
    {
        iso2: "SY",
        name: _td("Syria"),
        prefix: "963",
    },
    {
        iso2: "ST",
        name: _td("S\u00e3o Tom\u00e9 & Pr\u00edncipe"),
        prefix: "239",
    },
    {
        iso2: "TW",
        name: _td("Taiwan"),
        prefix: "886",
    },
    {
        iso2: "TJ",
        name: _td("Tajikistan"),
        prefix: "992",
    },
    {
        iso2: "TZ",
        name: _td("Tanzania"),
        prefix: "255",
    },
    {
        iso2: "TH",
        name: _td("Thailand"),
        prefix: "66",
    },
    {
        iso2: "TL",
        name: _td("Timor-Leste"),
        prefix: "670",
    },
    {
        iso2: "TG",
        name: _td("Togo"),
        prefix: "228",
    },
    {
        iso2: "TK",
        name: _td("Tokelau"),
        prefix: "690",
    },
    {
        iso2: "TO",
        name: _td("Tonga"),
        prefix: "676",
    },
    {
        iso2: "TT",
        name: _td("Trinidad & Tobago"),
        prefix: "1",
    },
    {
        iso2: "TN",
        name: _td("Tunisia"),
        prefix: "216",
    },
    {
        iso2: "TR",
        name: _td("Turkey"),
        prefix: "90",
    },
    {
        iso2: "TM",
        name: _td("Turkmenistan"),
        prefix: "993",
    },
    {
        iso2: "TC",
        name: _td("Turks & Caicos Islands"),
        prefix: "1",
    },
    {
        iso2: "TV",
        name: _td("Tuvalu"),
        prefix: "688",
    },
    {
        iso2: "VI",
        name: _td("U.S. Virgin Islands"),
        prefix: "1",
    },
    {
        iso2: "UG",
        name: _td("Uganda"),
        prefix: "256",
    },
    {
        iso2: "UA",
        name: _td("Ukraine"),
        prefix: "380",
    },
    {
        iso2: "AE",
        name: _td("United Arab Emirates"),
        prefix: "971",
    },
    {
        iso2: "UY",
        name: _td("Uruguay"),
        prefix: "598",
    },
    {
        iso2: "UZ",
        name: _td("Uzbekistan"),
        prefix: "998",
    },
    {
        iso2: "VU",
        name: _td("Vanuatu"),
        prefix: "678",
    },
    {
        iso2: "VA",
        name: _td("Vatican City"),
        prefix: "39",
    },
    {
        iso2: "VE",
        name: _td("Venezuela"),
        prefix: "58",
    },
    {
        iso2: "VN",
        name: _td("Vietnam"),
        prefix: "84",
    },
    {
        iso2: "WF",
        name: _td("Wallis & Futuna"),
        prefix: "681",
    },
    {
        iso2: "EH",
        name: _td("Western Sahara"),
        prefix: "212",
    },
    {
        iso2: "YE",
        name: _td("Yemen"),
        prefix: "967",
    },
    {
        iso2: "ZM",
        name: _td("Zambia"),
        prefix: "260",
    },
    {
        iso2: "ZW",
        name: _td("Zimbabwe"),
        prefix: "263",
    },
];
