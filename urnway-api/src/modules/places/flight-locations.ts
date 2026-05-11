import type { LocationSuggestion } from '@urnway/contracts';

type FlightLocationEntry = {
  code: string;
  label: string;
  kind: 'city' | 'airport';
  secondaryText: string;
  aliases: string[];
};

const flightLocationEntries: FlightLocationEntry[] = [
  {
    code: 'LON',
    label: 'London',
    kind: 'city',
    secondaryText: 'City code · All London airports',
    aliases: ['london', 'lon', 'all london airports'],
  },
  {
    code: 'LHR',
    label: 'Heathrow Airport',
    kind: 'airport',
    secondaryText: 'London, United Kingdom',
    aliases: ['heathrow', 'heathrow airport', 'lhr', 'london heathrow'],
  },
  {
    code: 'LGW',
    label: 'Gatwick Airport',
    kind: 'airport',
    secondaryText: 'London, United Kingdom',
    aliases: ['gatwick', 'gatwick airport', 'lgw', 'london gatwick'],
  },
  {
    code: 'LCY',
    label: 'London City Airport',
    kind: 'airport',
    secondaryText: 'London, United Kingdom',
    aliases: ['london city', 'london city airport', 'lcy'],
  },
  {
    code: 'LTN',
    label: 'Luton Airport',
    kind: 'airport',
    secondaryText: 'London, United Kingdom',
    aliases: ['luton', 'luton airport', 'ltn', 'london luton'],
  },
  {
    code: 'STN',
    label: 'Stansted Airport',
    kind: 'airport',
    secondaryText: 'London, United Kingdom',
    aliases: ['stansted', 'stansted airport', 'stn', 'london stansted'],
  },
  {
    code: 'NYC',
    label: 'New York',
    kind: 'city',
    secondaryText: 'City code · New York metro airports',
    aliases: ['new york', 'nyc', 'all new york airports'],
  },
  {
    code: 'JFK',
    label: 'John F. Kennedy International Airport',
    kind: 'airport',
    secondaryText: 'New York, United States',
    aliases: ['jfk', 'john f kennedy', 'john f kennedy international', 'kennedy airport'],
  },
  {
    code: 'LGA',
    label: 'LaGuardia Airport',
    kind: 'airport',
    secondaryText: 'New York, United States',
    aliases: ['lga', 'laguardia', 'laguardia airport'],
  },
  {
    code: 'EWR',
    label: 'Newark Liberty International Airport',
    kind: 'airport',
    secondaryText: 'Newark / New York, United States',
    aliases: ['ewr', 'newark', 'newark airport', 'newark liberty'],
  },
  {
    code: 'PAR',
    label: 'Paris',
    kind: 'city',
    secondaryText: 'City code · Paris metro airports',
    aliases: ['paris', 'par', 'all paris airports'],
  },
  {
    code: 'CDG',
    label: 'Charles de Gaulle Airport',
    kind: 'airport',
    secondaryText: 'Paris, France',
    aliases: ['cdg', 'charles de gaulle', 'roissy', 'paris charles de gaulle'],
  },
  {
    code: 'ORY',
    label: 'Orly Airport',
    kind: 'airport',
    secondaryText: 'Paris, France',
    aliases: ['ory', 'orly', 'orly airport', 'paris orly'],
  },
  {
    code: 'LOS',
    label: 'Lagos',
    kind: 'city',
    secondaryText: 'Murtala Muhammed International',
    aliases: ['lagos', 'los', 'ikeja'],
  },
  {
    code: 'ABV',
    label: 'Abuja',
    kind: 'city',
    secondaryText: 'Nnamdi Azikiwe International',
    aliases: ['abuja', 'abv', 'nnamdi azikiwe'],
  },
  {
    code: 'ACC',
    label: 'Accra',
    kind: 'city',
    secondaryText: 'Kotoka International',
    aliases: ['accra', 'acc', 'kotoka'],
  },
  {
    code: 'NBO',
    label: 'Nairobi',
    kind: 'city',
    secondaryText: 'Jomo Kenyatta International',
    aliases: ['nairobi', 'nbo', 'jomo kenyatta'],
  },
  {
    code: 'CAI',
    label: 'Cairo',
    kind: 'city',
    secondaryText: 'Cairo International',
    aliases: ['cairo', 'cai', 'cairo international'],
  },
  {
    code: 'JNB',
    label: 'Johannesburg',
    kind: 'city',
    secondaryText: 'O.R. Tambo International',
    aliases: ['johannesburg', 'jnb', 'or tambo', 'o r tambo'],
  },
  {
    code: 'CPT',
    label: 'Cape Town',
    kind: 'city',
    secondaryText: 'Cape Town International',
    aliases: ['cape town', 'cpt', 'cape town international'],
  },
  {
    code: 'KGL',
    label: 'Kigali',
    kind: 'city',
    secondaryText: 'Kigali International',
    aliases: ['kigali', 'kgl'],
  },
  {
    code: 'DXB',
    label: 'Dubai',
    kind: 'city',
    secondaryText: 'Dubai International',
    aliases: ['dubai', 'dxb', 'dubai international'],
  },
  {
    code: 'DOH',
    label: 'Doha',
    kind: 'city',
    secondaryText: 'Hamad International',
    aliases: ['doha', 'doh', 'hamad', 'hamad international'],
  },
  {
    code: 'IST',
    label: 'Istanbul',
    kind: 'city',
    secondaryText: 'Istanbul Airport',
    aliases: ['istanbul', 'ist', 'istanbul airport', 'sabiha gokcen'],
  },
  {
    code: 'AMS',
    label: 'Amsterdam',
    kind: 'city',
    secondaryText: 'Schiphol Airport',
    aliases: ['amsterdam', 'ams', 'schiphol'],
  },
  {
    code: 'BER',
    label: 'Berlin',
    kind: 'city',
    secondaryText: 'Berlin Brandenburg',
    aliases: ['berlin', 'ber', 'brandenburg'],
  },
  {
    code: 'MAD',
    label: 'Madrid',
    kind: 'city',
    secondaryText: 'Adolfo Suarez Madrid-Barajas',
    aliases: ['madrid', 'mad', 'barajas'],
  },
  {
    code: 'BCN',
    label: 'Barcelona',
    kind: 'city',
    secondaryText: 'Barcelona-El Prat',
    aliases: ['barcelona', 'bcn', 'el prat'],
  },
  {
    code: 'LIS',
    label: 'Lisbon',
    kind: 'city',
    secondaryText: 'Humberto Delgado Airport',
    aliases: ['lisbon', 'lis', 'humberto delgado', 'portela'],
  },
  {
    code: 'ROM',
    label: 'Rome',
    kind: 'city',
    secondaryText: 'City code · Rome metro airports',
    aliases: ['rome', 'rom', 'all rome airports'],
  },
  {
    code: 'FCO',
    label: 'Leonardo da Vinci Fiumicino Airport',
    kind: 'airport',
    secondaryText: 'Rome, Italy',
    aliases: ['fco', 'fiumicino', 'rome fiumicino', 'leonardo da vinci'],
  },
  {
    code: 'CIA',
    label: 'Ciampino Airport',
    kind: 'airport',
    secondaryText: 'Rome, Italy',
    aliases: ['cia', 'ciampino', 'rome ciampino'],
  },
  {
    code: 'MIL',
    label: 'Milan',
    kind: 'city',
    secondaryText: 'City code · Milan airports',
    aliases: ['milan', 'mil', 'all milan airports'],
  },
  {
    code: 'ATH',
    label: 'Athens',
    kind: 'city',
    secondaryText: 'Athens International',
    aliases: ['athens', 'ath', 'eleftherios venizelos'],
  },
  {
    code: 'DUB',
    label: 'Dublin',
    kind: 'city',
    secondaryText: 'Dublin Airport',
    aliases: ['dublin', 'dub'],
  },
  {
    code: 'MAN',
    label: 'Manchester',
    kind: 'city',
    secondaryText: 'Manchester Airport',
    aliases: ['manchester', 'man'],
  },
  {
    code: 'EDI',
    label: 'Edinburgh',
    kind: 'city',
    secondaryText: 'Edinburgh Airport',
    aliases: ['edinburgh', 'edi'],
  },
  {
    code: 'WAS',
    label: 'Washington',
    kind: 'city',
    secondaryText: 'City code · Washington area airports',
    aliases: ['washington', 'was', 'washington dc', 'all washington airports'],
  },
  {
    code: 'ATL',
    label: 'Atlanta',
    kind: 'city',
    secondaryText: 'Hartsfield-Jackson Atlanta International',
    aliases: ['atlanta', 'atl', 'hartsfield jackson'],
  },
  {
    code: 'MIA',
    label: 'Miami',
    kind: 'city',
    secondaryText: 'Miami International',
    aliases: ['miami', 'mia', 'miami international'],
  },
  {
    code: 'ORD',
    label: "Chicago O'Hare International Airport",
    kind: 'airport',
    secondaryText: 'Chicago, United States',
    aliases: ['ord', 'ohare', 'o hare', 'chicago ohare'],
  },
  {
    code: 'LAX',
    label: 'Los Angeles International Airport',
    kind: 'airport',
    secondaryText: 'Los Angeles, United States',
    aliases: ['lax', 'los angeles', 'los angeles international'],
  },
  {
    code: 'SFO',
    label: 'San Francisco International Airport',
    kind: 'airport',
    secondaryText: 'San Francisco, United States',
    aliases: ['sfo', 'san francisco', 'san francisco international'],
  },
  {
    code: 'YTO',
    label: 'Toronto',
    kind: 'city',
    secondaryText: 'City code · Toronto area airports',
    aliases: ['toronto', 'yto', 'all toronto airports'],
  },
  {
    code: 'YYZ',
    label: 'Toronto Pearson International Airport',
    kind: 'airport',
    secondaryText: 'Toronto, Canada',
    aliases: ['yyz', 'pearson', 'toronto pearson'],
  },
  {
    code: 'YVR',
    label: 'Vancouver',
    kind: 'city',
    secondaryText: 'Vancouver International',
    aliases: ['vancouver', 'yvr', 'vancouver international'],
  },
  {
    code: 'GVA',
    label: 'Geneva',
    kind: 'city',
    secondaryText: 'Geneva Airport',
    aliases: ['geneva', 'gva'],
  },
  {
    code: 'ZRH',
    label: 'Zurich',
    kind: 'city',
    secondaryText: 'Zurich Airport',
    aliases: ['zurich', 'zrh'],
  },
  {
    code: 'VIE',
    label: 'Vienna',
    kind: 'city',
    secondaryText: 'Vienna International',
    aliases: ['vienna', 'vie'],
  },
  {
    code: 'BRU',
    label: 'Brussels',
    kind: 'city',
    secondaryText: 'Brussels Airport',
    aliases: ['brussels', 'bru'],
  },
  {
    code: 'CPH',
    label: 'Copenhagen',
    kind: 'city',
    secondaryText: 'Copenhagen Airport',
    aliases: ['copenhagen', 'cph'],
  },
  {
    code: 'ARN',
    label: 'Stockholm',
    kind: 'city',
    secondaryText: 'Stockholm Arlanda',
    aliases: ['stockholm', 'arn', 'arlanda'],
  },
  {
    code: 'OSL',
    label: 'Oslo',
    kind: 'city',
    secondaryText: 'Oslo Gardermoen',
    aliases: ['oslo', 'osl', 'gardermoen'],
  },
  {
    code: 'HEL',
    label: 'Helsinki',
    kind: 'city',
    secondaryText: 'Helsinki Airport',
    aliases: ['helsinki', 'hel'],
  },
  {
    code: 'SIN',
    label: 'Singapore',
    kind: 'city',
    secondaryText: 'Singapore Changi',
    aliases: ['singapore', 'sin', 'changi'],
  },
  {
    code: 'HKG',
    label: 'Hong Kong',
    kind: 'city',
    secondaryText: 'Hong Kong International',
    aliases: ['hong kong', 'hkg', 'chek lap kok'],
  },
  {
    code: 'BKK',
    label: 'Bangkok',
    kind: 'city',
    secondaryText: 'Suvarnabhumi Airport',
    aliases: ['bangkok', 'bkk', 'suvarnabhumi'],
  },
  {
    code: 'NRT',
    label: 'Narita International Airport',
    kind: 'airport',
    secondaryText: 'Tokyo, Japan',
    aliases: ['narita', 'nrt', 'tokyo narita'],
  },
  {
    code: 'HND',
    label: 'Haneda Airport',
    kind: 'airport',
    secondaryText: 'Tokyo, Japan',
    aliases: ['haneda', 'hnd', 'tokyo haneda'],
  },
  {
    code: 'ICN',
    label: 'Incheon International Airport',
    kind: 'airport',
    secondaryText: 'Seoul, South Korea',
    aliases: ['incheon', 'icn', 'seoul incheon'],
  },
  {
    code: 'SYD',
    label: 'Sydney',
    kind: 'city',
    secondaryText: 'Sydney Kingsford Smith',
    aliases: ['sydney', 'syd', 'kingsford smith'],
  },
  {
    code: 'MEL',
    label: 'Melbourne',
    kind: 'city',
    secondaryText: 'Melbourne Airport',
    aliases: ['melbourne', 'mel'],
  },
  {
    code: 'AKL',
    label: 'Auckland',
    kind: 'city',
    secondaryText: 'Auckland Airport',
    aliases: ['auckland', 'akl'],
  },
];

function scoreMatch(query: string, entry: FlightLocationEntry) {
  const normalizedLabel = entry.label.toLowerCase();
  const normalizedSecondary = entry.secondaryText.toLowerCase();
  const normalizedCode = entry.code.toLowerCase();

  if (normalizedCode === query) {
    return 2000;
  }

  if (normalizedLabel === query) {
    return 1800;
  }

  if (entry.aliases.some((alias) => alias === query)) {
    return entry.kind === 'city' ? 1700 : 1650;
  }

  if (normalizedCode.startsWith(query)) {
    return 1500;
  }

  if (normalizedLabel.startsWith(query)) {
    return entry.kind === 'city' ? 1400 : 1350;
  }

  if (entry.aliases.some((alias) => alias.startsWith(query))) {
    return entry.kind === 'city' ? 1300 : 1250;
  }

  if (normalizedLabel.includes(query)) {
    return entry.kind === 'city' ? 1100 : 1050;
  }

  if (entry.aliases.some((alias) => alias.includes(query))) {
    return entry.kind === 'city' ? 1000 : 950;
  }

  if (normalizedSecondary.includes(query)) {
    return 850;
  }

  return -1;
}

function toLocationSuggestion(entry: FlightLocationEntry): LocationSuggestion {
  return {
    id: `flight:${entry.kind}:${entry.code}:${entry.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    placeId: null,
    label: `${entry.label} (${entry.code})`,
    primaryText: entry.label,
    secondaryText: entry.secondaryText,
    searchValue: entry.code,
    source: 'local',
  };
}

export function searchFlightLocationSuggestions(query: string): LocationSuggestion[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return [];
  }

  return flightLocationEntries
    .map((entry) => ({
      entry,
      score: scoreMatch(normalized, entry),
    }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => right.score - left.score || left.entry.label.localeCompare(right.entry.label))
    .slice(0, 8)
    .map(({ entry }) => toLocationSuggestion(entry));
}

export function resolveFlightLocationCode(value: string) {
  const trimmed = value.trim();

  if (/^[A-Za-z]{3}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  const normalized = trimmed.toLowerCase();
  const exactMatch = flightLocationEntries.find(
    (entry) =>
      entry.label.toLowerCase() === normalized ||
      entry.aliases.includes(normalized)
  );

  if (exactMatch) {
    return exactMatch.code;
  }

  const bestMatch = flightLocationEntries
    .map((entry) => ({
      entry,
      score: scoreMatch(normalized, entry),
    }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => right.score - left.score)
    .at(0);

  return bestMatch?.entry.code ?? null;
}
