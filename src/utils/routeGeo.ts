// Positions of the towns that appear most in trip routes. They are looked up
// first, so the common places show on the dashboard map at once; anything else
// is searched on OpenStreetMap (see placeGeo.ts). Trips store free-text places
// ("Chennai Yard", "Sriperumbudur ICD"), so a place is matched by the first
// known town name it contains.

export interface Town { name: string; lat: number; lon: number }

const TOWNS: { keys: string[]; town: Town }[] = [
  // The company's own sites and customers inside Chennai get their own spot, so a
  // movement between them can be drawn. They come before 'chennai' so that, say,
  // "Bharathi Cements, Chennai" is found as Bharathi. Positions are approximate.
  { keys: ['bharathi'], town: { name: 'Bharathi (Manali)', lat: 13.165, lon: 80.262 } },
  { keys: ['shree mira'], town: { name: 'Shree Mira (Guindy)', lat: 13.007, lon: 80.221 } },
  { keys: ['ntecl'], town: { name: 'NTECL (Vallur)', lat: 13.256, lon: 80.311 } },
  // Areas in and around Chennai that the company's places are named after
  // ("CUSTOMER - AREA"). Positions are the area's centre from OpenStreetMap, so
  // approximate; customers in the same area share a spot. Longer names that
  // contain a shorter one come first ("Velappanchavadi" before "Avadi").
  { keys: ['velappanchavadi', 'velapanchavadi'], town: { name: 'Velappanchavadi', lat: 13.0609, lon: 80.137 } },
  { keys: ['vadapalani'], town: { name: 'Vadapalani', lat: 13.0503, lon: 80.2118 } },
  { keys: ['periyapalayam'], town: { name: 'Periyapalayam', lat: 13.3094, lon: 80.0474 } },
  { keys: ['kundrathur', 'kundrathoor'], town: { name: 'Kundrathur', lat: 12.9958, lon: 80.0973 } },
  { keys: ['manali'], town: { name: 'Manali', lat: 13.1811, lon: 80.2694 } },
  { keys: ['sholavaram'], town: { name: 'Sholavaram', lat: 13.2388, lon: 80.1622 } },
  { keys: ['poonamallee', 'poonamalle'], town: { name: 'Poonamallee', lat: 13.0417, lon: 80.1007 } },
  { keys: ['madhavaram'], town: { name: 'Madhavaram', lat: 13.15, lon: 80.23 } },
  { keys: ['ambattur', 'ambathur'], town: { name: 'Ambattur', lat: 13.1066, lon: 80.168 } },
  { keys: ['red hills', 'redhills'], town: { name: 'Red Hills', lat: 13.1923, lon: 80.1838 } },
  { keys: ['sunguvarchatram', 'sunguvarchathiram'], town: { name: 'Sunguvarchatram', lat: 12.9256, lon: 79.879 } },
  { keys: ['siruseri'], town: { name: 'Siruseri', lat: 12.8315, lon: 80.2094 } },
  // The owner's clarification: Suncity is near Siruseri, Thandalam near Kundrathur
  // (the Thandalam by Kundrathur, not the village near Sriperumbudur).
  { keys: ['suncity', 'sun city'], town: { name: 'Suncity', lat: 12.8403, lon: 80.149 } },
  { keys: ['thandalam'], town: { name: 'Thandalam', lat: 13.0015, lon: 80.1182 } },
  { keys: ['thirumudivakkam'], town: { name: 'Thirumudivakkam', lat: 12.9649, lon: 80.0815 } },
  { keys: ['mambakkam'], town: { name: 'Mambakkam', lat: 12.836, lon: 80.169 } },
  { keys: ['vyasarpadi'], town: { name: 'Vyasarpadi', lat: 13.113, lon: 80.2587 } },
  { keys: ['avadi'], town: { name: 'Avadi', lat: 13.119, lon: 80.0936 } },
  { keys: ['maraimalai'], town: { name: 'Maraimalai Nagar', lat: 12.7958, lon: 80.0269 } },
  { keys: ['pallavaram'], town: { name: 'Pallavaram', lat: 12.9655, lon: 80.1451 } },
  { keys: ['kosapur'], town: { name: 'Kosapur', lat: 13.172, lon: 80.237 } },
  { keys: ['vallakkottai', 'vallakottai'], town: { name: 'Vallakkottai', lat: 12.8827, lon: 79.9351 } },
  { keys: ['shoolagiri'], town: { name: 'Shoolagiri', lat: 12.6648, lon: 78.0106 } },
  { keys: ['ennore'], town: { name: 'Ennore', lat: 13.21, lon: 80.32 } },
  { keys: ['sriperumbudur'], town: { name: 'Sriperumbudur', lat: 12.97, lon: 79.94 } },
  { keys: ['hosur'], town: { name: 'Hosur', lat: 12.74, lon: 77.83 } },
  { keys: ['bengaluru', 'bangalore'], town: { name: 'Bengaluru', lat: 12.97, lon: 77.59 } },
  { keys: ['coimbatore'], town: { name: 'Coimbatore', lat: 11.0, lon: 76.96 } },
  { keys: ['tirupur', 'tiruppur'], town: { name: 'Tirupur', lat: 11.11, lon: 77.34 } },
  { keys: ['erode'], town: { name: 'Erode', lat: 11.34, lon: 77.72 } },
  { keys: ['salem'], town: { name: 'Salem', lat: 11.66, lon: 78.15 } },
  { keys: ['trichy', 'tiruchirappalli', 'tiruchi'], town: { name: 'Trichy', lat: 10.8, lon: 78.69 } },
  { keys: ['madurai'], town: { name: 'Madurai', lat: 9.92, lon: 78.12 } },
  { keys: ['tuticorin', 'thoothukudi'], town: { name: 'Tuticorin', lat: 8.76, lon: 78.13 } },
  { keys: ['cochin', 'kochi', 'ernakulam'], town: { name: 'Cochin', lat: 9.93, lon: 76.27 } },
  { keys: ['tirupati'], town: { name: 'Tirupati', lat: 13.63, lon: 79.42 } },
  { keys: ['krishnapatnam'], town: { name: 'Krishnapatnam', lat: 14.25, lon: 80.12 } },
  { keys: ['nellore'], town: { name: 'Nellore', lat: 14.44, lon: 79.99 } },
  { keys: ['vijayawada'], town: { name: 'Vijayawada', lat: 16.51, lon: 80.65 } },
  { keys: ['hyderabad'], town: { name: 'Hyderabad', lat: 17.38, lon: 78.48 } },
  { keys: ['visakhapatnam', 'vizag'], town: { name: 'Visakhapatnam', lat: 17.69, lon: 83.22 } },
  // last, so a more specific area in the same text wins
  { keys: ['chennai', 'madras'], town: { name: 'Chennai', lat: 13.08, lon: 80.27 } }
];

export function findTown(place: string): Town | null {
  const p = place.toLowerCase();
  for (const { keys, town } of TOWNS) if (keys.some((k) => p.includes(k))) return town;
  return null;
}
